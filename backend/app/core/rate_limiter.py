import time
from typing import Dict, Tuple
from threading import Lock

class RateLimiter:
    """
    Thread-safe in-memory rate limiter protecting against brute-force attacks.
    Locks identity / IP for lockout_seconds after max_failed_attempts consecutive failures.
    """
    def __init__(self, max_failed_attempts: int = 5, lockout_seconds: int = 900):
        self.max_failed_attempts = max_failed_attempts
        self.lockout_seconds = lockout_seconds
        # key -> (failure_count, last_attempt_timestamp, locked_until_timestamp)
        self._records: Dict[str, Tuple[int, float, float]] = {}
        self._lock = Lock()

    def is_blocked(self, key: str) -> bool:
        with self._lock:
            record = self._records.get(key)
            if not record:
                return False
            _, _, locked_until = record
            now = time.time()
            if locked_until > now:
                return True
            if locked_until > 0 and locked_until <= now:
                # Lockout period expired; reset record
                del self._records[key]
                return False
            return False

    def record_failed_attempt(self, key: str) -> None:
        with self._lock:
            now = time.time()
            count, _, locked_until = self._records.get(key, (0, now, 0))
            if locked_until > now:
                return  # Already locked

            new_count = count + 1
            if new_count >= self.max_failed_attempts:
                self._records[key] = (new_count, now, now + self.lockout_seconds)
            else:
                self._records[key] = (new_count, now, 0)

    def record_successful_attempt(self, key: str) -> None:
        with self._lock:
            if key in self._records:
                del self._records[key]

    def get_remaining_attempts(self, key: str) -> int:
        with self._lock:
            record = self._records.get(key)
            if not record:
                return self.max_failed_attempts
            count, _, _ = record
            return max(0, self.max_failed_attempts - count)

    def reset_all(self) -> None:
        with self._lock:
            self._records.clear()

rate_limiter = RateLimiter(max_failed_attempts=5, lockout_seconds=900)

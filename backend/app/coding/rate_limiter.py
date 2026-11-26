import time
from typing import Tuple, Optional
from app.core.config import settings


class CodingRedisGuard:
    """
    Multi-worker-safe rate limiter, per-user concurrency cap, and queue depth guard backed by Redis.
    Never uses process-local dicts in production so all Uvicorn workers share identical limits.
    """

    def __init__(self, redis_client=None) -> None:
        self._redis = redis_client

    async def check_and_acquire(
        self,
        user_id: int,
        queue_depth: int,
        max_queue_depth: Optional[int] = None,
        rate_per_min: Optional[int] = None,
        max_concurrent: Optional[int] = None,
    ) -> Tuple[bool, int, str]:
        q_max = max_queue_depth if max_queue_depth is not None else settings.CODING_MAX_QUEUE_DEPTH
        r_max = rate_per_min if rate_per_min is not None else settings.CODING_USER_RATE_LIMIT_PER_MIN
        c_max = max_concurrent if max_concurrent is not None else settings.CODING_USER_MAX_CONCURRENT

        if queue_depth >= q_max:
            return False, 5, "Execution queue is at capacity. Please retry shortly."

        if self._redis is None:
            # Only allowed when running in mock/unit-test mode without Redis
            if settings.ENVIRONMENT.lower() == "production":
                return False, 10, "Redis rate-limiter unavailable in production"
            return True, 0, "ok"

        minute_bucket = int(time.time() // 60)
        rate_key = f"coding:rl:{user_id}:{minute_bucket}"
        conc_key = f"coding:conc:{user_id}"

        pipe = self._redis.pipeline()
        pipe.incr(rate_key)
        pipe.expire(rate_key, 70)
        pipe.incr(conc_key)
        pipe.expire(conc_key, settings.CODING_JOB_TIMEOUT_SECONDS + 15)
        rate_count, _, conc_count, _ = await pipe.execute()

        if int(rate_count) > r_max:
            await self._redis.decr(conc_key)
            retry_after = max(1, 60 - int(time.time() % 60))
            return False, retry_after, f"Rate limit exceeded ({r_max}/min). Please wait {retry_after}s."

        if int(conc_count) > c_max:
            await self._redis.decr(conc_key)
            return False, 2, f"Too many concurrent executions ({c_max} max). Wait for your running job to finish."

        return True, 0, "ok"

    async def release_concurrency(self, user_id: int) -> None:
        if self._redis is None:
            return
        conc_key = f"coding:conc:{user_id}"
        val = await self._redis.decr(conc_key)
        if int(val) < 0:
            await self._redis.set(conc_key, 0, ex=60)

    async def check_draft_rate_limit(
        self,
        user_id: int,
        rate_per_min: Optional[int] = None,
    ) -> Tuple[bool, int, str]:
        r_max = rate_per_min if rate_per_min is not None else settings.CODING_DRAFT_RATE_LIMIT_PER_MIN
        if self._redis is None:
            if settings.ENVIRONMENT.lower() == "production":
                return False, 10, "Redis rate-limiter unavailable in production"
            return True, 0, "ok"

        minute_bucket = int(time.time() // 60)
        rate_key = f"coding:draft_rl:{user_id}:{minute_bucket}"
        pipe = self._redis.pipeline()
        pipe.incr(rate_key)
        pipe.expire(rate_key, 70)
        rate_count, _ = await pipe.execute()
        if int(rate_count) > r_max:
            retry_after = max(1, 60 - int(time.time() % 60))
            return False, retry_after, f"Draft autosave rate limit exceeded ({r_max}/min)."
        return True, 0, "ok"

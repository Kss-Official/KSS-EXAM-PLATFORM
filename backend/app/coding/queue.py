import asyncio
import json
import uuid
from typing import Any, AsyncIterator, Dict, Optional

from app.core.config import settings
from app.coding.metrics import coding_metrics, log_coding_event
from app.coding.rate_limiter import CodingRedisGuard

PUBSUB_CHANNEL_PREFIX = "coding:sub:"
DLQ_KEY = "coding:dlq"


class CodingQueueManager:
    """
    Manages Redis + ARQ job enqueueing, queue depth inspection, Redis Pub/Sub result streaming,
    and dead-letter handling. When CODING_SANDBOX_DRIVER == 'mock' and Redis is unavailable
    in local dev/test mode, falls back to an in-process async task runner.
    """

    def __init__(self) -> None:
        self._redis = None
        self._arq_pool = None
        self._local_subscribers: Dict[int, list[asyncio.Queue]] = {}
        self._local_queue_depth = 0
        self._init_attempted = False
        self._local_locks: Dict[str, asyncio.Lock] = {}
        self._local_tickets: Dict[str, tuple[float, int]] = {}

    async def acquire_lock(self, key: str, ttl_s: int = 20) -> Optional[str]:
        await self.ensure_connected()
        token = uuid.uuid4().hex
        if self._redis is not None:
            ok = await self._redis.set(key, token, nx=True, ex=ttl_s)
            return token if ok else None
        lock = self._local_locks.setdefault(key, asyncio.Lock())
        if lock.locked():
            return None
        await lock.acquire()
        return token

    async def release_lock(self, key: str, token: Optional[str]) -> None:
        if not token:
            return
        if self._redis is not None:
            try:
                cur = await self._redis.get(key)
                if cur == token:
                    await self._redis.delete(key)
            except Exception:
                pass
            return
        lock = self._local_locks.get(key)
        if lock and lock.locked():
            lock.release()

    async def issue_ws_ticket(self, candidate_id: int, ttl_s: int = 30) -> str:
        await self.ensure_connected()
        ticket = uuid.uuid4().hex
        if self._redis is not None:
            await self._redis.set(f"coding:wsticket:{ticket}", str(candidate_id), ex=ttl_s)
        else:
            import time
            self._local_tickets[ticket] = (time.time() + ttl_s, candidate_id)
        return ticket

    async def consume_ws_ticket(self, ticket: str) -> Optional[int]:
        if not ticket:
            return None
        await self.ensure_connected()
        if self._redis is not None:
            key = f"coding:wsticket:{ticket}"
            val = await self._redis.getdel(key)
            return int(val) if val is not None else None
        import time
        entry = self._local_tickets.pop(ticket, None)
        if not entry or time.time() > entry[0]:
            return None
        return entry[1]

    async def ensure_connected(self) -> None:
        if self._init_attempted:
            return
        self._init_attempted = True
        try:
            import redis.asyncio as aioredis
            from arq import create_pool
            from arq.connections import RedisSettings

            self._redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
            await self._redis.ping()
            self._arq_pool = await create_pool(RedisSettings.from_dsn(settings.REDIS_URL))
            log_coding_event("redis_connected", url=settings.REDIS_URL)
        except Exception as exc:
            self._redis = None
            self._arq_pool = None
            if settings.ENVIRONMENT.lower() == "production":
                raise RuntimeError(f"Redis/ARQ is required in production: {exc}") from exc
            log_coding_event("redis_unavailable_using_mock_fallback", reason=str(exc))

    def get_guard(self) -> CodingRedisGuard:
        return CodingRedisGuard(self._redis)

    async def get_queue_depth(self) -> int:
        await self.ensure_connected()
        if self._redis is not None:
            try:
                return int(await self._redis.zcard("arq:queue"))
            except Exception:
                return 0
        return self._local_queue_depth

    async def is_redis_healthy(self) -> bool:
        await self.ensure_connected()
        if self._redis is None:
            return False
        try:
            return bool(await self._redis.ping())
        except Exception:
            return False

    async def enqueue_submission(self, submission_id: int, candidate_id: int) -> str:
        await self.ensure_connected()
        job_id = f"coding-{submission_id}-{uuid.uuid4().hex[:8]}"
        coding_metrics.enqueued_total += 1

        if self._arq_pool is not None:
            await self._arq_pool.enqueue_job(
                "evaluate_coding_submission",
                submission_id,
                candidate_id,
                _job_id=job_id,
            )
            return job_id

        # Local dev/test fallback (only when non-production & Redis is not running)
        from worker.coding_worker import evaluate_coding_submission

        self._local_queue_depth += 1

        async def _run_local() -> None:
            try:
                await evaluate_coding_submission({"redis": None}, submission_id, candidate_id)
            finally:
                self._local_queue_depth = max(0, self._local_queue_depth - 1)

        asyncio.create_task(_run_local())
        return job_id

    async def publish_result(self, submission_id: int, payload: Dict[str, Any]) -> None:
        msg = json.dumps(payload, default=str)
        if self._redis is not None:
            try:
                await self._redis.publish(f"{PUBSUB_CHANNEL_PREFIX}{submission_id}", msg)
                return
            except Exception as exc:
                log_coding_event("pubsub_publish_error", submission_id=submission_id, error=str(exc))

        for q in self._local_subscribers.get(submission_id, []):
            await q.put(payload)

    async def push_dlq(self, payload: Dict[str, Any]) -> None:
        raw = json.dumps(payload, default=str)
        if self._redis is not None:
            await self._redis.lpush(DLQ_KEY, raw)
        log_coding_event("coding_dlq_pushed", **payload)

    async def subscribe_submission(self, submission_id: int, timeout_s: float = 35.0) -> AsyncIterator[Dict[str, Any]]:
        await self.ensure_connected()
        if self._redis is not None:
            pubsub = self._redis.pubsub()
            channel = f"{PUBSUB_CHANNEL_PREFIX}{submission_id}"
            await pubsub.subscribe(channel)
            try:
                deadline = asyncio.get_event_loop().time() + timeout_s
                while asyncio.get_event_loop().time() < deadline:
                    message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                    if message and message.get("data"):
                        data = json.loads(message["data"])
                        yield data
                        if data.get("status") not in ("QUEUED", "RUNNING"):
                            break
            finally:
                await pubsub.unsubscribe(channel)
                await pubsub.close()
            return

        # Local fallback subscription
        q: asyncio.Queue = asyncio.Queue()
        self._local_subscribers.setdefault(submission_id, []).append(q)
        try:
            deadline = asyncio.get_event_loop().time() + timeout_s
            while asyncio.get_event_loop().time() < deadline:
                remaining = max(0.1, deadline - asyncio.get_event_loop().time())
                try:
                    data = await asyncio.wait_for(q.get(), timeout=min(1.0, remaining))
                    yield data
                    if data.get("status") not in ("QUEUED", "RUNNING"):
                        break
                except asyncio.TimeoutError:
                    continue
        finally:
            subs = self._local_subscribers.get(submission_id, [])
            if q in subs:
                subs.remove(q)


coding_queue_manager = CodingQueueManager()

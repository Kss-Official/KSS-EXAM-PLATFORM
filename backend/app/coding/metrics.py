import json
import logging
import time
from typing import Any, Dict

logger = logging.getLogger("ExamSecure.Coding")


def log_coding_event(event: str, **fields: Any) -> None:
    """Emit structured JSON log for coding round observability."""
    payload = {"event": event, "ts": time.time(), **fields}
    logger.info(json.dumps(payload, default=str))


class CodingMetrics:
    """Process-local counters combined with Redis queue depth in /api/coding/metrics."""

    def __init__(self) -> None:
        self.enqueued_total = 0
        self.completed_total = 0
        self.failed_total = 0
        self.rate_limited_total = 0
        self.queue_rejected_total = 0
        self.worker_active = 0

    def render_prometheus(self, queue_depth: int = 0) -> str:
        lines = [
            "# HELP coding_queue_depth Current pending jobs in coding execution queue",
            "# TYPE coding_queue_depth gauge",
            f"coding_queue_depth {queue_depth}",
            "# HELP coding_worker_active Active worker jobs in this process",
            "# TYPE coding_worker_active gauge",
            f"coding_worker_active {self.worker_active}",
            "# HELP coding_enqueued_total Total coding run/submit jobs enqueued",
            "# TYPE coding_enqueued_total counter",
            f"coding_enqueued_total {self.enqueued_total}",
            "# HELP coding_completed_total Total coding jobs completed",
            "# TYPE coding_completed_total counter",
            f"coding_completed_total {self.completed_total}",
            "# HELP coding_failed_total Total coding jobs failed with internal error",
            "# TYPE coding_failed_total counter",
            f"coding_failed_total {self.failed_total}",
            "# HELP coding_rate_limited_total Total requests rejected with 429 rate limit",
            "# TYPE coding_rate_limited_total counter",
            f"coding_rate_limited_total {self.rate_limited_total}",
            "# HELP coding_queue_rejected_total Total requests rejected due to max queue depth",
            "# TYPE coding_queue_rejected_total counter",
            f"coding_queue_rejected_total {self.queue_rejected_total}",
        ]
        return "\n".join(lines) + "\n"


coding_metrics = CodingMetrics()

"""Small bounded in-process limiter for a single Render web service instance."""

from collections import defaultdict, deque
from time import monotonic


class SlidingWindowLimiter:
    def __init__(self, limit: int, window_seconds: float = 60) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self._requests: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str, now: float | None = None) -> bool:
        point = monotonic() if now is None else now
        bucket = self._requests[key]
        while bucket and bucket[0] <= point - self.window_seconds:
            bucket.popleft()
        if len(bucket) >= self.limit:
            return False
        bucket.append(point)
        return True

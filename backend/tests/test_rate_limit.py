from app.rate_limit import SlidingWindowLimiter


def test_sliding_window_rejects_then_recovers() -> None:
    limiter = SlidingWindowLimiter(limit=2, window_seconds=60)
    assert limiter.allow("operator", now=0)
    assert limiter.allow("operator", now=1)
    assert not limiter.allow("operator", now=2)
    assert limiter.allow("operator", now=61)

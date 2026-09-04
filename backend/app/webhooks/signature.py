import base64
import hashlib
import hmac
import time


def verify_signature(
    api_key: str,
    timestamp: str | None,
    signature_header: str | None,
    raw_body: bytes,
    max_age: int = 300,
    now: float | None = None,
) -> bool:
    if not api_key or not timestamp or not signature_header:
        return False
    try:
        ts = int(timestamp)
    except ValueError:
        return False
    if abs((now if now is not None else time.time()) - ts) > max_age:
        return False
    message = timestamp.encode() + b"." + raw_body
    expected = base64.b64encode(
        hmac.new(api_key.encode(), message, hashlib.sha256).digest()
    ).decode()
    return any(
        hmac.compare_digest(expected, item.strip())
        for item in signature_header.split(",")
    )

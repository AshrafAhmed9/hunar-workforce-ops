import base64
import hashlib
import hmac
import time

from app.webhooks.signature import verify_signature


def sign(key, ts, body):
    return base64.b64encode(
        hmac.new(key.encode(), f"{ts}.".encode() + body, hashlib.sha256).digest()
    ).decode()


def test_valid_signature_passes():
    body = b'{"call_id":"c1"}'
    ts = str(int(time.time()))
    assert verify_signature("secret", ts, sign("secret", ts, body), body)


def test_tampered_body_fails():
    ts = str(int(time.time()))
    assert not verify_signature("secret", ts, sign("secret", ts, b"a"), b"b")


def test_stale_timestamp_fails():
    body = b"a"
    ts = "1"
    assert not verify_signature("secret", ts, sign("secret", ts, body), body, now=999)


def test_multiple_signatures_passes():
    body = b"a"
    ts = str(int(time.time()))
    assert verify_signature("secret", ts, "wrong, " + sign("secret", ts, body), body)

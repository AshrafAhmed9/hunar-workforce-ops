import hashlib
import json

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import Call, WebhookEvent
from .signature import verify_signature

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/hunar")
async def hunar_webhook(request: Request, db: Session = Depends(get_db)):
    raw = await request.body()
    settings = get_settings()
    if not verify_signature(
        settings.hunar_api_key,
        request.headers.get("X-Hunar-Timestamp"),
        request.headers.get("X-Hunar-Signature"),
        raw,
        settings.webhook_max_age_seconds,
    ):
        raise HTTPException(401, "Invalid webhook signature")
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid JSON")
    event_type = str(payload.get("event_type") or payload.get("type") or "unknown")
    data = payload.get("data", payload)
    call_id = str(data.get("call_id") or data.get("id") or "unknown")
    event = WebhookEvent(
        event_type=event_type,
        call_id=call_id,
        payload_hash=hashlib.sha256(raw).hexdigest(),
        raw_body=raw.decode("utf-8"),
        verified=True,
    )
    try:
        db.add(event)
        db.flush()
    except IntegrityError:
        db.rollback()
        return {"accepted": True, "duplicate": True}
    call = db.query(Call).filter_by(hunar_call_id=call_id).one_or_none()
    if call:
        call.status = str(data.get("status", call.status))
        call.lifecycle_status = event_type
        call.recording_url = data.get("recording_url", call.recording_url)
        call.result = data.get("result", call.result)
    db.commit()
    return {"accepted": True, "duplicate": False}

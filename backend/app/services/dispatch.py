from datetime import UTC, datetime

from sqlalchemy.orm import Session

from ..models import Agent, AuditLog, Call, Contact


class ConsentError(ValueError):
    pass


def assert_dialable(contact: Contact) -> None:
    if (
        not contact.phone
        or contact.consent_status != "verified"
        or not contact.verified_at
    ):
        raise ConsentError(
            "A verified phone number and recorded consent are required before dialling."
        )


def prepare_dispatch(
    db: Session,
    contact: Contact,
    agent_id: int,
    namespace: str,
    actor: str = "operator",
) -> Call:
    assert_dialable(contact)
    assert contact.verified_at is not None
    request_id = f"{namespace}-{contact.id}-{int(datetime.now(UTC).timestamp())}"
    call = Call(
        hunar_call_id=f"pending-{request_id}",
        request_id=request_id,
        contact_id=contact.id,
        agent_id=agent_id,
    )
    db.add(call)
    db.add(
        AuditLog(
            contact_id=contact.id,
            action="outbound_dial_requested",
            actor=actor,
            consent_proof=f"verified_at={contact.verified_at.isoformat()}",
        )
    )
    db.flush()
    return call


def call_payload(
    agent: Agent, contact: Contact, call: Call, public_api_url: str
) -> dict:
    """Build only the provider fields needed for a consented, traceable call."""
    assert contact.phone is not None
    callback = (
        f"{public_api_url.rstrip('/')}/webhooks/hunar" if public_api_url else None
    )
    payload = {
        "agent_id": agent.hunar_agent_id,
        "to_phone_number": contact.phone,
        "request_id": call.request_id,
        "retry_config": {"max_retries": 2, "retry_after_minutes": 60},
        "guardrails": {
            "timezone": "Asia/Kolkata",
            "allowed_hours": "09:00-20:00",
            "allowed_days": ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
        },
    }
    if callback:
        payload["callback_config"] = {
            "url": callback,
            "events": [
                "call_status_updated",
                "call_recording_done",
                "call_result_done",
                "call_summary",
            ],
        }
    return payload

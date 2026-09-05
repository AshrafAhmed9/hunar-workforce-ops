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
    """Build a Hunar BulkCallCreateSchema-shaped request for a single consented call.

    Field names and nesting must match https://api.voice.hunar.ai/docs/external/
    exactly — Hunar rejects unknown/misshaped fields with a 422, and the outer
    request carries provider-level fields (agent_id, retry_config, guardrails,
    callback_config) once, with recipient data in a separate "data" array.
    """
    assert contact.phone is not None
    payload: dict = {
        "agent_id": agent.hunar_agent_id,
        "request_id": call.request_id,
        "retry_config": {"max_retry_count": 2, "retry_interval_hours": 1},
        "guardrails": {
            "allowed_days": ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
            "earliest_call_time": "09:00",
            "last_call_time": "20:00",
        },
        "data": [
            {
                "callee_name": contact.name,
                "mobile_number": contact.phone,
                "custom_data": {},
            }
        ],
    }
    if public_api_url:
        webhook_url = f"{public_api_url.rstrip('/')}/webhooks/hunar"
        payload["callback_config"] = {
            "call_status_callback_url": webhook_url,
            "call_recording_callback_url": webhook_url,
            "call_result_callback_url": webhook_url,
            "call_summary_callback_url": webhook_url,
        }
    return payload

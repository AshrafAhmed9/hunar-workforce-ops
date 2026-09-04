from datetime import UTC, datetime

from sqlalchemy.orm import Session

from ..models import AuditLog, Call, Contact


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

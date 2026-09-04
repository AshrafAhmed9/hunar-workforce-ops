import hashlib

from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import Base
from app.models import WebhookEvent


def test_duplicate_event_is_rejected_by_database_constraint() -> None:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    body = b'{"call_id":"call-1"}'
    values = {
        "event_type": "call_status_updated",
        "call_id": "call-1",
        "payload_hash": hashlib.sha256(body).hexdigest(),
        "raw_body": body.decode(),
        "verified": True,
    }
    with Session(engine) as session:
        session.add(WebhookEvent(**values))
        session.commit()
        session.add(WebhookEvent(**values))
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
        else:
            raise AssertionError("replayed webhook unexpectedly inserted")

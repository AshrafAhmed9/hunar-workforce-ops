from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class Job(Base):
    __tablename__ = "jobs"
    id: Mapped[int] = mapped_column(primary_key=True)
    module: Mapped[str] = mapped_column(String(20))
    jd_text: Mapped[str] = mapped_column(Text)
    title: Mapped[str] = mapped_column(String(200), default="")
    must_haves: Mapped[list] = mapped_column(JSON, default=list)
    result_schema: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Agent(Base):
    __tablename__ = "agents"
    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int | None] = mapped_column(ForeignKey("jobs.id"))
    hunar_agent_id: Mapped[str] = mapped_column(String(100), unique=True)
    name: Mapped[str] = mapped_column(String(250))
    namespace: Mapped[str] = mapped_column(String(100))
    language: Mapped[str] = mapped_column(String(30), default="ENGLISH")
    persona: Mapped[str] = mapped_column(String(40), default="NEHA")
    result_schema: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Contact(Base):
    __tablename__ = "contacts"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    source: Mapped[str] = mapped_column(String(30), default="manual")
    pdl_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    contactable: Mapped[bool] = mapped_column(default=False)
    consent_status: Mapped[str] = mapped_column(String(30), default="unverified")
    verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Call(Base):
    __tablename__ = "calls"
    id: Mapped[int] = mapped_column(primary_key=True)
    hunar_call_id: Mapped[str] = mapped_column(String(100), unique=True)
    request_id: Mapped[str] = mapped_column(String(150), unique=True)
    contact_id: Mapped[int | None] = mapped_column(ForeignKey("contacts.id"))
    agent_id: Mapped[int | None] = mapped_column(ForeignKey("agents.id"))
    status: Mapped[str] = mapped_column(String(50), default="QUEUED")
    lifecycle_status: Mapped[str] = mapped_column(String(50), default="QUEUED")
    answered_by: Mapped[str | None] = mapped_column(String(50), nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    recording_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    result: Mapped[dict] = mapped_column(JSON, default=dict)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)


class WebhookEvent(Base):
    __tablename__ = "webhook_events"
    __table_args__ = (
        UniqueConstraint(
            "event_type", "call_id", "payload_hash", name="uq_webhook_replay"
        ),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    event_type: Mapped[str] = mapped_column(String(80))
    call_id: Mapped[str] = mapped_column(String(100))
    payload_hash: Mapped[str] = mapped_column(String(64))
    raw_body: Mapped[str] = mapped_column(Text)
    verified: Mapped[bool] = mapped_column(default=False)
    received_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Transcript(Base):
    __tablename__ = "transcripts"
    id: Mapped[int] = mapped_column(primary_key=True)
    call_id: Mapped[int] = mapped_column(ForeignKey("calls.id"), unique=True)
    text: Mapped[str] = mapped_column(Text)
    segments: Mapped[list] = mapped_column(JSON, default=list)
    provider: Mapped[str] = mapped_column(String(50), default="manual")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    contact_id: Mapped[int] = mapped_column(ForeignKey("contacts.id"))
    action: Mapped[str] = mapped_column(String(80))
    actor: Mapped[str] = mapped_column(String(100), default="operator")
    consent_proof: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

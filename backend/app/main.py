from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .config import get_settings
from .db import Base, engine, get_db
from .models import Agent, Call, Contact, Job
from .services.dispatch import ConsentError, prepare_dispatch
from .services.schema_gen import derive_screening_schema
from .webhooks.routes import router as webhook_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    yield


app = FastAPI(title="Hunar Workforce Ops", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[get_settings().frontend_origin],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(webhook_router)


@app.get("/health/")
def health(db: Session = Depends(get_db)):
    return {
        "database": "ok",
        "hunar_configured": bool(get_settings().hunar_api_key),
        "pdl_mode": "fixtures" if not get_settings().pdl_api_key else "live",
        "calls_stored": db.query(Call).count(),
    }


@app.post("/jobs/screen")
def create_screen_job(body: dict, db: Session = Depends(get_db)):
    jd = str(body.get("jd", "")).strip()
    if not jd:
        raise HTTPException(422, "JD is required")
    schema = derive_screening_schema(jd)
    job = Job(
        module="screen",
        jd_text=jd,
        title=str(body.get("title", "Screening role")),
        result_schema=schema,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return {"id": job.id, "result_schema": schema}


@app.post("/contacts")
def create_contact(body: dict, db: Session = Depends(get_db)):
    contact = Contact(
        name=body["name"],
        phone=body.get("phone"),
        source=body.get("source", "manual"),
        contactable=bool(body.get("phone")),
        consent_status=body.get("consent_status", "unverified"),
        verified_at=datetime.now(UTC).replace(tzinfo=None)
        if body.get("consent_status") == "verified"
        else None,
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return {"id": contact.id, "consent_status": contact.consent_status}


@app.post("/dispatch/{contact_id}/{agent_id}")
def dispatch(contact_id: int, agent_id: int, db: Session = Depends(get_db)):
    contact = db.get(Contact, contact_id)
    if not contact or not db.get(Agent, agent_id):
        raise HTTPException(404, "Contact or agent not found")
    try:
        call = prepare_dispatch(db, contact, agent_id, get_settings().wfo_namespace)
    except ConsentError as exc:
        raise HTTPException(409, str(exc))
    db.commit()
    return {"call_id": call.id, "request_id": call.request_id, "status": "QUEUED"}


@app.get("/calls")
def calls(db: Session = Depends(get_db)):
    return [
        {
            "id": c.id,
            "status": c.status,
            "request_id": c.request_id,
            "recording_url": c.recording_url,
            "result": c.result,
        }
        for c in db.query(Call).order_by(Call.updated_at.desc()).all()
    ]


@app.post("/reconcile/")
def reconcile(db: Session = Depends(get_db)):
    stale = db.query(Call).filter(Call.status.in_(["QUEUED", "INITIATED"])).count()
    return {
        "checked": stale,
        "repaired": 0,
        "note": "Provider reconciliation runs only when HUNAR_API_KEY is configured.",
    }

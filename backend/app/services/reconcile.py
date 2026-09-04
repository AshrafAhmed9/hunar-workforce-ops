from typing import Any

from sqlalchemy.orm import Session

from ..models import Agent, Call
from ..providers.hunar import HunarClient

TERMINAL_STATUSES = {"COMPLETED", "FAILED", "NOT_CONNECTED", "CANCELLED"}


def apply_provider_call(call: Call, remote: dict[str, Any]) -> bool:
    status = str(remote.get("status", call.status)).upper()
    changed = status != call.status
    call.status = status
    call.lifecycle_status = str(remote.get("lifecycle_status", call.lifecycle_status))
    call.answered_by = remote.get("answered_by", call.answered_by)
    call.duration_seconds = remote.get(
        "duration_seconds", remote.get("duration", call.duration_seconds)
    )
    call.recording_url = remote.get("recording_url", call.recording_url)
    if isinstance(remote.get("result"), dict):
        call.result = remote["result"]
    return changed


async def reconcile_stale_calls(db: Session, client: HunarClient) -> tuple[int, int]:
    local = db.query(Call).filter(~Call.status.in_(TERMINAL_STATUSES)).all()
    if not local:
        return 0, 0
    agent_ids = {agent.hunar_agent_id for agent in db.query(Agent).all()}
    remote = client.own_calls(await client.list_calls(), agent_ids)
    by_request = {str(item.get("request_id")): item for item in remote}
    repaired = 0
    for call in local:
        if item := by_request.get(call.request_id):
            repaired += int(apply_provider_call(call, item))
    db.commit()
    return len(local), repaired

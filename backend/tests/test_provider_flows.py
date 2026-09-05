import asyncio

from app.config import Settings
from app.models import Agent, Call, Contact
from app.providers.pdl import PeopleDataProvider
from app.services.dispatch import call_payload
from app.services.reconcile import apply_provider_call


def test_source_falls_back_to_explicit_fixtures_without_key() -> None:
    result = asyncio.run(
        PeopleDataProvider(Settings()).search("title:'Backend Engineer'")
    )
    assert result.mode == "fixtures"
    assert result.people
    assert "PDL_API_KEY" in result.reason


def test_dispatch_payload_matches_hunar_bulk_call_schema() -> None:
    """Field names must match BulkCallCreateSchema exactly - Hunar 422s on any mismatch."""
    agent = Agent(hunar_agent_id="agent-1", name="WFO/demo", namespace="demo")
    contact = Contact(name="A", phone="+919999999999")
    call = Call(hunar_call_id="pending-1", request_id="demo-1")
    payload = call_payload(agent, contact, call, "https://api.example.com/")
    assert payload["agent_id"] == "agent-1"
    assert payload["request_id"] == "demo-1"
    assert payload["data"] == [
        {"callee_name": "A", "mobile_number": "+919999999999", "custom_data": {}}
    ]
    assert payload["retry_config"] == {"max_retry_count": 2, "retry_interval_hours": 6}
    assert payload["guardrails"]["earliest_call_time"] == "09:00"
    assert payload["guardrails"]["last_call_time"] == "20:00"
    assert (
        payload["callback_config"]["call_status_callback_url"]
        == "https://api.example.com/webhooks/hunar"
    )
    assert (
        payload["callback_config"]["call_summary_callback_url"]
        == "https://api.example.com/webhooks/hunar"
    )


def test_reconciliation_only_updates_fields_supplied_by_provider() -> None:
    call = Call(
        hunar_call_id="call-1",
        request_id="demo-1",
        status="QUEUED",
        result={"existing": True},
    )
    changed = apply_provider_call(call, {"status": "COMPLETED", "duration_seconds": 21})
    assert changed is True
    assert call.status == "COMPLETED"
    assert call.duration_seconds == 21
    assert call.result == {"existing": True}

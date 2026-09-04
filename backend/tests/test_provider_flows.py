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


def test_dispatch_payload_has_namespace_safe_callback_and_guardrails() -> None:
    agent = Agent(hunar_agent_id="agent-1", name="WFO/demo", namespace="demo")
    contact = Contact(name="A", phone="+919999999999")
    call = Call(hunar_call_id="pending-1", request_id="demo-1")
    payload = call_payload(agent, contact, call, "https://api.example.com/")
    assert payload["request_id"] == "demo-1"
    assert payload["callback_config"]["url"] == "https://api.example.com/webhooks/hunar"
    assert payload["retry_config"]["max_retries"] == 2


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

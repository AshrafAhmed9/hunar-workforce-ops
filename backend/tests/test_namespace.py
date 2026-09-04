from app.config import Settings
from app.providers.hunar import HunarClient


def test_own_calls_requires_both_agent_and_request_namespace() -> None:
    client = HunarClient(Settings(wfo_namespace="wfo-demo"))
    calls = [
        {"agent_id": "ours", "request_id": "wfo-demo-1"},
        {"agent_id": "theirs", "request_id": "wfo-demo-2"},
        {"agent_id": "ours", "request_id": "foreign-3"},
    ]
    assert client.own_calls(calls, {"ours"}) == [calls[0]]

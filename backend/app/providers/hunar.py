from typing import Any

import httpx

from ..config import Settings


class HunarClient:
    def __init__(self, settings: Settings):
        self.settings = settings

    def _headers(self):
        self.settings.require_hunar()
        return {"X-API-Key": self.settings.hunar_api_key}

    async def create_agent(self, payload: dict[str, Any]) -> dict[str, Any]:
        async with httpx.AsyncClient(
            base_url=self.settings.hunar_base_url, timeout=15
        ) as client:
            response = await client.post(
                "/agents/", json=payload, headers=self._headers()
            )
            response.raise_for_status()
            return response.json()

    async def bulk_calls(self, payload: dict[str, Any]) -> dict[str, Any]:
        async with httpx.AsyncClient(
            base_url=self.settings.hunar_base_url, timeout=20
        ) as client:
            response = await client.post(
                "/calls/bulk/", json=payload, headers=self._headers()
            )
            response.raise_for_status()
            return response.json()

    async def list_calls(self) -> list[dict[str, Any]]:
        async with httpx.AsyncClient(
            base_url=self.settings.hunar_base_url, timeout=15
        ) as client:
            response = await client.get("/calls/", headers=self._headers())
            response.raise_for_status()
            data = response.json()
        return data.get("results", data if isinstance(data, list) else [])

    def own_calls(
        self, calls: list[dict[str, Any]], known_agent_ids: set[str]
    ) -> list[dict[str, Any]]:
        prefix = f"{self.settings.wfo_namespace}-"
        return [
            call
            for call in calls
            if str(call.get("agent_id", "")) in known_agent_ids
            and str(call.get("request_id", "")).startswith(prefix)
        ]

"""People-data provider chain with explicit, honest degradation."""

from dataclasses import dataclass
from typing import Any

import httpx

from ..config import Settings

FIXTURES = [
    {
        "id": "fixture-priya",
        "name": "Priya Shah",
        "title": "Backend Engineer",
        "company": "Northstar",
        "location": "Bengaluru",
        "skills": ["Python", "SQL", "AWS"],
        "phone_available": False,
    },
    {
        "id": "fixture-rohan",
        "name": "Rohan Mehta",
        "title": "Software Engineer",
        "company": "Saffron Labs",
        "location": "Pune",
        "skills": ["TypeScript", "React", "Docker"],
        "phone_available": False,
    },
    {
        "id": "fixture-asha",
        "name": "Asha Iyer",
        "title": "Platform Engineer",
        "company": "Gridworks",
        "location": "Chennai",
        "skills": ["Python", "Kubernetes"],
        "phone_available": True,
    },
]


@dataclass(frozen=True)
class SearchResult:
    mode: str
    reason: str
    people: list[dict[str, Any]]


class PeopleDataProvider:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def search(self, query: str) -> SearchResult:
        if not self.settings.pdl_api_key:
            return SearchResult("fixtures", "PDL_API_KEY is not configured", FIXTURES)
        headers = {"X-Api-Key": self.settings.pdl_api_key}
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(
                    "https://api.peopledatalabs.com/v5/person/search",
                    params={"sql": query, "size": 10},
                    headers=headers,
                )
                response.raise_for_status()
                records = response.json().get("data", [])
        except (httpx.HTTPError, ValueError):
            return await self._sandbox_or_fixtures(query, headers)
        return SearchResult("live", "PDL live search", self._people(records))

    async def _sandbox_or_fixtures(
        self, query: str, headers: dict[str, str]
    ) -> SearchResult:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(
                    "https://sandbox.api.peopledatalabs.com/v5/person/search",
                    params={"sql": query, "size": 10},
                    headers=headers,
                )
                response.raise_for_status()
                records = response.json().get("data", [])
        except (httpx.HTTPError, ValueError):
            return SearchResult(
                "fixtures",
                "PDL live and sandbox search unavailable; showing local fixtures",
                FIXTURES,
            )
        return SearchResult(
            "sandbox", "PDL sandbox — synthetic data", self._people(records)
        )

    @staticmethod
    def _people(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [
            {
                "id": str(item.get("id", "")),
                "name": item.get("full_name", "Unknown"),
                "title": item.get("job_title", ""),
                "company": item.get("job_company_name", ""),
                "location": item.get("location_name", ""),
                "skills": item.get("skills", [])[:8],
                "phone_available": bool(item.get("phone_numbers")),
            }
            for item in records
        ]

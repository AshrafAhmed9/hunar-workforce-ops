# API contract

The backend publishes interactive OpenAPI at `/docs` and the machine-readable contract at `/openapi.json`. Browser code uses only the public API URL and never receives provider credentials.

| Endpoint | Purpose |
| --- | --- |
| `POST /jobs/screen` | Persist a JD and return a reviewable screening schema. |
| `POST /agents/provision` | Provision a namespaced Hunar agent after human review. |
| `POST /contacts` | Create an unverified contact record. |
| `POST /contacts/{id}/verify` | Record operator-provided consent proof. |
| `POST /dispatch/{contact}/{agent}` | Dispatch only a verified contact through Hunar. |
| `POST /source/search` | Search PDL or return clearly-labelled fixtures. |
| `POST /webhooks/hunar` | Verify and persist idempotent provider events. |
| `POST /reconcile/` | Repair stale local call state from namespaced provider calls. |
| `GET /calls` | Return locally persisted call evidence. |
| `GET /health/` | Report storage and provider-configuration state. |

The `/agents/provision`, `/dispatch`, and `/reconcile` endpoints return `503` when no Hunar key is configured. This is intentional: the app never substitutes a fabricated live outcome.

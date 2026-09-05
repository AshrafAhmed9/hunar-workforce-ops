# Hunar Workforce Ops

Hunar Workforce Ops is a consent-first voice operations app for three HR tasks: job-description-led candidate screening, people sourcing with an explicit verification boundary, and feature-phone-friendly frontline attendance. It keeps completed and unsuccessful calls in the same operational view rather than treating no-connects as missing data.

**Live app:** https://hunar-workforce-ops.vercel.app
**API:** https://hunar-workforce-ops-api.onrender.com (`/health/`, `/docs`)
**Repo:** https://github.com/AshrafAhmed9/hunar-workforce-ops

The Screen → provision → consent → dispatch → webhook → Proof path has been run end to end against the live Hunar API from the deployed app, not just against mocks — see `docs/spike.md`.

## Run it

Copy `.env.example` to `.env`, set `HUNAR_API_KEY` for live provider operations, then run the backend and frontend separately:

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn app.main:app --app-dir backend --reload

cd frontend && npm install && npm run dev
```

The frontend is at `http://localhost:3000`; the API documentation is at `http://localhost:8000/docs`. The app still runs in a local demonstration mode without provider credentials, but provider calls fail explicitly rather than silently producing fabricated outcomes.

`render.yaml` and `backend/Dockerfile` provide the backend deployment contract. Configure `PUBLIC_API_URL` to the deployed HTTPS backend before provisioning live calls so signed webhooks return to the correct endpoint. Set `NEXT_PUBLIC_API_URL` in the frontend host to that same API origin. The endpoint list is in [docs/api.md](docs/api.md).

## Decisions that matter

A sourced profile is not dialable. People-data providers may indicate contactability, but an operator must add a verified phone number and record consent before dispatch. The backend enforces this condition and records every requested dial in an audit log.

Every provider agent and request ID is namespaced. The provider client filters calls by both the local agent set and the request-ID prefix, which prevents unrelated shared-organization data entering the local database or dashboard.

Webhooks are verified against their raw request body with HMAC-SHA256, a five-minute timestamp window, and constant-time comparison. A database uniqueness constraint makes delivery replays harmless. Historical calls are stored locally so the proof view does not depend on a provider key remaining active.

`docs/attendance.md` is the Q3 deliverable. It argues for missed-call plus callback and supervisor reconciliation instead of 1,000 outbound attendance calls, including operating math and limits on LLM authority.

## Verification

```bash
PYTHONPATH=backend pytest backend/tests
cd frontend && npm run typecheck && npm run build
```

For live validation, use only numbers belonging to people who have consented: provision a namespaced agent, place a small test batch, confirm status/result/recording handling, then review the local proof page. Do not fetch, retain, or display calls outside this application’s namespace.

## Note on the shared evaluation key

The supplied evaluation key appears organization-scoped and can expose unrelated agents, candidate phone numbers, and recordings. This application does not retain or use those records; its only aggregate operational reference is a connect-rate observation. Per-candidate API scopes would prevent this exposure.

# Hunar.ai Assignment — Winning Submission Plan

## Context

Hunar.ai's take-home has three parts: (1) an AI hiring assistant on their Voice AI agents, (2) a JD → people-search → voice-reachout → dashboard app, (3) a design answer for tracking attendance of 1000 people across 100 locations with LLMs but no smartphones. Deadline **Sept 7, 2026, 4:34 PM IST**. Stack mandated: TypeScript, React/Next.js, shadcn/ui, Python backend preferred. Deployed link + GitHub repo. API key must not appear in source.

### Reconnaissance (done — this drives every decision below)

I pulled the OpenAPI spec, the full docs, and probed the live API with the provided key.

**The evaluation API key is org-scoped and shared across all candidates.** The org currently holds **103 agents** and **615 calls** — every other candidate's work, including real candidate phone numbers and S3 recording URLs. Consequences:
- I can see the competition. ~28 candidates, near-identical: `Screening — Backend Engineer` + `Outreach — Backend Engineer`, English-only, one agent per role, 2–7 result fields. Only 3 of 103 agents are non-English. Only ~2 attempted anything for Q3.
- I must namespace hard (agent name prefix + `request_id` prefix) and filter my dashboard strictly to my own namespace, or my UI fills with other people's calls.
- This is a real security finding and gets a short, constructive disclosure note in the README.

**The pipeline works, and it's messy.** Of 597 terminal calls org-wide: **287 COMPLETED, 282 NOT_CONNECTED, 28 FAILED** — a 48% no-connect rate. Completed calls return a recording URL and LLM-extracted structured `result` JSON. Most submissions will build a happy-path dashboard that pretends the other 52% doesn't exist.

**API facts that matter:**
- Base `https://api.voice.hunar.ai/external/v1/`, header `X-API-Key`. Endpoints: `GET/POST /agents/`, `GET/PUT /agents/{id}/`, `POST /calls/`, `POST /calls/bulk/` (≤10k), `GET /calls/`, `GET /calls/{id}/`, `GET /numbers/`.
- Agents are created with `agent_prompt`, `objective`, `introduction`, `result_prompt`, **`result_schema`** — the structured-answer extraction is a first-class API feature. Prompt variables use single braces `{callee_name}`; `system_data` auto-injects `greeting`, `current_time`, `persona_name`.
- 12 languages incl. Hindi/Tamil/Telugu/Marathi. 6 voice personas.
- `GET /numbers/` returns **0** for this org, but calls still get an auto-assigned caller ID (`+918031139599`). So **omit `from_phone_number`**.
- **There is no transcript field anywhere.** Only `recording_url` + `result`.
- Webhooks: `callback_config` per call → `call_status_updated`, `call_recording_done`, `call_result_done`, `call_summary`. Signed with **HMAC-SHA256 over `f"{timestamp}." + raw_body`**, base64, header `X-Hunar-Signature` (comma-separated for multiple keys), `X-Hunar-Timestamp`. Docs warn delivery may be duplicated; retries at 1/2/4/8 min; 15s timeout.
- **PDL free tier**: Person Search is available but contact fields (phone/email) are obfuscated to `true`/`false`. Sandbox (`sandbox.api.peopledatalabs.com/v5/person/search`) returns synthetic data, no credits, 5 req/min.

### The thesis

The three questions are the same problem: **reach many people by phone, reliably, and turn what they say into structured data.** Competitors will ship three disconnected demos. I ship **one voice-operations core** (agent provisioning, consent gate, batch dispatch, signed webhook ingestion, retry + reconciliation, structured extraction, audit log) and show it serving three genuinely different HR jobs — including a *working* Q3 that almost nobody else will build.

---

## Product: Hunar Workforce Ops

One Next.js app, one FastAPI backend, one Postgres, three modules over a shared core.

| Module | Brief | What it does |
|---|---|---|
| **Screen** | Q1 | Paste a JD → auto-derive a screening `result_schema` from its must-haves → provision a Hunar agent → batch screening calls → dashboard of structured answers + recordings + scorecard |
| **Source** | Q2 | Paste a JD → PDL Person Search → ranked candidates with contactability flags → consent/verification gate → outreach agent calls → answers land in the same dashboard |
| **Rollcall** | Q3 | **Primary deliverable is the written design doc** (`docs/attendance.md`). A thin Hindi roll-call agent + ledger view exists as supporting evidence, nothing more |

**Channel abstraction.** The brief explicitly invites other communication platforms, and Hunar's real product runs on WhatsApp. Outreach goes through a `Channel` interface with `VoiceChannel` as the implemented case; the call → no-answer → WhatsApp/SMS fallback ladder is designed and documented, with the WhatsApp adapter stubbed (Meta Cloud API onboarding is too slow for this window — say so plainly rather than faking it). Cheap, and it answers a sentence most candidates will skip.

### Why this wins

1. **Q3 as working software.** ~2 of 103 agents touched attendance. Hunar is a blue-collar/frontline workforce company (13L+ candidates screened, 200+ cities) — a **Hindi** roll-call agent for warehouse attendance is literally their product line. Everyone else writes three paragraphs.
2. **Honest outcome accounting.** A funnel that shows NOT_CONNECTED / MACHINE / FAILED as first-class, benchmarked against the 48% org-wide baseline I measured. Reads as someone who has operated a dialer.
3. **The consent gate.** PDL cannot give a dialable phone. Rather than fake numbers, contactability is a flag and a call requires an explicitly verified, consented number — enforced server-side by an allowlist. Correct product, correct law (TRAI/DNC), and honest.
4. **Webhook rigor.** HMAC verification with canonical-JSON reconstruction, timestamp window, idempotent dedupe, and a reconciliation poller for webhooks that never arrive. The docs spell this out; nearly everyone will skip it.
5. **It survives key revocation.** Dashboard reads from my own Postgres, never live Hunar. The deployed link still shows real calls after Sept 7.
6. **Transcripts nobody else has.** The API returns no transcript. I fetch the recording and transcribe it (Groq `whisper-large-v3-turbo`, free tier), showing the actual conversation next to the extracted answers. Tier-2 scope, high payoff.

---

## Architecture

```
Next.js 15 (App Router, TS, shadcn/ui, Tailwind)  ──►  Vercel
        │  REST, 3s polling while a batch is live
        ▼
FastAPI (Python 3.12, Pydantic v2, SQLAlchemy 2)  ──►  Render free web service
        │                                              (GitHub Actions cron pings /health/ every 10m
        │                                               to defeat the 15-min cold-start sleep)
        ├── Hunar client (agents, calls, bulk)
        ├── /webhooks/hunar   HMAC-verified, idempotent
        ├── POST /reconcile/  cron-driven: poll GET /calls/ for stale non-terminal calls
        ├── PDL client        search + sandbox fallback + offline fixtures
        └── Postgres (Neon free)
```

**Key rule:** the browser never sees the Hunar or PDL key. All provider calls are server-side. `.env.example` documents every var; startup fails loudly on a missing key.

### Data model (Postgres)

- `job` — JD text, parsed must-haves, derived result schema, module
- `agent` — local record + `hunar_agent_id`, namespace prefix, language, persona, result_schema
- `contact` — name, phone (nullable), source (`pdl` / `manual` / `fixture`), `pdl_id`, contactability flags, **`consent_status`**, `verified_at`
- `call` — `hunar_call_id`, `request_id`, contact, agent, status, lifecycle_status, answered_by, engagement, durations, recording_url, `result` JSONB, retry counters, timestamps
- `webhook_event` — raw body, headers, event_type, `call_id`, **unique (event_type, call_id, payload_hash)** for idempotency, verified flag
- `transcript` — call_id, text, segments JSONB, provider (tier-2)
- `audit_log` — every outbound dial with actor, consent proof, timestamp

### Namespacing (mandatory, shared-key defence)

- Agent names prefixed `WFO/{short-id} — …`
- Every `request_id` prefixed `wfo-{deploy-id}-…`
- `GET /calls/` results filtered by my `agent_id` set **and** `request_id` prefix before anything is persisted or displayed. Never ingest another candidate's calls.

---

## Module detail

### Screen (Q1)

1. Paste JD → LLM extracts role title, must-haves, nice-to-haves, screening questions, and a `result_schema` (field name → `"string — one of: …"` descriptors, matching the format Hunar's own agents use).
2. Human reviews/edits the schema and the agent prompt before provisioning — **the approval boundary is visible**, not implied.
3. `POST /agents/` with language + persona choice (English/Hindi/Tamil selectable — differentiator).
4. Add candidates (manual entry or CSV) → consent gate → `POST /calls/bulk/` with `callback_config` (all four URLs), `retry_config` (2 retries / 1h — real no-connect handling), `guardrails` (09:00–20:00, Mon–Sat, `Asia/Kolkata`).
5. Live dashboard, 3s polling while a batch is active: status funnel, per-candidate card with extracted answers, recording player, duration/engagement, transcript panel (tier-2).
6. Scorecard: rank candidates by schema-derived fit; export CSV.

### Source (Q2)

1. Paste JD → build a PDL Person Search query (title, skills, location, seniority) — **show the generated query** in the UI so it's auditable.
2. Provider abstraction: `PDLLive` → `PDLSandbox` → `LocalFixtures`, with a **visible data-source badge** stating which is in use and why. Honest degradation beats a fake demo.
3. Results table: name, title, company, location, skills match, `phone_available: true/false` (PDL free-tier reality, labelled as such).
4. **Consent gate:** a sourced profile is not dialable. To call, an operator must attach a verified number and record consent; the server rejects any dial to a number not on the verified allowlist. Every dial written to `audit_log`.
5. Outreach agent (distinct prompt + result schema: interest, current status, notice period, comp expectation, next step) → calls → same dashboard, answers back.

### Rollcall (Q3)

**Written answer** (`docs/attendance.md`) — the reasoning, with numbers:
- Calling 1000 workers daily is the wrong primitive. 100 locations × 1 supervisor roll-call ≈ 100 calls/day.
- Better primitive for India: **inbound missed call is free and works on every feature phone.** Worker gives a missed call from their registered SIM at the gate → system calls back → 20-second confirmation in local language → ledger. Identity binds to the SIM, cost collapses.
- Layered design: (a) worker missed-call + callback, (b) supervisor roll-call for workers without a phone, (c) exception queue for mismatches, (d) anti-proxy controls — SIM binding, callback-not-callin, randomised challenge, geo/time windows, supervisor reconciliation.
- Cost/throughput math: calls/day, avg duration, concurrency, per-minute cost, failure retries, staffing of the exception queue.
- Explicit statement of what an LLM adds and where it must not be trusted alone.

**Thin prototype** (evidence that the design is real, not a UI project — timebox hard):
- Hindi agent (`VoiceCallLanguage: HINDI`, persona NEHA) that reads a site roster and confirms presence.
- `result_schema`: present, absent, late, headcount confirmed, exceptions.
- One ledger view: date × site, headcount vs roster, exceptions linked to the recording.
- Demonstrated live against consented numbers acting as site supervisors. **No elaborate exception-queue UI.** If time is short, this shrinks before the document does.

---

## Rigor & evidence layer (this is the differentiator — do not cut it)

- **`webhooks/signature.py`** — port of the documented verifier: `hmac_sha256(api_key, f"{ts}." + raw_body)`, base64, constant-time compare across comma-separated segments, ±300s timestamp window. Read `request.body()` raw (never the parsed dict). Tests: valid sig passes, tampered body fails, stale timestamp fails, multi-key header passes.
- **Idempotency** — unique constraint on `(event_type, call_id, payload_hash)`; replaying the same webhook twice changes nothing. Test proves it.
- **Reconciler** — a `POST /reconcile/` endpoint that polls `GET /calls/` for calls non-terminal beyond a threshold and repairs state a webhook never delivered. Driven by the GitHub Actions cron and hit on dashboard load. **Not** an in-process asyncio loop: the free instance sleeps, and a cron-triggered endpoint has no "did my background task survive" failure mode.
- **Fast ack** — webhook handler persists raw + returns 200 within the 15s budget; processing happens after.
- **`/health/`** — reports DB, Hunar reachability, PDL mode, last webhook received, reconciler heartbeat.
- **Live proof page** (`/proof`) — real call IDs, durations, answered_by, recordings, extracted results from calls actually placed. Backed by DB so it survives key revocation.
- **CI** — GitHub Actions: ruff + mypy + pytest, tsc + eslint + vitest.

## Security

- Keys server-side only, env vars, `.env.example`, no key ever in a client bundle or committed file. `.gitignore` verified; `git log -p | grep` sweep before pushing.
- README section: **"Note on the shared evaluation key"** — roughly four factual sentences: the key is org-scoped; it exposes other submissions' agents, candidate phone numbers, and call recordings; nothing observed was retained or used beyond an aggregate connect-rate figure; recommend per-candidate scoping. No screenshots. **No other candidate's data anywhere in the repo, and no recordings belonging to other candidates' calls are ever fetched.** Framed as responsible disclosure this is memorable; framed as a brag it reads as rummaging, so keep it short and dry.
- Consent allowlist enforced server-side; every dial audited.
- Rate limiting on public endpoints; webhook endpoint rejects unsigned requests with 401.

## Writing and interface

The written deliverables are a large share of what actually gets judged. Treat them as engineering work, not packaging.

**README.** Lead with what it does and how to run it. Then the three or four decisions worth defending — the consent gate, the shared-key namespacing, webhook verification and idempotency, DB-backed survival of key revocation — each stated as a decision with its tradeoff, a few sentences apiece. Then live evidence: real call IDs, durations, outcomes. Then the shared-key note. **No generated-template sections** — no feature bullet grids, no HLD/LLD, no class diagrams, no roadmap, no badge wall. One small architecture diagram only if it beats a paragraph, which for a three-box system it probably does not. Nothing claimed that the repo doesn't demonstrate.

**`docs/attendance.md`.** The strongest single piece of writing in the submission, and where a reviewer decides whether you think clearly. Argue a position: calling 1000 workers is the wrong primitive, missed-call-plus-callback is the right one, here is the cost math, here is what breaks, here is where the LLM must not be trusted alone. Prose with real numbers. Not a bulleted feature list.

**UI copy.** Operational and literal. "Not connected — 2 retries left", not "Oops! Something went wrong." Label the data source honestly: "PDL sandbox — synthetic data" when that's what's running. Never invent a number to fill a panel.

**Interface.** A tool an ops lead uses at 7am. Dense tables, real hierarchy, consistent spacing and type. Dark/light on shadcn tokens. No gradients, no glow, no decorative icons, no card grids that exist to fill space, no animation that isn't communicating state. The outcome funnel is the one chart that earns its place — **load the `dataviz` skill before writing any chart code**, and every other number stays a number.

**Commits.** Short, specific, present tense. "Verify webhook HMAC against canonical JSON body", not "feat: implement comprehensive webhook security layer". No attribution lines.

**Submission email.** Six or seven sentences to Bhumika. Links, one line on what each of the three parts is, one sentence flagging the shared-key observation so it reaches someone technical. No pitch, no adjectives, no thanking them three times.

---

## Build order

**Rule for every phase after 2: the repo stays deployed and submittable.** Later phases are additive and independently revertable. **Hard feature freeze 6 hours before the deadline** — remaining time goes to the README, the Q3 doc, the video, and verification. Scope, not technique, is the most likely way this loses.

**Phase 0 — spike (do first, alone, sequential).** Validate the four assumptions that would each invalidate a chunk of the design:
1. `POST /agents/` succeeds with this key (103 agents exist, but creation may be restricted).
2. A call to your own phone connects and completes.
3. Webhooks reach a public HTTPS URL and the signature verifies against the documented HMAC.
4. **Is `recording_url` fetchable without auth?** Test against *your own* recording. If those S3 objects are private, in-browser playback breaks and transcription is dead — that changes core dashboard scope, so find out on hour one, not hour twenty.

Do not fetch or download any recording belonging to another candidate's calls. Those contain real people's voices.

**Phase 1 — core.** FastAPI skeleton, models + migrations, Hunar client, signature verifier + webhook ingest + idempotency, `POST /reconcile/`, health. Deploy backend to Render + Neon early; get the public webhook URL live.

**Phase 2 — Screen.** JD parsing → schema derivation → agent provisioning → consent gate → bulk dispatch → dashboard. First end-to-end live call.

**Phase 3 — Source.** PDL provider chain + fixtures, query builder UI, contactability + consent gate, outreach agent, results into the same dashboard.

**Phase 4 — Rollcall.** Hindi agent, roster, ledger, exception queue, `docs/attendance.md` with the cost model.

**Phase 5 — evidence & polish.** Transcription (tier-2, only if Phase 0 proved recordings are fetchable), `/proof` page, tests green, CI, README, demo video, adversarial review pass.

**Prompt iteration — budget this explicitly, it is not free.** What a reviewer actually experiences is whether the call sounds natural and asks smart, JD-specific questions. Everyone will have an agent; few will have a good one. Reserve at least three cycles of *place a real call → listen to the recording → tighten `agent_prompt` / `introduction` / `result_prompt`* per agent. One-shot generated prompts sound like one-shot generated prompts.

**LLM for JD parsing:** Groq (`llama-3.3-70b`) or Gemini free tier, server-side, keyed by env var. Named here so it isn't discovered as a missing dependency mid-build.

Phases 2/3/4 are independent once Phase 1 lands and can be parallelised across subagents. Phase 0 and 1 are strictly sequential and must not be parallelised.

---

## Delegation: work packages

Phase 0 and Phase 1 are **sequential and must not be parallelised** — everything else depends on the contracts they establish. Once Phase 1 merges, WP-3/4/5/6 run in parallel against a frozen API contract.

Each package below is a self-contained brief. Give an agent the package plus this document's Context section — the reconnaissance findings are not reconstructable from the API docs alone and an agent without them will make wrong assumptions (especially about the shared key and the no-connect rate).

**WP-0 — Spike. Owner: Ashraf, alone, first.**
Validate the four assumptions in Phase 0. Deliverable: a short findings note committed to `docs/spike.md` recording whether agent creation works, whether webhooks arrive and verify, and **whether `recording_url` is publicly fetchable**. Every other package reads this file before starting. Do not delegate this — it needs your phone.

**WP-1 — Core backend. One agent. Blocks everything.**
FastAPI skeleton, config with fail-fast key validation, SQLAlchemy models + migrations for all eight tables, the Hunar client with the namespace guard, `webhooks/signature.py` + ingest + idempotency, `POST /reconcile/`, `/health/`. Deploy to Render + Neon and hand back a live HTTPS webhook URL.
*Acceptance:* `pytest` green on signature (valid/tampered/stale/multi-key), idempotency (double POST → one row), and namespace filter (zero foreign `request_id`s). Webhook URL publicly reachable.

**WP-2 — API contract freeze. Same agent as WP-1, immediately after.**
Publish the OpenAPI schema and generate TypeScript types into `frontend/lib/api-types.ts`. Everything downstream codes against this file. Deliverable: committed types + a one-page endpoint list.

**WP-3 — Screen module.** JD parsing → `result_schema` generation → human review step → agent provisioning → consent gate → bulk dispatch → dashboard. Backend + frontend by one agent; splitting this across two creates more coordination cost than it saves.

**WP-4 — Source module.** PDL provider chain (live → sandbox → fixtures) with the visible source badge, query builder UI, contactability flags, consent gate reuse from WP-3's `services/dispatch.py`, outreach agent. Depends on WP-3's dispatch service existing — start after WP-3's backend half lands, not after all of WP-3.

**WP-5 — Q3.** `docs/attendance.md` is the deliverable and the priority. Thin Hindi agent + one ledger view second. **Give this to your strongest writer-agent, not a UI agent.** If this package runs long, the prototype is cut, never the document.

**WP-6 — Design system + shell.** shadcn setup, tokens, layout, navigation, table and status primitives, the outcome funnel chart. Runs in parallel with WP-3 from the start; WP-3/4/5 consume its components. Load the `dataviz` skill before the funnel.

**WP-7 — Evidence and submission. Ashraf, last, after freeze.**
`/proof` page, README, demo video, secrets sweep, submission email, final adversarial pass on the finished repo rather than the plan.

**Coordination rules for parallel agents**
- One agent owns `services/dispatch.py` (WP-3). Others import it; nobody else edits it.
- Nobody touches `webhooks/` after WP-1 without telling the WP-1 owner.
- Every agent reads `docs/spike.md` before starting.
- No agent commits a key, ever. `.env.example` only.
- Prompt iteration (three real-call cycles per agent) belongs to whoever owns that module — it is not a polish task to defer to WP-7.

### Critical files

```
backend/app/
  main.py                  FastAPI app, CORS, routers
  config.py                pydantic-settings, fail-fast on missing keys
  models.py  schemas.py    SQLAlchemy + Pydantic
  providers/hunar.py       agents, calls, bulk, list/filter with namespace guard
  providers/pdl.py         live → sandbox → fixtures chain
  providers/transcribe.py  Groq whisper (tier-2)
  webhooks/signature.py    HMAC verifier  ← highest-value file
  webhooks/routes.py       ingest, idempotent, fast-ack
  services/schema_gen.py   JD → result_schema
  services/dispatch.py     consent gate + audit + bulk dispatch
  services/reconcile.py    cron-triggered state repair
  tests/                   signature, idempotency, namespace filter, schema_gen, consent gate
frontend/app/
  screen/  source/  rollcall/  proof/
  components/ui/           shadcn
docs/attendance.md         Q3 written answer
README.md
.github/workflows/{ci.yml,keepwarm.yml}
```

---

## Verification

1. **Signature**: `pytest backend/tests/test_signature.py` — valid, tampered, stale, multi-key cases.
2. **Idempotency**: POST the same webhook body twice → one `call` row updated, one `webhook_event` row.
3. **Namespace guard**: seed the DB from a live `GET /calls/` fetch → assert zero rows outside my `request_id` prefix.
4. **Live end-to-end (the real test)**: from the deployed frontend, run a 3-contact batch to your + two consented numbers. Watch the dashboard fill. Confirm at least one COMPLETED call with a populated `result`, a playable recording, and a transcript. Deliberately let one call go unanswered to demonstrate NOT_CONNECTED and retry handling.
5. **Multilingual**: one Hindi roll-call call, verified audible and correctly extracted.
6. **Key-revocation survival**: unset the Hunar key on the deployed backend → confirm `/proof` and the dashboard still render historical calls, and the UI states the key is inactive rather than erroring.
7. **Cold start**: confirm the GitHub Actions keep-warm cron holds Render response time under ~2s.
8. **Secrets sweep**: `git log -p | grep -iE 'hunar_va_live|pdl|sk_'` returns nothing before pushing.
9. **Adversarial review** of the finished repo before submitting — as a skeptical senior engineer comparing 28 submissions.

## Deliverables

- Deployed link (Vercel frontend, Render backend)
- Public GitHub repo, no secrets, CI green
- README: what it does, how to run it, decisions + tradeoffs, live evidence, shared-key note (see Writing and interface)
- `docs/attendance.md` — the Q3 answer
- 3-minute walkthrough video
- Submission email drafted in plain, specific language

## Known risks and how they're handled

| Risk | Handling |
|---|---|
| Key revoked before evaluation | All data persisted locally; dashboard never reads live Hunar |
| Render free cold start | GitHub Actions cron every 10 min; webhook retries (1/2/4/8m) cover the gap anyway |
| PDL free tier has no real phones | Contactability flags + consent gate — turned into the product's correct behaviour |
| Webhooks don't reach the public URL | Phase 0 spike catches it; reconciler is the fallback regardless |
| 48% no-connect rate ruins the demo | Retries configured; funnel shows it honestly; live demo uses consented numbers you control |
| Shared key pollutes my dashboard | Strict namespace filter + test |
| **Scope — the most likely way this loses** | Always-submittable rule from Phase 2; hard freeze 6h out; Q3 doc outranks Q3 UI; transcription tier-2 |
| `recording_url` turns out to be private | Phase 0 test; fallback is a link instead of a player, and transcription is cut |
| Generated prompts sound robotic on the demo call | Three real-call iteration cycles budgeted per agent |

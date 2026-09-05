# Spike: live pipeline verification

Run 2026-09-05, against the production Hunar API with the assignment's evaluation key. One namespaced agent, one real call, no fabricated data below.

## What was tested and the result

**Agent creation.** `POST /agents/` succeeded on the shared key. Created `wfo-local/spike-test` (`agent_code: FD136`, `id: 5d5977c4-5c6e-43ed-8390-771cf03deec4`).

**Call placement and connection.** `POST /calls/` to `+919901916318`, `request_id: wfo-local-spike-001`. Call progressed `SCHEDULED → INITIATED → RINGING → IN_PROGRESS → COMPLETED`. `answered_by: HUMAN`, `engagement_status: ENGAGED`, `call_ended_by: AGENT`, `duration_seconds: 26`.

**Structured result extraction.** `result_schema` asked for `caller_name` and `mood_word`. Final `result`: `{"caller_name": "Ashraf", "mood_word": "good"}` — matched what was actually said on the call.

**Recording.** `recording_url` resolved to a real `.wav` on S3 (`.../call/recording/fde-hiring/{call_id}_0_plivo.wav`).

**Recording is publicly fetchable without auth.** Confirmed with a byte-range `curl` against the URL: `HTTP 206`, `content-type: audio/x-wav`. This was the one unresolved assumption in the plan — it determined whether the in-app audio player and transcription feature were buildable at all. They are.

## The one finding that changes downstream code

`recording_url` and `result` are **not available immediately when the call reaches `COMPLETED`**. Both fields were still `null` / `{}` for roughly 45 seconds after `ended_at`, then populated on a later poll. This is expected async processing, not a fault, but it means:

- The dashboard must show a distinct "processing" state between `COMPLETED` and "recording + result available" — showing blank fields as if they're permanently empty would misrepresent working calls as broken.
- The reconciler's staleness threshold needs to tolerate this window rather than flagging a just-finished call as stuck.
- Webhooks (`call_recording_done`, `call_result_done`) are the correct way to learn about this transition in production rather than polling; this spike used polling only because no public webhook URL was live yet at spike time.

## Follow-up: the app's own dispatch pipeline (2026-09-05, later same day)

The first spike proved the Hunar API directly. It did not prove that *this app's own code* built a valid request — and it didn't. Driving the deployed app end-to-end (not just curling the provider) surfaced two real bugs neither unit tests nor the earlier spike caught:

**Bug 1 — wrong field name in agent provisioning.** `POST /agents/provision` sent `"persona"` instead of the API's required `"voice_persona"`. Hunar rejected it with `422`. The existing tests never exercised this because the mocked flow never validated against the real schema.

**Bug 2 — call dispatch payload didn't match `BulkCallCreateSchema` at all.** The code wrapped calls in `{"calls": [...]}` with per-call `retry_config`/`guardrails`/`callback_config` and a `to_phone_number` field. The real API wants those fields once at the top level, plus a `data` array of `{"callee_name", "mobile_number", "custom_data"}`. The one existing test (`test_dispatch_payload_has_namespace_safe_callback_and_guardrails`) asserted against the code's own (wrong) output, so it passed while the endpoint was completely non-functional against the live API. Both are fixed; the test now asserts against the documented schema instead of the code's prior behavior.

**Bug 3 — `retry_interval_hours` schema is wrong in Hunar's own OpenAPI doc.** It states an integer range of 0-24. The live API actually enforces an enum: `{3, 6, 9, 12, 24}`. Sending `1` (a valid value per the published schema) returns `422`. Found only by hitting the real endpoint directly and reading the error body, since `raise_for_status()` in the client discards it — worth keeping in mind for any other integer-range field in this API; the documented range may not be the real constraint.

**Full pipeline proof, once fixed:** dispatched a real call through the deployed app's own `/dispatch/{contact}/{agent}` endpoint (not a hand-built curl payload) → real call to `+919901916318`, `answered_by: HUMAN`, `duration_seconds: 183` → `call_summary` webhook delivered to the live Render backend, HMAC-verified, applied idempotently → `COMPLETED` with recording URL and extracted result (`{"notice_period": "NOT AVAILABLE"}`, correct given the conversation never covered it) → visible on the deployed `/proof` page within seconds of the webhook landing.

**Lesson:** a payload can be internally self-consistent, covered by a passing test, and still be completely wrong against the real external contract. The only thing that actually proves an integration works is driving it end to end against the live service — which is why this file exists.

## Not yet tested

- A call that goes unanswered / NOT_CONNECTED through the app's own retry_config path (the org-wide historical data shows this happens ~48% of the time; both real dispatches so far were answered).
- Multilingual (Hindi) call quality.
- Bulk dispatch (`/calls/bulk/` with more than one recipient in `data`) — only single-recipient dispatch has been exercised.

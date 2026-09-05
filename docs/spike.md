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

## Not yet tested

- Webhook delivery and HMAC signature verification against a real public HTTPS endpoint (needs a deployed backend URL, done at deploy time).
- A call that goes unanswered / NOT_CONNECTED, and how the retry_config path actually behaves (the org-wide historical data already shows this happens ~48% of the time; this spike only exercised the successful path).
- Multilingual (Hindi) call quality.

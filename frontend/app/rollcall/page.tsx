"use client";
import { useEffect, useState } from "react";
import type { AgentSummary } from "../../lib/api-types";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const ROLLCALL_SCHEMA = {
  status: "string — one of: present, absent, late, needs_review",
  headcount_confirmed: "string — supervisor's stated headcount for the site today, or 'not stated'",
  exceptions: "string — names or count of workers the supervisor flags as absent or unusual, or 'none'",
  language_used: "string — the language the call was actually conducted in",
};

function ConsentRow({ agentId }: { agentId: number | null }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consentProof, setConsentProof] = useState("");
  const [pending, setPending] = useState("");
  const [status, setStatus] = useState("");
  const [contactId, setContactId] = useState<number>();

  async function submit() {
    setPending("verify");
    const created = await fetch(`${api}/contacts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, phone, source: "manual" }) });
    if (!created.ok) { setStatus("Could not save this contact."); setPending(""); return; }
    const contact = await created.json();
    const verified = await fetch(`${api}/contacts/${contact.id}/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consent_proof: consentProof }) });
    if (!verified.ok) { setStatus("A consent proof is required before this number can be dialled."); setPending(""); return; }
    setContactId(contact.id);
    setStatus("Verified — eligible for a consented call.");
    setPending("");
  }

  async function dispatch() {
    if (!contactId || !agentId) return;
    setPending("dispatch");
    const response = await fetch(`${api}/dispatch/${contactId}/${agentId}`, { method: "POST" });
    setStatus(response.ok ? "Call queued. See Proof for the outcome." : "Dispatch failed. Check the provider key and deployment configuration.");
    setPending("");
  }

  if (!open) return <button onClick={() => setOpen(true)}>Verify &amp; call a supervisor</button>;
  return (
    <div>
      <label htmlFor="rc-name">Supervisor name</label>
      <input id="rc-name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} />
      <label htmlFor="rc-phone">Verified phone</label>
      <input id="rc-phone" type="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+919999999999…" />
      <label htmlFor="rc-consent">Consent proof</label>
      <p className="lede">Free text written to the audit log as evidence this supervisor agreed to a roll-call test. Example: <i>&ldquo;supervisor agreed by phone to a roll-call test call, 2026-09-05&rdquo;</i>.</p>
      <input id="rc-consent" value={consentProof} onChange={e => setConsentProof(e.target.value)} placeholder="supervisor agreed by phone to a roll-call test call, 2026-09-05" />
      <button onClick={submit} disabled={!!pending}>{pending === "verify" ? "Recording…" : "Record consent"}</button>
      {contactId && agentId && (
        <button onClick={dispatch} disabled={!!pending}>{pending === "dispatch" ? "Dispatching…" : "Dispatch Hindi roll-call"}</button>
      )}
      {contactId && !agentId && <p className="lede">Provision the roll-call agent above before dispatching.</p>}
      {status && <p className="status ok" aria-live="polite">{status}</p>}
    </div>
  );
}

export default function Rollcall() {
  const rows = [
    ["Whitefield warehouse", "86", "82", "4", "Supervisor review"],
    ["Peenya hub", "54", "53", "1", "One late arrival"],
    ["Hosur line", "71", "71", "0", "—"],
  ];
  const [agent, setAgent] = useState<AgentSummary | null>(null);
  const [agentMessage, setAgentMessage] = useState("");
  const [agentPending, setAgentPending] = useState(false);

  useEffect(() => {
    fetch(`${api}/agents`)
      .then(r => (r.ok ? r.json() : []))
      .then((agents: AgentSummary[]) => {
        const existing = agents.find(a => a.name.includes("Roll-call agent"));
        if (existing) setAgent(existing);
      })
      .catch(() => {});
  }, []);

  async function provisionAgent() {
    setAgentPending(true);
    const response = await fetch(`${api}/agents/provision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Roll-call agent",
        result_schema: ROLLCALL_SCHEMA,
        language: "HINDI",
        objective: "Confirm today's site headcount with a supervisor in Hindi and capture any exceptions.",
        introduction: "नमस्ते, यह आज की उपस्थिति की पुष्टि के लिए एक छोटी कॉल है।",
        agent_prompt: "Ask the supervisor to confirm today's headcount for their site and name any workers who are absent, late, or need review. Keep the call under a minute. Ask only these questions and wait for each answer.",
      }),
    });
    if (!response.ok) { setAgentMessage("Provisioning failed. Confirm that the backend has a valid Hunar key."); setAgentPending(false); return; }
    const data = await response.json();
    setAgent({ id: data.id, name: data.name, language: "HINDI", result_schema: ROLLCALL_SCHEMA });
    setAgentMessage("Roll-call agent provisioned in Hindi. Verify a supervisor below, then dispatch.");
    setAgentPending(false);
  }

  return (
    <main>
      <p className="eyebrow">Rollcall · Q3</p>
      <h1>Attendance is a ledger, not a thousand outbound calls.</h1>
      <p className="lede">Workers check in by missed call from a registered SIM; a local-language callback confirms presence. Supervisors reconcile exceptions.</p>

      <section className="panel">
        <h2>Illustrative site ledger</h2>
        <p className="lede">Sample data — this app does not yet run a live attendance endpoint. The panel below provisions and calls a real Hindi roll-call agent; this table shows the shape of the ledger it would eventually populate at scale.</p>
        <table>
          <thead>
            <tr><th>Site</th><th>Roster</th><th>Present</th><th>Exceptions</th><th>Next action</th></tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="panel">
        <h2>Hindi roll-call agent</h2>
        {agent ? (
          <p className="status ok">Active: {agent.name} (Hindi). Verify a supervisor below to place a real test call.</p>
        ) : (
          <>
            <p className="lede">A distinct Hindi-language agent, provisioned live through Hunar, asking a supervisor to confirm today's headcount and name any exceptions.</p>
            <button onClick={provisionAgent} disabled={agentPending}>{agentPending ? "Provisioning…" : "Provision Hindi roll-call agent"}</button>
          </>
        )}
        {agentMessage && <p className="lede" aria-live="polite">{agentMessage}</p>}
      </div>

      <section className="panel">
        <h2>Call a supervisor</h2>
        <ConsentRow agentId={agent?.id ?? null} />
      </section>

      <section className="notice">
        <b>Boundaries:</b> the agent extracts a stated headcount and exceptions; it does not decide whether a person is truly at work or issue employment consequences. Those stay deterministic and human-reviewed.
      </section>
      <p>Read the complete operating design and cost model in <a href="/attendance.md">attendance.md</a>.</p>
    </main>
  );
}

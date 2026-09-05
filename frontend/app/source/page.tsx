"use client";
import { useEffect, useState } from "react";
import { ConsentGate } from "../../components/ConsentGate";
import type { AgentSummary, SourceSearchResponse } from "../../lib/api-types";

const query = "title:(Backend Engineer) AND skills:(Python OR SQL OR AWS) AND location:India";
const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const OUTREACH_SCHEMA = {
  interest_level: "string — one of: high, medium, low, not_interested",
  current_status: "string — employed and not looking, employed and open, actively looking",
  notice_period: "string — stated notice period, or 'not discussed'",
  compensation_expectation: "string — stated expectation, or 'not discussed'",
  next_step: "string — e.g. schedule recruiter call, send more info, do not contact again",
};

function ConsentRow({ name, outreachAgentId }: { name: string; outreachAgentId: number | null }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [consentProof, setConsentProof] = useState("");
  const [pending, setPending] = useState("");
  const [status, setStatus] = useState("");
  const [contactId, setContactId] = useState<number>();

  async function submit() {
    setPending("verify");
    const created = await fetch(`${api}/contacts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, phone, source: "pdl" }) });
    if (!created.ok) { setStatus("Could not save this contact."); setPending(""); return; }
    const contact = await created.json();
    const verified = await fetch(`${api}/contacts/${contact.id}/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consent_proof: consentProof }) });
    if (!verified.ok) { setStatus("A consent proof is required before this number can be dialled."); setPending(""); return; }
    setContactId(contact.id);
    setStatus("Verified — eligible for a consented call.");
    setPending("");
  }

  async function dispatch() {
    if (!contactId || !outreachAgentId) return;
    setPending("dispatch");
    const response = await fetch(`${api}/dispatch/${contactId}/${outreachAgentId}`, { method: "POST" });
    setStatus(response.ok ? "Call queued. See Proof for the outcome." : "Dispatch failed. Check the provider key and deployment configuration.");
    setPending("");
  }

  if (!open) return <button onClick={() => setOpen(true)}>Verify &amp; record consent</button>;
  return (
    <div>
      <label htmlFor={`phone-${name}`}>Verified phone</label>
      <input id={`phone-${name}`} type="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+919999999999…" />
      <label htmlFor={`consent-${name}`}>Consent proof</label>
      <p className="lede">Free text written to the audit log as evidence a real person agreed to be called. Not automatically checked — only a human can attest to a real conversation. Example: <i>&ldquo;candidate replied yes to outreach WhatsApp message, 2026-09-05&rdquo;</i>.</p>
      <input id={`consent-${name}`} value={consentProof} onChange={e => setConsentProof(e.target.value)} placeholder="candidate replied yes to outreach WhatsApp message, 2026-09-05" />
      <button onClick={submit} disabled={!!pending}>{pending === "verify" ? "Recording…" : "Record consent"}</button>
      {contactId && outreachAgentId && (
        <button onClick={dispatch} disabled={!!pending}>{pending === "dispatch" ? "Dispatching…" : "Dispatch outreach call"}</button>
      )}
      {contactId && !outreachAgentId && (
        <p className="lede">Provision the outreach agent above before dispatching.</p>
      )}
      {status && <p className="status ok" aria-live="polite">{status}</p>}
    </div>
  );
}

export default function Source() {
  const [data, setData] = useState<SourceSearchResponse>();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [outreachAgent, setOutreachAgent] = useState<AgentSummary | null>(null);
  const [agentMessage, setAgentMessage] = useState("");
  const [agentPending, setAgentPending] = useState(false);

  useEffect(() => {
    fetch(`${api}/agents`)
      .then(r => (r.ok ? r.json() : []))
      .then((agents: AgentSummary[]) => {
        const existing = agents.find(a => a.name.includes("Outreach agent"));
        if (existing) setOutreachAgent(existing);
      })
      .catch(() => {});
  }, []);

  async function search() {
    setError(""); setPending(true);
    const response = await fetch(`${api}/source/search`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) });
    if (!response.ok) { setError("Search is unavailable. Check the backend connection."); setPending(false); return; }
    setData(await response.json());
    setPending(false);
  }

  async function provisionOutreachAgent() {
    setAgentPending(true);
    const response = await fetch(`${api}/agents/provision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Outreach agent",
        result_schema: OUTREACH_SCHEMA,
        objective: "Gauge a passive candidate's interest and suitability for an open role.",
        introduction: "Hi, this is a quick call about a role that might be a good fit for you.",
      }),
    });
    if (!response.ok) { setAgentMessage("Provisioning failed. Confirm that the backend has a valid Hunar key."); setAgentPending(false); return; }
    const agent = await response.json();
    setOutreachAgent({ id: agent.id, name: agent.name, language: "ENGLISH", result_schema: OUTREACH_SCHEMA });
    setAgentMessage("Outreach agent provisioned. Verify a candidate below, then dispatch.");
    setAgentPending(false);
  }

  return (
    <main>
      <p className="eyebrow">Source · Q2</p>
      <h1>Search people, then verify consent before outreach.</h1>
      <div className="panel">
        <h2>Generated provider query</h2>
        <code>{query}</code>
        <p className="lede">The query is visible so an operator can audit the sourcing criteria before using it.</p>
        <button onClick={search} disabled={pending}>{pending ? "Searching…" : "Search people"}</button>
        {error && <p className="bad" aria-live="polite">{error}</p>}
      </div>

      <div className="panel">
        <h2>Outreach agent</h2>
        {outreachAgent ? (
          <p className="status ok">Active: {outreachAgent.name}. Verified candidates below can be dispatched.</p>
        ) : (
          <>
            <p className="lede">Distinct from the Screen agent — a separate prompt and result schema tuned for cold outreach rather than a scheduled screen.</p>
            <button onClick={provisionOutreachAgent} disabled={agentPending}>{agentPending ? "Provisioning…" : "Provision outreach agent"}</button>
          </>
        )}
        {agentMessage && <p className="lede" aria-live="polite">{agentMessage}</p>}
      </div>

      <ConsentGate />
      {data && (
        <section className="panel">
          <p className="lede"><b>{data.source === "fixtures" ? "PDL fixtures — local demonstration data" : "PDL live search"}.</b> {data.reason}</p>
          <table>
            <thead>
              <tr><th>Person</th><th>Role &amp; location</th><th>Matched skills</th><th>Phone available</th><th>Action</th></tr>
            </thead>
            <tbody>
              {data.people.map(p => (
                <tr key={p.id}>
                  <td>{p.name}<br /><span className="lede">{p.company}</span></td>
                  <td>{p.title}<br /><span className="lede">{p.location}</span></td>
                  <td className="wrap">{p.skills.join(", ")}</td>
                  <td className={p.phone_available ? "ok" : "warn"}>{String(p.phone_available)}</td>
                  <td><ConsentRow name={p.name} outreachAgentId={outreachAgent?.id ?? null} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}

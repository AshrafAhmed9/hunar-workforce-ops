"use client";

import { useState } from "react";
import { ConsentGate } from "../../components/ConsentGate";
import { Funnel } from "../../components/Funnel";
import type { ResultSchema } from "../../lib/api-types";

const initial = "We need a backend engineer with Python, SQL, Docker and AWS experience. The role is based in Bengaluru.";
const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function Screen() {
  const [jd, setJd] = useState(initial);
  const [schema, setSchema] = useState<ResultSchema>();
  const [jobId, setJobId] = useState<number>();
  const [agentId, setAgentId] = useState<number>();
  const [language, setLanguage] = useState("ENGLISH");
  const [candidateName, setCandidateName] = useState("");
  const [phone, setPhone] = useState("");
  const [consentProof, setConsentProof] = useState("");
  const [contactId, setContactId] = useState<number>();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<string>("");

  async function derive() {
    setPending("derive");
    const response = await fetch(`${api}/jobs/screen`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jd }) });
    if (!response.ok) { setMessage("Could not derive the review schema. Check that the backend is running."); setPending(""); return; }
    const data = await response.json();
    setSchema(data.result_schema); setJobId(data.id);
    setMessage("Review the extraction below before provisioning an agent.");
    setPending("");
  }

  async function provision() {
    if (!schema || !jobId || pending) return;
    setPending("provision");
    const response = await fetch(`${api}/agents/provision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ job_id: jobId, name: "Screening agent", result_schema: schema, language }) });
    if (!response.ok) { setMessage("Provisioning failed. Confirm that the backend has a valid Hunar key."); setPending(""); return; }
    const data = await response.json();
    setAgentId(data.id);
    setMessage("Agent provisioned. Add a consented candidate below.");
    setPending("");
  }

  async function addAndVerifyCandidate() {
    if (pending) return;
    setPending("verify");
    const created = await fetch(`${api}/contacts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: candidateName, phone, source: "manual" }) });
    if (!created.ok) { setMessage("Could not save the candidate."); setPending(""); return; }
    const contact = await created.json();
    const verified = await fetch(`${api}/contacts/${contact.id}/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consent_proof: consentProof }) });
    if (!verified.ok) { setMessage("A consent proof is required before this number can be dialled."); setPending(""); return; }
    setContactId(contact.id);
    setMessage("Candidate verified. The number is now eligible for a consented call.");
    setPending("");
  }

  async function dispatch() {
    if (!contactId || !agentId || pending) return;
    setPending("dispatch");
    const response = await fetch(`${api}/dispatch/${contactId}/${agentId}`, { method: "POST" });
    setMessage(response.ok ? "Call queued. Outcomes will appear in Proof as webhooks arrive." : "Dispatch failed. Check the provider key and deployment configuration.");
    setPending("");
  }

  return (
    <main>
      <p className="eyebrow">Screen · Q1</p>
      <h1>Turn a job description into a reviewable voice screen.</h1>
      <p className="lede">The operator approves the criteria and prompt before any candidate is contacted.</p>

      <section className="panel">
        <label htmlFor="jd">Job description</label>
        <textarea id="jd" rows={9} value={jd} onChange={event => setJd(event.target.value)} />
        <button onClick={derive} disabled={pending === "derive"}>{pending === "derive" ? "Deriving…" : "Derive screening schema"}</button>
        {message && <p className="status ok" aria-live="polite">{message}</p>}
      </section>

      {schema && (
        <section className="panel">
          <h2>Approval boundary: result schema</h2>
          <table>
            <tbody>
              {Object.entries(schema).map(([key, value]) => <tr key={key}><th>{key}</th><td>{value}</td></tr>)}
            </tbody>
          </table>
          <label htmlFor="language">Language</label>
          <select id="language" value={language} onChange={event => setLanguage(event.target.value)}>
            <option value="ENGLISH">English</option>
            <option value="HINDI">Hindi</option>
            <option value="TAMIL">Tamil</option>
          </select>
          <button onClick={provision} disabled={pending === "provision"}>{pending === "provision" ? "Provisioning…" : "Approve and provision agent"}</button>
        </section>
      )}

      <ConsentGate />

      {agentId && (
        <section className="panel">
          <h2>Add a consented candidate</h2>
          <label htmlFor="candidateName">Name</label>
          <input id="candidateName" autoComplete="name" value={candidateName} onChange={event => setCandidateName(event.target.value)} />
          <label htmlFor="phone">Verified phone</label>
          <input id="phone" type="tel" autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="+919999999999…" />
          <label htmlFor="consentProof">Consent proof</label>
          <p className="lede">
            Free text, not a checkbox — this is what the app writes to the audit log as evidence a real human agreed to be called. There is no automated verification of it; that is deliberate, since only a person can attest to a real conversation. Example: <i>&ldquo;candidate replied yes to outreach WhatsApp message, 2026-09-05&rdquo;</i>.
          </p>
          <input id="consentProof" value={consentProof} onChange={event => setConsentProof(event.target.value)} placeholder="candidate replied yes to outreach WhatsApp message, 2026-09-05" />
          <button onClick={addAndVerifyCandidate} disabled={pending === "verify"}>{pending === "verify" ? "Recording…" : "Record consent"}</button>
          {contactId && <button onClick={dispatch} disabled={pending === "dispatch"}>{pending === "dispatch" ? "Dispatching…" : "Dispatch consented call"}</button>}
        </section>
      )}

      <Funnel />
    </main>
  );
}

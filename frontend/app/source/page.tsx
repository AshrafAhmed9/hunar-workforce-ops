"use client";
import { useState } from "react";
import { ConsentGate } from "../../components/ConsentGate";
import type { SourceSearchResponse } from "../../lib/api-types";

const query = "title:(Backend Engineer) AND skills:(Python OR SQL OR AWS) AND location:India";
const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function ConsentRow({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [consentProof, setConsentProof] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");

  async function submit() {
    setPending(true);
    const created = await fetch(`${api}/contacts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, phone, source: "pdl" }) });
    if (!created.ok) { setStatus("Could not save this contact."); setPending(false); return; }
    const contact = await created.json();
    const verified = await fetch(`${api}/contacts/${contact.id}/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consent_proof: consentProof }) });
    setStatus(verified.ok ? "Verified — eligible for a consented call." : "A consent proof is required before this number can be dialled.");
    setPending(false);
  }

  if (!open) return <button onClick={() => setOpen(true)}>Verify & record consent</button>;
  return (
    <div>
      <label htmlFor={`phone-${name}`}>Verified phone</label>
      <input id={`phone-${name}`} type="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+919999999999…" />
      <label htmlFor={`consent-${name}`}>Consent proof</label>
      <input id={`consent-${name}`} value={consentProof} onChange={e => setConsentProof(e.target.value)} placeholder="Source and timestamp of recorded consent…" />
      <button onClick={submit} disabled={pending}>{pending ? "Recording…" : "Record consent"}</button>
      {status && <p className="status ok" aria-live="polite">{status}</p>}
    </div>
  );
}

export default function Source() {
  const [data, setData] = useState<SourceSearchResponse>();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function search() {
    setError(""); setPending(true);
    const response = await fetch(`${api}/source/search`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) });
    if (!response.ok) { setError("Search is unavailable. Check the backend connection."); setPending(false); return; }
    setData(await response.json());
    setPending(false);
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
                  <td><ConsentRow name={p.name} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}

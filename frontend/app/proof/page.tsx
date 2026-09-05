"use client";

import { useEffect, useState } from "react";

type Call = { id: number; status: string; request_id: string; recording_url: string | null; result: Record<string, unknown> };
const terminal = new Set(["COMPLETED", "FAILED", "NOT_CONNECTED", "CANCELLED"]);
const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function Proof() {
  const [calls, setCalls] = useState<Call[]>([]); const [state, setState] = useState("Loading local evidence…");
  useEffect(() => { let cancelled = false; let timer: ReturnType<typeof setTimeout>; async function load() { try { const response = await fetch(`${api}/calls`); if (!response.ok) throw new Error("API unavailable"); const data: Call[] = await response.json(); if (cancelled) return; setCalls(data); setState(data.length ? "" : "No local calls have been recorded yet."); if (data.some(call => !terminal.has(call.status))) timer = setTimeout(load, 3000); } catch { if (!cancelled) setState("Local API unavailable."); } } void load(); return () => { cancelled = true; clearTimeout(timer); }; }, []);
  return <main><p className="eyebrow">Evidence</p><h1>Local, durable call evidence.</h1><p className="lede">This page reads the application database, not a live provider feed, so historical outcomes remain available if provider access is revoked.</p><section className="panel"><h2>Call records</h2>{state && <p className="lede">{state}</p>}{calls.length > 0 && <><p className="lede">In-progress calls refresh every 3 seconds.</p><table><thead><tr><th>Request</th><th>Outcome</th><th>Extracted result</th><th>Recording</th></tr></thead><tbody>{calls.map(call => <tr key={call.id}><td>{call.request_id}</td><td className="status">{call.status}</td><td><code>{JSON.stringify(call.result)}</code></td><td>{call.recording_url ? <a href={call.recording_url}>Open recording</a> : "Pending"}</td></tr>)}</tbody></table></>}</section><p className="notice">No third-party call data or recordings are displayed, stored, or fetched by this app.</p></main>;
}

"use client";

import { useEffect, useState } from "react";

type Call = { status: string };
const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const stages: [label: string, statuses: string[], kind: string][] = [
  ["Queued", ["NOT_STARTED", "SCHEDULED", "INITIATED", "RINGING", "IN_PROGRESS", "QUEUED"], ""],
  ["Completed", ["COMPLETED"], "ok"],
  ["Not connected", ["NOT_CONNECTED"], "warn"],
  ["Failed", ["FAILED", "CANCELLED"], "bad"],
];

export function Funnel() {
  const [calls, setCalls] = useState<Call[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${api}/calls`)
      .then(response => (response.ok ? response.json() : Promise.reject()))
      .then((data: Call[]) => { if (!cancelled) setCalls(data); })
      .catch(() => { if (!cancelled) setCalls([]); });
    return () => { cancelled = true; };
  }, []);

  const total = calls?.length ?? 0;
  const rows = stages.map(([label, statuses, kind]) => {
    const count = calls?.filter(c => statuses.includes(c.status)).length ?? 0;
    return { label, count, kind, pct: total > 0 ? Math.round((count / total) * 100) : 0 };
  });

  return (
    <section className="panel">
      <h2>Outcome funnel</h2>
      {calls === null && <p className="lede" aria-live="polite">Loading call outcomes…</p>}
      {calls !== null && total === 0 && <p className="lede">No calls have been dispatched through this app yet.</p>}
      {total > 0 && (
        <div className="funnel" aria-label="Call outcome funnel">
          {rows.map(row => (
            <div key={row.label} className={`funnel-row ${row.kind}`}>
              <div className="funnel-meter" style={{ width: `${Math.max(row.pct, row.count > 0 ? 4 : 0)}%` }} />
              <span className="funnel-label">{row.label}: <b>{row.count}</b></span>
            </div>
          ))}
        </div>
      )}
      <p className="lede">Counts are read live from this application&rsquo;s database. No-connects and failures remain visible; they are not treated as missing data.</p>
    </section>
  );
}

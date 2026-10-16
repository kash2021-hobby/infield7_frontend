"use client";

import { Fragment, useEffect, useState } from "react";
import { api, loadSession } from "@/lib/api";

type Group = {
  fingerprint: string;
  message: string;
  stack: string | null;
  screen: string | null;
  platform: string;
  appVersion: string | null;
  total: number;
  fatal: number;
  people: number;
  firstSeen: string;
  lastSeen: string;
};

type Health = { groups: Group[]; lastSevenDays: { total: number; fatal: number; people: number } };

function when(value: string) {
  return new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function AppHealthPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const current = loadSession();
    if (!current) return;
    api<Health>("/client-errors", {}, current.token)
      .then(setHealth)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
  }, []);

  return (
    <div>
      <h1 className="page-title">App health</h1>
      <p className="sub">Errors and crashes from the phone app, grouped by cause. Reports older than 30 days are removed.</p>
      {error ? <div className="error">{error}</div> : null}
      {health ? (
        <div className="panel" style={{ marginBottom: 16 }}>
          <strong>Last 7 days:</strong> {health.lastSevenDays.total} error{health.lastSevenDays.total === 1 ? "" : "s"},{" "}
          {health.lastSevenDays.fatal} crash{health.lastSevenDays.fatal === 1 ? "" : "es"}, {health.lastSevenDays.people}{" "}
          {health.lastSevenDays.people === 1 ? "person" : "people"} affected.
        </div>
      ) : null}
      <div className="panel">
        <table>
          <thead><tr><th>Last seen</th><th>Error</th><th>Screen</th><th>Count</th><th>People</th><th></th></tr></thead>
          <tbody>
            {health?.groups.map((group) => (
              <Fragment key={group.fingerprint}>
                <tr>
                  <td>{when(group.lastSeen)}</td>
                  <td>
                    {group.fatal > 0 ? <span className="pill pending" style={{ marginRight: 8 }}>crash</span> : null}
                    {group.message}
                  </td>
                  <td>{group.screen ?? "—"}</td>
                  <td>{group.total}</td>
                  <td>{group.people}</td>
                  <td>
                    <button className="btn secondary" style={{ marginTop: 0 }} onClick={() => setOpen(open === group.fingerprint ? null : group.fingerprint)}>
                      {open === group.fingerprint ? "Hide" : "Details"}
                    </button>
                  </td>
                </tr>
                {open === group.fingerprint ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="muted" style={{ marginBottom: 8 }}>
                        First seen {when(group.firstSeen)} · {group.platform} · app {group.appVersion ?? "unknown"}
                      </div>
                      <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, margin: 0 }}>{group.stack ?? "No stack trace was sent."}</pre>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
            {health && health.groups.length === 0 ? <tr><td colSpan={6}>No errors reported. The app is running cleanly.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

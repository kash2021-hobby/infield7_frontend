"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Glyph, type AlertGlyphName } from "@/lib/alert-glyphs";
import { api, loadSession } from "@/lib/api";
import { ReportCrumbs } from "@/lib/reports";

type DryRun = {
  days: number;
  wouldHaveFired: number;
  perWeek: number;
  noisy: boolean;
  notifyManagers?: boolean;
  notifyPerson?: boolean;
  hits: { person: string; at: string; site: string | null; minutes: number | null }[];
  byDay: { day: string; count: number }[];
};

type Rule = {
  id: string;
  name: string;
  kind: string;
  builtin?: boolean;
  minutesOver?: number | null;
  notifyManagers?: boolean;
  notifyPerson?: boolean;
};

type Event = { time: string; text: string; color: string; icon: AlertGlyphName };

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function eventFor(kind: string, hit: DryRun["hits"][0]): Event {
  if (kind === "geofence_exit") {
    return { time: clock(hit.at), text: `${hit.person} left${hit.site ? ` ${hit.site}` : " the work area"}`, color: "var(--if-coral)", icon: "pin" };
  }
  if (kind === "late_checkin") {
    const late = hit.minutes != null ? ` · ${hit.minutes} min after shift start` : "";
    return { time: clock(hit.at), text: `${hit.person} checked in late${hit.site ? ` at ${hit.site}` : ""}${late}`, color: "var(--if-amber)", icon: "clock" };
  }
  if (kind === "sos") {
    return { time: clock(hit.at), text: `${hit.person} pressed SOS`, color: "var(--if-coral)", icon: "alert" };
  }
  return { time: clock(hit.at), text: `${hit.person} marked work delayed`, color: "var(--if-amber)", icon: "clock" };
}

export default function TestRulePage() {
  const params = useParams<{ id: string }>();
  const [rule, setRule] = useState<Rule | null>(null);
  const [dry, setDry] = useState<DryRun | null>(null);
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const session = loadSession();
    if (!session) return;
    api<Rule>(`/alert-rules/${params.id}`, {}, session.token)
      .then(setRule)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
  }, [params.id]);

  async function run() {
    const session = loadSession();
    if (!session) return;
    setTesting(true);
    setError("");
    try {
      setDry(await api<DryRun>(`/alert-rules/${params.id}/test`, { method: "POST", body: "{}" }, session.token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not test");
    } finally {
      setTesting(false);
    }
  }

  const sample = dry?.hits[0];
  const events = useMemo(
    () => (rule && dry ? dry.hits.slice(0, 12).map((hit) => eventFor(rule.kind, hit)) : []),
    [rule, dry],
  );
  const maxDay = Math.max(1, ...(dry?.byDay.map((row) => row.count) ?? [1]));
  const deliveries = useMemo(() => {
    if (!sample || !rule) return [];
    const at = clock(sample.at);
    const rows: [string, string][] = [];
    if (rule.notifyManagers !== false) rows.push(["Push · manager", at]);
    if (rule.notifyPerson) rows.push([`Push · ${sample.person}`, at]);
    rows.push(["Log · feed", at]);
    return rows;
  }, [rule, sample]);

  return (
    <div className="emp-page">
      <div className="rpt-head">
        <div>
          <ReportCrumbs items={["Automation", "Alerts", rule?.name ?? "Rule", "Test"]} />
          <h1 className="page-title" style={{ margin: 0 }}>Test rule with sample data</h1>
        </div>
        <div className="rpt-actions">
          {rule && !rule.builtin ? (
            <Link className="btn ghost" href={`/alerts/${rule.id}`}>Back to rule</Link>
          ) : (
            <Link className="btn ghost" href="/alerts">Back to alerts</Link>
          )}
          <button className="btn" type="button" disabled={testing} onClick={() => void run()}>
            {testing ? "Testing…" : dry ? "Replay" : "Run test"}
          </button>
        </div>
      </div>
      {error ? <div className="error" style={{ marginBottom: 12 }}>{error}</div> : null}
      {!dry ? (
        <div className="panel">
          Replay the last 30 days of this company&apos;s records. No alerts are sent.
        </div>
      ) : (
        <div className="al-test">
          <div className="panel" style={{ padding: 0, overflow: "hidden", margin: 0 }}>
            <div className="al-test-head">
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  {sample
                    ? `Simulation — ${sample.person}${sample.site ? ` at ${sample.site}` : ""}`
                    : "Simulation — last 30 days"}
                </div>
                <div style={{ fontSize: 11, color: "var(--if-ink-3)" }}>
                  {sample
                    ? `Playing back events from ${new Date(sample.at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`
                    : "Nothing in this window matched"}
                </div>
              </div>
              <button className="btn secondary" type="button" disabled={testing} onClick={() => void run()} style={{ marginTop: 0, width: "auto" }}>
                Replay
              </button>
            </div>
            <div style={{ padding: 20 }}>
              {events.map((event, index) => (
                <div key={`${event.time}-${index}`} className="al-tl">
                  {index < events.length - 1 ? <div className="al-tl-line" /> : null}
                  <div className="if-num al-tl-time">{event.time}</div>
                  <div className="al-tl-dot" style={{ background: `color-mix(in oklab, ${event.color} 14%, transparent)`, color: event.color }}>
                    <Glyph name={event.icon} size={12} color={event.color} />
                  </div>
                  <div className="al-tl-text">{event.text}</div>
                </div>
              ))}
              {events.length === 0 ? <p className="muted" style={{ margin: 0 }}>Nothing in the last {dry.days} days matches this rule.</p> : null}
              {dry.hits.length > 1 ? (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Would-have-fired</div>
                  <table>
                    <thead><tr><th>When</th><th>Who</th><th>Site</th><th /></tr></thead>
                    <tbody>
                      {dry.hits.slice(0, 20).map((hit, index) => (
                        <tr key={`${hit.at}-${index}`}>
                          <td>{new Date(hit.at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                          <td>{hit.person}</td>
                          <td>{hit.site ?? "—"}</td>
                          <td>{hit.minutes != null ? `${hit.minutes} min late` : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </div>
          <div>
            <div className="panel" style={{ padding: 20, margin: 0 }}>
              <div className="emp-kpi-label" style={{ marginBottom: 12 }}>Rule verdict</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div className="al-pick-icon" style={{ background: dry.wouldHaveFired ? "var(--if-green-soft)" : "var(--if-cream)", marginBottom: 0 }}>
                  <Glyph name="check" size={18} color={dry.wouldHaveFired ? "var(--if-green-deep)" : "var(--if-ink-3)"} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>
                  {dry.wouldHaveFired ? "Fired correctly" : "Would not have fired"}
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--if-ink-2)", lineHeight: 1.6 }}>
                Would have fired <b className="if-num">{dry.wouldHaveFired}</b> time{dry.wouldHaveFired === 1 ? "" : "s"} in the last {dry.days} days
                ({dry.perWeek}/week). No alerts were sent.
              </div>
              {dry.noisy ? (
                <div className="error" style={{ marginTop: 12, marginBottom: 0 }}>
                  This is noisy (over 50 a week). Tighten the site or minutes, then test again.
                </div>
              ) : null}
            </div>
            <div className="panel" style={{ padding: 20, marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12 }}>Notifications that would deliver</div>
              {deliveries.length === 0 ? <div className="muted">None — this dry-run did not hit.</div> : null}
              {deliveries.map(([label, time]) => (
                <div key={label} className="al-note">
                  <span>{label}</span>
                  <span className="if-num" style={{ color: "var(--if-ink-3)" }}>{time}</span>
                </div>
              ))}
            </div>
            {dry.byDay.length > 0 ? (
              <div className="panel" style={{ padding: 20, marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12 }}>Hits per day</div>
                <div className="al-bars">
                  {dry.byDay.slice(0, 14).reverse().map((row) => (
                    <div key={row.day} className="al-bar">
                      <div className="al-bar-fill" style={{ height: `${Math.max(8, (row.count / maxDay) * 64)}px` }} />
                      <div className="if-num" style={{ fontSize: 9, color: "var(--if-ink-3)" }}>{row.day.slice(5)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

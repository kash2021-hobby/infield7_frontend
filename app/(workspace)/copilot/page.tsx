"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, loadSession, type Session } from "@/lib/api";
import { AICrumbs, AIMark } from "@/lib/ai-ui";
import { NavIcon } from "@/lib/nav-icon";

type Item = {
  id: string;
  title: string;
  narrative: string;
  citation: string;
  suggestionTitle: string | null;
  status: string;
  tone: "coral" | "amber" | "green";
  label: string;
};
type Section = { id: string; label: string; body: string; cites: string[]; itemId: string | null };
type Copilot = {
  paused?: boolean;
  weekStart: string;
  weekNumber?: number;
  rangeLabel?: string;
  createdAt?: string | null;
  people?: number;
  sites?: number;
  checkins?: number;
  tasks?: number;
  memo?: { headline: string; sections: Section[] };
  items: Item[];
  pulse?: { months: number; days: number; signalPct: number; people: number; tasks: number };
  howWritten?: { engine: string; credits: number; ranAt: string | null };
  history?: { weekStart: string; items: number }[];
  settings?: { cadence: string; balance: number; briefCredits: number; enabled: boolean };
};

function toneColor(tone: string) {
  if (tone === "coral") return "var(--if-coral)";
  if (tone === "amber") return "var(--if-amber)";
  return "var(--if-green)";
}

export default function CopilotHome() {
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<Copilot | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh(current: Session) {
    const body = await api<Copilot>("/brief", {}, current.token);
    const items = (body.items ?? []).map((item) => ({
      ...item,
      tone: item.tone ?? (/late/i.test(item.title) ? "coral" : /alert/i.test(item.title) ? "amber" : "green"),
      label: item.label ?? (/late/i.test(item.title) ? "Gap detected" : /alert/i.test(item.title) ? "Risk" : "Note"),
    }));
    setData({
      ...body,
      items,
      memo: body.memo ?? {
        headline: items[0]?.title ?? "This week's brief",
        sections: items.map((item) => ({
          id: item.id,
          label: item.label,
          body: item.narrative,
          cites: [item.citation],
          itemId: item.id,
        })),
      },
      pulse: body.pulse ?? { months: 0, days: 0, signalPct: 0, people: body.people ?? 0, tasks: body.tasks ?? 0 },
      howWritten: body.howWritten ?? { engine: "Cited from this week's check-ins and alerts.", credits: 12, ranAt: null },
      settings: body.settings ?? { cadence: "weekly", balance: 0, briefCredits: 12, enabled: true },
    });
  }

  useEffect(() => {
    const current = loadSession();
    if (!current) return;
    setSession(current);
    refresh(current).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
  }, []);

  async function act(id: string, action: "accept" | "dismiss" | "snooze") {
    if (!session) return;
    setError("");
    setNote("");
    try {
      await api(`/brief/${id}/${action}`, { method: "POST", body: "{}" }, session.token);
      setNote(action === "accept" ? "Accepted. A task was created." : action === "dismiss" ? "Dismissed." : "Snoozed for 7 days.");
      await refresh(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update");
    }
  }

  async function regenerate() {
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      const body = await api<Copilot>("/brief/regenerate", { method: "POST", body: "{}" }, session.token);
      setData(body);
      setNote("This week's brief was rebuilt from live counts.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not regenerate");
    } finally {
      setBusy(false);
    }
  }

  function exportMemo() {
    if (!data) return;
    const text = [data.memo?.headline, ...(data.memo?.sections ?? []).map((s) => `${s.label}\n${s.body}\n${s.cites.join(" · ")}`)].filter(Boolean).join("\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `brief-${data.weekStart || "paused"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="ai-page">
      <div className="rpt-head">
        <div>
          <AICrumbs items={["AI copilot", data?.rangeLabel ? `Weekly brief · ${data.rangeLabel}` : "Weekly brief"]} />
          <h1 className="page-title" style={{ margin: 0 }}>Weekly brief</h1>
        </div>
        <div className="rpt-actions">
          <span className="ai-cadence"><NavIcon name="calendar" size={14} color="var(--if-ink-3)" /> Cadence: <b>{data?.settings?.cadence === "daily" ? "Daily digest" : "Weekly"}</b></span>
          <button type="button" className="btn ghost" onClick={exportMemo}>Export</button>
          <Link className="btn ghost" href="/copilot/architecture">How this works</Link>
          <Link className="btn ghost" href="/copilot/settings">Settings</Link>
          <button type="button" className="btn" disabled={busy || data?.paused} onClick={() => void regenerate()}>{busy ? "Rebuilding" : "Regenerate now"}</button>
        </div>
      </div>
      {error ? (
        <div className="error">
          {error}
          {error.includes("Credits") ? <> <Link href="/billing">Open billing</Link></> : null}
        </div>
      ) : null}
      {note ? <p className="muted">{note}</p> : null}

      {data?.paused ? (
        <div className="panel">Copilot is paused. Nothing is drafted until you turn it back on in settings.</div>
      ) : null}

      {data && !data.paused && data.memo ? (
        <div className="ai-home">
          <div className="ai-col">
            <div className="ai-memo">
              <div className="ai-memo-head">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <AIMark size={24} color="var(--if-paper)" />
                  <div>
                    <div className="ai-kicker">Week {data.weekNumber ?? "—"} · InField brief</div>
                    <div className="ai-headline">{data.memo.headline}</div>
                  </div>
                </div>
                <div className="ai-meta">
                  <span>▸ {data.rangeLabel}</span>
                  <span>▸ {data.people} people · {data.sites} sites</span>
                  <span>▸ {data.tasks} tasks on file</span>
                  <span>▸ Cited counts · no invented score</span>
                </div>
              </div>
              <div className="ai-memo-body">
                {(data.memo?.sections ?? []).map((s, i) => (
                  <div key={s.id} className="ai-sec" style={{ borderBottom: i < (data.memo?.sections.length ?? 0) - 1 ? "1px dashed var(--if-cream-2)" : "none" }}>
                    <div className="ai-sec-head">
                      <span className={`ai-sec-label ${s.id}`}>{s.label}</span>
                      <div className="ai-rule" />
                      {s.itemId ? (
                        <Link href={`/copilot/why/${s.itemId}`} className="ai-why">Show why <NavIcon name="arrow_up_right" size={11} /></Link>
                      ) : (
                        <span className="muted" style={{ fontSize: 11 }}>From this week&apos;s counts</span>
                      )}
                    </div>
                    <p>{s.body}</p>
                    <div className="ai-cites">
                      {s.cites.map((c) => <span key={c}>▸ {c}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="ai-kicker" style={{ color: "var(--if-ink-3)", marginBottom: 12 }}>Turn this brief into action</div>
              <div className="ai-actions">
                {data.items.filter((i) => i.status === "pending" && i.suggestionTitle).map((i) => (
                  <button key={i.id} type="button" className="ai-action" onClick={() => void act(i.id, "accept")}>
                    <div className="rpt-icon plain"><NavIcon name="check" size={16} /></div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>{i.suggestionTitle}</div>
                      <div className="muted" style={{ fontSize: 10 }}>Creates a task · you confirm</div>
                    </div>
                  </button>
                ))}
                <Link href="/alerts" className="ai-action">
                  <div className="rpt-icon plain"><NavIcon name="bell" size={16} /></div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>Open alerts</div>
                    <div className="muted" style={{ fontSize: 10 }}>Same feed as Automation</div>
                  </div>
                </Link>
                <button type="button" className="ai-action" onClick={exportMemo}>
                  <div className="rpt-icon plain"><NavIcon name="message" size={16} /></div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>Share brief with the team</div>
                    <div className="muted" style={{ fontSize: 10 }}>Downloads a text copy</div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div className="ai-side">
            <div className="panel">
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <AIMark size={18} />
                <div style={{ fontWeight: 700, fontSize: 12 }}>Learning pulse</div>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 10, color: "var(--if-green-deep)", fontWeight: 700 }}>LIVE</span>
              </div>
              <div className="if-num" style={{ fontSize: 22, fontWeight: 700 }}>{data.pulse?.months ? `${data.pulse.months} months` : "New workspace"}</div>
              <div className="muted">of check-in days on file · {data.pulse?.days ?? 0} distinct days</div>
              <div className="ai-bar"><span style={{ width: `${data.pulse?.signalPct ?? 0}%` }} /></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontFamily: "var(--if-mono)", color: "var(--if-ink-3)" }}>
                <span>Days toward 21</span><span>{data.pulse?.signalPct ?? 0}%</span>
              </div>
            </div>

            <div className="ai-kicker" style={{ color: "var(--if-ink-3)" }}>{data.items.length} insights flagged this week</div>
            {data.items.map((it) => (
              <div key={it.id} className="ai-card" style={{ borderLeftColor: toneColor(it.tone) }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  <span className={`chip ${it.tone === "green" ? "" : "ghost"}`} style={{ fontSize: 10 }}>{it.label}</span>
                  <span className="muted" style={{ marginLeft: "auto", fontSize: 10 }}>{it.citation}</span>
                </div>
                <div style={{ fontWeight: 600, fontSize: 12 }}>{it.title}</div>
                <div className="muted" style={{ marginTop: 4 }}>{it.narrative}</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, gap: 8, alignItems: "center" }}>
                  <Link href={`/copilot/why/${it.id}`} style={{ fontSize: 11, fontWeight: 600 }}>Show why</Link>
                  {it.status === "pending" ? (
                    <div style={{ display: "flex", gap: 4 }}>
                      <button type="button" className="btn ghost" style={{ margin: 0, width: "auto", padding: "5px 9px" }} onClick={() => void act(it.id, "dismiss")}>Dismiss</button>
                      <button type="button" className="btn ghost" style={{ margin: 0, width: "auto", padding: "5px 9px" }} onClick={() => void act(it.id, "snooze")}>Snooze</button>
                      {it.suggestionTitle ? (
                        <button type="button" className="btn" style={{ margin: 0, width: "auto", padding: "5px 9px" }} onClick={() => void act(it.id, "accept")}>Accept</button>
                      ) : (
                        <Link className="btn" href={`/copilot/why/${it.id}`} style={{ margin: 0, width: "auto", padding: "5px 9px" }}>Review</Link>
                      )}
                    </div>
                  ) : <span className="pill">{it.status}</span>}
                </div>
              </div>
            ))}

            <div className="ai-how">
              <div className="ai-kicker" style={{ color: "var(--if-ink-3)", marginBottom: 8 }}>How this was written</div>
              <p className="muted">{data.howWritten?.engine} {data.howWritten?.credits ?? 12} credits.</p>
              <div style={{ fontSize: 10, fontFamily: "var(--if-mono)", color: "var(--if-ink-3)", marginTop: 8 }}>
                {data.howWritten?.ranAt ? new Date(data.howWritten.ranAt).toLocaleString("en-IN") : "This week"} · pool {data.settings?.balance ?? "—"}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

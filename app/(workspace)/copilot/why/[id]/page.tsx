"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, loadSession } from "@/lib/api";
import { AICrumbs, Spark } from "@/lib/ai-ui";

type Item = {
  id: string;
  title: string;
  narrative: string;
  citation: string;
  suggestionTitle: string | null;
  status: string;
  label?: string;
  tone?: string;
};
type Evidence = {
  item: { id: string; title: string; narrative: string; citation: string; suggestionTitle: string | null; status: string; label: string; tone: string };
  sources: { label: string; href: string; snippet: string }[];
  series: number[];
  heatmap: number[][];
  hours: string[];
  days: string[];
  helpful: boolean | null;
  chain: string[];
};

function asEvidence(item: Item, series: number[] = []): Evidence {
  const tone = item.tone ?? (/late/i.test(item.title) ? "coral" : /alert/i.test(item.title) ? "amber" : "green");
  const label = item.label ?? (tone === "coral" ? "Gap detected" : tone === "amber" ? "Risk" : "Note");
  return {
    item: { ...item, tone, label },
    sources: [{ label: item.citation, href: "/attendance", snippet: item.narrative }],
    series,
    heatmap: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    hours: ["12–1", "1–2", "2–3", "3–4"],
    days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    helpful: null,
    chain: [
      "Counted this week's check-ins and open alerts.",
      "Matched a Brain policy name only if those words appear in it.",
      "Wrote the sentence from those counts. No model, no invented drop.",
    ],
  };
}

export default function EvidencePage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Evidence | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const current = loadSession();
    if (!current) return;
    const id = params.id;
    (async () => {
      try {
        const ev = await api<Evidence>(`/brief/items/${id}`, {}, current.token);
        setData(ev);
        return;
      } catch {
        /* older API has no /brief/items/:id — use this week's brief */
      }
      const brief = await api<{ items: Item[] }>("/brief", {}, current.token);
      const item = (brief.items ?? []).find((row) => row.id === id);
      if (!item) {
        setError("This insight is not in this week's brief.");
        return;
      }
      let series: number[] = [];
      try {
        const today = new Date().toISOString().slice(0, 10);
        const from = new Date(Date.now() - 24 * 86400000).toISOString().slice(0, 10);
        const report = await api<{ rows?: { day: string; late: boolean }[] }>(`/reports/attendance?from=${from}&to=${today}`, {}, current.token);
        const byDay = new Map<string, { n: number; late: number }>();
        for (const row of report.rows ?? []) {
          const cur = byDay.get(row.day) ?? { n: 0, late: 0 };
          cur.n += 1;
          if (row.late) cur.late += 1;
          byDay.set(row.day, cur);
        }
        series = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => (v.n ? Math.round((1 - v.late / v.n) * 100) : 100));
      } catch {
        series = [];
      }
      setData(asEvidence(item, series));
    })().catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
  }, [params.id]);

  async function act(action: "accept" | "dismiss") {
    const current = loadSession();
    if (!current || !data) return;
    try {
      await api(`/brief/${data.item.id}/${action}`, { method: "POST", body: "{}" }, current.token);
      setNote(action === "accept" ? "Accepted. A task was created." : "Dismissed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update");
    }
  }

  async function vote(helpful: boolean) {
    const current = loadSession();
    if (!current || !data) return;
    await api(`/brief/${data.item.id}/feedback`, { method: "POST", body: JSON.stringify({ helpful }) }, current.token);
    setData({ ...data, helpful });
  }

  function copy() {
    if (!data) return;
    const text = [data.item.title, data.item.narrative, ...data.sources.map((s) => s.label), ...data.chain].join("\n");
    void navigator.clipboard.writeText(text);
    setCopied(true);
  }

  const last = data?.series.length ? data.series[data.series.length - 1] : null;
  const maxHeat = data ? Math.max(1, ...data.heatmap.flat()) : 1;

  return (
    <div className="ai-page">
      <div className="rpt-head">
        <div>
          <AICrumbs items={["AI copilot", "Weekly brief", data ? `Show why · ${data.item.title}` : "Show why"]} />
          <h1 className="page-title" style={{ margin: 0 }}>Why we flagged this</h1>
        </div>
        <div className="rpt-actions">
          <button type="button" className="btn ghost" onClick={copy}>{copied ? "Copied" : "Copy evidence"}</button>
          {data?.item.suggestionTitle && data.item.status === "pending" ? (
            <button type="button" className="btn" onClick={() => void act("accept")}>Approve suggestion</button>
          ) : null}
          <Link className="btn ghost" href="/copilot">Back</Link>
        </div>
      </div>
      {error ? <div className="error">{error}</div> : null}
      {note ? <p className="muted">{note}</p> : null}
      {data ? (
        <div className="ai-home">
          <div className="ai-col">
            <div className="ai-claim" style={{ borderLeftColor: data.item.tone === "coral" ? "var(--if-coral)" : data.item.tone === "amber" ? "var(--if-amber)" : "var(--if-green)" }}>
              <span className="chip">{data.item.label}</span>
              <h2 style={{ fontSize: 22, margin: "10px 0 8px", letterSpacing: "-0.02em" }}>{data.item.title}</h2>
              <p className="muted">{data.item.narrative}</p>
            </div>
            <div className="panel">
              <div style={{ fontWeight: 700, marginBottom: 4 }}>On-time % · last counted days</div>
              <div className="muted" style={{ marginBottom: 8 }}>From check-ins in this company. Empty days are omitted.</div>
              {last != null ? <div className="if-num" style={{ fontSize: 28, fontWeight: 700 }}>{last}<span style={{ fontSize: 16, color: "var(--if-ink-3)" }}>%</span></div> : null}
              <Spark data={data.series} width={720} height={120} />
            </div>
            <div className="panel">
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Late check-ins by weekday · afternoon hours (UTC)</div>
              <div className="ai-heat">
                <div />
                {data.hours.map((h) => <div key={h} className="muted" style={{ fontSize: 10 }}>{h}</div>)}
                {data.days.map((day, r) => (
                  <div key={day} className="ai-heat-row">
                    <div className="muted" style={{ fontSize: 11 }}>{day}</div>
                    {data.heatmap[r].map((n, c) => (
                      <div key={`${day}-${c}`} className="ai-cell" title={`${n}`} style={{ opacity: 0.15 + (n / maxHeat) * 0.85 }} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="ai-side">
            <div className="panel">
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Sources</div>
              {data.sources.map((s) => (
                <Link key={s.label + s.href} href={s.href} className="brain-cite">
                  <span className="brain-ico" />
                  <span>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{s.label}</div>
                    <div className="muted">{s.snippet}</div>
                  </span>
                </Link>
              ))}
              <button type="button" className="btn secondary" style={{ marginTop: 12 }} onClick={() => void vote(false)}>Not helpful</button>
              <button type="button" className="btn ghost" style={{ marginTop: 8 }} onClick={() => void vote(true)}>Helpful</button>
              {data.helpful != null ? <p className="muted">Marked {data.helpful ? "helpful" : "not helpful"}.</p> : null}
            </div>
            <div className="panel">
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Reasoning chain</div>
              <ol className="ai-chain">
                {data.chain.map((step) => <li key={step}>{step}</li>)}
              </ol>
            </div>
            {data.item.status === "pending" ? (
              <button type="button" className="btn secondary" onClick={() => void act("dismiss")}>Dismiss</button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

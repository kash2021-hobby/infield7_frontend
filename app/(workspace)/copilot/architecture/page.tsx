"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, loadSession } from "@/lib/api";
import { AICrumbs, AIMark } from "@/lib/ai-ui";

type Arch = {
  sources: { label: string; live: boolean }[];
  lastRun: { checkins: number; tasks: number; alerts: number; engine: string };
};

const layers = [
  { title: "① Data sources", sub: "What this product already stores" },
  { title: "② Counts on your server", sub: "Joined and aggregated here" },
  { title: "③ Reasoning", sub: "Rules in this product. Hosted LLM off." },
  { title: "④ Human review", sub: "You accept or dismiss" },
];

export default function ArchitecturePage() {
  const [data, setData] = useState<Arch | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    const current = loadSession();
    if (!current) return;
    api<Arch>("/copilot/architecture", {}, current.token).then(setData).catch(() => undefined);
  }, []);

  return (
    <div className="ai-page">
      <div className="rpt-head">
        <div>
          <AICrumbs items={["AI copilot", "System architecture"]} />
          <h1 className="page-title" style={{ margin: 0 }}>How the AI thinks</h1>
        </div>
        <div className="rpt-actions">
          <Link className="btn ghost" href="/copilot">Weekly brief</Link>
          <Link className="btn" href="/copilot/settings">Model settings</Link>
        </div>
      </div>

      <div className="ai-explain">
        <AIMark size={32} />
        <div>
          <div style={{ fontWeight: 700 }}>A four-layer system — not a chatbot.</div>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            Counts stay in your workspace. This product writes the memo from those counts. A hosted language model stays off this product, so no employee row is sent out to draft prose.
          </p>
        </div>
        <div className="ai-legend">
          <span><i className="dot green" /> In-house</span>
          <span><i className="dot amber" /> Hosted · off</span>
          <span><i className="dot coral" /> Human loop</span>
        </div>
      </div>

      <div className="ai-pipe">
        {layers.map((L) => (
          <div key={L.title} className="ai-lane">
            <div className="ai-kicker">{L.title}</div>
            <div className="muted" style={{ marginBottom: 10 }}>{L.sub}</div>
            {L.title.startsWith("①") && data?.sources.map((s) => (
              <div
                key={s.label}
                className={`ai-node${s.live ? "" : " off"}`}
                onMouseEnter={() => setHover(s.label)}
                onMouseLeave={() => setHover(null)}
              >
                <b>{s.label}</b>
                <div className="muted">{s.live ? "event stream" : "off this product"}</div>
              </div>
            ))}
            {L.title.startsWith("②") && ["Per-person punctuality", "Open tasks", "Open alerts", "Brain policy names"].map((b) => (
              <div key={b} className="ai-node"><b>{b}</b><div className="muted">updated when you open the brief</div></div>
            ))}
            {L.title.startsWith("③") && (
              <>
                <div className="ai-node on"><b>Pattern detection</b><div className="muted">Counts and flags · in-house</div></div>
                <div className="ai-node off"><b>Forecast engine</b><div className="muted">Off this product</div></div>
                <div className="ai-node off"><b>Language engine</b><div className="muted">Claude / hosted LLM off</div></div>
              </>
            )}
            {L.title.startsWith("④") && (
              <>
                <div className="ai-gate">Human review gate · proposed, never auto-run</div>
                {["Weekly brief", "Insight cards", "Mobile pings", "Suggested tasks"].map((o) => (
                  <div key={o} className="ai-node"><b>{o}</b><div className="muted">approve / dismiss first</div></div>
                ))}
              </>
            )}
          </div>
        ))}
      </div>
      {hover ? <p className="muted">{hover}{data?.sources.find((s) => s.label === hover)?.live ? " is counted from live rows." : " is shown on the mock and stays off this product."}</p> : null}

      {data ? (
        <p className="muted">Last brief pipeline: {data.lastRun.checkins} check-ins, {data.lastRun.tasks} tasks, {data.lastRun.alerts} open alerts. {data.lastRun.engine}</p>
      ) : null}

      <div className="ai-why3">
        {[
          ["Why no hosted LLM here?", "A hosted model would need a redacted feature pack. This product writes from counts so nothing leaves the workspace to draft the memo."],
          ["Why in-house for detection?", "Late flags and open alerts are already in Postgres. They stay here and cost the weekly credit for the brief, not a token bill."],
          ["Why a human loop?", "Accept creates a task. Dismiss does nothing. The copilot never assigns, messages, or pays anyone on its own."],
        ].map(([t, b]) => (
          <div key={t} className="panel">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{t}</div>
            <div className="muted">{b}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

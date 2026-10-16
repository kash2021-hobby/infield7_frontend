"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, loadSession } from "@/lib/api";
import { AICrumbs } from "@/lib/ai-ui";

type Settings = {
  cadence: "weekly" | "daily";
  quietStart: string;
  quietEnd: string;
  residency: string;
  enabled: boolean;
  languageTier: string;
  weeklyBrief: boolean;
  singaporeOff: boolean;
  hostedLlmOff: boolean;
  briefCredits: number;
  balance: number;
  monthlyCredits: number;
  feedback: { helpful: number; not_helpful: number };
  permissions: { area: string; observe: boolean; suggest: boolean; auto: boolean; held?: boolean }[];
};

export default function SettingsPage() {
  const [data, setData] = useState<Settings | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const current = loadSession();
    if (!current) return;
    const body = await api<Settings>("/copilot/settings", {}, current.token);
    setData(body);
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
  }, []);

  async function save(patch: Partial<Settings>) {
    const current = loadSession();
    if (!current) return;
    setBusy(true);
    setError("");
    try {
      const body = await api<Settings>("/copilot/settings", { method: "PATCH", body: JSON.stringify(patch) }, current.token);
      setData(body);
      setNote("Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const used = data ? Math.min(100, Math.round(((data.monthlyCredits - data.balance) / Math.max(data.monthlyCredits, 1)) * 100)) : 0;

  return (
    <div className="ai-page">
      <div className="rpt-head">
        <div>
          <AICrumbs items={["AI copilot", "Model & settings"]} />
          <h1 className="page-title" style={{ margin: 0 }}>Model & settings</h1>
        </div>
        <div className="rpt-actions">
          <Link className="btn ghost" href="/copilot">Cancel</Link>
          <button type="button" className="btn" disabled={busy} onClick={() => data && void save({ cadence: data.cadence, quietStart: data.quietStart, quietEnd: data.quietEnd, weeklyBrief: data.weeklyBrief, enabled: data.enabled })}>Save changes</button>
        </div>
      </div>
      {error ? <div className="error">{error}</div> : null}
      {note ? <p className="muted">{note}</p> : null}
      {data ? (
        <div className="ai-home">
          <div className="ai-col">
            <div className="panel">
              <div style={{ fontWeight: 700 }}>Reasoning engines</div>
              <p className="muted">The live engine is Fast: counts on your server. Standard and Deep would burn hosted credits and stay off this product.</p>
              {[
                { name: "Pattern detection", kind: "in-house", live: true, purpose: "Spots late check-ins and open alerts in this week's rows.", cost: "in the weekly brief" },
                { name: "Forecast engine", kind: "in-house", live: false, purpose: "Time-series risk scoring.", cost: "off this product" },
                { name: "Language engine", kind: "hosted", live: false, purpose: "Hosted Claude / GPT prose.", cost: "off this product" },
              ].map((e) => (
                <div key={e.name} className={`ai-engine ${e.kind}${e.live ? "" : " dim"}`}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span className="ai-kind">{e.kind}</span>
                    <b>{e.name}</b>
                    {!e.live ? <span className="muted">Off this product</span> : null}
                  </div>
                  <p className="muted">{e.purpose}</p>
                  <div className="muted" style={{ fontFamily: "var(--if-mono)", fontSize: 11 }}>Cost · {e.cost}</div>
                </div>
              ))}
            </div>
            <div className="panel" style={{ overflowX: "auto" }}>
              <div style={{ fontWeight: 700 }}>What AI is allowed to touch</div>
              <p className="muted">Observe and suggest on live ops. Auto-execute stays off. The brief does not invent rupee amounts — those come from payroll templates.</p>
              <div className="ai-perm">
                <div>Area</div><div>Observe</div><div>Suggest</div><div>Auto-execute</div>
                {data.permissions.map((p) => (
                  <div key={p.area} className="ai-perm-row">
                    <div>{p.area}{p.held ? <span className="muted"> · off</span> : null}</div>
                    <div>{p.observe ? "✓" : "—"}</div>
                    <div>{p.suggest ? "✓" : "—"}</div>
                    <div>—</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="ai-side">
            <div className="panel">
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Cadence</div>
              {(["weekly", "daily"] as const).map((c) => (
                <button key={c} type="button" className={`ai-pick${data.cadence === c ? " on" : ""}`} onClick={() => setData({ ...data, cadence: c })}>
                  {c === "weekly" ? "Weekly · Mondays" : "Daily digest"}
                </button>
              ))}
            </div>
            <div className="panel">
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Quiet hours</div>
              <div className="grid">
                <div><label>From</label><input value={data.quietStart} onChange={(e) => setData({ ...data, quietStart: e.target.value })} /></div>
                <div><label>To</label><input value={data.quietEnd} onChange={(e) => setData({ ...data, quietEnd: e.target.value })} /></div>
              </div>
            </div>
            <div className="panel">
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Data residency</div>
              <div className="ai-pick on">India</div>
              <div className="ai-pick dim">Singapore · off this product</div>
            </div>
            <div className="panel">
              <div style={{ fontWeight: 700 }}>Credit usage</div>
              <p className="muted">{data.balance} left of {data.monthlyCredits}. A brief costs {data.briefCredits}.</p>
              <div className="ai-bar"><span style={{ width: `${used}%` }} /></div>
              <Link href="/billing">Open billing</Link>
            </div>
            <div className="panel">
              <label style={{ display: "flex", gap: 8, fontWeight: 600 }}>
                <input type="checkbox" checked={data.weeklyBrief} onChange={(e) => setData({ ...data, weeklyBrief: e.target.checked })} style={{ width: "auto" }} />
                Enable weekly brief
              </label>
            </div>
            <div className="ai-kill">
              <div style={{ fontWeight: 700, color: "oklch(45% 0.18 25)" }}>Kill switch</div>
              <p className="muted">Stops drafting. Check-ins still record.</p>
              <button type="button" className="btn secondary" onClick={() => void save({ enabled: !data.enabled })}>
                {data.enabled ? "Pause AI copilot" : "Resume AI copilot"}
              </button>
            </div>
            <p className="muted">Feedback this workspace: {data.feedback.helpful} helpful · {data.feedback.not_helpful} not. Stored only.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

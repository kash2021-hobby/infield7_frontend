"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, loadSession, type Session } from "@/lib/api";
import { MiniFlow, WfCrumbs } from "@/lib/workflow-ui";
import { NavIcon } from "@/lib/nav-icon";

type Card = {
  id: string;
  name: string;
  status: string;
  trigger: string;
  version: number;
  enabled: boolean;
  steps: number;
  runs: number;
  lastRun: string | null;
};
type Template = { id: string; name: string; desc: string; trigger: string; steps: number };

export default function WorkflowLibraryPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [rows, setRows] = useState<Card[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  async function refresh(current: Session) {
    const body = await api<{ workflows: Card[]; templates: Template[] }>("/workflows", {}, current.token);
    setRows(body.workflows);
    setTemplates(body.templates ?? []);
  }

  useEffect(() => {
    const current = loadSession();
    if (!current) return;
    setSession(current);
    refresh(current).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
  }, []);

  const shown = useMemo(() => {
    return rows.filter((row) => {
      if (filter === "live" && row.status !== "live") return false;
      if (filter === "draft" && row.status !== "draft") return false;
      if (filter === "manual" && row.trigger !== "manual") return false;
      if (filter === "checkin" && row.trigger !== "checkin") return false;
      if (q.trim() && !`${row.name} ${row.trigger}`.toLowerCase().includes(q.trim().toLowerCase())) return false;
      return true;
    });
  }, [rows, q, filter]);

  async function toggle(row: Card) {
    const current = loadSession();
    if (!current) return;
    await api(`/workflows/${row.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !row.enabled }) }, current.token);
    await refresh(current);
  }

  return (
    <div className="wf-page">
      <div className="rpt-head">
        <div>
          <WfCrumbs items={["Automation", "Workflows"]} />
          <h1 className="page-title" style={{ margin: 0 }}>Task workflows</h1>
        </div>
      </div>
      {error ? <div className="error">{error}</div> : null}

      <div className="wf-hero">
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Create a new workflow</div>
        <div className="muted" style={{ marginBottom: 16 }}>Two ways to start. Steps come from your words, a template, or Brain rows — not invented copy.</div>
        <div className="wf-start">
          <Link href="/workflows/new" className="wf-cta on">
            <span className="rpt-badge ok" style={{ top: 12, right: 12 }}>RECOMMENDED</span>
            <div className="rpt-icon"><NavIcon name="message" size={22} color="var(--if-green-deep)" /></div>
            <div style={{ fontSize: 16, fontWeight: 700, margin: "12px 0 4px" }}>Describe it in plain English</div>
            <div className="muted" style={{ flex: 1 }}>Type how the process works. We split it into steps and cite Brain only when a row matches.</div>
            <div className="muted" style={{ fontFamily: "var(--if-mono)", fontSize: 11, margin: "12px 0" }}>Try: When someone checks in, they visit the site and take a photo…</div>
            <span className="btn" style={{ marginTop: 0, width: "auto" }}>Start describing</span>
          </Link>
          <div className="wf-cta">
            <div className="rpt-icon plain"><NavIcon name="briefcase" size={22} color="var(--if-ink-2)" /></div>
            <div style={{ fontSize: 16, fontWeight: 700, margin: "12px 0 4px" }}>Start from a template</div>
            <div className="muted" style={{ marginBottom: 12 }}>Three live templates. No sales or payroll flows.</div>
            {templates.map((t) => (
              <Link key={t.id} href={`/workflows/new?template=${t.id}`} className="wf-tpl">
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</div>
                  <div className="muted">{t.desc}</div>
                </div>
                <span className="muted">{t.steps} steps</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {["all", "live", "draft", "manual", "checkin"].map((id) => (
          <button key={id} type="button" className={`chip${filter === id ? "" : " ghost"}`} onClick={() => setFilter(id)}>{id}</button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search workflows…" style={{ margin: 0, maxWidth: 220, marginLeft: "auto" }} />
      </div>

      <div className="wf-grid">
        {shown.map((row) => (
          <div key={row.id} className="wf-card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <Link href={`/workflows/${row.id}?stage=${row.status === "draft" ? "draft" : "publish"}`} style={{ fontWeight: 700, color: "inherit", textDecoration: "none" }}>{row.name}</Link>
              <span className={`pill ${row.status === "live" ? "ok" : ""}`}>{row.status}</span>
            </div>
            <MiniFlow n={row.steps || 3} />
            <div className="muted" style={{ fontFamily: "var(--if-mono)", fontSize: 11 }}>
              v{row.version} · {row.trigger} · {row.steps} steps · {row.runs} runs
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {session?.user.role !== "employee" ? (
                <button type="button" className="btn secondary" style={{ margin: 0, width: "auto" }} onClick={() => void toggle(row)}>{row.enabled ? "On" : "Off"}</button>
              ) : null}
              <Link className="btn secondary" href={`/workflows/${row.id}?stage=configure`} style={{ margin: 0 }}>Open</Link>
            </div>
          </div>
        ))}
        {shown.length === 0 ? <div className="panel muted">No workflows in this filter.</div> : null}
      </div>
    </div>
  );
}

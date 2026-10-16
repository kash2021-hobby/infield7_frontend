"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api, loadSession } from "@/lib/api";
import { WfCrumbs, WfRail } from "@/lib/workflow-ui";

type Template = { id: string; name: string; desc: string };
type Chip = { section: string; label: string; href: string };

function NewWorkflowForm() {
  const router = useRouter();
  const search = useSearchParams();
  const templateId = search.get("template") ?? "";
  const [prompt, setPrompt] = useState("");
  const [brainMode, setBrainMode] = useState<"off" | "light" | "full">(templateId ? "off" : "full");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [chips, setChips] = useState<Chip[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const current = loadSession();
    if (!current) return;
    api<{ templates: Template[] }>("/workflows", {}, current.token)
      .then((body) => setTemplates(body.templates ?? []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const current = loadSession();
    if (!current || brainMode === "off" || prompt.trim().length < 4) {
      setChips([]);
      return;
    }
    const timer = window.setTimeout(() => {
      api<{ chips: Chip[] }>(`/workflows/preview-brain?q=${encodeURIComponent(prompt.slice(0, 80))}&brainMode=${brainMode}`, {}, current.token)
        .then((body) => setChips(body.chips ?? []))
        .catch(() => setChips([]));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [prompt, brainMode]);

  async function start(event: React.FormEvent) {
    event.preventDefault();
    const current = loadSession();
    if (!current) return;
    setBusy(true);
    setError("");
    try {
      const created = await api<{ id: string }>("/workflows", {
        method: "POST",
        body: JSON.stringify({
          prompt: prompt.trim() || undefined,
          templateId: templateId || undefined,
          brainMode,
          name: prompt.trim().slice(0, 48) || undefined,
        }),
      }, current.token);
      if (templateId) {
        router.push(`/workflows/${created.id}?stage=configure`);
        return;
      }
      if (brainMode === "off") {
        await api(`/workflows/${created.id}/draft`, { method: "POST", body: "{}" }, current.token);
        router.push(`/workflows/${created.id}?stage=draft`);
        return;
      }
      router.push(`/workflows/${created.id}?stage=interview`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wf-page">
      <WfRail current={0} hint={brainMode === "off" ? "NO BRAIN" : "BRAIN MATCHES ONLY"} />
      <div className="rpt-head">
        <div>
          <WfCrumbs items={["Automation", "Workflows", "New"]} />
          <h1 className="page-title" style={{ margin: 0 }}>Describe the workflow</h1>
        </div>
        <Link className="btn ghost" href="/workflows">Cancel</Link>
      </div>
      {error ? <div className="error">{error}</div> : null}
      <form onSubmit={start} className="wf-describe">
        <div className="panel" style={{ padding: 22 }}>
          <label htmlFor="prompt">How does this process work?</label>
          <textarea
            id="prompt"
            rows={8}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="When someone checks in, they visit the site within a day and take a photo of the work…"
            required={!templateId}
          />
          <div className="muted" style={{ marginTop: 8 }}>{prompt.length} characters · one idea per sentence or line</div>
          {chips.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
              {chips.map((c) => (
                <Link key={`${c.section}-${c.label}`} href={c.href} className="chip ghost" style={{ fontSize: 11 }}>{c.section}: {c.label.slice(0, 40)}</Link>
              ))}
            </div>
          ) : brainMode !== "off" && prompt.trim().length >= 4 ? (
            <div className="muted" style={{ marginTop: 12 }}>No Brain rows match this text yet.</div>
          ) : null}
          <button className="btn" disabled={busy} style={{ marginTop: 16, width: "auto" }}>{busy ? "Starting" : "Continue"}</button>
        </div>
        <div className="panel">
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Brain context</div>
          <div className="muted" style={{ marginBottom: 12 }}>Light uses narrative, policies, and RACI. Full uses every Brain match. Off uses only your words — no invented copy.</div>
          {(["full", "light", "off"] as const).map((id) => (
            <label key={id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, fontWeight: 500 }}>
              <input type="radio" name="brain" checked={brainMode === id} onChange={() => setBrainMode(id)} style={{ width: "auto" }} />
              {id === "full" ? "Full Brain" : id === "light" ? "Light" : "No Brain"}
            </label>
          ))}
          <div style={{ fontSize: 13, fontWeight: 700, margin: "16px 0 8px" }}>Or a template</div>
          {templates.map((t) => (
            <Link key={t.id} href={`/workflows/new?template=${t.id}`} className={`wf-tpl${templateId === t.id ? " on" : ""}`}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</div>
                <div className="muted">{t.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </form>
    </div>
  );
}

export default function NewWorkflowPage() {
  return (
    <Suspense fallback={<div className="muted">Loading…</div>}>
      <NewWorkflowForm />
    </Suspense>
  );
}

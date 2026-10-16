"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Glyph, type AlertGlyphName } from "@/lib/alert-glyphs";
import { api, loadSession } from "@/lib/api";
import { ReportCrumbs } from "@/lib/reports";

type Template = {
  id: string;
  name: string;
  category: string;
  description: string;
  noise: "Low" | "Med" | "High";
  live: boolean;
  heldReason: string | null;
  defaultMinutes: number | null;
  policyName: string | null;
  icon: AlertGlyphName;
  popular: boolean;
  tone: "coral" | "amber" | "green";
};

const CATS = ["Location", "Attendance", "Tasks", "Sales", "Device", "Safety", "Custom"];

function toneColor(tone: Template["tone"]) {
  if (tone === "coral") return "var(--if-coral)";
  if (tone === "amber") return "var(--if-amber)";
  return "var(--if-green)";
}

export default function AlertTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [category, setCategory] = useState("");
  const [preview, setPreview] = useState<Template | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    const session = loadSession();
    if (!session) return;
    api<{ templates: Template[] }>("/alert-templates", {}, session.token)
      .then((body) => setTemplates(body.templates.map((item) => ({
        ...item,
        icon: item.icon || "check",
        popular: Boolean(item.popular),
        tone: item.tone || "green",
      }))))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
  }, []);

  async function useTemplate(id: string) {
    const session = loadSession();
    if (!session) return;
    setBusy(id);
    setError("");
    try {
      const result = await api<{ blank: boolean; id: string | null }>(`/alert-templates/${id}/use`, {
        method: "POST",
        body: JSON.stringify({}),
      }, session.token);
      if (result.blank || !result.id) router.push("/alerts/new?blank=1");
      else router.push(`/alerts/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start from that template");
    } finally {
      setBusy("");
    }
  }

  const shown = useMemo(
    () => templates.filter((item) => !category || item.category === category),
    [templates, category],
  );

  const chips = [
    { id: "", label: `All ${templates.length}` },
    ...CATS.map((item) => ({
      id: item,
      label: `${item} ${templates.filter((row) => row.category === item).length}`,
    })),
  ];

  return (
    <div className="emp-page">
      <div className="rpt-head">
        <div>
          <ReportCrumbs items={["Automation", "Alerts", "Templates"]} />
          <h1 className="page-title" style={{ margin: 0 }}>Choose a template</h1>
        </div>
        <div className="rpt-actions">
          <Link className="btn ghost" href="/alerts" style={{ width: "auto", marginTop: 0 }}>Cancel</Link>
          <Link className="btn" href="/alerts/new?blank=1" style={{ width: "auto", marginTop: 0 }}>Start blank</Link>
        </div>
      </div>
      <div style={{ fontSize: 14, color: "var(--if-ink-3)", marginBottom: 20, maxWidth: 640 }}>
        Start from a common recipe. You can tweak the trigger, conditions and actions after — templates are just a head-start.
      </div>
      {error ? <div className="error" style={{ marginBottom: 12 }}>{error}</div> : null}
      <div className="emp-filters" style={{ marginBottom: 20 }}>
        {chips.map((item) => (
          <button key={item.label} type="button" className={`emp-chip${category === item.id ? " on" : ""}`} onClick={() => setCategory(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="al-pick">
        {shown.map((item) => {
          const color = toneColor(item.tone);
          return (
            <div key={item.id} className={`panel${item.live ? "" : " al-held"}`} style={{ padding: 20, margin: 0, position: "relative" }}>
              {item.popular ? <div className="al-popular">★ Popular</div> : null}
              <div className="al-pick-icon" style={{ background: `color-mix(in oklab, ${color} 14%, transparent)`, color }}>
                <Glyph name={item.icon} size={20} color={color} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{item.name}</div>
              <div className="emp-kpi-label" style={{ marginTop: 4 }}>{item.category}</div>
              <div style={{ fontSize: 12, color: "var(--if-ink-2)", marginTop: 10, lineHeight: 1.5, minHeight: 36 }}>{item.description}</div>
              {item.live && item.defaultMinutes ? (
                <div style={{ fontSize: 11, color: "var(--if-ink-3)", marginTop: 8 }}>
                  Default {item.defaultMinutes} min{item.policyName ? ` · from ${item.policyName}` : " · InField default"}
                </div>
              ) : null}
              {item.live ? (
                <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
                  <button
                    type="button"
                    className="btn"
                    style={{ flex: 1, marginTop: 0, justifyContent: "center" }}
                    disabled={Boolean(busy)}
                    onClick={() => void useTemplate(item.id)}
                  >
                    {busy === item.id ? "Opening…" : "Use template"}
                  </button>
                  <button type="button" className="btn ghost" style={{ marginTop: 0 }} onClick={() => setPreview(item)}>Preview</button>
                </div>
              ) : (
                <div className="emp-held" style={{ marginTop: 12 }}>{item.heldReason || "Off this product"}</div>
              )}
            </div>
          );
        })}
      </div>
      {preview ? (
        <div className="al-preview" role="dialog" aria-label={`${preview.name} preview`}>
          <div className="panel" style={{ padding: 20, maxWidth: 420, margin: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{preview.name}</div>
            <p className="muted" style={{ marginTop: 0 }}>{preview.description}</p>
            <div style={{ fontSize: 13, lineHeight: 1.7 }}>
              <span className="rule-tag when">WHEN</span> {preview.name.toLowerCase()}{" "}
              <span className="rule-tag if">IF</span>{" "}
              {preview.defaultMinutes ? `threshold ${preview.defaultMinutes} min` : "no extra filter"}{" "}
              <span className="rule-tag then">THEN</span> notify the site manager and log the incident.
            </div>
            <div className="rpt-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn ghost" onClick={() => setPreview(null)}>Close</button>
              {preview.live ? (
                <button type="button" className="btn" disabled={Boolean(busy)} onClick={() => void useTemplate(preview.id)}>Use template</button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

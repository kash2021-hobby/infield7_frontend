"use client";

import Link from "next/link";

export function WfCrumbs({ items }: { items: string[] }) {
  return <div className="rpt-crumbs">{items.join(" · ")}</div>;
}

export function WfRail({ current, hint }: { current: number; hint?: string }) {
  const stages = ["Describe", "AI draft", "Configure", "Alerts", "Test", "Publish"];
  return (
    <div className="rpt-rail">
      {stages.map((label, index) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, flex: index < stages.length - 1 ? 1 : undefined }}>
          <div className={`rpt-dot${index === current ? " on" : index < current ? " done" : ""}`}>
            {index < current ? "✓" : index + 1}
          </div>
          <span style={{ fontSize: 12, fontWeight: index === current || index < current ? 700 : 500, color: index === current ? "var(--if-ink)" : index < current ? "var(--if-green-deep)" : "var(--if-ink-3)" }}>
            {label}
          </span>
          {index < stages.length - 1 ? (
            <div style={{ flex: 1, height: 2, maxWidth: 60, background: "var(--if-cream-2)", borderRadius: 2 }}>
              {index < current ? <div style={{ height: "100%", background: "var(--if-green)" }} /> : null}
            </div>
          ) : null}
        </div>
      ))}
      <div style={{ flex: 1 }} />
      <div style={{ fontSize: 11, color: "var(--if-ink-3)", fontFamily: "var(--if-mono)", letterSpacing: "0.06em" }}>{hint ?? "GROUNDED IN YOUR WORDS"}</div>
    </div>
  );
}

export function MiniFlow({ n = 4 }: { n?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
      {Array.from({ length: Math.min(n, 7) }).map((_, i) => (
        <span key={i} className="wf-mini" />
      ))}
    </div>
  );
}

export function SourceMark({ label, href }: { label: string | null; href?: string | null }) {
  if (!label) return <span className="muted" style={{ fontSize: 11 }}>From your description</span>;
  const inner = <span className="chip ghost" style={{ fontSize: 10 }}>{label.slice(0, 48)}</span>;
  return href ? <Link href={href}>{inner}</Link> : inner;
}

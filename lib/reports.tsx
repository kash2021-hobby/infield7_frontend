"use client";

import Link from "next/link";

export function ReportCrumbs({ items }: { items: string[] }) {
  return <div className="rpt-crumbs">{items.join(" · ")}</div>;
}

export function ReportRail({ current }: { current: number }) {
  const stages = ["Request", "Understand", "Preview", "Save & share"];
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
            <div style={{ flex: 1, height: 2, maxWidth: 80, background: "var(--if-cream-2)", borderRadius: 2 }}>
              {index < current ? <div style={{ height: "100%", background: "var(--if-green)" }} /> : null}
            </div>
          ) : null}
        </div>
      ))}
      <div style={{ flex: 1 }} />
      <div style={{ fontSize: 11, color: "var(--if-ink-3)", fontFamily: "var(--if-mono)", letterSpacing: "0.06em" }}>PICK A TEMPLATE</div>
    </div>
  );
}

export function ago(iso: string) {
  const ms = Date.now() - Date.parse(iso);
  const min = Math.round(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr${hr === 1 ? "" : "s"} ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function FormatMark({ kind }: { kind: string }) {
  return <span className={`fmt${kind === "pdf" ? " pdf" : ""}`}>{kind.toUpperCase()}</span>;
}

export function StarButton({ on, onClick, busy }: { on: boolean; onClick: () => void; busy?: boolean }) {
  return (
    <button type="button" className="btn secondary" onClick={onClick} disabled={busy} aria-label={on ? "Unstar" : "Star"} style={{ width: 40, padding: "8px 0" }}>
      {on ? "★" : "☆"}
    </button>
  );
}

export function CancelLink() {
  return <Link className="btn ghost" href="/reports">Cancel</Link>;
}

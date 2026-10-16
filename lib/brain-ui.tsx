"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ReportCrumbs } from "@/lib/reports";

export const BRAIN_CATS = [
  { id: "narrative", label: "Company narrative", short: "Narrative", icon: "quote" },
  { id: "website", label: "Website & online", short: "Website", icon: "globe" },
  { id: "products", label: "Products & services", short: "Products", icon: "box" },
  { id: "people", label: "People & roles", short: "People", icon: "users" },
  { id: "customers", label: "Customers & segments", short: "Customers", icon: "target" },
  { id: "partners", label: "Vendors & partners", short: "Partners", icon: "handshake" },
  { id: "docs", label: "Documents & templates", short: "Documents", icon: "file" },
  { id: "fields", label: "Fields & taxonomies", short: "Fields", icon: "grid" },
  { id: "slas", label: "SLAs & timing", short: "SLAs", icon: "clock" },
  { id: "thresholds", label: "Thresholds & approvals", short: "Thresholds", icon: "percent" },
  { id: "integrations", label: "Integrations", short: "Integrations", icon: "link" },
  { id: "compliance", label: "Compliance & regulatory", short: "Compliance", icon: "shield" },
  { id: "history", label: "Historic examples", short: "History", icon: "refresh" },
  { id: "policies", label: "Policies & rules", short: "Policies", icon: "lock" },
] as const;

export const BRAIN_LAYOUT: Record<string, { x: number; y: number }> = {
  narrative: { x: 310, y: 60 },
  website: { x: 470, y: 90 },
  products: { x: 560, y: 200 },
  people: { x: 540, y: 320 },
  customers: { x: 420, y: 380 },
  partners: { x: 280, y: 400 },
  docs: { x: 140, y: 370 },
  fields: { x: 50, y: 280 },
  slas: { x: 40, y: 170 },
  thresholds: { x: 100, y: 60 },
  integrations: { x: 200, y: 30 },
  compliance: { x: 220, y: 160 },
  history: { x: 400, y: 200 },
  policies: { x: 200, y: 240 },
};

export const BRAIN_EDGES: [string, string][] = [
  ["narrative", "website"], ["narrative", "products"], ["website", "products"],
  ["products", "customers"], ["customers", "partners"], ["products", "partners"],
  ["people", "docs"], ["docs", "fields"], ["fields", "history"],
  ["slas", "thresholds"], ["thresholds", "policies"], ["policies", "compliance"],
  ["integrations", "fields"], ["integrations", "history"],
  ["compliance", "docs"], ["people", "slas"],
  ["history", "policies"], ["history", "products"],
];

export type BrainModule = {
  id: string;
  fill: number;
  items: number;
  total: number;
  href: string;
  status: string;
};

export function catHref(id: string) {
  return BRAIN_CATS.find((cat) => cat.id === id) ? (
    ["narrative", "website"].includes(id) ? "/brain/narrative"
    : ["products", "customers"].includes(id) ? "/brain/products"
    : id === "people" ? "/brain/people"
    : ["docs", "fields"].includes(id) ? "/brain/documents"
    : ["slas", "thresholds", "policies", "compliance"].includes(id) ? "/brain/policies"
    : "/brain/integrations"
  ) : "/brain";
}

export function BrainGlyph({ name, size = 16, color = "currentColor" }: { name: string; size?: number; color?: string }) {
  const p = { fill: "none" as const, stroke: color, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {name === "quote" ? <path {...p} d="M7 17h4v-6H6v4a3 3 0 0 0 3 3M17 17h4v-6h-5v4a3 3 0 0 0 3 3" /> : null}
      {name === "globe" ? <><circle {...p} cx="12" cy="12" r="9" /><path {...p} d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></> : null}
      {name === "box" ? <path {...p} d="M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7" /> : null}
      {name === "users" ? <><circle {...p} cx="9" cy="8" r="3" /><path {...p} d="M3 20c0-3 3-5 6-5s6 2 6 5M16 8a3 3 0 1 1 0 6" /></> : null}
      {name === "target" ? <><circle {...p} cx="12" cy="12" r="8" /><circle {...p} cx="12" cy="12" r="4" /><circle {...p} cx="12" cy="12" r="1" /></> : null}
      {name === "handshake" ? <path {...p} d="M8 12l3 3 7-7M4 12l4 4 2-2" /> : null}
      {name === "file" ? <><path {...p} d="M14 3H7v18h10V8z" /><path {...p} d="M14 3v5h5" /></> : null}
      {name === "grid" ? <><rect {...p} x="4" y="4" width="7" height="7" /><rect {...p} x="13" y="4" width="7" height="7" /><rect {...p} x="4" y="13" width="7" height="7" /><rect {...p} x="13" y="13" width="7" height="7" /></> : null}
      {name === "clock" ? <><circle {...p} cx="12" cy="12" r="9" /><path {...p} d="M12 7v5l3 2" /></> : null}
      {name === "percent" ? <><path {...p} d="M19 5L5 19" /><circle {...p} cx="7" cy="7" r="2" /><circle {...p} cx="17" cy="17" r="2" /></> : null}
      {name === "link" ? <path {...p} d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" /> : null}
      {name === "shield" ? <path {...p} d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /> : null}
      {name === "refresh" ? <path {...p} d="M21 12a9 9 0 1 1-2.5-6.2M21 4v6h-6" /> : null}
      {name === "lock" ? <><rect {...p} x="5" y="11" width="14" height="10" rx="2" /><path {...p} d="M8 11V8a4 4 0 0 1 8 0v3" /></> : null}
      {name === "brain" ? <><path {...p} d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 1 4 3 3 0 0 0 4 3V4z" /><path {...p} d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-1 4 3 3 0 0 1-4 3V4z" /></> : null}
      {name === "sparkles" ? <path {...p} d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" /> : null}
      {name === "plus" ? <path {...p} d="M12 5v14M5 12h14" /> : null}
    </svg>
  );
}

export function FillRing({ pct, size = 40, thickness = 4, color, bg = "var(--if-cream-2)", label }: { pct: number; size?: number; thickness?: number; color?: string; bg?: string; label?: boolean }) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  const stroke = color || (pct >= 70 ? "var(--if-green)" : pct >= 45 ? "var(--if-amber)" : "var(--if-coral)");
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={bg} strokeWidth={thickness} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={stroke} strokeWidth={thickness} strokeDasharray={`${dash} ${c}`} strokeLinecap="round" />
      </svg>
      {label ? (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: size * 0.28, fontWeight: 700, fontFamily: "var(--if-mono)" }}>{pct}</div>
      ) : null}
    </div>
  );
}

export function BrainShell({
  crumbs,
  title,
  subtitle,
  actions,
  children,
}: {
  crumbs: string[];
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="emp-page">
      <div className="rpt-head">
        <div>
          <ReportCrumbs items={crumbs} />
          <h1 className="page-title" style={{ margin: 0 }}>{title}</h1>
        </div>
        {actions ? <div className="rpt-actions">{actions}</div> : null}
      </div>
      {subtitle ? (
        <div className="brain-sub">
          <BrainGlyph name="sparkles" size={14} color="var(--if-green-deep)" />
          <span>{subtitle}</span>
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function BrainRail({ active, score, modules }: { active: string; score: number; modules: BrainModule[] }) {
  const fillFor = (id: string) => modules.find((mod) => mod.id === id)?.fill;
  return (
    <div className="brain-rail">
      <div className="brain-rail-head">
        <div className="brain-rail-mark"><BrainGlyph name="brain" size={16} color="var(--if-green)" /></div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700 }}>Business Brain</div>
          <div className="if-num" style={{ fontSize: 10, color: "var(--if-ink-3)", letterSpacing: "0.04em" }}>{score}% COMPLETE</div>
        </div>
      </div>
      <div className="brain-rail-kicker">Overview</div>
      <Link href="/brain" className={`brain-rail-item${active === "overview" ? " on" : ""}`}>
        <BrainGlyph name="brain" size={14} />
        <span style={{ flex: 1 }}>Brain map</span>
      </Link>
      <div className="brain-rail-kicker">Context sources</div>
      {BRAIN_CATS.map((cat) => {
        const fill = fillFor(cat.id);
        return (
          <Link key={cat.id} href={catHref(cat.id)} className={`brain-rail-item${active === cat.id ? " on" : ""}`}>
            <BrainGlyph name={cat.icon} size={14} />
            <span style={{ flex: 1 }}>{cat.short}</span>
            {typeof fill === "number" ? (
              <span className="if-num" style={{ fontSize: 9, fontWeight: 700, color: fill >= 70 ? "var(--if-green-deep)" : fill >= 45 ? "oklch(50% 0.13 75)" : "oklch(50% 0.16 25)" }}>{fill}%</span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

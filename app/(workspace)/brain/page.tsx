"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, loadSession } from "@/lib/api";
import {
  BRAIN_CATS,
  BRAIN_EDGES,
  BRAIN_LAYOUT,
  BrainGlyph,
  BrainRail,
  BrainShell,
  FillRing,
  catHref,
  type BrainModule,
} from "@/lib/brain-ui";

type Overview = {
  score: number;
  modules: BrainModule[];
  updatedAt: string | null;
  next: { id: string; href: string; title: string; why: string }[];
  referenced: { label: string; ctx: string; at: string }[];
};

export default function BrainOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const current = loadSession();
    if (!current) return;
    api<Overview>("/brain", {}, current.token)
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
  }, []);

  const modules = data?.modules ?? [];
  const score = data?.score ?? 0;
  const empty = modules.filter((mod) => mod.fill === 0).length;

  return (
    <BrainShell
      crumbs={["Business Brain"]}
      title="Your Business Brain"
      subtitle="Everything listed here is what you typed or uploaded. Coverage is how much of each section is filled — the AI does not invent a score."
      actions={
        <>
          <Link className="btn secondary" href="/brain/products" style={{ width: "auto", marginTop: 0 }}>Import from CSV</Link>
          <Link className="btn" href={data?.next?.[0]?.href ?? "/brain/narrative"} style={{ width: "auto", marginTop: 0 }}>Add context</Link>
        </>
      }
    >
      {error ? <div className="error" style={{ marginBottom: 12 }}>{error}</div> : null}
      <div className="brain-split">
        <BrainRail active="overview" score={score} modules={modules} />
        <div className="brain-main">
          <div className="brain-hero">
            <div className="brain-hero-grid">
              <div>
                <div className="brain-kicker"><BrainGlyph name="sparkles" size={11} color="var(--if-green)" /> CONTEXT COVERAGE</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                  <div className="brain-score">{score}</div>
                  <div style={{ fontSize: 24, opacity: 0.55 }}>/ 100</div>
                </div>
                <div style={{ fontSize: 14, opacity: 0.85, lineHeight: 1.5, maxWidth: 300 }}>
                  {empty === 0
                    ? "Every section has something in it. Coverage is the average of those 14 fills."
                    : `${empty} section${empty === 1 ? " is" : "s are"} still empty. Filling them is what raises this number.`}
                </div>
                <div className="brain-trend">
                  <BrainGlyph name="refresh" size={16} color="var(--if-green)" />
                  <div style={{ flex: 1, fontSize: 12 }}>
                    <b>{data?.updatedAt ? `Last saved ${new Date(data.updatedAt).toLocaleString("en-IN")}` : "Nothing saved yet"}</b>
                    <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>Coverage updates when you add narrative, products, people, docs, or policies.</div>
                  </div>
                </div>
              </div>
              <Constellation modules={modules} />
            </div>
          </div>

          <div className="brain-two">
            <div className="panel" style={{ padding: 20, margin: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <div className="brain-ico green"><BrainGlyph name="sparkles" size={14} color="var(--if-green-deep)" /></div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>What to add next</div>
              </div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>Empty or thin sections, lowest coverage first. No invented impact scores.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(data?.next ?? []).map((row) => (
                  <div key={row.id} className="brain-next">
                    <div className="brain-ico"><BrainGlyph name={BRAIN_CATS.find((cat) => cat.id === row.id)?.icon ?? "file"} size={14} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{row.title}</div>
                      <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>{row.why}</div>
                    </div>
                    <Link className="btn secondary" href={row.href} style={{ width: "auto", marginTop: 0 }}>Add now</Link>
                  </div>
                ))}
                {data && (data.next?.length ?? 0) === 0 ? <div className="muted">Every tracked section is at least 70% filled.</div> : null}
              </div>
            </div>
            <div className="panel" style={{ padding: 20, margin: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <div className="brain-ico"><BrainGlyph name="sparkles" size={14} /></div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Cited this week</div>
              </div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>From the weekly brief that already ran — not a generated feed.</div>
              {(data?.referenced ?? []).map((row, index) => (
                <div key={`${row.label}-${index}`} className="brain-cite" style={{ borderTop: index ? "1px dashed var(--if-cream-2)" : "none" }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{row.label}</div>
                    <div className="muted" style={{ fontSize: 10, marginTop: 1 }}>{row.ctx}</div>
                  </div>
                  <div className="if-num muted" style={{ fontSize: 10 }}>{new Date(row.at).toLocaleDateString("en-IN")}</div>
                </div>
              ))}
              {data && (data.referenced?.length ?? 0) === 0 ? <div className="muted">The brief has not cited anything this week yet.</div> : null}
            </div>
          </div>

          <div className="panel" style={{ padding: 20, margin: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>All context sources · 14 categories</div>
            <div className="brain-cats">
              {BRAIN_CATS.map((cat) => {
                const mod = modules.find((item) => item.id === cat.id);
                const fill = mod?.fill ?? 0;
                const status = mod?.status ?? "weak";
                return (
                  <Link key={cat.id} href={catHref(cat.id)} className="brain-cat">
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div className={`brain-ico ${status}`}><BrainGlyph name={cat.icon} size={13} /></div>
                      <FillRing pct={fill} size={22} thickness={3} />
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, marginTop: 8 }}>{cat.short}</div>
                    <div className="if-num muted" style={{ fontSize: 10, marginTop: 2 }}>{mod?.items ?? 0}/{mod?.total ?? 0}</div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </BrainShell>
  );
}

function Constellation({ modules }: { modules: BrainModule[] }) {
  const W = 620;
  const H = 420;
  const fill = (id: string) => modules.find((mod) => mod.id === id)?.fill ?? 0;
  return (
    <div className="brain-constellation" style={{ width: W, height: H }}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="core">
            <stop offset="0%" stopColor="var(--if-green)" stopOpacity="0.9" />
            <stop offset="70%" stopColor="var(--if-green)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="var(--if-green)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={W / 2} cy={H / 2} r="80" fill="url(#core)" />
        {BRAIN_EDGES.map(([a, b], i) => {
          const p1 = BRAIN_LAYOUT[a];
          const p2 = BRAIN_LAYOUT[b];
          if (!p1 || !p2) return null;
          return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="2 3" />;
        })}
        {BRAIN_CATS.map((cat) => {
          const p = BRAIN_LAYOUT[cat.id];
          if (!p) return null;
          const good = fill(cat.id) >= 70;
          return <line key={cat.id} x1={W / 2} y1={H / 2} x2={p.x} y2={p.y} stroke={good ? "rgba(61,220,106,0.35)" : "rgba(255,255,255,0.08)"} strokeWidth={good ? 1.5 : 1} />;
        })}
        <circle cx={W / 2} cy={H / 2} r="6" fill="var(--if-green)" />
      </svg>
      {BRAIN_CATS.map((cat) => {
        const p = BRAIN_LAYOUT[cat.id];
        if (!p) return null;
        const pct = fill(cat.id);
        const good = pct >= 70;
        const weak = pct < 45;
        const color = good ? "var(--if-green)" : weak ? "var(--if-coral)" : "var(--if-amber)";
        return (
          <Link key={cat.id} href={catHref(cat.id)} className="brain-node" style={{ left: p.x, top: p.y }}>
            <div style={{ position: "relative" }}>
              <FillRing pct={pct} size={42} thickness={3} color={color} bg="rgba(255,255,255,0.10)" />
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
                <BrainGlyph name={cat.icon} size={16} color={color} />
              </div>
            </div>
            <div className="brain-node-label">{cat.short}</div>
          </Link>
        );
      })}
      <div className="brain-ai-chip">COVERAGE</div>
    </div>
  );
}

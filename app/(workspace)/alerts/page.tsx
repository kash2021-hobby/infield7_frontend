"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Glyph, type AlertGlyphName } from "@/lib/alert-glyphs";
import { api, loadSession, type Session } from "@/lib/api";
import { ReportCrumbs } from "@/lib/reports";

type Rule = {
  id: string;
  name: string;
  kind: string;
  status: string;
  builtin: boolean;
  enabled: boolean;
  site: string | null;
  minutesOver: number | null;
  weekCount: number;
  lastFiredAt: string | null;
  spark: number[];
  category: string;
  summary: string;
};
type Stats = { active: number; firedToday: number; autoResolved: number; needsAttention: number };

const RECIPES: { name: string; cat: string; desc: string; icon: AlertGlyphName; href?: string; held?: string }[] = [
  { name: "Geofence exit", cat: "Location", desc: "Alert when someone leaves their work area", icon: "pin", href: "/alerts/new?kind=geofence_exit" },
  { name: "Panic button", cat: "Safety", desc: "Employee taps SOS on their phone", icon: "alert", href: "/alerts/new?kind=sos" },
  { name: "Idle too long", cat: "Activity", desc: "Employee stationary for > N minutes on shift", icon: "clock", held: "Off this product" },
  { name: "Speeding", cat: "Vehicle", desc: "Field vehicle exceeds speed threshold", icon: "truck", held: "Off this product" },
  { name: "New site check-in", cat: "Attendance", desc: "First check-in at an unrecognized location", icon: "pin", held: "Off this product" },
  { name: "Break overrun", cat: "Attendance", desc: "Break lasts longer than allowed", icon: "clock", held: "Off this product" },
  { name: "Visit skipped", cat: "Tasks", desc: "Visit marked incomplete without a reason", icon: "check", held: "Off this product until visit start times are tracked." },
  { name: "Weekly hours cap", cat: "Attendance", desc: "Employee exceeds weekly hour limit", icon: "chart", held: "Off this product" },
];

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      style={{
        width: 36,
        height: 20,
        borderRadius: 999,
        background: on ? "var(--if-green)" : "var(--if-cream-2)",
        display: "inline-flex",
        alignItems: "center",
        padding: 2,
        border: 0,
        cursor: "pointer",
      }}
    >
      <span style={{
        width: 16,
        height: 16,
        borderRadius: 999,
        background: "white",
        marginLeft: on ? "auto" : 0,
      }} />
    </button>
  );
}

function Spark({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <svg width={56} height={20} viewBox="0 0 56 20" aria-hidden>
      {values.map((value, index) => {
        const h = Math.max(2, (value / max) * 18);
        return <rect key={index} x={index * 8} y={20 - h} width={6} height={h} rx={1} fill="var(--if-green)" opacity={value ? 1 : 0.25} />;
      })}
    </svg>
  );
}

function toneFor(kind: string) {
  if (kind === "sos" || kind === "geofence_exit") return "var(--if-coral)";
  if (kind === "late_checkin" || kind === "task_delay") return "var(--if-amber)";
  return "var(--if-ink-3)";
}

export default function AlertsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [stats, setStats] = useState<Stats>({ active: 0, firedToday: 0, autoResolved: 0, needsAttention: 0 });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [power, setPower] = useState("");
  const [error, setError] = useState("");

  async function refresh(current: Session) {
    const library = await api<{ rules: Rule[]; stats: Stats }>("/alert-rules", {}, current.token);
    setRules(library.rules);
    setStats(library.stats);
  }

  useEffect(() => {
    const current = loadSession();
    if (!current) return;
    setSession(current);
    refresh(current).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
  }, []);

  async function toggle(rule: Rule) {
    if (!session) return;
    const enabled = !(rule.enabled && rule.status === "published");
    setRules((current) => current.map((row) => (row.id === rule.id ? { ...row, enabled } : row)));
    setError("");
    try {
      await api(`/alert-rules/${rule.id}/toggle`, { method: "POST", body: JSON.stringify({ enabled }) }, session.token);
      await refresh(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update");
      await refresh(session);
    }
  }

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rules.filter((rule) => {
      if (q && !`${rule.name} ${rule.summary} ${rule.category}`.toLowerCase().includes(q)) return false;
      if (category && rule.category !== category) return false;
      if (power === "on" && !(rule.enabled && rule.status === "published")) return false;
      if (power === "off" && (rule.enabled && rule.status === "published")) return false;
      if (power === "draft" && rule.status !== "draft") return false;
      return true;
    });
  }, [rules, search, category, power]);

  const kpis: [string, number, string][] = [
    ["Active rules", stats.active, "var(--if-ink)"],
    ["Fired today", stats.firedToday, "var(--if-amber-deep)"],
    ["Auto-resolved", stats.autoResolved, "var(--if-green-deep)"],
    ["Needs attention", stats.needsAttention, "var(--if-coral)"],
  ];

  const cats = ["Attendance", "Location", "Tasks", "Safety"];

  return (
    <div className="emp-page">
      <div className="rpt-head">
        <div>
          <ReportCrumbs items={["Automation", "Alerts"]} />
          <h1 className="page-title" style={{ margin: 0 }}>Alert rules</h1>
        </div>
        <div className="rpt-actions">
          <Link className="btn secondary" href="/alerts/templates" style={{ width: "auto", marginTop: 0 }}>Templates</Link>
          <Link className="btn" href="/alerts/templates" style={{ width: "auto", marginTop: 0 }}>New rule</Link>
        </div>
      </div>
      {error ? <div className="error" style={{ marginBottom: 12 }}>{error}</div> : null}

      <div className="rpt-kpis al-kpis">
        {kpis.map(([label, value, color]) => (
          <div key={label} className="panel" style={{ padding: 16, margin: 0 }}>
            <div className="emp-kpi-label">{label}</div>
            <div className="emp-kpi-value" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="emp-filters" style={{ marginBottom: 12 }}>
        <button type="button" className={`emp-chip${category === "" && power === "" ? " on" : ""}`} onClick={() => { setCategory(""); setPower(""); }}>All {rules.length}</button>
        {cats.map((item) => (
          <button key={item} type="button" className={`emp-chip${category === item ? " on" : ""}`} onClick={() => setCategory(category === item ? "" : item)}>
            {item}
          </button>
        ))}
        {(["on", "off", "draft"] as const).map((item) => (
          <button key={item} type="button" className={`emp-chip${power === item ? " on" : ""}`} onClick={() => setPower(power === item ? "" : item)}>
            {item === "on" ? "On" : item === "off" ? "Off" : "Draft"}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <input
          aria-label="Search rules"
          placeholder="Search rules"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ maxWidth: 220, margin: 0 }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Your rules</div>
        <div style={{ fontSize: 11, color: "var(--if-ink-3)" }}>{shown.length} configured</div>
      </div>
      <div className="panel" style={{ padding: 0, overflow: "hidden", marginBottom: 32 }}>
        <div className="al-row al-head">
          <div /><div>Rule</div><div>Category</div><div>Scope</div><div>Fired 7d</div><div>On/off</div><div />
        </div>
        {shown.map((rule, index) => {
          const href = `/alerts/${rule.id}`;
          const on = rule.enabled && rule.status === "published";
          return (
            <div key={rule.id} className="al-row" style={{ borderTop: index === 0 ? "none" : undefined }}>
              <div><span className="al-dot" style={{ background: toneFor(rule.kind) }} /></div>
              <div>
                <Link href={href} style={{ fontSize: 13, fontWeight: 700 }}>{rule.name}</Link>
                <div style={{ fontSize: 11, color: "var(--if-ink-3)", marginTop: 2 }}>
                  {rule.summary}{rule.status === "draft" ? " · draft" : ""}
                </div>
              </div>
              <div><span className="emp-status off">{rule.category}</span></div>
              <div style={{ color: "var(--if-ink-2)" }}>{rule.site ?? "All sites"}</div>
              <div>
                <div className="if-num" style={{ fontWeight: 700 }}>{rule.weekCount}</div>
                <Spark values={rule.spark.length === 7 ? rule.spark : [0, 0, 0, 0, 0, 0, 0]} />
              </div>
              <div><Toggle on={on} onClick={() => void toggle(rule)} /></div>
              <div style={{ textAlign: "right", color: "var(--if-ink-3)" }}><Link href={href}>›</Link></div>
            </div>
          );
        })}
        {shown.length === 0 ? <div className="emp-empty">No rules match these filters.</div> : null}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Templates — start from a common recipe</div>
        <Link href="/alerts/templates" style={{ fontSize: 11, color: "var(--if-green-deep)", fontWeight: 600 }}>Browse all →</Link>
      </div>
      <div className="al-templates">
        {RECIPES.map((item) => (
          <div key={item.name} className={`panel${item.held ? " al-held" : ""}`} style={{ padding: 16, margin: 0 }}>
            <div className="al-tpl-icon"><Glyph name={item.icon} size={18} color="var(--if-green-deep)" /></div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{item.name}</div>
            <div className="emp-kpi-label" style={{ marginTop: 4 }}>{item.cat}</div>
            <div style={{ fontSize: 11, color: "var(--if-ink-2)", marginTop: 8, lineHeight: 1.5 }}>{item.desc}</div>
            {item.href ? (
              <Link href={item.href} className="btn ghost" style={{ width: "auto", marginTop: 12, padding: 0, color: "var(--if-green-deep)" }}>
                Use template →
              </Link>
            ) : (
              <div className="emp-held" style={{ marginTop: 12 }}>{item.held}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

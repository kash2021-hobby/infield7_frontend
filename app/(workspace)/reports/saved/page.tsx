"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, loadSession } from "@/lib/api";
import { Avatar } from "@/lib/avatar";
import { FormatMark, ReportCrumbs } from "@/lib/reports";
import { NavIcon } from "@/lib/nav-icon";

type Kpi = { label: string; value: string; sub: string; tone: string };
type Item = {
  id: string;
  name: string;
  desc: string;
  freq: string;
  to: string;
  last: string;
  href: string;
  kind: "star" | "schedule";
  owner: string;
  fmt: string;
  history: boolean[];
  status: string;
};

const tone: Record<string, string> = {
  green: "var(--if-green-deep)",
  coral: "var(--if-coral)",
  ink: "var(--if-ink-3)",
};

export default function SavedReportsPage() {
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const current = loadSession();
    if (!current) return;
    api<{ kpis: Kpi[]; items: Item[] }>("/reports/saved", {}, current.token)
      .then((body) => {
        setKpis(body.kpis);
        setItems(body.items);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
  }, []);

  return (
    <div className="rpt-page">
      <div className="rpt-head">
        <div>
          <ReportCrumbs items={["Reporting", "Reports", "Saved"]} />
          <h1 className="page-title" style={{ margin: 0 }}>Saved reports</h1>
        </div>
        <div className="rpt-actions">
          <Link className="btn secondary" href="/reports">Library</Link>
          <Link className="btn" href="/reports/templates">Save a new report</Link>
        </div>
      </div>
      {error ? <div className="error">{error}</div> : null}

      <div className="rpt-kpis four">
        {kpis.map((item) => (
          <div key={item.label} className="panel" style={{ padding: 16 }}>
            <div style={{ fontSize: 10, color: "var(--if-ink-3)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{item.label}</div>
            <div style={{ fontFamily: "var(--if-mono)", fontSize: 24, fontWeight: 700, marginTop: 4 }}>{item.value}</div>
            <div style={{ fontSize: 11, marginTop: 2, fontWeight: 600, color: tone[item.tone] ?? "var(--if-ink-3)" }}>{item.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((row) => (
          <div key={row.id} className="rpt-saved">
            <div style={{ display: "flex", gap: 14, minWidth: 0 }}>
              <div className="rpt-icon plain" style={{ width: 40, height: 40 }}>
                <NavIcon name="file_text" size={18} color="var(--if-ink-2)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{row.name}</div>
                  <FormatMark kind={row.fmt} />
                </div>
                <div style={{ fontSize: 12, color: "var(--if-ink-3)", lineHeight: 1.5, marginBottom: 8 }}>{row.desc}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 11, color: "var(--if-ink-3)" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Avatar name={row.owner} size={18} />
                    {row.owner}
                  </span>
                  <span>·</span>
                  <span style={{ fontFamily: "var(--if-mono)" }}>▸ {row.freq}</span>
                  <span>·</span>
                  <span>{row.to}</span>
                </div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--if-ink-3)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Last 12 runs</div>
              <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 24 }}>
                {row.history.map((hit, index) => (
                  <div key={index} style={{ flex: 1, height: hit ? "100%" : "30%", background: hit ? "var(--if-green)" : "var(--if-coral)", opacity: hit ? 0.7 : 0.45, borderRadius: 2 }} />
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--if-ink-3)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Last run</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className={`rpt-dot-status ${row.status === "active" ? "on" : ""}`} />
                <span style={{ fontSize: 12, fontFamily: "var(--if-mono)" }}>{row.last}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <Link href={row.href} className="rpt-icon-btn" aria-label="Run">
                <NavIcon name="arrow_up_right" size={12} color="var(--if-ink-2)" />
              </Link>
              <Link href={row.href} className="rpt-icon-btn" aria-label="Open report">
                <NavIcon name="chevronRight" size={12} color="var(--if-ink-2)" />
              </Link>
            </div>
          </div>
        ))}
        {items.length === 0 ? (
          <div className="panel" style={{ fontSize: 13, color: "var(--if-ink-3)" }}>
            Star a live template, or set the attendance email under Schedules. Sales saved reports stay off this product.
          </div>
        ) : null}
      </div>
    </div>
  );
}

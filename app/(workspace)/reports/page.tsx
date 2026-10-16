"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, loadSession } from "@/lib/api";
import { Avatar } from "@/lib/avatar";
import { FormatMark, ReportCrumbs, ago } from "@/lib/reports";
import { NavIcon } from "@/lib/nav-icon";

type Canned = {
  id: string;
  cat: string;
  name: string;
  desc: string;
  hot: boolean;
  cols: number;
  available: boolean;
  favorite: boolean;
  uses: number;
  formats: string[];
};
type Recent = { id: string; reportId: string; name: string; format: string; rows: number; size: string; ranAt: string; by: string };
type Saved = { id: string; name: string; freq: string; to: string; last: string; href: string; kind: "star" | "schedule" };
type Library = { canned: Canned[]; recent: Recent[]; saved: Saved[] };

export default function ReportsLibraryPage() {
  const [data, setData] = useState<Library | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const current = loadSession();
    if (!current) return;
    api<Library>("/reports", {}, current.token)
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
  }, []);

  return (
    <div className="rpt-page">
      <div className="rpt-head">
        <div>
          <ReportCrumbs items={["Reporting", "Reports"]} />
          <h1 className="page-title" style={{ margin: 0 }}>Reports</h1>
        </div>
        <div className="rpt-actions">
          <Link className="btn secondary" href="/reports/saved">Saved</Link>
          <Link className="btn secondary" href="/reports/schedule">Schedules</Link>
          <Link className="btn" href="/reports/templates">New report</Link>
        </div>
      </div>
      {error ? <div className="error">{error}</div> : null}

      <div className="rpt-hero">
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Create a new report</div>
          <div style={{ fontSize: 12, color: "var(--if-ink-3)" }}>Pick a template. Describe, upload, and the visual builder stay off this product.</div>
        </div>
        <div className="rpt-start">
          <div className="rpt-big off">
            <span className="rpt-badge off">OFF THIS PRODUCT</span>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div className="rpt-icon">Aa</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Describe what you need</div>
                <div style={{ fontSize: 11, color: "var(--if-ink-3)", marginTop: 2 }}>The six-way AI builder is not in this product.</div>
              </div>
            </div>
            <div style={{ padding: "12px 14px", borderRadius: 12, background: "var(--if-cream)", fontSize: 12, color: "var(--if-ink-3)", fontStyle: "italic", lineHeight: 1.6, marginBottom: 12 }}>
              “Attendance for all Whitefield site employees in September, grouped by week…”
            </div>
            <div style={{ marginTop: "auto", fontSize: 10, color: "var(--if-ink-3)", fontFamily: "var(--if-mono)", letterSpacing: "0.06em" }}>HELD · NO INVENTED COPY</div>
          </div>
          <div className="rpt-tile off">
            <div className="rpt-icon plain">↑</div>
            <div style={{ fontSize: 13, fontWeight: 700, margin: "10px 0 4px" }}>Upload a sample</div>
            <div style={{ fontSize: 11, color: "var(--if-ink-3)", lineHeight: 1.5, flex: 1 }}>Drop an old Excel or PDF. Off this product.</div>
          </div>
          <Link className="rpt-tile" href="/reports/templates" style={{ border: "2px solid var(--if-green)", boxShadow: "0 8px 24px color-mix(in oklch, var(--if-green) 14%, transparent)" }}>
            <div className="rpt-icon">▦</div>
            <div style={{ fontSize: 13, fontWeight: 700, margin: "10px 0 4px" }}>Pick a template</div>
            <div style={{ fontSize: 11, color: "var(--if-ink-3)", lineHeight: 1.5, flex: 1 }}>Pre-built attendance, tasks, visits, and fence exits.</div>
            <div style={{ fontSize: 9, color: "var(--if-ink-3)", fontFamily: "var(--if-mono)", letterSpacing: "0.08em", marginTop: 10, paddingTop: 8, borderTop: "1px dashed var(--if-cream-2)", fontWeight: 700 }}>
              {data ? `${data.canned.filter((row) => row.available).length} TEMPLATES` : "TEMPLATES"}
            </div>
          </Link>
          <div className="rpt-tile off">
            <div className="rpt-icon plain">☰</div>
            <div style={{ fontSize: 13, fontWeight: 700, margin: "10px 0 4px" }}>Build it visually</div>
            <div style={{ fontSize: 11, color: "var(--if-ink-3)", lineHeight: 1.5, flex: 1 }}>Custom metric builder. Off this product.</div>
          </div>
          <div className="rpt-tile off">
            <div className="rpt-icon plain">◷</div>
            <div style={{ fontSize: 13, fontWeight: 700, margin: "10px 0 4px" }}>Schedule via chat</div>
            <div style={{ fontSize: 11, color: "var(--if-ink-3)", lineHeight: 1.5, flex: 1 }}>Chat-driven schedule. Off this product.</div>
            <div style={{ fontSize: 9, color: "var(--if-ink-3)", fontFamily: "var(--if-mono)", letterSpacing: "0.08em", marginTop: 10, paddingTop: 8, borderTop: "1px dashed var(--if-cream-2)", fontWeight: 700 }}>USE SCHEDULES</div>
          </div>
        </div>
      </div>

      <div className="rpt-split">
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Recently generated</div>
            <div style={{ fontSize: 11, color: "var(--if-ink-3)" }}>{data?.recent.length ?? 0} · this company</div>
          </div>
          <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
            <div className="rpt-th" style={{ gridTemplateColumns: "1.6fr 100px 90px 90px 130px 50px" }}>
              <div>Report</div><div>Format</div><div>Rows</div><div>Size</div><div>Ran</div><div />
            </div>
            {(data?.recent ?? []).map((row) => (
              <Link key={row.id} href={`/reports/${row.reportId}`} className="rpt-row" style={{ gridTemplateColumns: "1.6fr 100px 90px 90px 130px 50px", color: "inherit", textDecoration: "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <NavIcon name="file_text" size={14} color="var(--if-ink-3)" />
                  <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</span>
                </div>
                <div><FormatMark kind={row.format} /></div>
                <div style={{ fontFamily: "var(--if-mono)", color: "var(--if-ink-2)" }}>{row.rows.toLocaleString("en-IN")}</div>
                <div style={{ fontFamily: "var(--if-mono)", color: "var(--if-ink-3)" }}>{row.size}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Avatar name={row.by} size={20} />
                  <span style={{ fontSize: 11, color: "var(--if-ink-3)" }}>{ago(row.ranAt)}</span>
                </div>
                <div><NavIcon name="download" size={14} color="var(--if-ink-3)" /></div>
              </Link>
            ))}
            {data && data.recent.length === 0 ? (
              <div style={{ padding: 20, fontSize: 13, color: "var(--if-ink-3)" }}>No reports generated yet. Open a template to run one.</div>
            ) : null}
          </div>
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Saved & scheduled</div>
            <Link href="/reports/saved" style={{ fontSize: 11, color: "var(--if-ink-3)" }}>{data?.saved.length ?? 0} · see all</Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(data?.saved ?? []).map((row) => (
              <Link key={row.id} href={row.href} className="panel" style={{ padding: 14, textDecoration: "none", display: "flex", gap: 10 }}>
                <div className="rpt-icon plain" style={{ width: 32, height: 32 }}>
                  <NavIcon name={row.kind === "schedule" ? "calendar" : "file_text"} size={14} color="var(--if-ink-2)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{row.name}</div>
                  <div style={{ fontSize: 11, color: "var(--if-ink-3)", fontFamily: "var(--if-mono)" }}>▸ {row.freq}</div>
                  <div style={{ fontSize: 11, color: "var(--if-ink-3)", marginTop: 2 }}>{row.to} · {row.last}</div>
                </div>
                <span style={{ color: "var(--if-ink-4)" }}>›</span>
              </Link>
            ))}
            {data && data.saved.length === 0 ? (
              <div className="panel" style={{ fontSize: 13, color: "var(--if-ink-3)" }}>Star a template, or set a weekly attendance email under Schedules.</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

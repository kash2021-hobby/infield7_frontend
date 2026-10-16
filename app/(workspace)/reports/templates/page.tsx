"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, loadSession } from "@/lib/api";
import { CancelLink, ReportCrumbs, ReportRail } from "@/lib/reports";

type Canned = {
  id: string;
  cat: string;
  name: string;
  desc: string;
  hot: boolean;
  cols: number;
  available: boolean;
  uses: number;
  favorite: boolean;
};

const CATS = ["All", "Attendance", "Payroll", "Field sales", "Operations", "HR"];

export default function TemplatesPage() {
  const [canned, setCanned] = useState<Canned[]>([]);
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const current = loadSession();
    if (!current) return;
    api<{ canned: Canned[] }>("/reports", {}, current.token)
      .then((body) => setCanned(body.canned))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
  }, []);

  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    return canned.filter((row) => {
      if (cat !== "All" && row.cat !== cat) return false;
      if (query && !`${row.name} ${row.desc} ${row.cat}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [canned, cat, q]);

  const available = canned.filter((row) => row.available).length;

  return (
    <div className="rpt-page">
      <ReportRail current={0} />
      <div className="rpt-head">
        <div>
          <ReportCrumbs items={["Reporting", "Reports", "New", "Templates"]} />
          <h1 className="page-title" style={{ margin: 0 }}>Report templates</h1>
        </div>
        <CancelLink />
      </div>
      {error ? <div className="error">{error}</div> : null}

      <div className="panel" style={{ marginBottom: 20, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, flex: 1, flexWrap: "wrap" }}>
          {CATS.map((item) => (
            <button
              key={item}
              type="button"
              className={`chip${cat === item ? "" : " ghost"}`}
              onClick={() => setCat(item)}
              style={cat === item ? { background: "var(--if-ink)", color: "var(--if-paper)", borderColor: "var(--if-ink)" } : undefined}
            >
              {item === "All" ? `All ${canned.length || 12}` : item}
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search templates…"
          style={{ maxWidth: 220, margin: 0 }}
        />
      </div>

      <div className="rpt-grid">
        {shown.map((row) => {
          const inner = (
            <>
              {row.hot ? <span className={`rpt-badge ${row.available ? "ok" : "off"}`}>{row.available ? "POPULAR" : "OFF THIS PRODUCT"}</span> : null}
              {!row.hot && !row.available ? <span className="rpt-badge off">OFF THIS PRODUCT</span> : null}
              <div style={{ fontSize: 9, fontWeight: 700, color: "var(--if-ink-3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{row.cat}</div>
              <div style={{ fontSize: 14, fontWeight: 700, paddingRight: 80 }}>{row.name}</div>
              <div style={{ fontSize: 12, color: "var(--if-ink-3)", lineHeight: 1.5 }}>{row.desc}</div>
              <div style={{ display: "flex", gap: 3, marginTop: "auto" }}>
                {Array.from({ length: Math.min(row.cols, 8) }).map((_, index) => (
                  <div key={index} style={{ flex: 1, height: 4, borderRadius: 2, background: index < 3 ? "var(--if-ink-2)" : "var(--if-ink-4)", opacity: index < 3 ? 0.6 : 0.3 }} />
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px dashed var(--if-cream-2)", fontSize: 10, color: "var(--if-ink-3)", fontFamily: "var(--if-mono)", letterSpacing: "0.06em" }}>
                <span>{row.cols} COLS</span>
                <span>{row.available ? (row.favorite ? "★ STARRED" : `${row.uses} USES`) : "HELD"}</span>
              </div>
            </>
          );
          if (!row.available) {
            return <div key={row.id} className="rpt-card off">{inner}</div>;
          }
          return (
            <Link key={row.id} href={`/reports/${row.id}`} className={`rpt-card${row.hot ? " hot" : ""}`}>
              {inner}
            </Link>
          );
        })}
      </div>
      {shown.length === 0 ? <p className="muted">{available ? "No templates in this filter." : "Loading…"}</p> : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, API_URL, loadSession } from "@/lib/api";
import { Avatar } from "@/lib/avatar";
import { ReportCrumbs, ReportRail, StarButton } from "@/lib/reports";

type Cell = { text: string; tone?: "ink" | "green" | "amber" | "coral"; flag?: boolean; avatar?: string };
type Column = { key: string; label: string };
type Kpi = { label: string; value: string; sub: string; tone: "ink" | "green" | "amber" | "coral" };
type Report = {
  id: string;
  name: string;
  cat: string;
  from: string;
  to: string;
  summary: string;
  kpis: Kpi[];
  columns: Column[];
  rows: Record<string, Cell>[];
  csv: string;
  pdf: boolean;
  favorite: boolean;
};

const PAGE = 15;
const tone: Record<string, string> = {
  green: "var(--if-green-deep)",
  amber: "var(--if-amber-deep)",
  coral: "var(--if-coral)",
  ink: "var(--if-ink)",
};

export default function ReportPreviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(start?: string, end?: string) {
    const current = loadSession();
    if (!current) return;
    const query = new URLSearchParams();
    if (start) query.set("from", start);
    if (end) query.set("to", end);
    const suffix = query.toString() ? `?${query}` : "";
    const body = await api<Report>(`/reports/${params.id}${suffix}`, {}, current.token);
    setReport(body);
    setFrom(body.from);
    setTo(body.to);
    setPage(0);
  }

  useEffect(() => {
    load().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "Could not load";
      setError(message);
      if (message.includes("off this product") || message.includes("not found")) {
        router.replace("/reports/templates");
      }
    });
  }, [params.id]);

  const filtered = useMemo(() => {
    if (!report) return [];
    const query = q.trim().toLowerCase();
    if (!query) return report.rows;
    return report.rows.filter((row) => Object.values(row).some((cell) => cell.text.toLowerCase().includes(query)));
  }, [report, q]);

  const slice = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const cols = report?.columns.length ?? 1;

  function downloadCsv() {
    if (!report) return;
    const blob = new Blob([report.csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${report.id}-${report.from}-to-${report.to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function downloadPdf() {
    const current = loadSession();
    if (!current || !report) return;
    setBusy(true);
    setError("");
    try {
      const query = new URLSearchParams({ from: report.from, to: report.to });
      const response = await fetch(`${API_URL}/reports/${report.id}/pdf?${query}`, {
        headers: { authorization: `Bearer ${current.token}` },
      });
      if (!response.ok) throw new Error("Could not make the PDF");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${report.id}-${report.from}-to-${report.to}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not make the PDF");
    } finally {
      setBusy(false);
    }
  }

  async function toggleStar() {
    const current = loadSession();
    if (!current || !report) return;
    setBusy(true);
    try {
      const body = await api<{ favorite: boolean }>(`/reports/${report.id}/favorite`, {
        method: "PATCH",
        body: JSON.stringify({ favorite: !report.favorite }),
      }, current.token);
      setReport({ ...report, favorite: body.favorite });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not star");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rpt-page">
      <ReportRail current={2} />
      <div className="rpt-head">
        <div>
          <ReportCrumbs items={["Reporting", "Reports", report?.name ?? "Report"]} />
          <h1 className="page-title" style={{ margin: 0 }}>{report?.name ?? "Report"}</h1>
        </div>
        <div className="rpt-actions">
          {report ? <StarButton on={report.favorite} onClick={toggleStar} busy={busy} /> : null}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setError("");
              load(from, to).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
            }}
            style={{ display: "flex", gap: 8, alignItems: "center" }}
          >
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} required style={{ margin: 0, width: 148 }} />
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} required style={{ margin: 0, width: 148 }} />
            <button className="btn secondary" type="submit">Regenerate</button>
          </form>
          {report?.id === "monthly-attendance" || report?.id === "daily-attendance" ? <Link className="btn secondary" href="/reports/schedule">Schedule</Link> : null}
          <button className="btn secondary" type="button" onClick={downloadCsv} disabled={!report}>CSV</button>
          <button className="btn" type="button" onClick={downloadPdf} disabled={!report || busy}>
            {busy ? "Making file" : "Export PDF"}
          </button>
        </div>
      </div>
      {error ? <div className="error">{error}</div> : null}

      {report ? (
        <>
          <div className="rpt-summary">
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.6, marginBottom: 10 }}>This period · from live records</div>
            <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.015em", lineHeight: 1.4, maxWidth: 900 }}>{report.summary}</div>
            <div style={{ display: "flex", gap: 20, marginTop: 14, fontSize: 11, fontFamily: "var(--if-mono)", opacity: 0.7 }}>
              <span>▸ {report.rows.length} rows</span>
              <span>▸ {report.rows.filter((row) => Object.values(row).some((cell) => cell.flag)).length} flagged</span>
              <span>▸ {report.from} – {report.to}</span>
            </div>
          </div>

          <div className="rpt-kpis">
            {report.kpis.map((item) => (
              <div key={item.label} className="panel" style={{ padding: 16 }}>
                <div style={{ fontSize: 10, color: "var(--if-ink-3)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{item.label}</div>
                <div style={{ fontFamily: "var(--if-mono)", fontSize: 24, fontWeight: 700, marginTop: 4, letterSpacing: "-0.02em" }}>{item.value}</div>
                <div style={{ fontSize: 11, marginTop: 2, fontWeight: 600, color: tone[item.tone] }}>{item.sub}</div>
              </div>
            ))}
          </div>

          <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--if-cream-2)", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{filtered.length} rows</div>
              <span style={{ fontSize: 11, color: "var(--if-ink-3)" }}>· showing {slice.length}</span>
              <div style={{ flex: 1 }} />
              <input value={q} onChange={(event) => { setQ(event.target.value); setPage(0); }} placeholder="Filter rows…" style={{ margin: 0, maxWidth: 200, padding: "6px 10px" }} />
            </div>
            <div className="rpt-th" style={{ gridTemplateColumns: `1.4fr repeat(${Math.max(cols - 1, 1)}, minmax(70px, 1fr))` }}>
              {report.columns.map((col) => <div key={col.key}>{col.label}</div>)}
            </div>
            {slice.map((row, index) => {
              const flagged = Object.values(row).some((cell) => cell.flag);
              return (
                <div key={index} className={`rpt-row${flagged ? " flag" : ""}`} style={{ gridTemplateColumns: `1.4fr repeat(${Math.max(cols - 1, 1)}, minmax(70px, 1fr))` }}>
                  {report.columns.map((col, colIndex) => {
                    const cell = row[col.key];
                    if (colIndex === 0) {
                      return (
                        <div key={col.key} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                          {flagged ? <div style={{ width: 3, height: 20, background: "var(--if-coral)", borderRadius: 2, flexShrink: 0 }} /> : null}
                          <Avatar name={cell?.avatar ?? cell?.text ?? "?"} size={22} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cell?.text ?? "—"}</span>
                        </div>
                      );
                    }
                    return (
                      <div key={col.key} style={{ fontFamily: "var(--if-mono)", color: tone[cell?.tone ?? "ink"], fontWeight: cell?.flag ? 700 : 400 }}>
                        {cell?.text ?? "—"}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--if-cream-2)", display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--if-ink-3)", background: "var(--if-cream)" }}>
              <span>{Math.min(filtered.length, page * PAGE + 1)}–{Math.min(filtered.length, page * PAGE + PAGE)} of {filtered.length} rows</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" className="btn secondary" style={{ margin: 0, width: "auto", padding: "4px 10px" }} disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</button>
                <button type="button" className="btn secondary" style={{ margin: 0, width: "auto", padding: "4px 10px" }} disabled={(page + 1) * PAGE >= filtered.length} onClick={() => setPage((value) => value + 1)}>Next</button>
              </div>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Happy with this report?</div>
              <div style={{ fontSize: 11, color: "var(--if-ink-3)", marginTop: 2 }}>
                Star it to pin on the library. Attendance can also go out on the weekly email.
              </div>
            </div>
            <div className="rpt-actions">
              <button type="button" className="btn secondary" onClick={downloadCsv}>Download .csv</button>
              <button type="button" className="btn secondary" onClick={downloadPdf} disabled={busy}>Download PDF</button>
              {report.id === "monthly-attendance" || report.id === "daily-attendance" ? <Link className="btn" href="/reports/schedule">Save & schedule</Link> : <button type="button" className="btn" onClick={toggleStar} disabled={busy}>{report.favorite ? "Starred" : "Save to library"}</button>}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

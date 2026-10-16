"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { API_URL, api, loadSession, type Session } from "@/lib/api";
import { Avatar } from "@/lib/avatar";
import { NavIcon } from "@/lib/nav-icon";
import { ReportCrumbs } from "@/lib/reports";

type Progress = {
  person: { userId: string; name: string; phone: string; role: string; status: string | null; department: string | null };
  month: { from: string; to: string };
  attendance: {
    presentDays: number;
    late: number;
    leftEarly: number;
    checkins: number;
    hours: number;
    withoutCheckout: number;
  };
  visits: { day: string; site: string | null; late: boolean; checkedInAt: string; checkedOutAt: string | null; hours: number | null }[];
  tasks: { open: number; done: number; overdue: number; rows: { id: string; title: string; status: string; dueOn: string | null; site: string | null }[] };
  spark: { from: string; to: string; weeks: { start: string; presentDays: number }[] };
};

function shiftMonth(iso: string, delta: number) {
  const [year, month] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  const start = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  const end = `${last.getUTCFullYear()}-${String(last.getUTCMonth() + 1).padStart(2, "0")}-${String(last.getUTCDate()).padStart(2, "0")}`;
  return { from: start, to: end };
}

function telHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits ? `tel:+${digits.length === 10 ? "91" : ""}${digits}` : "";
}

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export default function PersonPage() {
  const params = useParams<{ userId: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [range, setRange] = useState(() => shiftMonth(new Date().toISOString().slice(0, 10), 0));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"visits" | "attendance" | "tasks">("visits");

  async function load(current: Session, from = range.from, to = range.to) {
    const body = await api<Progress>(`/people/${params.userId}?from=${from}&to=${to}`, {}, current.token);
    setProgress(body);
    setRange(body.month);
  }

  useEffect(() => {
    const current = loadSession();
    if (!current) return;
    setSession(current);
    load(current).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
  }, [params.userId]);

  async function moveMonth(delta: number) {
    if (!session || !progress) return;
    const next = shiftMonth(progress.month.from, delta);
    setError("");
    try {
      await load(session, next.from, next.to);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load");
    }
  }

  async function downloadPdf() {
    const current = loadSession();
    if (!current || !progress) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `${API_URL}/people/${params.userId}/progress.pdf?from=${progress.month.from}&to=${progress.month.to}`,
        { headers: { authorization: `Bearer ${current.token}` } },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Could not make the PDF");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `progress-${progress.month.from}-to-${progress.month.to}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not make the PDF");
    } finally {
      setBusy(false);
    }
  }

  const maxSpark = Math.max(1, ...(progress?.spark.weeks.map((week) => week.presentDays) ?? [1]));
  const lastVisit = progress?.visits[0];

  return (
    <div className="emp-page">
      {error ? <div className="error">{error}</div> : null}
      {progress ? (
        <>
          <div className="rpt-head">
            <div>
              <ReportCrumbs items={["Operations", "Targets", progress.person.name]} />
              <div className="profile-head" style={{ marginTop: 8 }}>
                <Avatar name={progress.person.name} size={72} />
                <div>
                  <h1 className="page-title" style={{ margin: 0 }}>{progress.person.name}</h1>
                  <p className="sub" style={{ margin: "6px 0 0" }}>
                    {progress.person.role}
                    {progress.person.department ? ` · ${progress.person.department}` : ""}
                  </p>
                </div>
              </div>
            </div>
            <div className="actions" style={{ flexWrap: "wrap" }}>
              {telHref(progress.person.phone) ? (
                <a className="btn secondary" href={telHref(progress.person.phone)} style={{ width: "auto", marginTop: 0, display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
                  <NavIcon name="phone" size={14} /> Call
                </a>
              ) : null}
              <button type="button" className="btn secondary" style={{ width: "auto" }} onClick={() => void moveMonth(-1)}>Previous month</button>
              <button type="button" className="btn secondary" style={{ width: "auto" }} onClick={() => void moveMonth(1)}>Next month</button>
              <button type="button" className="btn" style={{ width: "auto", marginTop: 0 }} disabled={busy} onClick={() => void downloadPdf()}>{busy ? "Preparing" : "Export"}</button>
            </div>
          </div>
          <div className="emp-filters">
            {(["visits", "attendance", "tasks"] as const).map((id) => (
              <button key={id} type="button" className={`emp-chip${tab === id ? " on" : ""}`} onClick={() => setTab(id)}>
                {id === "visits" ? "Visits" : id === "attendance" ? "Attendance" : "Tasks"}
              </button>
            ))}
            <span className="emp-chip" style={{ opacity: 0.55 }}>Sales — off this product</span>
          </div>

          {tab === "attendance" ? (
            <div className="progress-split">
              <div className="panel" style={{ padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Present days — last 90 days</div>
                  <span className="muted">{progress.month.from} – {progress.month.to}</span>
                </div>
                <div className="spark" style={{ height: 120, marginTop: 18, gap: 8 }}>
                  {progress.spark.weeks.map((week) => (
                    <div key={week.start} className="spark-bar" title={`${week.start}: ${week.presentDays} days`}>
                      <span style={{
                        height: `${(week.presentDays / maxSpark) * 100}%`,
                        background: week.presentDays >= 5 ? "var(--if-green)" : week.presentDays >= 3 ? "var(--if-amber)" : "var(--if-coral)",
                        borderRadius: "6px 6px 2px 2px",
                      }} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="panel" style={{ padding: 16 }}>
                <div className="wizard-rail-label">This month</div>
                {[
                  ["Present days", String(progress.attendance.presentDays)],
                  ["Check-ins", String(progress.attendance.checkins)],
                  ["Hours", String(progress.attendance.hours)],
                  ["Late", String(progress.attendance.late)],
                  ["Last check-in", lastVisit ? clock(lastVisit.checkedInAt) : "—"],
                ].map(([label, value]) => (
                  <div key={label} className="kv">
                    <span style={{ color: "var(--if-ink-3)" }}>{label}</span>
                    <span style={{ fontFamily: "var(--if-mono)", fontWeight: 700 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : tab === "tasks" ? (
            <div className="panel" style={{ padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Tasks — this month</div>
              {[
                ["Open", progress.tasks.open, Math.max(progress.tasks.open + progress.tasks.done, 1), "var(--if-amber)"],
                ["Done", progress.tasks.done, Math.max(progress.tasks.open + progress.tasks.done, 1), "var(--if-green)"],
                ["Overdue", progress.tasks.overdue, Math.max(progress.tasks.open, 1), "var(--if-coral)"],
              ].map(([label, value, total, color]) => (
                <div key={String(label)} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
                    <span style={{ fontFamily: "var(--if-mono)", fontSize: 12, fontWeight: 700 }}>{value}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: "var(--if-cream)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min((Number(value) / Number(total)) * 100, 100)}%`, background: String(color) }} />
                  </div>
                </div>
              ))}
              {progress.tasks.rows.map((task) => (
                <div key={task.id} className="kv">
                  <span style={{ color: "var(--if-ink-3)" }}>{task.title}</span>
                  <span>{task.dueOn ?? task.status.replace("_", " ")}</span>
                </div>
              ))}
              <Link href="/tasks" className="muted" style={{ display: "inline-block", marginTop: 12 }}>Open tasks</Link>
            </div>
          ) : (
            <div className="panel" style={{ padding: 16 }}>
              <div className="wizard-rail-label">Recent visits</div>
              {progress.visits.map((row, index) => (
                <div key={`${row.checkedInAt}-${index}`} style={{ padding: "8px 0", borderTop: index ? "1px dashed var(--if-cream-2)" : undefined }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{row.site ?? "Check-in"}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                    <span className="muted">{row.day}{row.late ? " · late" : ""}</span>
                    <span className="muted" style={{ fontFamily: "var(--if-mono)" }}>{clock(row.checkedInAt)}</span>
                  </div>
                </div>
              ))}
              {progress.visits.length === 0 ? <p className="muted" style={{ marginBottom: 0 }}>No check-ins in this month.</p> : null}
            </div>
          )}
        </>
      ) : <h1 className="page-title">Person</h1>}
    </div>
  );
}

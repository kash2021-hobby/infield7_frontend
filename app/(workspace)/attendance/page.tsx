"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, API_URL, loadSession, type Session } from "@/lib/api";
import { Avatar } from "@/lib/avatar";
import { NavIcon } from "@/lib/nav-icon";
import { ReportCrumbs } from "@/lib/reports";

type Checkin = {
  id: string;
  person: string;
  phone: string;
  site: string | null;
  late: boolean;
  checked_in_at: string;
  checked_out_at: string | null;
  hours: number | null;
};
type ReportRow = { day: string; person: string; phone: string; site: string | null; late: boolean; checkedInAt: string };
type Report = { from: string; to: string; rows: ReportRow[] };
type Employee = { name: string; phone: string; site: string | null; status: string };
type Site = { id: string; name: string };
type Flag = { id: string; label: string };
type Review = { id: string; person: string; phone: string; site: string | null; flags: Flag[]; checkedInAt: string };

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function isDay(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function shiftDay(day: string, days: number) {
  if (!isDay(day)) return "";
  const [year, month, date] = day.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, date + days));
  if (Number.isNaN(next.getTime())) return "";
  return next.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  if (!isDay(from) || !isDay(to) || from > to) return [];
  const list: string[] = [];
  let current = from;
  while (current && current <= to) {
    list.push(current);
    current = shiftDay(current, 1);
  }
  return list;
}

function formatRange(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const month = end.toLocaleDateString("en-IN", { month: "short" });
  return `${start.getDate()} – ${end.getDate()} ${month}`;
}

function telHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits ? `tel:+${digits.length === 10 ? "91" : ""}${digits}` : "";
}

function rate(rows: ReportRow[], roster: number, from: string, to: string) {
  if (!roster || !isDay(from) || !isDay(to)) return 0;
  const span = daysBetween(from, to);
  if (span.length === 0) return 0;
  const present = new Set(rows.map((row) => `${row.day}:${row.phone}`)).size;
  return Math.round((present / (roster * span.length)) * 100);
}

export default function AttendancePage() {
  const dateRef = useRef<HTMLInputElement>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [day, setDay] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [previous, setPrevious] = useState<ReportRow[]>([]);
  const [today, setToday] = useState<Checkin[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [siteFilter, setSiteFilter] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (current: Session, selected: string) => {
    const end = selected;
    const start = shiftDay(end, -6);
    const priorFrom = shiftDay(start, -7);
    const priorTo = shiftDay(end, -7);
    const [report, prior, attendance, people, siteList, pending] = await Promise.all([
      api<Report>(`/reports/attendance?from=${start}&to=${end}`, {}, current.token),
      api<Report>(`/reports/attendance?from=${priorFrom}&to=${priorTo}`, {}, current.token),
      api<{ checkins: Checkin[] }>(`/attendance?date=${end}`, {}, current.token),
      api<{ employees: Employee[] }>("/employees", {}, current.token),
      api<{ sites: Site[] }>("/sites", {}, current.token),
      api<{ checkins: Review[] }>("/check-ins/review?status=pending", {}, current.token).catch(() => ({ checkins: [] as Review[] })),
    ]);
    setFrom(report.from);
    setTo(report.to);
    setRows(report.rows);
    setPrevious(prior.rows);
    setToday(attendance.checkins);
    setEmployees(people.employees.filter((person) => person.status === "active"));
    setSites(siteList.sites);
    setReviews(pending.checkins);
  }, []);

  useEffect(() => {
    const current = loadSession();
    if (!current) return;
    setSession(current);
    const todayKey = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    setDay(todayKey);
  }, []);

  useEffect(() => {
    if (!session || !day) return;
    load(session, day).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
  }, [session, day, load]);

  const roster = employees.length;
  const week = useMemo(() => {
    if (!from || !to) return [];
    return daysBetween(from, to).map((item) => ({
      day: item,
      label: DAY_LETTERS[new Date(`${item}T00:00:00`).getDay()],
      count: new Set(rows.filter((row) => row.day === item).map((row) => row.phone)).size,
    }));
  }, [from, to, rows]);
  const maxBar = Math.max(roster, ...week.map((item) => item.count), 1);
  const weekly = rate(rows, roster, from, to);
  const lastWeek = from && to ? rate(previous, roster, shiftDay(from, -7), shiftDay(to, -7)) : 0;
  const delta = weekly - lastWeek;

  const bySite = sites.map((site) => {
    const assigned = employees.filter((person) => person.site === site.name);
    const total = assigned.length || roster;
    const present = new Set(today.filter((row) => row.site === site.name).map((row) => row.phone)).size;
    return { name: site.name, present, total };
  }).filter((site) => site.total > 0 || today.some((row) => row.site === site.name));

  const filteredToday = siteFilter ? today.filter((row) => row.site === siteFilter) : today;
  const recent = (showAll ? filteredToday : filteredToday.slice(0, 8));

  async function download() {
    if (!session) return;
    const response = await fetch(`${API_URL}/attendance.csv`, { headers: { authorization: `Bearer ${session.token}` } });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "attendance.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function decide(id: string, decision: "approve" | "reject") {
    if (!session) return;
    if (decision === "reject" && !(notes[id] ?? "").trim()) {
      setError("Add a reason before rejecting");
      return;
    }
    setBusy(id);
    setError("");
    setNotice("");
    try {
      await api(`/check-ins/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ decision, note: notes[id] || undefined }),
      }, session.token);
      setNotice(decision === "approve" ? "Attendance updated. This check-in now counts." : "Check-in left out of attendance.");
      await load(session, day);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="emp-page att-page">
      <div className="rpt-head">
        <div>
          <ReportCrumbs items={["Workforce", "Attendance"]} />
          <h1 className="page-title" style={{ margin: 0 }}>Attendance</h1>
          <p className="sub" style={{ margin: "6px 0 0" }}>
            {from && to ? `Week of ${formatRange(from, to)}` : "This week"}
          </p>
        </div>
        <div className="rpt-actions">
          <input
            ref={dateRef}
            type="date"
            value={day}
            onChange={(event) => setDay(event.target.value)}
            aria-label="Pick a day"
            style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
          />
          <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 0 }} onClick={() => dateRef.current?.showPicker?.() ?? dateRef.current?.click()}>
            <NavIcon name="calendar" size={16} color="var(--if-ink)" />
          </button>
          <button type="button" className="btn secondary" style={{ width: "auto", marginTop: 0, display: "inline-flex", alignItems: "center", gap: 8 }} onClick={() => void download()}>
            <NavIcon name="download" size={16} color="var(--if-ink)" /> Export CSV
          </button>
        </div>
      </div>
      {error ? <div className="error">{error}</div> : null}
      {notice ? <div className="devcode">{notice}</div> : null}

      <div className="att-grid">
        <div className="panel att-hero" style={{ margin: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <div className="if-num att-hero-num">{weekly}%</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Weekly attendance</div>
              {from ? (
                <div style={{ fontSize: 11, fontWeight: 600, color: delta >= 0 ? "var(--if-green-deep)" : "var(--if-coral)", marginTop: 2 }}>
                  {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}% vs last week
                </div>
              ) : (
                <div style={{ fontSize: 11, color: "var(--if-ink-3)", marginTop: 2 }}>People who checked in, over roster × days</div>
              )}
            </div>
          </div>
          <div className="att-bars">
            {week.map((item) => (
              <div key={item.day} className="att-bar">
                <div
                  className={`att-bar-fill${item.day === to ? " on" : ""}`}
                  style={{ height: Math.max((item.count / maxBar) * 80, item.count ? 6 : 2) }}
                />
                <div className="if-num" style={{ fontSize: 10, color: "var(--if-ink-3)", fontWeight: 600 }}>{item.label}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "var(--if-ink-3)", marginTop: 12 }}>
            {rows.length} check-ins · {new Set(rows.map((row) => row.phone)).size} people · {rows.filter((row) => row.late).length} late
          </div>
        </div>

        <div className="panel" style={{ padding: 16, margin: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>By site — {day === to ? "today" : day}</div>
          {bySite.length === 0 ? <div style={{ fontSize: 13, color: "var(--if-ink-3)" }}>No sites yet.</div> : null}
          {bySite.map((site) => {
            const pct = site.total ? site.present / site.total : 0;
            const tone = pct > 0.9 ? "var(--if-green)" : pct > 0.7 ? "var(--if-amber)" : "var(--if-coral)";
            return (
              <div key={site.name} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 500 }}>{site.name}</span>
                  <span className="if-num" style={{ color: "var(--if-ink-3)" }}>{site.present}/{site.total}</span>
                </div>
                <div className="att-meter">
                  <span style={{ width: `${Math.round(pct * 100)}%`, background: tone }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={`att-main${reviews.length ? " has-reg" : ""}`}>
        <div>
          <div className="emp-filters" style={{ marginBottom: 12 }}>
            <button type="button" className={`emp-chip${siteFilter === "" ? " on" : ""}`} onClick={() => setSiteFilter("")}>All sites</button>
            {sites.map((site) => (
              <button key={site.id} type="button" className={`emp-chip${siteFilter === site.name ? " on" : ""}`} onClick={() => setSiteFilter(site.name)}>
                {site.name}
              </button>
            ))}
          </div>

          <div className="panel" style={{ padding: 0, margin: 0 }}>
            <div style={{ padding: "14px 16px 8px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Recent check-ins</div>
              {filteredToday.length > 8 ? (
                <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 0, fontSize: 11, color: "var(--if-green-deep)", fontWeight: 600 }} onClick={() => setShowAll((open) => !open)}>
                  {showAll ? "Show less" : "See all"}
                </button>
              ) : (
                <Link href="/review" style={{ fontSize: 11, color: "var(--if-green-deep)", fontWeight: 600 }}>See all</Link>
              )}
            </div>
            {recent.length === 0 ? (
              <div className="emp-empty">Nobody has checked in on this day.</div>
            ) : recent.map((row) => {
              const status = row.late ? "bad" : row.checked_out_at ? "off" : "ok";
              return (
                <div key={row.id} className="att-check">
                  <Avatar name={row.person} size={32} />
                  <div style={{ flex: 1, fontWeight: 500 }}>{row.person}</div>
                  <span className={`emp-status ${status}`}>
                    <span className="emp-dot" />
                    {row.late ? "Late" : row.checked_out_at ? "Done" : "Present"}
                  </span>
                  <span className="if-num" style={{ fontSize: 12, color: "var(--if-ink-3)" }}>{clock(row.checked_in_at)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {reviews.length > 0 ? (
          <div className="panel att-reg-panel">
            <div className="att-reg-head">
              <div style={{ fontSize: 13, fontWeight: 700 }}>Regularization</div>
              <span className="if-num" style={{ fontSize: 11, color: "var(--if-ink-3)" }}>{reviews.length}</span>
            </div>
            <div className="att-reg-list">
              {reviews.map((item) => (
                <div key={item.id} className="att-reg">
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <Avatar name={item.person} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{item.person}</div>
                      <div style={{ fontSize: 11, color: "var(--if-ink-3)", marginTop: 2 }}>
                        {item.site ?? "Unknown site"} · {clock(item.checkedInAt)}
                        {item.flags.length ? ` · ${item.flags.map((flag) => flag.label).join(", ")}` : ""}
                      </div>
                    </div>
                  </div>
                  <input
                    placeholder="Reason (required to reject)"
                    value={notes[item.id] ?? ""}
                    onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                  />
                  <div className="att-reg-actions">
                    <button type="button" className="btn" style={{ width: "auto", marginTop: 0 }} disabled={busy === item.id} onClick={() => void decide(item.id, "approve")}>
                      Approve
                    </button>
                    <button type="button" className="btn secondary" style={{ width: "auto", marginTop: 0 }} disabled={busy === item.id} onClick={() => void decide(item.id, "reject")}>
                      Reject
                    </button>
                    {telHref(item.phone) ? (
                      <a className="btn ghost" href={telHref(item.phone)} style={{ width: "auto", marginTop: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <NavIcon name="phone" size={14} color="var(--if-ink)" /> Call
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

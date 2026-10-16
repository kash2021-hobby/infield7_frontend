"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, loadSession, type Session } from "@/lib/api";
import { Avatar } from "@/lib/avatar";
import { ReportCrumbs } from "@/lib/reports";

type Leave = {
  id: string;
  userId?: string;
  person: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: string;
};

function todayIst() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function formatSpan(start: string, end: string) {
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  if (start === end) return a.toLocaleDateString("en-IN", opts);
  return `${a.toLocaleDateString("en-IN", opts)} – ${b.toLocaleDateString("en-IN", opts)}`;
}

function dayCount(start: string, end: string) {
  const days = Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;
  return Number.isFinite(days) && days > 0 ? days : 1;
}

function statusTone(status: string) {
  if (status === "approved") return "ok";
  if (status === "pending") return "wait";
  return "off";
}

function statusLabel(status: string) {
  if (status === "approved") return "Approved";
  if (status === "pending") return "Pending";
  if (status === "rejected") return "Rejected";
  return status;
}

export default function LeavePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [rows, setRows] = useState<Leave[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const manager = session?.user.role !== "employee";
  const today = todayIst();

  const refresh = useCallback(async (current: Session) => {
    const body = await api<{ requests: Leave[] }>("/leave", {}, current.token);
    setRows(body.requests);
  }, []);

  useEffect(() => {
    const current = loadSession();
    if (!current) return;
    setSession(current);
    refresh(current).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
  }, [refresh]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!session) return;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await api("/leave", { method: "POST", body: JSON.stringify({ startDate, endDate, reason }) }, session.token);
      setReason("");
      setNotice("Request sent. A manager still has to approve it.");
      await refresh(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request leave");
    } finally {
      setBusy(false);
    }
  }

  async function decide(id: string, status: "approved" | "rejected") {
    if (!session) return;
    setError("");
    setNotice("");
    try {
      await api(`/leave/${id}`, { method: "POST", body: JSON.stringify({ status }) }, session.token);
      setNotice(status === "approved" ? "Leave approved. They are off the live roster those days." : "Request rejected.");
      await refresh(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update leave");
    }
  }

  const pending = rows.filter((row) => row.status === "pending").length;
  const approved = rows.filter((row) => row.status === "approved").length;
  const rejected = rows.filter((row) => row.status === "rejected").length;
  const onLeave = useMemo(() => {
    const seen = new Set<string>();
    return rows.filter((row) => {
      if (row.status !== "approved" || row.startDate > today || row.endDate < today) return false;
      const key = row.userId ?? row.person;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [rows, today]);
  const shown = filter ? rows.filter((row) => row.status === filter) : rows;

  const kpis: [string, number, string][] = [
    ["Pending", pending, "var(--if-amber-deep)"],
    ["Approved", approved, "var(--if-green-deep)"],
    ["On leave today", onLeave.length, "var(--if-ink)"],
    ["Rejected", rejected, "var(--if-ink-3)"],
  ];

  return (
    <div className="emp-page">
      <div className="rpt-head">
        <div>
          <ReportCrumbs items={["Workforce", "Leave"]} />
          <h1 className="page-title" style={{ margin: 0 }}>Leave</h1>
          <p className="sub" style={{ margin: "6px 0 0" }}>
            {manager ? "Approve days away, or ask for your own." : "Ask for days away. Nothing counts until a manager approves it."}
          </p>
        </div>
      </div>
      {error ? <div className="error">{error}</div> : null}
      {notice ? <div className="devcode">{notice}</div> : null}

      <div className="rpt-kpis four" style={{ marginBottom: 16 }}>
        {kpis.map(([label, value, color]) => (
          <div key={label} className="panel emp-kpi">
            <div className="emp-kpi-label">{label}</div>
            <div className="emp-kpi-value" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {onLeave.length > 0 ? (
        <div className="panel" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>On leave today</div>
          <div className="dash-leave">
            {onLeave.map((row) => (
              <span key={row.id} className="dash-person">
                <Avatar name={row.person} size={28} /> {row.person}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="panel" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Request leave</div>
        <form onSubmit={submit}>
          <div className="grid">
            <div>
              <label htmlFor="from">From</label>
              <input id="from" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
            </div>
            <div>
              <label htmlFor="to">To</label>
              <input id="to" type="date" min={startDate || undefined} value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
            </div>
          </div>
          <label htmlFor="reason" style={{ marginTop: 12 }}>Reason</label>
          <input id="reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Family visit, medical, …" />
          <button className="btn" style={{ width: "auto", marginTop: 16 }} disabled={busy}>
            {busy ? "Sending" : "Request leave"}
          </button>
        </form>
      </div>

      <div className="emp-filters">
        {(["", "pending", "approved", "rejected"] as const).map((item) => (
          <button
            key={item || "all"}
            type="button"
            className={`emp-chip${filter === item ? " on" : ""}`}
            onClick={() => setFilter(item)}
          >
            {item === "" ? `All ${rows.length}` : `${statusLabel(item)} ${rows.filter((row) => row.status === item).length}`}
          </button>
        ))}
      </div>

      <div className="panel" style={{ padding: 0 }}>
        {shown.length === 0 ? (
          <div className="emp-empty">{rows.length === 0 ? "No leave requests yet." : "No requests match this filter."}</div>
        ) : shown.map((row) => (
          <div key={row.id} className="att-check" style={{ alignItems: "flex-start" }}>
            <Avatar name={row.person} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{row.person}</div>
              <div className="if-num" style={{ fontSize: 12, color: "var(--if-ink-2)", marginTop: 2 }}>
                {formatSpan(row.startDate, row.endDate)} · {dayCount(row.startDate, row.endDate)} {dayCount(row.startDate, row.endDate) === 1 ? "day" : "days"}
              </div>
              <div style={{ fontSize: 12, color: "var(--if-ink-3)", marginTop: 2 }}>{row.reason || "No reason given"}</div>
            </div>
            <span className={`emp-status ${statusTone(row.status)}`}>
              <span className="emp-dot" />
              {statusLabel(row.status)}
            </span>
            {manager && row.status === "pending" ? (
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn" style={{ width: "auto", marginTop: 0 }} onClick={() => void decide(row.id, "approved")}>Approve</button>
                <button type="button" className="btn secondary" style={{ width: "auto", marginTop: 0 }} onClick={() => void decide(row.id, "rejected")}>Reject</button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

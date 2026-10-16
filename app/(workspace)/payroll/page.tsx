"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { API_URL, api, loadSession } from "@/lib/api";
import { Avatar } from "@/lib/avatar";
import { inr } from "@/lib/inr";
import { SalaryTemplatesPanel, type SalaryTemplate } from "@/lib/salary-templates";

type Person = {
  id?: string;
  employeeId: string;
  person: string;
  phone: string;
  templateName: string | null;
  cycle: "daily" | "weekly" | "monthly" | null;
  presentDays: number;
  weekdays: number;
  hours: number;
  net: number;
  gross: number;
  deductions: number;
  missingTemplate: boolean;
  lines: { name: string; kind: string; amount: number }[];
};
type Cycle = {
  id: string;
  status: "draft" | "approved" | "released";
  from: string;
  to: string;
  periodKey: string;
  payout: number;
  employees: number;
  missingTemplates: number;
  byCycle: Record<"daily" | "weekly" | "monthly", { people: number; net: number }>;
  releasedAt: string | null;
};
type History = { id: string; periodKey: string; status: string };
type Payroll = { cycle: Cycle; people: Person[]; history: History[]; stubSms: boolean };

function monthLabel(key: string) {
  return new Date(`${key}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function statusLabel(status: string) {
  if (status === "released") return "Released";
  if (status === "approved") return "Approved";
  return "Draft";
}

export default function PayrollPage() {
  const [data, setData] = useState<Payroll | null>(null);
  const [templates, setTemplates] = useState<SalaryTemplate[]>([]);
  const [period, setPeriod] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [needOtp, setNeedOtp] = useState(false);

  const refresh = useCallback(async (nextPeriod?: string) => {
    const current = loadSession();
    if (!current) return;
    const query = nextPeriod || period;
    const pay = await api<Payroll>(`/payroll${query ? `?period=${query}` : ""}`, {}, current.token);
    setData(pay);
    setPeriod(pay.cycle.periodKey);
    if (current.user.role !== "employee") {
      const temps = await api<{ templates: SalaryTemplate[] }>("/salary-templates", {}, current.token);
      setTemplates(temps.templates);
    }
  }, [period]);

  useEffect(() => {
    refresh().catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
  }, [refresh]);

  async function act(path: string, body?: object) {
    const current = loadSession();
    if (!current || !data) return;
    setBusy(true);
    setError("");
    try {
      const next = await api<Payroll>(path, { method: "POST", body: JSON.stringify(body ?? {}) }, current.token);
      setData(next);
      setPeriod(next.cycle.periodKey);
      if ("devCode" in (next as object)) setDevCode(String((next as { devCode?: string }).devCode ?? ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function sendOtp() {
    const current = loadSession();
    if (!current || !data) return;
    setBusy(true);
    setError("");
    try {
      const otp = await api<{ devCode?: string }>(`/payroll/cycles/${data.cycle.id}/otp`, { method: "POST", body: "{}" }, current.token);
      setNeedOtp(true);
      setDevCode(otp.devCode ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send a code");
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    const current = loadSession();
    if (!current || !period) return;
    const response = await fetch(`${API_URL}/payroll.pdf?period=${period}`, { headers: { authorization: `Bearer ${current.token}` } });
    if (!response.ok) throw new Error("Could not make the PDF");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `payroll-${period}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const session = typeof window === "undefined" ? null : loadSession();
  const employee = session?.user.role === "employee";
  const mine = data?.people[0];
  const cycle = data?.cycle;

  return (
    <div>
      <div className="rpt-head">
        <div>
          <div className="crumbs">Finance / Payroll</div>
          <h1 className="page-title" style={{ margin: 0 }}>{employee ? "My pay" : "Payroll"}</h1>
          <p className="sub" style={{ marginBottom: 0 }}>{cycle ? `${monthLabel(cycle.periodKey)} · ${statusLabel(cycle.status)}` : "This month"}</p>
        </div>
        <div className="rpt-actions">
          <button type="button" className="btn ghost" onClick={() => download().catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not download"))}>Download PDF</button>
        </div>
      </div>
      {error ? <div className="error">{error}</div> : null}

      {cycle ? (
        <div className="panel" style={{ overflow: "hidden", padding: 0, marginBottom: 16 }}>
          <div className="pay-hero">
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.7 }}>
              {cycle.status === "released" ? "Paid" : cycle.status === "approved" ? "Ready to release" : "Payout ready"}
            </div>
            <div className="if-num" style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.03em", marginTop: 4 }}>{inr(employee && mine ? mine.net : cycle.payout)}</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
              {employee && mine ? `${mine.presentDays} days present · ${cycle.from} – ${cycle.to}` : `${cycle.employees} employees · ${cycle.from} – ${cycle.to}`}
            </div>
            {!employee && cycle.missingTemplates ? <div style={{ fontSize: 12, marginTop: 8 }}>{cycle.missingTemplates} people have no template yet — their net is ₹0.</div> : null}
          </div>
          {!employee ? (
          <div style={{ display: "flex", padding: 14, gap: 8, flexWrap: "wrap" }}>
            {cycle.status === "draft" ? (
              <button type="button" className="btn" style={{ width: "auto", margin: 0 }} disabled={busy} onClick={() => void act(`/payroll/cycles/${cycle.id}/approve`)}>Review & approve</button>
            ) : null}
            {cycle.status === "approved" && !needOtp ? (
              <button type="button" className="btn" style={{ width: "auto", margin: 0 }} disabled={busy} onClick={() => void sendOtp()}>Release with OTP</button>
            ) : null}
            {needOtp ? (
              <>
                <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="6-digit code" style={{ width: 140 }} />
                <button type="button" className="btn" style={{ width: "auto", margin: 0 }} disabled={busy} onClick={() => void act(`/payroll/cycles/${cycle.id}/release`, { code })}>Confirm release</button>
                {devCode ? <span className="muted">Dev code {devCode}</span> : null}
              </>
            ) : null}
            <Link href="/setup" className="btn ghost" style={{ width: "auto", margin: 0, textDecoration: "none" }}>Adjust templates</Link>
          </div>
          ) : null}
        </div>
      ) : null}

      {employee && mine ? (
        <div className="panel" style={{ padding: 18, marginBottom: 16 }}>
          {mine.lines.map((line) => (
            <div key={line.name} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px dashed var(--if-cream-2)", fontSize: 13 }}>
              <span>{line.name}</span>
              <span className="if-num" style={{ fontWeight: 600, color: line.kind === "deduction" ? "var(--if-coral)" : undefined }}>
                {line.kind === "deduction" ? "−" : ""}{inr(line.amount)}
              </span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 12, fontWeight: 700 }}>
            <span>Total</span><span className="if-num">{inr(mine.net)}</span>
          </div>
        </div>
      ) : null}

      {!employee ? <div style={{ fontSize: 13, fontWeight: 700, margin: "8px 0" }}>By payment cycle</div> : null}
      {!employee ? <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        {(["daily", "weekly", "monthly"] as const).map((kind) => {
          const row = cycle?.byCycle[kind] ?? { people: 0, net: 0 };
          const tint = kind === "daily" ? "var(--if-amber)" : kind === "weekly" ? "var(--if-green)" : "var(--if-ink)";
          return (
            <div key={kind} className="panel" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, color: "var(--if-ink-3)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{kind}</div>
              <div className="if-num" style={{ fontSize: 18, fontWeight: 700, marginTop: 6, color: tint }}>{inr(row.net)}</div>
              <div style={{ fontSize: 10, color: "var(--if-ink-3)", marginTop: 4 }}>{row.people} people</div>
            </div>
          );
        })}
      </div> : null}

      {!employee ? <div className="panel" style={{ padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--if-ink-3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>How it flows</div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 12 }}>
          {["Attendance", "Work hours", "Salary", "Payout"].map((step, index, arr) => (
            <span key={step} style={{ display: "contents" }}>
              <div style={{
                flex: 1, padding: "10px 8px", borderRadius: 10, textAlign: "center", fontSize: 11, fontWeight: 600,
                background: index === arr.length - 1 ? "var(--if-green)" : "var(--if-cream)",
                color: index === arr.length - 1 ? "var(--if-ink)" : "var(--if-ink-2)",
              }}>{step}</div>
              {index < arr.length - 1 ? <span style={{ color: "var(--if-ink-3)" }}>›</span> : null}
            </span>
          ))}
        </div>
      </div> : null}

      {!employee ? <div className="panel" style={{ padding: 0, marginBottom: 16 }}>
        <div style={{ padding: "14px 16px 8px", fontSize: 13, fontWeight: 700 }}>Upcoming individual payouts</div>
        {(data?.people ?? []).map((person) => (
          <div key={person.employeeId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderTop: "1px solid var(--if-cream-2)" }}>
            <Avatar name={person.person} size={34} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{person.person}</div>
              <div className="if-num" style={{ fontSize: 11, color: "var(--if-ink-3)", marginTop: 2 }}>
                {person.missingTemplate ? "No template" : `${inr(person.net)} · ${person.cycle ?? ""} × ${person.presentDays}d`}
              </div>
            </div>
            <Link href={`/employees/${person.employeeId}/assignment`} style={{ color: "var(--if-ink-3)", textDecoration: "none" }}>›</Link>
          </div>
        ))}
        {data && data.people.length === 0 ? <p className="muted" style={{ padding: 16 }}>Invite people and attach a salary template.</p> : null}
      </div> : null}

      {data?.history.length ? (
        <div className="panel" style={{ padding: 0, marginBottom: 16 }}>
          <div style={{ padding: "14px 16px 8px", fontSize: 13, fontWeight: 700 }}>History</div>
          {data.history.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => { setPeriod(row.periodKey); refresh(row.periodKey).catch(() => undefined); }}
              style={{ display: "flex", width: "100%", background: "transparent", border: 0, borderTop: "1px solid var(--if-cream-2)", padding: "12px 16px", cursor: "pointer", justifyContent: "space-between" }}
            >
              <span>{monthLabel(row.periodKey)}</span>
              <span className="chip">{statusLabel(row.status)}</span>
            </button>
          ))}
        </div>
      ) : null}

      {!employee ? (
        <>
          <h2 style={{ fontSize: 16, margin: "24px 0 8px" }}>Salary templates</h2>
          {loadSession() ? (
            <SalaryTemplatesPanel
              token={loadSession()!.token}
              templates={templates}
              onChange={setTemplates}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, loadSession, type Session } from "@/lib/api";
import { Avatar } from "@/lib/avatar";
import { ReportCrumbs, ReportRail } from "@/lib/reports";
import { NavIcon } from "@/lib/nav-icon";

type Schedule = {
  cadence: "off" | "daily" | "weekly" | "monthly";
  sendHour: number;
  paused: boolean;
  provider: string;
  recipients: { email: string; unsubscribed: boolean }[];
  recent: { email: string; subject: string; status: string; sentAt: string; from: string; to: string }[];
};

function cronLine(cadence: Schedule["cadence"], hour: number) {
  const h = String(hour);
  if (cadence === "daily") return `0 ${h} * * *`;
  if (cadence === "weekly") return `0 ${h} * * 1`;
  if (cadence === "monthly") return `0 ${h} 1 * *`;
  return "—";
}

function nextRuns(cadence: Schedule["cadence"], hour: number, timezone: string) {
  if (cadence === "off") return [] as { day: string; time: string; rel: string }[];
  const clock = `${String(hour).padStart(2, "0")}:00`;
  const out: { day: string; time: string; rel: string }[] = [];
  const now = new Date();
  for (let step = 0; out.length < 3 && step < 90; step += 1) {
    const at = new Date(now.getTime() + step * 86_400_000);
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, weekday: "short", day: "numeric", month: "short", hour: "2-digit", hourCycle: "h23" }).formatToParts(at);
    const weekday = parts.find((p) => p.type === "weekday")?.value;
    const dayNum = Number(parts.find((p) => p.type === "day")?.value);
    const hourNow = Number(parts.find((p) => p.type === "hour")?.value);
    const match =
      cadence === "daily" ? (step === 0 ? hourNow < hour : true)
      : cadence === "weekly" ? weekday === "Mon" && (step > 0 || hourNow < hour)
      : cadence === "monthly" ? dayNum === 1 && (step > 0 || hourNow < hour)
      : false;
    if (!match) continue;
    if (step === 0 && hourNow >= hour) continue;
    out.push({
      day: `${weekday} ${parts.find((p) => p.type === "day")?.value} ${parts.find((p) => p.type === "month")?.value}`,
      time: clock,
      rel: step === 0 ? "today" : step === 1 ? "tomorrow" : `in ${step} days`,
    });
  }
  return out;
}

export default function ReportSchedulePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [cadence, setCadence] = useState<Schedule["cadence"]>("weekly");
  const [sendHour, setSendHour] = useState(8);
  const [emails, setEmails] = useState("");
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const current = loadSession();
    if (!current) return;
    setSession(current);
    api<Schedule>("/reports/email", {}, current.token)
      .then((mail) => {
        setSchedule(mail);
        setCadence(mail.cadence === "off" ? "weekly" : mail.cadence);
        setSendHour(mail.sendHour);
        setPaused(mail.paused);
        setEmails(mail.recipients.map((row) => row.email).join("\n"));
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
  }, []);

  const timezone = session?.workspace.timezone ?? "Asia/Kolkata";
  const upcoming = useMemo(() => nextRuns(paused ? "off" : cadence, sendHour, timezone), [cadence, sendHour, timezone, paused]);
  const recipients = emails.split(/[\n,]+/).map((row) => row.trim()).filter(Boolean);
  const live = recipients.filter((email) => !schedule?.recipients.some((row) => row.email === email && row.unsubscribed));

  async function save(activate: boolean) {
    if (!session) return;
    setBusy(true);
    setError("");
    setNote("");
    try {
      const mail = await api<Schedule>("/reports/email", {
        method: "PUT",
        body: JSON.stringify({
          cadence: activate ? cadence : "off",
          sendHour,
          paused: activate ? paused : false,
          recipients,
        }),
      }, session.token);
      setSchedule(mail);
      setNote(
        mail.cadence === "off"
          ? "Saved. No automatic email until you pick a cadence."
          : `Saved. ${mail.cadence} attendance CSV at ${String(mail.sendHour).padStart(2, "0")}:00 ${timezone}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rpt-page">
      <ReportRail current={3} />
      <div className="rpt-head">
        <div>
          <ReportCrumbs items={["Reporting", "Reports", "Schedule"]} />
          <h1 className="page-title" style={{ margin: 0 }}>Schedule report</h1>
        </div>
        <div className="rpt-actions">
          <Link className="btn ghost" href="/reports">Cancel</Link>
          <button className="btn" type="button" disabled={busy} onClick={() => void save(true)}>Confirm & activate</button>
        </div>
      </div>
      {error ? <div className="error">{error}</div> : null}
      {note ? <p className="muted">{note}</p> : null}

      <div className="rpt-sched">
        <div className="rpt-chat-panel">
          <div className="rpt-chat-head">
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Attendance email</div>
              <div style={{ fontSize: 11, color: "var(--if-ink-3)" }}>Cadence, hour, and recipients. Chat scheduling stays off this product.</div>
            </div>
          </div>
          <form
            className="rpt-chat-body"
            onSubmit={(event) => {
              event.preventDefault();
              void save(true);
            }}
          >
            <p className="sub" style={{ marginTop: 0 }}>
              {schedule?.provider === "stub"
                ? "Emails are written to the server log until SMTP is connected. CSV is attached; each person can stop the list from a link in the mail."
                : "A CSV is attached. Each person can stop the list from a link in the email."}
            </p>
            <div className="grid">
              <div>
                <label htmlFor="cadence">How often</label>
                <select id="cadence" value={cadence} onChange={(event) => setCadence(event.target.value as Schedule["cadence"])}>
                  <option value="daily">Daily (yesterday)</option>
                  <option value="weekly">Weekly (last seven days)</option>
                  <option value="monthly">Monthly (last calendar month)</option>
                </select>
              </div>
              <div>
                <label htmlFor="send-hour">Send at (company time)</label>
                <select id="send-hour" value={sendHour} onChange={(event) => setSendHour(Number(event.target.value))}>
                  {Array.from({ length: 24 }, (_, hour) => (
                    <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>
                  ))}
                </select>
              </div>
            </div>
            <label htmlFor="emails" style={{ marginTop: 12 }}>Recipients</label>
            <textarea id="emails" rows={4} value={emails} onChange={(event) => setEmails(event.target.value)} placeholder={"manager@company.in"} />
            <label style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", fontWeight: 500 }}>
              <input type="checkbox" checked={paused} onChange={(event) => setPaused(event.target.checked)} style={{ width: "auto" }} />
              Pause automatic sends
            </label>
            {schedule && schedule.recipients.some((row) => row.unsubscribed) ? (
              <p className="muted">Stopped: {schedule.recipients.filter((row) => row.unsubscribed).map((row) => row.email).join(", ")}</p>
            ) : null}
            <div className="actions" style={{ marginTop: 16, display: "flex", gap: 8 }}>
              <button className="btn" type="submit" disabled={busy} style={{ width: "auto", marginTop: 0 }}>Save schedule</button>
              <button
                className="btn secondary"
                type="button"
                disabled={busy}
                style={{ width: "auto", marginTop: 0 }}
                onClick={async () => {
                  if (!session) return;
                  setBusy(true);
                  setError("");
                  setNote("");
                  try {
                    await save(true);
                    const sent = await api<{ sent: number; from: string; to: string }>("/reports/email/send", { method: "POST", body: "{}" }, session.token);
                    const mail = await api<Schedule>("/reports/email", {}, session.token);
                    setSchedule(mail);
                    setNote(sent.sent ? `Sent ${sent.sent} email${sent.sent === 1 ? "" : "s"} for ${sent.from} to ${sent.to}.` : "Nobody to send to.");
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Could not send");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Send now
              </button>
            </div>
            {schedule && schedule.recent.length > 0 ? (
              <table style={{ marginTop: 16 }}>
                <thead><tr><th>When</th><th>To</th><th>Report</th><th></th></tr></thead>
                <tbody>
                  {schedule.recent.slice(0, 8).map((row, index) => (
                    <tr key={`${row.sentAt}-${row.email}-${index}`}>
                      <td>{new Date(row.sentAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                      <td>{row.email}</td>
                      <td>{row.from === row.to ? row.from : `${row.from} – ${row.to}`}</td>
                      <td><span className="pill">{row.status === "logged" ? "logged" : row.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </form>
        </div>

        <div className="rpt-plan">
          <div className="panel" style={{ padding: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--if-ink-3)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <NavIcon name="clock" size={12} color="var(--if-ink-3)" />
              Resolved schedule
            </div>
            <div className="rpt-cron">{cronLine(paused ? "off" : cadence, sendHour)}</div>
            <div style={{ fontSize: 10, color: "var(--if-ink-3)", textAlign: "center", marginTop: 6, fontFamily: "var(--if-mono)" }}>
              {paused || cadence === "off" ? "PAUSED" : `CRON · ${timezone}`}
            </div>
          </div>
          <div className="panel" style={{ padding: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--if-ink-3)", marginBottom: 12 }}>Next 3 runs</div>
            {upcoming.length === 0 ? <div style={{ fontSize: 12, color: "var(--if-ink-3)" }}>Off until you activate a cadence.</div> : null}
            {upcoming.map((row, index) => (
              <div key={row.day} className="rpt-next" style={{ borderBottom: index < upcoming.length - 1 ? "1px solid var(--if-cream-2)" : "none" }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{row.day}</div>
                <div style={{ fontFamily: "var(--if-mono)", fontSize: 12, color: "var(--if-ink-2)" }}>{row.time}</div>
                <div style={{ fontSize: 11, color: "var(--if-ink-3)", textAlign: "right" }}>{row.rel}</div>
              </div>
            ))}
          </div>
          <div className="panel" style={{ padding: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--if-ink-3)", marginBottom: 12 }}>{live.length} recipients</div>
            {live.map((email) => (
              <div key={email} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--if-cream-2)" }}>
                <Avatar name={email} size={26} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{email.split("@")[0]}</div>
                  <div style={{ fontSize: 10, color: "var(--if-ink-3)", fontFamily: "var(--if-mono)" }}>{email}</div>
                </div>
              </div>
            ))}
            {live.length === 0 ? <div style={{ fontSize: 12, color: "var(--if-ink-3)" }}>Add emails on the left.</div> : null}
          </div>
          <div className="rpt-activate">
            <div style={{ fontSize: 12, color: "var(--if-ink-2)", lineHeight: 1.55, marginBottom: 10 }}>
              This schedule sends the <b style={{ color: "var(--if-green-deep)" }}>attendance CSV</b> to <b style={{ color: "var(--if-green-deep)" }}>{live.length} {live.length === 1 ? "person" : "people"}</b>. You can pause or edit anytime.
            </div>
            <button className="btn" type="button" disabled={busy} style={{ width: "100%" }} onClick={() => void save(true)}>
              Activate schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

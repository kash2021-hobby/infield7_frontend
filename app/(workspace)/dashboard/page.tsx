"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, loadSession, type Session } from "@/lib/api";
import { Avatar } from "@/lib/avatar";
import { NavIcon } from "@/lib/nav-icon";

type Location = "inside" | "leaving" | "away" | "no_signal";
type Board = {
  day: string;
  counts: { onDuty: number; notIn: number; done: number; onLeave: number };
  onDuty: { checkinId: string; userId: string; person: string; site: string | null; since: string; location: Location; lastSeenAt: string | null }[];
  notIn: { userId: string; person: string; shiftStart: string | null; late: boolean }[];
  done: { userId: string; person: string; site: string | null; checkedOutAt: string | null; checkoutKind: string | null; hoursToday: number }[];
  onLeave: { userId: string; person: string }[];
};
type PresencePerson = { userId: string; person: string; site: string | null };
type Checkin = { person: string; phone: string; site: string | null; late: boolean };
type Site = { id: string; name: string; kind?: string };
type Employee = { userId: string | null; status: string };
type Alert = { id: string; message: string; status: string; person: string | null; createdAt: string };
type Task = { status: string };

const locationLabel: Record<Location, string> = {
  inside: "At site",
  leaving: "Leaving",
  away: "Left the site",
  no_signal: "No signal",
};

const REFRESH_MS = 60_000;

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function ago(iso: string | null) {
  if (!iso) return "never";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)} h ago`;
}

function localInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function Head({ cols, variant }: { cols: string[]; variant?: "three" | "four" }) {
  return (
    <div className={`dash-row dash-head${variant ? ` ${variant}` : ""}`}>
      {cols.map((col) => <span key={col}>{col}</span>)}
    </div>
  );
}

export default function DashboardPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [onSite, setOnSite] = useState(0);
  const [field, setField] = useState(0);
  const [offline, setOffline] = useState(0);
  const [openAlerts, setOpenAlerts] = useState(0);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [present, setPresent] = useState(0);
  const [late, setLate] = useState(0);
  const [absent, setAbsent] = useState(0);
  const [openTasks, setOpenTasks] = useState(0);
  const [sites, setSites] = useState<{ id: string; name: string; kind: string; people: number; late: number }[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [closing, setClosing] = useState<string | null>(null);
  const [closeAt, setCloseAt] = useState("");

  const load = useCallback(async () => {
    const current = loadSession();
    if (!current) return;
    setSession(current);
    const [duty, presence, attendance, alertBody, roster, siteList, taskBody] = await Promise.all([
      api<Board>("/on-duty", {}, current.token),
      api<{ people: PresencePerson[] }>("/presence", {}, current.token),
      api<{ checkins: Checkin[] }>("/attendance", {}, current.token),
      api<{ alerts: Alert[] }>("/alerts", {}, current.token),
      api<{ employees: Employee[] }>("/employees", {}, current.token),
      api<{ sites: Site[] }>("/sites", {}, current.token),
      api<{ tasks: Task[] }>("/tasks", {}, current.token),
    ]);
    setBoard(duty);
    const seen = new Set(presence.people.map((person) => person.userId));
    const active = roster.employees.filter((person) => person.status === "active" && person.userId);
    setOnSite(presence.people.filter((person) => person.site).length);
    setField(presence.people.filter((person) => !person.site).length);
    setOffline(active.filter((person) => person.userId && !seen.has(person.userId)).length);
    const open = alertBody.alerts.filter((row) => row.status === "open" || row.status === "escalated");
    setOpenAlerts(open.length);
    setAlerts(open.slice(0, 3));
    const checkedIn = new Set(attendance.checkins.map((row) => row.phone));
    const latePhones = new Set(attendance.checkins.filter((row) => row.late).map((row) => row.phone));
    setPresent(Math.max(checkedIn.size - latePhones.size, 0));
    setLate(latePhones.size);
    setAbsent(Math.max(active.length - checkedIn.size, 0));
    setOpenTasks(taskBody.tasks.filter((task) => task.status !== "done").length);
    setSites(siteList.sites.map((site) => ({
      id: site.id,
      name: site.name,
      kind: site.kind || "Site",
      people: presence.people.filter((person) => person.site === site.name).length,
      late: attendance.checkins.filter((row) => row.late && row.site === site.name).length,
    })));
    setUpdatedAt(new Date());
    setError("");
  }, []);

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
    const timer = setInterval(() => {
      load().catch(() => undefined);
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  async function checkOut(checkinId: string) {
    const current = loadSession();
    if (!current) return;
    setError("");
    setMessage("");
    try {
      const at = closeAt ? new Date(closeAt).toISOString() : new Date().toISOString();
      await api(`/check-ins/${checkinId}/check-out`, { method: "POST", body: JSON.stringify({ at }) }, current.token);
      setMessage(`Checked out at ${clock(at)}. They were told on their phone.`);
      setClosing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check out");
    }
  }

  const total = present + late + absent;
  const siteCount = sites.length;
  const name = session?.workspace.name || "InField 7";

  return (
    <div className="dash">
      <h1 className="page-title">Dashboard</h1>
      <p className="sub">{name} · {siteCount} site{siteCount === 1 ? "" : "s"}</p>
      {error ? <div className="error">{error}</div> : null}
      {message ? <div className="devcode">{message}</div> : null}

      <div className="panel dash-hero">
        <div className="dash-hero-live">
          <div className="dash-live-label">
            <span className="dash-live-dot" />
            Live{updatedAt ? ` · updated ${ago(updatedAt.toISOString())}` : ""}
          </div>
          <div className="dash-kpis">
            <div>
              <div className="dash-kpi-n" style={{ color: "var(--if-green)" }}>{onSite}</div>
              <div className="dash-kpi-l">On-site</div>
            </div>
            <div>
              <div className="dash-kpi-n" style={{ color: "var(--if-amber)" }}>{field}</div>
              <div className="dash-kpi-l">Field</div>
            </div>
            <div>
              <div className="dash-kpi-n" style={{ color: "oklch(70% 0.02 260)" }}>{offline}</div>
              <div className="dash-kpi-l">Offline</div>
            </div>
          </div>
        </div>
        <div className="dash-hero-foot">
          <Link href="/alerts" className="chip" style={{ background: "var(--if-coral-soft)", color: "var(--if-coral)", borderColor: "transparent" }}>
            {openAlerts} alert{openAlerts === 1 ? "" : "s"}
          </Link>
          <Link href="/attendance" className="chip" style={{ background: "var(--if-amber-soft)", color: "var(--if-amber-deep)", borderColor: "transparent" }}>
            {late} late
          </Link>
          <Link href="/tasks" className="chip">
            {openTasks} open task{openTasks === 1 ? "" : "s"}
          </Link>
          <div style={{ flex: 1 }} />
          <Link href="/map" className="muted" style={{ fontWeight: 600, fontSize: 12, textDecoration: "none" }}>Live map →</Link>
        </div>
      </div>

      <div className="panel">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Attendance today</div>
          <div className="muted" style={{ fontSize: 11 }}>{present + late} checked in · {total} expected</div>
        </div>
        <div className="dash-bar">
          <span style={{ flex: present || 0, background: "var(--if-green)" }} />
          <span style={{ flex: late || 0, background: "var(--if-amber)" }} />
          <span style={{ flex: absent || (total ? 0 : 1), background: "var(--if-ink-4)" }} />
        </div>
        <div className="dash-legend">
          <span><i style={{ background: "var(--if-green)" }} /> Present <em>{present}</em></span>
          <span><i style={{ background: "var(--if-amber)" }} /> Late <em>{late}</em></span>
          <span><i style={{ background: "var(--if-ink-4)" }} /> Absent <em>{absent}</em></span>
        </div>
      </div>

      {alerts.length > 0 ? (
        <div className="panel">
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Today&apos;s alerts</div>
            <Link href="/alerts" style={{ fontSize: 11, color: "var(--if-green-deep)", fontWeight: 600, textDecoration: "none" }}>See all →</Link>
          </div>
          {alerts.map((row) => (
            <Link key={row.id} href="/alerts" className="dash-alert">
              <strong>{row.message}</strong>
              <span className="muted">{row.person ? `${row.person} · ` : ""}{ago(row.createdAt)}</span>
            </Link>
          ))}
        </div>
      ) : null}

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "8px 0 10px" }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Sites & teams</div>
        <Link href="/sites" style={{ fontSize: 11, color: "var(--if-green-deep)", fontWeight: 600, textDecoration: "none" }}>See all →</Link>
      </div>
      <div className="dash-sites">
        {sites.length === 0 ? <div className="panel muted">No sites yet. Add one under Geofences.</div> : null}
        {sites.map((site) => (
          <Link key={site.id} href="/sites" className="panel dash-site">
            <div className="site-pin"><NavIcon name="pin" size={18} color="var(--if-green-deep)" /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{site.name}</div>
              <div className="muted" style={{ fontSize: 11, marginTop: 1 }}>{site.kind}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--if-mono)" }}>{site.people}</div>
              {site.late > 0 ? <div style={{ fontSize: 10, color: "var(--if-coral)", fontWeight: 600 }}>{site.late} late</div> : null}
            </div>
          </Link>
        ))}
      </div>

      <h2 className="dash-section">On duty now</h2>
      <p className="sub">
        {board
          ? `${board.counts.onDuty} on duty · ${board.counts.notIn} not in yet · ${board.counts.done} finished · ${board.counts.onLeave} on leave. Updates every minute.`
          : "Loading today."}
      </p>

      <div className="panel dash-board">
        <div className="dash-board-title">On duty</div>
        <Head cols={["Person", "Site", "Since", "Where", "Last seen", ""]} />
        {board?.onDuty.map((row) => (
          <div key={row.checkinId} className="dash-row">
            <span className="dash-person"><Avatar name={row.person} size={28} /> {row.person}</span>
            <span>{row.site ?? "—"}</span>
            <span className="if-num">{clock(row.since)}</span>
            <span><span className={`pill loc-${row.location}`}>{locationLabel[row.location]}</span></span>
            <span className="muted">{ago(row.lastSeenAt)}</span>
            <span>
              {closing === row.checkinId ? (
                <span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    type="datetime-local"
                    value={closeAt}
                    min={localInput(new Date(row.since))}
                    max={localInput(new Date())}
                    onChange={(event) => setCloseAt(event.target.value)}
                    aria-label="Check-out time"
                  />
                  <button className="btn" style={{ width: "auto", marginTop: 0 }} onClick={() => void checkOut(row.checkinId)}>Check out</button>
                  <button className="btn secondary" style={{ width: "auto", marginTop: 0 }} onClick={() => setClosing(null)}>Cancel</button>
                </span>
              ) : (
                <button
                  className="btn ghost"
                  style={{ width: "auto", marginTop: 0 }}
                  onClick={() => { setClosing(row.checkinId); setCloseAt(localInput(new Date())); }}
                >
                  Check out for them
                </button>
              )}
            </span>
          </div>
        ))}
        {board && board.onDuty.length === 0 ? <div className="dash-empty">Nobody is checked in right now.</div> : null}
      </div>

      <div className="panel dash-board">
        <div className="dash-board-title">Not in yet</div>
        <Head cols={["Person", "Shift starts", ""]} variant="three" />
        {board?.notIn.map((row) => (
          <div key={row.userId} className="dash-row three">
            <span className="dash-person"><Avatar name={row.person} size={28} /> {row.person}</span>
            <span>{row.shiftStart ?? "No shift set"}</span>
            <span>{row.late ? <span className="pill warn">late</span> : null}</span>
          </div>
        ))}
        {board && board.notIn.length === 0 ? <div className="dash-empty">Everyone expected is in.</div> : null}
      </div>

      <div className="panel dash-board">
        <div className="dash-board-title">Finished today</div>
        <Head cols={["Person", "Site", "Out", "Hours today"]} variant="four" />
        {board?.done.map((row) => (
          <div key={row.userId} className="dash-row four">
            <span className="dash-person"><Avatar name={row.person} size={28} /> {row.person}</span>
            <span>{row.site ?? "—"}</span>
            <span>
              {row.checkedOutAt ? clock(row.checkedOutAt) : "No check-out"}
              {row.checkoutKind === "manager" ? " · by a manager" : ""}
            </span>
            <span className="if-num">{row.hoursToday.toFixed(2)}</span>
          </div>
        ))}
        {board && board.done.length === 0 ? <div className="dash-empty">Nobody has checked out yet.</div> : null}
      </div>

      {board && board.onLeave.length > 0 ? (
        <div className="panel">
          <div className="dash-board-title">On leave</div>
          <div className="dash-leave">
            {board.onLeave.map((row) => (
              <span key={row.userId} className="dash-person"><Avatar name={row.person} size={28} /> {row.person}</span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

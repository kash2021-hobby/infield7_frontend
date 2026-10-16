"use client";

import { useCallback, useEffect, useState } from "react";
import { api, loadSession, type Session } from "@/lib/api";
import { Avatar } from "@/lib/avatar";
import { NavIcon } from "@/lib/nav-icon";
import { ReportCrumbs } from "@/lib/reports";

type Shift = { id: string; name: string; startTime: string; endTime: string; isDefault: boolean; graceMin?: number; people?: number };
type Person = { userId: string; name: string; role: string };
type Assignment = { id: string; userId: string; shiftId: string; day: string };
type Roster = { from: string; to: string; today: string; shifts: Shift[]; people: Person[]; assignments: Assignment[] };
type Side = { userId: string; name: string; day: string | null; shift: string | null };
type Swap = {
  id: string;
  kind: "swap" | "cover";
  status: string;
  note: string | null;
  decisionNote: string | null;
  createdAt: string;
  requester: Side;
  target: Side;
};
type Site = { id: string; name: string };

const SHIFT_COLORS = ["var(--if-green)", "var(--if-ink)", "var(--if-amber)", "oklch(52% 0.08 260)"];
const SUGGESTED_SHIFTS = [
  { name: "Morning", startTime: "06:00", endTime: "14:00", graceMin: 10 },
  { name: "General", startTime: "09:00", endTime: "18:00", graceMin: 10 },
  { name: "Evening", startTime: "14:00", endTime: "22:00", graceMin: 10 },
  { name: "Night", startTime: "22:00", endTime: "06:00", graceMin: 10 },
];

const statusText: Record<string, string> = {
  waiting_colleague: "Waiting for colleague",
  waiting_manager: "Waiting for you",
  approved: "Approved",
  declined: "Colleague declined",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function mondayOf(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return addDays(iso, -((weekday + 6) % 7));
}

function dayLabel(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

function dayHead(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", timeZone: "UTC" });
}

function hoursOf(hhmm: string) {
  const [hour, minute] = hhmm.split(":").map(Number);
  return hour + minute / 60;
}

function weekOff(week: string, index: number) {
  if (week === "mon-fri") return index >= 5;
  if (week === "mon-sat") return index >= 6;
  return false;
}

function describe(side: Side) {
  return side.day ? `${side.shift ?? "shift"} on ${dayLabel(side.day)}` : "their shift";
}

function chipColor(shifts: Shift[], shift: Shift | undefined) {
  if (!shift) return undefined;
  return SHIFT_COLORS[shifts.findIndex((row) => row.id === shift.id) % SHIFT_COLORS.length];
}

export default function RosterPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [week, setWeek] = useState<string | null>(null);
  const [roster, setRoster] = useState<Roster | null>(null);
  const [swaps, setSwaps] = useState<Swap[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [name, setName] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  const [graceMin, setGraceMin] = useState(10);
  const [rotation, setRotation] = useState<"none" | "weekly" | "fortnightly">("weekly");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const workingWeek = session?.workspace.workingWeek || "mon-sat";
  const canWrite = session?.user.role === "admin" || session?.user.role === "manager";

  const refresh = useCallback(async (current: Session, from: string | null) => {
    if (!from) {
      const today = await api<Roster>("/roster", {}, current.token);
      setWeek(mondayOf(today.today));
      return;
    }
    const [body, swapBody, siteList] = await Promise.all([
      api<Roster>(`/roster?from=${from}&to=${addDays(from, 6)}`, {}, current.token),
      api<{ swaps: Swap[] }>("/shift-swaps", {}, current.token),
      api<{ sites: Site[] }>("/sites", {}, current.token).catch(() => ({ sites: [] as Site[] })),
    ]);
    setRoster(body);
    setSwaps(swapBody.swaps);
    setSites(siteList.sites);
  }, []);

  useEffect(() => {
    const current = loadSession();
    if (!current) return;
    setSession(current);
    refresh(current, week).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
  }, [refresh, week]);

  async function run(action: () => Promise<unknown>, done?: string) {
    if (!session) return;
    setError("");
    setNotice("");
    try {
      await action();
      if (done) setNotice(done);
      await refresh(session, week);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  function assign(userId: string, day: string, shiftId: string) {
    if (!session) return;
    void run(() => api("/roster", { method: "PUT", body: JSON.stringify({ userId, day, shiftId: shiftId || null }) }, session.token));
  }

  function cycle(userId: string, day: string) {
    if (!roster || !canWrite || day < roster.today) return;
    const ids = ["", ...roster.shifts.map((shift) => shift.id)];
    const current = cell(userId, day)?.shiftId ?? "";
    const next = ids[(Math.max(ids.indexOf(current), 0) + 1) % ids.length];
    assign(userId, day, next);
  }

  function addShift(input: { name: string; startTime: string; endTime: string; graceMin: number }) {
    if (!session) return;
    void run(async () => {
      await api("/shifts", { method: "POST", body: JSON.stringify(input) }, session.token);
      setName("");
    }, `${input.name} saved`);
  }

  function decide(id: string, approve: boolean) {
    if (!session) return;
    void run(
      () => api(`/shift-swaps/${id}/decide`, { method: "POST", body: JSON.stringify({ approve }) }, session.token),
      approve ? "Roster updated." : "Request rejected.",
    );
  }

  function applyRotation() {
    if (!session || !week || rotation === "none") return;
    const destFrom = addDays(week, rotation === "weekly" ? 7 : 14);
    void run(
      () => api("/roster/copy-week", { method: "POST", body: JSON.stringify({ from: week, destFrom }) }, session.token),
      rotation === "weekly" ? "Copied onto next week." : "Copied onto the week after next.",
    );
  }

  const days = week ? Array.from({ length: 7 }, (_, index) => addDays(week, index)) : [];
  const cell = (userId: string, day: string) => roster?.assignments.find((item) => item.userId === userId && item.day === day);
  const waiting = swaps.filter((swap) => swap.status === "waiting_manager");
  const others = swaps.filter((swap) => swap.status !== "waiting_manager");
  const shifts = roster?.shifts ?? [];

  return (
    <div className="emp-page">
      <div className="rpt-head">
        <div>
          <ReportCrumbs items={["Workforce", "Shifts"]} />
          <h1 className="page-title" style={{ margin: 0 }}>Shifts & rosters</h1>
          <p className="sub" style={{ margin: "6px 0 0" }}>
            Named windows, grace, and the week people work. Overtime pay stays off this product.
          </p>
        </div>
      </div>
      {error ? <div className="error">{error}</div> : null}
      {notice ? <div className="devcode">{notice}</div> : null}

      {waiting.length > 0 ? (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Swaps waiting for you</div>
          {waiting.map((swap) => (
            <div key={swap.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--if-cream-2)" }}>
              <Avatar name={swap.requester.name} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {swap.kind === "cover"
                    ? `${swap.target.name} covers ${swap.requester.name}'s ${describe(swap.requester)}`
                    : `${swap.requester.name} (${describe(swap.requester)}) swaps with ${swap.target.name} (${describe(swap.target)})`}
                </div>
                {swap.note ? <div style={{ fontSize: 12, color: "var(--if-ink-3)", marginTop: 2 }}>“{swap.note}”</div> : null}
              </div>
              <button type="button" className="btn" style={{ width: "auto", marginTop: 0 }} onClick={() => decide(swap.id, true)}>Approve</button>
              <button type="button" className="btn secondary" style={{ width: "auto", marginTop: 0 }} onClick={() => decide(swap.id, false)}>Reject</button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="panel" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>24-hour timeline</div>
          <div style={{ fontSize: 11, color: "var(--if-ink-3)" }}>Overlap allowed · shifts wrap past midnight</div>
        </div>
        <div className="shift-ruler">
          {Array.from({ length: 24 }, (_, hour) => (
            <div key={hour} className="if-num" style={{ fontSize: 10, color: "var(--if-ink-3)", textAlign: "center", borderLeft: hour % 6 === 0 ? "1px solid var(--if-cream-2)" : "none", paddingBottom: 4 }}>
              {hour % 6 === 0 ? String(hour).padStart(2, "0") : ""}
            </div>
          ))}
        </div>
        {shifts.map((row, index) => {
          const startH = hoursOf(row.startTime);
          let endH = hoursOf(row.endTime);
          if (endH <= startH) endH += 24;
          const color = SHIFT_COLORS[index % SHIFT_COLORS.length];
          const firstEnd = Math.min(endH, 24);
          return (
            <div key={row.id} className="shift-track">
              <div style={{ paddingRight: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{row.name}{row.isDefault ? " · default" : ""}</div>
                <div className="if-num" style={{ fontSize: 10, color: "var(--if-ink-3)" }}>{row.startTime} – {row.endTime}</div>
                <div style={{ fontSize: 10, color: "var(--if-ink-3)" }}>{row.graceMin ?? 15} min grace</div>
              </div>
              <div className="shift-lane">
                <div className="shift-block" style={{ left: `${(startH / 24) * 100}%`, width: `${((firstEnd - startH) / 24) * 100}%`, background: color }}>
                  {row.people ?? 0} people
                </div>
                {endH > 24 ? (
                  <div className="shift-block" style={{ left: 0, width: `${((endH - 24) / 24) * 100}%`, background: color, opacity: 0.7 }} />
                ) : null}
              </div>
            </div>
          );
        })}
        {shifts.length === 0 ? <p className="muted">No shifts yet. Add a named window below.</p> : null}

        {canWrite ? (
          <form
            className="actions"
            style={{ marginTop: 16, flexWrap: "wrap", alignItems: "end" }}
            onSubmit={(event) => {
              event.preventDefault();
              addShift({ name, startTime: start.slice(0, 5), endTime: end.slice(0, 5), graceMin });
            }}
          >
            <div>
              <label htmlFor="shift-name">Name</label>
              <input id="shift-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="General" required />
            </div>
            <div>
              <label htmlFor="shift-start">Start</label>
              <input id="shift-start" type="time" value={start} onChange={(event) => setStart(event.target.value)} required />
            </div>
            <div>
              <label htmlFor="shift-end">End</label>
              <input id="shift-end" type="time" value={end} onChange={(event) => setEnd(event.target.value)} required />
            </div>
            <div>
              <label htmlFor="grace">Grace (min)</label>
              <input id="grace" type="number" min={0} max={120} value={graceMin} onChange={(event) => setGraceMin(Number(event.target.value))} />
            </div>
            <button className="btn" type="submit" disabled={!name.trim()} style={{ width: "auto", marginTop: 0 }}>Add shift</button>
          </form>
        ) : null}
        {canWrite ? (
          <div className="actions" style={{ flexWrap: "wrap", marginTop: 12 }}>
            {SUGGESTED_SHIFTS.filter((item) => !shifts.some((row) => row.name.toLowerCase() === item.name.toLowerCase())).map((item) => (
              <button key={item.name} type="button" className="btn secondary" style={{ width: "auto", marginTop: 0 }} onClick={() => addShift(item)}>
                {item.name} {item.startTime}–{item.endTime}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="panel" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Overtime</div>
        <div className="emp-held-box" style={{ gridColumn: "auto", marginBottom: 12 }}>Off this product — overtime pay is not in this build. Grace still flags late check-ins.</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label>Daily after (hours)</label>
            <input disabled placeholder="Off this product" />
          </div>
          <div>
            <label>Weekly after (hours)</label>
            <input disabled placeholder="Off this product" />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Weekly roster{sites[0] ? ` — ${sites[0].name}` : ""}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {(["none", "weekly", "fortnightly"] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={`emp-chip${rotation === item ? " on" : ""}`}
              onClick={() => setRotation(item)}
            >
              {item === "none" ? "No rotation" : item === "weekly" ? "Weekly" : "Fortnightly"}
            </button>
          ))}
          {canWrite && rotation !== "none" ? (
            <button type="button" className="btn secondary" style={{ width: "auto", marginTop: 0 }} disabled={!week} onClick={applyRotation}>
              Apply to {rotation === "weekly" ? "next week" : "week +2"}
            </button>
          ) : null}
          <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 0, display: "inline-flex", alignItems: "center", gap: 6 }} disabled={!week} onClick={() => week && setWeek(addDays(week, -7))}>
            ←
          </button>
          <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 0, display: "inline-flex", alignItems: "center", gap: 6 }} disabled={!week}>
            <NavIcon name="calendar" size={14} color="var(--if-ink)" /> {week ? `${dayHead(week)} – ${dayHead(addDays(week, 6))}` : "Change week"}
          </button>
          <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 0 }} disabled={!week} onClick={() => week && setWeek(addDays(week, 7))}>
            →
          </button>
        </div>
      </div>

      <div className="panel" style={{ padding: 0, overflowX: "auto", marginBottom: 16 }}>
        {roster && roster.shifts.length === 0 ? (
          <div className="emp-empty">Add a shift above to start the roster.</div>
        ) : (
          <>
            <div className="roster-week">
              <div style={{ padding: "10px 14px", fontSize: 11, color: "var(--if-ink-3)", fontWeight: 600 }}>Employee</div>
              {days.map((day) => (
                <div key={day} style={{ padding: "10px 8px", fontSize: 11, color: day === roster?.today ? "var(--if-green-deep)" : "var(--if-ink-3)", fontWeight: 600, textAlign: "center" }}>
                  {dayHead(day)}
                </div>
              ))}
            </div>
            {roster?.people.map((person) => (
              <div key={person.userId} className="roster-week">
                <div style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                  <Avatar name={person.name} size={22} /> {person.name}
                </div>
                {days.map((day, index) => {
                  const offDay = weekOff(workingWeek, index);
                  const assigned = cell(person.userId, day);
                  const shift = offDay && !assigned ? undefined : shifts.find((row) => row.id === assigned?.shiftId);
                  const color = chipColor(shifts, shift);
                  const past = day < (roster?.today ?? "");
                  const letter = shift ? shift.name.slice(0, 1).toUpperCase() : "—";
                  return (
                    <div key={day} className="roster-cell">
                      <button
                        type="button"
                        className="roster-chip"
                        disabled={!canWrite || past}
                        aria-label={`${person.name} on ${dayHead(day)}`}
                        onClick={() => cycle(person.userId, day)}
                        style={{
                          background: shift ? color : "var(--if-cream)",
                          color: shift ? (color === "var(--if-green)" ? "var(--if-ink)" : "var(--if-paper)") : "var(--if-ink-3)",
                        }}
                      >
                        {letter}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
            {(roster?.people.length ?? 0) === 0 ? <div className="emp-empty">Invite people, then tap a cell to assign a shift.</div> : null}
          </>
        )}
      </div>
      <p className="muted" style={{ marginTop: 0, marginBottom: 20 }}>
        Tap a cell to cycle Off → each shift. Past days stay locked. After the grace minutes, a check-in is late.
      </p>

      {others.length > 0 ? (
        <div className="panel" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Other swap requests, last 30 days</div>
          {others.map((swap) => (
            <div key={swap.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderTop: "1px solid var(--if-cream-2)", fontSize: 13 }}>
              <div>
                {swap.kind === "cover" ? `${swap.target.name} to cover ${swap.requester.name}` : `${swap.requester.name} ↔ ${swap.target.name}`}
                <div style={{ fontSize: 12, color: "var(--if-ink-3)", marginTop: 2 }}>
                  {describe(swap.requester)}{swap.kind === "swap" ? ` · ${describe(swap.target)}` : ""}
                </div>
              </div>
              <span className={`emp-status ${swap.status === "approved" ? "ok" : swap.status === "waiting_colleague" ? "wait" : "off"}`}>
                {statusText[swap.status] ?? swap.status}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

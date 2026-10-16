"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, loadSession, type Session } from "@/lib/api";
import { Avatar } from "@/lib/avatar";
import { NavIcon } from "@/lib/nav-icon";
import { ReportCrumbs } from "@/lib/reports";

type RangeKind = "week" | "month" | "quarter";
type View = "board" | "list";
type Row = {
  rank: number;
  userId: string;
  name: string;
  phone: string;
  department: string | null;
  completed: number;
  onTimePct: number | null;
  previousCompleted: number;
  trend: "up" | "down" | "same";
  change: number;
  visits: number;
  punctualityPct: number | null;
  tasksGoal: number | null;
  visitsGoal: number | null;
  punctualityGoal: number | null;
  projected: number;
};
type Board = {
  range: { kind: RangeKind; from: string; to: string };
  shown: Row[];
  restCount: number;
  rest: Row[];
  people: Row[];
  kpis: { onTimePct: number | null; tasksDone: number; visitsDone: number; punctualityPct: number | null };
};

const RANGES: { id: RangeKind; label: string }[] = [
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "quarter", label: "This quarter" },
];

function scoreClass(pct: number | null) {
  if (pct === null) return "mid";
  if (pct >= 90) return "ok";
  if (pct >= 75) return "mid";
  return "low";
}

function bar(value: number, goal: number | null) {
  if (goal && goal > 0) return Math.min(value / goal, 1);
  return null;
}

function barColor(pct: number) {
  if (pct >= 0.9) return "var(--if-green)";
  if (pct >= 0.7) return "var(--if-amber)";
  return "var(--if-coral)";
}

function telHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits ? `tel:+${digits.length === 10 ? "91" : ""}${digits}` : "";
}

function Meter({ label, value, goal, unit }: { label: string; value: number; goal: number | null; unit: string }) {
  const pct = bar(value, goal);
  const shown = goal ? `${value} / ${goal} ${unit}` : `${value} ${unit}`;
  return (
    <div style={{ paddingRight: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 4 }}>
        <span style={{ color: "var(--if-ink-3)" }}>{label}</span>
        <span className="if-num" style={{ fontWeight: 700 }}>{pct === null ? shown : `${Math.round(pct * 100)}%`}</span>
      </div>
      <div style={{ height: 5, borderRadius: 999, background: "var(--if-cream)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.round((pct ?? 0) * 100)}%`, background: pct === null ? "var(--if-ink-3)" : barColor(pct) }} />
      </div>
      {pct === null ? <div style={{ fontSize: 10, color: "var(--if-ink-3)", marginTop: 2 }}>{shown} · no goal set</div> : null}
    </div>
  );
}

function PodiumCard({ row, place }: { row: Row; place: 1 | 2 | 3 }) {
  const first = place === 1;
  return (
    <div className={`panel podium-card${first ? " first" : ""}`}>
      <div className="podium-rank">{place}</div>
      <Link href={`/people/${row.userId}`} style={{ display: "inline-block" }}>
        <Avatar name={row.name} size={first ? 72 : 56} />
      </Link>
      <div style={{ fontSize: first ? 16 : 14, fontWeight: 700, marginTop: 12 }}>
        <Link href={`/people/${row.userId}`}>{row.name}</Link>
      </div>
      <div style={{ fontSize: 11, color: "var(--if-ink-3)", marginTop: 2 }}>{row.department ?? "Unassigned"}</div>
      <div style={{
        fontFamily: "var(--if-mono)",
        fontSize: first ? 32 : 24,
        fontWeight: 700,
        color: "var(--if-green)",
        marginTop: 12,
        letterSpacing: "-0.02em",
      }}>
        {row.onTimePct === null ? row.completed : `${row.onTimePct}%`}
      </div>
      <div className="muted">{row.completed} tasks done</div>
    </div>
  );
}

function TrendSpark({ row }: { row: Row }) {
  const color = row.trend === "up" ? "var(--if-green)" : row.trend === "down" ? "var(--if-coral)" : "var(--if-ink-3)";
  const a = Math.max(row.previousCompleted, 0);
  const b = Math.max(row.completed, 0);
  const max = Math.max(a, b, 1);
  const y1 = 20 - (a / max) * 16;
  const y2 = 20 - (b / max) * 16;
  return (
    <svg width="70" height="24" viewBox="0 0 70 24" aria-hidden>
      <polyline points={`0,${y1} 70,${y2}`} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function BoardRow({ row }: { row: Row }) {
  const color = row.trend === "up" ? "var(--if-green)" : row.trend === "down" ? "var(--if-coral)" : "var(--if-ink-3)";
  const arrow = row.trend === "up" ? "▲" : row.trend === "down" ? "▼" : "—";
  return (
    <div className="lb-row">
      <div className="if-num" style={{ fontSize: 16, fontWeight: 700, color: row.rank <= 3 ? "var(--if-amber)" : "var(--if-ink-3)" }}>
        #{row.rank}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar name={row.name} size={30} />
        <Link href={`/people/${row.userId}`} style={{ fontWeight: 600 }}>{row.name}</Link>
      </div>
      <div style={{ color: "var(--if-ink-2)" }}>{row.department ?? "—"}</div>
      <div>
        <span className={`score-pill ${scoreClass(row.onTimePct)}`}>
          {row.onTimePct === null ? `${row.completed}` : `${row.onTimePct}%`}
        </span>
      </div>
      <div><TrendSpark row={row} /></div>
      <div className="if-num" style={{ color, fontWeight: 700 }}>{arrow} {row.change}</div>
    </div>
  );
}

export default function TargetsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [range, setRange] = useState<RangeKind>("month");
  const [view, setView] = useState<View>("board");
  const [team, setTeam] = useState("");
  const [board, setBoard] = useState<Board | null>(null);
  const [openRest, setOpenRest] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [setting, setSetting] = useState(false);
  const [targetUser, setTargetUser] = useState("");
  const [tasksGoal, setTasksGoal] = useState("");
  const [visitsGoal, setVisitsGoal] = useState("");
  const [punctualityGoal, setPunctualityGoal] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(kind: RangeKind, token: string) {
    const body = await api<Board>(`/leaderboard?range=${kind}`, {}, token);
    setBoard(body);
    setOpenRest(false);
  }

  useEffect(() => {
    const current = loadSession();
    if (!current) return;
    setSession(current);
    load(range, current.token).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
  }, [range]);

  const people = board?.people ?? [];
  const teams = useMemo(() => [...new Set(people.map((row) => row.department).filter((name): name is string => Boolean(name)))], [people]);
  const filtered = people.filter((row) => !team || row.department === team);
  const podium = board
    ? [
        board.shown.find((row) => row.rank === 2),
        board.shown.find((row) => row.rank === 1),
        board.shown.find((row) => row.rank === 3),
      ]
    : [];
  const tableRows = board ? [...board.shown, ...(openRest ? board.rest : [])] : [];

  function exportCsv() {
    const rows = view === "board" ? filtered : tableRows;
    const header = ["Rank", "Name", "Team", "Tasks done", "On time %", "Visits", "Punctuality %", "Projected tasks"];
    const lines = [
      header,
      ...rows.map((row) => [
        String(row.rank),
        row.name,
        row.department ?? "",
        String(row.completed),
        row.onTimePct === null ? "" : String(row.onTimePct),
        String(row.visits),
        row.punctualityPct === null ? "" : String(row.punctualityPct),
        String(row.projected),
      ]),
    ];
    const csv = lines.map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "targets.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function openSet(userId?: string) {
    const row = people.find((item) => item.userId === (userId || people[0]?.userId));
    setTargetUser(row?.userId ?? "");
    setTasksGoal(row?.tasksGoal != null ? String(row.tasksGoal) : "");
    setVisitsGoal(row?.visitsGoal != null ? String(row.visitsGoal) : "");
    setPunctualityGoal(row?.punctualityGoal != null ? String(row.punctualityGoal) : "");
    setSetting(true);
  }

  async function saveGoals(event: React.FormEvent) {
    event.preventDefault();
    if (!session || !targetUser) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(
        `/targets/${targetUser}`,
        {
          method: "PUT",
          body: JSON.stringify({
            tasksGoal: tasksGoal === "" ? null : Number(tasksGoal),
            visitsGoal: visitsGoal === "" ? null : Number(visitsGoal),
            punctualityGoal: punctualityGoal === "" ? null : Number(punctualityGoal),
          }),
        },
        session.token,
      );
      setNotice("Goals saved. Rupee targets stay off this product.");
      setSetting(false);
      await load(range, session.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const kpis = board?.kpis;

  return (
    <div>
      <div className="rpt-head">
        <div>
          <ReportCrumbs items={view === "list" ? ["Operations", "Targets", "Leaderboard"] : ["Operations", "Targets"]} />
          <h1 className="page-title" style={{ margin: 0 }}>{view === "list" ? "Team leaderboard" : "Targets & performance"}</h1>
          <p className="sub" style={{ margin: "6px 0 0" }}>
            Tasks, visits, and punctuality. Sales rupee amounts stay off this board. Projection is this period’s task pace to period end.
          </p>
        </div>
        <div className="actions" style={{ flexWrap: "wrap" }}>
          {RANGES.map((item) => (
            <button key={item.id} type="button" className={`emp-chip${range === item.id ? " on" : ""}`} onClick={() => setRange(item.id)}>
              {item.label}
            </button>
          ))}
          <button type="button" className="btn secondary" style={{ width: "auto" }} onClick={exportCsv}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><NavIcon name="download" size={14} /> Export</span>
          </button>
          <button type="button" className="btn" style={{ width: "auto", marginTop: 0 }} onClick={() => openSet()}>
            Set targets
          </button>
        </div>
      </div>
      {error ? <div className="error">{error}</div> : null}
      {notice ? <div className="devcode">{notice}</div> : null}

      <div className="task-toolbar">
        <div className="task-tabs">
          <button type="button" className={view === "board" ? "on" : ""} onClick={() => setView("board")}>
            <NavIcon name="target" size={13} color={view === "board" ? "var(--if-ink)" : "var(--if-ink-3)"} /> Performance
          </button>
          <button type="button" className={view === "list" ? "on" : ""} onClick={() => setView("list")}>
            <NavIcon name="chart" size={13} color={view === "list" ? "var(--if-ink)" : "var(--if-ink-3)"} /> Leaderboard
          </button>
        </div>
      </div>

      {setting ? (
        <form className="panel" onSubmit={saveGoals} style={{ marginBottom: 20, maxWidth: 560 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Set targets</div>
          <label htmlFor="tgt-person">Person</label>
          <select
            id="tgt-person"
            value={targetUser}
            onChange={(event) => {
              const row = people.find((item) => item.userId === event.target.value);
              setTargetUser(event.target.value);
              setTasksGoal(row?.tasksGoal != null ? String(row.tasksGoal) : "");
              setVisitsGoal(row?.visitsGoal != null ? String(row.visitsGoal) : "");
              setPunctualityGoal(row?.punctualityGoal != null ? String(row.punctualityGoal) : "");
            }}
          >
            {people.map((row) => (
              <option key={row.userId} value={row.userId}>{row.name}</option>
            ))}
          </select>
          <div className="grid" style={{ marginTop: 12 }}>
            <div>
              <label htmlFor="tgt-tasks">Tasks this period</label>
              <input id="tgt-tasks" inputMode="numeric" value={tasksGoal} onChange={(event) => setTasksGoal(event.target.value)} placeholder="Optional" />
            </div>
            <div>
              <label htmlFor="tgt-visits">Visits this period</label>
              <input id="tgt-visits" inputMode="numeric" value={visitsGoal} onChange={(event) => setVisitsGoal(event.target.value)} placeholder="Optional" />
            </div>
            <div>
              <label htmlFor="tgt-punct">Punctuality %</label>
              <input id="tgt-punct" inputMode="numeric" value={punctualityGoal} onChange={(event) => setPunctualityGoal(event.target.value)} placeholder="0–100" />
            </div>
          </div>
          <p className="muted">Leave a field blank to clear it. Revenue and SKU targets stay off this product.</p>
          <div className="actions">
            <button className="btn" disabled={busy || !targetUser}>{busy ? "Saving" : "Save"}</button>
            <button type="button" className="btn secondary" onClick={() => setSetting(false)}>Cancel</button>
          </div>
        </form>
      ) : null}

      {view === "board" && kpis ? (
        <>
          <div className="rpt-kpis four" style={{ marginBottom: 24 }}>
            {[
              ["Team on-time", kpis.onTimePct === null ? "—" : `${kpis.onTimePct}%`, "Tasks closed by due date"],
              ["Tasks done", String(kpis.tasksDone), "Closed in this range"],
              ["Visits done", String(kpis.visitsDone), "Check-ins that count"],
              ["Punctuality", kpis.punctualityPct === null ? "—" : `${kpis.punctualityPct}%`, "On-time check-ins"],
            ].map(([label, value, sub]) => (
              <div key={label} className="panel emp-kpi">
                <div className="emp-kpi-label">{label}</div>
                <div className="emp-kpi-value if-num">{value}</div>
                <div style={{ fontSize: 11, color: "var(--if-ink-3)", marginTop: 4 }}>{sub}</div>
              </div>
            ))}
          </div>
          <div className="emp-filters">
            <button type="button" className={`emp-chip${team === "" ? " on" : ""}`} onClick={() => setTeam("")}>All teams</button>
            {teams.map((name) => (
              <button key={name} type="button" className={`emp-chip${team === name ? " on" : ""}`} onClick={() => setTeam(name)}>{name}</button>
            ))}
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: "var(--if-ink-3)" }}>Showing {filtered.length} of {people.length} people</span>
          </div>
          <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
            <div className="tgt-head">
              <div>Employee</div><div>Team</div><div>Tasks</div><div>Visits</div><div>Punctuality</div><div>Pace</div>
            </div>
            {filtered.length === 0 ? <div className="emp-empty">No field people on the roster yet.</div> : null}
            {filtered.map((row) => (
              <div key={row.userId} className="tgt-row">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Link href={`/people/${row.userId}`}><Avatar name={row.name} size={30} /></Link>
                  <Link href={`/people/${row.userId}`} style={{ fontWeight: 600 }}>{row.name}</Link>
                </div>
                <div style={{ color: "var(--if-ink-2)" }}>{row.department ?? "—"}</div>
                <Meter label="Tasks done" value={row.completed} goal={row.tasksGoal} unit="" />
                <Meter label="Visits" value={row.visits} goal={row.visitsGoal} unit="" />
                {row.punctualityPct === null && row.punctualityGoal == null ? (
                  <div style={{ fontSize: 11, color: "var(--if-ink-3)" }}>No check-ins</div>
                ) : (
                  <Meter label="On time" value={row.punctualityPct ?? 0} goal={row.punctualityGoal} unit="%" />
                )}
                <div>
                  <div className="if-num" style={{ fontWeight: 700 }}>{row.projected}</div>
                  <div style={{ fontSize: 10, color: "var(--if-ink-3)" }}>
                    {row.tasksGoal != null ? `gap ${row.tasksGoal - row.projected}` : "if pace holds"}
                  </div>
                  <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 4, padding: 0, fontSize: 11 }} onClick={() => openSet(row.userId)}>Adjust</button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {view === "list" && board ? (
        <>
          {board.shown.length >= 1 ? (
            <div className="podium">
              {podium.map((row, index) => (
                row ? <PodiumCard key={row.userId} row={row} place={(index === 1 ? 1 : index === 0 ? 2 : 3) as 1 | 2 | 3} /> : <div key={index} />
              ))}
            </div>
          ) : <div className="panel">No field people on the roster yet.</div>}
          {tableRows.length > 0 ? (
            <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
              <div className="lb-head">
                <span>Rank</span><span>Employee</span><span>Team</span><span>On time</span><span>Trend</span><span>Change</span>
              </div>
              {tableRows.map((row) => <BoardRow key={row.userId} row={row} />)}
            </div>
          ) : null}
          {board.restCount > 0 && !openRest ? (
            <button type="button" className="btn secondary" style={{ marginTop: 16, width: "auto" }} onClick={() => setOpenRest(true)}>
              Show the rest ({board.restCount})
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

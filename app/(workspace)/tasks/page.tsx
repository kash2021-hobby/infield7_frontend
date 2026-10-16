"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, loadSession, type Session } from "@/lib/api";
import { Avatar, hueFor } from "@/lib/avatar";
import { NavIcon } from "@/lib/nav-icon";
import { FauxMap } from "@/lib/faux-map";
import { ReportCrumbs } from "@/lib/reports";

type Task = {
  id: string;
  title: string;
  status: string;
  dueOn: string | null;
  assignee: string | null;
  assigneeUserId: string | null;
  site: string | null;
  department: string | null;
  hasPhoto: boolean;
  seriesId: string | null;
  workflowId: string | null;
};

type Employee = { userId: string | null; name: string; phone: string; status: string };
type Site = { id: string; name: string };
type View = "kanban" | "list" | "calendar" | "route";
type Filter = "open" | "overdue" | "done" | "all";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const VIEW_KEY = "if7-tasks-view";
const SORT_KEY = "if7-tasks-list-sort";
type SortKey = "title" | "due" | "person" | "site" | "status";
function PersonName({ task, empty }: { task: Task; empty: string }) {
  if (!task.assignee) return <>{empty}</>;
  if (!task.assigneeUserId) return <>{task.assignee}</>;
  return (
    <Link href={`/people/${task.assigneeUserId}`} onClick={(event) => event.stopPropagation()}>
      {task.assignee}
    </Link>
  );
}

const BOARD_COLS = [
  { id: "new" as const, label: "To do", color: "var(--if-ink-3)", drop: "new" as const, match: (task: Task) => task.status === "new" && !task.workflowId },
  { id: "in_progress" as const, label: "In progress", color: "var(--if-amber)", drop: "in_progress" as const, match: (task: Task) => task.status === "in_progress" },
  { id: "review" as const, label: "Review", color: "var(--if-ink)", drop: "new" as const, match: (task: Task) => task.status === "new" && Boolean(task.workflowId) },
  { id: "done" as const, label: "Done today", color: "var(--if-green)", drop: "done" as const, match: (task: Task) => task.status === "done" },
];

function deptColor(name: string) {
  return `oklch(62% 0.14 ${hueFor(name)})`;
}

function statusTone(status: string) {
  if (status === "done") return "ok";
  if (status === "in_progress") return "wait";
  return "off";
}

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function mondayIndex(year: number, month: number) {
  const sunday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return (sunday + 6) % 7;
}

function isoDay(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addUtcDays(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return isoDay(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function mondayOf(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return addUtcDays(iso, -((date.getUTCDay() + 6) % 7));
}

function monthLabel(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}

function statusLabel(status: string) {
  if (status === "in_progress") return "In progress";
  if (status === "done") return "Done";
  return "To do";
}

function dueKey(task: Task) {
  return task.dueOn ? task.dueOn.slice(0, 10) : null;
}

function sortTasks(tasks: Task[], today: string) {
  const rank = (task: Task) => {
    if (task.status === "done") return 5;
    const due = dueKey(task);
    if (due && due < today) return 0;
    if (due === today) return 1;
    if (due) return 2;
    return 3;
  };
  return [...tasks].sort((a, b) => rank(a) - rank(b) || (dueKey(a) ?? "9999").localeCompare(dueKey(b) ?? "9999") || a.title.localeCompare(b.title));
}

function sortList(tasks: Task[], sort: { key: SortKey; dir: "asc" | "desc" }) {
  const dir = sort.dir === "asc" ? 1 : -1;
  const value = (task: Task) => {
    if (sort.key === "title") return task.title.toLowerCase();
    if (sort.key === "due") return dueKey(task) ?? "9999-99-99";
    if (sort.key === "person") return (task.assignee ?? "\uffff").toLowerCase();
    if (sort.key === "site") return (task.site ?? "\uffff").toLowerCase();
    return task.status;
  };
  return [...tasks].sort((a, b) => value(a).localeCompare(value(b)) * dir || a.title.localeCompare(b.title));
}

type Stop = { siteId: string; site: string; lat: number; lng: number; km: number; tasks: { id: string; title: string }[] };
type RoutePreview = {
  day: string;
  person: { userId: string; name: string };
  origin: { lat: number; lng: number; site: string | null } | null;
  current: Stop[];
  optimized: Stop[];
  kmCurrent: number;
  kmOptimized: number;
  kmSaved: number;
  minutesCurrent: number;
  minutesOptimized: number;
  minutesSaved: number;
  speedKmh: number;
  published: boolean;
  publishedAt: string | null;
  skipped: { id: string; title: string }[];
};

function haulKm(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(a)) * 100) / 100;
}

function stopsWithKm(origin: { lat: number; lng: number } | null, stops: Stop[]) {
  let here = origin;
  return stops.map((stop) => {
    const next = { ...stop, km: here ? haulKm(here, stop) : 0 };
    here = stop;
    return next;
  });
}

function minutesFor(kmTotal: number) {
  return Math.round((kmTotal / 25) * 60);
}

function RouteMap({ stops, origin }: { stops: Stop[]; origin: { lat: number; lng: number } | null }) {
  const pins = origin
    ? [{ lat: origin.lat, lng: origin.lng, label: "S" }, ...stops.map((stop, index) => ({ lat: stop.lat, lng: stop.lng, label: String(index + 1) }))]
    : stops.map((stop, index) => ({ lat: stop.lat, lng: stop.lng, label: String(index + 1) }));
  if (pins.length === 0) return <div className="route-map muted" style={{ display: "grid", placeItems: "center" }}>Add stops to see the route.</div>;
  return (
    <FauxMap
      height={280}
      pins={pins}
      polylines={pins.length > 1 ? [pins] : []}
      interactive={false}
    />
  );
}

function RoutePanel({
  session,
  employees,
  onError,
}: {
  session: Session;
  employees: Employee[];
  onError: (message: string) => void;
}) {
  const [person, setPerson] = useState(employees[0]?.userId ?? "");
  const [day, setDay] = useState(todayIso());
  const [preview, setPreview] = useState<RoutePreview | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [busy, setBusy] = useState(false);

  async function load(userId: string, useDay: string) {
    const body = await api<RoutePreview>(`/routes?userId=${encodeURIComponent(userId)}&day=${useDay}`, {}, session.token);
    setPreview(body);
    setStops(body.current);
  }

  useEffect(() => {
    if (!person && employees[0]?.userId) setPerson(employees[0].userId ?? "");
  }, [employees, person]);

  useEffect(() => {
    if (!person) return;
    load(person, day).catch((err: unknown) => onError(err instanceof Error ? err.message : "Could not load"));
  }, [person, day, session.token]);

  const origin = preview?.origin ?? null;
  const kmTotal = Math.round(stops.reduce((sum, stop) => sum + stop.km, 0) * 100) / 100;
  const minutes = minutesFor(kmTotal);
  const kmSaved = preview ? Math.round((kmTotal - preview.kmOptimized) * 100) / 100 : 0;

  function move(index: number, delta: number) {
    const next = index + delta;
    if (next < 0 || next >= stops.length) return;
    const copy = [...stops];
    const [row] = copy.splice(index, 1);
    if (!row) return;
    copy.splice(next, 0, row);
    setStops(stopsWithKm(origin, copy));
  }

  async function send() {
    if (!person || stops.length === 0) return;
    setBusy(true);
    onError("");
    try {
      const body = await api<RoutePreview>(
        "/routes",
        { method: "POST", body: JSON.stringify({ userId: person, day, siteIds: stops.map((stop) => stop.siteId) }) },
        session.token,
      );
      setPreview(body);
      setStops(body.current);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not send");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="task-toolbar">
        <select value={person} onChange={(event) => setPerson(event.target.value)} aria-label="Person" style={{ width: "auto", margin: 0 }}>
          {employees.length === 0 ? <option value="">No field people yet</option> : null}
          {employees.map((item) => (
            <option key={item.phone} value={item.userId ?? ""}>{item.name} · Today</option>
          ))}
        </select>
        <input type="date" value={day} onChange={(event) => setDay(event.target.value)} aria-label="Day" style={{ width: "auto", margin: 0 }} />
        <div style={{ flex: 1 }} />
        <button type="button" className="btn secondary" style={{ width: "auto", marginTop: 0 }} disabled={!preview || preview.optimized.length === 0} onClick={() => preview && setStops(preview.optimized)}>
          Optimize route
        </button>
        <button type="button" className="btn" style={{ width: "auto", marginTop: 0 }} disabled={busy || stops.length === 0} onClick={() => void send()}>
          Send to phone
        </button>
      </div>
      <div className="route-layout">
        <div className="panel" style={{ padding: 0, overflow: "hidden", position: "relative", marginBottom: 0 }}>
          {stops.length ? (
            <RouteMap stops={stops} origin={origin} />
          ) : (
            <div className="route-map route-empty">
              {person ? "No sites left for this person on this day. Assign a task with a site first." : "Pick a person."}
            </div>
          )}
          {stops.length ? (
            <div className="route-chip">
              <span className="if-num" style={{ fontSize: 14, fontWeight: 700 }}>{kmTotal} km</span> · {stops.length} stop{stops.length === 1 ? "" : "s"} · ~{minutes} min
            </div>
          ) : null}
        </div>
        <div className="panel" style={{ padding: 0, marginBottom: 0 }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--if-cream-2)" }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Route order</div>
            <div style={{ fontSize: 11, color: "var(--if-ink-3)", marginTop: 2 }}>
              Straight-line at 25 km/h. {preview?.published ? "Sent to their phone." : "Send to lock this order on My visits."}
            </div>
          </div>
          {preview && kmSaved > 0.05 ? (
            <div style={{ padding: "10px 18px", fontSize: 12, color: "var(--if-ink-3)" }}>{kmSaved} km · {minutesFor(kmSaved)} min shorter if you Optimize.</div>
          ) : null}
          {origin ? (
            <div className="route-stop" style={{ padding: "12px 18px" }}>
              <span className="route-n" style={{ background: "var(--if-ink-3)" }}>S</span>
              <div>
                <div style={{ fontWeight: 600 }}>Start{origin.site ? ` · ${origin.site}` : ""}</div>
                <div className="muted">—</div>
              </div>
            </div>
          ) : null}
          {stops.map((stop, index) => (
            <div key={stop.siteId} className="route-stop" style={{ padding: "12px 18px" }}>
              <span className="route-n">{index + 1}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{stop.site}</div>
                <div className="if-num" style={{ fontSize: 10, color: "var(--if-ink-3)", marginTop: 2 }}>
                  {stop.km} km · {stop.tasks.map((task) => task.title).join(", ")}
                </div>
              </div>
              <div className="route-move">
                <button type="button" className="btn secondary" disabled={index === 0} onClick={() => move(index, -1)}>Up</button>
                <button type="button" className="btn secondary" disabled={index === stops.length - 1} onClick={() => move(index, 1)}>Down</button>
              </div>
            </div>
          ))}
          {preview && preview.skipped.length > 0 ? (
            <p className="muted" style={{ padding: "0 18px 14px" }}>No site: {preview.skipped.map((task) => task.title).join(", ")}</p>
          ) : null}
        </div>
      </div>
    </>
  );
}

function KanbanBoard({
  tasks,
  today,
  dueText,
  onMove,
}: {
  tasks: Task[];
  today: string;
  dueText: (task: Task) => string;
  onMove: (id: string, status: "new" | "in_progress" | "done") => void;
}) {
  const [over, setOver] = useState<string | null>(null);
  return (
    <div className="board">
      {BOARD_COLS.map((col) => {
        const cards = tasks.filter(col.match);
        return (
          <div
            key={col.id}
            className={over === col.id ? "board-col over" : "board-col"}
            onDragOver={(event) => {
              event.preventDefault();
              setOver(col.id);
            }}
            onDragLeave={() => setOver((current) => (current === col.id ? null : current))}
            onDrop={(event) => {
              event.preventDefault();
              setOver(null);
              const id = event.dataTransfer.getData("text/task-id");
              if (id) onMove(id, col.drop);
            }}
          >
            <div className="board-head">
              <span className="board-dot" style={{ background: col.color }} />
              <div style={{ fontSize: 12, fontWeight: 700 }}>{col.label}</div>
              <div className="if-num" style={{ fontSize: 11, color: "var(--if-ink-3)", fontWeight: 600 }}>{cards.length}</div>
            </div>
            {cards.map((task) => {
              const overdue = task.status !== "done" && !!dueKey(task) && dueKey(task)! < today;
              const stripe = deptColor(task.department || task.site || "Unassigned");
              return (
                <div
                  key={task.id}
                  className="board-card"
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/task-id", task.id);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <div style={{ width: 3, height: 12, borderRadius: 999, background: stripe }} />
                    <span style={{ fontSize: 10, color: "var(--if-ink-3)", fontWeight: 600 }}>{task.department || task.site || "Unassigned"}</span>
                    <div style={{ flex: 1 }} />
                    {task.site ? <NavIcon name="pin" size={12} color="var(--if-ink-3)" /> : null}
                    {task.seriesId ? <span style={{ fontSize: 11, color: "var(--if-ink-3)" }}>↻</span> : null}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, marginBottom: 8 }}>{task.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {task.assignee ? <Avatar name={task.assignee} size={22} /> : null}
                    <div style={{ fontSize: 11, color: "var(--if-ink-2)", flex: 1, minWidth: 0 }}>
                      <PersonName task={task} empty="Unassigned" />
                    </div>
                    <div className="if-num" style={{ fontSize: 10, color: overdue ? "var(--if-coral)" : "var(--if-ink-3)" }}>{dueText(task)}</div>
                  </div>
                </div>
              );
            })}
            {cards.length === 0 ? <p className="muted" style={{ margin: 0 }}>Drop a card here.</p> : null}
          </div>
        );
      })}
    </div>
  );
}

export default function TasksPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [siteId, setSiteId] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [repeat, setRepeat] = useState<"none" | "daily" | "weekly" | "weekdays">("none");
  const [untilOn, setUntilOn] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState("");
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("list");
  const [filter, setFilter] = useState<Filter>("open");
  const [person, setPerson] = useState("");
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [calMode, setCalMode] = useState<"month" | "week">("week");
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayIso()));
  const [picked, setPicked] = useState<string[]>([]);
  const [bulkPerson, setBulkPerson] = useState("");
  const [bulkDue, setBulkDue] = useState("");
  const [listSort, setListSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);
  const [creating, setCreating] = useState(false);
  const [span, setSpan] = useState<"all" | "week">("all");

  const today = todayIso();
  const employee = session?.user.role === "employee";

  function pickView(next: View) {
    setView(next);
    localStorage.setItem(VIEW_KEY, next);
  }

  async function refresh(current: Session) {
    const body = await api<{ tasks: Task[] }>("/tasks", {}, current.token);
    setTasks(body.tasks);
    if (current.user.role !== "employee") {
      const roster = await api<{ employees: Employee[] }>("/employees", {}, current.token);
      setEmployees(roster.employees.filter((item) => item.status === "active" && item.userId));
      const siteBody = await api<{ sites: Site[] }>("/sites", {}, current.token);
      setSites(siteBody.sites);
    }
  }

  useEffect(() => {
    const current = loadSession();
    if (!current) return;
    setSession(current);
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved === "kanban" || saved === "list" || saved === "calendar" || saved === "route") {
      if (current.user.role === "employee" && saved === "route") setView("list");
      else setView(saved);
    } else if (current.user.role !== "employee") {
      setView("kanban");
    }
    try {
      const savedSort = JSON.parse(localStorage.getItem(SORT_KEY) || "null") as { key: SortKey; dir: "asc" | "desc" } | null;
      if (savedSort && ["title", "due", "person", "site", "status"].includes(savedSort.key)) setListSort(savedSort);
    } catch {
      /* ignore */
    }
    refresh(current).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
  }, []);

  const shown = useMemo(() => {
    const weekFrom = mondayOf(today);
    const weekTo = addUtcDays(weekFrom, 6);
    const filtered = tasks.filter((task) => {
      const due = dueKey(task);
      if (filter === "open" && task.status === "done") return false;
      if (filter === "done" && task.status !== "done") return false;
      if (filter === "overdue" && !(task.status !== "done" && due && due < today)) return false;
      if (person && task.assigneeUserId !== person) return false;
      if (span === "week" && (!due || due < weekFrom || due > weekTo)) return false;
      return true;
    });
    return listSort ? sortList(filtered, listSort) : sortTasks(filtered, today);
  }, [tasks, filter, person, today, listSort, span]);

  const cells = useMemo(() => {
    const lead = mondayIndex(cursor.year, cursor.month);
    const count = daysInMonth(cursor.year, cursor.month);
    const prev = shiftMonth(cursor.year, cursor.month, -1);
    const prevCount = daysInMonth(prev.year, prev.month);
    const next = shiftMonth(cursor.year, cursor.month, 1);
    const slots: { iso: string; day: number; inMonth: boolean }[] = [];
    for (let i = lead; i > 0; i -= 1) {
      slots.push({ iso: isoDay(prev.year, prev.month, prevCount - i + 1), day: prevCount - i + 1, inMonth: false });
    }
    for (let day = 1; day <= count; day += 1) {
      slots.push({ iso: isoDay(cursor.year, cursor.month, day), day, inMonth: true });
    }
    const remaining = (7 - (slots.length % 7)) % 7;
    for (let day = 1; day <= remaining; day += 1) {
      slots.push({ iso: isoDay(next.year, next.month, day), day, inMonth: false });
    }
    return slots;
  }, [cursor]);

  const weekCells = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const iso = addUtcDays(weekStart, index);
      const day = Number(iso.slice(8, 10));
      return { iso, day, inMonth: true };
    });
  }, [weekStart]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!session) return;
    setError("");
    try {
      await api(
        "/tasks",
        {
          method: "POST",
          body: JSON.stringify({
            title,
            assigneeUserId: assignee || undefined,
            siteId: siteId || undefined,
            dueOn: dueOn || undefined,
            repeat: repeat === "none" ? undefined : repeat,
            untilOn: repeat === "none" ? undefined : untilOn || undefined,
          }),
        },
        session.token,
      );
      setTitle("");
      setUntilOn("");
      setRepeat("none");
      setCreating(false);
      await refresh(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the task");
    }
  }

  async function move(id: string, status: "new" | "in_progress" | "done") {
    if (!session) return;
    const current = tasks.find((task) => task.id === id);
    if (current?.status === status) return;
    setError("");
    try {
      if (status === "done" && !photo) {
        setError("Add a photo before closing the task");
        return;
      }
      await api(
        `/tasks/${id}`,
        {
          method: "POST",
          body: JSON.stringify({
            status,
            ...(status === "done" ? { note, photoBase64: photo } : {}),
          }),
        },
        session.token,
      );
      if (status === "done") {
        setNote("");
        setPhoto("");
      }
      await refresh(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the task");
    }
  }

  async function start(id: string) {
    await move(id, "in_progress");
  }

  async function close(id: string) {
    await move(id, "done");
  }

  function toggleSort(key: SortKey) {
    setListSort((current) => {
      const next = !current || current.key !== key ? { key, dir: "asc" as const } : current.dir === "asc" ? { key, dir: "desc" as const } : null;
      if (next) localStorage.setItem(SORT_KEY, JSON.stringify(next));
      else localStorage.removeItem(SORT_KEY);
      return next;
    });
  }

  function togglePicked(id: string) {
    setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function applyBulk(event: React.FormEvent) {
    event.preventDefault();
    if (!session || picked.length === 0) return;
    const assigneeUserId = bulkPerson === "" ? undefined : bulkPerson === "none" ? null : bulkPerson;
    if (assigneeUserId === undefined && !bulkDue) return;
    setError("");
    try {
      await api("/tasks/bulk", {
        method: "POST",
        body: JSON.stringify({
          ids: picked,
          ...(assigneeUserId !== undefined ? { assigneeUserId } : {}),
          ...(bulkDue ? { dueOn: bulkDue } : {}),
        }),
      }, session.token);
      setPicked([]);
      setBulkDue("");
      await refresh(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the tasks");
    }
  }

  async function reschedule(id: string, nextDue: string) {
    if (!session) return;
    const current = tasks.find((task) => task.id === id);
    if (!current || dueKey(current) === nextDue) return;
    setError("");
    try {
      await api(`/tasks/${id}`, { method: "POST", body: JSON.stringify({ dueOn: nextDue }) }, session.token);
      await refresh(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not move the task");
    }
  }

  function dueText(task: Task) {
    const due = dueKey(task);
    if (!due) return "No date";
    if (task.status !== "done" && due < today) return `Overdue · ${due}`;
    if (due === today) return "Today";
    return due;
  }

  function exportCsv() {
    const header = ["Title", "Person", "Site", "Department", "Due", "Status"];
    const lines = [
      header,
      ...shown.map((task) => [task.title, task.assignee ?? "", task.site ?? "", task.department ?? "", dueKey(task) ?? "", statusLabel(task.status)]),
    ];
    const csv = lines.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tasks.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const tabs: { id: View; label: string; icon: "check" | "briefcase" | "calendar" | "map" }[] = employee
    ? [
        { id: "kanban", label: "Kanban", icon: "check" },
        { id: "list", label: "List", icon: "briefcase" },
        { id: "calendar", label: "Calendar", icon: "calendar" },
      ]
    : [
        { id: "kanban", label: "Kanban", icon: "check" },
        { id: "list", label: "List", icon: "briefcase" },
        { id: "calendar", label: "Calendar", icon: "calendar" },
        { id: "route", label: "Route", icon: "map" },
      ];

  if (creating && session && !employee) {
    return (
      <div>
        <div className="rpt-head">
          <div>
            <ReportCrumbs items={["Operations", "Tasks", "New task"]} />
            <h1 className="page-title" style={{ margin: 0 }}>New task</h1>
          </div>
          <div className="actions">
            <button type="button" className="btn secondary" style={{ width: "auto" }} onClick={() => setCreating(false)}>Cancel</button>
            <button type="submit" form="new-task" className="btn" style={{ width: "auto", marginTop: 0 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><NavIcon name="check" size={14} color="var(--if-paper)" /> Create task</span>
            </button>
          </div>
        </div>
        {error ? <div className="error">{error}</div> : null}
        <form id="new-task" className="task-create" onSubmit={create}>
          <div className="panel" style={{ padding: 24 }}>
            <label htmlFor="title">Task title</label>
            <input id="title" value={title} onChange={(event) => setTitle(event.target.value)} required />
            <div className="grid" style={{ marginTop: 12 }}>
              <div>
                <label htmlFor="assignee">Assign to</label>
                <select id="assignee" value={assignee} onChange={(event) => setAssignee(event.target.value)}>
                  <option value="">Unassigned</option>
                  {employees.map((item) => (
                    <option key={item.phone} value={item.userId ?? ""}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="site">Location</label>
                <select id="site" value={siteId} onChange={(event) => setSiteId(event.target.value)}>
                  <option value="">None</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>{site.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="due">{repeat === "none" ? "Due date" : "First due"}</label>
                <input id="due" type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} required={repeat !== "none"} />
              </div>
              <div>
                <label htmlFor="repeat">Repeat</label>
                <select id="repeat" value={repeat} onChange={(event) => setRepeat(event.target.value as typeof repeat)}>
                  <option value="none">Does not repeat</option>
                  <option value="daily">Every day</option>
                  <option value="weekly">Every week</option>
                  <option value="weekdays">Weekdays (Mon–Fri)</option>
                </select>
              </div>
              {repeat === "none" ? null : (
                <div>
                  <label htmlFor="until">Until</label>
                  <input id="until" type="date" value={untilOn} onChange={(event) => setUntilOn(event.target.value)} required />
                </div>
              )}
            </div>
            {repeat !== "none" ? (
              <p className="muted" style={{ margin: "12px 0 0" }}>Creates one task per date, at most 30.</p>
            ) : null}
          </div>
          <div>
            <div className="panel" style={{ padding: 16 }}>
              <div className="emp-kpi-label" style={{ marginBottom: 8 }}>Off this form</div>
              <p className="muted" style={{ margin: 0 }}>Checklist, attachments, and rupee targets stay off this product. Closing still needs a photo of the finished work.</p>
            </div>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="rpt-head">
        <div>
          <ReportCrumbs items={["Operations", "Tasks"]} />
          <h1 className="page-title" style={{ margin: 0 }}>Tasks</h1>
          <p className="sub" style={{ margin: "6px 0 0" }}>
            {employee
              ? "Your assigned work. Drag a card to change status. Close with a photo of the finished work."
              : "Kanban, list, calendar, or today's route. Drag to update. Closing still needs a photo."}
          </p>
        </div>
        <div className="actions">
          <button type="button" className="btn secondary" style={{ width: "auto" }} onClick={exportCsv}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><NavIcon name="download" size={14} /> Export</span>
          </button>
          {employee ? null : (
            <button type="button" className="btn" style={{ width: "auto", marginTop: 0 }} onClick={() => setCreating(true)}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><NavIcon name="plus" size={14} color="var(--if-paper)" /> New task</span>
            </button>
          )}
        </div>
      </div>
      {error ? <div className="error">{error}</div> : null}

      <div className="task-toolbar">
        <div className="task-tabs">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" className={view === tab.id ? "on" : ""} onClick={() => pickView(tab.id)}>
              <NavIcon name={tab.icon} size={13} color={view === tab.id ? "var(--if-ink)" : "var(--if-ink-3)"} />
              {tab.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {view === "route" ? null : (
          <>
            {employee ? null : (
              <select value={person} onChange={(event) => setPerson(event.target.value)} aria-label="Person" style={{ width: "auto", margin: 0 }}>
                <option value="">All employees</option>
                {employees.map((item) => (
                  <option key={item.phone} value={item.userId ?? ""}>{item.name}</option>
                ))}
              </select>
            )}
            <button type="button" className={`emp-chip${span === "week" ? " on" : ""}`} onClick={() => setSpan(span === "week" ? "all" : "week")}>This week</button>
            {(["open", "overdue", "done", "all"] as const).map((id) => (
              <button key={id} type="button" className={`emp-chip${filter === id ? " on" : ""}`} onClick={() => setFilter(id)}>
                {id === "open" ? "Open" : id === "overdue" ? "Overdue" : id === "done" ? "Done" : "All"}
              </button>
            ))}
          </>
        )}
      </div>

      {view === "route" && session ? (
        <RoutePanel session={session} employees={employees} onError={setError} />
      ) : view === "kanban" ? (
        <>
          <KanbanBoard tasks={shown} today={today} dueText={dueText} onMove={(id, status) => void move(id, status)} />
          <div className="panel">
            <p className="muted" style={{ marginTop: 0 }}>Add a photo before you drop a card on Done today.</p>
            <label htmlFor="photo">Photo of the finished work</label>
            <input id="photo" type="file" accept="image/*" capture="environment" onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => setPhoto(String(reader.result));
              reader.readAsDataURL(file);
            }} />
            <label htmlFor="note" style={{ marginTop: 16 }}>Note</label>
            <input id="note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Gate replaced" />
          </div>
        </>
      ) : view === "list" ? (
        <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
          {employee ? null : (
            <form className="actions" onSubmit={applyBulk} style={{ margin: 0, padding: "12px 16px", flexWrap: "wrap", borderBottom: "1px solid var(--if-cream-2)" }}>
              <span className="muted">{picked.length} selected</span>
              <select value={bulkPerson} onChange={(event) => setBulkPerson(event.target.value)} aria-label="Assign selected">
                <option value="">Keep person</option>
                <option value="none">Unassigned</option>
                {employees.map((item) => (
                  <option key={item.phone} value={item.userId ?? ""}>{item.name}</option>
                ))}
              </select>
              <input type="date" value={bulkDue} onChange={(event) => setBulkDue(event.target.value)} aria-label="Due date for selected" />
              <button className="btn" disabled={picked.length === 0 || (bulkPerson === "" && !bulkDue)}>Apply</button>
            </form>
          )}
          <div className={`task-list${employee ? "" : " manage"}`}>
            <div className="task-list-head">
              {employee ? null : (
                <div>
                  <input
                    type="checkbox"
                    checked={shown.length > 0 && shown.every((task) => picked.includes(task.id))}
                    onChange={() => {
                      const ids = shown.map((task) => task.id);
                      setPicked(shown.every((task) => picked.includes(task.id)) ? [] : ids);
                    }}
                    aria-label="Select all"
                  />
                </div>
              )}
              <div />
              {([["title", "Task"], ["person", "Assignee"], ["site", "Site"], ["due", "When"], ["status", "Status"]] as const).map(([key, label]) => (
                <button key={key} type="button" onClick={() => toggleSort(key)}>
                  {label}
                  {listSort?.key === key ? (listSort.dir === "asc" ? " ↑" : " ↓") : ""}
                </button>
              ))}
              <div />
            </div>
            {shown.length === 0 ? <div className="emp-empty">No tasks match these filters.</div> : null}
            {shown.map((task) => {
              const overdue = task.status !== "done" && !!dueKey(task) && dueKey(task)! < today;
              return (
                <div key={task.id} className="task-list-row">
                  {employee ? null : (
                    <div>
                      <input type="checkbox" checked={picked.includes(task.id)} onChange={() => togglePicked(task.id)} aria-label={`Select ${task.title}`} />
                    </div>
                  )}
                  <div>
                    <div style={{ width: 14, height: 14, borderRadius: 4, border: "1.5px solid var(--if-ink-3)", background: task.status === "done" ? "var(--if-green)" : "transparent" }} />
                  </div>
                  <div style={{ fontWeight: 600 }}>{task.seriesId ? "↻ " : ""}{task.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {task.assignee ? <Avatar name={task.assignee} size={22} /> : null}
                    <PersonName task={task} empty="—" />
                  </div>
                  <div style={{ color: "var(--if-ink-2)" }}>{task.site ?? "—"}</div>
                  <div className="if-num" style={{ color: overdue ? "var(--if-coral)" : "var(--if-ink-2)" }}>{dueText(task)}</div>
                  <div>
                    <span className={`emp-status ${overdue && task.status !== "done" ? "bad" : statusTone(task.status)}`}>
                      {overdue && task.status !== "done" ? "Overdue" : statusLabel(task.status)}
                    </span>
                  </div>
                  <div>
                    {task.status === "new" ? (
                      <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 0, padding: "4px 8px" }} onClick={() => start(task.id)}>Start</button>
                    ) : task.status !== "done" ? (
                      <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 0, padding: "4px 8px" }} onClick={() => close(task.id)}>Done</button>
                    ) : (
                      <NavIcon name="chevronRight" size={14} color="var(--if-ink-3)" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ padding: 16, borderTop: "1px solid var(--if-cream-2)" }}>
            <label htmlFor="photo-list">Photo of the finished work</label>
            <input id="photo-list" type="file" accept="image/*" capture="environment" onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => setPhoto(String(reader.result));
              reader.readAsDataURL(file);
            }} />
            <label htmlFor="note-list" style={{ marginTop: 16 }}>Note</label>
            <input id="note-list" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Gate replaced" />
          </div>
        </div>
      ) : (
        <div className="panel" style={{ marginBottom: 16, padding: 0, overflow: "hidden" }}>
          <div className="task-toolbar" style={{ padding: "16px 16px 0" }}>
            <button type="button" className={`emp-chip${calMode === "week" ? " on" : ""}`} onClick={() => { setCalMode("week"); setWeekStart(mondayOf(today)); }}>Week</button>
            <button type="button" className={`emp-chip${calMode === "month" ? " on" : ""}`} onClick={() => setCalMode("month")}>Month</button>
            <div style={{ flex: 1 }} />
            <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 0 }} onClick={() => {
              if (calMode === "week") setWeekStart((start) => addUtcDays(start, -7));
              else setCursor((current) => shiftMonth(current.year, current.month, -1));
            }}>Previous</button>
            <strong style={{ fontSize: 13 }}>
              {calMode === "week" ? `Week of ${weekStart}` : monthLabel(cursor.year, cursor.month)}
            </strong>
            <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 0 }} onClick={() => {
              if (calMode === "week") setWeekStart((start) => addUtcDays(start, 7));
              else setCursor((current) => shiftMonth(current.year, current.month, 1));
            }}>Next</button>
          </div>
          {calMode === "week" ? (
            <div className="cal-week" style={{ border: 0, borderRadius: 0, marginTop: 16 }}>
              {weekCells.map((cell) => {
                const items = shown.filter((task) => dueKey(task) === cell.iso);
                return (
                  <div
                    key={cell.iso}
                    className={`cal-week-col${cell.iso === today ? " today" : ""}`}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const id = event.dataTransfer.getData("text/task-id");
                      if (id) void reschedule(id, cell.iso);
                    }}
                  >
                    <div className="cal-week-head">
                      <div style={{ fontSize: 10, color: "var(--if-ink-3)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                        {WEEKDAYS[weekCells.indexOf(cell)]}
                      </div>
                      <div className="if-num" style={{ fontSize: 18, fontWeight: 700, color: cell.iso === today ? "var(--if-green-deep)" : "var(--if-ink)", marginTop: 2 }}>{cell.day}</div>
                    </div>
                    {items.map((task) => (
                      <div
                        key={task.id}
                        className="cal-chip"
                        style={{ background: deptColor(task.department || task.site || task.assignee || "Task") }}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData("text/task-id", task.id);
                          event.dataTransfer.effectAllowed = "move";
                        }}
                      >
                        <div>{task.seriesId ? "↻ " : ""}{task.title}</div>
                        <div style={{ opacity: 0.85, fontWeight: 500 }}>{task.assignee ?? "Unassigned"}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="cal" style={{ padding: 16 }}>
              {WEEKDAYS.map((day) => (
                <div key={day} className="cal-head">{day}</div>
              ))}
              {cells.map((cell) => {
                const items = shown.filter((task) => dueKey(task) === cell.iso);
                const visible = items.slice(0, 3);
                const extra = items.length - visible.length;
                return (
                  <div
                    key={cell.iso}
                    className={`cal-day${cell.inMonth ? "" : " out"}${cell.iso === today ? " today" : ""}`}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const id = event.dataTransfer.getData("text/task-id");
                      if (id) void reschedule(id, cell.iso);
                    }}
                  >
                    <strong>{cell.day}</strong>
                    {visible.map((task) => (
                      <div
                        key={task.id}
                        className="cal-item"
                        draggable
                        onDragStart={(event) => {
                          event.stopPropagation();
                          event.dataTransfer.setData("text/task-id", task.id);
                          event.dataTransfer.effectAllowed = "move";
                        }}
                      >
                        {task.seriesId ? "↻ " : ""}{task.title}
                      </div>
                    ))}
                    {extra > 0 ? <div className="cal-item">+{extra} more</div> : null}
                  </div>
                );
              })}
            </div>
          )}
          <p className="muted" style={{ margin: 0, padding: 16 }}>Drag a task onto another day to reschedule that card only. Recurring tasks show ↻.</p>
        </div>
      )}
    </div>
  );
}

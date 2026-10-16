"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, type Session } from "@/lib/api";

type SearchHit = {
  people: { id: string; name: string; phone: string; href: string }[];
  tasks: { id: string; title: string; status: string; href: string }[];
  workflows: { id: string; name: string; href: string }[];
  sites: { id: string; name: string; href: string }[];
};

type AlertRow = { id: string; message: string; status: string; createdAt: string; person: string | null };

const labels: Record<string, string> = {
  home: "Home",
  setup: "Setup",
  employees: "Employees",
  "check-in": "Check in",
  sites: "Geofences",
  dashboard: "Dashboard",
  "on-duty": "Dashboard",
  attendance: "Attendance",
  review: "Review",
  roster: "Shifts",
  map: "Live map",
  tasks: "Tasks",
  alerts: "Alerts",
  workflows: "Workflows",
  leave: "Leave",
  brain: "Business Brain",
  brief: "Weekly brief",
  copilot: "AI copilot",
  architecture: "How this works",
  why: "Show why",
  visits: "Visits",
  days: "Attendance",
  billing: "Billing",
  "app-health": "App health",
  reports: "Reports",
  templates: "Templates",
  schedule: "Schedules",
  people: "People",
  leaderboard: "Targets",
  new: "Add employee",
  edit: "Personal & ID",
  assignment: "Assignment",
  invite: "Invite",
  import: "Import CSV",
  test: "Test",
};

const managerPages = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/setup", label: "Setup" },
  { href: "/employees", label: "Employees" },
  { href: "/sites", label: "Geofences" },
  { href: "/attendance", label: "Attendance" },
  { href: "/review", label: "Review" },
  { href: "/roster", label: "Shifts" },
  { href: "/map", label: "Live map" },
  { href: "/tasks", label: "Tasks" },
  { href: "/leaderboard", label: "Targets" },
  { href: "/alerts", label: "Alerts" },
  { href: "/alerts/new", label: "New alert rule" },
  { href: "/workflows", label: "Workflows" },
  { href: "/leave", label: "Leave" },
  { href: "/reports", label: "Reports" },
  { href: "/reports/templates", label: "Report templates" },
  { href: "/reports/saved", label: "Saved reports" },
  { href: "/reports/schedule", label: "Report schedules" },
  { href: "/brain", label: "Business Brain" },
  { href: "/brief", label: "Weekly brief" },
  { href: "/copilot", label: "AI copilot" },
  { href: "/copilot/architecture", label: "How the AI thinks" },
  { href: "/copilot/settings", label: "AI model settings" },
  { href: "/check-in", label: "Check in" },
  { href: "/billing", label: "Billing" },
  { href: "/pricing", label: "Pricing" },
];

const employeePages = [
  { href: "/home", label: "Home" },
  { href: "/check-in", label: "Check in" },
  { href: "/visits", label: "My visits" },
  { href: "/tasks", label: "My tasks" },
  { href: "/leave", label: "Leave" },
  { href: "/days", label: "My days" },
];

const createItems = [
  { href: "/employees/new", label: "New employee" },
  { href: "/tasks", label: "New task" },
  { href: "/workflows", label: "New workflow" },
  { href: "/alerts/new", label: "New rule" },
];

function crumbs(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return ["Home"];
  return parts
    .filter((part) => !/^[0-9a-f-]{8,}$/i.test(part))
    .map((part) => labels[part] ?? part.replace(/-/g, " "));
}

function chord() {
  if (typeof navigator === "undefined") return "Ctrl+K";
  return /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl+K";
}

export function TopBar({
  session,
  employee,
  onLogout,
  onLogoutAll,
}: {
  session: Session;
  employee: boolean;
  onLogout: () => void;
  onLogoutAll?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState<"search" | "create" | "bell" | "profile" | "help" | null>(null);
  const pendingG = useRef(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit>({ people: [], tasks: [], workflows: [], sites: [] });
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const paletteRef = useRef<HTMLInputElement>(null);
  const barRef = useRef<HTMLElement>(null);

  const pages = (employee ? employeePages : managerPages).filter((page) =>
    page.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const unread = alerts.filter((row) => row.status !== "acknowledged").length;
  const trail = crumbs(pathname);
  const shortcut = chord();

  useEffect(() => {
    if (employee) return;
    let cancelled = false;
    async function load() {
      try {
        const body = await api<{ alerts: AlertRow[] }>("/alerts", {}, session.token);
        if (!cancelled) setAlerts(body.alerts.slice(0, 20));
      } catch {
        if (!cancelled) setAlerts([]);
      }
    }
    load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [employee, session.token]);

  useEffect(() => {
    if (open !== "search") return;
    const q = query.trim();
    if (!q) {
      setHits({ people: [], tasks: [], workflows: [], sites: [] });
      return;
    }
    const timer = window.setTimeout(() => {
      api<SearchHit>(`/search?q=${encodeURIComponent(q.slice(0, 40))}`, {}, session.token)
        .then(setHits)
        .catch(() => setHits({ people: [], tasks: [], workflows: [], sites: [] }));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [open, query, session.token]);

  useEffect(() => {
    if (open === "search") paletteRef.current?.focus();
  }, [open]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const typing = (event.target as HTMLElement | null)?.closest("input, textarea, select");
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen("search");
      }
      if (!typing && event.key === "?" ) {
        event.preventDefault();
        setOpen("help");
      }
      if (!typing && event.key.toLowerCase() === "g") pendingG.current = true;
      else if (!typing && pendingG.current && event.key.toLowerCase() === "t") {
        event.preventDefault();
        pendingG.current = false;
        router.push("/tasks");
      } else {
        pendingG.current = false;
      }
      if (event.key === "Escape") setOpen(null);
    }
    function onClick(event: MouseEvent) {
      const target = event.target as Node;
      if (barRef.current?.contains(target)) return;
      if (document.getElementById("if7-palette")?.contains(target)) return;
      setOpen(null);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, []);

  function go(href: string) {
    setOpen(null);
    setQuery("");
    router.push(href);
  }

  const initial = (session.user.name || session.user.phone || "U").slice(0, 1).toUpperCase();
  const hasHits = hits.people.length + hits.tasks.length + hits.workflows.length + hits.sites.length > 0;

  return (
    <>
      <header className="topbar" ref={barRef}>
        <nav className="crumb" aria-label="Breadcrumb">
          {trail.map((item, index) => (
            <span key={`${item}-${index}`}>
              {index > 0 ? <span className="crumb-sep">/</span> : null}
              {item}
            </span>
          ))}
        </nav>
        <button type="button" className="topbar-search" onClick={() => setOpen("search")}>
          Search people, tasks, sites
          <kbd>{shortcut}</kbd>
        </button>
        <div className="topbar-actions">
          {employee ? null : (
            <div className="topbar-menu">
              <button type="button" className="btn topbar-btn" onClick={() => setOpen(open === "create" ? null : "create")}>
                Create
              </button>
              {open === "create" ? (
                <div className="popover">
                  {createItems.map((item) => (
                    <Link key={item.href} href={item.href} onClick={() => setOpen(null)}>{item.label}</Link>
                  ))}
                </div>
              ) : null}
            </div>
          )}
          {employee ? null : (
            <div className="topbar-menu">
              <button type="button" className="icon-btn" aria-label="Alerts" onClick={() => setOpen(open === "bell" ? null : "bell")}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M18 8A6 6 0 1 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unread > 0 ? <span className="bell-dot">{unread > 9 ? "9+" : unread}</span> : null}
              </button>
              {open === "bell" ? (
                <div className="popover bell-pop">
                  {alerts.length === 0 ? <div className="muted">No alerts yet.</div> : null}
                  {alerts.map((row) => (
                    <Link key={row.id} href="/alerts" onClick={() => setOpen(null)}>
                      <strong>{row.message}</strong>
                      <span className="muted">
                        {row.person ? `${row.person} · ` : ""}
                        {new Date(row.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        {row.status === "acknowledged" ? "" : ` · ${row.status}`}
                      </span>
                    </Link>
                  ))}
                  <Link href="/alerts" onClick={() => setOpen(null)}>Open alerts</Link>
                </div>
              ) : null}
            </div>
          )}
          <div className="topbar-menu">
            <button type="button" className="avatar" aria-label="Profile" onClick={() => setOpen(open === "profile" ? null : "profile")}>
              {initial}
            </button>
            {open === "profile" ? (
              <div className="popover">
                <div className="muted" style={{ padding: "8px 12px" }}>
                  {session.user.name || session.user.phone}
                </div>
                {employee ? null : <Link href="/setup" onClick={() => setOpen(null)}>Settings</Link>}
                <button type="button" onClick={onLogout}>Sign out</button>
                <button type="button" onClick={onLogoutAll}>Sign out of all devices</button>
              </div>
            ) : null}
          </div>
        </div>
      </header>
      {open === "search" ? (
        <div className="palette-scrim" onClick={() => setOpen(null)}>
          <div id="if7-palette" className="palette" role="dialog" aria-label="Search" onClick={(event) => event.stopPropagation()}>
            <input
              ref={paletteRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find people, tasks, sites, workflows"
            />
            <div className="palette-list">
              {pages.length > 0 ? (
                <>
                  <div className="palette-label">Pages</div>
                  {pages.map((page) => (
                    <button type="button" key={page.href} onClick={() => go(page.href)}>{page.label}</button>
                  ))}
                </>
              ) : null}
              {hits.people.length ? <div className="palette-label">People</div> : null}
              {hits.people.map((row) => (
                <button type="button" key={row.id} onClick={() => go(row.href)}>
                  {row.name}
                  <span className="muted">Person · {row.phone}</span>
                </button>
              ))}
              {hits.tasks.length ? <div className="palette-label">Tasks</div> : null}
              {hits.tasks.map((row) => (
                <button type="button" key={row.id} onClick={() => go(row.href)}>
                  {row.title}
                  <span className="muted">Task · {row.status.replace("_", " ")}</span>
                </button>
              ))}
              {hits.sites.length ? <div className="palette-label">Sites</div> : null}
              {hits.sites.map((row) => (
                <button type="button" key={row.id} onClick={() => go(row.href)}>
                  {row.name}
                  <span className="muted">Site</span>
                </button>
              ))}
              {hits.workflows.length ? <div className="palette-label">Workflows</div> : null}
              {hits.workflows.map((row) => (
                <button type="button" key={row.id} onClick={() => go(row.href)}>
                  {row.name}
                  <span className="muted">Workflow</span>
                </button>
              ))}
              {query.trim() && pages.length === 0 && !hasHits ? (
                <div className="muted" style={{ padding: 12 }}>Nothing matches in this company.</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {open === "help" ? (
        <div className="palette-scrim" onClick={() => setOpen(null)}>
          <div className="palette" role="dialog" aria-label="Shortcuts" onClick={(event) => event.stopPropagation()}>
            <div className="palette-label">Shortcuts</div>
            <div className="muted" style={{ padding: 12, lineHeight: 1.6 }}>
              {shortcut} search · g then t tasks · ? this sheet · Esc close
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

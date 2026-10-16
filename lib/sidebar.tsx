"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { api, saveSession, type Session } from "@/lib/api";
import { Avatar, initialsFor } from "@/lib/avatar";
import { IFLogo } from "@/lib/if-logo";
import { NavIcon, type NavIconName } from "@/lib/nav-icon";

type Item = {
  href?: string;
  id: string;
  icon: NavIconName;
  label: string;
  badge?: string;
  liveBadge?: boolean;
  held?: string;
  admin?: boolean;
  match?: "exact" | "prefix";
};

type Group = { label: string | null; items: Item[] };

const managerGroups: Group[] = [
  {
    label: null,
    items: [
      { id: "dashboard", href: "/dashboard", icon: "home", label: "Dashboard", match: "prefix" },
      { id: "map", href: "/map", icon: "map", label: "Live map", match: "prefix" },
      { id: "check-in", href: "/check-in", icon: "pin", label: "Check in", match: "prefix" },
    ],
  },
  {
    label: "Workforce",
    items: [
      { id: "employees", href: "/employees", icon: "users", label: "Employees", match: "prefix" },
      { id: "attendance", href: "/attendance", icon: "clock", label: "Attendance", match: "prefix" },
      { id: "shifts", href: "/roster", icon: "calendar", label: "Shifts", match: "prefix" },
      { id: "leave", href: "/leave", icon: "briefcase", label: "Leave", match: "prefix" },
      { id: "review", href: "/review", icon: "check", label: "Review", match: "prefix" },
    ],
  },
  {
    label: "Operations",
    items: [
      { id: "tasks", href: "/tasks", icon: "check", label: "Tasks", match: "prefix" },
      { id: "targets", href: "/leaderboard", icon: "target", label: "Targets", match: "prefix" },
      { id: "sales", icon: "chart", label: "Sales", held: "Field-sales rupee targets stay off this product." },
    ],
  },
  {
    label: "Automation",
    items: [
      { id: "ai", href: "/copilot", icon: "target", label: "AI copilot", match: "prefix" },
      { id: "alerts", href: "/alerts", icon: "bell", label: "Alerts", match: "prefix" },
      { id: "workflow", href: "/workflows", icon: "arrow_up_right", label: "Workflows", match: "prefix" },
      { id: "geofences", href: "/sites", icon: "pin", label: "Geofences", match: "prefix" },
    ],
  },
  {
    label: "Knowledge",
    items: [
      { id: "brain", href: "/brain", icon: "brain", label: "Business Brain", match: "prefix", liveBadge: true },
    ],
  },
  {
    label: "Reporting",
    items: [{ id: "reports", href: "/reports", icon: "file_text", label: "Reports", badge: "AI", match: "prefix" }],
  },
  {
    label: "Finance",
    items: [
      { id: "payroll", href: "/payroll", icon: "wallet", label: "Payroll", match: "prefix" },
      { id: "billing", href: "/billing", icon: "wallet", label: "Billing", admin: true, match: "prefix" },
    ],
  },
  {
    label: "Setup",
    items: [
      { id: "setup", href: "/setup", icon: "settings", label: "Setup", match: "prefix" },
      { id: "health", href: "/app-health", icon: "settings", label: "App health", admin: true, match: "prefix" },
    ],
  },
];

const employeeGroups: Group[] = [
  {
    label: null,
    items: [
      { id: "home", href: "/home", icon: "home", label: "Home", match: "exact" },
      { id: "check-in", href: "/check-in", icon: "pin", label: "Check in", match: "prefix" },
    ],
  },
  {
    label: "You",
    items: [
      { id: "visits", href: "/visits", icon: "map", label: "Visits", match: "prefix" },
      { id: "tasks", href: "/tasks", icon: "check", label: "Tasks", match: "prefix" },
      { id: "leave", href: "/leave", icon: "briefcase", label: "Leave", match: "prefix" },
      { id: "days", href: "/days", icon: "clock", label: "Attendance", match: "prefix" },
      { id: "pay", href: "/payroll", icon: "wallet", label: "Pay", match: "prefix" },
    ],
  },
];

function BrainBadge({ token }: { token: string }) {
  const [score, setScore] = useState<number | null>(null);
  useEffect(() => {
    api<{ score?: number }>("/brain", {}, token)
      .then((body) => setScore(typeof body.score === "number" ? body.score : null))
      .catch(() => setScore(null));
  }, [token]);
  if (score == null) return null;
  return <span className="nav-badge">{score}%</span>;
}

function isOn(pathname: string, item: Item) {
  if (!item.href) return false;
  if (item.match === "exact") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function peopleHref(pathname: string) {
  return pathname.startsWith("/people/");
}

export function Sidebar({
  session,
  employee,
  onLogout,
  onSession,
}: {
  session: Session;
  employee: boolean;
  onLogout: () => void;
  onSession?: (next: Session) => void;
}) {
  const pathname = usePathname();
  const admin = session.user.role === "admin";
  const groups = employee ? employeeGroups : managerGroups;
  const mark = initialsFor(session.workspace.name || "IF");
  const sub = session.workspace.teamSize || session.workspace.industry || "Workspace";
  const [openWs, setOpenWs] = useState(false);
  const [spaces, setSpaces] = useState<{ id: string; name: string; role: string; current: boolean }[]>([]);

  async function loadSpaces() {
    const body = await api<{ workspaces: { id: string; name: string; role: string; current: boolean }[] }>("/workspaces", {}, session.token);
    setSpaces(body.workspaces);
    setOpenWs(true);
  }

  async function pickSpace(workspaceId: string) {
    const next = await api<Session>("/workspaces/switch", { method: "POST", body: JSON.stringify({ workspaceId }) }, session.token);
    saveSession(next);
    onSession?.(next);
    setOpenWs(false);
    window.location.reload();
  }

  return (
    <aside className="side">
      <div className="side-logo">
        <IFLogo size={32} />
      </div>

      <div className="side-ws" style={{ position: "relative" }}>
        <button type="button" className="side-ws-btn" onClick={() => (openWs ? setOpenWs(false) : void loadSpaces().catch(() => undefined))}>
          <div className="side-ws-mark">
            {session.workspace.logoDataUrl ? (
              <img src={session.workspace.logoDataUrl} alt="" width={28} height={28} />
            ) : (
              mark
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="side-ws-name">{session.workspace.name || "InField 7"}</div>
            <div className="side-ws-sub">{sub}</div>
          </div>
          <NavIcon name="chevronDown" size={18} color="var(--if-ink-3)" />
        </button>
        {openWs ? (
          <div className="popover" style={{ position: "absolute", left: 12, right: 12, zIndex: 20, background: "var(--if-paper)", borderRadius: 12, padding: 8, boxShadow: "var(--if-shadow)" }}>
            {spaces.map((row) => (
              <button key={row.id} type="button" className="nav-link" style={{ width: "100%", border: 0, background: "none", textAlign: "left" }} onClick={() => void pickSpace(row.id)}>
                <span style={{ flex: 1 }}>{row.name}</span>
                {row.current ? <span className="nav-badge">Now</span> : <span className="muted">{row.role}</span>}
              </button>
            ))}
            <Link href={employee ? "/home" : "/setup"} className="nav-link" onClick={() => setOpenWs(false)}>Company setup</Link>
          </div>
        ) : null}
      </div>

      <nav className="side-nav" aria-label="Main">
        {groups.map((group) => (
          <div key={group.label ?? "top"} className="nav-group">
            {group.label ? <div className="nav-label">{group.label}</div> : null}
            {group.items.map((item) => {
              if (item.admin && !admin) return null;
              const on = !item.held && (isOn(pathname, item) || (item.id === "targets" && peopleHref(pathname)));
              const color = on ? "var(--if-green-deep)" : "var(--if-ink-3)";
              if (item.held) {
                return (
                  <span key={item.id} className="nav-link held" title={item.held}>
                    <NavIcon name={item.icon} size={20} color="var(--if-ink-3)" />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    <span className="nav-badge">Off</span>
                  </span>
                );
              }
              return (
                <Link key={item.id} href={item.href!} className={on ? "nav-link active" : "nav-link"}>
                  <NavIcon name={item.icon} size={20} color={color} strokeWidth={on ? 2.2 : 1.8} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.liveBadge ? <BrainBadge token={session.token} /> : item.badge ? <span className="nav-badge">{item.badge}</span> : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="side-foot">
        <div className="side-user">
          <Avatar name={session.user.name || session.user.phone} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="side-user-name">{session.user.name || session.user.phone}</div>
            <div className="side-ws-sub">{employee ? "Field" : session.user.role === "admin" ? "Admin" : "Manager"}</div>
          </div>
          {employee ? (
            <button type="button" className="side-gear" aria-label="Sign out" onClick={onLogout}>
              <NavIcon name="settings" size={18} color="var(--if-ink-3)" />
            </button>
          ) : (
            <Link href="/setup" className="side-gear" aria-label="Settings">
              <NavIcon name="settings" size={18} color="var(--if-ink-3)" />
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
}

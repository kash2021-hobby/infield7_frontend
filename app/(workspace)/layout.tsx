"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, clearSession, loadSession, saveSession, type Session } from "@/lib/api";
import { Sidebar } from "@/lib/sidebar";
import { TopBar } from "./top-bar";

const managerOnly = [
  "/setup",
  "/employees",
  "/billing",
  "/app-health",
  "/sites",
  "/dashboard",
  "/on-duty",
  "/attendance",
  "/review",
  "/roster",
  "/map",
  "/leaderboard",
  "/alerts",
  "/workflows",
  "/brain",
  "/brief",
  "/copilot",
  "/reports",
  "/people",
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const current = loadSession();
    if (!current) {
      router.replace("/login");
      return;
    }
    setSession(current);
    api<{ user: Session["user"]; workspace: Session["workspace"] }>("/me", {}, current.token)
      .then((body) => {
        const next = { ...current, user: body.user, workspace: body.workspace };
        saveSession(next);
        setSession(next);
      })
      .catch(() => undefined);
    const isEmployee = current.user.role === "employee";
    if (isEmployee && managerOnly.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
      router.replace("/home");
    }
  }, [pathname, router]);

  async function logout(allDevices = false) {
    const current = loadSession();
    if (current) {
      await api("/auth/logout", { method: "POST", body: JSON.stringify({ all_devices: allDevices }) }, current.token).catch(() => undefined);
    }
    clearSession();
    router.replace("/login");
  }

  if (!session) return null;

  const employee = session.user.role === "employee";

  return (
    <div className="shell">
      <Sidebar session={session} employee={employee} onLogout={() => void logout()} onSession={setSession} />
      <div className="workspace">
        <TopBar session={session} employee={employee} onLogout={() => void logout()} onLogoutAll={() => void logout(true)} />
        <main className={pathname === "/map" ? "main main-map" : "main"}>{children}</main>
      </div>
    </div>
  );
}

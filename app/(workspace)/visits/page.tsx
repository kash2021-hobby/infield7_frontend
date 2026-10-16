"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, loadSession } from "@/lib/api";

type Stop = { siteId: string; site: string; lat: number; lng: number; km: number; tasks: { id: string; title: string }[] };
type Done = { id: string; site: string | null; lat: number; lng: number; km: number; late: boolean; checkedInAt: string; checkedOutAt: string | null; hours: number | null };
type Route = { day: string; done: Done[]; remaining: Stop[]; skipped: { id: string; title: string }[]; kmDone: number; kmRemaining: number; locked?: boolean };

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export default function MyVisitsPage() {
  const router = useRouter();
  const [route, setRoute] = useState<Route | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async (origin?: { lat: number; lng: number }) => {
    const session = loadSession();
    if (!session) return;
    if (session.user.role !== "employee") {
      router.replace("/on-duty");
      return;
    }
    const query = origin ? `?lat=${origin.lat}&lng=${origin.lng}` : "";
    setRoute(await api<Route>(`/visits${query}`, {}, session.token));
  }, [router]);

  useEffect(() => {
    const session = loadSession();
    if (!session) return;
    if (session.user.role !== "employee") {
      router.replace("/on-duty");
      return;
    }
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          load({ lat: position.coords.latitude, lng: position.coords.longitude }).catch((err: unknown) => {
            setError(err instanceof Error ? err.message : "Could not load");
          });
        },
        () => {
          load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
        },
        { maximumAge: 60_000, timeout: 4000 },
      );
      return;
    }
    load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
  }, [load, router]);

  const next = route?.remaining[0] ?? null;
  const empty = route && route.done.length === 0 && route.remaining.length === 0;

  return (
    <div>
      <h1 className="page-title">My visits</h1>
      <p className="sub">Today&apos;s sites, nearest next unless your manager sent an order. Check in at a site to mark it done.</p>
      {error ? <div className="error">{error}</div> : null}

      <div className="grid" style={{ marginBottom: 16 }}>
        <div className="panel">
          <div className="muted">Done</div>
          <div className="price">{route?.done.length ?? 0}</div>
          <p className="muted" style={{ marginBottom: 0 }}>{route?.kmDone ? `${route.kmDone} km so far` : "none yet"}</p>
        </div>
        <div className="panel">
          <div className="muted">Next</div>
          <div className="price" style={{ fontSize: 22 }}>{next ? next.site : "—"}</div>
          <p className="muted" style={{ marginBottom: 0 }}>{next ? `${next.km} km` : "nothing left"}</p>
        </div>
      </div>

      {next ? (
        <div className="actions" style={{ marginBottom: 16 }}>
          <Link className="btn" href="/check-in" style={{ width: "auto", textDecoration: "none", display: "inline-block" }}>
            Check in at {next.site}
          </Link>
        </div>
      ) : null}

      <div className="panel">
        <strong>Order for today</strong>
        {route?.locked ? <p className="muted" style={{ margin: "8px 0 0" }}>Your manager sent this order.</p> : null}
        {empty ? <p className="sub" style={{ margin: "8px 0 0" }}>Nothing to visit today.</p> : null}
        <ol className="visit-list">
          {route?.done.map((stop) => (
            <li key={stop.id} className="visit-item done">
              <div>
                <div>{stop.site ?? "Field"}</div>
                <div className="muted">
                  {clock(stop.checkedInAt)}
                  {stop.checkedOutAt ? `–${clock(stop.checkedOutAt)}` : " · on duty"}
                  {stop.late ? " · late" : ""}
                </div>
              </div>
              <span className="pill">Done</span>
            </li>
          ))}
          {route?.remaining.map((stop) => (
            <li key={stop.siteId} className="visit-item">
              <div>
                <div>{stop.site}</div>
                <div className="muted">{stop.km} km · {stop.tasks.map((task) => task.title).join(", ")}</div>
              </div>
            </li>
          ))}
        </ol>
        {route && route.skipped.length > 0 ? (
          <p className="muted" style={{ marginBottom: 0 }}>
            No site: {route.skipped.map((task) => task.title).join(", ")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

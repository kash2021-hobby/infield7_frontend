"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, loadSession, type Session } from "@/lib/api";
import { NavIcon } from "@/lib/nav-icon";

const OUTBOX = "if7-checkin-outbox";

type Queued = { clientId: string; lat: number; lng: number; accuracyM: number; selfieBase64?: string; capturedAt?: string };
type Site = { id: string; name: string; address: string | null; lat: number; lng: number; radiusM: number };
type MyDay = {
  open: { id: string; site: string | null; checkedInAt: string } | null;
  site: Site | null;
  today: { id: string; site: string | null; checkedInAt: string; checkedOutAt: string | null; hours: number | null }[];
  hoursToday: number;
  hoursWeek: number;
  streak: number;
};
type TaskRow = { id: string; title: string; dueOn: string | null; status: string; site: string | null };
type Fix = { lat: number; lng: number; accuracyM: number };

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function compactHours(hours: number) {
  const minutes = Math.max(0, Math.round(hours * 60));
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function firstName(session: Session | null) {
  const name = session?.user.name?.trim();
  if (!name) return "there";
  return name.split(/\s+/)[0];
}

function todayLine() {
  return new Date().toLocaleString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function distanceM(a: Fix, site: Site) {
  const radius = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(site.lat - a.lat);
  const dLng = toRad(site.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(site.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

function readOutbox(): Queued[] {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX) ?? "[]") as Queued[];
  } catch {
    return [];
  }
}

function dueLabel(dueOn: string | null) {
  if (!dueOn) return "Open";
  const day = dueOn.slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  if (day === today) return "Today";
  return new Date(`${day}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function CheckInPage() {
  const camera = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<string | undefined>(undefined);
  const [session, setSession] = useState<Session | null>(null);
  const [granted, setGranted] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [queued, setQueued] = useState(0);
  const [busy, setBusy] = useState(false);
  const [day, setDay] = useState<MyDay | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [fix, setFix] = useState<Fix | null>(null);
  const [tick, setTick] = useState(0);

  async function loadDay(current: Session) {
    try {
      const [next, listed] = await Promise.all([
        api<MyDay>("/my-day", {}, current.token),
        api<{ tasks: TaskRow[] }>("/tasks", {}, current.token).catch(() => ({ tasks: [] as TaskRow[] })),
      ]);
      setDay(next);
      setTasks(listed.tasks.filter((task) => task.status !== "done"));
    } catch {
      setDay(null);
    }
  }

  useEffect(() => {
    const current = loadSession();
    if (!current) return;
    setSession(current);
    setQueued(readOutbox().length);
    api<{ granted: boolean }>("/consent", {}, current.token)
      .then((body) => setGranted(body.granted))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
    loadDay(current);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation || granted !== true) return;
    const watch = navigator.geolocation.watchPosition(
      (position) => {
        setFix({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyM: position.coords.accuracy,
        });
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [granted]);

  const site = day?.site ?? null;
  const metres = site && fix ? Math.round(distanceM(fix, site)) : null;
  const inside = metres !== null && site ? metres <= site.radiusM : null;

  const liveHours = (() => {
    if (!day) return 0;
    if (!day.open) return day.hoursToday ?? 0;
    const closed = (day.today ?? []).filter((row) => row.id !== day.open?.id).reduce((sum, row) => sum + (row.hours ?? 0), 0);
    return closed + (Date.now() - new Date(day.open.checkedInAt).getTime()) / 3_600_000;
  })();
  void tick;

  const schedule = tasks
    .filter((task) => !task.dueOn || task.dueOn.slice(0, 10) <= new Date().toISOString().slice(0, 10))
    .slice(0, 3);

  async function checkOut() {
    if (!session || !day?.open) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const here = await new Promise<GeolocationPosition | null>((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { enableHighAccuracy: true, timeout: 10000 });
      });
      const result = await api<{ hours: number; early: boolean; site: string | null }>(
        "/check-outs",
        {
          method: "POST",
          body: JSON.stringify({
            checkinId: day.open.id,
            capturedAt: new Date().toISOString(),
            ...(here ? { lat: here.coords.latitude, lng: here.coords.longitude, accuracyM: here.coords.accuracy } : {}),
          }),
        },
        session.token,
      );
      const early = result.early ? " This is before your shift ends, so your manager will look it over." : "";
      setMessage(`Checked out${result.site ? ` of ${result.site}` : ""}. ${compactHours(result.hours)} on duty.${early}`);
      await loadDay(session);
    } catch (err) {
      setError(err instanceof TypeError ? "No connection. Check out again when you are back online." : err instanceof Error ? err.message : "Check-out failed");
    } finally {
      setBusy(false);
    }
  }

  async function flush(current: Session) {
    const items = readOutbox();
    const left: Queued[] = [];
    for (const item of items) {
      try {
        await api("/check-ins", { method: "POST", body: JSON.stringify(item) }, current.token);
      } catch {
        left.push(item);
      }
    }
    localStorage.setItem(OUTBOX, JSON.stringify(left));
    setQueued(left.length);
    return items.length - left.length;
  }

  async function allow() {
    if (!session) return;
    setError("");
    await api("/consent", { method: "POST", body: "{}" }, session.token);
    setGranted(true);
  }

  async function sendCheckIn(shot: string | undefined) {
    const current = loadSession();
    if (!current) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (granted !== true) {
        await api("/consent", { method: "POST", body: "{}" }, current.token);
        setGranted(true);
      }
      const sent = await flush(current);
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Location is not available in this browser."));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30_000 });
      }).catch((err: unknown) => {
        if (fix) {
          return { coords: { latitude: fix.lat, longitude: fix.lng, accuracy: fix.accuracyM } } as GeolocationPosition;
        }
        if (err instanceof GeolocationPositionError && err.code === err.PERMISSION_DENIED) {
          throw new Error("Allow location in the browser, then tap Check-In again.");
        }
        throw new Error("Could not get your location. Keep Location on and try again.");
      });
      const payload: Queued = {
        clientId: crypto.randomUUID(),
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracyM: Math.max(position.coords.accuracy || 0, 1),
        selfieBase64: shot,
        capturedAt: new Date().toISOString(),
      };
      try {
        const result = await api<{ site?: string; late?: boolean; replayed?: boolean; review?: string }>(
          "/check-ins",
          { method: "POST", body: JSON.stringify(payload) },
          current.token,
        );
        const late = result.late ? " Marked late." : "";
        const review = result.review === "pending" ? " Your manager will look it over." : "";
        setMessage(result.replayed ? "Already recorded." : `Checked in at ${result.site}.${late}${review}${sent ? ` Sent ${sent} saved check-in${sent === 1 ? "" : "s"}.` : ""}`);
        await loadDay(current);
      } catch (err) {
        if (err instanceof TypeError) {
          const next = [...readOutbox(), payload];
          localStorage.setItem(OUTBOX, JSON.stringify(next));
          setQueued(next.length);
          setMessage("Saved on this phone. It will send when the connection returns.");
        } else {
          throw err;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check-in failed");
    } finally {
      setBusy(false);
      selfieRef.current = undefined;
    }
  }

  function startCheckIn() {
    if (!session || busy) return;
    const input = camera.current;
    const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    if (!mobile || !input) {
      void sendCheckIn(undefined);
      return;
    }
    let finished = false;
    const finish = (shot?: string) => {
      if (finished) return;
      finished = true;
      window.removeEventListener("focus", onFocus);
      void sendCheckIn(shot);
    };
    const onFocus = () => {
      window.setTimeout(() => finish(undefined), 400);
    };
    const previous = input.onchange;
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      (event.target as HTMLInputElement).value = "";
      input.onchange = previous;
      if (!file) {
        finish(undefined);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => finish(String(reader.result));
      reader.readAsDataURL(file);
    };
    window.addEventListener("focus", onFocus);
    input.click();
  }

  if (granted === false) {
    return (
      <div className="ci-page">
        <h1 className="ci-title">Location for check-in</h1>
        <p className="sub">
          InField uses your location to confirm you are inside a site. It is stored with your attendance for this company. You can refuse, and then check-in stays unavailable.
        </p>
        {error ? <div className="error">{error}</div> : null}
        <button className="ci-go" type="button" onClick={allow}>I agree</button>
      </div>
    );
  }

  const siteTitle = day?.open?.site || site?.name || session?.workspace.name || "Your site";
  const siteLine = day?.open
    ? `Since ${clock(day.open.checkedInAt)}`
    : site
      ? `${site.address || `${site.lat.toFixed(4)}, ${site.lng.toFixed(4)}`} · ${site.radiusM}m radius${metres !== null ? ` · ${metres} m away` : ""}`
      : "Ask your manager to add a site, then stand inside the fence.";

  return (
    <div className="ci-page">
      <div className="ci-head">
        <h1 className="ci-title">{greeting()}, {firstName(session)}</h1>
        <div className="ci-sub">{todayLine()}</div>
      </div>

      {error ? <div className="error">{error}</div> : null}
      {message ? <div className="devcode">{message}</div> : null}
      {queued > 0 ? <p className="sub">{queued} check-in waiting to send.</p> : null}

      <div className="ci-card">
        <div className="ci-map">
          <div className="ci-ring" />
          <div className={`ci-you${inside === false ? " out" : ""}`} />
          <div className="ci-chip">
            <span className={`live-dot ${inside === false ? "alert" : "onsite"}`} />
            {inside === false ? "Outside work area" : inside ? "Inside work area" : "Finding you…"}
          </div>
        </div>
        <div className="ci-body">
          <div className="ci-k">{day?.open ? "Checked in" : "Today's site"}</div>
          <div className="ci-name">{siteTitle}</div>
          <div className="ci-meta">{siteLine}</div>
          {day?.open ? (
            <button className="ci-go" type="button" disabled={busy} onClick={() => void checkOut()}>
              <NavIcon name="check" size={22} color="var(--if-ink)" />
              {busy ? "Checking out" : "Check out"}
            </button>
          ) : (
            <>
              <input ref={camera} className="ci-file" type="file" accept="image/*" capture="user" />
              <button className="ci-go" type="button" disabled={busy} onClick={startCheckIn}>
                <NavIcon name="check" size={22} color="var(--if-ink)" />
                {busy ? "Checking in…" : "Tap to Check-In"}
              </button>
              <div className="ci-hint">
                <NavIcon name="camera" size={14} color="var(--if-ink-3)" />
                Phone check-in can take a selfie. On this computer it uses location only.
              </div>
            </>
          )}
        </div>
      </div>

      <div className="ci-stats">
        <div className="ci-stat">
          <div className="ci-stat-l">Hours</div>
          <div className="ci-stat-v green">{compactHours(liveHours)}</div>
        </div>
        <div className="ci-stat">
          <div className="ci-stat-l">This week</div>
          <div className="ci-stat-v">{compactHours(day?.hoursWeek ?? 0)}</div>
        </div>
        <div className="ci-stat">
          <div className="ci-stat-l">Streak</div>
          <div className="ci-stat-v amber">{day?.streak ?? 0} day{(day?.streak ?? 0) === 1 ? "" : "s"}</div>
        </div>
      </div>

      <div className="ci-sched">
        <div className="ci-sched-head">
          <div style={{ fontSize: 13, fontWeight: 700 }}>Today&apos;s schedule</div>
          <div style={{ fontSize: 11, color: "var(--if-ink-3)", fontWeight: 500 }}>{schedule.length} task{schedule.length === 1 ? "" : "s"}</div>
        </div>
        <div className="ci-card">
          {schedule.length === 0 ? (
            <p className="muted" style={{ padding: 16, margin: 0 }}>No visits or tasks lined up yet.</p>
          ) : (
            schedule.map((task, index) => (
              <Link key={task.id} href={`/tasks`} className="ci-row">
                <div className="ci-when">{dueLabel(task.dueOn)}</div>
                <span className={`live-dot ${index === 0 ? "onsite" : index === 1 ? "field" : "offline"}`} />
                <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>
                  {task.title}{task.site ? ` · ${task.site}` : ""}
                </div>
                <NavIcon name="chevronRight" size={16} color="var(--if-ink-4)" />
              </Link>
            ))
          )}
        </div>
      </div>

      <button
        className="btn secondary ci-sos"
        type="button"
        onClick={async () => {
          if (!session) return;
          setError("");
          try {
            await api("/sos", { method: "POST", body: "{}" }, session.token);
            setMessage("SOS sent to your manager.");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not send SOS");
          }
        }}
      >
        Send SOS
      </button>
    </div>
  );
}

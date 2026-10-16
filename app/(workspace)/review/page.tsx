"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { API_URL, api, loadSession, type Session } from "@/lib/api";
import { Avatar } from "@/lib/avatar";
import { NavIcon } from "@/lib/nav-icon";
import { ReportCrumbs } from "@/lib/reports";

type Flag = { id: string; label: string };

type Review = {
  id: string;
  person: string;
  phone: string;
  site: string | null;
  flags: Flag[];
  status: string;
  accuracyM: number;
  distanceM: number | null;
  checkedInAt: string;
  receivedAt: string;
  hasSelfie: boolean;
  reviewer: string | null;
  reviewedAt: string | null;
  note: string | null;
  checkedOutAt: string | null;
};

function localInput(iso: string) {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function when(value: string) {
  return new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function telHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits ? `tel:+${digits.length === 10 ? "91" : ""}${digits}` : "";
}

function flagTone(id: string) {
  if (id === "late" || id === "early_leave" || id === "no_checkout") return "wait";
  return "bad";
}

function Selfie({ id, token }: { id: string; token: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    fetch(`${API_URL}/check-ins/${id}/selfie`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => (response.ok ? response.blob() : Promise.reject()))
      .then((blob) => {
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => setFailed(true));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, token]);

  if (failed) return <div style={{ fontSize: 12, color: "var(--if-ink-3)" }}>Photo is no longer on the server.</div>;
  if (!src) return <div style={{ fontSize: 12, color: "var(--if-ink-3)" }}>Loading photo…</div>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="Check-in photo" style={{ width: 160, height: 200, objectFit: "cover", borderRadius: 16, display: "block" }} />
  );
}

export default function ReviewPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [tab, setTab] = useState<"pending" | "decided">("pending");
  const [flagFilter, setFlagFilter] = useState("");
  const [pendingItems, setPendingItems] = useState<Review[]>([]);
  const [decidedItems, setDecidedItems] = useState<Review[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [outTimes, setOutTimes] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async (current: Session) => {
    const [waiting, decided] = await Promise.all([
      api<{ checkins: Review[] }>("/check-ins/review?status=pending", {}, current.token),
      api<{ checkins: Review[] }>("/check-ins/review?status=decided", {}, current.token),
    ]);
    setPendingItems(waiting.checkins);
    setDecidedItems(decided.checkins);
  }, []);

  useEffect(() => {
    const current = loadSession();
    if (!current) return;
    setSession(current);
    refresh(current).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
  }, [refresh]);

  async function decide(id: string, decision: "approve" | "reject") {
    if (!session) return;
    if (decision === "reject" && !(notes[id] ?? "").trim()) {
      setError("Add a reason before rejecting");
      return;
    }
    setBusy(id);
    setError("");
    setNotice("");
    try {
      const outTime = decision === "approve" && outTimes[id] ? new Date(outTimes[id]).toISOString() : undefined;
      await api(
        `/check-ins/${id}/review`,
        { method: "POST", body: JSON.stringify({ decision, note: notes[id] || undefined, checkedOutAt: outTime }) },
        session.token,
      );
      setNotice(decision === "approve" ? "Attendance updated. This check-in now counts." : "Check-in left out of attendance.");
      await refresh(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(null);
    }
  }

  const pool = tab === "pending" ? pendingItems : decidedItems;
  const flagOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of [...pendingItems, ...decidedItems]) {
      for (const flag of item.flags) map.set(flag.id, flag.label);
    }
    return [...map.entries()];
  }, [pendingItems, decidedItems]);
  const items = flagFilter ? pool.filter((item) => item.flags.some((flag) => flag.id === flagFilter)) : pool;

  const kpis: [string, number, string][] = [
    ["Waiting", pendingItems.length, "var(--if-amber-deep)"],
    ["Decided", decidedItems.length, "var(--if-ink)"],
  ];

  return (
    <div className="emp-page">
      <div className="rpt-head">
        <div>
          <ReportCrumbs items={["Workforce", "Review"]} />
          <h1 className="page-title" style={{ margin: 0 }}>Review check-ins</h1>
          <p className="sub" style={{ margin: "6px 0 0" }}>
            Late, left early, no check-out, simulated location, weak GPS, or sent late from offline.
            Approve to count it. Reject leaves it out of attendance.
          </p>
        </div>
      </div>
      {error ? <div className="error">{error}</div> : null}
      {notice ? <div className="devcode">{notice}</div> : null}

      <div className="rpt-kpis" style={{ gridTemplateColumns: "repeat(2, minmax(0, 280px))", marginBottom: 16 }}>
        {kpis.map(([label, value, color]) => (
          <div key={label} className="panel emp-kpi">
            <div className="emp-kpi-label">{label}</div>
            <div className="emp-kpi-value" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="emp-filters">
        <button type="button" className={`emp-chip${tab === "pending" ? " on" : ""}`} onClick={() => { setTab("pending"); setFlagFilter(""); }}>
          Waiting {pendingItems.length}
        </button>
        <button type="button" className={`emp-chip${tab === "decided" ? " on" : ""}`} onClick={() => { setTab("decided"); setFlagFilter(""); }}>
          Decided {decidedItems.length}
        </button>
        {flagOptions.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`emp-chip${flagFilter === id ? " on" : ""}`}
            onClick={() => setFlagFilter(flagFilter === id ? "" : id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="panel" style={{ padding: 0 }}>
        <div style={{ padding: "14px 16px 8px", fontSize: 13, fontWeight: 700 }}>
          {tab === "pending" ? "Waiting" : "Decided"}
        </div>
        {items.length === 0 ? (
          <div className="emp-empty">
            {tab === "pending" ? "Nothing waiting. Every check-in is clear." : "No decisions in the last 30 days."}
          </div>
        ) : items.map((item) => (
          <div key={item.id} className="att-reg">
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <Avatar name={item.person} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{item.person}</div>
                <div className="if-num" style={{ fontSize: 12, color: "var(--if-ink-3)", marginTop: 2 }}>
                  {item.site ?? "Unknown site"} · {when(item.checkedInAt)}
                  {item.flags.some((flag) => flag.id === "offline") ? ` · arrived ${when(item.receivedAt)}` : ""}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {item.flags.map((flag) => (
                    <span key={flag.id} className={`emp-status ${flagTone(flag.id)}`}>{flag.label}</span>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: "var(--if-ink-3)", marginTop: 8 }}>
                  GPS ±{item.accuracyM} m{item.distanceM !== null ? ` · ${item.distanceM} m from centre` : ""}
                </div>
              </div>
              {tab === "decided" ? (
                <span className={`emp-status ${item.status === "approved" ? "ok" : "off"}`}>
                  <span className="emp-dot" />
                  {item.status === "approved" ? "Approved" : "Rejected"}
                </span>
              ) : null}
            </div>

            {item.hasSelfie && session ? (
              <div>
                {photo === item.id ? (
                  <Selfie id={item.id} token={session.token} />
                ) : (
                  <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 0 }} onClick={() => setPhoto(item.id)}>
                    Show photo
                  </button>
                )}
              </div>
            ) : null}

            {tab === "pending" ? (
              <>
                {item.flags.some((flag) => flag.id === "no_checkout") && !item.checkedOutAt ? (
                  <div>
                    <label htmlFor={`out-${item.id}`}>Real check-out time (optional)</label>
                    <input
                      id={`out-${item.id}`}
                      type="datetime-local"
                      min={localInput(item.checkedInAt)}
                      value={outTimes[item.id] ?? ""}
                      onChange={(event) => setOutTimes({ ...outTimes, [item.id]: event.target.value })}
                    />
                  </div>
                ) : null}
                <input
                  placeholder={item.status === "pending" ? "Reason (required to reject)" : "Note"}
                  value={notes[item.id] ?? ""}
                  onChange={(event) => setNotes({ ...notes, [item.id]: event.target.value })}
                />
                <div className="att-reg-actions">
                  <button type="button" className="btn" style={{ width: "auto", marginTop: 0 }} disabled={busy === item.id} onClick={() => void decide(item.id, "approve")}>
                    Approve
                  </button>
                  <button type="button" className="btn secondary" style={{ width: "auto", marginTop: 0 }} disabled={busy === item.id} onClick={() => void decide(item.id, "reject")}>
                    Reject
                  </button>
                  {telHref(item.phone) ? (
                    <a className="btn ghost" href={telHref(item.phone)} style={{ width: "auto", marginTop: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <NavIcon name="phone" size={14} color="var(--if-ink)" /> Call
                    </a>
                  ) : null}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: "var(--if-ink-3)" }}>
                {item.reviewer ?? "—"}{item.reviewedAt ? ` · ${when(item.reviewedAt)}` : ""}
                {item.note ? ` · “${item.note}”` : ""}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

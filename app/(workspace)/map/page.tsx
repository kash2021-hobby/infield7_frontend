"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, loadSession } from "@/lib/api";
import { Avatar, initialsFor } from "@/lib/avatar";
import { NavIcon } from "@/lib/nav-icon";
import { OsmMap, type OsmMapHandle } from "@/lib/osm-map";

type Presence = { userId: string; person: string; lat: number; lng: number; site: string | null; recordedAt: string };
type Site = { id: string; name: string; lat: number; lng: number; radiusM: number; kind?: string };
type Employee = { userId: string | null; name: string; phone: string; department: string | null; jobTitle: string | null; status: string };
type Alert = { userId: string | null; person: string | null; status: string };
type DutyRow = { userId: string; since: string; location: string };
type PinStatus = "onsite" | "field" | "alert" | "offline";
type Filter = "all" | PinStatus;

const POLL_MS = 30_000;

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function ago(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)} h ago`;
}

function hoursSince(iso: string) {
  const hours = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (hours < 0) return "—";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function statusOf(person: Presence, alertIds: Set<string>): PinStatus {
  if (alertIds.has(person.userId)) return "alert";
  if (person.site) return "onsite";
  return "field";
}

export default function LiveMapPage() {
  const mapRef = useRef<OsmMapHandle>(null);
  const [people, setPeople] = useState<Presence[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [alertIds, setAlertIds] = useState<Set<string>>(new Set());
  const [duty, setDuty] = useState<Record<string, DutyRow>>({});
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const session = loadSession();
    if (!session) return;
    const [presence, roster, alerts, board] = await Promise.all([
      api<{ people: Presence[]; sites: Site[] }>("/presence", {}, session.token),
      api<{ employees: Employee[] }>("/employees", {}, session.token),
      api<{ alerts: Alert[] }>("/alerts", {}, session.token),
      api<{ onDuty: DutyRow[] }>("/on-duty", {}, session.token),
    ]);
    setPeople(presence.people);
    setSites(presence.sites);
    setEmployees(roster.employees);
    setAlertIds(new Set(
      alerts.alerts
        .filter((row) => row.userId && (row.status === "open" || row.status === "escalated"))
        .map((row) => row.userId as string),
    ));
    setDuty(Object.fromEntries(board.onDuty.map((row) => [row.userId, row])));
    setError("");
  }, []);

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
    const timer = window.setInterval(() => {
      load().catch(() => undefined);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const liveIds = useMemo(() => new Set(people.map((person) => person.userId)), [people]);
  const offlinePeople = useMemo(
    () => employees.filter((row) => row.status === "active" && row.userId && !liveIds.has(row.userId)),
    [employees, liveIds],
  );

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return people.filter((person) => {
      const status = statusOf(person, alertIds);
      if (filter !== "all" && filter !== "offline" && status !== filter) return false;
      if (filter === "offline") return false;
      if (!needle) return true;
      return person.person.toLowerCase().includes(needle) || (person.site ?? "").toLowerCase().includes(needle);
    });
  }, [people, query, filter, alertIds]);

  const counts = useMemo(() => {
    let onsite = 0;
    let field = 0;
    let alert = 0;
    for (const person of people) {
      const status = statusOf(person, alertIds);
      if (status === "onsite") onsite += 1;
      else if (status === "field") field += 1;
      else alert += 1;
    }
    return { onsite, field, alert, offline: offlinePeople.length };
  }, [people, alertIds, offlinePeople.length]);

  const selected = people.find((person) => person.userId === selectedId) ?? null;
  const selectedEmployee = employees.find((row) => row.userId === selectedId);
  const selectedStatus = selected ? statusOf(selected, alertIds) : null;

  const statusLabel: Record<PinStatus, string> = {
    onsite: "On-site",
    field: "Travelling",
    alert: "Alert",
    offline: "Offline",
  };

  const roleChip = selectedEmployee?.jobTitle || selectedEmployee?.department || null;
  const fences = useMemo(
    () => sites
      .filter((site) => !query || site.name.toLowerCase().includes(query.trim().toLowerCase()))
      .map((site) => ({ id: site.id, lat: site.lat, lng: site.lng, radiusM: site.radiusM })),
    [sites, query],
  );

  return (
    <div className="live-map">
      <OsmMap
        ref={mapRef}
        pins={shown.map((person) => ({
          id: person.userId,
          lat: person.lat,
          lng: person.lng,
          label: initialsFor(person.person),
          className: statusOf(person, alertIds),
        }))}
        fences={fences}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      {error ? <div className="error live-map-error">{error}</div> : null}

      <div className="live-map-top">
        <label className="live-search">
          <NavIcon name="search" size={16} color="var(--if-ink-3)" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search employees, sites…"
            aria-label="Search employees and sites"
          />
        </label>
        <button
          type="button"
          className={`live-filter-btn${filtersOpen ? " on" : ""}`}
          aria-label="Filters"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <NavIcon name="filter" size={16} color="currentColor" />
        </button>
      </div>

      {filtersOpen ? (
        <div className="live-legend">
          {([
            ["all", `All ${people.length + offlinePeople.length}`],
            ["onsite", `On-site ${counts.onsite}`],
            ["field", `Travelling ${counts.field}`],
            ["alert", `Alert ${counts.alert}`],
            ["offline", `Offline ${counts.offline}`],
          ] as [Filter, string][]).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`live-chip ${id}${filter === id ? " on" : ""}`}
              onClick={() => setFilter(id)}
            >
              {id !== "all" ? <span className={`live-dot ${id}`} /> : null}
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="live-controls">
        <button type="button" className="live-ctrl green" aria-label="Fit everyone" onClick={() => mapRef.current?.fit()}>
          <NavIcon name="target" size={16} color="var(--if-green-deep)" />
        </button>
        <button type="button" className="live-ctrl" aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
          <NavIcon name="plus" size={16} color="var(--if-ink)" />
        </button>
      </div>

      <div className="live-sheet">
        <div className="live-sheet-handle" />
        {selected && selectedStatus ? (
          <>
            <div className="live-sheet-person">
              <Avatar name={selected.person} size={48} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{selected.person}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                  <span className={`live-dot ${selectedStatus}`} />
                  {statusLabel[selectedStatus]}
                  {selected.site ? ` · ${selected.site}` : ""}
                  {" · last check-in "}
                  {ago(selected.recordedAt)}
                </div>
              </div>
              <span className={`live-tag ${selectedStatus}`}>{roleChip ?? statusLabel[selectedStatus]}</span>
            </div>
            <div className="live-stats">
              <div>
                <div className="live-stat-l">Last check-in</div>
                <div className="live-stat-v">{clock(selected.recordedAt)}</div>
              </div>
              <div>
                <div className="live-stat-l">Fence</div>
                <div className="live-stat-v">{selected.site ?? "Outside"}</div>
              </div>
              <div>
                <div className="live-stat-l">On duty</div>
                <div className="live-stat-v">{duty[selected.userId] ? hoursSince(duty[selected.userId].since) : "—"}</div>
              </div>
            </div>
            <div className="live-actions">
              {selectedEmployee?.phone ? (
                <a className="live-act primary" href={`tel:${selectedEmployee.phone}`}>
                  <NavIcon name="phone" size={16} color="var(--if-paper)" /> Call
                </a>
              ) : (
                <button type="button" className="live-act primary" disabled>
                  <NavIcon name="phone" size={16} color="var(--if-paper)" /> Call
                </button>
              )}
              {selectedEmployee?.phone ? (
                <a className="live-act ghost" href={`sms:${selectedEmployee.phone}`}>
                  <NavIcon name="message" size={16} color="var(--if-ink)" /> Message
                </a>
              ) : (
                <button type="button" className="live-act ghost" disabled>
                  <NavIcon name="message" size={16} color="var(--if-ink)" /> Message
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="muted" style={{ margin: "0 0 8px" }}>
            {people.length === 0
              ? "Nobody with a live pin yet. People appear after they check in and share location."
              : filter === "offline"
                ? `${offlinePeople.length} people have no live pin right now.`
                : "Tap a pin to see who is there. Green rings are site fences."}
          </p>
        )}
        {filter === "offline" ? (
          <div className="live-pills">
            {offlinePeople.map((row) => (
              <span key={row.userId} className="live-pill">{row.name}</span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

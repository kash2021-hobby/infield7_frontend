"use client";

import { useEffect, useMemo, useState } from "react";
import { api, loadSession, type Session } from "@/lib/api";
import { FauxMap } from "@/lib/faux-map";
import { Geocoder } from "@/lib/geocoder";
import { ReportCrumbs } from "@/lib/reports";

type Site = {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  radiusM: number;
  kind?: string;
  people?: number;
  openTime?: string | null;
  closeTime?: string | null;
  alertAfterMin?: number | null;
};

const kinds = ["Construction site", "Field Sales", "Office", "Service hub"];

const emptyForm = {
  name: "",
  address: "",
  kind: kinds[2],
  lat: 12.9716,
  lng: 77.5946,
  radius: 500,
  openTime: "09:30",
  closeTime: "18:30",
};

export default function SitesPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [view, setView] = useState<"list" | "map">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [block, setBlock] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = sites.find((site) => site.id === selectedId) ?? null;
  const canEdit = session?.user.role !== "employee";

  async function refresh(current: Session) {
    const body = await api<{ sites: Site[] }>("/sites", {}, current.token);
    setSites(body.sites);
  }

  useEffect(() => {
    const current = loadSession();
    if (!current) return;
    setSession(current);
    refresh(current).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
  }, []);

  useEffect(() => {
    if (!selected) {
      setForm((current) => ({ ...emptyForm, lat: current.lat, lng: current.lng, radius: current.radius }));
      return;
    }
    setForm({
      name: selected.name,
      address: selected.address ?? "",
      kind: selected.kind || kinds[2],
      lat: selected.lat,
      lng: selected.lng,
      radius: selected.radiusM,
      openTime: selected.openTime || "09:30",
      closeTime: selected.closeTime || "18:30",
    });
  }, [selected]);

  function startNew() {
    setSelectedId(null);
    setForm(emptyForm);
    setError("");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!session) return;
    if (!Number.isFinite(form.lat) || form.lat < -90 || form.lat > 90) {
      setError("Latitude must be between -90 and 90.");
      return;
    }
    if (!Number.isFinite(form.lng) || form.lng < -180 || form.lng > 180) {
      setError("Longitude must be between -180 and 180.");
      return;
    }
    setError("");
    setBusy(true);
    const payload = {
      name: form.name,
      address: form.address,
      lat: form.lat,
      lng: form.lng,
      radiusM: Number(form.radius),
      kind: form.kind,
      openTime: form.openTime,
      closeTime: form.closeTime,
    };
    try {
      if (selected) {
        await api(`/sites/${selected.id}`, { method: "PATCH", body: JSON.stringify(payload) }, session.token);
      } else {
        await api("/sites", { method: "POST", body: JSON.stringify(payload) }, session.token);
        startNew();
      }
      await refresh(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the site");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!session) return;
    setError("");
    setBlock("");
    try {
      await api(`/sites/${id}`, { method: "DELETE" }, session.token);
      if (selectedId === id) startNew();
      await refresh(session);
    } catch (err) {
      const extra = err as Error & { blockingEmployeeCount?: number };
      if (extra.blockingEmployeeCount) {
        setBlock(`Reassign ${extra.blockingEmployeeCount} employee${extra.blockingEmployeeCount === 1 ? "" : "s"} first`);
      } else {
        setError(err instanceof Error ? err.message : "Could not delete");
      }
    }
  }

  function readDeviceGps() {
    if (!navigator.geolocation) {
      setError("This browser cannot read GPS.");
      return;
    }
    setError("");
    navigator.geolocation.getCurrentPosition(
      (fix) => setForm((current) => ({
        ...current,
        lat: Number(fix.coords.latitude.toFixed(6)),
        lng: Number(fix.coords.longitude.toFixed(6)),
      })),
      () => setError("Could not read this device's GPS. Paste latitude and longitude instead."),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  }

  const mapPins = useMemo(
    () => sites.map((site) => ({ id: site.id, lat: site.lat, lng: site.lng, label: site.name })),
    [sites],
  );
  const mapFences = useMemo(
    () => sites.map((site) => ({ id: site.id, lat: site.lat, lng: site.lng, radiusM: site.radiusM })),
    [sites],
  );

  return (
    <div className="emp-page">
      <div className="rpt-head">
        <div>
          <ReportCrumbs items={["Automation", "Geofences"]} />
          <h1 className="page-title" style={{ margin: 0 }}>Geofences</h1>
        </div>
        {canEdit ? (
          <div className="rpt-actions">
            <div className="chip-row">
              <button type="button" className={`chip${view === "list" ? " on" : ""}`} onClick={() => setView("list")}>List</button>
              <button type="button" className={`chip${view === "map" ? " on" : ""}`} onClick={() => setView("map")}>Map</button>
            </div>
            <button type="button" className="btn" style={{ width: "auto", marginTop: 0 }} onClick={startNew}>Add site</button>
          </div>
        ) : null}
      </div>
      {error ? <div className="error" style={{ marginBottom: 12 }}>{error}</div> : null}
      {block ? (
        <div className="panel" style={{ marginBottom: 12, padding: 16, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <strong>Cannot delete this site</strong>
            <div className="muted" style={{ marginTop: 4 }}>{block}</div>
          </div>
          <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 0 }} onClick={() => setBlock("")}>Close</button>
        </div>
      ) : null}

      <div className="sites-split">
        <div>
          {view === "list" ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{sites.length} site{sites.length === 1 ? "" : "s"} added</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sites.map((site) => (
                  <button
                    key={site.id}
                    type="button"
                    className={`panel site-card${selectedId === site.id ? " on" : ""}`}
                    style={{ padding: 16, display: "flex", gap: 14, textAlign: "left", width: "100%" }}
                    onClick={() => setSelectedId(site.id)}
                  >
                    <div className="site-pin">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
                        <circle cx="12" cy="10" r="2" />
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{site.name}</div>
                        <span className="chip">{site.kind || "Office"}</span>
                      </div>
                      <div className="muted" style={{ marginTop: 3 }}>{site.address || "No address"}</div>
                      <div className="muted" style={{ marginTop: 8, fontSize: 11 }}>
                        <span className="if-num">◯ {site.radiusM} m radius</span>
                        <span> · Auto-alert after {site.alertAfterMin ?? 30} min · </span>
                        {site.people ?? 0} employee{(site.people ?? 0) === 1 ? "" : "s"}
                      </div>
                    </div>
                    <span className="muted" aria-hidden>›</span>
                  </button>
                ))}
                {sites.length === 0 ? <div className="panel muted">No sites yet. Add one on the right, or drop a pin on the map.</div> : null}
              </div>
            </>
          ) : (
            <div className="panel" style={{ padding: 0, overflow: "hidden", minHeight: 480 }}>
              <FauxMap
                height={480}
                pins={mapPins}
                geofences={mapFences}
                onPinClick={(pin) => pin.id && setSelectedId(pin.id)}
                onPinDrop={canEdit ? (nextLat, nextLng) => setForm((current) => ({ ...current, lat: nextLat, lng: nextLng })) : undefined}
              />
            </div>
          )}
        </div>

        {canEdit ? (
          <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--if-cream-2)", fontSize: 13, fontWeight: 700 }}>
              {selected ? selected.name : "New site"}
            </div>
            <FauxMap
              width={380}
              height={200}
              lat={form.lat}
              lng={form.lng}
              radiusM={form.radius}
              onPinDrop={(nextLat, nextLng) => setForm((current) => ({ ...current, lat: nextLat, lng: nextLng }))}
            />
            <form style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }} onSubmit={save}>
              <div>
                <label htmlFor="site-name">Site name</label>
                <input id="site-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Whitefield Tower" required />
              </div>
              <div>
                <label htmlFor="address">Address</label>
                {session ? (
                  <Geocoder
                    id="address"
                    token={session.token}
                    value={form.address}
                    onChange={(address) => setForm((current) => ({ ...current, address }))}
                    onPick={(hit) => setForm((current) => ({ ...current, address: hit.label, lat: hit.lat, lng: hit.lng }))}
                    onCoords={(lat, lng) => setForm((current) => ({ ...current, lat, lng }))}
                  />
                ) : null}
              </div>
              <div className="grid">
                <div>
                  <label htmlFor="site-lat">Latitude</label>
                  <input
                    id="site-lat"
                    type="number"
                    step="any"
                    min={-90}
                    max={90}
                    value={form.lat}
                    onChange={(event) => {
                      const raw = event.target.value;
                      const parts = raw.split(/[,\s]+/).map(Number).filter((n) => Number.isFinite(n));
                      if (parts.length >= 2) {
                        setForm((current) => ({ ...current, lat: parts[0], lng: parts[1] }));
                        return;
                      }
                      setForm((current) => ({ ...current, lat: Number(raw) }));
                    }}
                    required
                    style={{ fontFamily: "var(--if-mono)" }}
                  />
                </div>
                <div>
                  <label htmlFor="site-lng">Longitude</label>
                  <input
                    id="site-lng"
                    type="number"
                    step="any"
                    min={-180}
                    max={180}
                    value={form.lng}
                    onChange={(event) => setForm((current) => ({ ...current, lng: Number(event.target.value) }))}
                    required
                    style={{ fontFamily: "var(--if-mono)" }}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="kind">Type</label>
                <select id="kind" value={form.kind} onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value }))}>
                  {kinds.map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
              <div>
                <label>Opening hours</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="time" aria-label="Opens" value={form.openTime} onChange={(event) => setForm((current) => ({ ...current, openTime: event.target.value }))} />
                  <input type="time" aria-label="Closes" value={form.closeTime} onChange={(event) => setForm((current) => ({ ...current, closeTime: event.target.value }))} />
                </div>
              </div>
              <div>
                <label>Geofence radius</label>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input type="range" min={30} max={2000} step={10} value={form.radius} onChange={(event) => setForm((current) => ({ ...current, radius: Number(event.target.value) }))} style={{ flex: 1 }} />
                  <strong className="if-num" style={{ minWidth: 64, textAlign: "right" }}>{form.radius} m</strong>
                </div>
              </div>
              <p className="muted" style={{ margin: 0 }}>Paste latitude and longitude from Maps, drop a pin, search an address, or use this device. Check-in uses these numbers.</p>
              <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 0 }} onClick={readDeviceGps}>Use this device GPS</button>
              <button className="btn" type="submit" disabled={busy}>{busy ? "Saving" : selected ? "Save site" : "Add site"}</button>
              {selected ? (
                <button type="button" className="btn ghost" onClick={() => void remove(selected.id)}>Delete</button>
              ) : null}
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}

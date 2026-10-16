"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, loadSession, saveSession, type Session } from "@/lib/api";
import { Avatar } from "@/lib/avatar";
import { FauxMap } from "@/lib/faux-map";
import { Geocoder } from "@/lib/geocoder";
import { cropLogo } from "@/lib/logo";
import { SalaryTemplatesPanel, type SalaryTemplate } from "@/lib/salary-templates";

const industries = ["Construction & real estate", "Field sales", "Service"];
const sizes = ["1 – 20 employees", "21 – 50 employees", "50 – 100 employees", "100+ employees"];
const businessTypes = ["Single site", "Multi-site (3+ locations)", "Field-only"];
const timezones = [
  { id: "Asia/Kolkata", label: "Asia/Kolkata  ·  GMT +5:30" },
  { id: "Asia/Dhaka", label: "Asia/Dhaka  ·  GMT +6:00" },
  { id: "Asia/Colombo", label: "Asia/Colombo  ·  GMT +5:30" },
  { id: "UTC", label: "UTC" },
];
const weeks = [
  { id: "mon-fri", label: "Mon – Fri" },
  { id: "mon-sat", label: "Mon – Sat" },
  { id: "mon-sun", label: "Every day" },
];
const siteKinds = ["Construction site", "Field Sales", "Office", "Service hub"];
const presets = [
  { industry: "Construction & real estate", title: "Construction preset", sub: "Daily wage · site attendance · safety alerts", icon: "building" as const },
  { industry: "Field sales", title: "Field sales preset", sub: "Visit tracking · client CRM · route planning", icon: "truck" as const },
  { industry: "Service", title: "Service techs preset", sub: "Job tickets · SLA alerts · parts inventory", icon: "briefcase" as const },
];
const SETUP_STEPS = [
  { title: "Company profile", sub: "Industry, currency, timezone" },
  { title: "Sites & locations", sub: "Where your team works" },
  { title: "Departments & roles", sub: "How teams are organized" },
  { title: "Shifts & rosters", sub: "When people work" },
  { title: "Salary templates", sub: "How you pay" },
];
const SUGGESTED = ["Construction", "Field Sales", "Service Techs", "Sales", "Ops", "Site", "Admin"];
const DEPT_COLORS = ["var(--if-amber)", "var(--if-green)", "var(--if-coral)"];
const SHIFT_COLORS = ["var(--if-green)", "var(--if-ink)", "var(--if-amber)", "oklch(52% 0.08 260)"];
const SUGGESTED_SHIFTS = [
  { name: "Morning", startTime: "06:00", endTime: "14:00", graceMin: 10 },
  { name: "General", startTime: "09:00", endTime: "18:00", graceMin: 10 },
  { name: "Evening", startTime: "14:00", endTime: "22:00", graceMin: 10 },
  { name: "Night", startTime: "22:00", endTime: "06:00", graceMin: 10 },
];

type GstinCheck = { valid: boolean; source: string; error?: string };
type Dept = { id: string; name: string; people: number; titles: string[] };
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
};

function weekOff(week: string, index: number) {
  if (week === "mon-fri") return index >= 5;
  if (week === "mon-sat") return index >= 6;
  return false;
}

function Mark({ name }: { name: "building" | "truck" | "briefcase" | "pin" }) {
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2 };
  if (name === "building") return <svg {...common}><path d="M4 21V7l8-4 8 4v14" /><path d="M9 21V12h6v9" /></svg>;
  if (name === "truck") return <svg {...common}><path d="M3 7h11v10H3z" /><path d="M14 11h5l2 3v3h-7" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></svg>;
  if (name === "briefcase") return <svg {...common}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5h8v2" /></svg>;
  return <svg {...common}><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2" /></svg>;
}
type ShiftRow = { id: string; name: string; startTime: string; endTime: string; graceMin: number; people: number };
type Person = { userId: string; name: string };
type Assignment = { userId: string; shiftId: string; day: string };
type Roster = { from: string; to: string; today: string; shifts: ShiftRow[]; people: Person[]; assignments: Assignment[] };

function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function mondayOf(iso: string) {
  const weekday = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return addDays(iso, -((weekday + 6) % 7));
}

function hoursOf(hhmm: string) {
  const [hour, minute] = hhmm.split(":").map(Number);
  return hour + minute / 60;
}

function dayHead(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", timeZone: "UTC" });
}

export default function SetupPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState(industries[0]);
  const [teamSize, setTeamSize] = useState(sizes[2]);
  const [businessType, setBusinessType] = useState(businessTypes[1]);
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [workingWeek, setWorkingWeek] = useState("mon-sat");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [siteName, setSiteName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [siteKind, setSiteKind] = useState(siteKinds[0]);
  const [siteLat, setSiteLat] = useState(12.9716);
  const [siteLng, setSiteLng] = useState(77.5946);
  const [siteRadius, setSiteRadius] = useState(500);
  const [siteOpen, setSiteOpen] = useState("09:30");
  const [siteClose, setSiteClose] = useState("18:30");
  const [gstin, setGstin] = useState("");
  const [gstinCheck, setGstinCheck] = useState<GstinCheck | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [roster, setRoster] = useState<Roster | null>(null);
  const [week, setWeek] = useState<string | null>(null);
  const [newDept, setNewDept] = useState("");
  const [adding, setAdding] = useState(false);
  const [titleDraft, setTitleDraft] = useState<Record<string, string>>({});
  const [shiftName, setShiftName] = useState("");
  const [shiftStart, setShiftStart] = useState("09:00");
  const [shiftEnd, setShiftEnd] = useState("18:00");
  const [graceMin, setGraceMin] = useState(10);
  const [templates, setTemplates] = useState<SalaryTemplate[]>([]);

  async function loadLists(current: Session, from?: string) {
    const [deptBody, siteBody] = await Promise.all([
      api<{ departments: Dept[] }>("/departments", {}, current.token),
      api<{ sites: Site[] }>("/sites", {}, current.token),
    ]);
    setDepartments(deptBody.departments);
    setSites(siteBody.sites);
    const rosterBody = from
      ? await api<Roster>(`/roster?from=${from}&to=${addDays(from, 6)}`, {}, current.token)
      : await api<Roster>("/roster", {}, current.token);
    setRoster(rosterBody);
    setShifts(rosterBody.shifts);
    setWeek(mondayOf(from ?? rosterBody.today));
    const pay = await api<{ templates: SalaryTemplate[] }>("/salary-templates", {}, current.token);
    setTemplates(pay.templates);
  }

  async function addShift(input: { name: string; startTime: string; endTime: string; graceMin: number }) {
    if (!session) return;
    setError("");
    setBusy(true);
    try {
      await api("/shifts", { method: "POST", body: JSON.stringify(input) }, session.token);
      setShiftName("");
      await loadLists(session, week ?? undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const current = loadSession();
    if (!current) return;
    setSession(current);
    setName(current.workspace.name);
    if (current.workspace.industry) setIndustry(current.workspace.industry);
    if (current.workspace.teamSize) setTeamSize(current.workspace.teamSize);
    if (current.workspace.businessType) setBusinessType(current.workspace.businessType);
    if (current.workspace.timezone) setTimezone(current.workspace.timezone);
    if (current.workspace.workingWeek) setWorkingWeek(current.workspace.workingWeek);
    if (current.workspace.logoDataUrl) setLogoDataUrl(current.workspace.logoDataUrl);
    if (typeof current.workspace.setupStep === "number") setStep(Math.min(current.workspace.setupStep, 4));
    try {
      const draft = localStorage.getItem(`if7-setup-draft-${current.workspace.id}`);
      if (draft) {
        const parsed = JSON.parse(draft) as Partial<{
          name: string; industry: string; teamSize: string; businessType: string; timezone: string; workingWeek: string; gstin: string;
        }>;
        if (parsed.name) setName(parsed.name);
        if (parsed.industry) setIndustry(parsed.industry);
        if (parsed.teamSize) setTeamSize(parsed.teamSize);
        if (parsed.businessType) setBusinessType(parsed.businessType);
        if (parsed.timezone) setTimezone(parsed.timezone);
        if (parsed.workingWeek) setWorkingWeek(parsed.workingWeek);
        if (parsed.gstin) setGstin(parsed.gstin);
      }
    } catch {
      /* ignore a bad draft */
    }
    api<{ profile: { gstin: string | null } }>("/billing", {}, current.token)
      .then((billing) => setGstin(billing.profile.gstin ?? ""))
      .catch(() => undefined);
    loadLists(current).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!session) return;
    const value = gstin.trim();
    if (value.length < 15) {
      setGstinCheck(null);
      return;
    }
    setGstinCheck(null);
    const timer = window.setTimeout(() => {
      api<GstinCheck>("/validators/gstin", { method: "POST", body: JSON.stringify({ gstin: value }) }, session.token)
        .then(setGstinCheck)
        .catch(() => setGstinCheck(null));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [gstin, session]);

  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(() => {
      localStorage.setItem(
        `if7-setup-draft-${session.workspace.id}`,
        JSON.stringify({ name, industry, teamSize, businessType, timezone, workingWeek, gstin }),
      );
    }, 800);
    return () => window.clearTimeout(timer);
  }, [session, name, industry, teamSize, businessType, timezone, workingWeek, gstin]);

  async function persistWorkspace(extra: Record<string, unknown> = {}) {
    if (!session) return null;
    const workspace = await api<Session["workspace"]>(
      "/workspace",
      {
        method: "PATCH",
        body: JSON.stringify({
          name: name || session.workspace.name || "Company",
          industry,
          teamSize,
          businessType,
          currency: "INR",
          timezone,
          workingWeek,
          setupStep: extra.setupStep ?? session.workspace.setupStep ?? 0,
          gstin: gstin.trim().toUpperCase(),
          ...(logoDataUrl ? { logoPng: logoDataUrl } : {}),
          ...extra,
        }),
      },
      session.token,
    );
    const next = { ...session, workspace };
    saveSession(next);
    setSession(next);
    return next;
  }

  async function saveCompany() {
    if (!session) return;
    if (gstin.trim() && gstinCheck && !gstinCheck.valid) return;
    setBusy(true);
    setError("");
    try {
      await persistWorkspace({ setupStep: Math.max(1, session.workspace.setupStep ?? 0) });
      setStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function goStep(next: number, persist = true) {
    setStep(next);
    if (!persist || !session) return;
    const saved = session.workspace.setupStep ?? 0;
    if (next > saved && next < 5) await persistWorkspace({ setupStep: next }).catch(() => undefined);
  }

  async function finishWizard() {
    await persistWorkspace({ setupStep: 5 }).catch(() => undefined);
    if (session) localStorage.removeItem(`if7-setup-draft-${session.workspace.id}`);
    router.push("/employees");
  }

  function readDeviceGps() {
    if (!navigator.geolocation) {
      setError("This browser cannot read GPS.");
      return;
    }
    setError("");
    navigator.geolocation.getCurrentPosition(
      (fix) => {
        setSiteLat(Number(fix.coords.latitude.toFixed(6)));
        setSiteLng(Number(fix.coords.longitude.toFixed(6)));
      },
      () => setError("Could not read this device's GPS. Paste latitude and longitude instead."),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  }

  async function addSite() {
    if (!session) return;
    if (!Number.isFinite(siteLat) || siteLat < -90 || siteLat > 90) {
      setError("Latitude must be between -90 and 90.");
      return;
    }
    if (!Number.isFinite(siteLng) || siteLng < -180 || siteLng > 180) {
      setError("Longitude must be between -180 and 180.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await api(
        "/sites",
        {
          method: "POST",
          body: JSON.stringify({
            name: siteName,
            address: siteAddress,
            lat: siteLat,
            lng: siteLng,
            radiusM: siteRadius,
            kind: siteKind,
            openTime: siteOpen,
            closeTime: siteClose,
          }),
        },
        session.token,
      );
      setSiteName("");
      setSiteAddress("");
      await loadLists(session, week ?? undefined);
      await persistWorkspace({ setupStep: Math.max(2, session.workspace.setupStep ?? 0) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the site");
    } finally {
      setBusy(false);
    }
  }

  async function removeSite(id: string) {
    if (!session) return;
    setError("");
    try {
      await api(`/sites/${id}`, { method: "DELETE" }, session.token);
      await loadLists(session, week ?? undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
    }
  }

  async function addDepartment(label: string) {
    if (!session) return;
    setError("");
    try {
      await api("/departments", { method: "POST", body: JSON.stringify({ name: label }) }, session.token);
      setNewDept("");
      setAdding(false);
      await loadLists(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add");
    }
  }

  async function addTitle(id: string) {
    if (!session) return;
    const title = (titleDraft[id] ?? "").trim();
    if (title.length < 2) return;
    setError("");
    try {
      await api(`/departments/${id}`, { method: "PATCH", body: JSON.stringify({ addTitle: title }) }, session.token);
      setTitleDraft((current) => ({ ...current, [id]: "" }));
      await loadLists(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add");
    }
  }

  async function removeTitle(id: string, title: string) {
    if (!session) return;
    try {
      await api(`/departments/${id}`, { method: "PATCH", body: JSON.stringify({ removeTitle: title }) }, session.token);
      await loadLists(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove");
    }
  }

  const filled = gstin.trim();
  const gstinChecking = filled.length === 15 && gstinCheck === null;
  const gstinBlocked = Boolean(filled) && (filled.length !== 15 || gstinChecking || (gstinCheck !== null && !gstinCheck.valid));
  const missing = SUGGESTED.filter((item) => !departments.some((row) => row.name.toLowerCase() === item.toLowerCase()));
  const admin = session?.user.role === "admin";
  const canRoster = session?.user.role !== "employee";

  return (
    <div className="wizard">
      <aside className="wizard-rail">
        <div className="wizard-rail-label">Setup wizard</div>
        {SETUP_STEPS.map((item, index) => (
          <button
            key={item.title}
            type="button"
            className={`wizard-step${index === step ? " on" : ""}${index < step ? " done" : ""}`}
            onClick={() => void goStep(index, false)}
          >
            {index < SETUP_STEPS.length - 1 ? <span className="line" /> : null}
            <span className="dot">{index < step ? "✓" : index + 1}</span>
            <span style={{ paddingTop: 3, paddingBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: index === step ? 700 : 600, color: index === step ? "var(--if-ink)" : "var(--if-ink-3)" }}>{item.title}</div>
              <div style={{ fontSize: 11, color: "var(--if-ink-3)", marginTop: 2 }}>{item.sub}</div>
            </span>
          </button>
        ))}
      </aside>
      <div className="wizard-body">
        <div className={`wizard-body-inner${step === 1 ? " wide" : ""}`}>
          <div className="wizard-kicker">Step {step + 1} of {SETUP_STEPS.length}</div>
          {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}

          {step === 0 ? (
            <>
              <h1 className="page-title" style={{ fontSize: 28, marginTop: 6 }}>Tell us about your business</h1>
              <p className="sub">This helps us pre-configure InField for you — you can change any of this later.</p>
              <form className="panel" style={{ padding: 28 }} onSubmit={(event) => { event.preventDefault(); void saveCompany(); }}>
                <div className="grid">
                  <div className="span-2" style={{ display: "flex", gap: 16, alignItems: "center" }}>
                    <label className="logo-upload">
                      {logoDataUrl ? <img src={logoDataUrl} alt="" width={40} height={40} /> : <span className="logo-upload-mark" />}
                      <input
                        type="file"
                        accept="image/png,image/svg+xml,image/jpeg"
                        hidden
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          cropLogo(file).then(setLogoDataUrl).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not read logo"));
                        }}
                      />
                      <span>Logo · cropped to 40×40 for the sidebar</span>
                    </label>
                  </div>
                  <div className="span-2">
                    <label htmlFor="name">Business name</label>
                    <input id="name" value={name} onChange={(event) => setName(event.target.value)} required />
                  </div>
                  <div>
                    <label htmlFor="industry">Industry</label>
                    <select id="industry" value={industry} onChange={(event) => setIndustry(event.target.value)}>
                      {industries.map((item) => <option key={item}>{item}</option>)}
                    </select>
                    <p className="muted" style={{ margin: "8px 0 0" }}>We'll customize templates & terminology</p>
                  </div>
                  <div>
                    <label htmlFor="btype">Business type</label>
                    <select id="btype" value={businessType} onChange={(event) => setBusinessType(event.target.value)}>
                      {businessTypes.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="size">Team size</label>
                    <select id="size" value={teamSize} onChange={(event) => setTeamSize(event.target.value)}>
                      {sizes.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </div>
                  <div>
                    <label>Currency</label>
                    <input value="₹  Indian Rupee (INR)" readOnly />
                  </div>
                  <div className="span-2">
                    <label htmlFor="tz">Timezone</label>
                    <select id="tz" value={timezone} onChange={(event) => setTimezone(event.target.value)} style={{ fontFamily: "var(--if-mono)" }}>
                      {timezones.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                    </select>
                  </div>
                  <div className="span-2">
                    <label>Working week</label>
                    <div className="chip-row">
                      {weeks.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`chip${workingWeek === item.id ? " on" : ""}`}
                          onClick={() => setWorkingWeek(item.id)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                    <p className="muted" style={{ margin: "8px 0 0" }}>Drives the roster week in the next steps. Attendance still uses this timezone.</p>
                  </div>
                  <div className="span-2">
                    <label htmlFor="gstin">GSTIN</label>
                    <input id="gstin" value={gstin} onChange={(event) => setGstin(event.target.value.toUpperCase())} placeholder="Optional" maxLength={15} autoComplete="off" />
                    {gstinChecking ? <p className="muted" style={{ margin: "8px 0 0" }}>Checking checksum…</p> : null}
                    {gstinCheck?.valid ? <p className="muted" style={{ margin: "8px 0 0" }}>Checksum looks right. The GST portal is not called.</p> : null}
                    {gstinCheck && !gstinCheck.valid ? <p className="error" style={{ margin: "8px 0 0" }}>{gstinCheck.error}</p> : null}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 24, marginBottom: 10 }}>We'll set up these things for you</div>
                <div className="preset-grid">
                  {presets.map((item) => (
                    <button
                      key={item.title}
                      type="button"
                      className={`panel preset-card${industry === item.industry ? " on" : ""}`}
                      onClick={() => setIndustry(item.industry)}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className="preset-icon"><Mark name={item.icon} /></div>
                        <div style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{item.title}</div>
                        <span className={`if-toggle${industry === item.industry ? " on" : ""}`}><span /></span>
                      </div>
                      <div className="muted" style={{ marginTop: 8, fontSize: 11, lineHeight: 1.4 }}>{item.sub}</div>
                    </button>
                  ))}
                </div>
                <div className="wizard-foot">
                  <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 0 }} onClick={() => { void persistWorkspace(); router.push("/employees"); }}>Save & finish later</button>
                  <div style={{ flex: 1 }} />
                  <button type="submit" className="btn" style={{ width: "auto", marginTop: 0 }} disabled={busy || gstinBlocked}>{busy ? "Saving" : "Continue"}</button>
                </div>
              </form>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <h1 className="page-title" style={{ fontSize: 28, marginTop: 6 }}>Add your sites</h1>
              <p className="sub">A site is any place your team works — an office, a construction site, a service center, or a sales zone. Each site has its own geofence.</p>
              <div className="sites-split">
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{sites.length} site{sites.length === 1 ? "" : "s"} added</div>
                    <button type="button" className="btn" style={{ width: "auto", marginTop: 0 }} onClick={() => document.getElementById("site-name")?.focus()}>Add site</button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {sites.map((site) => (
                      <div key={site.id} className="panel" style={{ padding: 16, display: "flex", gap: 14 }}>
                        <div className="site-pin"><Mark name="pin" /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{site.name}</div>
                            <span className="chip">{site.kind || "Office"}</span>
                          </div>
                          <div className="muted" style={{ marginTop: 3 }}>{site.address || "No address"}</div>
                          <div className="muted" style={{ marginTop: 6, fontFamily: "var(--if-mono)", fontSize: 11 }}>
                            {site.lat.toFixed(6)}, {site.lng.toFixed(6)}
                          </div>
                          <div className="muted" style={{ marginTop: 8, fontSize: 11 }}>
                            ◯ {site.radiusM} m radius
                            {site.openTime && site.closeTime ? ` · ${site.openTime}–${site.closeTime}` : ""}
                            {" · Auto-alert after 30 min · "}
                            {site.people ?? 0} employee{(site.people ?? 0) === 1 ? "" : "s"}
                          </div>
                        </div>
                        <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 0 }} onClick={() => void removeSite(site.id)}>Delete</button>
                      </div>
                    ))}
                    {sites.length === 0 ? <div className="panel muted">No sites yet. Add one on the right, or drop a pin on the map.</div> : null}
                  </div>
                </div>
                <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
                  <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--if-cream-2)", fontSize: 13, fontWeight: 700 }}>New site</div>
                  <FauxMap
                    width={380}
                    height={200}
                    lat={siteLat}
                    lng={siteLng}
                    radiusM={siteRadius}
                    pins={[{ lat: siteLat, lng: siteLng }, ...sites.map((site) => ({ id: site.id, lat: site.lat, lng: site.lng, label: site.name }))]}
                    geofences={[{ lat: siteLat, lng: siteLng, radiusM: siteRadius }]}
                    onPinDrop={(lat, lng) => { setSiteLat(lat); setSiteLng(lng); }}
                  />
                  <form
                    style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}
                    onSubmit={(event) => { event.preventDefault(); void addSite(); }}
                  >
                    <div>
                      <label htmlFor="site-name">Site name</label>
                      <input id="site-name" value={siteName} onChange={(event) => setSiteName(event.target.value)} placeholder="e.g. Whitefield Tower" required />
                    </div>
                    <div>
                      <label htmlFor="site-addr">Address</label>
                      {session ? (
                        <Geocoder
                          id="site-addr"
                          token={session.token}
                          value={siteAddress}
                          onChange={setSiteAddress}
                          onPick={(hit) => { setSiteAddress(hit.label); setSiteLat(hit.lat); setSiteLng(hit.lng); }}
                          onCoords={(lat, lng) => { setSiteLat(lat); setSiteLng(lng); }}
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
                          value={siteLat}
                          onChange={(event) => setSiteLat(Number(event.target.value))}
                          required
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
                          value={siteLng}
                          onChange={(event) => setSiteLng(Number(event.target.value))}
                          required
                        />
                      </div>
                    </div>
                    <p className="muted" style={{ margin: 0 }}>Paste GPS from Maps, drop a pin, or use this device. Check-in uses these coordinates.</p>
                    <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 0 }} onClick={readDeviceGps}>Use this device GPS</button>
                    <div>
                      <label htmlFor="site-kind">Type</label>
                      <select id="site-kind" value={siteKind} onChange={(event) => setSiteKind(event.target.value)}>
                        {siteKinds.map((item) => <option key={item}>{item}</option>)}
                      </select>
                    </div>
                    <div>
                      <label>Opening hours</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input type="time" aria-label="Opens" value={siteOpen} onChange={(event) => setSiteOpen(event.target.value)} />
                        <input type="time" aria-label="Closes" value={siteClose} onChange={(event) => setSiteClose(event.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label>Geofence radius</label>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <input type="range" min={30} max={2000} step={10} value={siteRadius} onChange={(event) => setSiteRadius(Number(event.target.value))} style={{ flex: 1 }} />
                        <strong style={{ minWidth: 64, textAlign: "right" }}>{siteRadius} m</strong>
                      </div>
                    </div>
                    <button className="btn" type="submit" disabled={busy} style={{ marginTop: 4 }}>{busy ? "Adding" : "Add site"}</button>
                  </form>
                </div>
              </div>
              <div className="wizard-foot">
                <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 0 }} onClick={() => void goStep(0)}>← Back</button>
                <div style={{ flex: 1 }} />
                <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 0 }} onClick={() => void goStep(2)}>Skip for now</button>
                <button type="button" className="btn" style={{ width: "auto", marginTop: 0 }} onClick={() => void goStep(2)}>Continue</button>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <h1 className="page-title" style={{ fontSize: 28, marginTop: 6 }}>Departments & roles</h1>
              <p className="sub">Group your team so you can assign shifts, salaries, and alert rules by department.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {departments.map((row, index) => {
                  const color = DEPT_COLORS[index % DEPT_COLORS.length];
                  return (
                    <div key={row.id} className="panel" style={{ padding: 20 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                        <div className="dept-icon" style={{ background: `color-mix(in oklch, ${color} 14%, white)`, color }}>{row.name.slice(0, 1)}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                            <div style={{ fontSize: 16, fontWeight: 700 }}>{row.name}</div>
                            <span style={{ fontSize: 11, color: "var(--if-ink-3)" }}>· {row.people} employees</span>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                            {row.titles.map((title) => (
                              <button key={title} type="button" className="chip ghost" onClick={() => admin && void removeTitle(row.id, title)}>{title}</button>
                            ))}
                            {admin ? (
                              <span style={{ display: "inline-flex", gap: 4 }}>
                                <input
                                  value={titleDraft[row.id] ?? ""}
                                  onChange={(event) => setTitleDraft((current) => ({ ...current, [row.id]: event.target.value }))}
                                  placeholder="Add role"
                                  style={{ width: 120, padding: "6px 10px", borderRadius: 999 }}
                                  onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addTitle(row.id); } }}
                                />
                                <button type="button" className="chip add" onClick={() => void addTitle(row.id)}>+ Add role</button>
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {admin && adding ? (
                  <div className="panel actions">
                    <input value={newDept} onChange={(event) => setNewDept(event.target.value)} placeholder="Department name" autoFocus />
                    <button type="button" className="btn" onClick={() => void addDepartment(newDept)}>Add</button>
                  </div>
                ) : admin ? (
                  <button type="button" className="dept-add" onClick={() => setAdding(true)}>+ Add department</button>
                ) : null}
                {admin && missing.length > 0 ? (
                  <div className="actions" style={{ flexWrap: "wrap" }}>
                    {missing.map((item) => (
                      <button key={item} type="button" className="btn secondary" onClick={() => void addDepartment(item)}>{item}</button>
                    ))}
                  </div>
                ) : null}
              </div>
              <p className="muted" style={{ marginTop: 16 }}>Job titles live on the department. Sign-in access still follows Admin, Manager, and Employee. Pay structures are on the last setup step.</p>
              <div className="panel" style={{ marginTop: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Who sees whom</div>
                <p className="muted" style={{ marginBottom: 8 }}>Custom sign-in roles stay off this product. This is the live access matrix.</p>
                <table>
                  <thead><tr><th>Sign-in</th><th>Sees</th><th>Can assign</th></tr></thead>
                  <tbody>
                    <tr><td>Admin</td><td>Whole company</td><td>Everyone</td></tr>
                    <tr><td>Manager</td><td>This company&apos;s field team</td><td>Employees they manage</td></tr>
                    <tr><td>Employee</td><td>Their own work</td><td>—</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="wizard-foot">
                <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 0 }} onClick={() => void goStep(1)}>← Back</button>
                <div style={{ flex: 1 }} />
                <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 0 }} onClick={() => void goStep(3)}>Skip for now</button>
                <button type="button" className="btn" style={{ width: "auto", marginTop: 0 }} onClick={() => void goStep(3)}>Continue</button>
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <h1 className="page-title" style={{ fontSize: 28, marginTop: 6 }}>Shifts & rosters</h1>
              <p className="sub">Define working windows. You&apos;ll assign shifts to employees on the next step and roster them week-by-week.</p>
              <div className="panel" style={{ padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>24-hour timeline</div>
                  <div style={{ fontSize: 11, color: "var(--if-ink-3)" }}>Overlap allowed · shifts wrap past midnight</div>
                </div>
                <div className="shift-ruler">
                  {Array.from({ length: 24 }, (_, hour) => (
                    <div key={hour} style={{ fontSize: 10, color: "var(--if-ink-3)", textAlign: "center", fontFamily: "var(--if-mono)", borderLeft: hour % 6 === 0 ? "1px solid var(--if-cream-2)" : "none", paddingBottom: 4 }}>
                      {hour % 6 === 0 ? String(hour).padStart(2, "0") : ""}
                    </div>
                  ))}
                </div>
                {shifts.map((row, index) => {
                  const startH = hoursOf(row.startTime);
                  let endH = hoursOf(row.endTime);
                  if (endH <= startH) endH += 24;
                  const color = SHIFT_COLORS[index % SHIFT_COLORS.length];
                  const firstEnd = Math.min(endH, 24);
                  return (
                    <div key={row.id} className="shift-track">
                      <div style={{ paddingRight: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{row.name}</div>
                        <div style={{ fontSize: 10, color: "var(--if-ink-3)", fontFamily: "var(--if-mono)" }}>{row.startTime} – {row.endTime}</div>
                        <div style={{ fontSize: 10, color: "var(--if-ink-3)" }}>{row.graceMin} min grace</div>
                      </div>
                      <div className="shift-lane">
                        <div className="shift-block" style={{ left: `${(startH / 24) * 100}%`, width: `${((firstEnd - startH) / 24) * 100}%`, background: color }}>
                          {row.people} people
                        </div>
                        {endH > 24 ? (
                          <div className="shift-block" style={{ left: 0, width: `${((endH - 24) / 24) * 100}%`, background: color, opacity: 0.7 }} />
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                {shifts.length === 0 ? <p className="muted">No shifts yet. Add a named window below.</p> : null}
                {canRoster ? (
                  <form
                    className="actions"
                    style={{ marginTop: 16, flexWrap: "wrap", alignItems: "end" }}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void addShift({ name: shiftName, startTime: shiftStart.slice(0, 5), endTime: shiftEnd.slice(0, 5), graceMin });
                    }}
                  >
                    <div>
                      <label htmlFor="shift-name">Name</label>
                      <input id="shift-name" value={shiftName} onChange={(event) => setShiftName(event.target.value)} placeholder="General" required />
                    </div>
                    <div>
                      <label htmlFor="shift-start">Start</label>
                      <input id="shift-start" type="time" value={shiftStart} onChange={(event) => setShiftStart(event.target.value)} required />
                    </div>
                    <div>
                      <label htmlFor="shift-end">End</label>
                      <input id="shift-end" type="time" value={shiftEnd} onChange={(event) => setShiftEnd(event.target.value)} required />
                    </div>
                    <div>
                      <label htmlFor="grace">Grace (min)</label>
                      <input id="grace" type="number" min={0} max={120} value={graceMin} onChange={(event) => setGraceMin(Number(event.target.value))} />
                    </div>
                    <button className="btn" type="submit" disabled={busy} style={{ width: "auto", marginTop: 0 }}>Add shift</button>
                  </form>
                ) : null}
                {canRoster ? (
                  <div className="actions" style={{ flexWrap: "wrap", marginTop: 12 }}>
                    {SUGGESTED_SHIFTS.filter((item) => !shifts.some((row) => row.name.toLowerCase() === item.name.toLowerCase())).map((item) => (
                      <button key={item.name} type="button" className="btn secondary" style={{ width: "auto", marginTop: 0 }} onClick={() => void addShift(item)}>
                        {item.name} {item.startTime}–{item.endTime}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 24, marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Weekly roster preview{sites[0] ? ` — ${sites[0].name}` : ""}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 0 }} disabled={!week || !session} onClick={() => week && session && loadLists(session, addDays(week, -7))}>← Week</button>
                  <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 0 }} disabled={!week || !session} onClick={() => week && session && loadLists(session, addDays(week, 7))}>Week →</button>
                </div>
              </div>
              <div className="panel" style={{ padding: 0, overflowX: "auto" }}>
                <div className="roster-week">
                  <div style={{ padding: "10px 14px", fontSize: 11, color: "var(--if-ink-3)", fontWeight: 600 }}>Employee</div>
                  {(week ? Array.from({ length: 7 }, (_, index) => addDays(week, index)) : []).map((day) => (
                    <div key={day} style={{ padding: "10px 8px", fontSize: 11, color: "var(--if-ink-3)", fontWeight: 600, textAlign: "center" }}>{dayHead(day)}</div>
                  ))}
                </div>
                {(roster?.people ?? []).slice(0, 3).map((person) => (
                  <div key={person.userId} className="roster-week">
                    <div style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                      <Avatar name={person.name} size={22} /> {person.name}
                    </div>
                    {(week ? Array.from({ length: 7 }, (_, index) => addDays(week, index)) : []).map((day, index) => {
                      const off = weekOff(workingWeek, index);
                      const assigned = roster?.assignments.find((item) => item.userId === person.userId && item.day === day);
                      const shift = off ? undefined : shifts.find((row) => row.id === assigned?.shiftId);
                      const color = shift ? SHIFT_COLORS[shifts.findIndex((row) => row.id === shift.id) % SHIFT_COLORS.length] : undefined;
                      return (
                        <div key={day} className="roster-cell">
                          <div className="roster-chip" style={{ background: shift ? color : "var(--if-cream)", color: shift ? (color === "var(--if-green)" ? "var(--if-ink)" : "var(--if-paper)") : "var(--if-ink-3)" }}>
                            {shift ? shift.name.slice(0, 1).toUpperCase() : "—"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
                {(roster?.people.length ?? 0) === 0 ? <div style={{ padding: 16 }} className="muted">Invite people, then assign them on the roster.</div> : null}
              </div>
              <p className="muted" style={{ marginTop: 16 }}>After the grace minutes, a check-in is late. Overtime pay stays off this product. Open the roster to fill the week.</p>
              <div className="wizard-foot">
                <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 0 }} onClick={() => void goStep(2)}>← Back</button>
                <div style={{ flex: 1 }} />
                <Link href="/roster" className="btn secondary" style={{ width: "auto", marginTop: 0, textDecoration: "none", display: "inline-block" }}>Open roster</Link>
                <button type="button" className="btn" style={{ width: "auto", marginTop: 0 }} onClick={() => void goStep(4)}>Continue</button>
              </div>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <h1 className="page-title" style={{ fontSize: 28, marginTop: 6 }}>Salary templates</h1>
              <p className="sub">Pre-build the pay structures you use. You&apos;ll pick one when adding an employee — no need to configure salary each time.</p>
              {session ? <SalaryTemplatesPanel token={session.token} templates={templates} onChange={setTemplates} /> : null}
              <div className="wizard-foot">
                <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 0 }} onClick={() => void goStep(3)}>← Back</button>
                <div style={{ flex: 1 }} />
                <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 0 }} onClick={() => void finishWizard()}>Skip for now</button>
                <button type="button" className="btn" style={{ width: "auto", marginTop: 0 }} onClick={() => void finishWizard()}>Continue</button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

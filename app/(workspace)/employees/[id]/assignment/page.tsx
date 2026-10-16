"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, loadSession, type Session } from "@/lib/api";
import { Avatar } from "@/lib/avatar";
import { EmployeeWizard, Field } from "@/lib/employee-wizard";
import { inr } from "@/lib/inr";
import type { SalaryTemplate } from "@/lib/salary-templates";

type Person = {
  id: string;
  code: string;
  name: string;
  phone: string;
  departmentId: string | null;
  siteId: string | null;
  shiftId: string | null;
  managerUserId: string | null;
  managerName: string | null;
  jobTitle: string | null;
  joinedOn: string | null;
  workDays: string | null;
  fenceRadiusM: number | null;
  salaryTemplateId: string | null;
  salaryBaseOverride: number | null;
  attendanceBonus: number | null;
};
type Dept = { id: string; name: string; titles: string[] };
type Site = { id: string; name: string; radiusM?: number };
type Shift = { id: string; name: string; startTime: string; endTime: string };
type Roster = { name: string; userId: string | null; status: string; role: string };

function Toggle({ on, off }: { on: boolean; off?: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 36,
        height: 20,
        borderRadius: 999,
        background: off ? "var(--if-cream-2)" : on ? "var(--if-green)" : "var(--if-cream-2)",
        display: "inline-flex",
        alignItems: "center",
        padding: 2,
        opacity: off ? 0.7 : 1,
      }}
    >
      <span style={{
        width: 16,
        height: 16,
        borderRadius: 999,
        background: "white",
        marginLeft: on && !off ? "auto" : 0,
      }} />
    </span>
  );
}

export default function AssignmentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [people, setPeople] = useState<Roster[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [siteId, setSiteId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [managerUserId, setManagerUserId] = useState("");
  const [joinedOn, setJoinedOn] = useState("");
  const [workDays, setWorkDays] = useState("Mon – Sat");
  const [fenceRadius, setFenceRadius] = useState("");
  const [templates, setTemplates] = useState<SalaryTemplate[]>([]);
  const [salaryTemplateId, setSalaryTemplateId] = useState("");
  const [baseRate, setBaseRate] = useState("");
  const [bonus, setBonus] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const titles = useMemo(
    () => departments.find((dept) => dept.id === departmentId)?.titles ?? [],
    [departments, departmentId],
  );
  const deptName = departments.find((dept) => dept.id === departmentId)?.name ?? "—";
  const siteName = sites.find((site) => site.id === siteId)?.name ?? "—";
  const shift = shifts.find((row) => row.id === shiftId);
  const managerName = people.find((row) => row.userId === managerUserId)?.name ?? person?.managerName ?? "—";
  const today = new Date().toISOString().slice(0, 10);
  const future = Boolean(joinedOn && joinedOn > today);

  const load = useCallback(async (current: Session) => {
    const [row, depts, siteList, shiftList, roster, pay] = await Promise.all([
      api<Person>(`/employees/${params.id}`, {}, current.token),
      api<{ departments: Dept[] }>("/departments", {}, current.token),
      api<{ sites: Site[] }>("/sites", {}, current.token),
      api<{ shifts: Shift[] }>("/shifts", {}, current.token),
      api<{ employees: Roster[] }>("/employees", {}, current.token),
      api<{ templates: SalaryTemplate[] }>("/salary-templates", {}, current.token),
    ]);
    setPerson(row);
    setDepartments(depts.departments);
    setSites(siteList.sites);
    setShifts(shiftList.shifts);
    const managers = roster.employees.filter((item) => item.userId && (item.role === "admin" || item.role === "manager"));
    if (current.user.id && !managers.some((item) => item.userId === current.user.id)) {
      managers.unshift({
        name: current.user.name || "You",
        userId: current.user.id,
        status: "active",
        role: current.user.role,
      });
    }
    setPeople(managers);
    setDepartmentId(row.departmentId ?? "");
    setJobTitle(row.jobTitle ?? "");
    setSiteId(row.siteId ?? "");
    setShiftId(row.shiftId ?? "");
    setManagerUserId(row.managerUserId ?? "");
    setJoinedOn((row.joinedOn ?? "").slice(0, 10));
    setWorkDays(row.workDays ?? "Mon – Sat");
    setFenceRadius(row.fenceRadiusM != null ? String(row.fenceRadiusM) : "");
    setTemplates(pay.templates);
    setSalaryTemplateId(row.salaryTemplateId ?? "");
    setBaseRate(row.salaryBaseOverride != null ? String(row.salaryBaseOverride) : "");
    setBonus(row.attendanceBonus != null ? String(row.attendanceBonus) : "");
  }, [params.id]);

  useEffect(() => {
    const current = loadSession();
    if (!current) return;
    setSession(current);
    load(current).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
  }, [load]);

  async function continueNext() {
    if (!session || !person) return;
    const next: Record<string, string> = {};
    if (!departmentId) next.departmentId = "Pick a department";
    if (!jobTitle.trim()) next.jobTitle = "Pick a role";
    if (!siteId) next.siteId = "Pick a site";
    if (!shiftId) next.shiftId = "Pick a shift";
    if (!joinedOn) next.joinedOn = "Set a joining date";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setError("");
    try {
      await api(`/employees/${person.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          departmentId,
          siteId,
          shiftId,
          jobTitle,
          managerUserId: managerUserId || null,
          joinedOn,
          workDays,
          fenceRadiusM: fenceRadius.trim() ? Number(fenceRadius) : null,
          salaryTemplateId: salaryTemplateId || null,
          salaryBaseOverride: baseRate.trim() ? Number(baseRate) : null,
          attendanceBonus: bonus.trim() ? Number(bonus) : null,
        }),
      }, session.token);
      const result = await api<{ future: boolean; joinedOn: string }>(`/employees/${person.id}/assignment`, {
        method: "POST",
        body: JSON.stringify({}),
      }, session.token);
      router.push(`/employees/${person.id}/invite${result.future ? `?join=${result.joinedOn}` : ""}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save";
      if (message.startsWith("Pick a ") || message.startsWith("Set a ")) {
        const key = message.includes("department") ? "departmentId"
          : message.includes("role") ? "jobTitle"
          : message.includes("site") ? "siteId"
          : message.includes("shift") ? "shiftId"
          : "joinedOn";
        setErrors((current) => ({ ...current, [key]: message }));
      } else setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <EmployeeWizard
      stepIndex={1}
      title="Assign role, site & pay"
      backHref={`/employees/${params.id}/edit`}
      onContinue={() => void continueNext()}
      busy={busy}
    >
      {error ? <div className="error" style={{ marginBottom: 12 }}>{error}</div> : null}
      <div className="emp-assign">
        <div className="panel" style={{ padding: 24 }}>
          <div className="emp-grid-2">
            <Field label="Department" required error={errors.departmentId}>
              <select value={departmentId} onChange={(event) => { setDepartmentId(event.target.value); setJobTitle(""); }}>
                <option value="">Select</option>
                {departments.map((dept) => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
              </select>
            </Field>
            <Field label="Role" required error={errors.jobTitle}>
              {titles.length > 0 ? (
                <select value={jobTitle} onChange={(event) => setJobTitle(event.target.value)}>
                  <option value="">Select</option>
                  {titles.map((title) => <option key={title} value={title}>{title}</option>)}
                </select>
              ) : (
                <input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="Add titles in Company setup, or type one" />
              )}
            </Field>
            <Field label="Primary site" required span={2} error={errors.siteId}>
              <select value={siteId} onChange={(event) => setSiteId(event.target.value)}>
                <option value="">Select</option>
                {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
              </select>
            </Field>
            <Field label="Work radius override" hint="Leave blank to use the site geofence" span={2}>
              <input
                inputMode="numeric"
                value={fenceRadius}
                onChange={(event) => setFenceRadius(event.target.value)}
                placeholder={sites.find((site) => site.id === siteId)?.radiusM ? `${sites.find((site) => site.id === siteId)?.radiusM} m site default` : "Site default"}
              />
            </Field>
            <Field label="Reporting manager">
              <select value={managerUserId} onChange={(event) => setManagerUserId(event.target.value)}>
                <option value="">None</option>
                {people.map((row) => <option key={row.userId ?? row.name} value={row.userId ?? ""}>{row.name}</option>)}
              </select>
            </Field>
            <Field label="Joining date" required error={errors.joinedOn}>
              <input type="date" value={joinedOn} onChange={(event) => setJoinedOn(event.target.value)} />
            </Field>
            <div className="emp-rule" />
            <Field label="Shift" required error={errors.shiftId}>
              <select value={shiftId} onChange={(event) => setShiftId(event.target.value)}>
                <option value="">Select</option>
                {shifts.map((row) => <option key={row.id} value={row.id}>{row.name} · {row.startTime} – {row.endTime}</option>)}
              </select>
            </Field>
            <Field label="Work days">
              <input value={workDays} onChange={(event) => setWorkDays(event.target.value)} />
            </Field>
            <div className="emp-rule" />
            <Field label="Salary template" required span={2}>
              <select value={salaryTemplateId} onChange={(event) => setSalaryTemplateId(event.target.value)}>
                <option value="">Select</option>
                {templates.map((row) => (
                  <option key={row.id} value={row.id}>{row.name} · {inr(row.startingAt)}</option>
                ))}
              </select>
            </Field>
            <Field label="Base rate" hint="Override template default">
              <div className="emp-prefix">
                <span>₹</span>
                <input inputMode="decimal" value={baseRate} onChange={(event) => setBaseRate(event.target.value)} placeholder="Template default" />
              </div>
            </Field>
            <Field label="Attendance bonus">
              <div className="emp-prefix">
                <span>₹</span>
                <input inputMode="decimal" value={bonus} onChange={(event) => setBonus(event.target.value)} placeholder="0" />
              </div>
            </Field>
            <div className="emp-rule" />
            <Field label="Permissions" span={2}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
                {[
                  ["Can check in from mobile", true, false],
                  ["Can view own attendance", true, false],
                  ["Can view own pay slip", true, false],
                  ["Can request leave", true, false],
                  ["Approve team leave", false, true],
                ].map(([label, on, held]) => (
                  <div key={String(label)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: held ? "var(--if-ink-3)" : undefined }}>
                      {String(label)}{held ? " · off this product" : ""}
                    </span>
                    <Toggle on={Boolean(on)} off={Boolean(held)} />
                  </div>
                ))}
              </div>
            </Field>
          </div>
        </div>
        <div className="panel" style={{ padding: 20 }}>
          <div className="emp-kpi-label" style={{ marginBottom: 12 }}>Preview</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 14, borderBottom: "1px solid var(--if-cream-2)" }}>
            <Avatar name={person?.name || "New"} size={44} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{person?.name || "—"}</div>
              <div className="if-num" style={{ fontSize: 11, color: "var(--if-ink-3)", marginTop: 2 }}>
                {person?.code} · {person?.phone ? `+91 ${person.phone}` : ""}
              </div>
            </div>
          </div>
          <div className="emp-preview-kv">
            <div><span>Department</span><b>{deptName}</b></div>
            <div><span>Role</span><b>{jobTitle || "—"}</b></div>
            <div><span>Site</span><b>{siteName}</b></div>
            <div><span>Work radius</span><b>{fenceRadius.trim() ? `${fenceRadius} m` : "Site default"}</b></div>
            <div><span>Shift</span><b>{shift ? `${shift.name} · ${shift.startTime} – ${shift.endTime}` : "—"}</b></div>
            <div><span>Manager</span><b>{managerUserId ? managerName : "—"}</b></div>
            <div><span>Salary</span><b>{templates.find((row) => row.id === salaryTemplateId)?.name ?? "—"}</b></div>
            <div><span>Est. unit</span><b>{salaryTemplateId ? inr(templates.find((row) => row.id === salaryTemplateId)?.startingAt ?? 0) : "—"}</b></div>
          </div>
          {departmentId && jobTitle && siteId && shiftId && joinedOn ? (
            <div className={future ? "emp-ready wait" : "emp-ready"}>
              {future ? (
                <><b>Joins on {joinedOn}.</b> They stay off the live roster until that date. Invite waits.</>
              ) : (
                <><b>Ready to invite.</b> {person?.name?.split(" ")[0] || "They"} will get an SMS with the InField app link and a one-time login code once you finish this step.</>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </EmployeeWizard>
  );
}

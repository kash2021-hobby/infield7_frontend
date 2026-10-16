"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, loadSession, type Session } from "@/lib/api";
import { Avatar } from "@/lib/avatar";
import { NavIcon } from "@/lib/nav-icon";
import { ReportCrumbs } from "@/lib/reports";

type Employee = {
  id: string;
  code: string;
  name: string;
  phone: string;
  role: string;
  status: string;
  inviteCode: string | null;
  userId: string | null;
  departmentId: string | null;
  department: string | null;
  siteId: string | null;
  site: string | null;
  shiftId: string | null;
  shift: string | null;
  jobTitle: string | null;
  salaryTemplate: string | null;
};
type Totals = { total: number; active: number; pending: number; deactivated: number; drafts: number; onLeave: number; alerts: number };
type Dept = { id: string; name: string; people: number };
type Site = { id: string; name: string };
type Shift = { id: string; name: string };

function roleLabel(role: string) {
  return role === "admin" ? "Admin" : role === "manager" ? "Manager" : "Employee";
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  return phone;
}

function statusTone(status: string) {
  if (status === "active") return "ok";
  if (status === "pending") return "wait";
  return "off";
}

function statusLabel(status: string) {
  if (status === "active") return "Active";
  if (status === "pending") return "Pending invite";
  if (status === "draft") return "Draft";
  return "Inactive";
}

export default function EmployeesPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [rows, setRows] = useState<Employee[]>([]);
  const [totals, setTotals] = useState<Totals>({ total: 0, active: 0, pending: 0, deactivated: 0, drafts: 0, onLeave: 0, alerts: 0 });
  const [filtered, setFiltered] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [cols, setCols] = useState({ phone: true, role: true, department: true, site: true, shift: true });
  const [picked, setPicked] = useState<string[]>([]);
  const [bulkShift, setBulkShift] = useState("");
  const [bulkSite, setBulkSite] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const admin = session?.user.role === "admin";

  const refresh = useCallback(async (current: Session, nextPage: number) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (departmentId) params.set("departmentId", departmentId);
    if (siteId) params.set("siteId", siteId);
    if (status) params.set("status", status);
    params.set("page", String(nextPage));
    const [people, depts, siteList, shiftList] = await Promise.all([
      api<{ employees: Employee[]; totals: Totals; filtered: number; page: number; pageSize: number }>(
        `/employees?${params}`,
        {},
        current.token,
      ),
      api<{ departments: Dept[] }>("/departments", {}, current.token),
      api<{ sites: Site[] }>("/sites", {}, current.token),
      api<{ shifts: Shift[] }>("/shifts", {}, current.token),
    ]);
    setRows(people.employees);
    setTotals(people.totals);
    setFiltered(people.filtered);
    setPage(people.page);
    setPageSize(people.pageSize);
    setDepartments(depts.departments);
    setSites(siteList.sites);
    setShifts(shiftList.shifts);
    setPicked((currentPicked) => currentPicked.filter((id) => people.employees.some((row) => row.id === id)));
  }, [query, departmentId, siteId, status]);

  useEffect(() => {
    const current = loadSession();
    if (!current) return;
    setSession(current);
    try {
      const raw = localStorage.getItem("if7-emp-cols");
      if (raw) setCols({ ...{ phone: true, role: true, department: true, site: true, shift: true }, ...JSON.parse(raw) });
    } catch {
      localStorage.removeItem("if7-emp-cols");
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    refresh(session, page).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
  }, [session, query, departmentId, siteId, status, page, refresh]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setQuery(search.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  async function runBulk(path: string, extra: Record<string, string> = {}) {
    if (!session || picked.length === 0) return;
    setError("");
    setNotice("");
    try {
      const result = await api<{ updated: number; skipped?: number }>(path, {
        method: "POST",
        body: JSON.stringify({ ids: picked, ...extra }),
      }, session.token);
      setNotice(`${result.updated} ${result.updated === 1 ? "person" : "people"} updated`);
      setPicked([]);
      setBulkShift("");
      setBulkSite("");
      await refresh(session, page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update");
    }
  }

  const pages = Math.max(1, Math.ceil(filtered / pageSize) || 1);
  const shownOf = useMemo(() => {
    if (filtered === 0) return "Showing 0 of 0 employees";
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, filtered);
    return `Showing ${from}–${to} of ${filtered} employees`;
  }, [filtered, page, pageSize]);

  const kpis: [string, number, string][] = [
    ["Total", totals.total, "var(--if-ink)"],
    ["Active", totals.active, "var(--if-green-deep)"],
    ["On leave", totals.onLeave, "var(--if-amber-deep)"],
    ["Inactive", totals.deactivated, "var(--if-ink-3)"],
    ["Alerts", totals.alerts, "var(--if-coral)"],
  ];

  const allOnPage = rows.length > 0 && rows.every((row) => picked.includes(row.id));

  return (
    <div className="emp-page">
      <div className="rpt-head">
        <div>
          <ReportCrumbs items={["Workforce", "Employees"]} />
          <h1 className="page-title" style={{ margin: 0 }}>Employees</h1>
        </div>
        {admin ? (
          <div className="rpt-actions">
            <Link className="btn secondary" href="/employees/import" style={{ width: "auto", marginTop: 0, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <NavIcon name="download" size={16} color="var(--if-ink)" /> Import CSV
            </Link>
            {(session?.workspace.setupStep ?? 0) < 5 ? (
              <Link className="btn" href="/setup" style={{ width: "auto", marginTop: 0 }}>Finish setup to add</Link>
            ) : (
              <Link className="btn" href="/employees/new" style={{ width: "auto", marginTop: 0, display: "inline-flex", alignItems: "center", gap: 8 }}>
                <NavIcon name="plus" size={16} color="var(--if-paper)" /> Add employee
              </Link>
            )}
          </div>
        ) : null}
      </div>
      {error ? <div className="error">{error}</div> : null}
      {notice ? <div className="devcode">{notice}</div> : null}
      {admin && (session?.workspace.setupStep ?? 0) < 5 ? (
        <div className="panel" style={{ marginBottom: 16 }}>
          Company setup is still open. Finish the wizard to unlock the full add-employee flow.
          {" "}
          <Link href="/setup">Continue setup</Link>
        </div>
      ) : null}

      <div className="rpt-kpis">
        {kpis.map(([label, value, color]) => (
          <div key={label} className="panel emp-kpi">
            <div className="emp-kpi-label">{label}</div>
            <div className="emp-kpi-value" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="emp-filters">
        <button
          type="button"
          className={`emp-chip${departmentId === "" && status === "" && siteId === "" ? " on" : ""}`}
          onClick={() => { setDepartmentId(""); setSiteId(""); setStatus(""); setPage(1); }}
        >
          All {totals.total}
        </button>
        {departments.map((dept) => (
          <button
            key={dept.id}
            type="button"
            className={`emp-chip${departmentId === dept.id ? " on" : ""}`}
            onClick={() => { setDepartmentId(dept.id); setPage(1); }}
          >
            {dept.name} {dept.people}
          </button>
        ))}
        {totals.drafts > 0 ? (
          <button
            type="button"
            className={`emp-chip${status === "draft" ? " on" : ""}`}
            onClick={() => { setStatus(status === "draft" ? "" : "draft"); setPage(1); }}
          >
            Drafts {totals.drafts}
          </button>
        ) : null}
        <div style={{ flex: 1 }} />
        <input
          aria-label="Search employees"
          placeholder="Search name, phone, code"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ maxWidth: 240, margin: 0 }}
        />
        <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 0, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => setFiltersOpen((open) => !open)}>
          <NavIcon name="filter" size={14} color="var(--if-ink)" /> Filter
        </button>
        <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 0 }} onClick={() => setColumnsOpen((open) => !open)}>
          Columns
        </button>
      </div>

      {columnsOpen ? (
        <div className="emp-filters" style={{ marginTop: -4, marginBottom: 12 }}>
          {([
            ["phone", "Phone"],
            ["role", "Role"],
            ["department", "Department"],
            ["site", "Site"],
            ["shift", "Shift"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`emp-chip${cols[key] ? " on" : ""}`}
              onClick={() => {
                const next = { ...cols, [key]: !cols[key] };
                setCols(next);
                localStorage.setItem("if7-emp-cols", JSON.stringify(next));
              }}
            >
              {label}
            </button>
          ))}
          <span className="emp-held" style={{ opacity: 0.7 }}>Salary from the attached template</span>
        </div>
      ) : null}

      {filtersOpen ? (
        <div className="emp-filters" style={{ marginTop: -4 }}>
          {sites.map((site) => (
            <button
              key={site.id}
              type="button"
              className={`emp-chip${siteId === site.id ? " on" : ""}`}
              onClick={() => { setSiteId(siteId === site.id ? "" : site.id); setPage(1); }}
            >
              {site.name}
            </button>
          ))}
          {(["active", "pending", "deactivated", "draft"] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={`emp-chip${status === item ? " on" : ""}`}
              onClick={() => { setStatus(status === item ? "" : item); setPage(1); }}
            >
              {statusLabel(item)}
            </button>
          ))}
        </div>
      ) : null}

      <div className={`panel emp-table${cols.phone ? "" : " hide-phone"}${cols.role ? "" : " hide-role"}${cols.department ? "" : " hide-department"}${cols.site ? "" : " hide-site"}${cols.shift ? "" : " hide-shift"}`}>
        <div className="emp-row emp-head">
          <div>
            {admin ? (
              <input
                type="checkbox"
                checked={allOnPage}
                onChange={() => setPicked(allOnPage ? [] : rows.map((row) => row.id))}
                aria-label="Select all on this page"
              />
            ) : null}
          </div>
          <div>ID</div>
          <div>Employee</div>
          <div>Phone</div>
          <div>Role</div>
          <div>Department</div>
          <div>Site</div>
          <div>Shift</div>
          <div>Salary</div>
          <div>Status</div>
          <div />
        </div>
        {rows.length === 0 ? (
          <div className="emp-empty">
            {totals.total === 0
              ? "No employees yet. Add one person or import a CSV."
              : "No people match these filters."}
          </div>
        ) : rows.map((row, index) => {
          const href = `/employees/${row.id}/edit`;
          return (
            <div
              key={row.id}
              className="emp-row"
              style={{ borderTop: index === 0 ? "none" : undefined, cursor: "pointer" }}
              onClick={() => router.push(href)}
            >
              <div onClick={(event) => event.stopPropagation()}>
                {admin ? (
                  <input
                    type="checkbox"
                    checked={picked.includes(row.id)}
                    onChange={() => setPicked((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id])}
                    aria-label={`Select ${row.name}`}
                  />
                ) : null}
              </div>
              <div className="if-num" style={{ color: "var(--if-ink-3)" }}>{row.code}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <Avatar name={row.name} size={28} />
                <span style={{ fontWeight: 600 }}>{row.name}</span>
              </div>
              <div className="if-num" style={{ color: "var(--if-ink-2)" }} title={row.inviteCode ?? undefined}>{formatPhone(row.phone)}</div>
              <div>{row.jobTitle || roleLabel(row.role)}</div>
              <div style={{ color: "var(--if-ink-2)" }}>{row.department ?? "—"}</div>
              <div style={{ color: "var(--if-ink-2)" }}>{row.site ?? "—"}</div>
              <div style={{ color: "var(--if-ink-2)" }}>{row.shift ?? "—"}</div>
              <div style={{ color: "var(--if-ink-2)" }}>{row.salaryTemplate ?? "—"}</div>
              <div>
                <span className={`emp-status ${statusTone(row.status)}`}>
                  <span className="emp-dot" />
                  {statusLabel(row.status)}
                </span>
              </div>
              <div style={{ color: "var(--if-ink-3)", display: "flex", alignItems: "center", gap: 8 }} onClick={(event) => event.stopPropagation()}>
                {row.status === "pending" ? <Link href={`/employees/${row.id}/invite`}>Invite</Link> : null}
                <NavIcon name="chevronRight" size={14} color="var(--if-ink-3)" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="emp-foot">
        <span>{shownOf}</span>
        <div style={{ display: "flex", gap: 4 }}>
          <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 0 }} disabled={page <= 1} onClick={() => setPage((n) => Math.max(1, n - 1))}>← Prev</button>
          <span className="emp-page-n">{page} / {pages}</span>
          <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 0 }} disabled={page >= pages} onClick={() => setPage((n) => n + 1)}>Next →</button>
        </div>
      </div>

      {admin && picked.length > 0 ? (
        <div className="emp-bulk" role="region" aria-label="Bulk actions">
          <span>{picked.length} selected</span>
          <select aria-label="Reassign shift" value={bulkShift} onChange={(event) => setBulkShift(event.target.value)}>
            <option value="">Reassign shift</option>
            {shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.name}</option>)}
          </select>
          <button type="button" className="btn" disabled={!bulkShift} onClick={() => void runBulk("/employees/bulk/reassign-shift", { shiftId: bulkShift })}>
            Apply shift
          </button>
          <select aria-label="Change site" value={bulkSite} onChange={(event) => setBulkSite(event.target.value)}>
            <option value="">Change site</option>
            {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
          </select>
          <button type="button" className="btn" disabled={!bulkSite} onClick={() => void runBulk("/employees/bulk/change-site", { siteId: bulkSite })}>
            Apply site
          </button>
          <button type="button" className="btn secondary" onClick={() => void runBulk("/employees/bulk/resend-invite")}>Resend invite</button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              if (window.confirm(`Deactivate ${picked.length} ${picked.length === 1 ? "person" : "people"}?`)) {
                void runBulk("/employees/bulk/deactivate");
              }
            }}
          >
            Deactivate
          </button>
        </div>
      ) : null}
    </div>
  );
}

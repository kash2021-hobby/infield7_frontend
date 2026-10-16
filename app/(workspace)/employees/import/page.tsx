"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, loadSession } from "@/lib/api";
import { NavIcon } from "@/lib/nav-icon";
import { ReportCrumbs } from "@/lib/reports";
import { guessMapping, IMPORT_FIELDS, parseCsv, toCsv, type ImportFieldId } from "@/lib/csv";

type Graded = {
  line: number;
  name: string;
  phone: string;
  jobTitle: string;
  department: string;
  site: string;
  status: "ok" | "warn" | "error";
  error: string;
  ready: boolean;
};

const STEPS = ["Upload", "Map columns", "Review & confirm"];

export default function ImportEmployeesPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [table, setTable] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ImportFieldId[]>([]);
  const [graded, setGraded] = useState<Graded[]>([]);
  const [ready, setReady] = useState(0);
  const [warnings, setWarnings] = useState(0);
  const [errors, setErrors] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");

  const mappedRows = useMemo(() => {
    const indexOf = (id: ImportFieldId) => mapping.findIndex((item) => item === id);
    const nameAt = indexOf("name");
    const phoneAt = indexOf("phone");
    const roleAt = indexOf("jobTitle");
    const deptAt = indexOf("department");
    const siteAt = indexOf("site");
    const idAt = indexOf("aadhaar");
    return table.map((row, index) => ({
      line: index + 2,
      name: nameAt >= 0 ? row[nameAt] : "",
      phone: phoneAt >= 0 ? row[phoneAt] : "",
      jobTitle: roleAt >= 0 ? row[roleAt] : "",
      department: deptAt >= 0 ? row[deptAt] : "",
      site: siteAt >= 0 ? row[siteAt] : "",
      aadhaar: idAt >= 0 ? row[idAt] : "",
    }));
  }, [mapping, table]);

  function readFile(file: File) {
    setError("");
    setDone("");
    if (file.size > 5 * 1024 * 1024) {
      setError("CSV must be 5 MB or smaller");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result ?? ""));
      if (parsed.rows.length === 0) {
        setError("That file has no people in it");
        return;
      }
      if (parsed.rows.length > 5000) {
        setError("Import up to 5,000 rows at a time");
        return;
      }
      setFileName(file.name);
      setHeaders(parsed.headers);
      setTable(parsed.rows);
      setMapping(guessMapping(parsed.headers));
      setGraded([]);
      setStep(1);
    };
    reader.readAsText(file);
  }

  async function runDry() {
    const session = loadSession();
    if (!session) return;
    if (!mapping.includes("name") || !mapping.includes("phone")) {
      setError("Map Name and Phone before reviewing");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api<{ rows: Graded[]; ready: number; warnings: number; errors: number }>(
        "/employees/bulk/dry-run",
        { method: "POST", body: JSON.stringify({ rows: mappedRows }) },
        session.token,
      );
      setGraded(result.rows);
      setReady(result.ready);
      setWarnings(result.warnings);
      setErrors(result.errors);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check the file");
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    const session = loadSession();
    if (!session || ready === 0) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ created: number; invited: number; skipped: number }>(
        "/employees/bulk/commit",
        { method: "POST", body: JSON.stringify({ rows: mappedRows }) },
        session.token,
      );
      setDone(`Imported ${result.created}. ${result.invited} invites sent. ${result.skipped} skipped.`);
      router.push("/employees");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import");
    } finally {
      setBusy(false);
    }
  }

  function downloadFixme() {
    const failed = graded.filter((row) => row.status === "error");
    const blob = new Blob(
      [toCsv([...headers, "error"], failed.map((row) => {
        const source = table[row.line - 2] ?? [];
        return [...source, row.error];
      }))],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "fixme.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const preview = graded.slice(0, 50);
  const firstError = graded.find((row) => row.status === "error");

  return (
    <div className="emp-page">
      <div className="rpt-head">
        <div>
          <ReportCrumbs items={["Workforce", "Employees", "Import CSV"]} />
          <h1 className="page-title" style={{ margin: 0 }}>Bulk import employees</h1>
        </div>
        <div className="rpt-actions">
          <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 0 }} onClick={() => router.push("/employees")}>
            Cancel
          </button>
          {step === 2 ? (
            <button type="button" className="btn" style={{ width: "auto", marginTop: 0 }} disabled={busy || ready === 0} onClick={() => void commit()}>
              Import {ready} {ready === 1 ? "employee" : "employees"}
            </button>
          ) : step === 1 ? (
            <button type="button" className="btn" style={{ width: "auto", marginTop: 0 }} disabled={busy} onClick={() => void runDry()}>
              Review & confirm
            </button>
          ) : null}
        </div>
      </div>
      {error ? <div className="error" style={{ marginBottom: 12 }}>{error}</div> : null}
      {done ? <div className="devcode" style={{ marginBottom: 12 }}>{done}</div> : null}

      <div className="imp-steps">
        {STEPS.map((label, index) => {
          const doneStep = index < step;
          const on = index === step;
          return (
            <div key={label} className={`imp-step${on ? " on" : ""}${doneStep ? " done" : ""}`}>
              {doneStep ? <NavIcon name="check" size={14} color="var(--if-green-deep)" /> : <span className="if-num">{index + 1}</span>}
              {label}
            </div>
          );
        })}
      </div>

      {step === 0 ? (
        <button type="button" className="imp-drop" onClick={() => fileRef.current?.click()}>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) readFile(file);
              event.target.value = "";
            }}
          />
          <div className="imp-drop-icon">
            <NavIcon name="download" size={18} color="var(--if-green-deep)" />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Drop a CSV here, or click to upload</div>
          <div style={{ fontSize: 12, color: "var(--if-ink-3)", marginTop: 6 }}>Max 5 MB · 5,000 rows · Name and phone required</div>
        </button>
      ) : (
        <div className="panel" style={{ padding: 16, marginBottom: 16, display: "flex", alignItems: "center", gap: 16 }}>
          <div className="imp-file-icon">
            <NavIcon name="download" size={18} color="var(--if-green-deep)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{fileName}</div>
            <div style={{ fontSize: 11, color: "var(--if-ink-3)", marginTop: 2 }}>{table.length} rows</div>
          </div>
          {step === 2 ? (
            <div style={{ display: "flex", gap: 12 }}>
              <div>
                <div className="emp-kpi-label">Ready</div>
                <div className="if-num" style={{ fontSize: 18, fontWeight: 700, color: "var(--if-green)" }}>{ready}</div>
              </div>
              <div>
                <div className="emp-kpi-label">Warnings</div>
                <div className="if-num" style={{ fontSize: 18, fontWeight: 700, color: "var(--if-amber-deep)" }}>{warnings}</div>
              </div>
              <div>
                <div className="emp-kpi-label">Errors</div>
                <div className="if-num" style={{ fontSize: 18, fontWeight: 700, color: "var(--if-coral)" }}>{errors}</div>
              </div>
            </div>
          ) : (
            <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 0 }} onClick={() => fileRef.current?.click()}>
              Replace file
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) readFile(file);
              event.target.value = "";
            }}
          />
        </div>
      )}

      {step >= 1 ? (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Column mapping</div>
          <div className="panel" style={{ padding: 0, marginBottom: 20, overflow: "hidden" }}>
            {headers.map((header, index) => {
              const field = mapping[index] ?? "ignore";
              const mapped = field !== "ignore";
              return (
                <div key={`${header}-${index}`} className="imp-map">
                  <div>
                    <div className="emp-kpi-label">CSV column</div>
                    <div className="if-num" style={{ marginTop: 2, fontWeight: 600 }}>{header}</div>
                  </div>
                  <div style={{ textAlign: "center", color: "var(--if-ink-3)" }}>→</div>
                  <div>
                    <div className="emp-kpi-label">InField field</div>
                    <select
                      value={field}
                      onChange={(event) => {
                        const next = [...mapping];
                        next[index] = event.target.value as ImportFieldId;
                        setMapping(next);
                      }}
                      style={{ marginTop: 4 }}
                    >
                      {IMPORT_FIELDS.map((item) => (
                        <option key={item.id} value={item.id}>{item.label}{item.id === "ignore" && /wage|salary|pay/i.test(header) ? " · off this product" : ""}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span className={`emp-status ${mapped ? "ok" : "wait"}`}>{mapped ? "Mapped" : "Ignore"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Preview ({preview.length} of {graded.length} rows)</div>
            {errors > 0 ? (
              <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 0, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={downloadFixme}>
                <NavIcon name="download" size={14} color="var(--if-ink)" /> Download errored rows
              </button>
            ) : null}
          </div>
          <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
            <div className="imp-preview imp-head">
              <div>Name</div><div>Phone</div><div>Role</div><div>Dept</div><div>Site</div><div>Salary</div><div />
            </div>
            {preview.map((row) => (
              <div key={row.line} className={`imp-preview${row.status === "error" ? " err" : row.status === "warn" ? " warn" : ""}`}>
                <div style={{ fontWeight: 600 }}>{row.name || "—"}</div>
                <div className="if-num" style={{ color: row.status === "error" ? "oklch(50% 0.2 25)" : "var(--if-ink-2)" }}>{row.phone || "—"}</div>
                <div>{row.jobTitle || "—"}</div>
                <div>{row.department || "—"}</div>
                <div>{row.site || "—"}</div>
                <div className="emp-held">Off this product</div>
                <div>
                  <span className={`emp-status ${row.status === "ok" ? "ok" : row.status === "warn" ? "wait" : "off"}`}>
                    {row.status === "ok" ? "OK" : row.status === "warn" ? "Fix" : "Error"}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {firstError ? (
            <div style={{ display: "flex", gap: 12, marginTop: 12, fontSize: 11, color: "var(--if-ink-3)" }}>
              <span style={{ color: "var(--if-amber-deep)" }}>⚠ {firstError.name || "Row"}</span>
              — {firstError.error}. Download the fix file, correct it, and re-upload.
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

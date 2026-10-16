"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { NavIcon } from "@/lib/nav-icon";

const STEPS = ["Personal & ID", "Assignment", "Invite & activate"];

export function EmployeeWizard({
  stepIndex,
  title,
  children,
  backHref,
  onContinue,
  continueLabel = "Continue",
  busy,
}: {
  stepIndex: number;
  title: string;
  children: React.ReactNode;
  backHref: string;
  onContinue: () => void;
  continueLabel?: string;
  busy?: boolean;
}) {
  const router = useRouter();
  return (
    <div className="emp-page emp-wizard">
      <div className="rpt-head">
        <div>
          <div className="rpt-crumbs">Workforce · Employees · Add employee</div>
          <h1 className="page-title" style={{ margin: 0 }}>Add employee</h1>
        </div>
        <div className="rpt-actions">
          <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 0 }} onClick={() => router.push("/employees")}>
            Cancel
          </button>
        </div>
      </div>
      <div className="emp-stepper">
        {STEPS.map((label, index) => {
          const done = index < stepIndex;
          const on = index === stepIndex;
          return (
            <div key={label} className="emp-step">
              <div className={`emp-step-dot${done ? " done" : on ? " on" : ""}`}>
                {done ? <NavIcon name="check" size={11} color="var(--if-paper)" /> : index + 1}
              </div>
              <div className={`emp-step-label${on ? " on" : ""}`}>{label}</div>
              {index < STEPS.length - 1 ? <div className={`emp-step-line${done ? " done" : ""}`} /> : null}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 20 }}>{title}</div>
      {children}
      <div style={{ display: "flex", gap: 8, marginTop: 20, alignItems: "center" }}>
        <Link className="btn ghost" href={backHref} style={{ width: "auto", marginTop: 0 }}>← Back</Link>
        <div style={{ flex: 1 }} />
        <button type="button" className="btn" style={{ width: "auto", marginTop: 0, display: "inline-flex", alignItems: "center", gap: 6 }} disabled={busy} onClick={onContinue}>
          {continueLabel}
          {continueLabel === "Continue" ? <NavIcon name="chevronRight" size={16} color="var(--if-paper)" /> : null}
        </button>
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  required,
  span,
  error,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  span?: 2;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="emp-field" style={span === 2 ? { gridColumn: "span 2" } : undefined}>
      <label>
        {label}
        {required ? <span style={{ color: "var(--if-coral)" }}> *</span> : null}
      </label>
      {hint ? <div className="emp-hint">{hint}</div> : null}
      {children}
      {error ? <div className="error" style={{ marginTop: 6 }}>{error}</div> : null}
    </div>
  );
}

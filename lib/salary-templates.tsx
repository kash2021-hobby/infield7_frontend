"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { inr } from "@/lib/inr";

export type SalaryLine = { id?: string; name: string; kind: "earning" | "deduction"; mode: "fixed" | "percent"; amount: number };
export type SalaryTemplate = {
  id: string;
  name: string;
  cycle: "daily" | "weekly" | "monthly";
  version: number;
  people: number;
  lines: SalaryLine[];
  startingAt: number;
};

const band: Record<SalaryTemplate["cycle"], string> = {
  daily: "var(--if-amber)",
  weekly: "var(--if-green)",
  monthly: "var(--if-ink)",
};

const starters: { name: string; cycle: SalaryTemplate["cycle"]; lines: SalaryLine[] }[] = [
  {
    name: "Daily wage — site labor",
    cycle: "daily",
    lines: [{ name: "Base per day", kind: "earning", mode: "fixed", amount: 800 }],
  },
  {
    name: "Weekly — technicians",
    cycle: "weekly",
    lines: [{ name: "Base per week", kind: "earning", mode: "fixed", amount: 5600 }],
  },
  {
    name: "Monthly — sales staff",
    cycle: "monthly",
    lines: [
      { name: "Base salary", kind: "earning", mode: "fixed", amount: 24000 },
      { name: "PF", kind: "deduction", mode: "percent", amount: 12 },
      { name: "ESI", kind: "deduction", mode: "percent", amount: 0.75 },
    ],
  },
];

function emptyLine(): SalaryLine {
  return { name: "", kind: "earning", mode: "fixed", amount: 0 };
}

export function SalaryTemplatesPanel({
  token,
  templates,
  onChange,
}: {
  token: string;
  templates: SalaryTemplate[];
  onChange: (templates: SalaryTemplate[]) => void;
}) {
  const [editing, setEditing] = useState<SalaryTemplate | "new" | null>(null);
  const [name, setName] = useState("");
  const [cycle, setCycle] = useState<SalaryTemplate["cycle"]>("monthly");
  const [lines, setLines] = useState<SalaryLine[]>([emptyLine()]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function open(template: SalaryTemplate | "new") {
    setError("");
    if (template === "new") {
      setName("");
      setCycle("monthly");
      setLines([{ name: "Base salary", kind: "earning", mode: "fixed", amount: 0 }]);
    } else {
      setName(template.name);
      setCycle(template.cycle);
      setLines(template.lines.length ? template.lines.map((line) => ({ ...line })) : [emptyLine()]);
    }
    setEditing(template);
  }

  async function save() {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const payload = { name, cycle, lines: lines.filter((line) => line.name.trim()) };
      const body =
        editing && editing !== "new"
          ? await api<{ templates: SalaryTemplate[] }>(`/salary-templates/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) }, token)
          : await api<{ templates: SalaryTemplate[] }>("/salary-templates", { method: "POST", body: JSON.stringify(payload) }, token);
      onChange(body.templates);
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function seed(starter: (typeof starters)[0]) {
    setBusy(true);
    setError("");
    try {
      const body = await api<{ templates: SalaryTemplate[] }>(
        "/salary-templates",
        { method: "POST", body: JSON.stringify(starter) },
        token,
      );
      onChange(body.templates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const basic = lines.find((line) => line.kind === "earning")?.amount ?? 0;
  const preview = lines.reduce(
    (sum, line) => {
      const amount = line.mode === "percent" ? (basic * line.amount) / 100 : line.amount;
      return line.kind === "deduction" ? sum - amount : sum + amount;
    },
    0,
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {error ? <div className="error">{error}</div> : null}
      {templates.map((item) => (
        <button
          key={item.id}
          type="button"
          className="panel"
          style={{ overflow: "hidden", padding: 0, textAlign: "left", cursor: "pointer" }}
          onClick={() => open(item)}
        >
          <div style={{ display: "flex" }}>
            <div style={{ width: 6, background: band[item.cycle] }} />
            <div style={{ padding: 20, flex: 1, display: "flex", gap: 20 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{item.name}</div>
                  <span className="chip">{item.cycle}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                  {item.lines.map((line) => (
                    <span key={`${line.name}-${line.kind}`} className="chip">
                      {line.name}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, color: "var(--if-ink-3)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Starting at</div>
                <div className="if-num" style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: band[item.cycle] }}>{inr(item.startingAt)}</div>
                <div style={{ fontSize: 10, color: "var(--if-ink-3)", marginTop: 4 }}>{item.people} people on this</div>
              </div>
            </div>
          </div>
        </button>
      ))}
      {starters.filter((starter) => !templates.some((row) => row.name === starter.name)).map((starter) => (
        <button key={starter.name} type="button" className="panel" style={{ padding: 16, textAlign: "left" }} disabled={busy} onClick={() => void seed(starter)}>
          Add {starter.name}
        </button>
      ))}
      <button type="button" className="dept-add" onClick={() => open("new")}>+ Create custom template</button>

      {editing ? (
        <div className="panel" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{editing === "new" ? "New template" : "Edit template"}</div>
          <p className="muted" style={{ marginTop: 0 }}>Saving an edit makes a new version. People already paid keep the old one. PF/ESI here are % you type — this product does not file them.</p>
          <div className="emp-grid-2">
            <label className="field">
              <span>Name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="field">
              <span>Cycle</span>
              <select value={cycle} onChange={(event) => setCycle(event.target.value as SalaryTemplate["cycle"])}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
          </div>
          {lines.map((line, index) => (
            <div key={index} style={{ display: "grid", gridTemplateColumns: "1.4fr 0.8fr 0.8fr 0.7fr 32px", gap: 8, marginTop: 8 }}>
              <input value={line.name} placeholder="Line name" onChange={(event) => setLines((cur) => cur.map((row, i) => (i === index ? { ...row, name: event.target.value } : row)))} />
              <select value={line.kind} onChange={(event) => setLines((cur) => cur.map((row, i) => (i === index ? { ...row, kind: event.target.value as SalaryLine["kind"] } : row)))}>
                <option value="earning">Earning</option>
                <option value="deduction">Deduction</option>
              </select>
              <select value={line.mode} onChange={(event) => setLines((cur) => cur.map((row, i) => (i === index ? { ...row, mode: event.target.value as SalaryLine["mode"] } : row)))}>
                <option value="fixed">Fixed ₹</option>
                <option value="percent">% of basic</option>
              </select>
              <input inputMode="decimal" value={String(line.amount)} onChange={(event) => setLines((cur) => cur.map((row, i) => (i === index ? { ...row, amount: Number(event.target.value) || 0 } : row)))} />
              <button type="button" className="btn ghost" style={{ width: "auto", margin: 0, padding: 0 }} onClick={() => setLines((cur) => cur.filter((_, i) => i !== index))}>×</button>
            </div>
          ))}
          <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 10 }} onClick={() => setLines((cur) => [...cur, emptyLine()])}>Add line</button>
          <div className="panel" style={{ marginTop: 16, padding: 14, background: "var(--if-cream)" }}>
            <div className="muted">Sample slip · one unit</div>
            <div className="if-num" style={{ fontSize: 22, fontWeight: 700 }}>{inr(Math.max(preview, 0))}</div>
          </div>
          <div className="wizard-foot">
            <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 0 }} onClick={() => setEditing(null)}>Cancel</button>
            <div style={{ flex: 1 }} />
            <button type="button" className="btn" style={{ width: "auto", marginTop: 0 }} disabled={busy} onClick={() => void save()}>Save template</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

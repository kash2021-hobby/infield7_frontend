"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { api, loadSession } from "@/lib/api";
import { SourceMark, WfCrumbs, WfRail } from "@/lib/workflow-ui";

type Evidence = "none" | "photo" | "geofence" | "signature" | "form";
type Step = {
  id?: string;
  title: string;
  kind: "trigger" | "step" | "handoff" | "approval" | "notify" | "end";
  evidence: Evidence;
  slaHours: number;
  assigneeRole: string | null;
  sourceSection: string | null;
  sourceLabel: string | null;
  onLate: boolean;
  onMissed: boolean;
};
type Person = { id: string; name: string; role: string };
type Check = { id: string; ok: boolean; label: string };
type Wf = {
  id: string;
  name: string;
  prompt: string | null;
  trigger: string;
  status: string;
  version: number;
  enabled: boolean;
  brainMode: string;
  alertsOn: boolean;
  assigneeUserId: string | null;
  steps: Step[];
  people: Person[];
  versions: { version: number; publishedAt: string }[];
};

const STAGES = ["interview", "draft", "configure", "alerts", "test", "publish"] as const;
type Stage = (typeof STAGES)[number];

function railFor(stage: Stage) {
  if (stage === "interview") return 0;
  if (stage === "draft") return 1;
  if (stage === "configure") return 2;
  if (stage === "alerts") return 3;
  if (stage === "test") return 4;
  return 5;
}

function blankStep(): Step {
  return {
    title: "New step",
    kind: "step",
    evidence: "none",
    slaHours: 24,
    assigneeRole: null,
    sourceSection: null,
    sourceLabel: null,
    onLate: true,
    onMissed: false,
  };
}

function Wizard() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const stage = (STAGES.includes(search.get("stage") as Stage) ? search.get("stage") : "draft") as Stage;
  const [wf, setWf] = useState<Wf | null>(null);
  const [questions, setQuestions] = useState<{ id: string; prompt: string; why: string; options?: string[] }[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [qIndex, setQIndex] = useState(0);
  const [testAt, setTestAt] = useState(0);
  const [openStep, setOpenStep] = useState(0);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const current = loadSession();
    if (!current) return;
    const body = await api<Wf>(`/workflows/${params.id}`, {}, current.token);
    setWf(body);
  }, [params.id]);

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
  }, [load]);

  useEffect(() => {
    if (stage !== "interview") return;
    const current = loadSession();
    if (!current) return;
    api<{ questions: typeof questions }>(`/workflows/${params.id}/interview`, {}, current.token)
      .then((body) => setQuestions(body.questions))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load questions"));
  }, [stage, params.id]);

  function go(next: Stage) {
    router.replace(`/workflows/${params.id}?stage=${next}`);
  }

  async function patch(body: object) {
    const current = loadSession();
    if (!current) return;
    const saved = await api<Wf>(`/workflows/${params.id}`, { method: "PATCH", body: JSON.stringify(body) }, current.token);
    setWf(saved);
    return saved;
  }

  async function draft(withAnswers?: Record<string, string>) {
    const current = loadSession();
    if (!current) return;
    setBusy(true);
    setError("");
    try {
      const body = await api<Wf>(`/workflows/${params.id}/draft`, {
        method: "POST",
        body: JSON.stringify({ answers: withAnswers }),
      }, current.token);
      setWf(body);
      go("draft");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not draft");
    } finally {
      setBusy(false);
    }
  }

  function setStep(index: number, next: Partial<Step>) {
    if (!wf) return;
    setWf({ ...wf, steps: wf.steps.map((s, i) => (i === index ? { ...s, ...next } : s)) });
  }

  function moveStep(index: number, dir: -1 | 1) {
    if (!wf) return;
    const next = index + dir;
    if (next < 0 || next >= wf.steps.length) return;
    const steps = [...wf.steps];
    const [row] = steps.splice(index, 1);
    steps.splice(next, 0, row);
    setWf({ ...wf, steps });
    setOpenStep(next);
  }

  const q = questions[qIndex];
  const currentTest = wf?.steps[testAt];

  return (
    <div className="wf-page">
      <WfRail current={railFor(stage)} hint={wf?.brainMode === "off" ? "NO BRAIN" : "BRAIN MATCHES ONLY"} />
      <div className="rpt-head">
        <div>
          <WfCrumbs items={["Automation", "Workflows", wf?.name ?? "Workflow"]} />
          <h1 className="page-title" style={{ margin: 0 }}>{wf?.name ?? "Workflow"}</h1>
        </div>
        <div className="rpt-actions">
          <Link className="btn ghost" href="/workflows">Library</Link>
        </div>
      </div>
      {error ? <div className="error">{error}</div> : null}
      {note ? <p className="muted">{note}</p> : null}

      {stage === "interview" && q ? (
        <div className="panel" style={{ maxWidth: 640 }}>
          <div className="muted">{qIndex + 1} of {questions.length}</div>
          <h2 style={{ fontSize: 22, margin: "8px 0" }}>{q.prompt}</h2>
          <p className="muted">{q.why}</p>
          {q.options?.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {q.options.map((opt) => (
                <button key={opt} type="button" className={`wf-opt${answers[q.id] === opt ? " on" : ""}`} onClick={() => setAnswers({ ...answers, [q.id]: opt })}>
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <input value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
          )}
          <div className="rpt-actions" style={{ marginTop: 16 }}>
            <button type="button" className="btn secondary" disabled={qIndex === 0} onClick={() => setQIndex((n) => n - 1)}>Back</button>
            {qIndex < questions.length - 1 ? (
              <button type="button" className="btn" onClick={() => setQIndex((n) => n + 1)}>Next</button>
            ) : (
              <button type="button" className="btn" disabled={busy} onClick={() => void draft(answers)}>Draft from answers</button>
            )}
            <button type="button" className="btn ghost" disabled={busy} onClick={() => void draft()}>Skip — draft it</button>
          </div>
        </div>
      ) : null}

      {stage === "draft" && wf ? (
        <div className="wf-split">
          <div>
            {wf.steps.map((s, i) => (
              <div key={s.id ?? i} className="wf-node">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div className="wf-kind">{s.kind}</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button type="button" className="btn ghost" style={{ margin: 0, width: "auto", padding: "2px 8px" }} onClick={() => moveStep(i, -1)}>Up</button>
                    <button type="button" className="btn ghost" style={{ margin: 0, width: "auto", padding: "2px 8px" }} onClick={() => moveStep(i, 1)}>Down</button>
                    <button type="button" className="btn ghost" style={{ margin: 0, width: "auto", padding: "2px 8px" }} onClick={() => setWf({ ...wf, steps: wf.steps.filter((_, j) => j !== i) })}>Remove</button>
                  </div>
                </div>
                <input value={s.title} onChange={(e) => setStep(i, { title: e.target.value })} />
                <SourceMark label={s.sourceLabel} href={s.sourceSection ? `/brain/${s.sourceSection}` : null} />
              </div>
            ))}
            <button type="button" className="btn secondary" style={{ width: "auto" }} onClick={() => setWf({ ...wf, steps: [...wf.steps, blankStep()] })}>Add step</button>
            <div className="rpt-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn" disabled={busy} onClick={async () => { setBusy(true); await patch({ steps: wf.steps, name: wf.name }); setBusy(false); go("configure"); }}>Configure steps</button>
            </div>
          </div>
          <div className="panel">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Sources</div>
            <p className="muted">A chip appears only when a Brain row matched that step. Empty means the line is from your description or a template — not an invented score.</p>
            {wf.steps.filter((s) => s.sourceLabel).map((s, i) => (
              <div key={s.id ?? i} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{s.title}</div>
                <SourceMark label={s.sourceLabel} href={s.sourceSection ? `/brain/${s.sourceSection}` : null} />
              </div>
            ))}
            {wf.steps.every((s) => !s.sourceLabel) ? <div className="muted">No Brain matches on these steps.</div> : null}
          </div>
        </div>
      ) : null}

      {stage === "configure" && wf ? (
        <div>
          <div className="grid" style={{ marginBottom: 16 }}>
            <div>
              <label htmlFor="wname">Name</label>
              <input id="wname" value={wf.name} onChange={(e) => setWf({ ...wf, name: e.target.value })} />
            </div>
            <div>
              <label htmlFor="who">Default assignee</label>
              <select id="who" value={wf.assigneeUserId ?? ""} onChange={(e) => setWf({ ...wf, assigneeUserId: e.target.value || null })}>
                <option value="">Unassigned</option>
                {wf.people.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.role}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="trig">Starts</label>
              <select id="trig" value={wf.trigger} onChange={(e) => setWf({ ...wf, trigger: e.target.value })}>
                <option value="manual">When you publish</option>
                <option value="checkin">After check-in</option>
              </select>
            </div>
          </div>
          {wf.steps.map((s, i) => (
            <div key={s.id ?? i} className={`panel${openStep === i ? " wf-open" : ""}`} style={{ marginBottom: 10 }}>
              <button type="button" className="wf-step-head" onClick={() => setOpenStep(i)}>
                <span className="wf-kind">{s.kind} · step {i + 1}</span>
                <span style={{ fontWeight: 600 }}>{s.title || "Untitled"}</span>
              </button>
              {openStep === i ? (
                <>
                  <input value={s.title} onChange={(e) => setStep(i, { title: e.target.value })} />
                  <div className="grid" style={{ marginTop: 10 }}>
                    <div>
                      <label>Evidence</label>
                      <select value={s.evidence} onChange={(e) => setStep(i, { evidence: e.target.value as Evidence })}>
                        <option value="none">None</option>
                        <option value="photo">Photo</option>
                        <option value="geofence">Inside a site fence</option>
                        <option value="signature">Signature</option>
                        <option value="form">Form</option>
                      </select>
                    </div>
                    <div>
                      <label>Hours until late</label>
                      <input type="number" min={0} max={168} value={s.slaHours} onChange={(e) => setStep(i, { slaHours: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label>Role from RACI</label>
                      <input value={s.assigneeRole ?? ""} onChange={(e) => setStep(i, { assigneeRole: e.target.value })} />
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          ))}
          <p className="muted">Closing a live task needs a photo, a signature, or a form payload.</p>
          <button type="button" className="btn" disabled={busy} onClick={async () => { setBusy(true); await patch({ name: wf.name, assigneeUserId: wf.assigneeUserId, trigger: wf.trigger, steps: wf.steps }); setBusy(false); go("alerts"); }}>Alerts</button>
        </div>
      ) : null}

      {stage === "alerts" && wf ? (
        <div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 600, marginBottom: 16 }}>
            <input type="checkbox" checked={wf.alertsOn} onChange={(e) => setWf({ ...wf, alertsOn: e.target.checked })} style={{ width: "auto" }} />
            Use the Task overdue rule for late steps
          </label>
          {wf.steps.map((s, i) => (
            <div key={s.id ?? i} className="panel" style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 600 }}>{s.title}</div>
              <div className="muted" style={{ marginBottom: 8 }}>{s.slaHours}h budget · {s.kind} · {s.evidence}</div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <label className="muted" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="checkbox" checked={s.onLate} onChange={(e) => setStep(i, { onLate: e.target.checked })} style={{ width: "auto" }} />
                  Alert if late
                </label>
                <label className="muted" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="checkbox" checked={s.onMissed} onChange={(e) => setStep(i, { onMissed: e.target.checked })} style={{ width: "auto" }} />
                  Note missed evidence
                </label>
              </div>
            </div>
          ))}
          <p className="muted">Publishing turns on the existing Task overdue rule. SMS stays off until MSG91. Missed-evidence is stored on the step; closing still requires a photo.</p>
          <button type="button" className="btn" disabled={busy} onClick={async () => { setBusy(true); await patch({ alertsOn: wf.alertsOn, steps: wf.steps }); setBusy(false); go("test"); }}>Test run</button>
        </div>
      ) : null}

      {stage === "test" && wf ? (
        <div className="wf-split">
          <div>
            {wf.steps.map((s, i) => (
              <div key={s.id ?? i} className={`wf-node${i === testAt ? " on" : ""}`} onClick={() => setTestAt(i)} onKeyDown={() => undefined} role="button" tabIndex={0}>
                <div className="wf-kind">{s.kind}</div>
                <div style={{ fontWeight: 600 }}>{s.title}</div>
              </div>
            ))}
            <div className="rpt-actions">
              <button type="button" className="btn secondary" disabled={testAt === 0} onClick={() => setTestAt((n) => n - 1)}>Previous</button>
              <button type="button" className="btn secondary" disabled={testAt >= wf.steps.length - 1} onClick={() => setTestAt((n) => n + 1)}>Step forward</button>
              <button type="button" className="btn ghost" onClick={() => go("configure")}>Fix and re-test</button>
              <button type="button" className="btn" onClick={() => go("publish")}>Looks right — publish</button>
            </div>
            <p className="muted">Dry run. No tasks are written until you publish.</p>
          </div>
          <div className="wf-phone">
            <div className="wf-phone-bar">{wf.name}</div>
            <div className="wf-phone-body">
              <div className="wf-kind">{currentTest?.kind}</div>
              <div style={{ fontSize: 18, fontWeight: 700, margin: "8px 0" }}>{currentTest?.title}</div>
              <p className="muted">
                {currentTest?.evidence === "photo" ? "Add a photo to close."
                  : currentTest?.evidence === "geofence" ? "Be inside a site fence."
                  : currentTest?.evidence === "signature" || currentTest?.evidence === "form"
                    ? "Flagged on this step. Closing still needs a photo."
                    : "Mark done when finished."}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {stage === "publish" && wf ? (
        <PublishBox id={params.id} wf={wf} setWf={setWf} setError={setError} setNote={setNote} setBusy={setBusy} busy={busy} />
      ) : null}
    </div>
  );
}

function PublishBox({ id, wf, setWf, setError, setNote, setBusy, busy }: {
  id: string; wf: Wf; setWf: (w: Wf) => void; setError: (s: string) => void; setNote: (s: string) => void; setBusy: (b: boolean) => void; busy: boolean;
}) {
  const [checks, setChecks] = useState<Check[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const current = loadSession();
    if (!current) return;
    api<{ checks: Check[]; ready: boolean }>(`/workflows/${id}/preflight`, {}, current.token)
      .then((body) => { setChecks(body.checks); setReady(body.ready); })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not check"));
  }, [id, setError]);

  return (
    <div className="wf-split">
      <div className="panel">
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Pre-flight</div>
        {checks.map((c) => (
          <div key={c.id} style={{ display: "flex", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--if-cream-2)" }}>
            <span>{c.ok ? "✓" : "○"}</span>
            <span style={{ color: c.ok ? "var(--if-green-deep)" : "var(--if-ink)" }}>{c.label}</span>
          </div>
        ))}
        <button
          type="button"
          className="btn"
          disabled={busy || !ready}
          style={{ marginTop: 16 }}
          onClick={async () => {
            const current = loadSession();
            if (!current) return;
            setBusy(true);
            setError("");
            try {
              const pub = await api<{ version: number; tasks: number }>(`/workflows/${id}/publish`, { method: "POST", body: "{}" }, current.token);
              setNote(`Live as v${pub.version}. ${pub.tasks} task opened.`);
              const next = await api<Wf>(`/workflows/${id}`, {}, current.token);
              setWf(next);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not publish");
            } finally {
              setBusy(false);
            }
          }}
        >
          Publish
        </button>
      </div>
      <div className="panel">
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Version history</div>
        {(wf.versions ?? []).map((v) => (
          <div key={v.version} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--if-cream-2)", gap: 8 }}>
            <span>v{v.version} · {new Date(v.publishedAt).toLocaleString("en-IN", { day: "numeric", month: "short" })}</span>
            <button
              type="button"
              className="btn secondary"
              style={{ margin: 0, width: "auto", padding: "4px 10px" }}
              onClick={async () => {
                const current = loadSession();
                if (!current) return;
                setBusy(true);
                try {
                  const next = await api<Wf>(`/workflows/${id}/rollback`, { method: "POST", body: JSON.stringify({ version: v.version }) }, current.token);
                  setWf(next);
                  setNote(`Restored v${v.version} as a draft. Publish again to go live.`);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not roll back");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Rollback
            </button>
          </div>
        ))}
        {wf.versions.length === 0 ? <div className="muted">No published version yet.</div> : null}
      </div>
    </div>
  );
}

export default function WorkflowWizardPage() {
  return (
    <Suspense fallback={<div className="muted">Loading…</div>}>
      <Wizard />
    </Suspense>
  );
}

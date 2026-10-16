"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, loadSession } from "@/lib/api";
import { Glyph, type AlertGlyphName } from "@/lib/alert-glyphs";
import { Field } from "@/lib/employee-wizard";
import { ReportCrumbs } from "@/lib/reports";

export type Kind = "late_checkin" | "geofence_exit" | "sos" | "task_delay" | "overtime" | "missed_checkin" | "missed_visit" | "sales_below" | "absence_pattern" | "device_offline" | "low_battery";
export type Condition = { field: string; op: string; value: string; key?: string };
export type Spec = {
  join?: "and" | "or";
  conditions?: Condition[];
  actions?: string[];
  frequency?: string;
  category?: string;
  priority?: string;
};
export type Rule = {
  id?: string;
  name: string;
  kind: Kind;
  status: "draft" | "published";
  builtin?: boolean;
  enabled?: boolean;
  siteId: string | null;
  minutesOver: number | null;
  notifyManagers: boolean;
  notifyPerson: boolean;
  escalateAfterMin?: number;
  spec?: Spec | null;
};

type Site = { id: string; name: string };
type Trigger = { id: string; label: string; cat: string; icon: AlertGlyphName; kind?: Kind; held?: string };

const TRIGGERS: Trigger[] = [
  { id: "geofence_exit", label: "Geofence exit", cat: "Location", icon: "pin", kind: "geofence_exit" },
  { id: "geofence_enter", label: "Geofence enter", cat: "Location", icon: "pin", kind: "geofence_exit" },
  { id: "late_checkin", label: "Late check-in", cat: "Attendance", icon: "clock", kind: "late_checkin" },
  { id: "overtime", label: "Overtime threshold", cat: "Attendance", icon: "clock", kind: "overtime" },
  { id: "task_overdue", label: "Task overdue", cat: "Tasks", icon: "check", kind: "task_delay" },
  { id: "target_near", label: "Sales target near", cat: "Sales", icon: "target", kind: "sales_below" },
  { id: "low_battery", label: "Low battery", cat: "Device", icon: "settings", kind: "low_battery" },
  { id: "panic", label: "Panic button", cat: "Safety", icon: "alert", kind: "sos" },
];

type Action = { id: string; label: string; icon: AlertGlyphName; live?: boolean; hint?: string; held?: string };

const ACTIONS: Action[] = [
  { id: "notify_manager", label: "Notify manager", icon: "bell", live: true, hint: "Push to the site manager." },
  { id: "notify_employee", label: "Notify employee", icon: "phone", live: true, hint: 'Push: "You are outside the designated work area."' },
  { id: "notify_group", label: "Notify group", icon: "users", live: true, hint: "Same as notify manager for now." },
  { id: "sms", label: "Send SMS", icon: "message", live: true, hint: "Uses MSG91 or Twilio when SMS_PROVIDER is set." },
  { id: "email", label: "Send email", icon: "message", live: true, hint: "Needs an email on the rule spec." },
  { id: "call", label: "Call", icon: "phone", held: "Voice call is off this product." },
  { id: "whatsapp", label: "WhatsApp", icon: "message", live: true, hint: "Meta Cloud API when WHATSAPP_TOKEN is set." },
  { id: "webhook", label: "Webhook", icon: "settings", live: true, hint: "HMAC-signed POST. Set webhook URL on the rule." },
  { id: "escalate", label: "Escalate after", icon: "arrow", live: true },
  { id: "log", label: "Log incident", icon: "briefcase", live: true, hint: "The feed always keeps a copy." },
  { id: "auto_resume", label: "Auto-resume tracking", icon: "target", held: "Auto-resume is off this product." },
];

const FREQUENCIES = ["Once per employee per shift", "Every time it happens", "Once per day per employee"];
const PRIORITIES = ["High · Coral", "Med · Amber", "Low · Green"];
const DRAFT_KEY = "if7-alert-draft";

function kindToTrigger(kind: Kind) {
  return TRIGGERS.find((item) => item.kind === kind)?.id ?? "late_checkin";
}

function minutesFrom(value: string) {
  const match = value.match(/(\d{1,4})/);
  return match ? Number(match[1]) : null;
}

function seedConditions(rule: Partial<Rule>, sites: Site[]): Condition[] {
  if (rule.spec?.conditions?.length) return rule.spec.conditions;
  const rows: Condition[] = [];
  if (rule.siteId) {
    const site = sites.find((item) => item.id === rule.siteId);
    rows.push({ field: "Site", op: "is", value: site?.name ?? rule.siteId, key: "site" });
  }
  if (rule.minutesOver) {
    const field = rule.kind === "geofence_exit" ? "Duration outside" : "Minutes late";
    rows.push({ field, op: ">", value: `${rule.minutesOver} min`, key: "minutes" });
  }
  return rows;
}

function seedActions(rule: Partial<Rule>) {
  if (rule.spec?.actions?.length) return rule.spec.actions;
  const rows = ["log"];
  if (rule.notifyManagers !== false) rows.unshift("notify_manager");
  if (rule.notifyPerson) rows.splice(rows.includes("notify_manager") ? 1 : 0, 0, "notify_employee");
  if ((rule.escalateAfterMin ?? 15) > 0) rows.push("escalate");
  return rows;
}

function FlowColumn({ label, number, color, children }: { label: string; number: string; color: string; children: React.ReactNode }) {
  return (
    <div className="rule-col">
      <div className="rule-col-head">
        <div className="rule-col-n" style={{ background: color }}>{number}</div>
        <div className="rule-col-label" style={{ color }}>{label}</div>
      </div>
      {children}
    </div>
  );
}

export function RuleForm({ initial, persistLocal, title }: { initial?: Partial<Rule>; persistLocal?: boolean; title?: string }) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "Late check-in");
  const [kind, setKind] = useState<Kind>(initial?.kind ?? "late_checkin");
  const [trigger, setTrigger] = useState(kindToTrigger(initial?.kind ?? "late_checkin"));
  const [siteId, setSiteId] = useState<string>(initial?.siteId ?? "");
  const [minutesOver, setMinutesOver] = useState(initial?.minutesOver ? String(initial.minutesOver) : "");
  const [notifyManagers, setNotifyManagers] = useState(initial?.notifyManagers ?? true);
  const [notifyPerson, setNotifyPerson] = useState(initial?.notifyPerson ?? false);
  const [escalateAfterMin, setEscalateAfterMin] = useState(String(initial?.escalateAfterMin ?? 15));
  const [join, setJoin] = useState<"and" | "or">(initial?.spec?.join ?? "and");
  const [conditions, setConditions] = useState<Condition[]>(() => seedConditions(initial ?? {}, []));
  const [actions, setActions] = useState<string[]>(() => seedActions(initial ?? {}));
  const [frequency, setFrequency] = useState(initial?.spec?.frequency ?? FREQUENCIES[0]);
  const [priority, setPriority] = useState(initial?.spec?.priority ?? PRIORITIES[0]);
  const [adding, setAdding] = useState(false);
  const [addField, setAddField] = useState<"site" | "minutes">("site");
  const [addSite, setAddSite] = useState("");
  const [addMinutes, setAddMinutes] = useState("15");
  const [sites, setSites] = useState<Site[]>([]);
  const [error, setError] = useState("");
  const [heldNote, setHeldNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [ready, setReady] = useState(!persistLocal);
  const [ruleId, setRuleId] = useState(initial?.id);

  const trig = TRIGGERS.find((item) => item.id === trigger) ?? TRIGGERS[2];
  const heading = title ?? (initial?.id ? "Edit alert rule" : "New alert rule");
  const category = trig.cat + (trig.cat === "Location" ? " · Safety" : "");

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      setReady(true);
      return;
    }
    api<{ sites: Site[] }>("/sites", {}, session.token).then((body) => {
      setSites(body.sites);
      if (!persistLocal || initial?.id) setConditions(seedConditions(initial ?? {}, body.sites));
    }).catch(() => undefined);
    if (persistLocal && !initial?.id) {
      if (!(initial?.name === "" && !initial?.minutesOver)) {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (raw) {
          try {
            const saved = JSON.parse(raw) as Rule & { trigger?: string };
            setName(saved.name);
            setKind(saved.kind);
            setTrigger(saved.trigger ?? kindToTrigger(saved.kind));
            setSiteId(saved.siteId ?? "");
            setMinutesOver(saved.minutesOver ? String(saved.minutesOver) : "");
            setNotifyManagers(saved.notifyManagers);
            setNotifyPerson(saved.notifyPerson);
            setEscalateAfterMin(String(saved.escalateAfterMin ?? 15));
            setJoin(saved.spec?.join ?? "and");
            setConditions(saved.spec?.conditions ?? []);
            setActions(saved.spec?.actions ?? seedActions(saved));
            setFrequency(saved.spec?.frequency ?? FREQUENCIES[0]);
            setPriority(saved.spec?.priority ?? PRIORITIES[0]);
          } catch {
            localStorage.removeItem(DRAFT_KEY);
          }
        }
      } else {
        localStorage.removeItem(DRAFT_KEY);
      }
    }
    setReady(true);
  }, [initial?.id, persistLocal]);

  useEffect(() => {
    if (!persistLocal || !ready) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      name, kind, trigger, siteId: siteId || null, minutesOver: minutesOver ? Number(minutesOver) : null,
      notifyManagers, notifyPerson, escalateAfterMin: Number(escalateAfterMin) || 15, status: "draft",
      spec: specBody(),
    }));
  }, [persistLocal, ready, name, kind, trigger, siteId, minutesOver, notifyManagers, notifyPerson, escalateAfterMin, join, conditions, actions, frequency, priority]);

  function specBody(): Spec {
    return {
      join,
      conditions,
      actions,
      frequency,
      category,
      priority,
    };
  }

  function payload(status: "draft" | "published") {
    return {
      name,
      kind,
      siteId: siteId || null,
      minutesOver: minutesOver ? Number(minutesOver) : null,
      notifyManagers,
      notifyPerson,
      escalateAfterMin: Number(escalateAfterMin) || 15,
      status,
      spec: specBody(),
    };
  }

  function pickTrigger(item: Trigger) {
    if (item.held || !item.kind) {
      setHeldNote(item.held || "Off this product.");
      return;
    }
    setHeldNote("");
    setTrigger(item.id);
    setKind(item.kind);
    if (!name || TRIGGERS.some((row) => row.label === name)) setName(item.label);
    setConditions((prev) => prev.map((row) => (
      row.key === "minutes"
        ? { ...row, field: item.kind === "geofence_exit" ? "Duration outside" : "Minutes late" }
        : row
    )));
  }

  function removeCondition(index: number) {
    const next = conditions.filter((_, i) => i !== index);
    setConditions(next);
    const site = next.find((row) => row.key === "site");
    const minutes = next.find((row) => row.key === "minutes");
    if (!site) setSiteId("");
    if (!minutes) setMinutesOver("");
    else {
      const n = minutesFrom(minutes.value);
      if (n) setMinutesOver(String(n));
    }
  }

  function addCondition() {
    if (addField === "site") {
      if (conditions.some((row) => row.key === "site")) return;
      const site = sites.find((item) => item.id === addSite);
      if (!site) return;
      setConditions([...conditions, { field: "Site", op: "is", value: site.name, key: "site" }]);
      setSiteId(site.id);
    } else {
      const n = Number(addMinutes);
      if (!n || n < 1) return;
      const field = kind === "geofence_exit" ? "Duration outside" : "Minutes late";
      setConditions([...conditions.filter((row) => row.key !== "minutes"), { field, op: ">", value: `${n} min`, key: "minutes" }]);
      setMinutesOver(String(n));
    }
    setAdding(false);
  }

  function toggleAction(id: string) {
    const def = ACTIONS.find((item) => item.id === id);
    if (def?.held) {
      setHeldNote(def.held);
      return;
    }
    if (id === "log") {
      setHeldNote("The feed always keeps a copy.");
      if (!actions.includes("log")) setActions([...actions, "log"]);
      return;
    }
    setHeldNote("");
    if (actions.includes(id)) {
      const next = actions.filter((item) => item !== id);
      setActions(next.includes("log") ? next : [...next, "log"]);
      if (id === "notify_manager") setNotifyManagers(false);
      if (id === "notify_employee") setNotifyPerson(false);
    } else {
      setActions([...actions, id]);
      if (id === "notify_manager") setNotifyManagers(true);
      if (id === "notify_employee") setNotifyPerson(true);
    }
  }

  async function save(status: "draft" | "published", stay = false) {
    const session = loadSession();
    if (!session) return null;
    setBusy(true);
    setError("");
    try {
      const saved = ruleId
        ? await api<Rule>(`/alert-rules/${ruleId}`, { method: "PATCH", body: JSON.stringify(payload(status)) }, session.token)
        : await api<Rule>("/alert-rules", { method: "POST", body: JSON.stringify(payload(status)) }, session.token);
      if (saved.id) setRuleId(saved.id);
      if (status === "published" && saved.id) {
        await api(`/alert-rules/${saved.id}/publish`, { method: "POST", body: "{}" }, session.token);
      }
      localStorage.removeItem(DRAFT_KEY);
      if (!stay) router.push("/alerts");
      return saved;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function testRule() {
    setTesting(true);
    setError("");
    try {
      const saved = await save("draft", true);
      if (saved?.id) router.push(`/alerts/${saved.id}/test`);
    } finally {
      setTesting(false);
    }
  }

  const condText = useMemo(() => {
    if (!conditions.length) return "no extra filter";
    return conditions.map((row) => `${row.field.toLowerCase()} ${row.op} ${row.value}`).join(join === "or" ? " or " : " and ");
  }, [conditions, join]);

  const thenText = useMemo(() => {
    const bits = [];
    if (actions.includes("notify_manager")) bits.push("notify the site manager");
    if (actions.includes("notify_employee")) bits.push("notify the employee");
    if (actions.includes("log")) bits.push("log the incident");
    let text = bits.length ? bits.join(" and ") : "log the incident";
    if (actions.includes("escalate")) text += `, then escalate after ${escalateAfterMin} min`;
    return text;
  }, [actions, escalateAfterMin]);

  const others = TRIGGERS.filter((item) => item.id !== trigger);
  const moreActions = ACTIONS.filter((item) => !actions.includes(item.id));

  return (
    <div className="emp-page">
      <div className="rpt-head">
        <div>
          <ReportCrumbs items={["Automation", "Alerts", initial?.id ? "Edit rule" : "New rule"]} />
          <h1 className="page-title" style={{ margin: 0 }}>{heading}</h1>
        </div>
        <div className="rpt-actions">
          <Link className="btn ghost" href="/alerts">Cancel</Link>
          <button className="btn ghost" type="button" disabled={busy || initial?.builtin} onClick={() => void save("draft")}>Save draft</button>
          <button className="btn secondary" type="button" disabled={testing || initial?.builtin} onClick={() => void testRule()}>Save & test</button>
          <button className="btn" type="button" disabled={busy || initial?.builtin} onClick={() => void save("published")}>Save rule</button>
        </div>
      </div>
      {error ? <div className="error" style={{ marginBottom: 12 }}>{error}</div> : null}
      {heldNote ? <div className="muted" style={{ marginBottom: 12 }}>{heldNote}</div> : null}
      {initial?.builtin ? <div className="muted" style={{ marginBottom: 12 }}>The built-in rule stays as it is. Turn it off on the library, or add a new rule next to it.</div> : null}

      <div className="panel" style={{ padding: 20, marginBottom: 20 }}>
        <div className="rule-meta">
          <Field label="Rule name" required>
            <input id="rule-name" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Category">
            <select value={category} disabled>
              <option>{category}</option>
            </select>
          </Field>
          <Field label="Priority">
            <select value={priority} onChange={(event) => setPriority(event.target.value)}>
              {PRIORITIES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </Field>
        </div>
      </div>

      <div className="rule-flow">
        <FlowColumn label="WHEN" number="1" color="var(--if-amber)">
          <div className="rule-hint">Pick the event that starts this rule.</div>
          <div className="rule-trig">
            <div className="rule-trig-icon"><Glyph name={trig.icon} size={16} color="var(--if-amber)" /></div>
            <div style={{ flex: 1 }}>
              <div className="rule-trig-name">{trig.label}</div>
              <div className="rule-trig-cat">{trig.cat}</div>
            </div>
            <Glyph name="check" size={16} color="var(--if-amber)" />
          </div>
          <div className="rule-section">Other triggers</div>
          <div className="rule-others">
            {others.map((item) => (
              <button
                key={item.id}
                type="button"
                data-trigger={item.id}
                className={`rule-other${item.held ? " held" : ""}`}
                onClick={() => pickTrigger(item)}
              >
                <div className="rule-other-icon"><Glyph name={item.icon} size={12} color="var(--if-ink-3)" /></div>
                <div style={{ flex: 1, textAlign: "left", fontSize: 12, fontWeight: 500, color: "var(--if-ink-2)" }}>{item.label}</div>
                <div style={{ fontSize: 10, color: "var(--if-ink-3)" }}>{item.held ? "Off" : item.cat}</div>
              </button>
            ))}
          </div>
        </FlowColumn>

        <FlowColumn label="IF" number="2" color="var(--if-ink)">
          <div className="rule-hint">Add conditions to narrow when this fires.</div>
          <div className="rule-conds">
            {conditions.map((row, index) => (
              <div key={`${row.key}-${index}`} className="panel" style={{ padding: 12, margin: 0 }}>
                <div className="rule-cond-row">
                  <span className="rule-chip">{row.field}</span>
                  <span className="rule-op">{row.op}</span>
                  <span className="rule-chip on if-num">{row.value}</span>
                  <div style={{ flex: 1 }} />
                  <button type="button" className="rule-x" aria-label="Remove condition" onClick={() => removeCondition(index)}>
                    <Glyph name="close" size={14} color="var(--if-ink-3)" />
                  </button>
                </div>
                {index < conditions.length - 1 ? (
                  <button type="button" className="rule-join" onClick={() => setJoin(join === "and" ? "or" : "and")}>
                    <span />
                    {join.toUpperCase()}
                    <span />
                  </button>
                ) : null}
              </div>
            ))}
            {adding ? (
              <div className="panel" style={{ padding: 12, margin: 0 }}>
                <label htmlFor="add-field">Condition</label>
                <select id="add-field" value={addField} onChange={(event) => setAddField(event.target.value as "site" | "minutes")}>
                  <option value="site">Site is</option>
                  <option value="minutes">{kind === "geofence_exit" ? "Duration outside >" : "Minutes late >"}</option>
                </select>
                {addField === "site" ? (
                  <>
                    <label htmlFor="add-site" style={{ marginTop: 8 }}>Site</label>
                    <select id="add-site" value={addSite} onChange={(event) => setAddSite(event.target.value)}>
                      <option value="">Pick a site</option>
                      {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
                    </select>
                  </>
                ) : (
                  <>
                    <label htmlFor="add-min" style={{ marginTop: 8 }}>Minutes</label>
                    <input id="add-min" className="if-num" type="number" min={1} value={addMinutes} onChange={(event) => setAddMinutes(event.target.value)} />
                  </>
                )}
                <div className="rpt-actions" style={{ marginTop: 10 }}>
                  <button type="button" className="btn ghost" onClick={() => setAdding(false)}>Cancel</button>
                  <button type="button" className="btn secondary" onClick={addCondition}>Add</button>
                </div>
              </div>
            ) : (
              <button type="button" className="rule-dash" onClick={() => setAdding(true)}>
                <Glyph name="plus" size={12} color="var(--if-ink-3)" /> Add condition
              </button>
            )}
          </div>
          <div className="rule-section" style={{ marginTop: 20 }}>How often can it fire?</div>
          <select value={frequency} onChange={(event) => setFrequency(event.target.value)}>
            {FREQUENCIES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </FlowColumn>

        <FlowColumn label="THEN" number="3" color="var(--if-green)">
          <div className="rule-hint">What should InField do when this triggers?</div>
          <div className="rule-conds">
            {actions.map((id) => {
              const item = ACTIONS.find((row) => row.id === id);
              if (!item) return null;
              return (
                <div key={id} className="panel" style={{ padding: 12, margin: 0 }} data-action={id}>
                  <div className="rule-cond-row">
                    <div className="rule-act-icon"><Glyph name={item.icon} size={14} color="var(--if-green-deep)" /></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{item.label}</div>
                      {id === "escalate" ? (
                        <div style={{ fontSize: 10, color: "var(--if-ink-3)", marginTop: 2 }}>
                          After{" "}
                          <input
                            className="if-num rule-esc"
                            type="number"
                            min={1}
                            value={escalateAfterMin}
                            onChange={(event) => setEscalateAfterMin(event.target.value)}
                          />
                          {" "}min without resolution
                        </div>
                      ) : (
                        <div style={{ fontSize: 10, color: "var(--if-ink-3)", marginTop: 2 }}>{item.hint}</div>
                      )}
                    </div>
                    <button type="button" className="rule-x" aria-label={`Remove ${item.label}`} onClick={() => toggleAction(id)}>
                      <Glyph name="close" size={14} color="var(--if-ink-3)" />
                    </button>
                  </div>
                </div>
              );
            })}
            <button type="button" className="rule-dash" onClick={() => setHeldNote("Pick from More actions below.")}>
              <Glyph name="plus" size={12} color="var(--if-ink-3)" /> Add action
            </button>
          </div>
          <div className="rule-section" style={{ marginTop: 20 }}>More actions</div>
          <div className="rule-more">
            {moreActions.map((item) => (
              <button key={item.id} type="button" data-action={item.id} className={`rule-more-chip${item.held ? " held" : ""}`} onClick={() => toggleAction(item.id)}>
                <Glyph name={item.icon} size={12} color="var(--if-ink-3)" /> {item.label}
              </button>
            ))}
          </div>
        </FlowColumn>
      </div>

      <div className="rule-sum panel">
        <div className="rule-sum-k">Rule summary</div>
        <div className="rule-sum-body">
          <span className="rule-tag when">WHEN</span> {trig.label.toLowerCase()}{" "}
          <span className="rule-tag if">IF</span> {condText}{" "}
          <span className="rule-tag then">THEN</span> {thenText}.
        </div>
      </div>

    </div>
  );
}

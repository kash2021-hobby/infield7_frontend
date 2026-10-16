"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, loadSession, type Session } from "@/lib/api";
import { BrainRail, BrainShell, type BrainModule } from "@/lib/brain-ui";

type Item = { id: string; title: string; body: string; extra: Record<string, unknown> | null };
type Policy = { id: string; name: string; body: string; minutes: number | null };
type Document = { id: string; name: string; body: string; tag: string; version: number };
type Profile = { about: string; values: string; websiteUrl: string; websiteText: string; pitch: string };

const TITLES: Record<string, { crumbs: string[]; title: string; subtitle: string; rail: string }> = {
  narrative: {
    crumbs: ["Business Brain", "Company narrative"],
    title: "Who you are",
    subtitle: "Paste a site URL to pull visible text, then edit. Nothing here is invented.",
    rail: "narrative",
  },
  products: {
    crumbs: ["Business Brain", "Products & services"],
    title: "Products & services",
    subtitle: "Catalog entries you add. Price is a band you type — not payroll.",
    rail: "products",
  },
  people: {
    crumbs: ["Business Brain", "People & roles"],
    title: "People & roles (RACI+)",
    subtitle: "Who is responsible for each process. Used later as a lookup, not an auto-assignee.",
    rail: "people",
  },
  documents: {
    crumbs: ["Business Brain", "Documents & templates"],
    title: "Documents & templates",
    subtitle: "Paste SOP or checklist text. Tag it. Older rows stay for audit.",
    rail: "docs",
  },
  policies: {
    crumbs: ["Business Brain", "Policies, SLAs & thresholds"],
    title: "Policies, SLAs & thresholds",
    subtitle: "Plain-language rules. Optional minutes feed late and delay templates.",
    rail: "policies",
  },
  integrations: {
    crumbs: ["Business Brain", "Integrations"],
    title: "Integrations & data sources",
    subtitle: "Save a webhook URL you own. Tally, WhatsApp, Sheets, and CRM stay off this product.",
    rail: "integrations",
  },
};

export default function BrainSectionPage() {
  const params = useParams<{ section: string }>();
  const section = params.section;
  const meta = TITLES[section] ?? TITLES.narrative;
  const [session, setSession] = useState<Session | null>(null);
  const [modules, setModules] = useState<BrainModule[]>([]);
  const [score, setScore] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadCover = useCallback(async (current: Session) => {
    const body = await api<{ score?: number; modules?: BrainModule[] }>("/brain", {}, current.token);
    setScore(body.score ?? 0);
    setModules(body.modules ?? []);
  }, []);

  useEffect(() => {
    const current = loadSession();
    if (!current) return;
    setSession(current);
    loadCover(current).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
  }, [loadCover]);

  if (!TITLES[section]) {
    return <div className="error">Unknown Brain section.</div>;
  }

  return (
    <BrainShell crumbs={meta.crumbs} title={meta.title} subtitle={meta.subtitle}>
      {error ? <div className="error" style={{ marginBottom: 12 }}>{error}</div> : null}
      {notice ? <div className="devcode" style={{ marginBottom: 12 }}>{notice}</div> : null}
      <div className="brain-split">
        <BrainRail active={meta.rail} score={score} modules={modules} />
        <div className="brain-main">
          {section === "narrative" && session ? <Narrative session={session} onSaved={() => void loadCover(session)} setError={setError} setNotice={setNotice} /> : null}
          {section === "products" && session ? <Items session={session} category="products" fields={["sla", "customer", "priceBand"]} labels={{ sla: "SLA", customer: "Target customer", priceBand: "Price band" }} extraCategory="customers" extraLabel="Customer segment" onSaved={() => void loadCover(session)} setError={setError} /> : null}
          {section === "people" && session ? <Items session={session} category="people" fields={["responsible", "accountable", "consulted", "informed", "substitute", "onCall"]} labels={{ responsible: "Responsible", accountable: "Accountable", consulted: "Consulted", informed: "Informed", substitute: "Substitute", onCall: "On-call" }} titleLabel="Process" onSaved={() => void loadCover(session)} setError={setError} /> : null}
          {section === "documents" && session ? <Docs session={session} onSaved={() => void loadCover(session)} setError={setError} /> : null}
          {section === "policies" && session ? <Policies session={session} onSaved={() => void loadCover(session)} setError={setError} /> : null}
          {section === "integrations" && session ? <Integrations session={session} onSaved={() => void loadCover(session)} setError={setError} /> : null}
        </div>
      </div>
    </BrainShell>
  );
}

function Narrative({
  session,
  onSaved,
  setError,
  setNotice,
}: {
  session: Session;
  onSaved: () => void;
  setError: (value: string) => void;
  setNotice: (value: string) => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [url, setUrl] = useState("");
  const [crawl, setCrawl] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ profile?: Profile; about?: string }>("/brain", {}, session.token).then((body) => {
      const profile = body.profile ?? { about: "", values: "", websiteUrl: "", websiteText: "", pitch: "" };
      setProfile(profile);
      setUrl(profile.websiteUrl);
    }).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load"));
  }, [session, setError]);

  async function scrape() {
    setBusy(true);
    setError("");
    setCrawl(`GET ${url}…`);
    try {
      const body = await api<{ status: number; characters: number; text: string; url: string }>("/brain/scrape", {
        method: "POST",
        body: JSON.stringify({ url }),
      }, session.token);
      setCrawl(`GET ${body.url} → ${body.status} · ${body.characters} characters pulled. Edit below — this is page text, not an AI rewrite.`);
      setProfile((current) => current ? { ...current, websiteUrl: body.url, websiteText: body.text } : current);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that page");
      setCrawl("");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!profile) return;
    setBusy(true);
    setError("");
    try {
      const saved = await api<Profile>("/brain/profile", {
        method: "PATCH",
        body: JSON.stringify({
          about: profile.about,
          values: profile.values,
          pitch: profile.pitch,
          websiteUrl: profile.websiteUrl || url,
          websiteText: profile.websiteText,
        }),
      }, session.token);
      setProfile(saved);
      setNotice("Narrative saved. Chunks were reindexed for search.");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  if (!profile) return <div className="muted">Loading…</div>;

  return (
    <>
      <div className="panel" style={{ padding: 0, overflow: "hidden", margin: 0 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--if-cream-2)", fontWeight: 700 }}>Website & online presence</div>
        <div style={{ padding: 20 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" style={{ flex: 1, fontFamily: "var(--if-mono)" }} />
            <button type="button" className="btn" style={{ width: "auto", marginTop: 0 }} disabled={busy} onClick={() => void scrape()}>{busy ? "Reading…" : "Read page"}</button>
          </div>
          {crawl ? <p className="muted" style={{ marginTop: 12, fontFamily: "var(--if-mono)", fontSize: 12 }}>{crawl}</p> : null}
          <label htmlFor="webtext" style={{ marginTop: 16 }}>Text pulled from the page</label>
          <textarea id="webtext" rows={8} value={profile.websiteText} onChange={(event) => setProfile({ ...profile, websiteText: event.target.value })} />
        </div>
      </div>
      <div className="panel" style={{ padding: 20, margin: 0 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Your version</div>
        <label htmlFor="pitch">Elevator pitch</label>
        <textarea id="pitch" rows={3} value={profile.pitch} onChange={(event) => setProfile({ ...profile, pitch: event.target.value })} />
        <label htmlFor="about" style={{ marginTop: 12 }}>About</label>
        <textarea id="about" rows={5} value={profile.about} onChange={(event) => setProfile({ ...profile, about: event.target.value })} />
        <label htmlFor="values" style={{ marginTop: 12 }}>Values</label>
        <textarea id="values" rows={4} value={profile.values} onChange={(event) => setProfile({ ...profile, values: event.target.value })} />
        <button type="button" className="btn" style={{ width: "auto" }} disabled={busy} onClick={() => void save()}>Approve & save</button>
      </div>
    </>
  );
}

function Items({
  session,
  category,
  fields,
  labels,
  titleLabel = "Name",
  extraCategory,
  extraLabel,
  onSaved,
  setError,
}: {
  session: Session;
  category: string;
  fields: string[];
  labels: Record<string, string>;
  titleLabel?: string;
  extraCategory?: string;
  extraLabel?: string;
  onSaved: () => void;
  setError: (value: string) => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [extra, setExtra] = useState<Item[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [vals, setVals] = useState<Record<string, string>>({});
  const [csv, setCsv] = useState("");
  const [extraTitle, setExtraTitle] = useState("");

  const load = useCallback(async () => {
    const body = await api<{ items: Item[] }>(`/brain/items?category=${category}`, {}, session.token);
    setItems(body.items);
    if (extraCategory) {
      const more = await api<{ items: Item[] }>(`/brain/items?category=${extraCategory}`, {}, session.token);
      setExtra(more.items);
    }
  }, [session, category, extraCategory]);

  useEffect(() => { load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load")); }, [load, setError]);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    await api("/brain/items", { method: "POST", body: JSON.stringify({ category, title, body, extra: vals }) }, session.token);
    setTitle("");
    setBody("");
    setVals({});
    await load();
    onSaved();
  }

  return (
    <>
      {category === "products" ? (
        <form className="panel" style={{ padding: 16, margin: 0 }} onSubmit={(event) => {
          event.preventDefault();
          void api("/brain/products/import", { method: "POST", body: JSON.stringify({ csv }) }, session.token)
            .then(async () => { setCsv(""); await load(); onSaved(); })
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not import"));
        }}>
          <label htmlFor="csv">Import CSV</label>
          <textarea id="csv" rows={4} value={csv} onChange={(event) => setCsv(event.target.value)} placeholder={"name,sla,customer,price\nResidential turnkey,9–14 months,Homeowners,Quote on request"} />
          <button className="btn secondary" style={{ width: "auto" }}>Import rows</button>
        </form>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item) => (
          <div key={item.id} className="panel" style={{ padding: 16, margin: 0, display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{item.title}</div>
              {item.body ? <div className="muted" style={{ marginTop: 4 }}>{item.body}</div> : null}
              {item.extra ? (
                <div className="muted" style={{ marginTop: 8, fontSize: 11 }}>
                  {Object.entries(item.extra).filter(([, value]) => value).map(([key, value]) => `${labels[key] ?? key}: ${String(value)}`).join(" · ")}
                </div>
              ) : null}
            </div>
            <button type="button" className="btn ghost" style={{ width: "auto", marginTop: 0 }} onClick={() => void api(`/brain/items/${item.id}`, { method: "DELETE" }, session.token).then(() => { void load(); onSaved(); })}>Delete</button>
          </div>
        ))}
        {items.length === 0 ? <div className="panel muted">None yet.</div> : null}
      </div>
      <form className="panel" style={{ padding: 16, margin: 0 }} onSubmit={add}>
        <label htmlFor="ititle">{titleLabel}</label>
        <input id="ititle" value={title} onChange={(event) => setTitle(event.target.value)} required />
        <label htmlFor="ibody" style={{ marginTop: 12 }}>Notes</label>
        <textarea id="ibody" rows={3} value={body} onChange={(event) => setBody(event.target.value)} />
        {fields.map((field) => (
          <div key={field}>
            <label htmlFor={field} style={{ marginTop: 12 }}>{labels[field]}</label>
            <input id={field} value={vals[field] ?? ""} onChange={(event) => setVals((current) => ({ ...current, [field]: event.target.value }))} />
          </div>
        ))}
        <button className="btn" style={{ width: "auto" }}>Add</button>
      </form>
      {extraCategory && extraLabel ? (
        <form className="panel" style={{ padding: 16, margin: 0 }} onSubmit={(event) => {
          event.preventDefault();
          void api("/brain/items", { method: "POST", body: JSON.stringify({ category: extraCategory, title: extraTitle, body: "" }) }, session.token)
            .then(async () => { setExtraTitle(""); await load(); onSaved(); });
        }}>
          <label htmlFor="seg">{extraLabel}</label>
          <input id="seg" value={extraTitle} onChange={(event) => setExtraTitle(event.target.value)} required />
          <button className="btn secondary" style={{ width: "auto" }}>Add segment</button>
          <div className="chip-row" style={{ marginTop: 12 }}>
            {extra.map((item) => <span key={item.id} className="chip">{item.title}</span>)}
          </div>
        </form>
      ) : null}
    </>
  );
}

function Docs({ session, onSaved, setError }: { session: Session; onSaved: () => void; setError: (value: string) => void }) {
  const [docs, setDocs] = useState<Document[]>([]);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [tag, setTag] = useState("internal");
  const [fieldNote, setFieldNote] = useState("");
  const [fields, setFields] = useState<Item[]>([]);

  const load = useCallback(async () => {
    const knowledge = await api<{ documents: Document[] }>("/brain", {}, session.token);
    setDocs(knowledge.documents);
    const notes = await api<{ items: Item[] }>("/brain/items?category=fields", {}, session.token);
    setFields(notes.items);
  }, [session]);

  useEffect(() => { load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load")); }, [load, setError]);

  return (
    <>
      <div className="brain-drop">
        <div style={{ fontSize: 15, fontWeight: 700 }}>Paste SOP, checklist, or template text</div>
        <p className="muted" style={{ margin: "6px 0 0" }}>PDF upload as a file store is not in this build. Paste the text; it is chunked for search.</p>
      </div>
      <div className="chip-row">
        {["internal", "customer-facing", "signed"].map((item) => (
          <button key={item} type="button" className={`chip${tag === item ? " on" : ""}`} onClick={() => setTag(item)}>{item}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {docs.map((doc) => (
          <div key={doc.id} className="panel" style={{ padding: 16, margin: 0 }}>
            <div style={{ fontWeight: 700 }}>{doc.name}</div>
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{doc.tag} · v{doc.version}</div>
            <p className="muted" style={{ marginTop: 8 }}>{doc.body.slice(0, 160)}{doc.body.length > 160 ? "…" : ""}</p>
          </div>
        ))}
      </div>
      <form className="panel" style={{ padding: 16, margin: 0 }} onSubmit={(event) => {
        event.preventDefault();
        void api("/documents", { method: "POST", body: JSON.stringify({ name, body, tag }) }, session.token)
          .then(async () => { setName(""); setBody(""); await load(); onSaved(); })
          .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not save"));
      }}>
        <label htmlFor="dname">Document name</label>
        <input id="dname" value={name} onChange={(event) => setName(event.target.value)} required />
        <label htmlFor="dbody" style={{ marginTop: 12 }}>Text</label>
        <textarea id="dbody" rows={6} value={body} onChange={(event) => setBody(event.target.value)} required />
        <button className="btn" style={{ width: "auto" }}>Save document</button>
      </form>
      <form className="panel" style={{ padding: 16, margin: 0 }} onSubmit={(event) => {
        event.preventDefault();
        void api("/brain/items", { method: "POST", body: JSON.stringify({ category: "fields", title: "Taxonomy", body: fieldNote }) }, session.token)
          .then(async () => { setFieldNote(""); await load(); onSaved(); });
      }}>
        <label htmlFor="fields">Fields & taxonomies</label>
        <textarea id="fields" rows={3} value={fieldNote} onChange={(event) => setFieldNote(event.target.value)} placeholder="SKU groups, site types, job titles you want drafts to use" />
        <button className="btn secondary" style={{ width: "auto" }}>Save taxonomy note</button>
        {fields.map((item) => <p key={item.id} className="muted">{item.body}</p>)}
      </form>
    </>
  );
}

function Policies({ session, onSaved, setError }: { session: Session; onSaved: () => void; setError: (value: string) => void }) {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [minutes, setMinutes] = useState("");
  const [slas, setSlas] = useState<Item[]>([]);
  const [slaTitle, setSlaTitle] = useState("");
  const [retention, setRetention] = useState("90");
  const [comp, setComp] = useState("");

  const load = useCallback(async () => {
    const knowledge = await api<{ policies: Policy[]; retentionDays: number }>("/brain", {}, session.token);
    setPolicies(knowledge.policies);
    setRetention(String(knowledge.retentionDays));
    const sla = await api<{ items: Item[] }>("/brain/items?category=slas", {}, session.token);
    setSlas(sla.items);
  }, [session]);

  useEffect(() => { load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load")); }, [load, setError]);

  return (
    <>
      {policies.map((policy) => (
        <div key={policy.id} className="panel" style={{ padding: 16, margin: 0 }}>
          <div style={{ fontWeight: 700 }}>{policy.name}</div>
          <div className="muted" style={{ marginTop: 4 }}>{policy.body}</div>
          {policy.minutes != null ? <div className="if-num muted" style={{ marginTop: 6 }}>{policy.minutes} min</div> : null}
        </div>
      ))}
      <form className="panel" style={{ padding: 16, margin: 0 }} onSubmit={(event) => {
        event.preventDefault();
        void api("/policies", { method: "POST", body: JSON.stringify({ name, body, minutes: minutes ? Number(minutes) : null }) }, session.token)
          .then(async () => { setName(""); setBody(""); setMinutes(""); await load(); onSaved(); })
          .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not save"));
      }}>
        <label htmlFor="pname">Policy name</label>
        <input id="pname" value={name} onChange={(event) => setName(event.target.value)} placeholder="Site check-in by 9:30" required />
        <label htmlFor="pbody" style={{ marginTop: 12 }}>In plain language</label>
        <textarea id="pbody" rows={3} value={body} onChange={(event) => setBody(event.target.value)} required />
        <label htmlFor="mins" style={{ marginTop: 12 }}>Threshold minutes (optional)</label>
        <input id="mins" inputMode="numeric" value={minutes} onChange={(event) => setMinutes(event.target.value)} placeholder="45" />
        <button className="btn" style={{ width: "auto" }}>Save policy</button>
      </form>
      <form className="panel" style={{ padding: 16, margin: 0 }} onSubmit={(event) => {
        event.preventDefault();
        void api("/brain/items", { method: "POST", body: JSON.stringify({ category: "slas", title: slaTitle, body: "" }) }, session.token)
          .then(async () => { setSlaTitle(""); await load(); onSaved(); });
      }}>
        <label htmlFor="sla">Named SLA</label>
        <input id="sla" value={slaTitle} onChange={(event) => setSlaTitle(event.target.value)} placeholder="Quote in 24h" required />
        <button className="btn secondary" style={{ width: "auto" }}>Add SLA</button>
        <div className="chip-row" style={{ marginTop: 12 }}>{slas.map((item) => <span key={item.id} className="chip">{item.title}</span>)}</div>
      </form>
      <form className="panel" style={{ padding: 16, margin: 0 }} onSubmit={(event) => {
        event.preventDefault();
        void api("/retention", { method: "POST", body: JSON.stringify({ days: Number(retention) }) }, session.token)
          .then(() => onSaved())
          .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not save"));
      }}>
        <label htmlFor="days">Keep check-ins for this many days</label>
        <input id="days" value={retention} onChange={(event) => setRetention(event.target.value)} />
        <button className="btn secondary" style={{ width: "auto" }}>Save retention</button>
      </form>
      <form className="panel" style={{ padding: 16, margin: 0 }} onSubmit={(event) => {
        event.preventDefault();
        void api("/brain/items", { method: "POST", body: JSON.stringify({ category: "compliance", title: "Compliance note", body: comp }) }, session.token)
          .then(async () => { setComp(""); await load(); onSaved(); });
      }}>
        <label htmlFor="comp">Compliance note</label>
        <textarea id="comp" rows={3} value={comp} onChange={(event) => setComp(event.target.value)} />
        <button className="btn secondary" style={{ width: "auto" }}>Save note</button>
      </form>
    </>
  );
}

function Integrations({ session, onSaved, setError }: { session: Session; onSaved: () => void; setError: (value: string) => void }) {
  const [hooks, setHooks] = useState<Item[]>([]);
  const [partners, setPartners] = useState<Item[]>([]);
  const [history, setHistory] = useState("");
  const [url, setUrl] = useState("");
  const [partner, setPartner] = useState("");

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      api<{ items: Item[] }>("/brain/items?category=integrations", {}, session.token),
      api<{ items: Item[] }>("/brain/items?category=partners", {}, session.token),
    ]);
    setHooks(a.items);
    setPartners(b.items);
  }, [session]);

  useEffect(() => { load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load")); }, [load, setError]);

  const held = [
    ["Tally", "Accounts"],
    ["WhatsApp Business", "Messaging"],
    ["Google Sheets", "Tables"],
    ["CRM", "Customers"],
  ];

  return (
    <>
      <div className="brain-int-grid">
        {held.map(([name, kind]) => (
          <div key={name} className="panel" style={{ padding: 16, margin: 0 }}>
            <div style={{ fontWeight: 700 }}>{name}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{kind}</div>
            <div className="emp-held-box" style={{ marginTop: 12 }}>Off this product — no OAuth in this build.</div>
          </div>
        ))}
      </div>
      <form className="panel" style={{ padding: 16, margin: 0 }} onSubmit={(event) => {
        event.preventDefault();
        void api("/brain/items", { method: "POST", body: JSON.stringify({ category: "integrations", title: "Custom webhook", body: url, extra: { kind: "webhook" } }) }, session.token)
          .then(async () => { setUrl(""); await load(); onSaved(); });
      }}>
        <label htmlFor="hook">Custom webhook URL</label>
        <input id="hook" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" required />
        <button className="btn" style={{ width: "auto" }}>Save webhook</button>
        {hooks.map((item) => <div key={item.id} className="muted" style={{ marginTop: 8 }}>{item.body}</div>)}
      </form>
      <form className="panel" style={{ padding: 16, margin: 0 }} onSubmit={(event) => {
        event.preventDefault();
        void api("/brain/items", { method: "POST", body: JSON.stringify({ category: "partners", title: partner, body: "" }) }, session.token)
          .then(async () => { setPartner(""); await load(); onSaved(); });
      }}>
        <label htmlFor="partner">Vendor or partner</label>
        <input id="partner" value={partner} onChange={(event) => setPartner(event.target.value)} required />
        <button className="btn secondary" style={{ width: "auto" }}>Add partner</button>
        <div className="chip-row" style={{ marginTop: 12 }}>{partners.map((item) => <span key={item.id} className="chip">{item.title}</span>)}</div>
      </form>
      <form className="panel" style={{ padding: 16, margin: 0 }} onSubmit={(event) => {
        event.preventDefault();
        void api("/brain/items", { method: "POST", body: JSON.stringify({ category: "history", title: "Historic example", body: history }) }, session.token)
          .then(async () => { setHistory(""); onSaved(); });
      }}>
        <label htmlFor="hist">Historic example</label>
        <textarea id="hist" rows={3} value={history} onChange={(event) => setHistory(event.target.value)} placeholder="Paste a real past email or SOP excerpt" />
        <button className="btn secondary" style={{ width: "auto" }}>Save example</button>
      </form>
    </>
  );
}

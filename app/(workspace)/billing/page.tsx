"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api, API_URL, loadSession, type Session } from "@/lib/api";
import { NavIcon } from "@/lib/nav-icon";
import { ReportCrumbs } from "@/lib/reports";

type Tier = {
  id: string;
  name: string;
  multiplier: number;
  usdPerThousand: number;
  briefCredits: number;
  purchasable: boolean;
};
type Invoice = {
  id: string;
  number: string;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  buyerName: string;
  buyerGstin: string | null;
  buyerState: string;
  sellerName: string;
  sellerGstin: string | null;
  issuedAt: string;
};
type Ledger = { id: string; delta: number; reason: string; balanceAfter: number; at: string };
type Catalog = { action: string; desc: string; credits: number; held?: boolean };
type Billing = {
  plan: { name: string; monthlyCredits: number; briefCredits: number; rolloverMultiple: number; inrPerUsd: number };
  rateCard: Tier[];
  quote: { taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; totalPaise: number; sameState: boolean };
  balance: number;
  cap: number;
  profile: { legalName: string; gstin: string | null; stateCode: string; stateName: string };
  states: { code: string; name: string }[];
  pendingPayment: { id: string; mode: string } | null;
  paymentMode: "stub" | "razorpay";
  catalog: Catalog[];
  ledger: Ledger[];
  subscription: { status: string; periodEnd: string | null } | null;
  seller: { name: string; gstin: string | null; stateCode: string };
  invoices: Invoice[];
};

function rupees(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function quoteFor(stateCode: string, sellerState: string, usd: number, inr: number) {
  const taxablePaise = usd * inr * 100;
  const sameState = stateCode === sellerState;
  const cgstPaise = sameState ? Math.round((taxablePaise * 9) / 100) : 0;
  const sgstPaise = sameState ? Math.round((taxablePaise * 9) / 100) : 0;
  const igstPaise = sameState ? 0 : Math.round((taxablePaise * 18) / 100);
  return { taxablePaise, cgstPaise, sgstPaise, igstPaise, totalPaise: taxablePaise + cgstPaise + sgstPaise + igstPaise, sameState };
}

const TIER_COPY: Record<string, { tagline: string; uses: string[] }> = {
  basic: { tagline: "Fast, cheap, reliable for routine ops.", uses: ["Weekly brief", "Daily attendance summaries", "Simple task suggestions"] },
  premium: { tagline: "Deeper reasoning. Off this product.", uses: ["Cross-site RCA", "Roster reshuffle", "Long briefings"] },
  ultra: { tagline: "Highest spend. Off this product.", uses: ["Quarterly plans", "Multi-week forecasts", "Custom routing"] },
};

export default function BillingPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [legalName, setLegalName] = useState("");
  const [gstin, setGstin] = useState("");
  const [stateCode, setStateCode] = useState("29");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh(current: Session) {
    const result = await api<Billing>("/billing", {}, current.token);
    setBilling(result);
    setLegalName(result.profile.legalName || current.workspace.name);
    setGstin(result.profile.gstin ?? "");
    setStateCode(result.profile.stateCode);
  }

  useEffect(() => {
    const current = loadSession();
    if (!current) return;
    setSession(current);
    refresh(current).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load billing"));
  }, []);

  const preview = useMemo(() => {
    if (!billing) return null;
    return quoteFor(stateCode, billing.seller.stateCode ?? "29", billing.rateCard[0]?.usdPerThousand ?? 8, billing.plan.inrPerUsd);
  }, [billing, stateCode]);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      await api("/billing/profile", { method: "POST", body: JSON.stringify({ legalName, gstin, stateCode }) }, session.token);
      await refresh(session);
      setNotice("Billing details saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    if (!session) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api("/billing/profile", { method: "POST", body: JSON.stringify({ legalName, gstin, stateCode }) }, session.token);
      const started = await api<{ mode: string; checkoutUrl: string | null; paymentId: string }>("/billing/subscribe", { method: "POST", body: "{}" }, session.token);
      if (started.mode === "razorpay" && started.checkoutUrl) {
        window.location.href = started.checkoutUrl;
        return;
      }
      await api("/billing/confirm", { method: "POST", body: JSON.stringify({ paymentId: started.paymentId }) }, session.token);
      await refresh(session);
      setNotice("UPI AutoPay captured in local mode. The GST invoice is below, and the credit pool is filled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not pay");
    } finally {
      setBusy(false);
    }
  }

  async function downloadInvoice(id: string, number: string) {
    const current = loadSession();
    if (!current) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/billing/invoices/${id}/pdf`, { headers: { authorization: `Bearer ${current.token}` } });
      if (!response.ok) throw new Error("Could not make the invoice PDF");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${number}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download");
    } finally {
      setBusy(false);
    }
  }

  const width = billing && billing.cap > 0 ? Math.min(100, Math.round((billing.balance / billing.cap) * 100)) : 0;
  const paid = billing?.subscription?.status === "active";

  return (
    <div className="bill-page">
      <div className="rpt-head">
        <div>
          <ReportCrumbs items={["Finance", "Billing"]} />
          <h1 className="page-title" style={{ margin: 0 }}>Billing</h1>
        </div>
        <div className="rpt-actions">
          <Link className="btn secondary" href="/pricing">Rate card</Link>
          <button className="btn" type="button" onClick={pay} disabled={busy}>{paid ? "Renew pool" : "Pay with UPI AutoPay"}</button>
        </div>
      </div>
      <p className="sub" style={{ marginTop: 0 }}>
        Credits, not seats. One Basic plan. A weekly brief costs {billing?.plan.briefCredits ?? 12} credits.
        Unused credits roll over up to {billing?.plan.rolloverMultiple ?? 2}× the monthly pool, then the brief stops.
      </p>
      {error ? <div className="error">{error}</div> : null}
      {notice ? <div className="devcode">{notice}</div> : null}

      <div className="bill-hero">
        <div>
          <div className="muted">Credit pool</div>
          <div className="price">{billing ? billing.balance.toLocaleString("en-IN") : "…"}</div>
          <div className="muted" style={{ marginBottom: 10 }}>
            remaining · monthly {billing ? billing.plan.monthlyCredits.toLocaleString("en-IN") : "1,000"} · cap {billing ? billing.cap.toLocaleString("en-IN") : "2,000"}
          </div>
          <div className="meter"><span style={{ width: `${width}%` }} /></div>
          {billing?.subscription?.periodEnd ? (
            <div className="muted" style={{ marginTop: 10 }}>Paid through {new Date(billing.subscription.periodEnd).toLocaleDateString("en-IN")}</div>
          ) : <div className="muted" style={{ marginTop: 10 }}>No active month yet.</div>}
        </div>
        <div className="bill-notes">
          <div>
            <div className="bill-k">Rollover</div>
            <div>Unused credits roll over up to 2× your monthly pool.</div>
          </div>
          <div>
            <div className="bill-k">Cap</div>
            <div>This product stops the brief at the cap. 1.5× overage billing stays off.</div>
          </div>
          <div>
            <div className="bill-k">Routing</div>
            <div>Only Basic is sold. Premium and Ultra stay on the rate card as held.</div>
          </div>
        </div>
      </div>

      <div className="bill-tiers">
        {(billing?.rateCard ?? []).map((tier) => {
          const copy = TIER_COPY[tier.id] ?? { tagline: "", uses: [] };
          return (
            <div key={tier.id} className={`bill-tier${tier.purchasable ? " on" : " off"}`}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{tier.name}</div>
                <span className="pill">{tier.multiplier}×</span>
              </div>
              <div className="muted" style={{ margin: "6px 0 14px" }}>{copy.tagline}</div>
              <div className="price" style={{ fontSize: 28 }}>${tier.usdPerThousand}</div>
              <div className="muted">per 1,000 credits · billed monthly</div>
              <div className="muted" style={{ marginTop: 8 }}>Weekly brief uses {tier.briefCredits} credits</div>
              <ul className="bill-uses">
                {copy.uses.map((use) => <li key={use}>{use}</li>)}
              </ul>
              {tier.purchasable ? <span className="pill">This plan</span> : <span className="rpt-badge off" style={{ position: "static" }}>OFF THIS PRODUCT</span>}
            </div>
          );
        })}
      </div>

      <div className="panel" style={{ padding: 0, overflow: "hidden", marginBottom: 20 }}>
        <div className="bill-th">
          <div>Action</div><div>Base</div><div>× Basic</div><div>× Premium</div><div>× Ultra</div>
        </div>
        {(billing?.catalog ?? []).map((row) => (
          <div key={row.action} className="bill-row">
            <div>
              <div style={{ fontWeight: 600 }}>{row.action}</div>
              <div className="muted">{row.desc}{row.held ? " · held" : ""}</div>
            </div>
            <div className="if-num">{row.credits}</div>
            <div className="if-num muted">{row.credits}</div>
            <div className="if-num" style={{ color: "var(--if-green-deep)", fontWeight: 600 }}>{row.credits * 3}</div>
            <div className="if-num" style={{ color: "var(--if-coral)", fontWeight: 600 }}>{row.credits * 8}</div>
          </div>
        ))}
      </div>

      <div className="bill-split">
        <form onSubmit={saveProfile} className="panel">
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Place of supply</div>
          <div className="muted" style={{ marginBottom: 14 }}>Checksum is checked here. The GST portal is not called.</div>
          <div className="grid">
            <div className="span-2">
              <label htmlFor="legal">Legal name on the invoice</label>
              <input id="legal" value={legalName} onChange={(event) => setLegalName(event.target.value)} required />
            </div>
            <div>
              <label htmlFor="gstin">GSTIN</label>
              <input id="gstin" value={gstin} onChange={(event) => setGstin(event.target.value.toUpperCase())} placeholder="Optional" maxLength={15} autoComplete="off" />
            </div>
            <div>
              <label htmlFor="state">State</label>
              <select id="state" value={stateCode} onChange={(event) => setStateCode(event.target.value)}>
                {(billing?.states ?? []).map((state) => (
                  <option key={state.code} value={state.code}>{state.name}</option>
                ))}
              </select>
            </div>
          </div>
          {preview ? (
            <div className="bill-quote">
              <div><span>Taxable</span><b>{rupees(preview.taxablePaise)}</b></div>
              {preview.igstPaise
                ? <div><span>IGST 18%</span><b>{rupees(preview.igstPaise)}</b></div>
                : <><div><span>CGST 9%</span><b>{rupees(preview.cgstPaise)}</b></div><div><span>SGST 9%</span><b>{rupees(preview.sgstPaise)}</b></div></>}
              <div className="total"><span>Total due</span><b>{rupees(preview.totalPaise)}</b></div>
            </div>
          ) : null}
          <div className="actions" style={{ marginTop: 8 }}>
            <button className="btn secondary" type="submit" disabled={busy}>Save details</button>
            <button className="btn" type="button" onClick={pay} disabled={busy} style={{ width: "auto" }}>Pay with UPI AutoPay</button>
          </div>
          <div className="muted" style={{ marginTop: 8 }}>
            {billing?.paymentMode === "razorpay"
              ? "Razorpay UPI AutoPay is connected."
              : "Local UPI is stubbed until Razorpay keys are set. Confirming here captures the payment and writes the invoice."}
          </div>
        </form>

        <div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Invoices</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(billing?.invoices ?? []).map((invoice) => (
              <div key={invoice.id} className="panel" style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{invoice.number}</div>
                    <div className="muted">{new Date(invoice.issuedAt).toLocaleDateString("en-IN")} · {invoice.buyerName}</div>
                    <div className="muted">{invoice.buyerGstin || "No GSTIN"} · {invoice.buyerState}</div>
                    <div className="muted" style={{ marginTop: 6 }}>
                      {invoice.igstPaise ? `IGST ${rupees(invoice.igstPaise)}` : `CGST ${rupees(invoice.cgstPaise)} · SGST ${rupees(invoice.sgstPaise)}`}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="if-num" style={{ fontWeight: 700 }}>{rupees(invoice.totalPaise)}</div>
                    <button type="button" className="rpt-icon-btn" style={{ marginTop: 8, marginLeft: "auto" }} onClick={() => void downloadInvoice(invoice.id, invoice.number)} aria-label="Download PDF">
                      <NavIcon name="download" size={14} color="var(--if-ink-2)" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {billing && billing.invoices.length === 0 ? <div className="panel muted">No invoice yet.</div> : null}
            {billing ? <div className="muted">Supplier {billing.seller.name}{billing.seller.gstin ? ` · ${billing.seller.gstin}` : " · GSTIN not configured"}.</div> : null}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, margin: "8px 0 10px" }}>Credit ledger</div>
      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <div className="rpt-th" style={{ gridTemplateColumns: "1.4fr 100px 120px 140px" }}>
          <div>Reason</div><div>Delta</div><div>Balance</div><div>When</div>
        </div>
        {(billing?.ledger ?? []).map((row) => (
          <div key={row.id} className="rpt-row" style={{ gridTemplateColumns: "1.4fr 100px 120px 140px" }}>
            <div>{row.reason}</div>
            <div className="if-num" style={{ color: row.delta < 0 ? "var(--if-coral)" : "var(--if-green-deep)" }}>{row.delta > 0 ? `+${row.delta}` : row.delta}</div>
            <div className="if-num">{row.balanceAfter.toLocaleString("en-IN")}</div>
            <div className="muted">{new Date(row.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
          </div>
        ))}
        {billing && billing.ledger.length === 0 ? <div style={{ padding: 20 }} className="muted">No credit movement yet.</div> : null}
      </div>
    </div>
  );
}

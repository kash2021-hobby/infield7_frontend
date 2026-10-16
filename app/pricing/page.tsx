"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { IFLogo } from "@/lib/if-logo";
import { NavIcon } from "@/lib/nav-icon";

const INR = 84;
const ACTIONS = [
  { action: "AI recommendation (small)", desc: "who to assign this task to", credits: 1 },
  { action: "AI recommendation (deep)", desc: "reshuffle this week's roster", credits: 8 },
  { action: "Generated report (1 page)", desc: "weekly brief", credits: 12 },
  { action: "Generated report (10+ pages)", desc: "quarterly plan · held", credits: 60 },
  { action: "Auto-assignment", desc: "held", credits: 2 },
  { action: "Alert triage", desc: "held", credits: 1 },
  { action: "Deep analysis", desc: "held", credits: 40 },
];

function rupees(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export default function PricingPage() {
  const [seats, setSeats] = useState(50);
  const [actions, setActions] = useState(400);
  const [faq, setFaq] = useState(0);
  const credits = actions * 4;
  const monthlyUsd = (credits / 1000) * 8;
  const monthlyInr = monthlyUsd * INR;
  const estimate = useMemo(() => ({ credits, monthlyInr }), [credits, monthlyInr]);

  return (
    <div style={{ background: "var(--if-cream)", minHeight: "100vh", color: "var(--if-ink)" }}>
      <div className="price-nav">
        <div className="price-wrap" style={{ display: "flex", alignItems: "center", gap: 28, padding: "14px 40px" }}>
          <IFLogo size={26} />
          <a href="#models" style={{ fontSize: 13, color: "var(--if-ink-2)", textDecoration: "none" }}>AI models</a>
          <a href="#credits" style={{ fontSize: 13, color: "var(--if-ink-2)", textDecoration: "none" }}>Credits</a>
          <a href="#calculator" style={{ fontSize: 13, color: "var(--if-ink-2)", textDecoration: "none" }}>Calculator</a>
          <a href="#faq" style={{ fontSize: 13, color: "var(--if-ink-2)", textDecoration: "none" }}>FAQ</a>
          <div style={{ flex: 1 }} />
          <Link className="btn secondary" href="/login" style={{ margin: 0, width: "auto" }}>Sign in</Link>
          <Link className="btn" href="/login" style={{ margin: 0, width: "auto" }}>Start free trial</Link>
        </div>
      </div>

      <div className="price-wrap price-hero" style={{ padding: "72px 40px 40px" }}>
        <div className="chip" style={{ display: "inline-flex" }}>Credits, not seats</div>
        <h1>One Basic plan. Pay for the AI work you actually run.</h1>
        <p className="sub" style={{ fontSize: 18, maxWidth: 640 }}>
          InField 7 meters the weekly brief and other AI actions from a monthly credit pool.
          Unused credits roll over up to 2×. Premium, Ultra, air-gap, and Singapore stay off this product.
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <Link className="btn" href="/login">Start with OTP</Link>
          <a className="btn secondary" href="/pricing/calculator">Open calculator</a>
        </div>
      </div>

      <div className="price-wrap" style={{ padding: "0 40px 48px" }}>
        <div className="price-grid3">
          {[
            { n: "01", t: "Where it runs", b: "Cloud in India. Self-hosted and air-gap stay off this product." },
            { n: "02", t: "How smart", b: "Basic is sold at $8 per 1,000 credits. Premium and Ultra are shown, not sold." },
            { n: "03", t: "Pay for use", b: "A weekly brief costs 12 credits. The brief stops at the 2× cap." },
          ].map((row) => (
            <div key={row.n} className="panel">
              <div className="bill-k">{row.n}</div>
              <div style={{ fontSize: 20, fontWeight: 700, margin: "8px 0" }}>{row.t}</div>
              <div className="muted">{row.b}</div>
            </div>
          ))}
        </div>
      </div>

      <div id="models" className="price-wrap" style={{ padding: "24px 40px 48px" }}>
        <div className="bill-k">AI model tiers</div>
        <h2 className="page-title" style={{ fontSize: 36 }}>Three engines. Only Basic is sold here.</h2>
        <div className="bill-tiers">
          {[
            { name: "Basic", x: "1×", price: "$8", on: true, line: "Weekly brief and routine ops." },
            { name: "Premium", x: "3×", price: "$22", on: false, line: "Deeper reasoning. Off this product." },
            { name: "Ultra", x: "8×", price: "$60", on: false, line: "Highest spend. Off this product." },
          ].map((tier) => (
            <div key={tier.name} className={`bill-tier${tier.on ? " on" : " off"}`}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{tier.name}</div>
                <span className="pill">{tier.x}</span>
              </div>
              <div className="price" style={{ marginTop: 16 }}>{tier.price}</div>
              <div className="muted">per 1,000 credits · billed monthly</div>
              <p className="muted" style={{ marginTop: 12 }}>{tier.line}</p>
              {tier.on ? <span className="pill">This plan</span> : <span className="rpt-badge off" style={{ position: "static" }}>OFF THIS PRODUCT</span>}
            </div>
          ))}
        </div>
      </div>

      <div id="credits" className="price-wrap" style={{ padding: "0 40px 48px" }}>
        <div className="bill-k">Credits, explained</div>
        <h2 className="page-title" style={{ fontSize: 32 }}>What counts as a credit?</h2>
        <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
          <div className="bill-th">
            <div>Action</div><div>Base</div><div>× Basic</div><div>× Premium</div><div>× Ultra</div>
          </div>
          {ACTIONS.map((row) => (
            <div key={row.action} className="bill-row">
              <div>
                <div style={{ fontWeight: 600 }}>{row.action}</div>
                <div className="muted">{row.desc}</div>
              </div>
              <div className="if-num">{row.credits}</div>
              <div className="if-num muted">{row.credits}</div>
              <div className="if-num" style={{ color: "var(--if-green-deep)", fontWeight: 600 }}>{row.credits * 3}</div>
              <div className="if-num" style={{ color: "var(--if-coral)", fontWeight: 600 }}>{row.credits * 8}</div>
            </div>
          ))}
        </div>
      </div>

      <div id="calculator" className="price-wrap" style={{ padding: "0 40px 64px" }}>
        <div className="bill-k">Interactive estimate</div>
        <h2 className="page-title" style={{ fontSize: 32 }}>Configure a Basic pool. See a rupee number.</h2>
        <p className="sub">Estimate only — not a quote. Converted at ₹{INR} per dollar. Self-hosted and offline AI stay off.</p>
        <div className="bill-split">
          <div className="panel">
            <label htmlFor="seats">How many people? {seats}</label>
            <input id="seats" type="range" min={10} max={500} step={10} value={seats} onChange={(event) => setSeats(Number(event.target.value))} />
            <label htmlFor="acts" style={{ marginTop: 16 }}>Monthly AI actions {actions.toLocaleString("en-IN")}</label>
            <input id="acts" type="range" min={50} max={5000} step={50} value={actions} onChange={(event) => setActions(Number(event.target.value))} />
            <p className="muted">Team size is not billed. It only helps you picture load. Actions × 4 credits, billed on Basic.</p>
          </div>
          <div className="panel" style={{ background: "var(--if-ink)", color: "var(--if-paper)" }}>
            <div className="bill-k" style={{ color: "var(--if-ink-4)" }}>Suggested monthly pool</div>
            <div className="price" style={{ color: "var(--if-paper)" }}>{estimate.credits.toLocaleString("en-IN")}</div>
            <div style={{ opacity: 0.7, fontSize: 13, marginBottom: 16 }}>credits · Basic 1×</div>
            <div className="price" style={{ fontSize: 28, color: "var(--if-green)" }}>{rupees(estimate.monthlyInr)}</div>
            <div style={{ opacity: 0.7, fontSize: 13 }}>/ month before GST</div>
            <Link className="btn" href="/login" style={{ marginTop: 20 }}>Start free trial</Link>
          </div>
        </div>
      </div>

      <div id="faq" className="price-wrap" style={{ padding: "0 40px 80px" }}>
        <div className="bill-k">FAQ</div>
        <h2 className="page-title" style={{ fontSize: 32 }}>Straight answers.</h2>
        {[
          ["Do we pay per seat?", "No. Invite as many people as you need. We meter AI credits."],
          ["What if we hit the cap?", "The weekly brief waits until the pool renews. 1.5× overage billing stays off this product."],
          ["Do unused credits roll over?", "Yes, up to 2× the monthly pool."],
          ["GST?", "Place of supply is your GSTIN state. Same-state CGST+SGST 9% each, otherwise IGST 18%. The GST portal is not called."],
          ["UPI?", "Razorpay AutoPay when keys are set. Until then, local mode captures a stub payment and writes the invoice."],
        ].map(([q, a], index) => (
          <button
            key={q}
            type="button"
            className="price-faq"
            style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderTop: "1px solid var(--if-cream-2)", padding: "18px 0", cursor: "pointer" }}
            onClick={() => setFaq(index)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>{q} <NavIcon name="chevronDown" size={16} color="var(--if-ink-3)" /></div>
            {faq === index ? <p className="muted" style={{ margin: "8px 0 0" }}>{a}</p> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

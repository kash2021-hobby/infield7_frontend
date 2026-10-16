"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useMemo } from "react";
import { IFLogo } from "@/lib/if-logo";

const INR = 84;
const TIERS = [
  { id: "basic", name: "Basic", x: 1, usd: 8 },
  { id: "premium", name: "Premium", x: 3, usd: 22 },
  { id: "ultra", name: "Ultra", x: 8, usd: 60 },
] as const;

function rupees(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function CalculatorInner() {
  const params = useSearchParams();
  const router = useRouter();
  const seats = Number(params.get("seats") ?? 50);
  const actions = Number(params.get("actions") ?? 400);
  const addons = Number(params.get("addons") ?? 0);
  const tier = TIERS.find((row) => row.id === params.get("tier")) ?? TIERS[0];

  function set(next: Record<string, string | number>) {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) query.set(key, String(value));
    router.replace(`/pricing/calculator?${query.toString()}`);
  }

  const credits = actions * 4 + addons * 50;
  const monthlyInr = ((credits / 1000) * tier.usd) * INR;
  const estimate = useMemo(() => ({ credits, monthlyInr }), [credits, monthlyInr]);
  const share = typeof window === "undefined" ? "" : window.location.href;

  return (
    <div style={{ background: "var(--if-cream)", minHeight: "100vh", color: "var(--if-ink)", padding: 40 }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <IFLogo size={26} />
        <p className="muted" style={{ marginTop: 12 }}><Link href="/pricing">Pricing</Link> · calculator</p>
        <h1 className="page-title">Estimate a monthly pool</h1>
        <p className="sub">Seats are not billed. Credits are. Copy the link to keep this estimate.</p>
        <div className="panel" style={{ marginTop: 24 }}>
          <label>People {seats}</label>
          <input type="range" min={10} max={500} step={10} value={seats} onChange={(e) => set({ seats: e.target.value })} />
          <label style={{ marginTop: 16 }}>AI actions {actions.toLocaleString("en-IN")}</label>
          <input type="range" min={50} max={5000} step={50} value={actions} onChange={(e) => set({ actions: e.target.value })} />
          <label style={{ marginTop: 16 }}>Add-ons {addons}</label>
          <input type="range" min={0} max={20} step={1} value={addons} onChange={(e) => set({ addons: e.target.value })} />
          <label style={{ marginTop: 16 }}>Model tier</label>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {TIERS.map((row) => (
              <button key={row.id} type="button" className={row.id === tier.id ? "btn" : "btn secondary"} style={{ width: "auto", margin: 0 }} onClick={() => set({ tier: row.id })}>
                {row.name}
              </button>
            ))}
          </div>
          <p className="muted">Premium and Ultra are shown for comparison. Only Basic is sold.</p>
        </div>
        <div className="panel" style={{ marginTop: 16, background: "var(--if-ink)", color: "var(--if-paper)" }}>
          <div className="price" style={{ color: "var(--if-paper)" }}>{estimate.credits.toLocaleString("en-IN")} credits</div>
          <div className="price" style={{ fontSize: 28, color: "var(--if-green)" }}>{rupees(estimate.monthlyInr)}</div>
          <p style={{ opacity: 0.7 }}>{tier.name} · {tier.x}× · before GST</p>
          <button type="button" className="btn secondary" style={{ width: "auto" }} onClick={() => void navigator.clipboard.writeText(share)}>Copy link to estimate</button>
          <Link className="btn" href="/login" style={{ marginLeft: 8 }}>Start free trial</Link>
        </div>
      </div>
    </div>
  );
}

export default function PricingCalculatorPage() {
  return (
    <Suspense fallback={<div className="muted" style={{ padding: 40 }}>Loading calculator…</div>}>
      <CalculatorInner />
    </Suspense>
  );
}

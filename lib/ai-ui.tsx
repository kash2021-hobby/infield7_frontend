"use client";

export function AIMark({ size = 22, color = "var(--if-ink)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" style={{ display: "block" }} aria-hidden>
      <rect x="2" y="2" width="18" height="18" rx="5" fill="none" stroke={color} strokeWidth="1.6" opacity="0.35" />
      <rect x="6" y="6" width="10" height="10" rx="3" fill="none" stroke={color} strokeWidth="1.6" opacity="0.7" />
      <rect x="9" y="9" width="4" height="4" rx="1" fill={color} />
    </svg>
  );
}

export function Spark({ data, width = 240, height = 60, color = "var(--if-coral)" }: { data: number[]; width?: number; height?: number; color?: string }) {
  if (data.length < 2) return <div className="muted">Not enough days yet for a trend.</div>;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => [i * step, height - ((v - min) / range) * (height - 8) - 4]);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${d} L ${width} ${height} L 0 ${height} Z`;
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <path d={area} fill={color} opacity="0.08" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AICrumbs({ items }: { items: string[] }) {
  return <div className="rpt-crumbs">{items.join(" · ")}</div>;
}

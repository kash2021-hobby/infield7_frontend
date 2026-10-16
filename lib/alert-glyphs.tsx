export type AlertGlyphName =
  | "pin"
  | "clock"
  | "check"
  | "target"
  | "settings"
  | "alert"
  | "bell"
  | "phone"
  | "users"
  | "message"
  | "arrow"
  | "briefcase"
  | "plus"
  | "close"
  | "play"
  | "truck"
  | "chart";

export function Glyph({
  name,
  size = 14,
  color = "currentColor",
}: {
  name: AlertGlyphName;
  size?: number;
  color?: string;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 2,
    "aria-hidden": true as const,
  };
  if (name === "pin") return <svg {...common}><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2" /></svg>;
  if (name === "clock") return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  if (name === "check") return <svg {...common}><path d="M5 12l5 5L20 7" /></svg>;
  if (name === "target") return <svg {...common}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></svg>;
  if (name === "settings") return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M12 3v2M12 19v2M5 12H3M21 12h-2M6.2 6.2l1.4 1.4M16.4 16.4l1.4 1.4M17.8 6.2l-1.4 1.4M7.6 16.4 6.2 17.8" /></svg>;
  if (name === "alert") return <svg {...common}><path d="M12 3 3 20h18L12 3z" /><path d="M12 9v5M12 17h.01" /></svg>;
  if (name === "bell") return <svg {...common}><path d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 7H3s3 0 3-7" /><path d="M10 20h4" /></svg>;
  if (name === "phone") return <svg {...common}><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 18h2" /></svg>;
  if (name === "users") return <svg {...common}><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 19c0-3 2.5-5 6-5s6 2 6 5M15 19c.3-2 1.5-3.5 4-3.5 1 0 2 .3 3 1" /></svg>;
  if (name === "message") return <svg {...common}><path d="M4 5h16v11H8l-4 3V5z" /></svg>;
  if (name === "arrow") return <svg {...common}><path d="M7 17V7h10M7 7l10 10" /></svg>;
  if (name === "briefcase") return <svg {...common}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5h8v2" /></svg>;
  if (name === "plus") return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
  if (name === "play") return <svg {...common}><path d="M8 5v14l11-7z" /></svg>;
  if (name === "truck") return <svg {...common}><path d="M3 7h11v10H3zM14 11h4l3 3v3h-7" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></svg>;
  if (name === "chart") return <svg {...common}><path d="M4 19V5M4 19h16M8 15v-4M12 15V8M16 15v-7" /></svg>;
  return <svg {...common}><path d="M6 6l12 12M18 6 6 18" /></svg>;
}

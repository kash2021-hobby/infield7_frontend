export type NavIconName =
  | "home"
  | "map"
  | "users"
  | "clock"
  | "calendar"
  | "check"
  | "target"
  | "chart"
  | "bell"
  | "arrow_up_right"
  | "pin"
  | "brain"
  | "file_text"
  | "wallet"
  | "settings"
  | "sparkles"
  | "phone"
  | "briefcase"
  | "chevronDown"
  | "plus"
  | "filter"
  | "search"
  | "message"
  | "camera"
  | "download"
  | "chevronRight";

export function NavIcon({
  name,
  size = 16,
  color = "currentColor",
  strokeWidth = 1.8,
}: {
  name: NavIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const p = {
    fill: "none" as const,
    stroke: color,
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block", flexShrink: 0 }} aria-hidden>
      {name === "map" ? <><path {...p} d="M9 3L3 6v15l6-3 6 3 6-3V3l-6 3-6-3z" /><path {...p} d="M9 3v15M15 6v15" /></> : null}
      {name === "pin" ? <><path {...p} d="M12 21s-7-7.5-7-12a7 7 0 0 1 14 0c0 4.5-7 12-7 12z" /><circle {...p} cx="12" cy="9" r="2.5" /></> : null}
      {name === "users" ? <><circle {...p} cx="9" cy="8" r="4" /><path {...p} d="M2 21c0-4 3-7 7-7s7 3 7 7" /><path {...p} d="M16 3.5a4 4 0 0 1 0 8M22 21c0-3-1.5-5.5-4-6.5" /></> : null}
      {name === "clock" ? <><circle {...p} cx="12" cy="12" r="9" /><path {...p} d="M12 7v5l3 2" /></> : null}
      {name === "chart" ? <><path {...p} d="M3 3v18h18" /><path {...p} d="M7 15l4-4 3 3 5-6" /></> : null}
      {name === "wallet" ? <><path {...p} d="M3 7a2 2 0 0 1 2-2h13v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" /><path {...p} d="M3 7h15v4h-4a2 2 0 0 0 0 4h4" /></> : null}
      {name === "bell" ? <><path {...p} d="M6 8a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" /><path {...p} d="M10 20a2 2 0 0 0 4 0" /></> : null}
      {name === "check" ? <path {...p} d="M5 12l4 4L19 6" /> : null}
      {name === "home" ? <path {...p} d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-9z" /> : null}
      {name === "calendar" ? <><rect {...p} x="3" y="5" width="18" height="16" rx="2" /><path {...p} d="M3 10h18M8 3v4M16 3v4" /></> : null}
      {name === "settings" ? <><circle {...p} cx="12" cy="12" r="3" /><path {...p} d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></> : null}
      {name === "briefcase" ? <><rect {...p} x="3" y="7" width="18" height="13" rx="2" /><path {...p} d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></> : null}
      {name === "target" ? <><circle {...p} cx="12" cy="12" r="9" /><circle {...p} cx="12" cy="12" r="5" /><circle {...p} cx="12" cy="12" r="1" fill={color} /></> : null}
      {name === "arrow_up_right" ? <><path {...p} d="M7 17L17 7M9 7h8v8" /></> : null}
      {name === "brain" ? <><path {...p} d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 1 4 3 3 0 0 0 4 3 3 3 0 0 0 1 0V4a3 3 0 0 0-1-.5A3 3 0 0 0 9 4z" /><path {...p} d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-1 4 3 3 0 0 1-4 3 3 3 0 0 1-1 0V4a3 3 0 0 1 1-.5A3 3 0 0 1 15 4z" /><path {...p} d="M12 8v2M12 13v2" /></> : null}
      {name === "file_text" ? <><path {...p} d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" /><path {...p} d="M14 3v5h5M8 13h8M8 17h5" /></> : null}
      {name === "sparkles" ? <><path {...p} d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" /><path {...p} d="M19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15z" /></> : null}
      {name === "phone" ? <path {...p} d="M5 4h4l2 5-3 2a12 12 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 6a2 2 0 0 1 2-2z" /> : null}
      {name === "chevronDown" ? <path {...p} d="M6 9l6 6 6-6" /> : null}
      {name === "plus" ? <path {...p} d="M12 5v14M5 12h14" /> : null}
      {name === "filter" ? <path {...p} d="M4 5h16l-6 8v6l-4-2v-4z" /> : null}
      {name === "search" ? <><circle {...p} cx="11" cy="11" r="7" /><path {...p} d="M20 20l-3.5-3.5" /></> : null}
      {name === "message" ? <><path {...p} d="M4 5h16v12H8l-4 4V5z" /></> : null}
      {name === "camera" ? <><path {...p} d="M4 8h3l2-2h6l2 2h3v12H4z" /><circle {...p} cx="12" cy="14" r="3.5" /></> : null}
      {name === "download" ? <><path {...p} d="M12 4v12M8 12l4 4 4-4" /><path {...p} d="M4 20h16" /></> : null}
      {name === "chevronRight" ? <path {...p} d="M9 6l6 6-6 6" /> : null}
    </svg>
  );
}

export function IFLogo({ size = 26, showWord = true }: { size?: number; showWord?: boolean }) {
  return (
    <div className="if-logo" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
        <circle cx="20" cy="20" r="17" fill="none" stroke="var(--if-green)" strokeWidth="2.5" strokeDasharray="3 3" opacity="0.5" />
        <circle cx="20" cy="20" r="11" fill="var(--if-green)" opacity="0.15" />
        <circle cx="20" cy="16" r="4" fill="var(--if-green)" />
        <path d="M11 30 C11 24 15 22 20 22 C25 22 29 24 29 30 Z" fill="var(--if-green)" />
      </svg>
      {showWord ? (
        <span style={{ fontWeight: 700, fontSize: size * 0.65, letterSpacing: "-0.02em", color: "var(--if-ink)" }}>
          InField<span style={{ color: "var(--if-green)", marginLeft: 2 }}>7</span>
        </span>
      ) : null}
    </div>
  );
}

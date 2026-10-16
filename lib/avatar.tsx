export function hueFor(name: string) {
  let hue = 0;
  for (const ch of name) hue = (hue * 31 + ch.charCodeAt(0)) % 360;
  return hue;
}

export function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const hue = hueFor(name);
  return (
    <span
      className="if-avatar"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        background: `oklch(72% 0.12 ${hue})`,
      }}
      aria-hidden
    >
      {initialsFor(name)}
    </span>
  );
}

type AvatarProps = {
  /** 1–2 letter monogram. */
  initials: string;
  /** Full name for the tooltip / a11y. */
  name?: string;
  /** Explicit gradient; if omitted, derived deterministically from the seed. */
  gradient?: string;
  /** Dark text instead of white (for light gradients). */
  ink?: boolean;
  /** pixel diameter */
  size?: number;
  /** ring colour painted as a border (e.g. to lift off a photo) */
  ring?: string;
  className?: string;
};

/** Deterministic, mock-data-free gradient from a seed string. */
function gradientFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  const hue2 = (hue + 40) % 360;
  return `linear-gradient(135deg, hsl(${hue} 58% 55%), hsl(${hue2} 62% 42%))`;
}

export function Avatar({
  initials,
  name,
  gradient,
  ink = false,
  size = 32,
  ring,
  className = "",
}: AvatarProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${className}`}
      style={{
        width: size,
        height: size,
        background: gradient ?? gradientFor(name ?? initials),
        color: ink ? "#1c1b18" : "#fff",
        fontSize: Math.round(size * 0.34),
        border: ring ? `2px solid ${ring}` : undefined,
      }}
      title={name ?? initials}
    >
      {initials}
    </span>
  );
}

type StackMember = { initials: string; name?: string; gradient?: string };

/** Overlapping avatar pile with an optional "+N" chip. */
export function AvatarStack({
  members,
  extra,
  size = 32,
  ring = "#fff",
  className = "",
}: {
  members: StackMember[];
  extra?: number;
  size?: number;
  ring?: string;
  className?: string;
}) {
  const overlap = Math.round(size * 0.28);
  return (
    <div className={`flex items-center ${className}`}>
      {members.map((m, i) => (
        <span key={`${m.initials}-${i}`} style={{ marginLeft: i === 0 ? 0 : -overlap }}>
          <Avatar initials={m.initials} name={m.name} gradient={m.gradient} size={size} ring={ring} />
        </span>
      ))}
      {extra ? (
        <span
          className="inline-flex items-center justify-center rounded-full font-bold text-white"
          style={{
            width: size,
            height: size,
            marginLeft: -overlap,
            background: "rgba(120,111,100,.55)",
            border: `2px solid ${ring}`,
            fontSize: Math.round(size * 0.34),
          }}
        >
          +{extra}
        </span>
      ) : null}
    </div>
  );
}

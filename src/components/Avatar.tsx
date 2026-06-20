import { member } from "@/lib/trips";

type AvatarProps = {
  id: string;
  /** pixel diameter */
  size?: number;
  /** ring colour painted as a border (e.g. to lift off a photo) */
  ring?: string;
  className?: string;
};

export function Avatar({ id, size = 32, ring, className = "" }: AvatarProps) {
  const m = member(id);
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${className}`}
      style={{
        width: size,
        height: size,
        background: m.gradient,
        color: m.ink ? "#1c1b18" : "#fff",
        fontSize: Math.round(size * 0.34),
        border: ring ? `2px solid ${ring}` : undefined,
      }}
      title={m.name}
    >
      {m.initials}
    </span>
  );
}

type StackProps = {
  ids: string[];
  extra?: number;
  size?: number;
  ring?: string;
  className?: string;
};

/** Overlapping avatar pile with an optional "+N" chip. */
export function AvatarStack({ ids, extra, size = 32, ring = "#fff", className = "" }: StackProps) {
  const overlap = Math.round(size * 0.28);
  return (
    <div className={`flex items-center ${className}`}>
      {ids.map((id, i) => (
        <span key={id} style={{ marginLeft: i === 0 ? 0 : -overlap }}>
          <Avatar id={id} size={size} ring={ring} />
        </span>
      ))}
      {extra ? (
        <span
          className="inline-flex items-center justify-center rounded-full font-bold text-white"
          style={{
            width: size,
            height: size,
            marginLeft: -overlap,
            background: "rgba(255,255,255,.25)",
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

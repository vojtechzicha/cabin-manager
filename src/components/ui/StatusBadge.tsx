import type { ReactNode } from "react";

/**
 * Status vocabulary shared across finances and rosters (PRD §12). Each tone
 * carries a glyph as well as a color, so the meaning survives for colorblind
 * users and in monochrome — never color alone.
 */
export type StatusTone =
  | "settled"
  | "confirmed"
  | "owing"
  | "overdue"
  | "due"
  | "provisional"
  | "neutral";

const TONES: Record<StatusTone, { var: string; glyph: string }> = {
  settled: { var: "--settled", glyph: "✓" },
  confirmed: { var: "--confirmed", glyph: "✓" },
  owing: { var: "--owing", glyph: "▾" },
  overdue: { var: "--overdue", glyph: "!" },
  due: { var: "--due", glyph: "•" },
  provisional: { var: "--provisional", glyph: "~" },
  neutral: { var: "--sand", glyph: "" },
};

export function StatusBadge({
  tone = "neutral",
  children,
  glyph = true,
}: {
  tone?: StatusTone;
  children: ReactNode;
  glyph?: boolean;
}) {
  const t = TONES[tone];
  const color = `var(${t.var})`;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold"
      style={{
        background: `color-mix(in srgb, ${color} 16%, #fff)`,
        color: `color-mix(in srgb, ${color} 72%, #000)`,
      }}
    >
      {glyph && t.glyph ? (
        <span
          aria-hidden
          className="inline-flex h-[15px] w-[15px] items-center justify-center rounded-full text-[10px] font-bold text-white"
          style={{ background: color }}
        >
          {t.glyph}
        </span>
      ) : null}
      {children}
    </span>
  );
}

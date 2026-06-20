import type { CSSProperties } from "react";

/**
 * A trip's visual identity. Only these knobs change between trips — layout,
 * type, spacing, and components never do (PRD §12). Everything resolves through
 * the runtime CSS variables in globals.css.
 */
export interface TripTheme {
  /** Primary accent (buttons, active states). */
  accent: string;
  /** Darker accent for ink/text on light surfaces. */
  accentInk: string;
  /** Soft accent tint for fills. */
  accentSoft: string;
  /** Hero photo or gradient stand-in. */
  photo: string;
  /** Optional warm highlight (sun/spotlight). */
  gold?: string;
}

/**
 * Turns a TripTheme into the runtime CSS variables the whole UI reads from.
 * Spread onto a wrapper element and every `bg-accent`, `.bg-photo`, glass tint,
 * etc. below it re-skins automatically.
 */
export function themeVars(theme: TripTheme): CSSProperties {
  return {
    "--accent": theme.accent,
    "--accent-ink": theme.accentInk,
    "--accent-soft": theme.accentSoft,
    "--photo": theme.photo,
    ...(theme.gold ? { "--gold": theme.gold } : {}),
  } as CSSProperties;
}

/** A few seed themes for the gallery / previews. */
export const sampleThemes: Record<string, TripTheme> = {
  cabin: {
    accent: "#2f9e73",
    accentInk: "#15623f",
    accentSoft: "#e3f3ec",
    photo: "radial-gradient(125% 90% at 76% 0%, #8fd9b4 0%, #2f9e73 42%, #18694a 76%, #0e4732 100%)",
    gold: "#ffd23f",
  },
  la2028: {
    accent: "#3f6ad8",
    accentInk: "#23408f",
    accentSoft: "#e2e9fb",
    photo: "radial-gradient(125% 90% at 76% 0%, #9db6f0 0%, #3f6ad8 44%, #23408f 78%, #16285c 100%)",
    gold: "#ffce47",
  },
  baltic: {
    accent: "#e2674a",
    accentInk: "#a23a23",
    accentSoft: "#fbe3dc",
    photo: "radial-gradient(125% 90% at 76% 0%, #f6b39c 0%, #e2674a 44%, #a23a23 80%, #6b2113 100%)",
  },
};

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

/**
 * Derive a full {@link TripTheme} from a single accent color (what the organizer
 * actually picks — PRD §8.1/§12). The darker ink and soft tint are computed with
 * CSS `color-mix` so any hex works, and the hero photo falls back to an
 * accent-tinted gradient when no cover image is set. When `photo` (a cover image
 * URL) is given it's used as a `url(...)` background instead.
 */
export function themeForTrip(accent?: string | null, coverImage?: string | null): TripTheme {
  const color = accent && accent.trim() ? accent.trim() : "#2f9e73";
  return {
    accent: color,
    accentInk: `color-mix(in srgb, ${color} 70%, #000)`,
    accentSoft: `color-mix(in srgb, ${color} 16%, #fff)`,
    photo: coverImage
      ? `center / cover no-repeat url(${JSON.stringify(coverImage)})`
      : `radial-gradient(125% 90% at 76% 0%, color-mix(in srgb, ${color} 55%, #fff) 0%, ${color} 44%, color-mix(in srgb, ${color} 60%, #000) 100%)`,
  };
}

/**
 * The three canonical sample themes from the Chata Design System (Claude Design
 * source), kept verbatim so the gallery matches the design 1:1.
 */
export const sampleThemes: Record<string, TripTheme> = {
  cabin: {
    accent: "#2f9e73",
    accentInk: "#15623f",
    accentSoft: "#e3f3ec",
    photo: "radial-gradient(120% 95% at 78% 0%, #7cd0a6 0%, #2f9e73 40%, #18694a 76%, #0e4732 100%)",
    gold: "#ffd23f",
  },
  la2028: {
    accent: "#3a5bff",
    accentInk: "#1f33b0",
    accentSoft: "#e6e9ff",
    photo: "radial-gradient(120% 100% at 20% 0%, #8aa0ff 0%, #3a5bff 36%, #2230a8 72%, #131a4d 100%)",
    gold: "#ffd23f",
  },
  baltic: {
    accent: "#f0653c",
    accentInk: "#b23c1c",
    accentSoft: "#ffe7df",
    photo: "radial-gradient(120% 105% at 76% 0%, #ffd06b 0%, #f0653c 32%, #c23f6a 62%, #2b6f8f 100%)",
  },
};

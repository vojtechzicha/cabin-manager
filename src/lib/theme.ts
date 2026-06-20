import type { CSSProperties } from "react";
import type { Theme } from "./trips";

/**
 * Turns a trip Theme into the runtime CSS variables the whole UI reads from.
 * Spread onto a wrapper element and every `bg-accent`, `.bg-photo`, glass tint,
 * etc. below it re-skins automatically.
 */
export function themeVars(theme: Theme): CSSProperties {
  return {
    "--accent": theme.accent,
    "--accent-ink": theme.accentInk,
    "--accent-soft": theme.accentSoft,
    "--photo": theme.photo,
    ...(theme.gold ? { "--gold": theme.gold } : {}),
  } as CSSProperties;
}

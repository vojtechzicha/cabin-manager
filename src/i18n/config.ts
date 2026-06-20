/**
 * Locale configuration. Adding a locale is a content task: append it here and
 * provide a matching message catalog — no other code changes (PRD §6).
 */
export const locales = ["cs", "en"] as const;

export type Locale = (typeof locales)[number];

/** Czech is the launch default and the default trip currency locale. */
export const defaultLocale: Locale = "cs";

/** BCP-47 tags used by Intl formatters, keyed by app locale. */
export const localeTag: Record<Locale, string> = {
  cs: "cs-CZ",
  en: "en-GB",
};

/** Human-readable, in-language label for each locale (for the switcher). */
export const localeLabel: Record<Locale, string> = {
  cs: "Čeština",
  en: "English",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

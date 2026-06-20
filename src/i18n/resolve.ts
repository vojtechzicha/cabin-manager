import { defaultLocale, isLocale, locales, type Locale } from "./config";

/**
 * Pick the best supported locale from an `Accept-Language` header value.
 * Honors q-weights and matches on the primary subtag (e.g. `en-US` → `en`).
 */
export function parseAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;

  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const q = qParam ? Number.parseFloat(qParam.split("=")[1] ?? "1") : 1;
      return { tag: (tag ?? "").trim().toLowerCase(), q: Number.isNaN(q) ? 0 : q };
    })
    .filter((entry) => entry.tag.length > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    const primary = tag.split("-")[0];
    const match = locales.find((locale) => locale === primary);
    if (match) return match;
  }
  return null;
}

/**
 * Resolve the effective locale. Order (PRD §6 / T-003):
 *   1. explicit user preference (profile / Identity.preferredLanguage)
 *   2. request `Accept-Language` header
 *   3. default locale (Czech)
 */
export function resolveLocale(input: {
  userPreference?: string | null;
  acceptLanguage?: string | null;
}): Locale {
  if (input.userPreference && isLocale(input.userPreference)) {
    return input.userPreference;
  }
  return parseAcceptLanguage(input.acceptLanguage) ?? defaultLocale;
}

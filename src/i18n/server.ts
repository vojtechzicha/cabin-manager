import "server-only";
import { cookies, headers } from "next/headers";

import type { Locale } from "./config";
import { resolveLocale } from "./resolve";

/** Cookie the language switcher writes to override the detected locale. */
export const LOCALE_COOKIE = "locale";

/**
 * Resolve the locale for the current request, applying the precedence in
 * resolveLocale: explicit user preference (or the override cookie) → the
 * request's Accept-Language → default. Pass `userPreference` once Identity
 * carries a persisted preferredLanguage (T-101).
 */
export async function getRequestLocale(userPreference?: string | null): Promise<Locale> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value ?? null;
  return resolveLocale({
    userPreference: userPreference ?? cookieLocale,
    acceptLanguage: headerStore.get("accept-language"),
  });
}

import config from "@payload-config";
import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { isLocale } from "@/i18n";
import { LOCALE_COOKIE } from "@/i18n/server";
import type { Identity } from "@/payload-types";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Persist a language choice (T-101, PRD §6). Sets the override cookie (immediate
 * effect) and, when the visitor is signed in, saves it to
 * `Identity.preferredLanguage` so it follows them across devices. The language
 * switcher posts here; failures to persist still leave the cookie set.
 */
export async function POST(request: Request): Promise<Response> {
  let locale = "";
  try {
    const body = (await request.json()) as { locale?: unknown };
    if (typeof body.locale === "string") locale = body.locale;
  } catch {
    // fall through to validation
  }
  if (!isLocale(locale)) return NextResponse.json({ error: "invalid_locale" }, { status: 400 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });

  try {
    const payload = await getPayload({ config });
    const { user } = await payload.auth({ headers: request.headers });
    const identity =
      user && (user as { collection?: string }).collection === "identities"
        ? (user as unknown as Identity)
        : null;
    if (identity) {
      await payload.update({
        collection: "identities",
        id: identity.id,
        overrideAccess: true,
        data: { preferredLanguage: locale },
      });
    }
  } catch {
    // Best-effort persistence; the cookie above already applies the choice.
  }
  return res;
}

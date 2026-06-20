import config from "@payload-config";
import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { isLocale } from "@/i18n";
import { resolveLocale } from "@/i18n/resolve";
import { LOCALE_COOKIE } from "@/i18n/server";
import { getEnv } from "@/lib/env";
import { isAuthError } from "@/services/auth-errors";
import { consumeMagicLink } from "@/services/magic-link";
import { issueAuthToken } from "@/services/sessions";

import { setAuthCookie } from "../session";

/**
 * Magic-link redemption (T-103). The token in the URL *is* the auth: we verify
 * it, resolve/create the Identity, claim pending invitations, then set the auth
 * cookie and land the user in the app. Failures redirect home with a code the UI
 * can turn into a localized message (the token stays opaque).
 */
export async function GET(request: Request): Promise<Response> {
  const appUrl = getEnv().APP_URL;
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return NextResponse.redirect(`${appUrl}/?auth=invalid_token`);
  // Honor a carried-through `next` (in-app path only), else land home.
  const nextParam = url.searchParams.get("next");
  const dest = nextParam && nextParam.startsWith("/") ? nextParam : "/";

  // The browser's language seeds a brand-new account's preferredLanguage.
  const browserLocale = resolveLocale({ acceptLanguage: request.headers.get("accept-language") });

  try {
    const payload = await getPayload({ config });
    const { identity } = await consumeMagicLink(payload, token, { browserLocale });
    const issued = await issueAuthToken(payload, identity);
    const res = NextResponse.redirect(`${appUrl}${dest}`);
    setAuthCookie(res, issued);
    // Apply the account's saved language on login (follows them across devices).
    if (identity.preferredLanguage && isLocale(identity.preferredLanguage)) {
      res.cookies.set(LOCALE_COOKIE, identity.preferredLanguage, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    }
    return res;
  } catch (err) {
    const code = isAuthError(err) ? err.code : "error";
    return NextResponse.redirect(`${appUrl}/?auth=${code}`);
  }
}

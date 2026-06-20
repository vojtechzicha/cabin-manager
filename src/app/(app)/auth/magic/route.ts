import config from "@payload-config";
import { getPayload } from "payload";
import { NextResponse } from "next/server";

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
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return NextResponse.redirect(`${appUrl}/?auth=invalid_token`);

  try {
    const payload = await getPayload({ config });
    const { identity } = await consumeMagicLink(payload, token);
    const issued = await issueAuthToken(payload, identity);
    const res = NextResponse.redirect(`${appUrl}/`);
    setAuthCookie(res, issued);
    return res;
  } catch (err) {
    const code = isAuthError(err) ? err.code : "error";
    return NextResponse.redirect(`${appUrl}/?auth=${code}`);
  }
}

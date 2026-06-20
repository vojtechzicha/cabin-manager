import config from "@payload-config";
import { getPayload } from "payload";
import { NextResponse, type NextRequest } from "next/server";

import { getEnv } from "@/lib/env";
import { isAuthError } from "@/services/auth-errors";
import { fetchProfile, loginWithOAuth } from "@/services/oauth";
import { issueAuthToken } from "@/services/sessions";
import type { OAuthProvider } from "@/services/identity";

import { completeAuth } from "../../../session";

const PROVIDERS = new Set<OAuthProvider>(["google", "microsoft"]);

/**
 * OAuth callback (T-102). Verifies the `state` against the cookie set at start,
 * exchanges the code for the provider profile, resolves it to a single Identity
 * (find-or-link by verified email), then issues the auth cookie. Google and
 * Microsoft logins for the same verified email land on the same Identity.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
): Promise<Response> {
  const appUrl = getEnv().APP_URL;
  const { provider } = await params;
  if (!PROVIDERS.has(provider as OAuthProvider)) {
    return NextResponse.redirect(`${appUrl}/?auth=invalid_provider`);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get("oauth_state")?.value;
  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(`${appUrl}/?auth=invalid_state`);
  }

  try {
    const payload = await getPayload({ config });
    const redirectUri = `${appUrl}/auth/oauth/${provider}/callback`;
    const profile = await fetchProfile(provider as OAuthProvider, { code, redirectUri });
    const { identity } = await loginWithOAuth(payload, profile);
    const issued = await issueAuthToken(payload, identity);

    const res = completeAuth(issued, request.cookies.get("oauth_next")?.value);
    res.cookies.delete("oauth_state");
    res.cookies.delete("oauth_next");
    return res;
  } catch (err) {
    const code2 = isAuthError(err) ? err.code : "error";
    return NextResponse.redirect(`${appUrl}/?auth=${code2}`);
  }
}

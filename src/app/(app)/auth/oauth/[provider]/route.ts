import { NextResponse, type NextRequest } from "next/server";

import { getEnv } from "@/lib/env";
import { generateToken } from "@/lib/tokens";
import { isAuthError } from "@/services/auth-errors";
import { buildAuthorizeUrl } from "@/services/oauth";
import type { OAuthProvider } from "@/services/identity";

const PROVIDERS = new Set<OAuthProvider>(["google", "microsoft"]);

/**
 * Start an OAuth login (T-102): redirect to the provider's consent screen with a
 * random `state` we also stash in an http-only cookie, so the callback can
 * verify it (CSRF protection).
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

  try {
    const state = generateToken().raw;
    const requestedNext = request.nextUrl.searchParams.get("next");
    const next =
      requestedNext?.startsWith("/") &&
      !requestedNext.startsWith("//") &&
      !requestedNext.includes("\\")
        ? requestedNext
        : "/";
    const redirectUri = `${appUrl}/auth/oauth/${provider}/callback`;
    const authorizeUrl = buildAuthorizeUrl(provider as OAuthProvider, { redirectUri, state });
    const res = NextResponse.redirect(authorizeUrl);
    res.cookies.set("oauth_state", state, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: getEnv().NODE_ENV === "production",
      maxAge: 600,
    });
    res.cookies.set("oauth_next", next, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: getEnv().NODE_ENV === "production",
      maxAge: 600,
    });
    return res;
  } catch (err) {
    const code = isAuthError(err) ? err.code : "error";
    return NextResponse.redirect(`${appUrl}/?auth=${code}`);
  }
}

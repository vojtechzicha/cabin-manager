import type { NextResponse } from "next/server";

import { getEnv } from "@/lib/env";
import type { IssuedAuthToken } from "@/services/sessions";

/**
 * Set the Payload auth cookie on a route response (T-102/T-103). `httpOnly` so
 * client JS can't read the token; `secure` only in production so http://localhost
 * dev still works; `sameSite: lax` so the cookie survives the redirect back from
 * a magic link / OAuth callback.
 */
export function setAuthCookie(res: NextResponse, issued: IssuedAuthToken): void {
  res.cookies.set(issued.cookieName, issued.token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: getEnv().NODE_ENV === "production",
    expires: issued.expiresAt,
  });
}

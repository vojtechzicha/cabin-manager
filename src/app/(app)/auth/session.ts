import { NextResponse } from "next/server";

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

function safeDestination(destination: string): string {
  return destination.startsWith("/") &&
    !destination.startsWith("//") &&
    !destination.includes("\\")
    ? destination
    : "/";
}

/**
 * Return a real document response that commits the auth cookie before starting
 * the next navigation. Some browsers do not expose a cookie set on an OAuth
 * callback redirect to the immediately following request, which made the first
 * auth check bounce back to `/sign-in` even though a manual refresh worked.
 */
export function completeAuth(
  issued: IssuedAuthToken,
  destination = "/",
): NextResponse {
  const url = new URL(safeDestination(destination), getEnv().APP_URL);
  const serializedUrl = JSON.stringify(url.toString()).replaceAll("<", "\\u003c");
  const escapedUrl = url.toString().replaceAll("&", "&amp;").replaceAll('"', "&quot;");

  const response = new NextResponse(
    `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta http-equiv="refresh" content="0;url=${escapedUrl}">
    <style>html,body{margin:0;min-height:100%;background:#f4efe7}</style>
    <script>location.replace(${serializedUrl})</script>
  </head>
  <body></body>
</html>`,
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
        "Referrer-Policy": "no-referrer",
      },
    },
  );
  setAuthCookie(response, issued);
  return response;
}

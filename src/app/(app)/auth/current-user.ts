import "server-only";
import config from "@payload-config";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getPayload, type Payload } from "payload";

import type { Identity } from "@/payload-types";

/**
 * Resolve the signed-in Identity for the current request (T-201). Auth is the
 * stateless Payload JWT cookie set at login (build-note §8); we hand the request
 * headers to `payload.auth` and keep the result only if it's an `identities`
 * user (never the platform-admin path). Returns the live Payload instance too,
 * so a Server Component / Action can reuse one connection.
 *
 * Checking the token cookie first lets us skip `payload.auth` (a DB read)
 * entirely for guests — most "is anyone signed in?" calls on public pages.
 */
export async function getCurrentIdentity(): Promise<{
  payload: Payload;
  identity: Identity | null;
}> {
  const payload = await getPayload({ config });
  const cookieName = `${payload.config.cookiePrefix ?? "payload"}-token`;
  const hasToken = (await cookies()).has(cookieName);
  if (!hasToken) return { payload, identity: null };

  const { user } = await payload.auth({ headers: await headers() });
  const identity =
    user && (user as { collection?: string }).collection === "identities"
      ? (user as unknown as Identity)
      : null;
  return { payload, identity };
}

/**
 * Like {@link getCurrentIdentity} but redirects to sign-in when there is no
 * session. Use at the top of any authenticated page/action. `next` carries the
 * current path so the user lands back here after signing in.
 */
export async function requireIdentity(
  next?: string,
): Promise<{ payload: Payload; identity: Identity }> {
  const { payload, identity } = await getCurrentIdentity();
  if (!identity) {
    redirect(next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in");
  }
  return { payload, identity };
}

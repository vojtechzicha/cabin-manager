import config from "@payload-config";
import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env";
import { isAuthError } from "@/services/auth-errors";
import { requestOpenJoin } from "@/services/invitations";
import type { Identity } from "@/payload-types";

/**
 * Open-join request (T-104, PRD §5). Opening the link is a *request to join*;
 * it requires being signed in (so we can attach an Identity) and, by default,
 * lands in the organizer's approval queue. An unauthenticated visitor is sent to
 * sign in first, carrying the token so they return here afterward.
 */
export async function GET(request: Request): Promise<Response> {
  const appUrl = getEnv().APP_URL;
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return NextResponse.redirect(`${appUrl}/?join=invalid_token`);

  try {
    const payload = await getPayload({ config });
    const { user } = await payload.auth({ headers: request.headers });
    const identity =
      user && (user as { collection?: string }).collection === "identities"
        ? (user as unknown as Identity)
        : null;

    if (!identity) {
      // Preserve the join token through sign-in so the user lands back here.
      return NextResponse.redirect(
        `${appUrl}/?join=login_required&token=${encodeURIComponent(token)}`,
      );
    }

    const { needsApproval } = await requestOpenJoin(payload, token, identity);
    return NextResponse.redirect(`${appUrl}/?join=${needsApproval ? "pending" : "joined"}`);
  } catch (err) {
    const code = isAuthError(err) ? err.code : "error";
    return NextResponse.redirect(`${appUrl}/?join=${code}`);
  }
}

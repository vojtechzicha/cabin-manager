import config from "@payload-config";
import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env";
import { isAuthError } from "@/services/auth-errors";
import { redeemInvitation } from "@/services/invitations";
import { issueAuthToken } from "@/services/sessions";
import type { Identity } from "@/payload-types";

import { setAuthCookie } from "../session";

/**
 * Direct-invite redemption (T-104). Verifies the invite token, creates/links the
 * Identity (using the already-signed-in one for non-email invites), activates
 * the pending membership, then signs the user in and lands them in the trip.
 */
export async function GET(request: Request): Promise<Response> {
  const appUrl = getEnv().APP_URL;
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return NextResponse.redirect(`${appUrl}/?auth=invalid_token`);

  try {
    const payload = await getPayload({ config });
    // A non-email invite (phone/handle/name) needs an already-authenticated
    // identity, since there's no verified email to provision from.
    const { user } = await payload.auth({ headers: request.headers });
    const current =
      user && (user as { collection?: string }).collection === "identities"
        ? (user as unknown as Identity)
        : undefined;

    const { identity, tripId } = await redeemInvitation(payload, token, { identity: current });
    const issued = await issueAuthToken(payload, identity);
    const res = NextResponse.redirect(`${appUrl}/?trip=${encodeURIComponent(tripId)}`);
    setAuthCookie(res, issued);
    return res;
  } catch (err) {
    const code = isAuthError(err) ? err.code : "error";
    return NextResponse.redirect(`${appUrl}/?auth=${code}`);
  }
}

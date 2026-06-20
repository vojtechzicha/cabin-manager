/**
 * Magic-link passwordless auth (build.md T-103, PRD §4).
 *
 * "The token *is* the auth; the channel is only transport." We mint a single-use,
 * expiring token bound to an email, store only its hash, and on redemption
 * verify → mark used (replay protection) → resolve/create the Identity → claim
 * any pending invitations addressed to that email → hand back the Identity for
 * the route to issue a session cookie.
 *
 * Minting always succeeds regardless of whether the email already has an
 * account, so the flow never leaks which emails are registered; a brand-new
 * email is provisioned into an Identity on first redemption.
 */
import type { Payload, PayloadRequest } from "payload";

import { expiryFromNow, generateToken, hashToken, isExpired } from "@/lib/tokens";
import type { Identity, LoginToken, Membership } from "@/payload-types";

import { AuthError } from "./auth-errors";
import { ensureIdentity, findIdentityByEmail, normalizeEmail } from "./identity";
import { resolvePendingInvitesForEmail } from "./invitations";
import { magicLinkUrl } from "./urls";

/** Magic links are short-lived. */
export const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
export const MAGIC_LINK_TTL_MINUTES = MAGIC_LINK_TTL_MS / 60_000;

export interface MintedMagicLink {
  token: string;
  url: string;
  expiresAt: Date;
  /** Whether the email already had an Identity (for messaging, not gating). */
  identityExists: boolean;
}

/** Mint a magic-link login token for `email`. Delivery is separate (T-105). */
export async function mintMagicLink(
  payload: Payload,
  email: string,
  req?: PayloadRequest,
): Promise<MintedMagicLink> {
  const normalized = normalizeEmail(email);
  const existing = await findIdentityByEmail(payload, normalized, req);
  const { raw, hash } = generateToken();
  const expiresAt = expiryFromNow(MAGIC_LINK_TTL_MS);

  await payload.create({
    collection: "login-tokens",
    overrideAccess: true,
    req,
    data: {
      email: normalized,
      identity: existing?.id,
      tokenHash: hash,
      expiresAt: expiresAt.toISOString(),
    },
  });

  return { token: raw, url: magicLinkUrl(raw), expiresAt, identityExists: Boolean(existing) };
}

export interface MagicLinkConsumeResult {
  identity: Identity;
  /** True if redemption created the Identity (first login). */
  created: boolean;
  /** Pending memberships claimed by signing in. */
  activatedMemberships: Membership[];
}

/**
 * Redeem a magic-link token. Rejects unknown, already-used, and expired tokens;
 * otherwise marks it used *before* provisioning so a concurrent replay can't
 * also succeed, then resolves the Identity and any pending invitations.
 */
export async function consumeMagicLink(
  payload: Payload,
  rawToken: string,
  req?: PayloadRequest,
): Promise<MagicLinkConsumeResult> {
  const res = await payload.find({
    collection: "login-tokens",
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { tokenHash: { equals: hashToken(rawToken) } },
    req,
  });
  const token: LoginToken | undefined = res.docs[0];
  if (!token) throw new AuthError("invalid_token");
  if (token.usedAt) throw new AuthError("used_token");
  if (isExpired(token.expiresAt)) throw new AuthError("expired_token");

  // Burn the token first: a used token is rejected above, closing the replay
  // window before any account side effects happen.
  await payload.update({
    collection: "login-tokens",
    id: token.id,
    overrideAccess: true,
    req,
    data: { usedAt: new Date().toISOString() },
  });

  const { identity, created } = await ensureIdentity(payload, { email: token.email }, req);
  const activatedMemberships = await resolvePendingInvitesForEmail(payload, identity, req);

  return { identity, created, activatedMemberships };
}

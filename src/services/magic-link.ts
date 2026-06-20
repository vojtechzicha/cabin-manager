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

import type { Locale } from "@/i18n";
import { expiryFromNow, generateToken, hashToken } from "@/lib/tokens";
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

/**
 * Mint a magic-link login token for `email`. Delivery is separate (T-105).
 * An optional `next` (an in-app path) is carried in the link so redemption can
 * land the user where they were headed (e.g. an open-join page).
 */
export async function mintMagicLink(
  payload: Payload,
  email: string,
  opts: { next?: string } = {},
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

  const url =
    opts.next && opts.next.startsWith("/")
      ? `${magicLinkUrl(raw)}&next=${encodeURIComponent(opts.next)}`
      : magicLinkUrl(raw);
  return { token: raw, url, expiresAt, identityExists: Boolean(existing) };
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
  opts: { browserLocale?: Locale } = {},
  req?: PayloadRequest,
): Promise<MagicLinkConsumeResult> {
  const hash = hashToken(rawToken);
  const now = new Date();

  // Atomic burn: mark the token used **only if it's still unused and unexpired**,
  // in a single conditional write. MongoDB applies the filter at write time, so
  // two concurrent redemptions can't both succeed — the loser modifies nothing.
  const burned = await payload.update({
    collection: "login-tokens",
    overrideAccess: true,
    req,
    where: {
      and: [
        { tokenHash: { equals: hash } },
        { usedAt: { exists: false } },
        { expiresAt: { greater_than: now.toISOString() } },
      ],
    },
    data: { usedAt: now.toISOString() },
  });
  const token: LoginToken | undefined = burned.docs[0];
  if (!token) {
    // Nothing burned — say *why* for the UI (unknown / already-used / expired).
    const found = await payload.find({
      collection: "login-tokens",
      depth: 0,
      limit: 1,
      overrideAccess: true,
      req,
      where: { tokenHash: { equals: hash } },
    });
    const existing = found.docs[0];
    if (!existing) throw new AuthError("invalid_token");
    if (existing.usedAt) throw new AuthError("used_token");
    throw new AuthError("expired_token");
  }

  // A brand-new account defaults to the browser's language, not always Czech.
  const { identity, created } = await ensureIdentity(
    payload,
    { email: token.email, preferredLanguage: opts.browserLocale },
    req,
  );
  const activatedMemberships = await resolvePendingInvitesForEmail(payload, identity, req);

  return { identity, created, activatedMemberships };
}

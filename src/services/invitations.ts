/**
 * Invitations & access flows (build.md T-104, PRD §5).
 *
 *   Direct invite  — organizer adds a person → a **pending** Membership plus a
 *                    tokenized Invitation. First open creates/links the Identity
 *                    and activates the membership, inheriting pre-filled data.
 *   Open join      — a per-trip shareable link (off by default). Opening it is a
 *                    *request to join*; **organizer approval is required by
 *                    default** (a toggle auto-accepts).
 *
 * All writes go through the Local API with elevated access: redemption must work
 * for someone who isn't a member yet, so it can't be gated by membership-scoped
 * access control. The raw tokens live only in delivered URLs; we store hashes.
 */
import type { Payload, PayloadRequest } from "payload";

import type { MembershipRole } from "@/access";
import { expiryFromNow, generateToken, hashToken, isExpired } from "@/lib/tokens";
import type { Identity, Invitation, Membership, Trip } from "@/payload-types";

import { AuthError } from "./auth-errors";
import { ensureIdentity, normalizeEmail } from "./identity";
import { inviteUrl, openJoinUrl } from "./urls";

/** Direct invites stay valid for two weeks. */
const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

type InviteTargetType = NonNullable<Invitation["targetType"]>;

/** Normalize a Payload relationship value to its id string. */
function relId(rel: unknown): string | null {
  if (rel == null) return null;
  if (typeof rel === "object") return String((rel as { id: string | number }).id);
  return String(rel);
}

/** The caller's active/pending membership in a trip, if any. */
async function findMembershipForIdentity(
  payload: Payload,
  tripId: string,
  identityId: string,
  req?: PayloadRequest,
): Promise<Membership | null> {
  const res = await payload.find({
    collection: "memberships",
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { and: [{ trip: { equals: tripId } }, { identity: { equals: identityId } }] },
    req,
  });
  return res.docs[0] ?? null;
}

// --- Direct invitations -----------------------------------------------------

export interface DirectInviteInput {
  tripId: string;
  /** Email / phone / handle / name. Defaults to email. */
  targetType?: InviteTargetType;
  targetValue: string;
  displayName?: string;
  role?: MembershipRole;
}

export interface DirectInviteResult {
  invitation: Invitation;
  membership: Membership;
  /** Raw token — deliver in the URL, never persisted. */
  token: string;
  url: string;
  expiresAt: Date;
}

/**
 * Create a pending membership + tokenized invitation for a person who may not
 * have an account yet (PRD §4 pending membership). Delivery is separate (T-105).
 */
export async function createDirectInvite(
  payload: Payload,
  input: DirectInviteInput,
  req?: PayloadRequest,
): Promise<DirectInviteResult> {
  const targetType: InviteTargetType = input.targetType ?? "email";
  const targetValue =
    targetType === "email" ? normalizeEmail(input.targetValue) : input.targetValue.trim();

  const membership = await payload.create({
    collection: "memberships",
    overrideAccess: true,
    req,
    data: {
      trip: input.tripId,
      status: "pending",
      role: input.role ?? "participant",
      displayName: input.displayName ?? (targetType === "name" ? targetValue : undefined),
    },
  });

  const { raw, hash } = generateToken();
  const expiresAt = expiryFromNow(INVITE_TTL_MS);
  const invitation = await payload.create({
    collection: "invitations",
    overrideAccess: true,
    req,
    data: {
      trip: input.tripId,
      membership: membership.id,
      targetType,
      targetValue,
      tokenHash: hash,
      status: "pending",
      source: "direct",
      expiresAt: expiresAt.toISOString(),
    },
  });

  return { invitation, membership, token: raw, url: inviteUrl(raw), expiresAt };
}

/**
 * Activate a pending membership for `identity`, de-duplicating: if the identity
 * already has a membership in the trip (e.g. invited twice, or joined another
 * way), the redundant pending row is removed and the existing one returned.
 */
async function activatePendingMembership(
  payload: Payload,
  membershipId: string,
  identity: Identity,
  req?: PayloadRequest,
): Promise<Membership> {
  const pending = await payload.findByID({
    collection: "memberships",
    id: membershipId,
    depth: 0,
    overrideAccess: true,
    req,
  });
  const tripId = relId(pending.trip);
  if (tripId) {
    const existing = await findMembershipForIdentity(payload, tripId, identity.id, req);
    if (existing && String(existing.id) !== String(membershipId)) {
      await payload.delete({ collection: "memberships", id: membershipId, overrideAccess: true, req });
      return existing;
    }
  }
  return payload.update({
    collection: "memberships",
    id: membershipId,
    overrideAccess: true,
    req,
    data: {
      identity: identity.id,
      status: "active",
      displayName: pending.displayName ?? identity.displayName ?? undefined,
    },
  });
}

export interface RedeemResult {
  identity: Identity;
  membership: Membership;
  tripId: string;
  /** True if redeeming created the Identity (first login). */
  created: boolean;
}

/**
 * Redeem a direct-invite token: verify it, resolve/create the Identity, activate
 * the membership, and mark the invitation accepted (single-use). An already-used
 * or expired token is rejected (T-103/T-104 replay & expiry protection).
 *
 * For a non-email invite (phone/handle/name) the redeemer must already be signed
 * in — pass their `identity`, since we have no verified email to provision from.
 *
 * For an email invite, a passed-in `identity` (i.e. someone already signed in)
 * must match the invited address: redeeming while logged in as a *different*
 * account is refused (`wrong_account`) rather than silently claiming the
 * invitee's membership. The invite is left untouched so the right person can
 * still use it.
 */
export async function redeemInvitation(
  payload: Payload,
  rawToken: string,
  opts: { identity?: Identity } = {},
  req?: PayloadRequest,
): Promise<RedeemResult> {
  const res = await payload.find({
    collection: "invitations",
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { tokenHash: { equals: hashToken(rawToken) } },
    req,
  });
  const invitation = res.docs[0];
  if (!invitation) throw new AuthError("invalid_token");
  if (invitation.status === "accepted" || invitation.acceptedAt) {
    throw new AuthError("used_token");
  }
  if (isExpired(invitation.expiresAt)) {
    await payload.update({
      collection: "invitations",
      id: invitation.id,
      overrideAccess: true,
      req,
      data: { status: "expired" },
    });
    throw new AuthError("expired_token");
  }

  // Resolve the redeeming Identity, enforcing that the invite reaches its
  // intended recipient. An email invite names a specific address, so a signed-in
  // user may redeem it only when it's addressed to *their own* email — otherwise
  // someone logged in as a different account would silently claim the invitee's
  // pending membership. With nobody signed in, possession of the emailed token
  // stands in for control of that mailbox, so we provision the Identity from it.
  let identity = opts.identity ?? null;
  let created = false;
  if (invitation.targetType === "email") {
    const target = normalizeEmail(invitation.targetValue);
    if (identity) {
      if (normalizeEmail(identity.email) !== target) throw new AuthError("wrong_account");
    } else {
      const ensured = await ensureIdentity(payload, { email: target, displayName: undefined }, req);
      identity = ensured.identity;
      created = ensured.created;
    }
  } else if (!identity) {
    // Non-email invite (phone/handle/name): no verified email to provision from,
    // so the redeemer must already be signed in and claims it as themselves.
    throw new AuthError("invalid_token", "Non-email invite requires an authenticated identity");
  }

  const membershipId = relId(invitation.membership);
  if (!membershipId) throw new AuthError("not_found", "Invitation has no membership");
  const membership = await activatePendingMembership(payload, membershipId, identity, req);

  await payload.update({
    collection: "invitations",
    id: invitation.id,
    overrideAccess: true,
    req,
    data: { status: "accepted", acceptedAt: new Date().toISOString() },
  });

  return { identity, membership, tripId: relId(membership.trip) ?? "", created };
}

/**
 * Activate any pending email-invites addressed to this Identity's verified
 * email. Called on every login (magic-link/OAuth) so signing in resolves
 * outstanding invitations even when the user didn't click the invite link
 * itself (T-103 acceptance criteria).
 */
export async function resolvePendingInvitesForEmail(
  payload: Payload,
  identity: Identity,
  req?: PayloadRequest,
): Promise<Membership[]> {
  const res = await payload.find({
    collection: "invitations",
    depth: 0,
    limit: 100,
    overrideAccess: true,
    where: {
      and: [
        { status: { equals: "pending" } },
        { targetType: { equals: "email" } },
        { targetValue: { equals: normalizeEmail(identity.email) } },
      ],
    },
    req,
  });

  const activated: Membership[] = [];
  for (const inv of res.docs) {
    if (isExpired(inv.expiresAt)) {
      await payload.update({
        collection: "invitations",
        id: inv.id,
        overrideAccess: true,
        req,
        data: { status: "expired" },
      });
      continue;
    }
    const membershipId = relId(inv.membership);
    if (membershipId) {
      activated.push(await activatePendingMembership(payload, membershipId, identity, req));
    }
    await payload.update({
      collection: "invitations",
      id: inv.id,
      overrideAccess: true,
      req,
      data: { status: "accepted", acceptedAt: new Date().toISOString() },
    });
  }
  return activated;
}

// --- Open-join link ---------------------------------------------------------

export interface OpenJoinResult {
  token: string;
  url: string;
}

/**
 * Enable (or rotate) a trip's open-join link. Approval is required by default;
 * pass `autoAccept` to skip the queue (PRD §5, resolved decision #5). The token
 * is stored in the clear (see `Trips.openJoinToken`) so the organizer can
 * re-display and share the link; re-calling this rotates it, invalidating the
 * previous link.
 */
export async function enableOpenJoin(
  payload: Payload,
  tripId: string,
  opts: { autoAccept?: boolean } = {},
  req?: PayloadRequest,
): Promise<OpenJoinResult> {
  const { raw } = generateToken();
  await payload.update({
    collection: "trips",
    id: tripId,
    overrideAccess: true,
    req,
    data: {
      invites: {
        openJoinEnabled: true,
        openJoinAutoAccept: opts.autoAccept ?? false,
        openJoinToken: raw,
      },
    },
  });
  return { token: raw, url: openJoinUrl(raw) };
}

/** Disable a trip's open-join link and clear its token. */
export async function disableOpenJoin(
  payload: Payload,
  tripId: string,
  req?: PayloadRequest,
): Promise<void> {
  await payload.update({
    collection: "trips",
    id: tripId,
    overrideAccess: true,
    req,
    data: {
      invites: { openJoinEnabled: false, openJoinAutoAccept: false, openJoinToken: null },
    },
  });
}

export interface JoinRequestResult {
  membership: Membership;
  /** True when the request awaits organizer approval (the default). */
  needsApproval: boolean;
  trip: Trip;
}

/**
 * Handle an authenticated open-join request. Verifies the link token, blocks
 * duplicate memberships, and creates either an active membership (auto-accept)
 * or a pending one that lands in the approval queue.
 */
export async function requestOpenJoin(
  payload: Payload,
  rawToken: string,
  identity: Identity,
  req?: PayloadRequest,
): Promise<JoinRequestResult> {
  const res = await payload.find({
    collection: "trips",
    limit: 1,
    overrideAccess: true,
    where: { "invites.openJoinToken": { equals: rawToken } },
    req,
  });
  const trip = res.docs[0];
  if (!trip || !trip.invites?.openJoinEnabled) {
    throw new AuthError("open_join_disabled");
  }

  const existing = await findMembershipForIdentity(payload, String(trip.id), identity.id, req);
  if (existing) throw new AuthError("already_member");

  const autoAccept = trip.invites?.openJoinAutoAccept ?? false;
  const membership = await payload.create({
    collection: "memberships",
    overrideAccess: true,
    req,
    data: {
      trip: trip.id,
      identity: identity.id,
      role: "participant",
      status: autoAccept ? "active" : "pending",
      displayName: identity.displayName ?? undefined,
    },
  });

  return { membership, needsApproval: !autoAccept, trip };
}

/**
 * Open-join requests awaiting approval: pending memberships that already have an
 * Identity (direct-invite pending rows have none yet, so they're excluded).
 */
export async function listJoinRequests(
  payload: Payload,
  tripId: string,
  req?: PayloadRequest,
): Promise<Membership[]> {
  const res = await payload.find({
    collection: "memberships",
    limit: 200,
    overrideAccess: true,
    where: {
      and: [
        { trip: { equals: tripId } },
        { status: { equals: "pending" } },
        { identity: { exists: true } },
      ],
    },
    req,
  });
  return res.docs;
}

/** Approve a join request, activating the membership. */
export async function approveJoinRequest(
  payload: Payload,
  membershipId: string,
  req?: PayloadRequest,
): Promise<Membership> {
  return payload.update({
    collection: "memberships",
    id: membershipId,
    overrideAccess: true,
    req,
    data: { status: "active" },
  });
}

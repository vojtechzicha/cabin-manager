/**
 * Per-collection access policies composed from the reusable predicates. Each
 * collection imports its policy object so the rules live in one auditable place
 * and stay consistent (build.md T-106).
 *
 * Read/list policies return a `Where` that scopes results to what the caller may
 * see; create/update/delete policies that depend on the target trip inspect the
 * incoming `data` (create) or scope by a `Where` over the caller's organized
 * trips (update/delete over a list).
 */
import type { Access, Where } from "payload";

import {
  isOrganizerOf,
  isPlatformAdminReq,
  memberTripIds,
  organizerTripIds,
} from "./predicates";

function userId(req: Parameters<Access>[0]["req"]): string | null {
  const user = req.user as { id?: string | number } | null;
  return user?.id != null ? String(user.id) : null;
}

// --- Trips ------------------------------------------------------------------

/**
 * A caller reads only trips they are an active member of (PRD §5). Two people
 * with memberships in different trips never see each other's trips.
 */
export const tripsAccess = {
  read: (async ({ req }) => {
    if (isPlatformAdminReq(req)) return true;
    if (!userId(req)) return false;
    return { id: { in: await memberTripIds(req) } };
  }) satisfies Access,
  // Anyone signed in can spin up a trip; the creator is made its organizer.
  create: (({ req }) => Boolean(userId(req))) satisfies Access,
  update: (async ({ req }) => {
    if (isPlatformAdminReq(req)) return true;
    if (!userId(req)) return false;
    return { id: { in: await organizerTripIds(req) } };
  }) satisfies Access,
  delete: (async ({ req }) => {
    if (isPlatformAdminReq(req)) return true;
    if (!userId(req)) return false;
    return { id: { in: await organizerTripIds(req) } };
  }) satisfies Access,
};

// --- Memberships ------------------------------------------------------------

/**
 * Members see the full roster of trips they belong to (needed for sleeping,
 * transport, settlement). Organizers manage memberships; a participant may edit
 * their own membership (attendance, refund banking) but not privileged fields —
 * those are gated at the field level on the collection.
 */
export const membershipsAccess = {
  read: (async ({ req }) => {
    if (isPlatformAdminReq(req)) return true;
    if (!userId(req)) return false;
    return { trip: { in: await memberTripIds(req) } };
  }) satisfies Access,
  create: (async ({ req, data }) => {
    if (isPlatformAdminReq(req)) return true;
    return isOrganizerOf(req, data?.trip as string | undefined);
  }) satisfies Access,
  update: (async ({ req }) => {
    if (isPlatformAdminReq(req)) return true;
    const id = userId(req);
    if (!id) return false;
    const where: Where = {
      or: [{ trip: { in: await organizerTripIds(req) } }, { identity: { equals: id } }],
    };
    return where;
  }) satisfies Access,
  delete: (async ({ req }) => {
    if (isPlatformAdminReq(req)) return true;
    if (!userId(req)) return false;
    return { trip: { in: await organizerTripIds(req) } };
  }) satisfies Access,
};

// --- Invitations ------------------------------------------------------------

/**
 * Only organizers (and admins) read or manage a trip's invitations. Invitees
 * never read invitations over the API — they redeem a token through the auth
 * route, which runs with elevated access.
 */
export const invitationsAccess = {
  read: (async ({ req }) => {
    if (isPlatformAdminReq(req)) return true;
    if (!userId(req)) return false;
    return { trip: { in: await organizerTripIds(req) } };
  }) satisfies Access,
  create: (async ({ req, data }) => {
    if (isPlatformAdminReq(req)) return true;
    return isOrganizerOf(req, data?.trip as string | undefined);
  }) satisfies Access,
  update: (async ({ req }) => {
    if (isPlatformAdminReq(req)) return true;
    if (!userId(req)) return false;
    return { trip: { in: await organizerTripIds(req) } };
  }) satisfies Access,
  delete: (async ({ req }) => {
    if (isPlatformAdminReq(req)) return true;
    if (!userId(req)) return false;
    return { trip: { in: await organizerTripIds(req) } };
  }) satisfies Access,
};

// --- Trip content -----------------------------------------------------------

/**
 * Trip info & content (T-203): every trip member reads it; only organizers
 * (and admins) edit it. Mirrors the membership read scope and the invitation
 * write scope (PRD §8.7 — read-mostly content the organizer maintains).
 */
export const tripContentAccess = {
  read: (async ({ req }) => {
    if (isPlatformAdminReq(req)) return true;
    if (!userId(req)) return false;
    return { trip: { in: await memberTripIds(req) } };
  }) satisfies Access,
  create: (async ({ req, data }) => {
    if (isPlatformAdminReq(req)) return true;
    return isOrganizerOf(req, data?.trip as string | undefined);
  }) satisfies Access,
  update: (async ({ req }) => {
    if (isPlatformAdminReq(req)) return true;
    if (!userId(req)) return false;
    return { trip: { in: await organizerTripIds(req) } };
  }) satisfies Access,
  delete: (async ({ req }) => {
    if (isPlatformAdminReq(req)) return true;
    if (!userId(req)) return false;
    return { trip: { in: await organizerTripIds(req) } };
  }) satisfies Access,
};

// --- Identities -------------------------------------------------------------

/**
 * An Identity is personal data: a caller reads and edits only their own (PRD
 * §10 least-privilege). Provisioning new identities (OAuth/magic-link first
 * login) happens server-side via the Local API with elevated access, so public
 * create/delete is admin-only.
 */
export const identitiesAccess = {
  // Admin-panel lockdown (PRD §3, T-106): only the platform admin may reach
  // `/admin`. Payload gates the admin UI on this `admin` access function, so a
  // signed-in participant is refused entry to the back office entirely.
  admin: ({ req }: Parameters<Access>[0]) => isPlatformAdminReq(req),
  read: (({ req }) => {
    if (isPlatformAdminReq(req)) return true;
    const id = userId(req);
    return id ? { id: { equals: id } } : false;
  }) satisfies Access,
  create: (({ req }) => isPlatformAdminReq(req)) satisfies Access,
  update: (({ req }) => {
    if (isPlatformAdminReq(req)) return true;
    const id = userId(req);
    return id ? { id: { equals: id } } : false;
  }) satisfies Access,
  delete: (({ req }) => isPlatformAdminReq(req)) satisfies Access,
};

// --- Audit entries (read tightened to admins + trip members) ----------------

/** Members read their trip's audit trail; writes stay system-only (see helper). */
export const auditReadAccess: Access = async ({ req }) => {
  if (isPlatformAdminReq(req)) return true;
  if (!userId(req)) return false;
  return { trip: { in: await memberTripIds(req) } };
};

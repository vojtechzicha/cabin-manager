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
  myMembershipIds,
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
    // A member reads their trips — but a **Draft** trip is invisible to
    // participants (PRD §7); only its organizers (and admins) can see it.
    const where: Where = {
      and: [
        { id: { in: await memberTripIds(req) } },
        { or: [{ phase: { not_equals: "draft" } }, { id: { in: await organizerTripIds(req) } }] },
      ],
    };
    return where;
  }) satisfies Access,
  // Trips are created **only through `createTrip`** (which atomically seats the
  // organizer membership + default banker, all via `overrideAccess`). Denying
  // direct API create stops orphan trips and arbitrary lifecycle values; the
  // public `createTripAction` still works because the service runs elevated.
  create: (({ req }) => isPlatformAdminReq(req)) satisfies Access,
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
  // Invitations are minted only through the invitation services (which create a
  // matching pending membership in the same trip), so a raw API create can't
  // attach an invitation to a membership from another trip.
  create: (({ req }) => isPlatformAdminReq(req)) satisfies Access,
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

// --- Polls (date & location voting, T-301) ----------------------------------

/**
 * A poll (one per trip per kind) is organizer-managed: every member reads it,
 * only organizers create/configure/close it. Mirrors {@link tripContentAccess}.
 */
export const pollsAccess = {
  read: (async ({ req }) => {
    if (isPlatformAdminReq(req)) return true;
    if (!userId(req)) return false;
    return { trip: { in: await memberTripIds(req) } };
  }) satisfies Access,
  // Polls are created only through the poll service (`getOrCreatePoll`), so a
  // raw API create can't make one already-published or with a forged winner.
  create: (({ req }) => isPlatformAdminReq(req)) satisfies Access,
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

/**
 * Poll options: members read all; **creation goes only through the poll service**
 * (`addOption`, used by both organizer seeding and `suggestOptionAction`), which
 * stamps a consistent `poll`/`trip`/`kind` and the suggester. Denying direct API
 * create stops forged options (mismatched trip/poll/kind, or a fake
 * "organizer-seeded" option with empty `suggestedBy`) — §8.2.
 */
export const pollOptionsAccess = {
  read: (async ({ req }) => {
    if (isPlatformAdminReq(req)) return true;
    if (!userId(req)) return false;
    return { trip: { in: await memberTripIds(req) } };
  }) satisfies Access,
  create: (({ req }) => isPlatformAdminReq(req)) satisfies Access,
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

/**
 * Votes are **public to read** across the trip (keeps the group honest, §8.2)
 * but **personal to write**: a member may create/update/delete only their own
 * votes; organizers may also clear votes. Self-scope is by the caller's own
 * membership ids.
 */
export const votesAccess = {
  read: (async ({ req }) => {
    if (isPlatformAdminReq(req)) return true;
    if (!userId(req)) return false;
    return { trip: { in: await memberTripIds(req) } };
  }) satisfies Access,
  create: (async ({ req, data }) => {
    if (isPlatformAdminReq(req)) return true;
    // A vote may only be attributed to one of the caller's OWN memberships — you
    // can't cast a vote as someone else. (The validation hook on Votes enforces
    // poll/option/trip consistency and the poll's open/published state.)
    const membershipId = data?.membership ? String(data.membership) : null;
    if (!membershipId) return false;
    return (await myMembershipIds(req)).includes(membershipId);
  }) satisfies Access,
  update: (async ({ req }) => {
    if (isPlatformAdminReq(req)) return true;
    if (!userId(req)) return false;
    const where: Where = {
      or: [
        { trip: { in: await organizerTripIds(req) } },
        { membership: { in: await myMembershipIds(req) } },
      ],
    };
    return where;
  }) satisfies Access,
  delete: (async ({ req }) => {
    if (isPlatformAdminReq(req)) return true;
    if (!userId(req)) return false;
    const where: Where = {
      or: [
        { trip: { in: await organizerTripIds(req) } },
        { membership: { in: await myMembershipIds(req) } },
      ],
    };
    return where;
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

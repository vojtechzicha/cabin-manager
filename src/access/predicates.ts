/**
 * Reusable access predicates (build.md T-106, PRD §5/§10).
 *
 * Authorization is **server-side only** and keyed on the requesting Identity's
 * Membership/role — the client is never trusted. Payload access functions return
 * either a boolean or a `Where` filter; for list/read operations we return a
 * `Where` that scopes the result set to the rows the caller may see, which is
 * both the authorization check and the data filter in one.
 *
 * The vocabulary mirrors the membership model:
 *   isPlatformAdmin  — the only role that may reach the Payload admin surface.
 *   isSelf           — the requesting Identity acting on its own record.
 *   isMember         — has an active Membership in the trip.
 *   isOrganizer      — has an organizer / co-organizer Membership in the trip.
 *   isBanker         — holds the banker Membership in the trip.
 *
 * Membership-scoped helpers query the `memberships` collection through the
 * surrounding `req` so they participate in the same transaction/auth context.
 */
import type { Access, FieldAccess, PayloadRequest } from "payload";

/** Roles that grant organizer powers over a trip. */
export const ORGANIZER_ROLES = ["organizer", "co-organizer"] as const;
export type MembershipRole = (typeof ORGANIZER_ROLES)[number] | "participant";

/** A trip-membership as seen with `depth: 0` (relationships are raw ids). */
interface MembershipLite {
  trip: string;
  role: MembershipRole;
  isBanker?: boolean | null;
}

/** The authenticated Identity, narrowed to the fields access control reads. */
interface RequestUser {
  id: string;
  role?: "admin" | "user";
}

function currentUser(req: PayloadRequest): RequestUser | null {
  const user = req.user as (RequestUser & { collection?: string }) | null;
  if (!user) return null;
  return { id: String(user.id), role: user.role };
}

/**
 * Active memberships of the requesting Identity, as raw {trip, role, isBanker}.
 * Pending memberships (not yet claimed by a login) do not grant access.
 */
async function activeMemberships(req: PayloadRequest): Promise<MembershipLite[]> {
  const user = currentUser(req);
  if (!user) return [];
  const res = await req.payload.find({
    collection: "memberships",
    depth: 0,
    pagination: false,
    limit: 1000,
    // Elevated: this lookup *is* the authorization check, so it must see all of
    // the user's memberships. Without it, `memberships` read-access would recurse
    // into itself (read-access → memberTripIds → read memberships → …).
    overrideAccess: true,
    where: {
      and: [{ identity: { equals: user.id } }, { status: { equals: "active" } }],
    },
    req,
  });
  return res.docs.map((d) => ({
    trip: String(d.trip),
    role: d.role as MembershipRole,
    isBanker: d.isBanker,
  }));
}

/** Trip ids the caller is an active member of. */
export async function memberTripIds(req: PayloadRequest): Promise<string[]> {
  return (await activeMemberships(req)).map((m) => m.trip);
}

/** Trip ids the caller organizes (organizer or co-organizer). */
export async function organizerTripIds(req: PayloadRequest): Promise<string[]> {
  return (await activeMemberships(req))
    .filter((m) => (ORGANIZER_ROLES as readonly string[]).includes(m.role))
    .map((m) => m.trip);
}

/** Trip ids the caller is the banker for. */
export async function bankerTripIds(req: PayloadRequest): Promise<string[]> {
  return (await activeMemberships(req)).filter((m) => m.isBanker).map((m) => m.trip);
}

// --- Boolean predicates (single-trip checks) --------------------------------

/** True if the caller is the platform admin. */
export function isPlatformAdminReq(req: PayloadRequest): boolean {
  return currentUser(req)?.role === "admin";
}

/** True if the caller has an active membership in `tripId`. */
export async function isMemberOf(req: PayloadRequest, tripId: string | null | undefined): Promise<boolean> {
  if (!tripId) return false;
  return (await memberTripIds(req)).includes(String(tripId));
}

/** True if the caller organizes `tripId`. */
export async function isOrganizerOf(req: PayloadRequest, tripId: string | null | undefined): Promise<boolean> {
  if (!tripId) return false;
  return (await organizerTripIds(req)).includes(String(tripId));
}

/** True if the caller is the banker for `tripId`. */
export async function isBankerOf(req: PayloadRequest, tripId: string | null | undefined): Promise<boolean> {
  if (!tripId) return false;
  return (await bankerTripIds(req)).includes(String(tripId));
}

// --- Payload Access functions (collection/field level) ----------------------

/** Only the platform admin. Used to lock down `identities` writes and `/admin`. */
export const isPlatformAdmin: Access = ({ req }) => isPlatformAdminReq(req);

/** Any authenticated Identity (e.g. anyone may create a trip and become its organizer). */
export const isAuthenticated: Access = ({ req }) => Boolean(currentUser(req));

/** Field access: only the platform admin may write the field. */
export const isPlatformAdminField: FieldAccess = ({ req }) => isPlatformAdminReq(req);

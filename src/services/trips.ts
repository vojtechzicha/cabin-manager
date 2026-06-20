/**
 * Trip creation & configuration (build.md T-101 bootstrap, T-201 console).
 *
 * Creating a trip also makes the creator its first **organizer** with an active
 * Membership, and the default **banker** (PRD §8.1: banker defaults to the
 * organizer). The organizer then configures everything from the frontend — never
 * `/admin` (T-201 acceptance) — through `updateTripConfig`, and the console reads
 * the user's trips through `listMemberTrips`.
 *
 * These run with elevated access; the calling server action authorizes the
 * organizer (`isOrganizerOf`) first and passes `req` for transactional writes.
 */
import type { Payload, PayloadRequest } from "payload";

import type { MembershipRole } from "@/access";
import type { Identity, Membership, Trip } from "@/payload-types";

import { withTransaction } from "./transaction";

/** Trip branding (PRD §8.1, §12) — the only per-trip visual knobs. */
export interface TripThemeInput {
  color?: string;
  icon?: string;
  /** Uploaded cover photo (Media id), or null to clear it. */
  coverMedia?: string | null;
  coverImage?: string;
}

export interface CreateTripInput {
  name: string;
  shortName: string;
  location?: string;
  description?: string;
  /** Accent color shorthand; superseded by `theme` when both are given. */
  themeColor?: string;
  theme?: TripThemeInput;
}

export interface CreateTripResult {
  trip: Trip;
  organizerMembership: Membership;
}

function buildTheme(input: CreateTripInput): Trip["theme"] | undefined {
  const color = input.theme?.color ?? input.themeColor;
  const icon = input.theme?.icon;
  const coverMedia = input.theme?.coverMedia ?? undefined;
  const coverImage = input.theme?.coverImage;
  if (!color && !icon && !coverMedia && !coverImage) return undefined;
  return { color, icon, coverMedia, coverImage };
}

/** Create a trip and seat its creator as the organizer + banker. */
export async function createTrip(
  payload: Payload,
  input: CreateTripInput,
  organizer: Identity,
  req?: PayloadRequest,
): Promise<CreateTripResult> {
  // Atomic: a failure must not leave an orphan trip with no organizer membership.
  return withTransaction(payload, req, async (req) => {
    const trip = await payload.create({
      collection: "trips",
      overrideAccess: true,
      req,
      data: {
        name: input.name,
        shortName: input.shortName,
        location: input.location,
        description: input.description,
        theme: buildTheme(input),
        createdBy: organizer.id,
      },
    });

    const organizerMembership = await payload.create({
      collection: "memberships",
      overrideAccess: true,
      req,
      data: {
        trip: trip.id,
        identity: organizer.id,
        role: "organizer",
        status: "active",
        isBanker: true,
        displayName: organizer.displayName ?? undefined,
      },
    });

    const withBanker = await payload.update({
      collection: "trips",
      id: trip.id,
      overrideAccess: true,
      req,
      data: { banker: { membership: organizerMembership.id } },
    });

    return { trip: withBanker, organizerMembership };
  });
}

/** Partial trip configuration the organizer console can save (PRD §8.1). */
export interface UpdateTripConfigInput {
  name?: string;
  shortName?: string;
  location?: string | null;
  description?: string | null;
  theme?: TripThemeInput;
  enabledAreas?: Partial<NonNullable<Trip["enabledAreas"]>>;
  banker?: { bankAccount?: string | null; iban?: string | null };
  deposit?: Partial<NonNullable<Trip["deposit"]>>;
}

/**
 * Apply a configuration change to a trip. Only the provided sections are
 * touched; grouped fields (theme, banker, deposit, enabledAreas) are merged so a
 * partial save doesn't wipe sibling fields.
 */
export async function updateTripConfig(
  payload: Payload,
  tripId: string,
  input: UpdateTripConfigInput,
  req?: PayloadRequest,
): Promise<Trip> {
  const current = await payload.findByID({
    collection: "trips",
    id: tripId,
    overrideAccess: true,
    depth: 0, // keep relationships (e.g. theme.coverMedia) as ids for a clean merge
    req,
  });

  const data: Partial<Trip> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.shortName !== undefined) data.shortName = input.shortName;
  if (input.location !== undefined) data.location = input.location;
  if (input.description !== undefined) data.description = input.description;
  if (input.theme) data.theme = { ...current.theme, ...input.theme };
  if (input.enabledAreas) data.enabledAreas = { ...current.enabledAreas, ...input.enabledAreas };
  if (input.banker) data.banker = { ...current.banker, ...input.banker };
  if (input.deposit) data.deposit = { ...current.deposit, ...input.deposit };

  return payload.update({ collection: "trips", id: tripId, overrideAccess: true, req, data });
}

export interface MemberTrip {
  trip: Trip;
  membership: Membership;
}

/**
 * The trips an Identity actively belongs to, with their membership in each — the
 * data behind the home trip-picker and the console trip switcher. Pending
 * memberships (un-claimed invites) are excluded.
 */
export async function listMemberTrips(
  payload: Payload,
  identityId: string,
  req?: PayloadRequest,
): Promise<MemberTrip[]> {
  const memberships = await payload.find({
    collection: "memberships",
    overrideAccess: true,
    depth: 0,
    pagination: false,
    limit: 1000,
    where: {
      and: [{ identity: { equals: identityId } }, { status: { equals: "active" } }],
    },
    req,
  });

  const out: MemberTrip[] = [];
  for (const membership of memberships.docs) {
    const tripId = typeof membership.trip === "object" ? membership.trip.id : membership.trip;
    try {
      const trip = await payload.findByID({
        collection: "trips",
        id: String(tripId),
        overrideAccess: true,
        req,
      });
      // Draft trips are invisible to participants (PRD §7) — only their
      // organizers see them in the picker. (This loader uses overrideAccess, so
      // it must reproduce the `tripsAccess.read` draft rule itself.)
      const isOrganizer = membership.role === "organizer" || membership.role === "co-organizer";
      if (trip.phase === "draft" && !isOrganizer) continue;
      out.push({ trip, membership });
    } catch {
      // Trip deleted out from under a stale membership — skip it.
    }
  }
  return out;
}

/** The roster of a trip (all memberships), for people-management views. */
export async function listMemberships(
  payload: Payload,
  tripId: string,
  req?: PayloadRequest,
): Promise<Membership[]> {
  const res = await payload.find({
    collection: "memberships",
    overrideAccess: true,
    depth: 1,
    pagination: false,
    limit: 1000,
    sort: "createdAt",
    where: { trip: { equals: tripId } },
    req,
  });
  return res.docs;
}

/** The caller's membership in a trip (any status), or null — for authorization. */
export async function getMembership(
  payload: Payload,
  tripId: string,
  identityId: string,
  req?: PayloadRequest,
): Promise<Membership | null> {
  const res = await payload.find({
    collection: "memberships",
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: {
      and: [{ trip: { equals: tripId } }, { identity: { equals: identityId } }],
    },
    req,
  });
  return res.docs[0] ?? null;
}

const ORGANIZER_ROLE_SET = new Set<MembershipRole>(["organizer", "co-organizer"]);

/** True if the identity actively organizes the trip (organizer or co-organizer). */
export async function identityOrganizesTrip(
  payload: Payload,
  tripId: string,
  identityId: string,
  req?: PayloadRequest,
): Promise<boolean> {
  const membership = await getMembership(payload, tripId, identityId, req);
  return (
    !!membership &&
    membership.status === "active" &&
    ORGANIZER_ROLE_SET.has(membership.role as MembershipRole)
  );
}

/** Promote/demote a member's role (co-organizer management, PRD §8.1). */
export async function setMembershipRole(
  payload: Payload,
  membershipId: string,
  role: MembershipRole,
  req?: PayloadRequest,
): Promise<Membership> {
  return payload.update({
    collection: "memberships",
    id: membershipId,
    overrideAccess: true,
    req,
    data: { role },
  });
}

export interface SetBankerInput {
  membershipId: string;
  bankAccount?: string | null;
  iban?: string | null;
}

/**
 * Assign the banker (PRD §8.1, §8.5): point `trip.banker` at the chosen
 * membership with its bank details, and move the `isBanker` flag onto that
 * member (clearing it from everyone else — exactly one banker per trip).
 */
export async function setBanker(
  payload: Payload,
  tripId: string,
  input: SetBankerInput,
  req?: PayloadRequest,
): Promise<Trip> {
  // Atomic: flipping the old/new banker flags and writing the trip's banker
  // details must commit together.
  return withTransaction(payload, req, async (req) => {
    const memberships = await payload.find({
      collection: "memberships",
      where: { trip: { equals: tripId } },
      overrideAccess: true,
      depth: 0,
      pagination: false,
      limit: 1000,
      req,
    });
    // The banker must be an active member of *this* trip (PRD §8.1) — validated
    // here so every caller is protected, not just the server action.
    const target = memberships.docs.find((m) => String(m.id) === String(input.membershipId));
    if (!target || target.status !== "active") {
      throw new Error("The banker must be an active member of this trip.");
    }
    for (const m of memberships.docs) {
      const shouldBank = String(m.id) === String(input.membershipId);
      if ((m.isBanker ?? false) !== shouldBank) {
        await payload.update({
          collection: "memberships",
          id: m.id,
          overrideAccess: true,
          req,
          data: { isBanker: shouldBank },
        });
      }
    }
    return payload.update({
      collection: "trips",
      id: tripId,
      overrideAccess: true,
      req,
      data: {
        banker: {
          membership: input.membershipId,
          bankAccount: input.bankAccount ?? null,
          iban: input.iban ?? null,
        },
      },
    });
  });
}

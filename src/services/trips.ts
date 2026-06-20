/**
 * Trip creation (build.md T-101; the full organizer console is T-201).
 *
 * Creating a trip also makes the creator its first **organizer** with an active
 * Membership, and the default **banker** (PRD §8.1: banker defaults to the
 * organizer). This is the bootstrap every other flow relies on, so it lives in
 * the service layer and is exercised by the seed and integration tests.
 */
import type { Payload, PayloadRequest } from "payload";

import type { Identity, Membership, Trip } from "@/payload-types";

export interface CreateTripInput {
  name: string;
  shortName: string;
  location?: string;
  description?: string;
  themeColor?: string;
}

export interface CreateTripResult {
  trip: Trip;
  organizerMembership: Membership;
}

/** Create a trip and seat its creator as the organizer + banker. */
export async function createTrip(
  payload: Payload,
  input: CreateTripInput,
  organizer: Identity,
  req?: PayloadRequest,
): Promise<CreateTripResult> {
  const trip = await payload.create({
    collection: "trips",
    overrideAccess: true,
    req,
    data: {
      name: input.name,
      shortName: input.shortName,
      location: input.location,
      description: input.description,
      theme: input.themeColor ? { color: input.themeColor } : undefined,
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
}

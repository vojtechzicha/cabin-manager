/**
 * Trip info & content service (build.md T-203, PRD §8.7).
 *
 * The `trip-content` collection holds **one row per trip**, but a trip can exist
 * without content (newly created) — so reads tolerate its absence and writes
 * upsert. The organizer console edits content through `upsertTripContent`;
 * participants read it through `getTripContent`. Like the other use-case
 * services (`createTrip`, lifecycle transitions) these run with elevated access
 * and rely on the calling server action / route to enforce authorization
 * (`isOrganizerOf` before a write); the collection's `tripContentAccess` guards
 * the REST/GraphQL/admin surface. Pass `req` so writes share the caller's
 * transaction.
 */
import type { Payload, PayloadRequest } from "payload";

import type { TripContent } from "@/payload-types";

/** Content payload accepted by {@link upsertTripContent} (the trip is implied). */
export type TripContentData = Partial<Omit<TripContent, "id" | "trip" | "updatedAt" | "createdAt">>;

/** Fetch a trip's content row, or null if the organizer hasn't authored any. */
export async function getTripContent(
  payload: Payload,
  tripId: string,
  req?: PayloadRequest,
): Promise<TripContent | null> {
  const res = await payload.find({
    collection: "trip-content",
    where: { trip: { equals: tripId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  });
  return res.docs[0] ?? null;
}

/**
 * Create or update a trip's single content row. Idempotent on the trip: if a row
 * exists it's updated, otherwise one is created — so the editor never has to
 * know whether content already existed.
 */
export async function upsertTripContent(
  payload: Payload,
  tripId: string,
  data: TripContentData,
  req?: PayloadRequest,
): Promise<TripContent> {
  const existing = await getTripContent(payload, tripId, req);
  if (existing) {
    return payload.update({
      collection: "trip-content",
      id: existing.id,
      data,
      overrideAccess: true,
      req,
    });
  }
  return payload.create({
    collection: "trip-content",
    data: { ...data, trip: tripId },
    overrideAccess: true,
    req,
  });
}

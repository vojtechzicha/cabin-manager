import { beforeAll, describe, expect, it } from "vitest";
import type { Payload } from "payload";

import { createTrip } from "@/services/trips";
import { getTripContent, upsertTripContent } from "@/services/trip-content";
import type { Identity } from "@/payload-types";

import { createTestUser, ensureCollections, getTestPayload } from "./helpers";

let payload: Payload;
let organizer: Identity;

/** Run a request *as* an identity, through the real access functions. */
const asUser = (identity: Identity) => ({
  overrideAccess: false as const,
  user: { ...identity, collection: "identities" as const },
});

beforeAll(async () => {
  payload = await getTestPayload();
  await ensureCollections(payload);
  organizer = (await createTestUser(payload)) as Identity;
}, 120_000);

describe("trip content service (T-203, PRD §8.7)", () => {
  it("upserts idempotently — one row per trip, updated in place", async () => {
    const { trip } = await createTrip(payload, { name: "Info trip", shortName: "Info" }, organizer);
    const tripId = String(trip.id);

    const first = await upsertTripContent(payload, tripId, {
      destination: { name: "Chata Pod Lysou", location: "Beskydy" },
    });
    const second = await upsertTripContent(payload, tripId, {
      destination: { name: "Chata Pod Lysou", location: "Krásná 142 · Beskydy" },
      parking: "4 cars in the yard",
    });

    expect(second.id).toBe(first.id); // updated, not duplicated
    expect(second.destination?.location).toBe("Krásná 142 · Beskydy");
    expect(second.parking).toBe("4 cars in the yard");

    const count = await payload.count({
      collection: "trip-content",
      where: { trip: { equals: tripId } },
      overrideAccess: true,
    });
    expect(count.totalDocs).toBe(1);
  });

  it("returns null when a trip has no content yet", async () => {
    const { trip } = await createTrip(payload, { name: "Empty", shortName: "Emp" }, organizer);
    expect(await getTripContent(payload, String(trip.id))).toBeNull();
  });
});

describe("trip content access control (T-203, PRD §5/§10)", () => {
  it("members read it; non-members are denied; only organizers write", async () => {
    const { trip } = await createTrip(payload, { name: "Access", shortName: "Acc" }, organizer);
    const tripId = String(trip.id);
    await upsertTripContent(payload, tripId, { notes: "House rules" });

    // A participant member of the trip.
    const participant = (await createTestUser(payload)) as Identity;
    await payload.create({
      collection: "memberships",
      overrideAccess: true,
      data: { trip: tripId, identity: participant.id, role: "participant", status: "active" },
    });

    // An outsider with a membership in some *other* trip.
    const outsider = (await createTestUser(payload)) as Identity;

    const asMember = await payload.find({
      collection: "trip-content",
      where: { trip: { equals: tripId } },
      ...asUser(participant),
    });
    expect(asMember.docs).toHaveLength(1);

    const asOutsider = await payload.find({
      collection: "trip-content",
      where: { trip: { equals: tripId } },
      ...asUser(outsider),
    });
    expect(asOutsider.docs).toHaveLength(0);

    // A participant may not author trip content (organizer-only write).
    await expect(
      payload.create({
        collection: "trip-content",
        data: { trip: tripId, notes: "I shouldn't be able to do this" },
        ...asUser(participant),
      }),
    ).rejects.toThrow();
  });
});

import { beforeAll, describe, expect, it } from "vitest";
import type { Payload } from "payload";

import { createTrip } from "@/services/trips";
import type { Identity } from "@/payload-types";

import { createTestUser, ensureCollections, getTestPayload } from "./helpers";

let payload: Payload;

beforeAll(async () => {
  payload = await getTestPayload();
  await ensureCollections(payload);
}, 120_000);

/** Shape an Identity as the `user` the Local API binds to `req.user`. */
function asUser(identity: Identity) {
  return { ...identity, collection: "identities" as const };
}

describe("cross-trip isolation (T-101 / T-106)", () => {
  it("a member sees exactly the trips they belong to, not others'", async () => {
    const alice = (await createTestUser(payload, { name: "Alice" })) as Identity;
    const bob = (await createTestUser(payload, { name: "Bob" })) as Identity;
    const { trip: tripA } = await createTrip(payload, { name: "Alice trip", shortName: "AT" }, alice);
    const { trip: tripB } = await createTrip(payload, { name: "Bob trip", shortName: "BT" }, bob);

    const aliceTrips = await payload.find({
      collection: "trips",
      overrideAccess: false,
      user: asUser(alice),
    });
    const aliceIds = aliceTrips.docs.map((d) => String(d.id));
    expect(aliceIds).toContain(String(tripA.id));
    expect(aliceIds).not.toContain(String(tripB.id));

    const bobTrips = await payload.find({
      collection: "trips",
      overrideAccess: false,
      user: asUser(bob),
    });
    const bobIds = bobTrips.docs.map((d) => String(d.id));
    expect(bobIds).toContain(String(tripB.id));
    expect(bobIds).not.toContain(String(tripA.id));
  });

  it("denies fetching another member's trip by id", async () => {
    const alice = (await createTestUser(payload)) as Identity;
    const bob = (await createTestUser(payload)) as Identity;
    const { trip: tripB } = await createTrip(payload, { name: "Private", shortName: "PV" }, bob);

    await expect(
      payload.findByID({
        collection: "trips",
        id: tripB.id,
        overrideAccess: false,
        user: asUser(alice),
      }),
    ).rejects.toThrow();
  });

  it("an Identity reads only itself (personal data least-privilege)", async () => {
    const alice = (await createTestUser(payload)) as Identity;
    await createTestUser(payload); // another identity exists

    const visible = await payload.find({
      collection: "identities",
      overrideAccess: false,
      user: asUser(alice),
    });
    expect(visible.docs.map((d) => String(d.id))).toEqual([String(alice.id)]);
  });
});

describe("membership field-level protection (T-106)", () => {
  it("a participant cannot escalate their own role but can edit their attendance", async () => {
    const organizer = (await createTestUser(payload)) as Identity;
    const participant = (await createTestUser(payload)) as Identity;
    const { trip } = await createTrip(payload, { name: "Field test", shortName: "FT" }, organizer);

    const membership = await payload.create({
      collection: "memberships",
      overrideAccess: true,
      data: {
        trip: trip.id,
        identity: participant.id,
        role: "participant",
        status: "active",
      },
    });

    const updated = await payload.update({
      collection: "memberships",
      id: membership.id,
      overrideAccess: false,
      user: asUser(participant),
      data: {
        role: "organizer", // privileged field — must be ignored
        attendance: { status: "coming" }, // own data — allowed
      },
    });

    expect(updated.role).toBe("participant");
    expect(updated.attendance?.status).toBe("coming");
  });
});

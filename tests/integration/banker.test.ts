import { beforeAll, describe, expect, it } from "vitest";
import type { Payload } from "payload";

import { createTrip, setBanker } from "@/services/trips";
import type { Identity } from "@/payload-types";

import { createTestUser, ensureCollections, getTestPayload } from "./helpers";

let payload: Payload;
let organizer: Identity;

beforeAll(async () => {
  payload = await getTestPayload();
  await ensureCollections(payload);
  organizer = (await createTestUser(payload)) as Identity;
}, 120_000);

describe("setBanker (T-201/§8.5)", () => {
  it("moves the banker flag to the chosen member and stores their bank details", async () => {
    const { trip, organizerMembership } = await createTrip(
      payload,
      { name: "Banker", shortName: "BK" },
      organizer,
    );
    const tripId = String(trip.id);
    expect(organizerMembership.isBanker).toBe(true); // creator banks by default

    // A second member who will become the banker.
    const other = (await createTestUser(payload)) as Identity;
    const membership = await payload.create({
      collection: "memberships",
      overrideAccess: true,
      data: { trip: tripId, identity: other.id, role: "participant", status: "active" },
    });

    const updated = await setBanker(payload, tripId, {
      membershipId: String(membership.id),
      bankAccount: "19-2000145399/0800",
      iban: "CZ6508000000192000145399",
    });

    // Exactly one banker — the flag moved off the organizer onto the chosen member.
    const newBanker = await payload.findByID({
      collection: "memberships",
      id: membership.id,
      overrideAccess: true,
    });
    const oldBanker = await payload.findByID({
      collection: "memberships",
      id: organizerMembership.id,
      overrideAccess: true,
    });
    expect(newBanker.isBanker).toBe(true);
    expect(oldBanker.isBanker).toBe(false);

    const bankerRef = updated.banker?.membership;
    const bankerId = bankerRef && typeof bankerRef === "object" ? bankerRef.id : bankerRef;
    expect(String(bankerId)).toBe(String(membership.id));
    expect(updated.banker?.iban).toBe("CZ6508000000192000145399");
    expect(updated.banker?.bankAccount).toBe("19-2000145399/0800");
  });
});

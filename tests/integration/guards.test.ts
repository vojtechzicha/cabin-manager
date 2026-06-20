import { beforeAll, describe, expect, it } from "vitest";
import type { Payload } from "payload";

import { addOption, closeDatePoll, moderateOption, publishPoll } from "@/services/polls";
import { createTrip } from "@/services/trips";
import { upsertTripContent } from "@/services/trip-content";
import { createDirectInvite } from "@/services/invitations";
import type { Identity, PollOption } from "@/payload-types";

import { createTestUser, ensureCollections, getTestPayload } from "./helpers";

let payload: Payload;
let organizer: Identity;

beforeAll(async () => {
  payload = await getTestPayload();
  await ensureCollections(payload);
  organizer = (await createTestUser(payload)) as Identity;
}, 120_000);

async function newTrip(name: string): Promise<string> {
  const { trip } = await createTrip(payload, { name, shortName: name.slice(0, 4) }, organizer);
  return String(trip.id);
}

const archive = (tripId: string) =>
  payload.update({ collection: "trips", id: tripId, overrideAccess: true, data: { phase: "archived" } });
const lockRoster = (tripId: string) =>
  payload.update({ collection: "trips", id: tripId, overrideAccess: true, data: { rosterState: "locked" } });

describe("archived trips are read-only (PRD §7)", () => {
  it("rejects content and poll-option writes once archived", async () => {
    const tripId = await newTrip("Arch");
    await upsertTripContent(payload, tripId, { notes: "before" }); // OK while open
    await archive(tripId);

    await expect(upsertTripContent(payload, tripId, { notes: "after" })).rejects.toThrow(/archived/i);
    await expect(addOption(payload, { tripId, kind: "date", dateStart: "2026-06-21", dateEnd: "2026-06-28" })).rejects.toThrow(/archived/i);
  });
});

describe("locked roster is final (PRD §7)", () => {
  it("rejects new members, attendance changes, removals, and invitations", async () => {
    const tripId = await newTrip("Lock");
    const member = await payload.create({
      collection: "memberships",
      overrideAccess: true,
      data: { trip: tripId, displayName: "Existing", role: "participant", status: "active" },
    });
    await lockRoster(tripId);

    // no new members
    await expect(
      payload.create({
        collection: "memberships",
        overrideAccess: true,
        data: { trip: tripId, displayName: "New", role: "participant", status: "active" },
      }),
    ).rejects.toThrow(/locked/i);

    // no attendance changes
    await expect(
      payload.update({
        collection: "memberships",
        id: String(member.id),
        overrideAccess: true,
        data: { attendance: { status: "coming" } },
      }),
    ).rejects.toThrow(/locked/i);

    // no status changes (e.g. activating a pending member)
    const pending = await payload.create({
      collection: "memberships",
      overrideAccess: true,
      context: { bypassLifecycleGuards: true }, // seed a pending row past the create guard
      data: { trip: tripId, displayName: "Pending", role: "participant", status: "pending" },
    });
    await expect(
      payload.update({
        collection: "memberships",
        id: String(pending.id),
        overrideAccess: true,
        data: { status: "active" },
      }),
    ).rejects.toThrow(/locked/i);

    // no removals
    await expect(
      payload.delete({ collection: "memberships", id: String(member.id), overrideAccess: true }),
    ).rejects.toThrow(/locked/i);

    // no new invitations
    await expect(
      createDirectInvite(payload, { tripId, targetType: "email", targetValue: "x@chata.test", displayName: "X" }),
    ).rejects.toThrow(/locked/i);

    // a non-headcount edit (banker flag) is still allowed
    await expect(
      payload.update({ collection: "memberships", id: String(member.id), overrideAccess: true, data: { isBanker: true } }),
    ).resolves.toBeTruthy();
  });
});

describe("a closed poll's options are frozen (§8.2)", () => {
  it("rejects editing, hiding, or deleting options after the poll closes", async () => {
    const tripId = await newTrip("Frozen");
    await payload.create({
      collection: "memberships",
      overrideAccess: true,
      data: { trip: tripId, displayName: "V", role: "participant", status: "active" },
    });
    await publishPoll(payload, tripId, "date");
    const winner = (await addOption(payload, { tripId, kind: "date", dateStart: "2026-06-21", dateEnd: "2026-06-28" })) as PollOption;
    const other = (await addOption(payload, { tripId, kind: "date", dateStart: "2026-07-05", dateEnd: "2026-07-12" })) as PollOption;
    await closeDatePoll(payload, tripId, { actor: organizer.id, winnerOptionId: String(winner.id) });

    // can't moderate (hide) an option of a closed poll
    await expect(moderateOption(payload, String(other.id), "hide")).rejects.toThrow(/closed/i);
    // can't add a new option to a closed poll
    await expect(addOption(payload, { tripId, kind: "date", dateStart: "2026-08-02", dateEnd: "2026-08-09" })).rejects.toThrow(/closed/i);
    // can't delete an option of a closed poll
    await expect(payload.delete({ collection: "poll-options", id: String(other.id), overrideAccess: true })).rejects.toThrow(/closed/i);
  });
});

describe("direct API creation is locked to services (P0)", () => {
  it("denies non-admin/non-service direct creation of trips, polls, and poll options", async () => {
    const tripId = await newTrip("DirectApi");
    // Without overrideAccess (i.e. not the service path) and no admin user, the
    // collection access denies create — only the services (elevated) may.
    await expect(
      payload.create({ collection: "trips", data: { name: "Orphan", shortName: "Orph" }, overrideAccess: false }),
    ).rejects.toThrow();
    await expect(
      payload.create({ collection: "polls", data: { trip: tripId, kind: "date", published: true }, overrideAccess: false }),
    ).rejects.toThrow();
    await expect(
      payload.create({ collection: "poll-options", data: { trip: tripId, poll: tripId, kind: "date", label: "x" }, overrideAccess: false }),
    ).rejects.toThrow();
  });
});

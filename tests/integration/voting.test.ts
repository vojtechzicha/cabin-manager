import { beforeAll, describe, expect, it } from "vitest";
import type { Payload } from "payload";

import {
  addOption,
  castVote,
  closeDatePoll,
  closeLocationPoll,
  getOrCreatePoll,
  listOptions,
  listVotes,
  moderateOption,
  publishPoll,
  rankWindows,
  reopenPoll,
} from "@/services/polls";
import { createTrip } from "@/services/trips";
import type { Identity, Membership, Trip } from "@/payload-types";

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

/** Create N extra active memberships (no identity needed for vote tallies). */
async function addVoters(tripId: string, names: string[]): Promise<Membership[]> {
  const out: Membership[] = [];
  for (const name of names) {
    out.push(
      (await payload.create({
        collection: "memberships",
        overrideAccess: true,
        data: { trip: tripId, displayName: name, role: "participant", status: "active" },
      })) as Membership,
    );
  }
  return out;
}

describe("voting service (T-301/302/305, PRD §8.2)", () => {
  it("seeds options, indexes/orders them, and filters hidden ones", async () => {
    const tripId = await newTrip("Options");
    await addOption(payload, { tripId, kind: "date", dateStart: "2026-06-21", dateEnd: "2026-06-28", order: 1 });
    const hidden = await addOption(payload, { tripId, kind: "date", dateStart: "2026-07-05", dateEnd: "2026-07-12", order: 2 });
    await moderateOption(payload, String(hidden.id), "hide");

    const visible = await listOptions(payload, tripId, "date");
    const all = await listOptions(payload, tripId, "date", { includeHidden: true });
    expect(visible).toHaveLength(1);
    expect(all).toHaveLength(2);
  });

  it("upserts a member's vote and keeps single-choice exclusive", async () => {
    const tripId = await newTrip("Single");
    const [voter] = await addVoters(tripId, ["Klára"]);
    await getOrCreatePoll(payload, tripId, "location");
    // location poll defaults to single-choice
    const prague = await addOption(payload, { tripId, kind: "location", label: "Prague" });
    const brno = await addOption(payload, { tripId, kind: "location", label: "Brno" });
    await publishPoll(payload, tripId, "location"); // votes require a published poll
    const mid = String(voter!.id);

    await castVote(payload, { tripId, kind: "location", membershipId: mid, optionId: String(prague.id), value: "yes" });
    await castVote(payload, { tripId, kind: "location", membershipId: mid, optionId: String(brno.id), value: "yes" });

    const votes = await listVotes(payload, tripId, "location");
    expect(votes).toHaveLength(1); // only the latest single choice remains
    expect(String(votes[0]!.option)).toBe(String(brno.id));

    // re-voting the same option updates in place (no duplicate)
    await castVote(payload, { tripId, kind: "location", membershipId: mid, optionId: String(brno.id), value: "yes" });
    expect(await listVotes(payload, tripId, "location")).toHaveLength(1);
  });

  it("ranks date windows by weighted availability against the active roster", async () => {
    const tripId = await newTrip("Rank");
    const voters = await addVoters(tripId, ["A", "B", "C", "D"]);
    const w1 = await addOption(payload, { tripId, kind: "date", dateStart: "2026-06-21", dateEnd: "2026-06-28", order: 1 });
    const w2 = await addOption(payload, { tripId, kind: "date", dateStart: "2026-08-02", dateEnd: "2026-08-09", order: 2 });
    await publishPoll(payload, tripId, "date"); // votes require a published poll

    // w1: 3 yes + 1 if-needed; w2: 2 yes + 2 no
    const w1vals: ("yes" | "ifneeded" | "no")[] = ["yes", "yes", "yes", "ifneeded"];
    const w2vals: ("yes" | "ifneeded" | "no")[] = ["yes", "yes", "no", "no"];
    for (let i = 0; i < voters.length; i++) {
      await castVote(payload, { tripId, kind: "date", membershipId: String(voters[i]!.id), optionId: String(w1.id), value: w1vals[i]! });
      await castVote(payload, { tripId, kind: "date", membershipId: String(voters[i]!.id), optionId: String(w2.id), value: w2vals[i]! });
    }

    const roster = (await payload.find({ collection: "memberships", overrideAccess: true, where: { trip: { equals: tripId } }, pagination: false, limit: 100 })).docs as Membership[];
    const options = await listOptions(payload, tripId, "date");
    const votes = await listVotes(payload, tripId, "date");
    const ranked = rankWindows(options, votes, roster);

    // w1 (3.5/5 = 70) ranks above w2 (2/5 = 40). Roster has 5 (organizer + 4).
    expect(ranked[0]!.id).toBe(String(w1.id));
    expect(ranked[0]!.attendees).toBe(4);
    expect(ranked[1]!.id).toBe(String(w2.id));
  });

  it("closes the date poll, promotes the winner to trip.dates, and reopens", async () => {
    const tripId = await newTrip("Close");
    await publishPoll(payload, tripId, "date");
    const w = await addOption(payload, { tripId, kind: "date", dateStart: "2026-06-21T00:00:00.000Z", dateEnd: "2026-06-28T00:00:00.000Z" });

    await closeDatePoll(payload, tripId, { actor: organizer.id, winnerOptionId: String(w.id) });

    let trip = (await payload.findByID({ collection: "trips", id: tripId, overrideAccess: true })) as Trip;
    expect(trip.datePollState).toBe("closed");
    expect(trip.dates?.start).toBeTruthy();
    expect(new Date(trip.dates!.start!).toISOString()).toBe("2026-06-21T00:00:00.000Z");
    const poll = await getOrCreatePoll(payload, tripId, "date");
    expect(poll.winnerOption ? String(poll.winnerOption) : null).toBe(String(w.id));

    // Reopen clears the winner and unlocks (lifecycle reversal).
    await reopenPoll(payload, tripId, "date", { actor: organizer.id });
    trip = (await payload.findByID({ collection: "trips", id: tripId, overrideAccess: true })) as Trip;
    expect(trip.datePollState).toBe("open");
    const reopened = await getOrCreatePoll(payload, tripId, "date");
    expect(reopened.winnerOption ?? null).toBeNull();
  });

  it("closes the location poll and promotes the winning label to trip.location", async () => {
    const tripId = await newTrip("Loc");
    await publishPoll(payload, tripId, "location");
    const opt = await addOption(payload, { tripId, kind: "location", label: "Beskydy" });
    await closeLocationPoll(payload, tripId, { actor: organizer.id, winnerOptionId: String(opt.id) });
    const trip = (await payload.findByID({ collection: "trips", id: tripId, overrideAccess: true })) as Trip;
    expect(trip.locationPollState).toBe("closed");
    expect(trip.location).toBe("Beskydy");
  });
});

describe("voting hardening (P0 — data integrity)", () => {
  it("rejects votes on an unpublished poll", async () => {
    const tripId = await newTrip("Unpub");
    const [voter] = await addVoters(tripId, ["V"]);
    const o = await addOption(payload, { tripId, kind: "date", dateStart: "2026-06-21", dateEnd: "2026-06-28" });
    await expect(
      castVote(payload, { tripId, kind: "date", membershipId: String(voter!.id), optionId: String(o.id), value: "yes" }),
    ).rejects.toThrow(/not open for voting/i);
  });

  it("rejects votes on a hidden option and after the poll is closed", async () => {
    const tripId = await newTrip("Locked");
    const [voter] = await addVoters(tripId, ["V"]);
    await publishPoll(payload, tripId, "date");
    const hidden = await addOption(payload, { tripId, kind: "date", dateStart: "2026-06-21", dateEnd: "2026-06-28" });
    await moderateOption(payload, String(hidden.id), "hide");
    await expect(
      castVote(payload, { tripId, kind: "date", membershipId: String(voter!.id), optionId: String(hidden.id), value: "yes" }),
    ).rejects.toThrow(/hidden/i);

    const winner = await addOption(payload, { tripId, kind: "date", dateStart: "2026-07-05", dateEnd: "2026-07-12" });
    await closeDatePoll(payload, tripId, { actor: organizer.id, winnerOptionId: String(winner.id) });
    await expect(
      castVote(payload, { tripId, kind: "date", membershipId: String(voter!.id), optionId: String(winner.id), value: "yes" }),
    ).rejects.toThrow(/closed/i);
  });

  it("rejects closing with a winner from another trip, and is idempotent", async () => {
    const a = await newTrip("TripA");
    const b = await newTrip("TripB");
    await publishPoll(payload, a, "date");
    const optA = await addOption(payload, { tripId: a, kind: "date", dateStart: "2026-06-21", dateEnd: "2026-06-28" });
    const optB = await addOption(payload, { tripId: b, kind: "date", dateStart: "2026-06-21", dateEnd: "2026-06-28" });

    await expect(
      closeDatePoll(payload, a, { actor: organizer.id, winnerOptionId: String(optB.id) }),
    ).rejects.toThrow(/different trip/i);

    await closeDatePoll(payload, a, { actor: organizer.id, winnerOptionId: String(optA.id) });
    // Idempotent: closing again doesn't throw a "same-state" lifecycle error.
    await closeDatePoll(payload, a, { actor: organizer.id, winnerOptionId: String(optA.id) });
    const trip = (await payload.findByID({ collection: "trips", id: a, overrideAccess: true })) as Trip;
    expect(trip.datePollState).toBe("closed");
  });

  it("clears promoted trip dates when a date poll is reopened", async () => {
    const tripId = await newTrip("Reopen");
    await publishPoll(payload, tripId, "date");
    const o = await addOption(payload, { tripId, kind: "date", dateStart: "2026-06-21", dateEnd: "2026-06-28" });
    await closeDatePoll(payload, tripId, { actor: organizer.id, winnerOptionId: String(o.id) });
    await reopenPoll(payload, tripId, "date", { actor: organizer.id });
    const trip = (await payload.findByID({ collection: "trips", id: tripId, overrideAccess: true })) as Trip;
    expect(trip.datePollState).toBe("open");
    expect(trip.dates?.start ?? null).toBeNull();
  });
});

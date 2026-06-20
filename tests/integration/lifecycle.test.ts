import { beforeAll, describe, expect, it } from "vitest";
import type { Payload } from "payload";

import { auditEntriesForTrip, AuditAction } from "@/services/audit";
import {
  LifecycleTransitionError,
  transitionArea,
  transitionPhase,
} from "@/services/lifecycle";
import { createTrip } from "@/services/trips";
import type { Identity } from "@/payload-types";

import { createTestUser, ensureCollections, getTestPayload } from "./helpers";

let payload: Payload;
let organizer: Identity;

beforeAll(async () => {
  payload = await getTestPayload();
  await ensureCollections(payload);
  organizer = (await createTestUser(payload)) as Identity;
}, 120_000);

async function newTrip(name: string) {
  const { trip } = await createTrip(payload, { name, shortName: name.slice(0, 4) }, organizer);
  return String(trip.id);
}

describe("finance ledger lifecycle (T-202, PRD §7)", () => {
  it("blocks settling before a date is chosen, then allows the full Open→Settling→Closed path", async () => {
    const tripId = await newTrip("Ledger path");

    // Date poll still open → settling the money is illogical and rejected.
    await expect(
      transitionArea(payload, tripId, "finance", "settling", { actor: organizer.id }),
    ).rejects.toMatchObject({ reason: "date-not-chosen" });

    await transitionArea(payload, tripId, "datePoll", "closed", { actor: organizer.id });

    const settling = await transitionArea(payload, tripId, "finance", "settling", {
      actor: organizer.id,
    });
    expect(settling.to).toBe("settling");
    expect(settling.reversal).toBe(false);
    expect(settling.trip.financeState).toBe("settling");

    const closed = await transitionArea(payload, tripId, "finance", "closed", {
      actor: organizer.id,
    });
    expect(closed.trip.financeState).toBe("closed");
  });

  it("never closes accounts without settling first", async () => {
    const tripId = await newTrip("No skip");
    await transitionArea(payload, tripId, "datePoll", "closed", { actor: organizer.id });
    await expect(
      transitionArea(payload, tripId, "finance", "closed", { actor: organizer.id }),
    ).rejects.toBeInstanceOf(LifecycleTransitionError);
    await expect(
      transitionArea(payload, tripId, "finance", "closed", { actor: organizer.id }),
    ).rejects.toMatchObject({ reason: "skips-settling" });
  });

  it("records dedicated audit entries for closing and re-opening accounts", async () => {
    const tripId = await newTrip("Audited close");
    await transitionArea(payload, tripId, "datePoll", "closed", { actor: organizer.id });
    await transitionArea(payload, tripId, "finance", "settling", { actor: organizer.id });
    await transitionArea(payload, tripId, "finance", "closed", { actor: organizer.id });

    // Re-opening a Closed ledger is an explicit, logged reversal.
    const reopened = await transitionArea(payload, tripId, "finance", "open", {
      actor: organizer.id,
    });
    expect(reopened.reversal).toBe(true);
    expect(reopened.trip.financeState).toBe("open");

    const entries = await auditEntriesForTrip(payload, tripId);
    const actions = entries.map((e) => e.action);
    expect(actions).toContain(AuditAction.FinanceAccountsClosed);
    expect(actions).toContain(AuditAction.FinanceAccountsReopened);
  });
});

describe("phase transitions (T-202)", () => {
  it("advances forward and records a lifecycle audit entry", async () => {
    const tripId = await newTrip("Phase fwd");
    const out = await transitionPhase(payload, tripId, "ideation", { actor: organizer.id });
    expect(out.from).toBe("draft");
    expect(out.to).toBe("ideation");
    expect(out.trip.phase).toBe("ideation");

    const entries = await auditEntriesForTrip(payload, tripId);
    expect(entries.some((e) => e.action === AuditAction.LifecycleTransition)).toBe(true);
  });

  it("rejects jumping backward more than one phase", async () => {
    const tripId = await newTrip("Phase back");
    await transitionPhase(payload, tripId, "finances", { actor: organizer.id });
    await expect(
      transitionPhase(payload, tripId, "ideation", { actor: organizer.id }),
    ).rejects.toMatchObject({ reason: "illegal-transition" });
  });

  it("allows a single-step reversal flagged for audit", async () => {
    const tripId = await newTrip("Phase rev");
    await transitionPhase(payload, tripId, "planning", { actor: organizer.id });
    const back = await transitionPhase(payload, tripId, "ideation", { actor: organizer.id });
    expect(back.reversal).toBe(true);
  });
});

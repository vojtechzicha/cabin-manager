import { beforeAll, describe, expect, it } from "vitest";

import { AuditAction, auditEntriesForTrip, recordAudit } from "@/services/audit";
import { createTestUser, ensureCollections, getTestPayload } from "./helpers";
import type { Payload } from "payload";

let payload: Payload;

beforeAll(async () => {
  payload = await getTestPayload();
  await ensureCollections(payload);
}, 120_000);

describe("persistence + transactions (T-001)", () => {
  it("round-trips a document to Mongo", async () => {
    const created = await payload.create({
      collection: "health-checks",
      data: { note: "integration round-trip", ok: true },
    });
    const found = await payload.findByID({ collection: "health-checks", id: created.id });
    expect(found.note).toBe("integration round-trip");
  });

  it("has multi-document transactions available (replica set)", async () => {
    const txID = await payload.db.beginTransaction();
    expect(txID).not.toBeNull();
    if (txID !== null && txID !== undefined) {
      await payload.db.rollbackTransaction(txID);
    }
  });
});

describe("audit log is append-only and queryable by trip (T-005)", () => {
  it("records sensitive actions and forbids mutation", async () => {
    const trip = `int-trip-${Date.now()}`;

    await recordAudit(payload, {
      action: AuditAction.DepositConfirmed,
      targetType: "membership",
      targetId: "m1",
      trip,
      metadata: { amount: 150000 },
    });
    const expense = await recordAudit(payload, {
      action: AuditAction.FinanceExpenseEdited,
      targetType: "expense",
      targetId: "e1",
      trip,
    });

    const entries = await auditEntriesForTrip(payload, trip);
    expect(entries).toHaveLength(2);
    expect(entries.every((e) => typeof e.createdAt === "string")).toBe(true);

    await expect(
      payload.update({ collection: "audit-entries", id: expense.id, data: { action: "tampered" } }),
    ).rejects.toThrow();
    await expect(
      payload.delete({ collection: "audit-entries", id: expense.id }),
    ).rejects.toThrow();

    expect(await auditEntriesForTrip(payload, trip)).toHaveLength(2);
  });
});

describe("access control (T-002 / T-005)", () => {
  it("denies creating audit entries without overrideAccess", async () => {
    await expect(
      payload.create({
        collection: "audit-entries",
        overrideAccess: false,
        data: { action: "x", targetType: "t", targetId: "1" },
      }),
    ).rejects.toThrow();
  });

  it("creates accounts through the test helper", async () => {
    const admin = await createTestUser(payload, { role: "admin" });
    expect(admin.role).toBe("admin");
    expect(admin.email).toContain("@chata.test");
  });
});

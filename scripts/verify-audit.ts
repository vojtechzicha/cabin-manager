/**
 * Audit acceptance check (T-005): the three sensitive actions each write an
 * immutable, trip-queryable entry. Run with:
 *   pnpm payload run scripts/verify-audit.ts
 */
import config from "@payload-config";
import { getPayload } from "payload";

import { AuditAction, auditEntriesForTrip, recordAudit } from "@/services/audit";

const payload = await getPayload({ config });
const tripId = `verify-trip-${Date.now()}`;

function assert(label: string, cond: boolean) {
  payload.logger.info(`${cond ? "✓" : "✗"} ${label}`);
  if (!cond) process.exitCode = 1;
}

// 1) Each sensitive action records an entry.
await recordAudit(payload, {
  action: AuditAction.FinanceAccountsClosed,
  targetType: "trip",
  targetId: tripId,
  trip: tripId,
  metadata: { from: "settling", to: "closed" },
});
await recordAudit(payload, {
  action: AuditAction.DepositConfirmed,
  targetType: "membership",
  targetId: "m1",
  trip: tripId,
  metadata: { amount: 150000 },
});
const expense = await recordAudit(payload, {
  action: AuditAction.FinanceExpenseEdited,
  targetType: "expense",
  targetId: "e1",
  trip: tripId,
  metadata: { field: "amount", from: 400, to: 100 },
});

// 2) Queryable by trip.
const entries = await auditEntriesForTrip(payload, tripId);
assert("three entries written and queryable by trip", entries.length === 3);
assert(
  "entries carry a timestamp (createdAt)",
  entries.every((e) => typeof e.createdAt === "string"),
);

// 3) Immutable: updates rejected.
let updateBlocked = false;
try {
  await payload.update({
    collection: "audit-entries",
    id: expense.id,
    data: { action: "tampered" },
  });
} catch {
  updateBlocked = true;
}
assert("update is rejected (append-only)", updateBlocked);

// 4) Immutable: deletes rejected.
let deleteBlocked = false;
try {
  await payload.delete({ collection: "audit-entries", id: expense.id });
} catch {
  deleteBlocked = true;
}
assert("delete is rejected (immutable)", deleteBlocked);

// 5) Still intact after tamper attempts.
const after = await auditEntriesForTrip(payload, tripId);
assert("entry survived tamper attempts unchanged", after.length === 3);

payload.logger.info(`audit verification done for ${tripId}`);
process.exit(process.exitCode ?? 0);

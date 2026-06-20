/**
 * Idempotent development seed. Re-runnable: it checks for existing data before
 * creating. Run with:  pnpm seed
 *
 * Epic 0 seeds the foundation that exists today — a platform admin (so you can
 * log into /admin), a health-check row, and a sample audit trail. Later epics
 * extend this with a full demo trip (participants, expenses, rooms, cars,
 * polls) as those collections land (T-101+); the extension points are marked
 * below.
 */
import config from "@payload-config";
import { getPayload } from "payload";

import { AuditAction, auditEntriesForTrip, recordAudit } from "@/services/audit";

const ADMIN_EMAIL = "admin@chata.test";
const ADMIN_PASSWORD = "chata-admin-123";
const DEMO_TRIP = "demo-trip";

const payload = await getPayload({ config });

// 1) Platform admin -----------------------------------------------------------
const existingAdmin = await payload.find({
  collection: "users",
  where: { email: { equals: ADMIN_EMAIL } },
  limit: 1,
});

let adminId: string;
if (existingAdmin.docs[0]) {
  adminId = String(existingAdmin.docs[0].id);
  payload.logger.info(`admin already present: ${ADMIN_EMAIL}`);
} else {
  const admin = await payload.create({
    collection: "users",
    data: {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      name: "Platform Admin",
      role: "admin",
    },
  });
  adminId = String(admin.id);
  payload.logger.info(`created admin ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

// 2) Health check row ---------------------------------------------------------
const existingHealth = await payload.count({ collection: "health-checks" });
if (existingHealth.totalDocs === 0) {
  await payload.create({ collection: "health-checks", data: { note: "seed", ok: true } });
  payload.logger.info("created health-check row");
}

// 3) Sample audit trail -------------------------------------------------------
const existingAudit = await auditEntriesForTrip(payload, DEMO_TRIP);
if (existingAudit.length === 0) {
  await recordAudit(payload, {
    actor: adminId,
    action: AuditAction.LifecycleTransition,
    targetType: "trip",
    targetId: DEMO_TRIP,
    trip: DEMO_TRIP,
    metadata: { from: "draft", to: "ideation" },
  });
  await recordAudit(payload, {
    actor: adminId,
    action: AuditAction.DepositConfirmed,
    targetType: "membership",
    targetId: "demo-member-1",
    trip: DEMO_TRIP,
    metadata: { amount: 150000 },
  });
  payload.logger.info(`seeded ${2} audit entries for ${DEMO_TRIP}`);
}

// 4) Demo trip (participants, expenses, rooms, cars, polls) --------------------
//    TODO(T-101+): create a Trip + Memberships + Polls + Expenses + Prepayments
//    + Rooms/Beds + Cars here once those collections exist, producing a fully
//    navigable demo trip.

payload.logger.info("seed complete");
process.exit(0);

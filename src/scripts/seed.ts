/**
 * Idempotent development seed. Re-runnable: it checks for existing data before
 * creating. Run with:  pnpm seed
 *
 * Epic 0 seeded the foundation (a platform admin, a health row, a sample audit
 * trail). Epic 1 extends it into a real demo trip: an organizer Identity, the
 * trip itself, and a pending direct invite — enough to navigate the identity,
 * membership, and invitation model. Later epics add polls/expenses/rooms/cars.
 */
import config from "@payload-config";
import { getPayload } from "payload";

import { AuditAction, auditEntriesForTrip, recordAudit } from "@/services/audit";
import { ensureIdentity } from "@/services/identity";
import { createTrip } from "@/services/trips";
import { createDirectInvite } from "@/services/invitations";

const ADMIN_EMAIL = "admin@chata.test";
const ADMIN_PASSWORD = "chata-admin-123";
const ORGANIZER_EMAIL = "organizer@chata.test";
const INVITEE_EMAIL = "petr@chata.test";
const DEMO_TRIP = "demo-trip";

const payload = await getPayload({ config });

// 0) Warm up namespaces -------------------------------------------------------
//    On a fresh DB the first *transactional* write to a brand-new collection
//    races with creating its namespace (build-note §6). Create each namespace
//    with a throwaway non-transactional write first so the seed's real writes
//    don't hit a WriteConflict.
type WarmupDb = {
  listCollections(): { toArray(): Promise<{ name: string }[]> };
  collection(name: string): {
    insertOne(doc: object): Promise<unknown>;
    deleteMany(filter: object): Promise<unknown>;
  };
  admin(): { command(cmd: object): Promise<unknown> };
};
const warmupDb = (payload.db as unknown as { connection: { db: WarmupDb } }).connection.db;
// Give transactions room to acquire catalog/index locks while a fresh
// collection's namespace settles (default is 5ms, which flakes — same fix the
// integration harness applies, build-note §6).
await warmupDb
  .admin()
  .command({ setParameter: 1, maxTransactionLockRequestTimeoutMillis: 5000 })
  .catch(() => undefined);
const existingNamespaces = new Set(
  (await warmupDb.listCollections().toArray()).map((c) => c.name),
);
for (const slug of [
  "identities",
  "trips",
  "memberships",
  "invitations",
  "login-tokens",
  "health-checks",
  "audit-entries",
]) {
  if (!existingNamespaces.has(slug)) {
    await warmupDb.collection(slug).insertOne({ __warmup: true });
    await warmupDb.collection(slug).deleteMany({ __warmup: true });
  }
}

// 1) Platform admin -----------------------------------------------------------
const existingAdmin = await payload.find({
  collection: "identities",
  where: { email: { equals: ADMIN_EMAIL } },
  limit: 1,
});

let adminId: string;
if (existingAdmin.docs[0]) {
  adminId = String(existingAdmin.docs[0].id);
  payload.logger.info(`admin already present: ${ADMIN_EMAIL}`);
} else {
  const admin = await payload.create({
    collection: "identities",
    data: {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      displayName: "Platform Admin",
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
  payload.logger.info(`seeded audit entries for ${DEMO_TRIP}`);
}

// 4) Demo trip: organizer Identity + trip + a pending direct invite -----------
const existingTrip = await payload.find({
  collection: "trips",
  where: { shortName: { equals: "Demo" } },
  limit: 1,
});

if (existingTrip.docs.length === 0) {
  const { identity: organizer } = await ensureIdentity(payload, {
    email: ORGANIZER_EMAIL,
    displayName: "Demo Organizer",
  });

  const { trip } = await createTrip(
    payload,
    {
      name: "Demo Chata",
      shortName: "Demo",
      location: "Krkonoše",
      description: "A sample trip seeded for development.",
      themeColor: "#3b82f6",
    },
    organizer,
  );

  const invite = await createDirectInvite(payload, {
    tripId: String(trip.id),
    targetType: "email",
    targetValue: INVITEE_EMAIL,
    displayName: "Petr (invited)",
  });

  payload.logger.info(`created demo trip "${trip.name}" organized by ${ORGANIZER_EMAIL}`);
  payload.logger.info(`pending invite for ${INVITEE_EMAIL}: ${invite.url}`);
} else {
  payload.logger.info("demo trip already present");
}

payload.logger.info("seed complete");
process.exit(0);

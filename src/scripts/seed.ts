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
import { addOption, castVote, publishPoll, setPollMethod, type AvailabilityValue } from "@/services/polls";
import { upsertTripContent } from "@/services/trip-content";

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
  "trip-content",
  "memberships",
  "invitations",
  "polls",
  "poll-options",
  "votes",
  "login-tokens",
  "health-checks",
  "audit-entries",
  "media",
  "media.files",
  "media.chunks",
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

  await upsertTripContent(payload, String(trip.id), {
    destination: {
      name: "Chata Pod Lysou",
      location: "Krásná 142 · Beskydy",
      mapUrl: "https://maps.example/chata-pod-lysou",
      description: "A timber cabin under Lysá hora — sauna, big kitchen, sleeps eleven.",
      basicInfo: [
        { label: "Check-in", value: "15:00 Thu" },
        { label: "Wi-Fi", value: "Yes · 50 Mb" },
        { label: "Sleeps", value: "11 people" },
        { label: "Nightly", value: "4 200 Kč" },
      ],
      goodToKnow: [
        { text: "Firewood & sauna included" },
        { text: "Bring indoor slippers" },
        { text: "No pets · quiet after 22:00" },
      ],
    },
    directions: [
      { origin: "Brno", duration: "2 h 10 min", distance: "180 km", notes: "D1 → Frýdek-Místek → Krásná." },
    ],
    parking: "Free parking for 4 cars in the yard.",
    publicTransport: [
      { line: "R 18 Beskydy", from: "Praha", to: "Frýdlant n. O.", departs: "08:11", arrives: "12:34" },
    ],
    notes: "Trash goes out Sunday morning. Leave the cabin as you found it.",
  });

  // Sample voting data (Epic 3): a published grid date poll + a location poll,
  // a handful of extra voters, and votes so the optimal panel has something to
  // rank.
  const tripId = String(trip.id);
  const voterNames = ["Klára", "Adam", "Jana", "Martin"];
  const voters: string[] = [];
  for (const displayName of voterNames) {
    const mem = await payload.create({
      collection: "memberships",
      overrideAccess: true,
      data: { trip: tripId, displayName, role: "participant", status: "active" },
    });
    voters.push(String(mem.id));
  }

  await setPollMethod(payload, tripId, "date", "grid");
  const windows: [string, string][] = [
    ["2026-06-21", "2026-06-28"],
    ["2026-06-28", "2026-07-05"],
    ["2026-07-05", "2026-07-12"],
  ];
  const dateOpts = [];
  for (let i = 0; i < windows.length; i++) {
    dateOpts.push(
      await addOption(payload, { tripId, kind: "date", dateStart: windows[i]![0], dateEnd: windows[i]![1], order: i }),
    );
  }
  await publishPoll(payload, tripId, "date");
  // rows are per-voter availability across the three windows
  const grid: AvailabilityValue[][] = [
    ["yes", "yes", "ifneeded"],
    ["yes", "no", "yes"],
    ["ifneeded", "no", "no"],
    ["yes", "yes", "yes"],
  ];
  for (let v = 0; v < voters.length; v++) {
    for (let w = 0; w < dateOpts.length; w++) {
      await castVote(payload, { tripId, kind: "date", membershipId: voters[v]!, optionId: String(dateOpts[w]!.id), value: grid[v]![w]! });
    }
  }

  const places = ["Beskydy", "Krkonoše"];
  const locOpts = [];
  for (const label of places) locOpts.push(await addOption(payload, { tripId, kind: "location", label }));
  await publishPoll(payload, tripId, "location");
  await castVote(payload, { tripId, kind: "location", membershipId: voters[0]!, optionId: String(locOpts[0]!.id), value: "yes" });
  await castVote(payload, { tripId, kind: "location", membershipId: voters[1]!, optionId: String(locOpts[0]!.id), value: "yes" });
  await castVote(payload, { tripId, kind: "location", membershipId: voters[2]!, optionId: String(locOpts[1]!.id), value: "yes" });

  payload.logger.info(`created demo trip "${trip.name}" organized by ${ORGANIZER_EMAIL}`);
  payload.logger.info(`seeded voting: ${dateOpts.length} date windows, ${locOpts.length} places, ${voters.length} voters`);
  payload.logger.info(`pending invite for ${INVITEE_EMAIL}: ${invite.url}`);
} else {
  payload.logger.info("demo trip already present");
}

payload.logger.info("seed complete");
process.exit(0);

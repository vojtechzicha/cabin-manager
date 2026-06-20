/**
 * Development seed. Run with:  pnpm seed
 *
 * The foundation (platform admin, health row, sample audit) is created once and
 * left in place. The **demo trips are reseed-able**: every run WIPES the
 * previously-seeded trips (matched by short name) and their dependent rows —
 * memberships, polls, options, votes, invitations, content — then rebuilds a
 * fresh showcase covering every lifecycle/voting state with varying participant
 * counts, so the whole UI can be visually exercised. Trips you create by hand
 * are never touched. See the `SPECS` array below.
 *
 * Log in (magic link → printed to this console) as the **organizer**
 * (organizer@chata.test — member of every demo trip) or the **participant**
 * (petr@chata.test — a non-organizer member of a couple) to test both views.
 */
import config from "@payload-config";
import { getPayload } from "payload";

import { AuditAction, auditEntriesForTrip, recordAudit } from "@/services/audit";
import { ensureIdentity } from "@/services/identity";
import { createTrip, updateTripConfig } from "@/services/trips";
import { createDirectInvite } from "@/services/invitations";
import {
  addOption,
  castVote,
  closeDatePoll,
  closeLocationPoll,
  publishPoll,
  setPollMethod,
  type AvailabilityValue,
  type PollMethod,
} from "@/services/polls";
import { upsertTripContent } from "@/services/trip-content";
import type { Trip } from "@/payload-types";

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

// 4) Demo trips ---------------------------------------------------------------
//    A reseed-able showcase: one trip per lifecycle/voting state, with varying
//    participant counts, so every screen can be visually exercised. Re-running
//    `pnpm seed` WIPES the previously-seeded trips (by short name) and their
//    dependent rows, then rebuilds — so you can iterate on this data freely.
//    Log in as the organizer (sees all trips) or the participant (a member of a
//    couple) via magic link; the link prints to this console.

const { identity: organizer } = await ensureIdentity(payload, {
  email: ORGANIZER_EMAIL,
  displayName: "Tomáš Zicha",
});
const { identity: participant } = await ensureIdentity(payload, {
  email: INVITEE_EMAIL,
  displayName: "Petr Novák",
});
const petrId = String(participant.id);

type TripContent = Parameters<typeof upsertTripContent>[2];

interface TripSpec {
  name: string;
  shortName: string;
  location: string;
  description?: string;
  color: string;
  areas: Partial<NonNullable<Trip["enabledAreas"]>>;
  /** Extra active participants beyond the organizer (display-name only). */
  participants?: number;
  /** Seat the real participant identity (so you can log in as a non-organizer). */
  includePetr?: boolean;
  content?: TripContent;
  date?: { method: PollMethod; windows: [string, string][]; publish: boolean; vote: boolean; close: number | null };
  locationPoll?: { options: string[]; publish: boolean; vote: boolean; close: number | null };
  phase: NonNullable<Trip["phase"]>;
  rosterState?: NonNullable<Trip["rosterState"]>;
  financeState?: NonNullable<Trip["financeState"]>;
  /** Seed one pending direct invite (for the organizer's approval/people view). */
  pendingInvite?: string;
}

const SEED_SHORT_NAMES = ["Cabin", "LA28", "Baltic", "NYE", "Tatry", "Croatia", "Demo"];
const NAME_POOL = [
  "Klára Veselá", "Adam Müller", "Jana Dvořáková", "Martin Veverka", "Eva Horáková",
  "Tomáš Král", "Lucie Marková", "Marek Beneš", "Bára Němcová", "Honza Pokorný",
  "Nikola Urbanová", "Pavel Sýkora",
];
// Per-voter availability for windows after the first (window 0 is biased to Yes
// so there's a clear winner). Rotated by (voter + window) for a varied heatmap.
const DATE_PATTERN: AvailabilityValue[] = ["yes", "ifneeded", "no", "yes", "ifneeded", "yes"];

/** Reset previously-seeded trips and their dependent rows (idempotent reseed). */
async function resetSeededTrips(): Promise<number> {
  const stale = await payload.find({
    collection: "trips",
    where: { shortName: { in: SEED_SHORT_NAMES } },
    limit: 200,
    depth: 0,
    overrideAccess: true,
  });
  // Bypass the archived/roster-lock write guards — a reset legitimately wipes
  // trips in any lifecycle state.
  const ctx = { bypassLifecycleGuards: true };
  for (const t of stale.docs) {
    const tid = String(t.id);
    for (const slug of ["votes", "poll-options", "polls", "memberships", "invitations", "trip-content"] as const) {
      await payload.delete({ collection: slug, where: { trip: { equals: tid } }, overrideAccess: true, context: ctx });
    }
    await payload.delete({ collection: "trips", id: tid, overrideAccess: true, context: ctx });
  }
  return stale.docs.length;
}

async function addVoters(tripId: string, count: number, withPetr: boolean): Promise<string[]> {
  const ids: string[] = [];
  if (withPetr) {
    const mem = await payload.create({
      collection: "memberships",
      overrideAccess: true,
      data: { trip: tripId, identity: petrId, role: "participant", status: "active", displayName: "Petr Novák" },
    });
    ids.push(String(mem.id));
  }
  for (let i = 0; i < count; i++) {
    const mem = await payload.create({
      collection: "memberships",
      overrideAccess: true,
      data: { trip: tripId, displayName: NAME_POOL[i % NAME_POOL.length], role: "participant", status: "active" },
    });
    ids.push(String(mem.id));
  }
  return ids;
}

async function seedTrip(spec: TripSpec): Promise<string> {
  const { trip, organizerMembership } = await createTrip(
    payload,
    { name: spec.name, shortName: spec.shortName, location: spec.location, description: spec.description, themeColor: spec.color },
    organizer,
  );
  const tripId = String(trip.id);
  await updateTripConfig(payload, tripId, { enabledAreas: spec.areas });
  if (spec.content) await upsertTripContent(payload, tripId, spec.content);

  // organizer is an active member too, and votes
  const voterIds = [String(organizerMembership.id), ...(await addVoters(tripId, spec.participants ?? 0, !!spec.includePetr))];

  if (spec.date) {
    await setPollMethod(payload, tripId, "date", spec.date.method);
    const optIds: string[] = [];
    for (let i = 0; i < spec.date.windows.length; i++) {
      const o = await addOption(payload, { tripId, kind: "date", dateStart: spec.date.windows[i]![0], dateEnd: spec.date.windows[i]![1], order: i });
      optIds.push(String(o.id));
    }
    if (spec.date.publish) await publishPoll(payload, tripId, "date");
    if (spec.date.vote) {
      for (let v = 0; v < voterIds.length; v++) {
        for (let w = 0; w < optIds.length; w++) {
          const value: AvailabilityValue = w === 0 ? (v % 6 === 5 ? "ifneeded" : "yes") : DATE_PATTERN[(v + w) % DATE_PATTERN.length]!;
          await castVote(payload, { tripId, kind: "date", membershipId: voterIds[v]!, optionId: optIds[w]!, value });
        }
      }
    }
    if (spec.date.close != null) {
      await closeDatePoll(payload, tripId, { actor: organizer.id, winnerOptionId: optIds[spec.date.close]! });
    }
  }

  if (spec.locationPoll) {
    const optIds: string[] = [];
    for (const label of spec.locationPoll.options) {
      const o = await addOption(payload, { tripId, kind: "location", label });
      optIds.push(String(o.id));
    }
    if (spec.locationPoll.publish) await publishPoll(payload, tripId, "location");
    if (spec.locationPoll.vote) {
      for (let v = 0; v < voterIds.length; v++) {
        await castVote(payload, { tripId, kind: "location", membershipId: voterIds[v]!, optionId: optIds[v % optIds.length]!, value: "yes" });
      }
    }
    if (spec.locationPoll.close != null) {
      await closeLocationPoll(payload, tripId, { actor: organizer.id, winnerOptionId: optIds[spec.locationPoll.close]! });
    }
  }

  if (spec.pendingInvite) {
    await createDirectInvite(payload, { tripId, targetType: "email", targetValue: spec.pendingInvite, displayName: "Eva (invited)" });
  }

  // Fabricate the lifecycle state directly (the seed is trusted; this skips the
  // organizer's manual phase progression).
  const stateData: Partial<Trip> = { phase: spec.phase };
  if (spec.rosterState) stateData.rosterState = spec.rosterState;
  if (spec.financeState) stateData.financeState = spec.financeState;
  await payload.update({ collection: "trips", id: tripId, overrideAccess: true, data: stateData });

  payload.logger.info(`seeded "${spec.name}" [${spec.phase}] · ${voterIds.length} active`);
  return tripId;
}

const cabinContent: TripContent = {
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
  directions: [{ origin: "Brno", duration: "2 h 10 min", distance: "180 km", notes: "D1 → Frýdek-Místek → Krásná." }],
  parking: "Free parking for 4 cars in the yard.",
  publicTransport: [{ line: "R 18 Beskydy", from: "Praha", to: "Frýdlant n. O.", departs: "08:11", arrives: "12:34" }],
  notes: "Trash goes out Sunday morning. Leave the cabin as you found it.",
};

const SPECS: TripSpec[] = [
  // Ideation · grid voting open · 8 active · participant + a pending invite
  {
    name: "Beskydy Letní Chata", shortName: "Cabin", location: "Beskydy · CZ", color: "#2f9e73",
    description: "Letní víkend na chatě pod Lysou horou.",
    areas: { voting: true, sleeping: true, lists: true, finances: true },
    participants: 6, includePetr: true, content: cabinContent, pendingInvite: "eva@chata.test",
    date: { method: "grid", windows: [["2026-08-14", "2026-08-17"], ["2026-08-21", "2026-08-24"], ["2026-08-28", "2026-08-31"], ["2026-09-04", "2026-09-07"]], publish: true, vote: true, close: null },
    locationPoll: { options: ["Chata pod Lysou", "Chata Visalaje"], publish: true, vote: true, close: null },
    phase: "ideation",
  },
  // Planning · date locked, location voting open · approval · 6 active
  {
    name: "Cesta na LA 2028", shortName: "LA28", location: "Los Angeles · USA", color: "#3a5bff",
    areas: { voting: true, finances: true, deposit: true }, participants: 5,
    date: { method: "approval", windows: [["2028-07-14", "2028-07-22"], ["2028-07-21", "2028-07-29"]], publish: true, vote: true, close: 0 },
    locationPoll: { options: ["Venice Beach Airbnb", "Downtown hotel", "Santa Monica"], publish: true, vote: true, close: null },
    phase: "planning", rosterState: "locked",
  },
  // Planning · both polls closed · big roster (11 active)
  {
    name: "Na kole k Baltu", shortName: "Baltic", location: "Gdańsk → Hel · PL", color: "#f0653c",
    areas: { voting: true, sleeping: true, lists: true, finances: true, deposit: true }, participants: 10,
    date: { method: "approval", windows: [["2026-06-21", "2026-06-28"], ["2026-06-28", "2026-07-05"]], publish: true, vote: true, close: 0 },
    locationPoll: { options: ["Gdańsk", "Świnoujście"], publish: true, vote: true, close: 0 },
    phase: "planning", rosterState: "locked",
  },
  // Draft · voting set up but not opened · organizer only
  {
    name: "Silvestr v Praze", shortName: "NYE", location: "Praha · CZ", color: "#c23f6a",
    areas: { voting: true, finances: true }, participants: 0,
    date: { method: "grid", windows: [["2026-12-30", "2027-01-02"], ["2026-12-31", "2027-01-01"]], publish: false, vote: false, close: null },
    phase: "draft",
  },
  // Archived · read-only past trip · participant is a member · 5 active
  {
    name: "Tatry 2024", shortName: "Tatry", location: "Vysoké Tatry · SK", color: "#1f33b0",
    areas: { voting: true, finances: true }, participants: 4, includePetr: true,
    date: { method: "approval", windows: [["2024-09-12", "2024-09-15"]], publish: true, vote: true, close: 0 },
    phase: "archived", rosterState: "locked", financeState: "closed",
  },
  // Finances · settling · 7 active
  {
    name: "Plavba Chorvatsko", shortName: "Croatia", location: "Split · HR", color: "#2b6f8f",
    areas: { sleeping: true, finances: true, deposit: true }, participants: 6,
    date: { method: "approval", windows: [["2026-05-23", "2026-05-30"]], publish: true, vote: true, close: 0 },
    phase: "finances", rosterState: "locked", financeState: "settling",
  },
];

const removed = await resetSeededTrips();
payload.logger.info(`reset ${removed} previously-seeded trip(s)`);
for (const spec of SPECS) await seedTrip(spec);
payload.logger.info(`seeded ${SPECS.length} demo trips (organizer ${ORGANIZER_EMAIL}, participant ${INVITEE_EMAIL})`);

payload.logger.info("seed complete");
process.exit(0);

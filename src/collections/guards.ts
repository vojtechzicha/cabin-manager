/**
 * Data-layer write guards for the lifecycle rules that aren't a single field
 * (PRD §7): an **Archived** trip is read-only, a **Locked** roster is final, and
 * a **Closed** poll's options are frozen. These run as collection hooks so they
 * hold for every write path — server actions, REST, and GraphQL alike.
 *
 * A trusted caller (the seed reset, which deletes whole trips in any state) opts
 * out with `context: { bypassLifecycleGuards: true }`.
 */
import type {
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  CollectionSlug,
  PayloadRequest,
} from "payload";

const idOf = (v: unknown): string | null =>
  v && typeof v === "object" ? String((v as { id: unknown }).id) : v != null ? String(v) : null;

function bypassGuards(req: PayloadRequest): boolean {
  return Boolean((req.context as { bypassLifecycleGuards?: boolean } | undefined)?.bypassLifecycleGuards);
}

interface TripFlags {
  phase?: string | null;
  rosterState?: string | null;
  datePollState?: string | null;
  locationPollState?: string | null;
}

async function tripFlags(req: PayloadRequest, tripId: string | null): Promise<TripFlags | null> {
  if (!tripId) return null;
  try {
    const t = await req.payload.findByID({ collection: "trips", id: tripId, overrideAccess: true, depth: 0 });
    return {
      phase: t.phase,
      rosterState: t.rosterState,
      datePollState: t.datePollState,
      locationPollState: t.locationPollState,
    };
  } catch {
    return null;
  }
}

const tripIdOf = (data: unknown, originalDoc: unknown): string | null =>
  idOf((data as { trip?: unknown }).trip ?? (originalDoc as { trip?: unknown } | undefined)?.trip);

// ── Archived: trip-scoped data is read-only ─────────────────────────────────

/** Reject create/update of any trip-scoped doc whose trip is Archived. */
export const rejectIfArchived: CollectionBeforeChangeHook = async ({ req, data, originalDoc }) => {
  if (bypassGuards(req)) return data;
  const state = await tripFlags(req, tripIdOf(data, originalDoc));
  if (state?.phase === "archived") {
    throw new Error("This trip is archived and can no longer be changed.");
  }
  return data;
};

/** Reject deleting a trip-scoped doc whose trip is Archived (factory by slug). */
export function rejectDeleteWhenArchived(collection: CollectionSlug): CollectionBeforeDeleteHook {
  return async ({ req, id }) => {
    if (bypassGuards(req)) return;
    const doc = await req.payload.findByID({ collection, id, overrideAccess: true, depth: 0 }).catch(() => null);
    if (!doc) return;
    const state = await tripFlags(req, idOf((doc as { trip?: unknown }).trip));
    if (state?.phase === "archived") {
      throw new Error("This trip is archived — its data can't be deleted.");
    }
  };
}

/** Reject editing or deleting the **Trip itself** while Archived — except the
 * transition that un-archives it (changing `phase` away from "archived"). */
export const rejectArchivedTripWrite: CollectionBeforeChangeHook = async ({ req, data, operation, originalDoc }) => {
  if (bypassGuards(req) || operation !== "update") return data;
  if (originalDoc?.phase !== "archived") return data;
  const nextPhase = (data as { phase?: unknown }).phase;
  if (nextPhase && nextPhase !== "archived") return data; // un-archiving is allowed
  throw new Error("This trip is archived — un-archive it before making changes.");
};

export const rejectArchivedTripDelete: CollectionBeforeDeleteHook = async ({ req, id }) => {
  if (bypassGuards(req)) return;
  const t = await req.payload.findByID({ collection: "trips", id, overrideAccess: true, depth: 0 }).catch(() => null);
  if (t?.phase === "archived") {
    throw new Error("This trip is archived — un-archive it before deleting.");
  }
};

// ── Roster lock: headcount is final ─────────────────────────────────────────

const ATTENDANCE_FIELDS = ["status", "arrival", "departure", "companions", "pet"] as const;
const norm = (v: unknown): unknown => (v == null ? null : v);

/**
 * Reject membership changes that alter the headcount once the roster is Locked:
 * **new members** (create), and updates that change **status** (e.g. activating a
 * pending invite) or **attendance**. Finance-only edits (banker flag, refund
 * account) and role changes are still allowed — they don't change who's coming.
 */
export const rejectIfRosterLocked: CollectionBeforeChangeHook = async ({ req, data, operation, originalDoc }) => {
  if (bypassGuards(req)) return data;
  const state = await tripFlags(req, tripIdOf(data, originalDoc));
  if (state?.rosterState !== "locked") return data;

  if (operation === "create") {
    throw new Error("The roster is locked — no new members can be added.");
  }
  // Compare only the fields a caller could be changing (Payload hands the hook
  // the full merged doc, so we diff against the original rather than presence).
  const d = data as { status?: unknown; attendance?: Record<string, unknown> | null };
  const od = originalDoc as { status?: unknown; attendance?: Record<string, unknown> | null } | undefined;
  const statusChanged = norm(d.status) !== norm(od?.status);
  const a = d.attendance ?? {};
  const oa = od?.attendance ?? {};
  const attendanceChanged = ATTENDANCE_FIELDS.some((k) => norm(a[k]) !== norm(oa[k]));
  if (statusChanged || attendanceChanged) {
    throw new Error("The roster is locked — attendance and membership status are final.");
  }
  return data;
};

/** Reject *new* invitations once the roster is Locked or the trip is Archived. */
export const rejectInviteWhenClosed: CollectionBeforeChangeHook = async ({ req, data, operation, originalDoc }) => {
  if (bypassGuards(req) || operation !== "create") return data;
  const state = await tripFlags(req, tripIdOf(data, originalDoc));
  if (state?.phase === "archived") throw new Error("This trip is archived — invitations are closed.");
  if (state?.rosterState === "locked") throw new Error("The roster is locked — invitations are closed.");
  return data;
};

/** Reject removing a member once the roster is Locked or the trip is Archived. */
export const rejectMemberRemovalWhenClosed: CollectionBeforeDeleteHook = async ({ req, id }) => {
  if (bypassGuards(req)) return;
  const m = await req.payload.findByID({ collection: "memberships", id, overrideAccess: true, depth: 0 }).catch(() => null);
  if (!m) return;
  const state = await tripFlags(req, idOf(m.trip));
  if (state?.rosterState === "locked" || state?.phase === "archived") {
    throw new Error("The roster is locked — members can't be removed.");
  }
};

// ── Closed poll: its options are frozen ─────────────────────────────────────

function pollClosed(flags: TripFlags | null, kind: unknown): boolean {
  return kind === "date" ? flags?.datePollState === "closed" : flags?.locationPollState === "closed";
}

/** Reject create/update of a poll option once that poll is Closed. */
export const rejectIfPollClosed: CollectionBeforeChangeHook = async ({ req, data, originalDoc }) => {
  if (bypassGuards(req)) return data;
  const tripId = tripIdOf(data, originalDoc);
  const kind = (data as { kind?: unknown }).kind ?? (originalDoc as { kind?: unknown } | undefined)?.kind;
  if (!tripId) return data;
  if (pollClosed(await tripFlags(req, tripId), kind)) {
    throw new Error("This poll is closed — its options can no longer be changed.");
  }
  return data;
};

/** Reject deleting a poll option once that poll is Closed (or the trip Archived). */
export const rejectPollOptionDeleteWhenLocked: CollectionBeforeDeleteHook = async ({ req, id }) => {
  if (bypassGuards(req)) return;
  const opt = await req.payload.findByID({ collection: "poll-options", id, overrideAccess: true, depth: 0 }).catch(() => null);
  if (!opt) return;
  const flags = await tripFlags(req, idOf(opt.trip));
  if (flags?.phase === "archived") throw new Error("This trip is archived — its data can't be deleted.");
  if (pollClosed(flags, opt.kind)) throw new Error("This poll is closed — its options can no longer be removed.");
};

/**
 * Lifecycle transitions (build.md T-202, PRD §7) — the service that maps a
 * Payload `Trip` onto the pure `domain/lifecycle` state machine, persists an
 * allowed transition, and records it in the audit log.
 *
 * The math of "is this allowed?" lives entirely in `domain/lifecycle`; this
 * layer does the I/O the domain may never touch (read the trip, write the new
 * state, append an audit entry) and turns a rejected transition into a thrown
 * {@link LifecycleTransitionError}. **Authorization is the caller's job** — the
 * server action / route applies `isOrganizerOf` before calling in; a Closed
 * ledger's write-rejection is enforced separately via `assertLedgerWritable`
 * (wired into finance collections in T-502).
 *
 * Every transition shares the surrounding `req` so the trip write and its audit
 * entry commit in one transaction (build.md §0.1).
 */
import type { Payload, PayloadRequest } from "payload";

import {
  AREA_STATE_VALUES,
  checkAreaTransition,
  checkPhaseTransition,
  PHASE_ORDER,
  type AreaKind,
  type AreaStates,
  type FinanceState,
  type LifecycleState,
  type TransitionReason,
  type TripPhase,
} from "@/domain/lifecycle";
import type { Trip } from "@/payload-types";

import { AuditAction, recordAudit, type AuditActionKey } from "./audit";

// Re-export the domain lifecycle types so the app layer can name them without
// importing `domain` directly (forbidden by the architecture boundary).
export type { AreaKind, AreaStates, FinanceState, TripPhase } from "@/domain/lifecycle";

/** Trip field that persists each area's state. */
const AREA_FIELD = {
  datePoll: "datePollState",
  locationPoll: "locationPollState",
  roster: "rosterState",
  finance: "financeState",
} as const satisfies Record<AreaKind, keyof Trip>;

/** Human-readable rejection messages keyed on the domain's reason codes. */
const REASON_MESSAGE: Record<TransitionReason, string> = {
  "same-state": "The area is already in that state.",
  "illegal-transition": "That state transition is not allowed.",
  "skips-settling": "Accounts must move through Settling before they can be Closed.",
  "date-not-chosen": "Close the date poll before settling the finances.",
};

/** Thrown when a transition is rejected by the state machine. */
export class LifecycleTransitionError extends Error {
  readonly reason: TransitionReason;
  constructor(reason: TransitionReason) {
    super(REASON_MESSAGE[reason]);
    this.name = "LifecycleTransitionError";
    this.reason = reason;
  }
}

/** Read the lifecycle snapshot off a persisted trip (also exported for the UI). */
export function lifecycleSnapshot(trip: Trip): LifecycleState {
  return snapshot(trip);
}

/** Read the lifecycle snapshot off a persisted trip. */
function snapshot(trip: Trip): LifecycleState {
  return {
    phase: (trip.phase ?? "draft") as TripPhase,
    datePoll: (trip.datePollState ?? "open") as AreaStates["datePoll"],
    locationPoll: (trip.locationPollState ?? "open") as AreaStates["locationPoll"],
    roster: (trip.rosterState ?? "open") as AreaStates["roster"],
    finance: (trip.financeState ?? "open") as AreaStates["finance"],
  };
}

export interface TransitionOptions {
  /** Identity id performing the transition (for the audit trail). */
  actor?: string | null;
}

export interface TransitionOutcome<T extends string> {
  trip: Trip;
  from: T;
  to: T;
  /** True when the transition stepped backward (re-open / reversal). */
  reversal: boolean;
}

/**
 * Pick the audit action for a finance transition: closing and re-opening
 * accounts get their own dedicated keys (PRD §14.7 auditability); everything
 * else is a generic lifecycle transition.
 */
function financeAuditAction(to: FinanceState, reversal: boolean): AuditActionKey {
  if (to === "closed") return AuditAction.FinanceAccountsClosed;
  if (reversal) return AuditAction.FinanceAccountsReopened;
  return AuditAction.LifecycleTransition;
}

/** Advance (or, with a logged reversal, step back) a trip's overall phase. */
export async function transitionPhase(
  payload: Payload,
  tripId: string,
  to: TripPhase,
  opts: TransitionOptions = {},
  req?: PayloadRequest,
): Promise<TransitionOutcome<TripPhase>> {
  const trip = await payload.findByID({ collection: "trips", id: tripId, overrideAccess: true, req });
  const from = snapshot(trip).phase;

  const result = checkPhaseTransition(from, to);
  if (!result.ok) throw new LifecycleTransitionError(result.reason);

  const updated = await payload.update({
    collection: "trips",
    id: tripId,
    overrideAccess: true,
    req,
    data: { phase: to },
  });

  await recordAudit(
    payload,
    {
      actor: opts.actor,
      action: AuditAction.LifecycleTransition,
      targetType: "trip",
      targetId: tripId,
      trip: tripId,
      metadata: { kind: "phase", from, to, reversal: result.reversal },
    },
    req,
  );

  return { trip: updated, from, to, reversal: result.reversal };
}

/**
 * Lock / unlock a single area (date poll, location poll, roster, or finance),
 * enforcing both the area's own state graph and the cross-area invariants (you
 * cannot settle a date that hasn't been chosen). The finance ledger's
 * Open→Settling→Closed rules and its re-open audit keys are handled here.
 */
export async function transitionArea<K extends AreaKind>(
  payload: Payload,
  tripId: string,
  area: K,
  to: AreaStates[K],
  opts: TransitionOptions = {},
  req?: PayloadRequest,
): Promise<TransitionOutcome<AreaStates[K]>> {
  const trip = await payload.findByID({ collection: "trips", id: tripId, overrideAccess: true, req });
  const state = snapshot(trip);
  const from = state[area] as AreaStates[K];

  const result = checkAreaTransition(area, from, to, state);
  if (!result.ok) throw new LifecycleTransitionError(result.reason);

  const updated = await payload.update({
    collection: "trips",
    id: tripId,
    overrideAccess: true,
    req,
    data: { [AREA_FIELD[area]]: to } as Partial<Trip>,
  });

  const action =
    area === "finance"
      ? financeAuditAction(to as FinanceState, result.reversal)
      : AuditAction.LifecycleTransition;

  await recordAudit(
    payload,
    {
      actor: opts.actor,
      action,
      targetType: "trip",
      targetId: tripId,
      trip: tripId,
      metadata: { kind: "area", area, from, to, reversal: result.reversal },
    },
    req,
  );

  return { trip: updated, from, to, reversal: result.reversal };
}

// --- Legal-transition listing (for the console UI) --------------------------

export interface LegalTransition<T extends string> {
  to: T;
  /** True when this target steps the state backward (re-open / reversal). */
  reversal: boolean;
}

/**
 * The transitions the organizer may legally take from a trip's current state.
 * The app layer can't import `domain/lifecycle` directly (architecture
 * boundary), so the console reads its lifecycle options through these — keeping
 * the buttons and the enforcement driven by the *same* state machine.
 */
export function legalAreaTransitions<K extends AreaKind>(
  trip: Trip,
  area: K,
): LegalTransition<AreaStates[K]>[] {
  const state = snapshot(trip);
  const from = state[area] as AreaStates[K];
  const candidates = AREA_STATE_VALUES[area] as readonly AreaStates[K][];
  const out: LegalTransition<AreaStates[K]>[] = [];
  for (const to of candidates) {
    if (to === from) continue;
    const result = checkAreaTransition(area, from, to, state);
    if (result.ok) out.push({ to, reversal: result.reversal });
  }
  return out;
}

/** The phase transitions the organizer may legally take from the current phase. */
export function legalPhaseTransitions(trip: Trip): LegalTransition<TripPhase>[] {
  const from = snapshot(trip).phase;
  const out: LegalTransition<TripPhase>[] = [];
  for (const to of PHASE_ORDER) {
    if (to === from) continue;
    const result = checkPhaseTransition(from, to);
    if (result.ok) out.push({ to, reversal: result.reversal });
  }
  return out;
}

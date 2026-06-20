/**
 * Lifecycle & area-locking state machine (build.md T-202, PRD §7).
 *
 * PURE TypeScript — no Payload, Next, Mongo, or React. This module is the
 * integrity backbone for *state* (the settlement engine, T-501, is the backbone
 * for *money*). It answers one question deterministically: "is this state
 * transition allowed?" — so the rule can be unit-tested with no database and
 * enforced identically wherever state changes (the `services/lifecycle` layer
 * adapts Payload trips to/from it).
 *
 * Two ideas from the PRD shape the rules:
 *
 *  1. **Phases overlap freely except where overlap breaks logic.** The trip
 *     `phase` is a coarse pointer that advances forward; stepping back is a
 *     single, explicit, *logged* reversal. The real invariants live at the area
 *     level (e.g. you can't *settle finances for a date that hasn't been
 *     chosen*).
 *  2. **Each area has its own open→locked state so things stop changing.** The
 *     finance ledger is the strict one: Open → Settling → Closed, and it may
 *     never skip Settling. Re-opening is allowed but is always a reversal that
 *     the caller must record in the audit log.
 */

// --- States -----------------------------------------------------------------

export type TripPhase = "draft" | "ideation" | "planning" | "finances" | "archived";
export type PollState = "open" | "closed";
export type RosterState = "open" | "locked";
export type FinanceState = "open" | "settling" | "closed";

/** The lockable areas of a trip and the state type each one carries. */
export interface AreaStates {
  datePoll: PollState;
  locationPoll: PollState;
  roster: RosterState;
  finance: FinanceState;
}

export type AreaKind = keyof AreaStates;

/** Every state value each area can hold, in canonical order. */
export const AREA_STATE_VALUES = {
  datePoll: ["open", "closed"],
  locationPoll: ["open", "closed"],
  roster: ["open", "locked"],
  finance: ["open", "settling", "closed"],
} as const satisfies { [K in AreaKind]: readonly AreaStates[K][] };

/** The whole lifecycle snapshot a transition is evaluated against. */
export interface LifecycleState extends AreaStates {
  phase: TripPhase;
}

// --- Transition result ------------------------------------------------------

export type TransitionReason =
  | "same-state" // from === to: a no-op is not a transition
  | "illegal-transition" // not an edge in the state machine
  | "skips-settling" // finance Open → Closed without passing through Settling
  | "date-not-chosen"; // can't settle/close money before the date poll is closed

export type TransitionResult =
  | { ok: true; reversal: boolean }
  | { ok: false; reason: TransitionReason };

const ok = (reversal: boolean): TransitionResult => ({ ok: true, reversal });
const fail = (reason: TransitionReason): TransitionResult => ({ ok: false, reason });

// --- Phase machine ----------------------------------------------------------

/** Canonical forward order of trip phases. */
export const PHASE_ORDER: readonly TripPhase[] = [
  "draft",
  "ideation",
  "planning",
  "finances",
  "archived",
];

const phaseRank = (p: TripPhase): number => PHASE_ORDER.indexOf(p);

/**
 * Phase transitions are permissive forward (overlap is fine — you may jump from
 * ideation straight to finances) but only **one step** backward, and that step
 * is a logged reversal. Jumping back more than one phase (e.g. archived →
 * planning) is illegal: unwind it one explicit step at a time.
 */
export function checkPhaseTransition(from: TripPhase, to: TripPhase): TransitionResult {
  if (from === to) return fail("same-state");
  const delta = phaseRank(to) - phaseRank(from);
  if (delta < -1) return fail("illegal-transition");
  return ok(delta < 0);
}

// --- Area machines ----------------------------------------------------------

/**
 * Per-area edges. `true` marks a forward (locking) edge; `false` marks a
 * reversal (re-opening) edge. An absent edge is illegal. Finance deliberately
 * omits Open→Closed so the ledger can never close without settling first.
 */
const AREA_EDGES: { [K in AreaKind]: Partial<Record<AreaStates[K], Partial<Record<AreaStates[K], boolean>>>> } = {
  datePoll: { open: { closed: true }, closed: { open: false } },
  locationPoll: { open: { closed: true }, closed: { open: false } },
  roster: { open: { locked: true }, locked: { open: false } },
  finance: {
    open: { settling: true },
    settling: { closed: true, open: false },
    closed: { settling: false, open: false },
  },
};

/**
 * Is moving `area` from `from` to `to` a structurally valid edge? Cross-area
 * preconditions (e.g. the date poll) are layered on top by
 * {@link checkAreaTransition}; this function only knows the area's own graph.
 */
export function checkAreaEdge<K extends AreaKind>(
  area: K,
  from: AreaStates[K],
  to: AreaStates[K],
): TransitionResult {
  if (from === to) return fail("same-state");
  const forward = AREA_EDGES[area][from]?.[to];
  if (forward === undefined) {
    // Finance Open→Closed gets a more specific reason than a bare illegal edge.
    if (area === "finance" && from === "open" && to === "closed") return fail("skips-settling");
    return fail("illegal-transition");
  }
  return ok(!forward);
}

/**
 * Full area transition check, including the cross-area invariants that make
 * "overlap breaks logic" concrete:
 *
 *  - **Finance Open→Settling requires the date poll to be Closed.** You cannot
 *    settle the money for a trip whose date nobody has chosen yet (PRD §7).
 *
 * `current` is the surrounding lifecycle snapshot; only the *other* areas are
 * read from it (the `area` being moved is taken from `from`/`to`).
 */
export function checkAreaTransition<K extends AreaKind>(
  area: K,
  from: AreaStates[K],
  to: AreaStates[K],
  current: Pick<LifecycleState, AreaKind>,
): TransitionResult {
  const edge = checkAreaEdge(area, from, to);
  if (!edge.ok) return edge;

  if (area === "finance" && to === "settling" && current.datePoll !== "closed") {
    return fail("date-not-chosen");
  }

  return edge;
}

// --- Ledger write guard -----------------------------------------------------

/**
 * The finance ledger accepts expense/prepayment writes **only while Open**. In
 * Settling balances are frozen so people can pay up against stable numbers; once
 * Closed the ledger is immutable. Finance collections (T-502) call this from a
 * `beforeChange` hook so a Closed ledger rejects writes *server-side*, not
 * merely by hiding the button (PRD §7, §14.7).
 */
export function isLedgerWritable(finance: FinanceState): boolean {
  return finance === "open";
}

/** Thrown when a write is attempted against a non-Open ledger. */
export class LedgerLockedError extends Error {
  readonly financeState: FinanceState;
  constructor(financeState: FinanceState) {
    super(`Ledger is ${financeState}; expense and prepayment writes are rejected.`);
    this.name = "LedgerLockedError";
    this.financeState = financeState;
  }
}

/** Assert the ledger is writable, or throw {@link LedgerLockedError}. */
export function assertLedgerWritable(finance: FinanceState): void {
  if (!isLedgerWritable(finance)) throw new LedgerLockedError(finance);
}

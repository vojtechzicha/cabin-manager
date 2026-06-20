/**
 * Voting service (T-301/302/303/305, PRD §8.2) — the Payload adapter for the
 * date & location polls. Pure ranking math lives in `domain/scheduling`; this
 * layer reads/writes polls, options and votes, and promotes a winner onto the
 * trip when a poll closes.
 *
 * **Authorization is the caller's job** (the server action applies
 * `requireOrganizer` for management and `requireIdentity` + membership for
 * voting); every write runs with `overrideAccess` and threads the surrounding
 * `req` so it shares the caller's transaction.
 */
import type { Payload, PayloadRequest, Where } from "payload";

import {
  rankDateOptions,
  type AvailabilityValue,
  type RankedDateOption,
} from "@/domain/scheduling";
import type { Membership, Poll, PollOption, Trip, Vote } from "@/payload-types";

import { transitionArea } from "./lifecycle";
import { withTransaction } from "./transaction";

// Re-export so the app layer can name vote values without importing `domain`
// directly (architecture boundary, mirrors how lifecycle re-exports its types).
export type { AvailabilityValue, RankedDateOption } from "@/domain/scheduling";

export type PollKind = "date" | "location";
export type PollMethod = "approval" | "grid" | "single";

const DEFAULT_METHOD: Record<PollKind, PollMethod> = { date: "approval", location: "single" };

const relId = (v: unknown): string =>
  v && typeof v === "object" ? String((v as { id: string | number }).id) : String(v);

// --- Reads ------------------------------------------------------------------

/** The poll row for a trip + kind, or null if the organizer hasn't created it. */
export async function getPoll(
  payload: Payload,
  tripId: string,
  kind: PollKind,
  req?: PayloadRequest,
): Promise<Poll | null> {
  const res = await payload.find({
    collection: "polls",
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { and: [{ trip: { equals: tripId } }, { kind: { equals: kind } }] },
    req,
  });
  return res.docs[0] ?? null;
}

/** Get the poll, creating a draft (unpublished) one with the default method if absent. */
export async function getOrCreatePoll(
  payload: Payload,
  tripId: string,
  kind: PollKind,
  req?: PayloadRequest,
): Promise<Poll> {
  const existing = await getPoll(payload, tripId, kind, req);
  if (existing) return existing;
  return payload.create({
    collection: "polls",
    overrideAccess: true,
    req,
    data: { trip: tripId, kind, method: DEFAULT_METHOD[kind], published: false },
  });
}

/** Options for a poll, ordered; hidden ones excluded unless `includeHidden`. */
export async function listOptions(
  payload: Payload,
  tripId: string,
  kind: PollKind,
  opts: { includeHidden?: boolean } = {},
  req?: PayloadRequest,
): Promise<PollOption[]> {
  const and: Where[] = [{ trip: { equals: tripId } }, { kind: { equals: kind } }];
  if (!opts.includeHidden) and.push({ hidden: { not_equals: true } });
  const where: Where = { and };
  const res = await payload.find({
    collection: "poll-options",
    overrideAccess: true,
    depth: 1, // populate suggestedBy for the moderation chip
    pagination: false,
    limit: 500,
    sort: "order",
    where,
    req,
  });
  return res.docs;
}

/** All votes for a poll's kind in a trip (public to the trip). Relationship ids raw. */
export async function listVotes(
  payload: Payload,
  tripId: string,
  kind: PollKind,
  req?: PayloadRequest,
): Promise<Vote[]> {
  const res = await payload.find({
    collection: "votes",
    overrideAccess: true,
    depth: 0,
    pagination: false,
    limit: 5000,
    where: { and: [{ trip: { equals: tripId } }, { poll: { exists: true } }] },
    req,
  });
  // Filter to this kind by the loaded options (votes carry trip+poll+option).
  const optionIds = new Set((await listOptions(payload, tripId, kind, { includeHidden: true }, req)).map((o) => String(o.id)));
  return res.docs.filter((v) => optionIds.has(relId(v.option)));
}

/**
 * Rank the date-poll windows for the organizer's optimal panel. Scores against
 * the **active roster** (so non-voters count against a window), with optional
 * VIP weighting by membership id.
 */
export function rankWindows(
  options: PollOption[],
  votes: Vote[],
  roster: Membership[],
  vipWeights?: Record<string, number>,
): RankedDateOption[] {
  const voterIds = roster.filter((m) => m.status === "active").map((m) => String(m.id));
  const byOption = new Map<string, { voterId: string; value: AvailabilityValue }[]>();
  for (const v of votes) {
    const oid = relId(v.option);
    const arr = byOption.get(oid) ?? [];
    arr.push({ voterId: relId(v.membership), value: v.value as AvailabilityValue });
    byOption.set(oid, arr);
  }
  return rankDateOptions(
    options.map((o) => ({
      id: String(o.id),
      dateStart: o.dateStart ?? null,
      dateEnd: o.dateEnd ?? null,
      votes: byOption.get(String(o.id)) ?? [],
    })),
    { voterIds, vipWeights },
  );
}

// --- Option management (organizer; suggestions = any member) ----------------

export interface AddOptionInput {
  tripId: string;
  kind: PollKind;
  dateStart?: string | null;
  dateEnd?: string | null;
  label?: string | null;
  /** Set when a participant suggests the option (flagged in the UI). */
  suggestedByMembershipId?: string | null;
  order?: number;
}

export async function addOption(
  payload: Payload,
  input: AddOptionInput,
  req?: PayloadRequest,
): Promise<PollOption> {
  const poll = await getOrCreatePoll(payload, input.tripId, input.kind, req);
  return payload.create({
    collection: "poll-options",
    overrideAccess: true,
    req,
    data: {
      poll: String(poll.id),
      trip: input.tripId,
      kind: input.kind,
      dateStart: input.dateStart ?? null,
      dateEnd: input.dateEnd ?? null,
      label: input.label ?? null,
      suggestedBy: input.suggestedByMembershipId ?? null,
      order: input.order ?? Date.now() % 100000,
    },
  });
}

export async function removeOption(payload: Payload, optionId: string, req?: PayloadRequest): Promise<void> {
  // Drop votes on the option first so no orphans linger.
  await payload.delete({ collection: "votes", overrideAccess: true, where: { option: { equals: optionId } }, req });
  await payload.delete({ collection: "poll-options", id: optionId, overrideAccess: true, req });
}

/** Accept a participant suggestion (clear the flag) or hide it from the vote. */
export async function moderateOption(
  payload: Payload,
  optionId: string,
  action: "promote" | "hide" | "unhide",
  req?: PayloadRequest,
): Promise<PollOption> {
  const data =
    action === "promote" ? { suggestedBy: null } : { hidden: action === "hide" };
  return payload.update({ collection: "poll-options", id: optionId, overrideAccess: true, req, data });
}

export async function setPollMethod(
  payload: Payload,
  tripId: string,
  kind: PollKind,
  method: PollMethod,
  req?: PayloadRequest,
): Promise<Poll> {
  const trip = await payload.findByID({ collection: "trips", id: tripId, overrideAccess: true, depth: 0, req });
  const closed = kind === "date" ? trip.datePollState === "closed" : trip.locationPollState === "closed";
  if (closed) throw new PollCloseError("This poll is closed — its method can't be changed.");
  const poll = await getOrCreatePoll(payload, tripId, kind, req);
  return payload.update({ collection: "polls", id: String(poll.id), overrideAccess: true, req, data: { method } });
}

/** Publish a draft poll (opens voting to participants). */
export async function publishPoll(
  payload: Payload,
  tripId: string,
  kind: PollKind,
  req?: PayloadRequest,
): Promise<Poll> {
  const poll = await getOrCreatePoll(payload, tripId, kind, req);
  return payload.update({ collection: "polls", id: String(poll.id), overrideAccess: true, req, data: { published: true } });
}

// --- Voting (participant; self only) ----------------------------------------

export interface CastVoteInput {
  tripId: string;
  kind: PollKind;
  membershipId: string;
  optionId: string;
  value: AvailabilityValue;
}

/**
 * Record (or update) one member's vote on an option. For single-choice polls,
 * picking an option clears the member's votes on the poll's other options so
 * exactly one stays.
 */
export async function castVote(payload: Payload, input: CastVoteInput, req?: PayloadRequest): Promise<void> {
  const poll = await getOrCreatePoll(payload, input.tripId, input.kind, req);
  const existing = await payload.find({
    collection: "votes",
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { and: [{ option: { equals: input.optionId } }, { membership: { equals: input.membershipId } }] },
    req,
  });

  if (existing.docs[0]) {
    await payload.update({
      collection: "votes",
      id: String(existing.docs[0].id),
      overrideAccess: true,
      req,
      data: { value: input.value },
    });
  } else {
    await payload.create({
      collection: "votes",
      overrideAccess: true,
      req,
      data: {
        poll: String(poll.id),
        trip: input.tripId,
        option: input.optionId,
        membership: input.membershipId,
        value: input.value,
      },
    });
  }

  if (poll.method === "single") {
    await payload.delete({
      collection: "votes",
      overrideAccess: true,
      req,
      where: {
        and: [
          { poll: { equals: String(poll.id) } },
          { membership: { equals: input.membershipId } },
          { option: { not_equals: input.optionId } },
        ],
      },
    });
  }
}

// --- Closing & promotion (organizer, T-305) ---------------------------------

/** Thrown when a poll close is rejected (invalid winner, unpublished poll, …). */
export class PollCloseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PollCloseError";
  }
}

/**
 * Validate a proposed winner against the poll it's supposed to win: same trip,
 * same poll, correct kind, visible (not hidden), and the poll actually opened.
 */
async function validateWinner(
  payload: Payload,
  tripId: string,
  kind: PollKind,
  winnerOptionId: string,
  req?: PayloadRequest,
): Promise<{ winner: PollOption; poll: Poll }> {
  const poll = await getOrCreatePoll(payload, tripId, kind, req);
  let winner: PollOption;
  try {
    winner = (await payload.findByID({ collection: "poll-options", id: winnerOptionId, overrideAccess: true, depth: 0, req })) as PollOption;
  } catch {
    throw new PollCloseError("The selected winner does not exist.");
  }
  if (relId(winner.trip) !== String(tripId)) throw new PollCloseError("The winner belongs to a different trip.");
  if (relId(winner.poll) !== String(poll.id)) throw new PollCloseError("The winner belongs to a different poll.");
  if (winner.kind !== kind) throw new PollCloseError("The winner is the wrong kind of option.");
  if (winner.hidden) throw new PollCloseError("A hidden option can't be the winner.");
  if (!poll.published) throw new PollCloseError("This poll was never opened for voting.");
  return { winner, poll };
}

/** Close the date poll, record the winner, and promote its window to `trip.dates`. Idempotent. */
export async function closeDatePoll(
  payload: Payload,
  tripId: string,
  opts: { actor?: string | null; winnerOptionId: string },
  req?: PayloadRequest,
): Promise<Trip> {
  const { winner, poll } = await validateWinner(payload, tripId, "date", opts.winnerOptionId, req);
  if (!winner.dateStart) throw new PollCloseError("The winning window has no date range.");

  // Atomic: lock the poll, record the winner, and promote the dates together.
  return withTransaction(payload, req, async (req) => {
    const trip = await payload.findByID({ collection: "trips", id: tripId, overrideAccess: true, req });
    if (trip.datePollState !== "closed") {
      await transitionArea(payload, tripId, "datePoll", "closed", { actor: opts.actor }, req);
    }
    await payload.update({ collection: "polls", id: String(poll.id), overrideAccess: true, req, data: { winnerOption: opts.winnerOptionId } });
    return payload.update({
      collection: "trips",
      id: tripId,
      overrideAccess: true,
      req,
      data: { dates: { start: winner.dateStart, end: winner.dateEnd ?? null } },
    });
  });
}

/** Close the location poll, record the winner, and promote its label to `trip.location`. Idempotent. */
export async function closeLocationPoll(
  payload: Payload,
  tripId: string,
  opts: { actor?: string | null; winnerOptionId: string },
  req?: PayloadRequest,
): Promise<Trip> {
  const { winner, poll } = await validateWinner(payload, tripId, "location", opts.winnerOptionId, req);
  if (!winner.label) throw new PollCloseError("The winning option has no location label.");

  return withTransaction(payload, req, async (req) => {
    const trip = await payload.findByID({ collection: "trips", id: tripId, overrideAccess: true, req });
    if (trip.locationPollState !== "closed") {
      await transitionArea(payload, tripId, "locationPoll", "closed", { actor: opts.actor }, req);
    }
    await payload.update({ collection: "polls", id: String(poll.id), overrideAccess: true, req, data: { winnerOption: opts.winnerOptionId } });
    return payload.update({ collection: "trips", id: tripId, overrideAccess: true, req, data: { location: winner.label } });
  });
}

/**
 * Re-open a closed poll: clears the recorded winner and (for the date poll)
 * **un-promotes** the trip dates, so a stale "chosen" window isn't left showing
 * as decided. The lifecycle reversal itself is audited.
 */
export async function reopenPoll(
  payload: Payload,
  tripId: string,
  kind: PollKind,
  opts: { actor?: string | null } = {},
  req?: PayloadRequest,
): Promise<void> {
  await withTransaction(payload, req, async (req) => {
    await transitionArea(payload, tripId, kind === "date" ? "datePoll" : "locationPoll", "open", { actor: opts.actor }, req);
    const poll = await getPoll(payload, tripId, kind, req);
    if (poll) {
      await payload.update({ collection: "polls", id: String(poll.id), overrideAccess: true, req, data: { winnerOption: null } });
    }
    if (kind === "date") {
      await payload.update({ collection: "trips", id: tripId, overrideAccess: true, req, data: { dates: { start: null, end: null } } });
    }
  });
}

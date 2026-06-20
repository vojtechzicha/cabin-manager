/**
 * Optimal-date scheduling (T-304, PRD §8.2.1) — a pure domain module that ranks
 * candidate date windows by how well they suit the group. No Payload, no I/O:
 * given each window's per-voter availability, it returns a ranked list with an
 * attendance preview and an explicit "can't make it" list. The organizer still
 * decides and closes; this never auto-commits.
 *
 * Scoring: each availability is weighted Yes = 1.0, If-needed = 0.5, No = 0,
 * times an optional per-voter VIP weight (e.g. the banker or people with cars
 * count more). A window's score is its weighted sum normalised to 0–100 against
 * the full eligible voter set (so not voting counts against a window).
 *
 * Tie-breakers, in order: higher score → more full-Yes → fewer If-needed →
 * covers a weekend → earlier start.
 */

export type AvailabilityValue = "yes" | "ifneeded" | "no";

const WEIGHT: Record<AvailabilityValue, number> = { yes: 1, ifneeded: 0.5, no: 0 };

export interface OptionVote {
  voterId: string;
  value: AvailabilityValue;
}

export interface DateOptionInput {
  id: string;
  dateStart?: string | Date | null;
  dateEnd?: string | Date | null;
  votes: OptionVote[];
}

export interface RankOptions {
  /** Per-voter multiplier; VIPs (banker, drivers) count for more. Default 1. */
  vipWeights?: Record<string, number>;
  /**
   * The full set of eligible voters, used to normalise the score. Defaults to
   * the union of voters seen across all options. Pass the active roster's ids so
   * windows are scored against everyone, not just those who happened to vote.
   */
  voterIds?: string[];
}

export interface RankedDateOption {
  id: string;
  /** 1-based position after sorting; 1 is the recommended window. */
  rank: number;
  /** Normalised 0–100 score. */
  score: number;
  /** Weighted raw sum (before normalisation). */
  raw: number;
  yes: number;
  ifNeeded: number;
  no: number;
  /** Voters who said yes or if-needed — the optimistic headcount. */
  attendees: number;
  /** Voter ids who said "no" (the can't-make-it list). */
  missing: string[];
  /** Voter ids who said "if-needed" (soft caveats). */
  caveats: string[];
  coversWeekend: boolean;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** True if [start, end] (inclusive) contains a Saturday or Sunday. */
function spansWeekend(start: Date | null, end: Date | null): boolean {
  if (!start) return false;
  const last = end ?? start;
  // Cap the scan so a malformed huge range can't loop unbounded.
  const MAX_DAYS = 31;
  const cursor = new Date(start.getTime());
  for (let i = 0; i <= MAX_DAYS; i++) {
    if (cursor > last) break;
    const day = cursor.getUTCDay();
    if (day === 0 || day === 6) return true;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return false;
}

/**
 * Rank candidate date windows best-first. Each voter is counted at most once per
 * option (last value wins if duplicated). Hidden options should be filtered out
 * by the caller before ranking.
 */
export function rankDateOptions(
  options: DateOptionInput[],
  opts: RankOptions = {},
): RankedDateOption[] {
  const vip = opts.vipWeights ?? {};
  const weightOf = (voterId: string): number => {
    const w = vip[voterId];
    return typeof w === "number" && w > 0 ? w : 1;
  };

  // Eligible voter set: explicit list, else the union across all options.
  const voterSet = new Set<string>(opts.voterIds ?? []);
  if (!opts.voterIds) {
    for (const o of options) for (const v of o.votes) voterSet.add(v.voterId);
  }
  const maxRaw = [...voterSet].reduce((sum, id) => sum + weightOf(id), 0);

  const scored = options.map((option) => {
    // Dedupe votes by voter (last wins).
    const byVoter = new Map<string, AvailabilityValue>();
    for (const v of option.votes) byVoter.set(v.voterId, v.value);

    let yes = 0;
    let ifNeeded = 0;
    let no = 0;
    let raw = 0;
    const missing: string[] = [];
    const caveats: string[] = [];
    for (const [voterId, value] of byVoter) {
      raw += WEIGHT[value] * weightOf(voterId);
      if (value === "yes") yes++;
      else if (value === "ifneeded") {
        ifNeeded++;
        caveats.push(voterId);
      } else {
        no++;
        missing.push(voterId);
      }
    }
    const start = toDate(option.dateStart);
    const end = toDate(option.dateEnd);
    return {
      id: option.id,
      rank: 0,
      score: maxRaw > 0 ? Math.round((raw / maxRaw) * 100) : 0,
      raw,
      yes,
      ifNeeded,
      no,
      attendees: yes + ifNeeded,
      missing,
      caveats,
      coversWeekend: spansWeekend(start, end),
      _start: start,
    };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.yes !== a.yes) return b.yes - a.yes;
    if (a.ifNeeded !== b.ifNeeded) return a.ifNeeded - b.ifNeeded;
    if (a.coversWeekend !== b.coversWeekend) return a.coversWeekend ? -1 : 1;
    const at = a._start ? a._start.getTime() : Infinity;
    const bt = b._start ? b._start.getTime() : Infinity;
    return at - bt;
  });

  return scored.map(({ _start, ...rest }, i) => {
    void _start;
    return { ...rest, rank: i + 1 };
  });
}

/** The single recommended window (rank 1), or null if there are no options. */
export function optimalDateOption(
  options: DateOptionInput[],
  opts: RankOptions = {},
): RankedDateOption | null {
  return rankDateOptions(options, opts)[0] ?? null;
}

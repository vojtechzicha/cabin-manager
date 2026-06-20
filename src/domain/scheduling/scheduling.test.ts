import { describe, expect, it } from "vitest";

import { optimalDateOption, rankDateOptions, type DateOptionInput } from "./index";

/** Compact helper: build votes from a map of voterId → value. */
function votes(map: Record<string, "yes" | "ifneeded" | "no">) {
  return Object.entries(map).map(([voterId, value]) => ({ voterId, value }));
}

/** First ranked option (tests always pass at least one). */
function first(options: DateOptionInput[], opts?: Parameters<typeof rankDateOptions>[1]) {
  const r = rankDateOptions(options, opts)[0];
  if (!r) throw new Error("expected at least one ranked option");
  return r;
}

describe("rankDateOptions — scoring", () => {
  it("weights Yes=1, If-needed=0.5, No=0 and normalises to 0–100", () => {
    const opts: DateOptionInput[] = [
      { id: "all-yes", votes: votes({ a: "yes", b: "yes", c: "yes", d: "yes" }) },
      { id: "one-if", votes: votes({ a: "yes", b: "yes", c: "yes", d: "ifneeded" }) },
      { id: "one-no", votes: votes({ a: "yes", b: "yes", c: "yes", d: "no" }) },
    ];
    const byId = new Map(rankDateOptions(opts).map((r) => [r.id, r]));
    expect(byId.get("all-yes")?.score).toBe(100);
    // 3.5 / 4 = 87.5 → 88
    expect(byId.get("one-if")?.score).toBe(88);
    // 3 / 4 = 75
    expect(byId.get("one-no")?.score).toBe(75);
  });

  it("counts attendees (yes + if-needed) and lists missing (no) + caveats (if-needed)", () => {
    const r = first([{ id: "w", votes: votes({ a: "yes", b: "ifneeded", c: "no", d: "yes" }) }]);
    expect(r.yes).toBe(2);
    expect(r.ifNeeded).toBe(1);
    expect(r.no).toBe(1);
    expect(r.attendees).toBe(3);
    expect(r.missing).toEqual(["c"]);
    expect(r.caveats).toEqual(["b"]);
  });

  it("normalises against the full eligible voter set, not just who voted", () => {
    // Two voted yes, but the roster has four — a half-empty window scores 50.
    const r = first([{ id: "w", votes: votes({ a: "yes", b: "yes" }) }], {
      voterIds: ["a", "b", "c", "d"],
    });
    expect(r.score).toBe(50);
    expect(r.attendees).toBe(2);
  });

  it("applies VIP weights", () => {
    // a is a VIP (×3): a=yes contributes 3, b=no 0 → raw 3 of max 4 → 75.
    const r = first([{ id: "w", votes: votes({ a: "yes", b: "no" }) }], { vipWeights: { a: 3 } });
    expect(r.raw).toBe(3);
    expect(r.score).toBe(75);
  });

  it("dedupes repeated votes from the same voter (last wins)", () => {
    const r = first([
      {
        id: "w",
        votes: [
          { voterId: "a", value: "no" },
          { voterId: "a", value: "yes" },
        ],
      },
    ]);
    expect(r.yes).toBe(1);
    expect(r.no).toBe(0);
    expect(r.score).toBe(100);
  });
});

describe("rankDateOptions — tie-breakers", () => {
  it("breaks equal scores by more full-Yes, then fewer If-needed", () => {
    // Both windows score raw 2.0 of 3 but A has more full-yes.
    const ranked = rankDateOptions(
      [
        { id: "more-if", votes: votes({ a: "yes", b: "ifneeded", c: "ifneeded" }) },
        { id: "more-yes", votes: votes({ a: "yes", b: "yes", c: "no" }) },
      ],
      { voterIds: ["a", "b", "c"] },
    );
    expect(ranked.map((r) => r.id)).toEqual(["more-yes", "more-if"]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2]);
  });

  it("prefers the earlier start before weekend coverage (PRD tie-break order)", () => {
    const ranked = rankDateOptions([
      { id: "weekend", dateStart: "2026-07-10", dateEnd: "2026-07-12", votes: votes({ a: "yes" }) }, // Fri–Sun, later
      { id: "weekday", dateStart: "2026-07-06", dateEnd: "2026-07-09", votes: votes({ a: "yes" }) }, // Mon–Thu, earlier
    ]);
    // Earlier start wins even though the other covers a weekend.
    expect(ranked.map((r) => r.id)).toEqual(["weekday", "weekend"]);
  });

  it("uses weekend coverage as the final tiebreaker when start dates tie", () => {
    const ranked = rankDateOptions([
      { id: "fri-only", dateStart: "2026-07-10", dateEnd: "2026-07-10", votes: votes({ a: "yes" }) }, // Fri, no weekend
      { id: "fri-sun", dateStart: "2026-07-10", dateEnd: "2026-07-12", votes: votes({ a: "yes" }) }, // Fri–Sun, weekend
    ]);
    expect(ranked.map((r) => r.id)).toEqual(["fri-sun", "fri-only"]);
    expect(ranked[0]?.coversWeekend).toBe(true);
  });
});

describe("optimalDateOption", () => {
  it("returns the rank-1 window, or null when there are no options", () => {
    expect(optimalDateOption([])).toBeNull();
    const best = optimalDateOption([
      { id: "lo", votes: votes({ a: "no" }) },
      { id: "hi", votes: votes({ a: "yes" }) },
    ]);
    expect(best?.id).toBe("hi");
    expect(best?.rank).toBe(1);
  });

  it("matches the §8.2.1 story: 9 of 11, missing Petr and Jana", () => {
    const roster = ["t", "k", "a", "m", "e", "j2", "p2", "v", "z", "petr", "jana"];
    const v: Record<string, "yes" | "ifneeded" | "no"> = {};
    for (const id of roster) v[id] = "yes";
    v["petr"] = "no";
    v["jana"] = "no";
    const r = first([{ id: "12-14", votes: votes(v) }], { voterIds: roster });
    expect(r.attendees).toBe(9);
    expect(r.missing.sort()).toEqual(["jana", "petr"]);
  });
});

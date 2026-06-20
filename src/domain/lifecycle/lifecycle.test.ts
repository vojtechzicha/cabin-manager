import { describe, expect, it } from "vitest";

import {
  assertLedgerWritable,
  checkAreaEdge,
  checkAreaTransition,
  checkPhaseTransition,
  isLedgerWritable,
  LedgerLockedError,
  PHASE_ORDER,
  type AreaKind,
  type FinanceState,
  type LifecycleState,
  type TripPhase,
} from "./index";

const baseAreas: Pick<LifecycleState, AreaKind> = {
  datePoll: "open",
  locationPoll: "open",
  roster: "open",
  finance: "open",
};

describe("phase transitions (T-202, PRD §7)", () => {
  it("rejects a no-op (same state)", () => {
    expect(checkPhaseTransition("planning", "planning")).toEqual({ ok: false, reason: "same-state" });
  });

  it("allows advancing forward by one step", () => {
    expect(checkPhaseTransition("draft", "ideation")).toEqual({ ok: true, reversal: false });
  });

  it("allows jumping forward several phases (overlap is fine)", () => {
    expect(checkPhaseTransition("ideation", "finances")).toEqual({ ok: true, reversal: false });
    expect(checkPhaseTransition("draft", "archived")).toEqual({ ok: true, reversal: false });
  });

  it("allows a single-step reversal, flagged as such", () => {
    expect(checkPhaseTransition("finances", "planning")).toEqual({ ok: true, reversal: true });
    expect(checkPhaseTransition("archived", "finances")).toEqual({ ok: true, reversal: true });
  });

  it("rejects jumping backward more than one phase", () => {
    expect(checkPhaseTransition("archived", "planning")).toEqual({
      ok: false,
      reason: "illegal-transition",
    });
    expect(checkPhaseTransition("finances", "ideation")).toEqual({
      ok: false,
      reason: "illegal-transition",
    });
  });

  it("PHASE_ORDER is the canonical 5-phase chain", () => {
    expect(PHASE_ORDER).toEqual(["draft", "ideation", "planning", "finances", "archived"]);
  });
});

describe("poll & roster area edges", () => {
  it("closes and re-opens a date poll (reopen is a reversal)", () => {
    expect(checkAreaEdge("datePoll", "open", "closed")).toEqual({ ok: true, reversal: false });
    expect(checkAreaEdge("datePoll", "closed", "open")).toEqual({ ok: true, reversal: true });
  });

  it("locks and re-opens a roster", () => {
    expect(checkAreaEdge("roster", "open", "locked")).toEqual({ ok: true, reversal: false });
    expect(checkAreaEdge("roster", "locked", "open")).toEqual({ ok: true, reversal: true });
  });

  it("rejects a poll no-op", () => {
    expect(checkAreaEdge("locationPoll", "open", "open")).toEqual({
      ok: false,
      reason: "same-state",
    });
  });
});

describe("finance ledger machine (Open → Settling → Closed)", () => {
  it("advances Open → Settling → Closed", () => {
    expect(checkAreaEdge("finance", "open", "settling")).toEqual({ ok: true, reversal: false });
    expect(checkAreaEdge("finance", "settling", "closed")).toEqual({ ok: true, reversal: false });
  });

  it("never closes without settling first", () => {
    expect(checkAreaEdge("finance", "open", "closed")).toEqual({
      ok: false,
      reason: "skips-settling",
    });
  });

  it("allows explicit reversals (settling→open, closed→settling, closed→open)", () => {
    expect(checkAreaEdge("finance", "settling", "open")).toEqual({ ok: true, reversal: true });
    expect(checkAreaEdge("finance", "closed", "settling")).toEqual({ ok: true, reversal: true });
    expect(checkAreaEdge("finance", "closed", "open")).toEqual({ ok: true, reversal: true });
  });
});

describe("cross-area invariant: can't settle a date that isn't chosen (PRD §7)", () => {
  it("blocks Open → Settling while the date poll is still open", () => {
    expect(checkAreaTransition("finance", "open", "settling", baseAreas)).toEqual({
      ok: false,
      reason: "date-not-chosen",
    });
  });

  it("allows Open → Settling once the date poll is closed", () => {
    expect(
      checkAreaTransition("finance", "open", "settling", { ...baseAreas, datePoll: "closed" }),
    ).toEqual({ ok: true, reversal: false });
  });

  it("does not impose the date precondition on settling→closed", () => {
    expect(checkAreaTransition("finance", "settling", "closed", baseAreas)).toEqual({
      ok: true,
      reversal: false,
    });
  });

  it("leaves poll/roster transitions unaffected by finance preconditions", () => {
    expect(checkAreaTransition("roster", "open", "locked", baseAreas)).toEqual({
      ok: true,
      reversal: false,
    });
  });
});

describe("ledger write guard (PRD §7, §14.7)", () => {
  const states: FinanceState[] = ["open", "settling", "closed"];

  it("permits writes only while Open", () => {
    expect(states.filter(isLedgerWritable)).toEqual(["open"]);
  });

  it("assertLedgerWritable throws for a non-Open ledger", () => {
    expect(() => assertLedgerWritable("open")).not.toThrow();
    for (const s of ["settling", "closed"] as FinanceState[]) {
      expect(() => assertLedgerWritable(s)).toThrowError(LedgerLockedError);
    }
  });

  it("the thrown error carries the offending state", () => {
    try {
      assertLedgerWritable("closed");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(LedgerLockedError);
      expect((err as LedgerLockedError).financeState).toBe("closed");
    }
  });
});

describe("exhaustive area-edge table is internally consistent", () => {
  // Every reachable state should have at least one outgoing edge except where we
  // intend a dead-end; this guards against a typo silently orphaning a state.
  const cases: { area: AreaKind; states: string[] }[] = [
    { area: "datePoll", states: ["open", "closed"] },
    { area: "locationPoll", states: ["open", "closed"] },
    { area: "roster", states: ["open", "locked"] },
    { area: "finance", states: ["open", "settling", "closed"] },
  ];

  for (const { area, states } of cases) {
    it(`${area}: every state can leave its current value`, () => {
      for (const from of states) {
        const reachable = states.filter((to) => to !== from);
        const anyOk = reachable.some(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (to) => checkAreaEdge(area as any, from as any, to as any).ok,
        );
        expect(anyOk, `${area}.${from} has no legal outgoing edge`).toBe(true);
      }
    });
  }

  it("phase chain has no gaps", () => {
    const phases: TripPhase[] = ["draft", "ideation", "planning", "finances", "archived"];
    expect(phases.every((p) => PHASE_ORDER.includes(p))).toBe(true);
  });
});

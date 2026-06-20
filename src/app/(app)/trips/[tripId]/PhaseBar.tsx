import { Button, SectionLabel, StatusBadge, type StatusTone } from "@/components/ui";
import type { Messages } from "@/i18n";
import {
  legalAreaTransitions,
  legalPhaseTransitions,
  type AreaKind,
  type AreaStates,
  type TripPhase,
} from "@/services/lifecycle";
import type { Trip } from "@/payload-types";

import { transitionAreaAction, transitionPhaseAction } from "../actions";

const PHASES: TripPhase[] = ["draft", "ideation", "planning", "finances", "archived"];
const AREAS: AreaKind[] = ["datePoll", "locationPoll", "roster", "finance"];
const AREA_FIELD: Record<AreaKind, keyof Trip> = {
  datePoll: "datePollState",
  locationPoll: "locationPollState",
  roster: "rosterState",
  finance: "financeState",
};

function phaseLabel(m: Messages, p: TripPhase): string {
  return {
    draft: m.lifecycle.phaseDraft,
    ideation: m.lifecycle.phaseIdeation,
    planning: m.lifecycle.phasePlanning,
    finances: m.lifecycle.phaseFinances,
    archived: m.lifecycle.phaseArchived,
  }[p];
}
function areaLabel(m: Messages, a: AreaKind): string {
  return {
    datePoll: m.lifecycle.datePoll,
    locationPoll: m.lifecycle.locationPoll,
    roster: m.lifecycle.roster,
    finance: m.lifecycle.finances,
  }[a];
}
function stateLabel(m: Messages, s: string): string {
  return (
    { open: m.lifecycle.open, closed: m.lifecycle.closed, locked: m.lifecycle.locked, settling: m.lifecycle.settling } as Record<string, string>
  )[s] ?? s;
}
function stateTone(s: string): StatusTone {
  if (s === "closed" || s === "locked") return "settled";
  if (s === "settling") return "due";
  return "neutral";
}
function areaActionLabel(m: Messages, area: AreaKind, to: string): string {
  if (area === "finance") {
    if (to === "settling") return m.lifecycle.startSettling;
    if (to === "closed") return m.lifecycle.closeAccounts;
    return m.lifecycle.reopenAccounts;
  }
  if (area === "roster") return to === "locked" ? m.lifecycle.lock : m.lifecycle.reopen;
  return to === "closed" ? m.lifecycle.close : m.lifecycle.reopen;
}

/**
 * Lifecycle visualization + controls (T-202, the "Odoo status bar" the user
 * asked for). A horizontal phase stepper (Draft▸…▸Archived) with the current
 * phase highlighted and — for organizers — every legally-reachable phase
 * clickable, plus per-area lock chips with their close/lock/re-open actions.
 * Both are driven by the same `domain/lifecycle` state machine that enforces the
 * writes, so the buttons can never offer an illegal move.
 */
export function PhaseBar({
  tripId,
  trip,
  isOrganizer,
  m,
}: {
  tripId: string;
  trip: Trip;
  isOrganizer: boolean;
  m: Messages;
}) {
  const current = (trip.phase ?? "draft") as TripPhase;
  const currentRank = PHASES.indexOf(current);
  const legalPhases = new Set(legalPhaseTransitions(trip).map((t) => t.to));

  return (
    <div className="rounded-card border border-line bg-card p-4">
      <SectionLabel>{m.console.phaseLabel}</SectionLabel>

      {/* Phase stepper */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {PHASES.map((p, i) => {
          const rank = i;
          const isCurrent = p === current;
          const isDone = rank < currentRank;
          const clickable = isOrganizer && legalPhases.has(p);
          const cls =
            "rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors " +
            (isCurrent
              ? "bg-accent text-white"
              : isDone
                ? "bg-accent-soft text-accent-ink"
                : "border border-line bg-card text-muted");
          return (
            <span key={p} className="flex items-center gap-1.5">
              {clickable ? (
                <form action={transitionPhaseAction.bind(null, tripId, p)}>
                  <button type="submit" className={`${cls} hover:opacity-80`}>
                    {phaseLabel(m, p)}
                  </button>
                </form>
              ) : (
                <span className={cls}>{phaseLabel(m, p)}</span>
              )}
              {i < PHASES.length - 1 ? <span className="text-sand">▸</span> : null}
            </span>
          );
        })}
      </div>

      {/* Area locks */}
      <div className="mt-4 flex flex-col divide-y divide-line border-t border-line pt-1">
        {AREAS.map((area) => {
          const state = (trip[AREA_FIELD[area]] as string) ?? "open";
          const targets = isOrganizer ? legalAreaTransitions(trip, area) : [];
          return (
            <div key={area} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span className="text-sm font-semibold">{areaLabel(m, area)}</span>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <StatusBadge tone={stateTone(state)}>{stateLabel(m, state)}</StatusBadge>
                {targets.map((t) => (
                  <form
                    key={t.to}
                    action={transitionAreaAction.bind(null, tripId, area, t.to as AreaStates[AreaKind])}
                  >
                    <Button
                      variant={t.reversal ? "secondary" : "primary"}
                      type="submit"
                      className="px-3 py-1.5 text-[13px]"
                    >
                      {areaActionLabel(m, area, t.to)}
                    </Button>
                  </form>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

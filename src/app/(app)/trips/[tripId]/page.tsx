import Link from "next/link";
import type { ReactNode } from "react";

import { Card, Hero, SectionLabel, Sheet } from "@/components/ui";
import { getTranslator } from "@/i18n";
import type { Messages } from "@/i18n";
import { getRequestLocale } from "@/i18n/server";
import { auditEntriesForTrip } from "@/services/audit";
import { getMembership, listMemberships } from "@/services/trips";
import { ORGANIZER_ROLES } from "@/access";
import type { AuditEntry, Membership, Trip } from "@/payload-types";

import { getCurrentIdentity } from "../../auth/current-user";
import { PhaseBar } from "./PhaseBar";

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function memberName(member: Membership): string {
  const identity = member.identity;
  const populated = identity && typeof identity === "object" ? identity : null;
  return member.displayName ?? populated?.displayName ?? populated?.email ?? "—";
}

/** Split a trip name into two display lines for the hero. */
function titleLines(name: string): [string, string] {
  const words = name.trim().split(/\s+/);
  if (words.length < 2) return [name, ""];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

function daysUntil(date?: string | null): number | null {
  if (!date) return null;
  const ms = new Date(date).getTime() - Date.now();
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}

function StatCard({
  icon,
  label,
  value,
  sub,
  href,
  muted,
}: {
  icon: string;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  href?: string;
  muted?: boolean;
}) {
  const body = (
    <div
      className={`h-full rounded-2xl border border-line bg-card p-3.5 ${muted ? "opacity-70" : ""} ${
        href ? "transition-shadow hover:shadow-[0_10px_22px_-16px_rgba(20,30,25,.4)]" : ""
      }`}
    >
      <div className="text-lg">{icon}</div>
      <SectionLabel className="mt-1.5">{label}</SectionLabel>
      <div className="mt-0.5 text-[15px] font-bold">{value}</div>
      {sub ? <div className="text-[11px] text-muted">{sub}</div> : null}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function datesValue(m: Messages, locale: string, trip: Trip): string {
  const start = trip.dates?.start;
  if (!start) return m.console.dashDatesTbd;
  const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const end = trip.dates?.end;
  return end ? `${fmt.format(new Date(start))} – ${fmt.format(new Date(end))}` : fmt.format(new Date(start));
}

function phaseName(m: Messages, phase: string): string {
  return (
    {
      draft: m.lifecycle.phaseDraft,
      ideation: m.lifecycle.phaseIdeation,
      planning: m.lifecycle.phasePlanning,
      finances: m.lifecycle.phaseFinances,
      archived: m.lifecycle.phaseArchived,
    } as Record<string, string>
  )[phase] ?? phase;
}

function areaName(m: Messages, area: string): string {
  return (
    {
      datePoll: m.lifecycle.datePoll,
      locationPoll: m.lifecycle.locationPoll,
      roster: m.lifecycle.roster,
      finance: m.lifecycle.finances,
    } as Record<string, string>
  )[area] ?? area;
}

function stateName(m: Messages, s: string): string {
  return (
    { open: m.lifecycle.open, closed: m.lifecycle.closed, locked: m.lifecycle.locked, settling: m.lifecycle.settling } as Record<string, string>
  )[s] ?? s;
}

function identityIdOf(member: Membership): string | null {
  const id = member.identity;
  if (!id) return null;
  return typeof id === "object" ? id.id : id;
}

/** Resolve an audit actor to a display name, falling back to a generic label. */
function actorNameOf(entry: AuditEntry, nameById: Map<string, string>, m: Messages): string {
  const actor = entry.actor;
  if (actor && typeof actor === "object") {
    return actor.displayName ?? actor.email ?? m.pulse.someone;
  }
  if (typeof actor === "string") return nameById.get(actor) ?? m.pulse.someone;
  return m.pulse.someone;
}

/** Turn one audit entry into a localized "Trip pulse" line, or null to skip it. */
function pulseLine(m: Messages, entry: AuditEntry, actorName: string): string | null {
  const md = (entry.metadata ?? {}) as Record<string, unknown>;
  const fill = (template: string, extra: Record<string, string> = {}): string =>
    Object.entries({ actor: actorName, ...extra }).reduce(
      (acc, [k, v]) => acc.replace(`{${k}}`, v),
      template,
    );
  switch (entry.action) {
    case "lifecycle.transition":
      if (md.kind === "phase") {
        return fill(m.pulse.movedTo, { phase: phaseName(m, String(md.to ?? "")) });
      }
      if (md.kind === "area") {
        return fill(m.pulse.areaUpdate, {
          area: areaName(m, String(md.area ?? "")),
          state: stateName(m, String(md.to ?? "")),
        });
      }
      return null;
    case "deposit.confirmed":
      return fill(m.pulse.depositPaid);
    case "finance.expense.edited":
      return fill(m.pulse.expenseEdited);
    case "finance.accounts.closed":
      return fill(m.pulse.accountsClosed);
    case "finance.accounts.reopened":
      return fill(m.pulse.accountsReopened);
    default:
      return null;
  }
}

export default async function TripDashboardPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const locale = await getRequestLocale();
  const { m } = getTranslator(locale);
  const { payload, identity } = await getCurrentIdentity();

  const trip = (await payload.findByID({
    collection: "trips",
    id: tripId,
    overrideAccess: true,
    depth: 1,
  })) as Trip;

  const membership = identity ? await getMembership(payload, tripId, identity.id) : null;
  const isOrganizer =
    (membership?.role != null && (ORGANIZER_ROLES as readonly string[]).includes(membership.role)) ||
    identity?.role === "admin";

  const roster = await listMemberships(payload, tripId);
  const active = roster.filter((r) => r.status === "active");
  const confirmed = active.filter((r) => r.confirmed).length;
  const areas = trip.enabledAreas ?? {};
  const days = daysUntil(trip.dates?.start);

  const crowd = active.slice(0, 5).map((mem) => ({ initials: initialsOf(memberName(mem)), name: memberName(mem) }));

  // Real activity feed ("Trip pulse") — newest lifecycle/finance events from the audit log.
  const nameById = new Map<string, string>();
  for (const mem of roster) {
    const id = identityIdOf(mem);
    if (id) nameById.set(id, memberName(mem));
  }
  const auditLog = await auditEntriesForTrip(payload, tripId, 12);
  const pulse = auditLog
    .map((entry) => pulseLine(m, entry, actorNameOf(entry, nameById, m)))
    .filter((line): line is string => line != null)
    .slice(0, 4);

  const datesLocked = trip.datePollState === "closed";

  return (
    <>
      <Hero
        backHref="/"
        backLabel={m.console.backToTrips}
        location={trip.location ?? ""}
        titleLines={titleLines(trip.name)}
        daysToGo={days ?? 0}
        daysToGoLabel={days != null ? m.console.dashDates : m.console.dashDatesTbd}
        crowd={{ members: crowd, extra: Math.max(0, active.length - crowd.length) }}
        goingLabel={m.console.dashGoing.replace("{count}", String(active.length))}
        ringColor="var(--accent)"
      />

      <Sheet className="pb-8">
        <div className="flex flex-col gap-4 pt-1">
          {/* Stat grid — the trip at a glance (design §A). */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              icon="📅"
              label={m.console.dashDates}
              value={datesValue(m, locale, trip)}
              sub={
                datesLocked ? (
                  <span className="font-semibold text-accent-ink">● {m.console.dashLocked}</span>
                ) : undefined
              }
            />
            <StatCard
              icon="👥"
              label={m.console.dashRoster}
              value={String(active.length)}
              sub={confirmed > 0 ? `${confirmed} ${m.people.confirmed.toLowerCase()}` : undefined}
              href={isOrganizer ? `/trips/${tripId}/people` : undefined}
            />
            {areas.sleeping ? (
              <StatCard icon="🛏" label={m.console.areaSleeping} value={m.console.dashSetup} muted />
            ) : null}
            {areas.finances ? (
              <StatCard icon="💸" label={m.console.areaFinances} value={m.console.dashSetup} muted />
            ) : null}
            {areas.lists ? (
              <StatCard icon="🎒" label={m.console.areaLists} value={m.console.dashSetup} muted />
            ) : null}
            {areas.deposit ? (
              <StatCard icon="🔒" label={m.console.areaDeposit} value={m.console.dashSetup} muted />
            ) : null}
          </div>

          {/* Trip pulse — real recent activity from the audit log (design §A). */}
          {pulse.length > 0 ? (
            <Card>
              <SectionLabel>{m.pulse.title}</SectionLabel>
              <ul className="mt-2.5 flex flex-col gap-2">
                {pulse.map((line, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-[13px] text-ink/80">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {line}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {/* Organizer console — the lifecycle "status bar". Navigation (Info /
              People / Settings) lives in the shell, so it isn't duplicated here. */}
          {isOrganizer ? (
            <PhaseBar tripId={tripId} trip={trip} isOrganizer={isOrganizer} m={m} />
          ) : null}
        </div>
      </Sheet>
    </>
  );
}

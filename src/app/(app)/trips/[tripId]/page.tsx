import Link from "next/link";
import type { ReactNode } from "react";

import { Card, Hero, SectionLabel, Sheet } from "@/components/ui";
import { getTranslator } from "@/i18n";
import type { Messages } from "@/i18n";
import { getRequestLocale } from "@/i18n/server";
import { getMembership, listMemberships } from "@/services/trips";
import { ORGANIZER_ROLES } from "@/access";
import type { Membership, Trip } from "@/payload-types";

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
          <PhaseBar tripId={tripId} trip={trip} isOrganizer={isOrganizer} m={m} />

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon="📅" label={m.console.dashDates} value={datesValue(m, locale, trip)} />
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

          <Card className="flex flex-wrap items-center justify-between gap-3">
            <SectionLabel>{m.console.info}</SectionLabel>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/trips/${tripId}/info`}
                className="rounded-btn border border-line px-4 py-2 text-sm font-semibold"
              >
                {m.console.info}
              </Link>
              {isOrganizer ? (
                <>
                  <Link
                    href={`/trips/${tripId}/people`}
                    className="rounded-btn border border-line px-4 py-2 text-sm font-semibold"
                  >
                    {m.console.people}
                  </Link>
                  <Link
                    href={`/trips/${tripId}/settings`}
                    className="rounded-btn border border-line px-4 py-2 text-sm font-semibold"
                  >
                    {m.console.settings}
                  </Link>
                </>
              ) : null}
            </div>
          </Card>
        </div>
      </Sheet>
    </>
  );
}

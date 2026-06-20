import { redirect } from "next/navigation";

import { Card, PageHero, SectionLabel } from "@/components/ui";
import { getTranslator } from "@/i18n";
import { getRequestLocale } from "@/i18n/server";
import { identityOrganizesTrip, listMemberships } from "@/services/trips";
import type { Media, Membership, Trip } from "@/payload-types";

import { getCurrentIdentity } from "../../../auth/current-user";
import { SettingsForm } from "./SettingsForm";
import { BankerForm } from "./BankerForm";

function memberName(member: Membership): string {
  const identity = member.identity;
  const populated = identity && typeof identity === "object" ? identity : null;
  return member.displayName ?? populated?.displayName ?? populated?.email ?? "—";
}

function coverUrl(trip: Trip): string | null {
  const cover = trip.theme?.coverMedia;
  if (cover && typeof cover === "object") return (cover as Media).url ?? null;
  return trip.theme?.coverImage ?? null;
}

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const locale = await getRequestLocale();
  const { m } = getTranslator(locale);
  const { payload, identity } = await getCurrentIdentity();

  if (!identity || !(await identityOrganizesTrip(payload, tripId, identity.id))) {
    redirect(`/trips/${tripId}`);
  }

  const trip = (await payload.findByID({
    collection: "trips",
    id: tripId,
    overrideAccess: true,
    depth: 1,
  })) as Trip;
  const areas = trip.enabledAreas ?? {};
  const roster = (await listMemberships(payload, tripId)).filter((mem) => mem.status === "active");
  const bankerRel = trip.banker?.membership;
  const bankerId = bankerRel ? String(typeof bankerRel === "object" ? bankerRel.id : bankerRel) : null;

  return (
    <>
      <PageHero backHref={`/trips/${tripId}`} kicker={trip.shortName} title={m.console.settings} />

      <div className="flex flex-col gap-4 px-5 pt-6 lg:px-8">
        <SettingsForm
          tripId={tripId}
          initial={{
            name: trip.name,
            shortName: trip.shortName,
            location: trip.location ?? "",
            description: trip.description ?? "",
            accent: trip.theme?.color ?? null,
            icon: trip.theme?.icon ?? null,
            coverUrl: coverUrl(trip),
            areas: {
              voting: areas.voting ?? false,
              sleeping: areas.sleeping ?? false,
              transport: areas.transport ?? false,
              lists: areas.lists ?? false,
              finances: areas.finances ?? false,
              deposit: areas.deposit ?? false,
            },
            depositEnabled: trip.deposit?.enabled ?? false,
          }}
        />

        <Card className="flex flex-col gap-3">
          <SectionLabel>{m.settings.banker}</SectionLabel>
          <BankerForm
            tripId={tripId}
            members={roster.map((mem) => ({ id: String(mem.id), name: memberName(mem) }))}
            initial={{
              bankerId,
              account: trip.banker?.bankAccount ?? null,
              iban: trip.banker?.iban ?? null,
            }}
          />
        </Card>
      </div>
    </>
  );
}

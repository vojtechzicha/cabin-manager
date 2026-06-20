import Link from "next/link";

import { Card, PageHero, SectionLabel } from "@/components/ui";
import { getTranslator } from "@/i18n";
import { getRequestLocale } from "@/i18n/server";
import { getTripContent } from "@/services/trip-content";
import { identityOrganizesTrip } from "@/services/trips";
import type { Trip } from "@/payload-types";

import { getCurrentIdentity } from "../../../auth/current-user";

/**
 * Trip info & content — participant read view (T-203, PRD §8.7). Content is
 * shown *as authored*; only the surrounding labels are localized. Organizers get
 * an Edit affordance; everyone else reads.
 */
export default async function TripInfoPage({
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
  })) as Trip;
  const content = await getTripContent(payload, tripId);
  const isOrganizer =
    !!identity && (await identityOrganizesTrip(payload, tripId, identity.id));

  const dest = content?.destination;
  const editLink = isOrganizer ? (
    <Link
      href={`/trips/${tripId}/info/edit`}
      className="rounded-btn border border-white/40 px-3 py-1.5 text-[13px] font-semibold text-white"
    >
      {m.info.edit}
    </Link>
  ) : undefined;

  if (!content) {
    return (
      <>
        <PageHero backHref={`/trips/${tripId}`} kicker={trip.shortName} title={m.info.title} right={editLink} />
        <div className="px-5 pt-6 lg:px-8">
          <Card className="text-center">
            <div className="display text-xl font-bold">{m.info.empty}</div>
            <p className="mt-1 text-sm text-muted">{m.info.emptyHint}</p>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHero
        backHref={`/trips/${tripId}`}
        kicker={dest?.location ?? trip.shortName}
        title={dest?.name ?? m.info.title}
        right={editLink}
      />

      <div className="flex flex-col gap-4 px-5 pt-6 lg:px-8">
        {dest?.mapUrl ? (
          <a
            href={dest.mapUrl}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 items-center justify-center gap-2 rounded-btn bg-accent-soft text-sm font-semibold text-accent-ink"
          >
            📍 {m.info.openMap}
          </a>
        ) : null}

        {dest?.description ? <p className="text-sm text-ink/80">{dest.description}</p> : null}

        {dest?.basicInfo && dest.basicInfo.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {dest.basicInfo.map((row, i) => (
              <Card key={row.id ?? i} className="p-3.5">
                <div className="mono text-[9px] uppercase tracking-[0.1em] text-muted">{row.label}</div>
                <div className="mt-0.5 font-bold">{row.value}</div>
              </Card>
            ))}
          </div>
        ) : null}

        {content.directions && content.directions.length > 0 ? (
          <Card>
            <SectionLabel>{m.info.directions}</SectionLabel>
            <div className="mt-2 flex flex-col divide-y divide-line">
              {content.directions.map((d, i) => (
                <div key={d.id ?? i} className="py-2 first:pt-0">
                  <div className="text-sm font-semibold">{d.origin}</div>
                  <div className="mono text-[12px] text-muted">
                    {[d.duration, d.distance].filter(Boolean).join(" · ")}
                  </div>
                  {d.notes ? <div className="text-[13px] text-ink/75">{d.notes}</div> : null}
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {content.parking ? (
          <Card>
            <SectionLabel>{m.info.parking}</SectionLabel>
            <p className="mt-1 text-sm text-ink/80">{content.parking}</p>
          </Card>
        ) : null}

        {content.publicTransport && content.publicTransport.length > 0 ? (
          <Card>
            <SectionLabel>{m.info.publicTransport}</SectionLabel>
            <div className="mt-2 flex flex-col divide-y divide-line">
              {content.publicTransport.map((p, i) => (
                <div key={p.id ?? i} className="py-2 first:pt-0">
                  <div className="text-sm font-semibold">{p.line}</div>
                  <div className="mono text-[12px] text-muted">
                    {[p.from, p.to].filter(Boolean).join(" → ")}
                    {p.departs || p.arrives
                      ? ` · ${[p.departs, p.arrives].filter(Boolean).join("–")}`
                      : ""}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {dest?.goodToKnow && dest.goodToKnow.length > 0 ? (
          <Card>
            <SectionLabel>{m.info.goodToKnow}</SectionLabel>
            <ul className="mt-2 flex flex-col gap-1.5">
              {dest.goodToKnow.map((g, i) => (
                <li key={g.id ?? i} className="flex gap-2 text-[13px] text-ink/80">
                  <span className="text-accent">•</span>
                  {g.text}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {content.notes ? (
          <Card>
            <SectionLabel>{m.info.notes}</SectionLabel>
            <p className="mt-1 whitespace-pre-line text-sm text-ink/80">{content.notes}</p>
          </Card>
        ) : null}
      </div>
    </>
  );
}

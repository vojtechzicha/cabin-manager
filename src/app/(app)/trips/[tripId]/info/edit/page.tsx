import { redirect } from "next/navigation";

import { Button, Card, Field, Input, PageHero, SectionLabel } from "@/components/ui";
import { RepeatableRows } from "@/components/RepeatableRows";
import { getTranslator } from "@/i18n";
import { getRequestLocale } from "@/i18n/server";
import { getTripContent } from "@/services/trip-content";
import { identityOrganizesTrip } from "@/services/trips";
import type { Trip } from "@/payload-types";

import { getCurrentIdentity } from "../../../../auth/current-user";
import { saveTripInfoAction } from "../../../actions";

const TEXTAREA =
  "rounded-btn border border-line bg-card px-3.5 py-2.5 text-sm outline-none focus:border-accent";

/**
 * Trip info editor (T-203) — organizer-only. Scalar destination fields are plain
 * inputs; the repeating lists (basic info, directions, public transport, good to
 * know) use the structured `RepeatableRows` editor (add/remove typed rows), which
 * serializes JSON for `saveTripInfoAction`. Saving upserts the single content row
 * and returns to the read view.
 */
export default async function TripInfoEditPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const locale = await getRequestLocale();
  const { m } = getTranslator(locale);
  const { payload, identity } = await getCurrentIdentity();

  if (!identity || !(await identityOrganizesTrip(payload, tripId, identity.id))) {
    redirect(`/trips/${tripId}/info`);
  }

  const trip = (await payload.findByID({
    collection: "trips",
    id: tripId,
    overrideAccess: true,
  })) as Trip;
  const content = await getTripContent(payload, tripId);
  const d = content?.destination;

  const basicInfo = (d?.basicInfo ?? []).map((r) => ({ label: r.label, value: r.value }));
  const goodToKnow = (d?.goodToKnow ?? []).map((g) => ({ text: g.text }));
  const directions = (content?.directions ?? []).map((r) => ({
    origin: r.origin,
    duration: r.duration ?? "",
    distance: r.distance ?? "",
    notes: r.notes ?? "",
  }));
  const publicTransport = (content?.publicTransport ?? []).map((r) => ({
    line: r.line,
    from: r.from ?? "",
    to: r.to ?? "",
    departs: r.departs ?? "",
    arrives: r.arrives ?? "",
  }));

  return (
    <>
      <PageHero backHref={`/trips/${tripId}/info`} kicker={trip.shortName} title={m.info.edit} />

      <form
        action={saveTripInfoAction.bind(null, tripId)}
        className="flex flex-col gap-4 px-5 pt-6 lg:px-8"
      >
        <Card className="flex flex-col gap-4">
          <SectionLabel>{m.info.destination}</SectionLabel>
          <Field label={m.info.name} htmlFor="destName">
            <Input id="destName" name="destName" defaultValue={d?.name ?? ""} />
          </Field>
          <Field label={m.info.location} htmlFor="destLocation">
            <Input id="destLocation" name="destLocation" defaultValue={d?.location ?? ""} />
          </Field>
          <Field label={m.info.mapUrl} htmlFor="destMapUrl">
            <Input id="destMapUrl" name="destMapUrl" defaultValue={d?.mapUrl ?? ""} />
          </Field>
          <Field label={m.info.description} htmlFor="destDescription">
            <textarea
              id="destDescription"
              name="destDescription"
              rows={3}
              defaultValue={d?.description ?? ""}
              className={TEXTAREA}
            />
          </Field>
          <div className="flex flex-col gap-1.5">
            <SectionLabel>{m.info.basicInfo}</SectionLabel>
            <RepeatableRows
              name="basicInfo"
              initial={basicInfo}
              addLabel={m.info.addFact}
              columns={[
                { key: "label", label: m.info.colLabel },
                { key: "value", label: m.info.colValue },
              ]}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <SectionLabel>{m.info.goodToKnow}</SectionLabel>
            <RepeatableRows
              name="goodToKnow"
              initial={goodToKnow}
              addLabel={m.info.addNote}
              columns={[{ key: "text", label: m.info.colBullet }]}
            />
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <SectionLabel>{m.info.gettingThere}</SectionLabel>
          <div className="flex flex-col gap-1.5">
            <SectionLabel>{m.info.directions}</SectionLabel>
            <RepeatableRows
              name="directions"
              initial={directions}
              addLabel={m.info.addDirection}
              columns={[
                { key: "origin", label: m.info.colOrigin },
                { key: "duration", label: m.info.colDuration },
                { key: "distance", label: m.info.colDistance },
                { key: "notes", label: m.info.colNotes },
              ]}
            />
          </div>
          <Field label={m.info.parking} htmlFor="parking">
            <Input id="parking" name="parking" defaultValue={content?.parking ?? ""} />
          </Field>
          <div className="flex flex-col gap-1.5">
            <SectionLabel>{m.info.publicTransport}</SectionLabel>
            <RepeatableRows
              name="publicTransport"
              initial={publicTransport}
              addLabel={m.info.addTransport}
              columns={[
                { key: "line", label: m.info.colLine },
                { key: "from", label: m.info.colFrom },
                { key: "to", label: m.info.colTo },
                { key: "departs", label: m.info.colDeparts },
                { key: "arrives", label: m.info.colArrives },
              ]}
            />
          </div>
        </Card>

        <Card className="flex flex-col gap-2">
          <SectionLabel>{m.info.notes}</SectionLabel>
          <textarea name="notes" rows={3} defaultValue={content?.notes ?? ""} className={TEXTAREA} />
        </Card>

        <Button type="submit" className="self-start">
          {m.info.save}
        </Button>
      </form>
    </>
  );
}

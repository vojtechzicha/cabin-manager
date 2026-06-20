import { redirect } from "next/navigation";

import { Button, Card, PageHero, SectionLabel, StatusBadge } from "@/components/ui";
import { CopyField } from "@/components/CopyField";
import { InviteForm } from "@/components/InviteForm";
import { getTranslator } from "@/i18n";
import type { Messages } from "@/i18n";
import { getRequestLocale } from "@/i18n/server";
import { listJoinRequests } from "@/services/invitations";
import { openJoinUrl } from "@/services/urls";
import { getMembership, listMemberships } from "@/services/trips";
import { ORGANIZER_ROLES } from "@/access";
import type { Identity, Membership, Trip } from "@/payload-types";

import { getCurrentIdentity } from "../../../auth/current-user";
import {
  approveJoinAction,
  createInviteAction,
  setOpenJoinAction,
  setRoleAction,
} from "../../actions";

function roleLabel(m: Messages, role: string | null | undefined): string {
  if (role === "organizer") return m.home.roleOrganizer;
  if (role === "co-organizer") return m.home.roleCoOrganizer;
  return m.home.roleParticipant;
}

function memberName(membership: Membership): string {
  const identity = membership.identity;
  const populated = identity && typeof identity === "object" ? identity : null;
  return membership.displayName ?? populated?.displayName ?? populated?.email ?? "—";
}

export default async function PeoplePage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const locale = await getRequestLocale();
  const { m } = getTranslator(locale);
  const { payload, identity } = await getCurrentIdentity();

  if (!identity) redirect(`/sign-in?next=${encodeURIComponent(`/trips/${tripId}/people`)}`);
  const membership = await getMembership(payload, tripId, identity.id);
  if (!membership || membership.status !== "active") redirect(`/trips/${tripId}`);
  // Every member sees the roster (read-only); only organizers get the management
  // controls below (PRD §5: members read the roster, organizers manage it).
  const isOrganizer = (ORGANIZER_ROLES as readonly string[]).includes(membership.role ?? "");

  const trip = (await payload.findByID({
    collection: "trips",
    id: tripId,
    overrideAccess: true,
  })) as Trip;
  const roster = await listMemberships(payload, tripId);
  const requests = isOrganizer ? await listJoinRequests(payload, tripId) : [];
  const openJoinOn = isOrganizer && (trip.invites?.openJoinEnabled ?? false);
  const autoAccept = trip.invites?.openJoinAutoAccept ?? false;
  const openJoinLink =
    isOrganizer && trip.invites?.openJoinToken ? openJoinUrl(trip.invites.openJoinToken) : null;

  const selfId = (identity as Identity).id;
  const identityId = (membership: Membership): string | null => {
    const i = membership.identity;
    if (!i) return null;
    return typeof i === "object" ? String(i.id) : String(i);
  };

  return (
    <>
      <PageHero backHref={`/trips/${tripId}`} kicker={trip.shortName} title={m.console.people} />

      <div className="flex flex-col gap-4 px-5 pt-6 lg:px-8">
        {/* Approval queue (organizers only) */}
        {isOrganizer ? (
          <Card>
            <SectionLabel>{m.people.approvalQueue}</SectionLabel>
            {requests.length === 0 ? (
              <p className="mt-2 text-sm text-muted">{m.people.noRequests}</p>
            ) : (
              <div className="mt-3 flex flex-col divide-y divide-line">
                {requests.map((req) => (
                  <div key={req.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                    <div className="text-sm font-semibold">{memberName(req)}</div>
                    <form action={approveJoinAction.bind(null, tripId, String(req.id))}>
                      <Button type="submit" className="px-3 py-1.5 text-[13px]">
                        {m.people.approve}
                      </Button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ) : null}

        {/* Roster — visible to every member */}
        <Card>
          <SectionLabel>{m.people.roster}</SectionLabel>
          <div className="mt-3 flex flex-col divide-y divide-line">
            {roster.map((member) => {
              const mid = identityId(member);
              const isSelf = mid != null && mid === String(selfId);
              // This row's role — distinct from `isOrganizer` (the viewer's powers).
              const memberIsOrganizer = member.role === "organizer" || member.role === "co-organizer";
              return (
                <div
                  key={member.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">
                      {memberName(member)}
                      {isSelf ? <span className="ml-1 text-muted">· {m.people.you}</span> : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-ink">
                        {roleLabel(m, member.role)}
                      </span>
                      {member.isBanker ? (
                        <StatusBadge tone="neutral" glyph={false}>
                          {m.people.banker}
                        </StatusBadge>
                      ) : null}
                      {member.status === "pending" ? (
                        <StatusBadge tone="provisional">{m.people.pendingInvite}</StatusBadge>
                      ) : member.confirmed ? (
                        <StatusBadge tone="confirmed">{m.people.confirmed}</StatusBadge>
                      ) : null}
                    </div>
                  </div>
                  {isOrganizer && !isSelf && member.status === "active" ? (
                    <form
                      action={setRoleAction.bind(
                        null,
                        tripId,
                        String(member.id),
                        memberIsOrganizer ? "participant" : "co-organizer",
                      )}
                    >
                      <Button variant="secondary" type="submit" className="px-3 py-1.5 text-[13px]">
                        {memberIsOrganizer ? m.people.makeParticipant : m.people.makeCoOrganizer}
                      </Button>
                    </form>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Direct invite (organizers only) */}
        {isOrganizer ? (
        <Card>
          <SectionLabel>{m.people.invite}</SectionLabel>
          <div className="mt-3">
            <InviteForm action={createInviteAction.bind(null, tripId)} />
          </div>
        </Card>
        ) : null}

        {/* Open-join link (organizers only) */}
        {isOrganizer ? (
        <Card>
          <div className="flex items-center justify-between">
            <SectionLabel>{m.people.openJoin}</SectionLabel>
            <StatusBadge tone={openJoinOn ? "confirmed" : "neutral"} glyph={openJoinOn}>
              {openJoinOn ? m.people.openJoinOn : m.people.openJoinOff}
            </StatusBadge>
          </div>
          {!openJoinOn ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={setOpenJoinAction.bind(null, tripId, true, false)}>
                <Button type="submit" className="px-3 py-1.5 text-[13px]">
                  {m.people.enable}
                </Button>
              </form>
              <form action={setOpenJoinAction.bind(null, tripId, true, true)}>
                <Button variant="secondary" type="submit" className="px-3 py-1.5 text-[13px]">
                  {m.people.enable} · {m.people.autoAccept}
                </Button>
              </form>
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              {openJoinLink ? (
                <div className="flex flex-col gap-1.5">
                  <SectionLabel>{m.people.openJoinShare}</SectionLabel>
                  <CopyField value={openJoinLink} />
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <span className="self-center text-[13px] text-muted">
                  {m.people.autoAccept}: {autoAccept ? m.people.openJoinOn : m.people.openJoinOff}
                </span>
                {/* Regenerate rotates the token (keeps the current auto-accept). */}
                <form action={setOpenJoinAction.bind(null, tripId, true, autoAccept)}>
                  <Button variant="secondary" type="submit" className="px-3 py-1.5 text-[13px]">
                    {m.people.newLink}
                  </Button>
                </form>
                <form action={setOpenJoinAction.bind(null, tripId, false, false)}>
                  <Button variant="secondary" type="submit" className="px-3 py-1.5 text-[13px]">
                    {m.people.disable}
                  </Button>
                </form>
              </div>
            </div>
          )}
        </Card>
        ) : null}
      </div>
    </>
  );
}

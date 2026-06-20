import { Avatar } from "@/components/Avatar";
import { Button, Card, PageHero, SectionLabel, Sheet } from "@/components/ui";
import { getTranslator, interpolate } from "@/i18n";
import type { Messages } from "@/i18n";
import { getRequestLocale } from "@/i18n/server";
import {
  getPoll,
  listOptions,
  listVotes,
  rankWindows,
  type PollKind,
  type PollMethod,
  type RankedDateOption,
} from "@/services/polls";
import { getMembership, identityOrganizesTrip, listMemberships } from "@/services/trips";
import type { Membership, PollOption, Trip, Vote } from "@/payload-types";

import { getCurrentIdentity } from "../../../auth/current-user";
import {
  addOptionAction,
  castVoteAction,
  closePollAction,
  moderateOptionAction,
  publishPollAction,
  reopenPollAction,
  setPollMethodAction,
  suggestOptionAction,
} from "../../actions";

// ── helpers ─────────────────────────────────────────────────────────────────

const relId = (v: unknown): string =>
  v && typeof v === "object" ? String((v as { id: string | number }).id) : String(v);

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

function memberName(m: Membership): string {
  const id = m.identity;
  const populated = id && typeof id === "object" ? id : null;
  return m.displayName ?? populated?.displayName ?? populated?.email ?? "—";
}

/** "21–28 Jun" style label for a date window (falls back to the stored label). */
function windowLabel(locale: string, o: PollOption): string {
  if (o.dateStart) {
    const f = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
    const s = f.format(new Date(o.dateStart));
    return o.dateEnd ? `${s} – ${f.format(new Date(o.dateEnd))}` : s;
  }
  return o.label ?? "—";
}

type Val = "yes" | "ifneeded" | "no";

/** Index votes as option → membership → value. */
function indexVotes(votes: Vote[]): Map<string, Map<string, Val>> {
  const m = new Map<string, Map<string, Val>>();
  for (const v of votes) {
    const o = relId(v.option);
    const inner = m.get(o) ?? new Map<string, Val>();
    inner.set(relId(v.membership), v.value as Val);
    m.set(o, inner);
  }
  return m;
}

function tallyOf(byMember: Map<string, Val> | undefined): { yes: number; ifneeded: number; no: number } {
  const t = { yes: 0, ifneeded: 0, no: 0 };
  if (byMember) for (const val of byMember.values()) t[val]++;
  return t;
}

/**
 * Count voters who have *finished* the poll — every visible option answered
 * (approval / grid), or a single pick made (single choice) — not merely those
 * who cast any one vote.
 */
function countFinished(votes: Vote[], requiredOptions: number): number {
  const byVoter = new Map<string, Set<string>>();
  for (const v of votes) {
    const set = byVoter.get(relId(v.membership)) ?? new Set<string>();
    set.add(relId(v.option));
    byVoter.set(relId(v.membership), set);
  }
  let done = 0;
  for (const answered of byVoter.values()) if (answered.size >= requiredOptions) done++;
  return done;
}

// ── small presentational pieces ─────────────────────────────────────────────

function StatusChip({ label, tone, sub }: { label: string; tone: "draft" | "open" | "closed"; sub: string }) {
  const dot = tone === "open" ? "#2f9e73" : tone === "closed" ? "#756f64" : "#e8a93b";
  const color = tone === "open" ? "text-[#15623f]" : tone === "closed" ? "text-muted" : "text-[#8a6410]";
  return (
    <div className="flex-1 rounded-[13px] border border-line bg-card px-3 py-2.5">
      <div className="text-[13px] font-bold">{label}</div>
      <div className={`mt-0.5 flex items-center gap-1.5 text-[11px] ${color}`}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
        {sub}
      </div>
    </div>
  );
}

/** Method segmented control — each segment is a bound server-action form. */
function MethodToggle({
  tripId,
  kind,
  current,
  methods,
  m,
}: {
  tripId: string;
  kind: PollKind;
  current: PollMethod;
  methods: { value: PollMethod; label: string }[];
  m: Messages;
}) {
  return (
    <div>
      <SectionLabel className="mb-2">{m.voting.method}</SectionLabel>
      <div className="flex gap-1.5 rounded-[13px] bg-line p-1">
        {methods.map((opt) => {
          const active = opt.value === current;
          return (
            <form key={opt.value} action={setPollMethodAction.bind(null, tripId, kind, opt.value)} className="flex-1">
              <button
                type="submit"
                className={`w-full rounded-[10px] py-2 text-[13px] transition-colors ${
                  active ? "bg-card font-bold text-accent-ink shadow-[0_2px_6px_-3px_rgba(20,30,25,.3)]" : "font-semibold text-sand"
                }`}
              >
                {opt.label}
              </button>
            </form>
          );
        })}
      </div>
    </div>
  );
}

// ── Optimal panel (organizer) ───────────────────────────────────────────────

function OptimalPanel({
  tripId,
  ranked,
  optionsById,
  nameById,
  locale,
  m,
  closable,
}: {
  tripId: string;
  ranked: RankedDateOption[];
  optionsById: Map<string, PollOption>;
  nameById: Map<string, string>;
  locale: string;
  m: Messages;
  closable: boolean;
}) {
  const top = ranked.slice(0, 3);
  if (top.length === 0) return null;
  return (
    <div>
      <SectionLabel className="mb-2">{closable ? m.voting.rankedWindows : m.voting.optimalSoFar}</SectionLabel>
      <div className="flex flex-col gap-2">
        {top.map((r, i) => {
          const opt = optionsById.get(r.id);
          const label = opt ? windowLabel(locale, opt) : r.id;
          const missingNames = r.missing.map((id) => nameById.get(id) ?? "—").join(", ");
          const winner = i === 0;
          return (
            <div
              key={r.id}
              className={`rounded-2xl border p-3.5 ${
                winner ? "border-transparent bg-gradient-to-br from-accent to-accent-ink text-white shadow-[0_12px_24px_-14px_var(--accent)]" : "border-line bg-card"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {winner ? <span>★</span> : null}
                  <span className="mono text-[14px] font-bold">{label}</span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    winner ? "bg-white/20" : "bg-accent-soft text-accent-ink"
                  }`}
                >
                  {interpolate(m.voting.rankScore, { rank: r.rank, score: r.score }, locale)}
                </span>
              </div>
              <div className={`mt-2 h-2 overflow-hidden rounded-full ${winner ? "bg-white/25" : "bg-paper"}`}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${r.score}%`, background: winner ? "#fff" : "var(--accent)" }}
                />
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <span className={`text-[11px] ${winner ? "opacity-95" : "font-semibold text-[#15623f]"}`}>
                  {interpolate(m.voting.canCome, { count: r.attendees }, locale)}
                </span>
                {closable ? (
                  <form action={closePollAction.bind(null, tripId, "date" as PollKind, r.id)}>
                    <button
                      type="submit"
                      className={`rounded-[9px] px-3 py-1.5 text-[12px] font-bold ${
                        winner ? "bg-white text-accent-ink" : "bg-accent-soft text-accent-ink"
                      }`}
                    >
                      {m.voting.useThis}
                    </button>
                  </form>
                ) : null}
              </div>
              {r.missing.length > 0 ? (
                <div className={`mt-2 text-[11px] ${winner ? "opacity-90" : "text-[#9a2f22]"}`}>
                  {interpolate(m.voting.missing, { names: missingNames }, locale)}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Candidate manager (organizer) ───────────────────────────────────────────

function CandidateManager({
  tripId,
  kind,
  options,
  nameById,
  locale,
  m,
}: {
  tripId: string;
  kind: PollKind;
  options: PollOption[];
  nameById: Map<string, string>;
  locale: string;
  m: Messages;
}) {
  return (
    <div>
      <SectionLabel className="mb-2">{kind === "date" ? m.voting.candidateWindows : m.voting.startPoints}</SectionLabel>
      <div className="flex flex-col gap-2">
        {options.map((o) => {
          const suggester = o.suggestedBy ? nameById.get(relId(o.suggestedBy)) : null;
          return (
            <div key={o.id} className={`overflow-hidden rounded-[13px] border bg-card ${suggester ? "border-[#cfe0ff]" : "border-line"}`}>
              <div className="flex items-center gap-2.5 px-3 py-2.5">
                <span className="mono flex-1 text-[13px]">{windowLabel(locale, o)}</span>
                {suggester ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#e6e9ff] px-2 py-0.5 text-[10px] font-bold text-[#1f33b0]">
                    {interpolate(m.voting.by, { name: suggester }, locale)}
                  </span>
                ) : (
                  <form action={moderateOptionAction.bind(null, tripId, String(o.id), o.hidden ? "unhide" : "hide")}>
                    <button type="submit" className="text-[12px] font-semibold text-muted">
                      {o.hidden ? m.voting.unhide : m.voting.hide}
                    </button>
                  </form>
                )}
              </div>
              {suggester ? (
                <div className="flex border-t border-[#eef1fb] text-center text-[12px] font-semibold">
                  <form action={moderateOptionAction.bind(null, tripId, String(o.id), "promote")} className="flex-1 border-r border-[#eef1fb]">
                    <button type="submit" className="w-full py-2 text-accent-ink">{m.voting.promote}</button>
                  </form>
                  <form action={moderateOptionAction.bind(null, tripId, String(o.id), "hide")} className="flex-1">
                    <button type="submit" className="w-full py-2 text-[#9a2f22]">{m.voting.hide}</button>
                  </form>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* add candidate */}
      <form action={addOptionAction.bind(null, tripId, kind)} className="mt-2.5 flex flex-wrap items-center gap-2 rounded-[13px] border border-dashed border-[#d8cfbe] p-2.5">
        {kind === "date" ? (
          <>
            <input type="date" name="dateStart" required className="min-h-9 flex-1 rounded-[10px] border border-line bg-paper px-2 text-[13px]" />
            <input type="date" name="dateEnd" className="min-h-9 flex-1 rounded-[10px] border border-line bg-paper px-2 text-[13px]" />
          </>
        ) : (
          <input type="text" name="label" required placeholder={m.voting.addPlace} className="min-h-9 flex-1 rounded-[10px] border border-line bg-paper px-2.5 text-[13px]" />
        )}
        <button type="submit" className="rounded-[10px] bg-ink px-3 py-2 text-[13px] font-bold text-white">
          {kind === "date" ? m.voting.addWindow : m.voting.addPlace}
        </button>
      </form>
    </div>
  );
}

// ── Participant vote controls ───────────────────────────────────────────────

/** A single window row with a Yes / If / No segmented control (one form each). */
function VoteRow({
  tripId,
  kind,
  option,
  label,
  mine,
}: {
  tripId: string;
  kind: PollKind;
  option: PollOption;
  label: string;
  mine: Val | null;
  m: Messages;
}) {
  const seg: { v: Val; text: string; active: string }[] = [
    { v: "yes", text: "✓", active: "bg-accent text-white" },
    { v: "ifneeded", text: "~", active: "bg-[#fbf0d8] text-[#8a6410]" },
    { v: "no", text: "✕", active: "bg-[#efece5] text-[#5b554b]" },
  ];
  return (
    <div className="mb-2 flex items-center gap-2.5">
      <div className="mono min-w-[58px] text-[12px] leading-tight">{label}</div>
      <div className={`flex flex-1 overflow-hidden rounded-[11px] border ${mine ? "border-line" : "border-dashed border-[#d8cfbe] bg-card"}`}>
        {seg.map((s, i) => {
          const active = mine === s.v;
          return (
            <form key={s.v} action={castVoteAction.bind(null, tripId, kind, String(option.id), s.v)} className="flex-1">
              <button
                type="submit"
                className={`w-full py-2.5 text-[11px] font-bold ${i > 0 ? "border-l border-line" : ""} ${
                  active ? s.active : "text-sand"
                }`}
              >
                {s.text} {s.v === "yes" ? "Yes" : s.v === "ifneeded" ? "If" : "No"}
              </button>
            </form>
          );
        })}
      </div>
    </div>
  );
}

// ── Everyone heatmap (grid) ─────────────────────────────────────────────────

function Heatmap({
  options,
  roster,
  votesByOption,
  winnerId,
  locale,
  m,
}: {
  options: PollOption[];
  roster: Membership[];
  votesByOption: Map<string, Map<string, Val>>;
  winnerId: string | null;
  locale: string;
  m: Messages;
}) {
  const cell = (val: Val | undefined) => {
    if (val === "yes") return { bg: "var(--accent)", c: "#fff", t: "✓" };
    if (val === "ifneeded") return { bg: "#f6d98e", c: "#8a6410", t: "~" };
    if (val === "no") return { bg: "#eceae3", c: "#bcb4a6", t: "·" };
    return { bg: "#eceae3", c: "#bcb4a6", t: "·" };
  };
  return (
    <div className="overflow-x-auto pb-1.5">
      <div className="w-max">
        {/* legend */}
        <div className="mono mb-2.5 flex gap-3.5 text-[10px] text-muted">
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ background: "var(--accent)" }} />{m.voting.free}</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ background: "#f6d98e" }} />{m.voting.ifNeeded}</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-[#e0ddd4]" style={{ background: "#eceae3" }} />{m.voting.cant}</span>
        </div>
        {/* header */}
        <div className="mb-1.5 flex items-end gap-1.5">
          <div className="sticky left-0 z-10 w-[78px] shrink-0 bg-paper" />
          {options.map((o) => (
            <div key={o.id} className={`mono w-11 shrink-0 text-center text-[9px] leading-tight ${o.id === winnerId ? "font-bold text-accent-ink" : "text-muted"}`}>
              {o.id === winnerId ? "★ " : ""}{windowLabel(locale, o)}
            </div>
          ))}
        </div>
        {/* rows */}
        {roster.map((mem) => {
          const mid = String(mem.id);
          return (
            <div key={mid} className="mb-1.5 flex items-center gap-1.5">
              <div className="sticky left-0 z-10 flex w-[78px] shrink-0 items-center gap-1.5 bg-paper">
                <Avatar initials={initialsOf(memberName(mem))} name={memberName(mem)} size={24} />
                <span className="truncate text-[11px] font-semibold">{memberName(mem).split(/\s+/)[0]}</span>
              </div>
              {options.map((o) => {
                const c = cell(votesByOption.get(String(o.id))?.get(mid));
                return (
                  <div key={o.id} className="flex h-9 w-11 shrink-0 items-center justify-center rounded-lg text-[12px]" style={{ background: c.bg, color: c.c }}>
                    {c.t}
                  </div>
                );
              })}
            </div>
          );
        })}
        {/* totals */}
        <div className="flex items-center gap-1.5 border-t border-[#e0ddd4] pt-2">
          <div className="mono sticky left-0 z-10 w-[78px] shrink-0 bg-paper text-[10px] uppercase tracking-[0.1em] text-muted">{m.voting.free}</div>
          {options.map((o) => {
            const t = tallyOf(votesByOption.get(String(o.id)));
            return (
              <div key={o.id} className="mono w-11 shrink-0 text-center text-[15px] font-bold text-accent-ink">
                {t.yes + t.ifneeded}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-sand"><span>↔</span>{m.voting.swipeHint}</div>
    </div>
  );
}

// ── Location single-choice ──────────────────────────────────────────────────

function LocationVote({
  tripId,
  options,
  votesByOption,
  myId,
  locale,
  m,
}: {
  tripId: string;
  options: PollOption[];
  votesByOption: Map<string, Map<string, Val>>;
  myId: string | null;
  locale: string;
  m: Messages;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {options.map((o) => {
        const t = tallyOf(votesByOption.get(String(o.id)));
        const total = t.yes + t.ifneeded + t.no;
        const mine = myId ? votesByOption.get(String(o.id))?.get(myId) === "yes" : false;
        return (
          <form key={o.id} action={castVoteAction.bind(null, tripId, "location" as PollKind, String(o.id), "yes")}>
            <button
              type="submit"
              className={`w-full rounded-[14px] p-3 text-left ${mine ? "bg-accent text-white" : "border border-line bg-card"}`}
            >
              <div className="text-[14px] font-bold">{o.label}</div>
              <div className={`mono mt-1.5 text-[11px] ${mine ? "opacity-90" : "text-muted"}`}>
                {interpolate(m.voting.votesCount, { count: total }, locale)}
              </div>
            </button>
          </form>
        );
      })}
    </div>
  );
}

// ── page ────────────────────────────────────────────────────────────────────

export default async function PlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ dview?: string }>;
}) {
  const { tripId } = await params;
  const { dview } = await searchParams;
  const locale = await getRequestLocale();
  const { m } = getTranslator(locale);
  const { payload, identity } = await getCurrentIdentity();

  const trip = (await payload.findByID({ collection: "trips", id: tripId, overrideAccess: true })) as Trip;
  const membership = identity ? await getMembership(payload, tripId, identity.id) : null;
  const myId = membership ? String(membership.id) : null;
  const isOrganizer = identity ? await identityOrganizesTrip(payload, tripId, identity.id) : false;

  const roster = (await listMemberships(payload, tripId)).filter((r) => r.status === "active");
  const nameById = new Map(roster.map((r) => [String(r.id), memberName(r)] as const));
  const total = roster.length;

  // Date poll
  const datePoll = await getPoll(payload, tripId, "date");
  const dateOptionsAll = await listOptions(payload, tripId, "date", { includeHidden: isOrganizer });
  const dateOptions = dateOptionsAll.filter((o) => !o.hidden);
  const dateVotes = await listVotes(payload, tripId, "date");
  const dateByOption = indexVotes(dateVotes);
  const ranked = rankWindows(dateOptions, dateVotes, roster);
  const dateClosed = trip.datePollState === "closed";
  const datePublished = !!datePoll?.published;
  const dateMethod = (datePoll?.method ?? "approval") as PollMethod;
  const dateWinnerId = datePoll?.winnerOption ? relId(datePoll.winnerOption) : null;
  // Approval/grid: finished = answered every window.
  const dateVotersDone = countFinished(dateVotes, Math.max(1, dateOptions.length));

  // Location poll
  const locPoll = await getPoll(payload, tripId, "location");
  const locOptionsAll = await listOptions(payload, tripId, "location", { includeHidden: isOrganizer });
  const locOptions = locOptionsAll.filter((o) => !o.hidden);
  const locVotes = await listVotes(payload, tripId, "location");
  const locByOption = indexVotes(locVotes);
  const locClosed = trip.locationPollState === "closed";
  const locPublished = !!locPoll?.published;
  const locVotersDone = countFinished(locVotes, 1); // single choice: one pick = done

  const optionsById = new Map(dateOptions.map((o) => [String(o.id), o] as const));
  const best = ranked[0];
  const showHeatmap = dview === "all";

  const hero = isOrganizer
    ? { kicker: m.voting.organizeKicker, title: m.voting.organizeTitle }
    : { kicker: m.voting.planKicker, title: m.voting.dateTitle };

  return (
    <>
      <PageHero backHref={`/trips/${tripId}`} kicker={hero.kicker} title={hero.title} />

      <Sheet className="pb-8">
        <div className="flex flex-col gap-5 pt-1">
          {/* Organizer status chips */}
          {isOrganizer ? (
            <div className="flex gap-2">
              <StatusChip
                label={m.voting.datePoll}
                tone={dateClosed ? "closed" : datePublished ? "open" : "draft"}
                sub={dateClosed ? m.voting.closed : datePublished ? interpolate(m.voting.voted, { count: dateVotersDone, total }, locale) : m.voting.draft}
              />
              <StatusChip
                label={m.voting.locationPoll}
                tone={locClosed ? "closed" : locPublished ? "open" : "draft"}
                sub={locClosed ? m.voting.closed : locPublished ? interpolate(m.voting.voted, { count: locVotersDone, total }, locale) : m.voting.draft}
              />
            </div>
          ) : null}

          {/* ───────── DATE POLL ───────── */}
          <section className="flex flex-col gap-3.5">
            {/* Best banner — only once at least one vote is in (no "best" from an empty poll) */}
            {best && dateVotes.length > 0 && !dateClosed && dateOptions.length > 0 ? (
              <div className="flex items-center gap-2.5 rounded-2xl border border-[#cfe9da] bg-accent-soft px-3.5 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-accent text-[17px] text-white">★</div>
                <div>
                  <div className="text-[13px] font-bold text-accent-ink">{m.voting.bestForEveryone}</div>
                  <div className="text-[11px] text-[#5d7a6a]">
                    {interpolate(m.voting.bestSub, { label: windowLabel(locale, optionsById.get(best.id)!), count: best.attendees, total }, locale)}
                  </div>
                </div>
              </div>
            ) : null}

            {/* CLOSED result */}
            {dateClosed ? (
              <ClosedResult
                tripId={tripId}
                kind="date"
                winner={dateWinnerId ? optionsById.get(dateWinnerId) ?? dateOptions.find((o) => String(o.id) === dateWinnerId) : undefined}
                winnerId={dateWinnerId}
                ranked={ranked}
                optionsById={optionsById}
                total={total}
                attendees={(dateWinnerId ? ranked.find((r) => r.id === dateWinnerId)?.attendees : undefined) ?? best?.attendees ?? 0}
                locale={locale}
                isOrganizer={isOrganizer}
                m={m}
              />
            ) : !datePublished ? (
              isOrganizer ? (
                <OrganizerSetup
                  tripId={tripId}
                  kind="date"
                  method={dateMethod}
                  options={dateOptionsAll}
                  nameById={nameById}
                  locale={locale}
                  m={m}
                />
              ) : (
                <NotOpen m={m} />
              )
            ) : (
              <>
                {/* View toggle for the date poll */}
                <div className="flex gap-1.5 rounded-[13px] bg-line p-1">
                  <Toggle href={`/trips/${tripId}/plan`} active={!showHeatmap} label={m.voting.myAvailability} />
                  <Toggle href={`/trips/${tripId}/plan?dview=all`} active={showHeatmap} label={m.voting.everyone} />
                </div>

                {dateOptions.length === 0 ? (
                  <p className="px-1 text-sm text-muted">{m.voting.noCandidates}</p>
                ) : showHeatmap || dateMethod === "approval" ? (
                  showHeatmap ? (
                    <Heatmap options={dateOptions} roster={roster} votesByOption={dateByOption} winnerId={best?.id ?? null} locale={locale} m={m} />
                  ) : (
                    <ApprovalTally tripId={tripId} options={dateOptions} byOption={dateByOption} myId={myId} locale={locale} m={m} />
                  )
                ) : (
                  <div>
                    <div className="mb-2 flex items-center justify-between px-1">
                      <SectionLabel>{m.voting.tapToSet}</SectionLabel>
                    </div>
                    {dateOptions.map((o) => (
                      <VoteRow
                        key={o.id}
                        tripId={tripId}
                        kind="date"
                        option={o}
                        label={windowLabel(locale, o)}
                        mine={myId ? dateByOption.get(String(o.id))?.get(myId) ?? null : null}
                        m={m}
                      />
                    ))}
                  </div>
                )}

                {/* Participant: suggest a window */}
                {!isOrganizer ? (
                  <SuggestForm tripId={tripId} kind="date" m={m} />
                ) : null}

                {/* Organizer: optimal panel + manage + close */}
                {isOrganizer ? (
                  <>
                    <OptimalPanel
                      tripId={tripId}
                      ranked={ranked}
                      optionsById={optionsById}
                      nameById={nameById}
                      locale={locale}
                      m={m}
                      closable={dateOptions.length > 0}
                    />
                    <details className="rounded-2xl border border-line bg-card p-3.5">
                      <summary className="cursor-pointer text-sm font-semibold">{m.voting.candidateWindows}</summary>
                      <div className="mt-3">
                        <MethodToggle
                          tripId={tripId}
                          kind="date"
                          current={dateMethod}
                          methods={[
                            { value: "approval", label: m.voting.methodApproval },
                            { value: "grid", label: m.voting.methodGrid },
                          ]}
                          m={m}
                        />
                        <div className="mt-3">
                          <CandidateManager tripId={tripId} kind="date" options={dateOptionsAll} nameById={nameById} locale={locale} m={m} />
                        </div>
                      </div>
                    </details>
                  </>
                ) : null}
              </>
            )}
          </section>

          {/* ───────── LOCATION POLL ───────── */}
          <section className="flex flex-col gap-3.5 border-t border-line pt-5">
            <SectionLabel>{m.voting.locationPoll}</SectionLabel>

            {locClosed ? (
              <ClosedResult
                tripId={tripId}
                kind="location"
                winner={locPoll?.winnerOption ? locOptions.find((o) => String(o.id) === relId(locPoll.winnerOption)) : undefined}
                winnerId={locPoll?.winnerOption ? relId(locPoll.winnerOption) : null}
                ranked={[]}
                optionsById={new Map(locOptions.map((o) => [String(o.id), o]))}
                total={total}
                attendees={0}
                locale={locale}
                isOrganizer={isOrganizer}
                m={m}
              />
            ) : !locPublished ? (
              isOrganizer ? (
                <OrganizerSetup tripId={tripId} kind="location" method={(locPoll?.method ?? "single") as PollMethod} options={locOptionsAll} nameById={nameById} locale={locale} m={m} />
              ) : (
                <NotOpen m={m} />
              )
            ) : locOptions.length === 0 ? (
              <p className="px-1 text-sm text-muted">{m.voting.noCandidates}</p>
            ) : (
              <>
                <LocationVote tripId={tripId} options={locOptions} votesByOption={locByOption} myId={myId} locale={locale} m={m} />
                {!isOrganizer ? <SuggestForm tripId={tripId} kind="location" m={m} /> : null}
                {isOrganizer ? (
                  <>
                    <div className="flex flex-col gap-2">
                      {locOptions.map((o) => {
                        const t = tallyOf(locByOption.get(String(o.id)));
                        return (
                          <form key={o.id} action={closePollAction.bind(null, tripId, "location" as PollKind, String(o.id))} className="flex items-center gap-2 rounded-[13px] border border-line bg-card px-3 py-2.5">
                            <span className="flex-1 text-[14px] font-semibold">{o.label}</span>
                            <span className="mono text-[12px] text-muted">{t.yes + t.ifneeded}</span>
                            <button type="submit" className="rounded-[9px] bg-accent-soft px-3 py-1.5 text-[12px] font-bold text-accent-ink">{m.voting.useThis}</button>
                          </form>
                        );
                      })}
                    </div>
                    <details className="rounded-2xl border border-line bg-card p-3.5">
                      <summary className="cursor-pointer text-sm font-semibold">{m.voting.startPoints}</summary>
                      <div className="mt-3">
                        <CandidateManager tripId={tripId} kind="location" options={locOptionsAll} nameById={nameById} locale={locale} m={m} />
                      </div>
                    </details>
                  </>
                ) : null}
              </>
            )}
          </section>
        </div>
      </Sheet>
    </>
  );
}

// ── inline server sub-components that need actions ──────────────────────────

function Toggle({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <a
      href={href}
      className={`flex-1 rounded-[10px] py-2 text-center text-[13px] ${
        active ? "bg-card font-bold text-accent-ink shadow-[0_2px_6px_-3px_rgba(20,30,25,.3)]" : "font-semibold text-sand"
      }`}
    >
      {label}
    </a>
  );
}

function NotOpen({ m }: { m: Messages }) {
  return (
    <Card className="text-center">
      <div className="display text-lg font-bold">{m.voting.notOpenTitle}</div>
      <p className="mt-1 text-sm text-muted">{m.voting.notOpenHint}</p>
    </Card>
  );
}

function SuggestForm({ tripId, kind, m }: { tripId: string; kind: PollKind; m: Messages }) {
  return (
    <form action={suggestOptionAction.bind(null, tripId, kind)} className="flex flex-wrap items-center gap-2 rounded-[13px] border border-dashed border-[#d8cfbe] p-2.5">
      {kind === "date" ? (
        <>
          <input type="date" name="dateStart" required className="min-h-9 flex-1 rounded-[10px] border border-line bg-paper px-2 text-[13px]" />
          <input type="date" name="dateEnd" className="min-h-9 flex-1 rounded-[10px] border border-line bg-paper px-2 text-[13px]" />
        </>
      ) : (
        <input type="text" name="label" required placeholder={m.voting.suggestPlace} className="min-h-9 flex-1 rounded-[10px] border border-line bg-paper px-2.5 text-[13px]" />
      )}
      <button type="submit" className="rounded-[10px] border border-line bg-card px-3 py-2 text-[13px] font-semibold">
        {kind === "date" ? m.voting.suggestWindow : m.voting.suggestPlace}
      </button>
    </form>
  );
}

function OrganizerSetup({
  tripId,
  kind,
  method,
  options,
  nameById,
  locale,
  m,
}: {
  tripId: string;
  kind: PollKind;
  method: PollMethod;
  options: PollOption[];
  nameById: Map<string, string>;
  locale: string;
  m: Messages;
}) {
  return (
    <div className="flex flex-col gap-3.5">
      {kind === "date" ? (
        <MethodToggle
          tripId={tripId}
          kind="date"
          current={method}
          methods={[
            { value: "approval", label: m.voting.methodApproval },
            { value: "grid", label: m.voting.methodGrid },
          ]}
          m={m}
        />
      ) : null}
      <CandidateManager tripId={tripId} kind={kind} options={options} nameById={nameById} locale={locale} m={m} />
      <p className="px-1 text-[12px] text-muted">{m.voting.setupHint}</p>
      <form action={publishPollAction.bind(null, tripId, kind)}>
        <Button type="submit" className="w-full shadow-[0_10px_22px_-10px_var(--accent)]" disabled={options.filter((o) => !o.hidden).length === 0}>
          {m.voting.openVoting}
        </Button>
      </form>
    </div>
  );
}

function ApprovalTally({
  tripId,
  options,
  byOption,
  myId,
  locale,
  m,
}: {
  tripId: string;
  options: PollOption[];
  byOption: Map<string, Map<string, Val>>;
  myId: string | null;
  locale: string;
  m: Messages;
}) {
  const max = Math.max(1, ...options.map((o) => { const t = tallyOf(byOption.get(String(o.id))); return t.yes + t.ifneeded * 0.5; }));
  return (
    <div className="flex flex-col gap-2.5">
      {options.map((o) => {
        const t = tallyOf(byOption.get(String(o.id)));
        const score = t.yes + t.ifneeded * 0.5;
        const mine = myId ? byOption.get(String(o.id))?.get(myId) ?? null : null;
        return (
          <div key={o.id}>
            <VoteRow tripId={tripId} kind="date" option={o} label={windowLabel(locale, o)} mine={mine} m={m} />
            <div className="ml-[68px] flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper">
                <div className="h-full rounded-full bg-accent" style={{ width: `${(score / max) * 100}%` }} />
              </div>
              <span className="mono text-[12px] font-bold text-accent-ink">{t.yes + t.ifneeded}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ClosedResult({
  tripId,
  kind,
  winner,
  winnerId,
  ranked,
  optionsById,
  total,
  attendees,
  locale,
  isOrganizer,
  m,
}: {
  tripId: string;
  kind: PollKind;
  winner: PollOption | undefined;
  winnerId: string | null;
  ranked: RankedDateOption[];
  optionsById: Map<string, PollOption>;
  total: number;
  attendees: number;
  locale: string;
  isOrganizer: boolean;
  m: Messages;
}) {
  const winnerLabel = winner ? windowLabel(locale, winner) : "—";
  return (
    <div className="flex flex-col gap-3.5">
      <div className="rounded-[18px] bg-gradient-to-br from-accent to-accent-ink p-4 text-white shadow-[0_14px_28px_-16px_var(--accent)]">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-[10px] bg-white/20 text-[15px]">🔒</div>
          <div className="mono text-[10px] uppercase tracking-[0.12em] opacity-85">
            {interpolate(m.voting.closedKicker, { kind: kind === "date" ? m.voting.datePoll : m.voting.locationPoll }, locale)}
          </div>
        </div>
        <div className="display mt-2.5 text-[28px] font-extrabold">{winnerLabel}</div>
        {kind === "date" ? (
          <div className="mt-0.5 text-[13px] opacity-90">{interpolate(m.voting.promotedSub, { count: attendees, total }, locale)}</div>
        ) : (
          <div className="mt-0.5 text-[13px] opacity-90">{m.voting.destinationSet}</div>
        )}
      </div>

      {ranked.length > 0 ? (
        <div>
          <SectionLabel className="mb-2">{m.voting.finalResult}</SectionLabel>
          <div className="flex flex-col gap-1.5">
            {ranked.slice(0, 4).map((r) => {
              const o = optionsById.get(r.id);
              const isWinner = winnerId != null && r.id === winnerId;
              return (
                <div key={r.id} className={`flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5 ${isWinner ? "border-[#cfe9da]" : "border-line opacity-70"}`}>
                  {isWinner ? <span>★</span> : <span className="w-[14px]" />}
                  <span className="mono flex-1 text-[12px] font-bold">{o ? windowLabel(locale, o) : r.id}</span>
                  <span className="mono text-[12px] font-bold text-accent-ink">{r.score}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {isOrganizer ? (
        <form action={reopenPollAction.bind(null, tripId, kind)}>
          <button type="submit" className="w-full rounded-[13px] border-[1.5px] border-line py-3 text-[13px] font-semibold text-muted">
            {m.voting.reopen}
          </button>
        </form>
      ) : null}
    </div>
  );
}

import { notFound } from "next/navigation";
import { getTrip } from "@/lib/trips";
import type { VoteOption } from "@/lib/trips";
import { PageHero, Sheet, SectionLabel } from "@/components/ui";
import { Avatar } from "@/components/Avatar";

function VoteRow({ opt }: { opt: VoteOption }) {
  const strength = Math.max(24, Math.round(opt.pct * 0.8));
  return (
    <div className="mb-3 flex items-center gap-3">
      <div className="mono min-w-[58px] whitespace-pre-line text-xs leading-tight">{opt.dateLabel}</div>
      <div
        className="relative flex h-9 flex-1 items-center overflow-hidden rounded-xl border bg-card"
        style={{ borderStyle: opt.pending ? "dashed" : "solid", borderColor: opt.pending ? "#d8cfbe" : "var(--line)" }}
      >
        <div
          className="absolute inset-y-0 left-0"
          style={{ width: `${opt.pct}%`, background: `color-mix(in srgb, var(--accent) ${strength}%, #fff)` }}
        />
        {opt.pending ? (
          <span className="relative pl-3 text-xs text-sand">Tap to vote</span>
        ) : (
          <div className="relative flex items-center pl-2.5">
            {opt.voters.map((id, i) => (
              <span key={id} style={{ marginLeft: i === 0 ? 0 : -7 }}>
                <Avatar id={id} size={22} ring="#fff" />
              </span>
            ))}
            {opt.extra ? (
              <span
                className="inline-flex items-center justify-center rounded-full text-[9px] font-bold text-white"
                style={{ width: 22, height: 22, marginLeft: -7, background: "rgba(255,255,255,.35)", border: "1.5px solid #fff" }}
              >
                +{opt.extra}
              </span>
            ) : null}
          </div>
        )}
      </div>
      <div
        className="mono min-w-4 text-right text-[15px] font-bold"
        style={{ color: opt.pending ? "#a89f8f" : "var(--ink)" }}
      >
        {opt.votes}
      </div>
    </div>
  );
}

export default async function PlanPage({ params }: { params: Promise<{ trip: string }> }) {
  const { trip } = await params;
  const t = getTrip(trip);
  if (!t) notFound();
  const v = t.vote;

  return (
    <>
      <PageHero kicker={v.step} title={v.question} />
      <Sheet className="pb-8">
        {/* optimal suggestion */}
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-accent-soft p-3.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-lg text-white">★</div>
          <div className="flex-1">
            <div className="text-sm font-bold text-accent-ink">{v.optimalTitle}</div>
            <div className="text-xs text-accent-ink/80">{v.optimalNote}</div>
          </div>
        </div>

        <SectionLabel className="mx-1 mb-2.5 mt-5">Date options</SectionLabel>
        <div className="lg:grid lg:grid-cols-2 lg:gap-x-6">
          {v.options.map((o) => (
            <VoteRow key={o.dateLabel} opt={o} />
          ))}
        </div>

        {v.startPoints ? (
          <>
            <SectionLabel className="mx-1 mb-2.5 mt-4">{v.startLabel}</SectionLabel>
            <div className="flex gap-2.5">
              {v.startPoints.map((sp) => (
                <div
                  key={sp.name}
                  className="flex-1 rounded-2xl p-3"
                  style={
                    sp.selected
                      ? { background: "var(--accent)", color: "#fff" }
                      : { background: "var(--card)", border: "1px solid var(--line)" }
                  }
                >
                  <div className="text-sm font-bold">{sp.name}</div>
                  <div className="text-[11px]" style={{ opacity: sp.selected ? 0.9 : 1, color: sp.selected ? "#fff" : "var(--muted)" }}>
                    {sp.note}
                  </div>
                  <div className="mono mt-1.5 text-[11px]" style={{ color: sp.selected ? "#fff" : "var(--muted)" }}>
                    {sp.selected ? "● " : ""}
                    {sp.votes} votes
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}

        <button className="mt-4 w-full rounded-2xl bg-accent px-4 py-3.5 text-[15px] font-bold text-white shadow-[0_10px_22px_-10px_var(--accent)]">
          {v.cta}
        </button>
      </Sheet>
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getTrip, TRIPS } from "@/lib/trips";
import type { OrgLoop, OrgNudge } from "@/lib/trips";
import { Avatar } from "@/components/Avatar";

const SECTIONS = [
  { icon: "⌂", label: "Overview", active: true },
  { icon: "🗳", label: "Dates & voting" },
  { icon: "🛏", label: "Rooms" },
  { icon: "💸", label: "Money" },
  { icon: "🎒", label: "Lists" },
  { icon: "👥", label: "People" },
];

function StatusPill({ loop }: { loop: OrgLoop }) {
  const confirmed = loop.statusTone === "confirmed";
  return (
    <span
      className="rounded-full px-2.5 py-[3px] text-[11px] font-bold"
      style={confirmed ? { color: "#15623f", background: "#e3f3ec" } : { color: "#8a6410", background: "#fbf0d8" }}
    >
      {loop.status}
    </span>
  );
}

function LoopCard({ loop }: { loop: OrgLoop }) {
  const due = loop.statusTone === "due";
  return (
    <div
      className="rounded-2xl border bg-card p-4"
      style={{ borderColor: due ? "#f0d9a8" : "var(--line)" }}
    >
      <div className="flex items-center justify-between">
        <div className="mono text-[10px] uppercase tracking-[0.1em] text-muted">{loop.section}</div>
        <StatusPill loop={loop} />
      </div>
      <div className="mt-2 text-[17px] font-bold">{loop.title}</div>
      {loop.note ? <div className="mt-0.5 text-xs text-muted">{loop.note}</div> : null}
      {loop.members || loop.cta ? (
        <div className="mt-3 flex items-center justify-between">
          {loop.members ? (
            <div className="flex">
              {loop.members.map((id, i) => (
                <span key={id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                  <Avatar id={id} size={28} ring="#fffdf9" />
                </span>
              ))}
            </div>
          ) : (
            <span className="text-xs text-muted">{loop.note ? "" : ""}</span>
          )}
          {loop.cta ? (
            <button className="rounded-[9px] bg-accent-soft px-3.5 py-2 text-xs font-bold text-accent-ink">{loop.cta}</button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function NudgeCard({ nudge }: { nudge: OrgNudge }) {
  if (nudge.highlight) {
    return (
      <div
        className="rounded-2xl border p-3.5"
        style={{ borderColor: "#d6ecdf", background: "linear-gradient(110deg, var(--accent-soft), var(--card))" }}
      >
        <div className="text-sm font-bold">{nudge.title}</div>
        <div className="mt-1.5 text-xs leading-relaxed text-[#5b554b]">{nudge.body}</div>
        <div className="mt-3 flex gap-2">
          <button className="flex-1 rounded-[10px] bg-accent px-3 py-2.5 text-xs font-bold text-white">{nudge.primary}</button>
          {nudge.secondary ? (
            <button className="rounded-[10px] bg-paper px-3 py-2.5 text-xs font-semibold text-[#5b554b]">{nudge.secondary}</button>
          ) : null}
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-line bg-paper p-3.5">
      <div className="text-sm font-bold">{nudge.title}</div>
      <div className="mt-1.5 text-xs leading-relaxed text-[#5b554b]">{nudge.body}</div>
      <button className="mt-2.5 w-full rounded-[10px] bg-accent-soft px-3 py-2.5 text-xs font-bold text-accent-ink">{nudge.primary}</button>
    </div>
  );
}

export default async function OrganizePage({ params }: { params: Promise<{ trip: string }> }) {
  const { trip } = await params;
  const t = getTrip(trip);
  if (!t) notFound();
  const o = t.organize;

  return (
    <div className="min-h-screen bg-paper">
      {/* top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-card px-4 lg:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="h-7 w-7 rounded-lg bg-photo" />
          <span className="display text-lg font-extrabold">Chata</span>
          <span className="mono ml-2 hidden text-xs text-muted sm:inline">{t.subdomain}/organize</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href={`/${t.slug}`} className="rounded-[10px] bg-paper px-3 py-2 text-xs font-bold text-ink">
            Open app →
          </Link>
          <Avatar id="TZ" size={30} />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[230px_1fr] xl:grid-cols-[230px_1fr_300px]">
        {/* LEFT RAIL */}
        <aside className="hidden flex-col border-r border-line bg-card px-4 py-5 lg:flex">
          <div className="mono px-1 pb-2 text-[10px] uppercase tracking-[0.12em] text-sand">Your trips</div>
          {TRIPS.map((tr) => {
            const active = tr.slug === t.slug;
            return (
              <Link
                key={tr.slug}
                href={`/${tr.slug}/organize`}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-paper"
                style={active ? { background: "color-mix(in srgb, " + tr.theme.accent + " 16%, #fff)" } : undefined}
              >
                <span className="h-6 w-6 shrink-0 rounded-lg" style={{ background: tr.theme.photo }} />
                <span className="truncate text-[13px]" style={{ color: active ? tr.theme.accent : "var(--muted)", fontWeight: active ? 700 : 500 }}>
                  {tr.shortName}
                </span>
              </Link>
            );
          })}

          <div className="mono px-1 pb-2 pt-5 text-[10px] uppercase tracking-[0.12em] text-sand">Sections</div>
          <div className="flex flex-col gap-0.5 text-[13px]">
            {SECTIONS.map((s) => (
              <div
                key={s.label}
                className="flex items-center gap-2.5 rounded-[9px] px-2.5 py-2"
                style={s.active ? { background: "var(--paper)", fontWeight: 700, color: "var(--ink)" } : { color: "var(--muted)" }}
              >
                <span className="w-4 text-center">{s.icon}</span>
                {s.label}
              </div>
            ))}
          </div>
          <div className="mt-auto flex items-center gap-2.5 px-1 pt-5">
            <Avatar id="TZ" size={30} />
            <div>
              <div className="text-xs font-semibold">Tomáš Z.</div>
              <div className="text-[10px] text-sand">Organizer</div>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <main className="px-5 py-7 lg:px-7">
          <div className="flex items-start justify-between">
            <div>
              <div className="mono text-[11px] uppercase tracking-[0.14em] text-sand">{o.overviewKicker}</div>
              <h1 className="display mt-1 text-2xl font-bold tracking-tight lg:text-3xl">{o.overviewTitle}</h1>
            </div>
            <div className="text-right">
              <div className="mono text-2xl font-bold text-accent-ink lg:text-[28px]">{o.readyPercent}%</div>
              <div className="text-[11px] text-muted">trip ready</div>
            </div>
          </div>
          <div className="my-4 h-2 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-accent" style={{ width: `${o.readyPercent}%` }} />
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {o.loops.map((l) => (
              <LoopCard key={l.section} loop={l} />
            ))}
          </div>
        </main>

        {/* RIGHT RAIL — assistant */}
        <aside className="border-t border-line bg-card px-4 py-5 xl:border-l xl:border-t-0">
          <div className="mb-1 flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[15px] text-white">✦</span>
            <span className="display text-lg font-bold">Assistant</span>
          </div>
          <div className="mb-4 text-xs text-muted">Ready-to-send nudges, written for you.</div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {o.nudges.map((n) => (
              <NudgeCard key={n.title} nudge={n} />
            ))}
          </div>

          <div className="mono mb-2.5 mt-5 text-[10px] uppercase tracking-[0.12em] text-sand">This week</div>
          <div className="flex flex-col gap-2.5">
            {o.week.map((w) => (
              <div key={w.text} className="flex gap-2.5">
                <span className="mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: w.done ? "#d8cfbe" : "var(--accent)" }} />
                <span className="text-xs" style={{ color: w.done ? "var(--muted)" : "#3a362f" }}>{w.text}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

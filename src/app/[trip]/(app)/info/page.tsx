import Link from "next/link";
import { notFound } from "next/navigation";
import { getTrip } from "@/lib/trips";
import { Sheet, SectionLabel } from "@/components/ui";
import { Avatar } from "@/components/Avatar";

export default async function InfoPage({ params }: { params: Promise<{ trip: string }> }) {
  const { trip } = await params;
  const t = getTrip(trip);
  if (!t) notFound();
  const d = t.destination;

  return (
    <>
      <header className="relative overflow-hidden bg-photo px-5 pb-7 pt-12 text-white lg:mt-6 lg:rounded-[28px] lg:px-8">
        <Link href="/" className="mono text-[11px] uppercase tracking-[0.14em] opacity-90 hover:opacity-100">
          ‹ {d.kicker}
        </Link>
        <h1 className="display mt-1.5 text-3xl font-extrabold tracking-tight lg:text-4xl">{d.name}</h1>
        <div className="mt-1 text-[13px] opacity-90">{d.address}</div>
      </header>

      <Sheet className="pb-8">
        <button className="flex w-full items-center justify-center gap-2 rounded-[13px] bg-accent-soft px-4 py-3.5 text-sm font-bold text-accent-ink">
          {d.mapsLabel}
        </button>

        <div className="mt-3.5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {d.facts.map((f) => (
            <div key={f.label} className="rounded-2xl border border-line bg-card px-3.5 py-3">
              <SectionLabel>{f.label}</SectionLabel>
              <div className="text-[15px] font-bold">{f.value}</div>
            </div>
          ))}
        </div>

        <SectionLabel className="mx-1 mb-2.5 mt-5">{d.transportLabel}</SectionLabel>
        <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2">
          {d.rides.map((r) => (
            <div key={r.title} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3.5">
              <Avatar id={r.member} size={40} />
              <div className="flex-1">
                <div className="text-sm font-semibold">{r.title}</div>
                <div className="text-xs text-muted">{r.note}</div>
              </div>
              <button className="rounded-[10px] bg-accent px-3.5 py-2 text-[13px] font-bold text-white">{r.cta}</button>
            </div>
          ))}
        </div>
        <button className="mt-2.5 w-full rounded-xl border-[1.5px] border-line px-4 py-2.5 text-[13px] font-semibold text-ink">
          {d.offerCta}
        </button>

        <SectionLabel className="mx-1 mb-2 mt-5">Good to know</SectionLabel>
        <div className="flex flex-col gap-1.5">
          {d.notes.map((n) => (
            <div key={n} className="flex gap-2 text-[13px] text-[#3a362f]">
              <span className="text-accent">•</span>
              {n}
            </div>
          ))}
        </div>
      </Sheet>
    </>
  );
}

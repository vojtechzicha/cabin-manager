import { notFound } from "next/navigation";
import { getTrip } from "@/lib/trips";
import type { Stat } from "@/lib/trips";
import { Hero, Sheet, SectionLabel } from "@/components/ui";

const SUB_TONE: Record<string, string> = {
  confirmed: "var(--confirmed)",
  due: "#c2851f",
  overdue: "#9a2f22",
  muted: "var(--muted)",
};

function StatCard({ stat }: { stat: Stat }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-3.5">
      <div className="text-lg">{stat.icon}</div>
      <SectionLabel className="mt-1.5">{stat.label}</SectionLabel>
      <div className="mt-0.5 text-[15px] font-bold">{stat.value}</div>
      <div
        className="flex items-center gap-1 text-[11px] font-semibold"
        style={{ color: SUB_TONE[stat.tone ?? "muted"] }}
      >
        {stat.dot ? <span className="text-[10px] leading-none">●</span> : null}
        {stat.sub}
      </div>
    </div>
  );
}

export default async function HomePage({ params }: { params: Promise<{ trip: string }> }) {
  const { trip } = await params;
  const t = getTrip(trip);
  if (!t) notFound();

  const dark = t.nextUp.tone === "dark";

  return (
    <>
      <Hero trip={t} />
      <Sheet className="pb-8">
        {/* Next up */}
        <div
          className="flex items-center gap-3.5 rounded-[18px] p-4 text-white shadow-[0_12px_24px_-12px_var(--accent)]"
          style={{
            background: dark
              ? "linear-gradient(120deg,#1c1b18,#2a2a44)"
              : "linear-gradient(120deg, var(--accent), var(--accent-ink))",
          }}
        >
          <div className="flex-1">
            <div
              className="mono text-[10px] uppercase tracking-[0.14em]"
              style={{ color: dark ? "var(--gold)" : "rgba(255,255,255,.85)" }}
            >
              {t.nextUp.kicker}
            </div>
            <div className="display mt-0.5 text-xl font-bold">{t.nextUp.title}</div>
            <div className="mono mt-0.5 text-[13px] opacity-90">{t.nextUp.sub}</div>
          </div>
          <button
            className="shrink-0 rounded-xl px-4 py-3 text-sm font-bold"
            style={
              dark
                ? { background: "var(--gold)", color: "#1c1b18" }
                : { background: "#fff", color: "var(--accent-ink)" }
            }
          >
            {t.nextUp.cta}
          </button>
        </div>

        {/* Stat grid */}
        <div className="mt-3.5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {t.stats.map((s) => (
            <StatCard key={s.label} stat={s} />
          ))}
        </div>

        {/* Trip pulse */}
        <SectionLabel className="mx-1 mb-2 mt-5">Trip pulse</SectionLabel>
        <div className="flex flex-col gap-2">
          {t.pulse.map((p) => (
            <div key={p} className="flex items-center gap-2.5 text-[13px] text-[#3a362f]">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              {p}
            </div>
          ))}
        </div>
      </Sheet>
    </>
  );
}

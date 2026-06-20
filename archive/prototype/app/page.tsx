import Link from "next/link";
import { TRIPS } from "@/lib/trips";
import { AvatarStack } from "@/components/Avatar";

export default function Landing() {
  return (
    <div className="min-h-screen bg-paper">
      {/* Masthead */}
      <header className="relative overflow-hidden px-6 pb-16 pt-16 text-white lg:px-10">
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(125% 120% at 82% -10%, #ffd06b 0%, #f0653c 26%, #2f9e73 60%, #2b6f8f 100%)" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(80% 60% at 12% 110%, rgba(58,91,255,.55), transparent 60%)", mixBlendMode: "screen" }}
        />
        <div className="relative mx-auto max-w-5xl">
          <div className="mono text-xs uppercase tracking-[0.24em] opacity-90">zicha.travel · prototype</div>
          <h1 className="display mt-3 text-[56px] font-extrabold leading-[0.92] tracking-tight drop-shadow-[0_2px_30px_rgba(0,0,0,0.18)] lg:text-[88px]">
            Chata
          </h1>
          <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-white/90">
            One system, infinite trips. Every getaway gets its own identity from a background photo and an
            accent — the components never change. Pick a trip to step inside.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {["Photo-driven identity", "Adaptive glass", "Mobile-first PWA", "Responsive web"].map((tag) => (
              <span
                key={tag}
                className="mono rounded-full border border-white/30 bg-white/15 px-3.5 py-2 text-xs backdrop-blur-md"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* Trip picker */}
      <main className="mx-auto max-w-5xl px-6 pb-24 pt-12 lg:px-10">
        <div className="display text-2xl font-bold tracking-tight">Choose a trip</div>
        <p className="mt-1 text-[15px] text-muted">
          The same app, re-skinned by photo and accent for three very different trips.
        </p>

        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-3">
          {TRIPS.map((t) => (
            <div
              key={t.slug}
              className="overflow-hidden rounded-[20px] border border-line bg-card shadow-[0_14px_30px_-18px_rgba(20,30,25,.4)]"
            >
              <Link href={`/${t.slug}`} className="block">
                <div className="relative h-36" style={{ background: t.theme.photo }}>
                  {t.theme.gold ? (
                    <span
                      className="absolute right-3.5 top-3.5 h-8 w-8 rounded-full"
                      style={{ background: t.theme.gold, boxShadow: `0 0 24px ${t.theme.gold}b3` }}
                    />
                  ) : null}
                  <div className="absolute bottom-3 left-3.5 right-3.5 flex items-end justify-between">
                    <span className="mono text-[11px] uppercase tracking-[0.14em] text-white/90">{t.subdomain}</span>
                    <AvatarStack ids={t.crowd.ids} extra={t.crowd.extra} size={26} ring={t.theme.accentInk} />
                  </div>
                </div>
              </Link>
              <div className="p-4 pb-5">
                <div className="display text-xl font-bold">{t.shortName}</div>
                <div className="mt-0.5 text-[13px] text-muted">{t.blurb}</div>
                <div className="mt-3.5 flex gap-1.5">
                  <span className="h-[30px] flex-1 rounded-lg" style={{ background: t.theme.accent }} />
                  <span className="h-[30px] flex-1 rounded-lg" style={{ background: t.theme.accentInk }} />
                  <span className="h-[30px] flex-1 rounded-lg" style={{ background: t.theme.gold ?? t.theme.accentSoft }} />
                </div>
                <div className="mt-4 flex items-center gap-3 text-[13px] font-bold">
                  <Link href={`/${t.slug}`} className="text-accent-ink" style={{ color: t.theme.accentInk }}>
                    Open app →
                  </Link>
                  <Link href={`/${t.slug}/organize`} className="text-muted hover:text-ink">
                    Organizer desk
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-sm text-sand">
          <span>Heroes shown as themed gradients — drop a real trip photo and the accent re-samples from it.</span>
          <span className="mono text-xs">Next.js prototype · mock data</span>
        </div>
      </main>
    </div>
  );
}

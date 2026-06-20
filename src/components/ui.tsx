import Link from "next/link";
import type { Trip } from "@/lib/trips";
import { AvatarStack } from "./Avatar";

/** Small mono uppercase section label. */
export function SectionLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`mono text-[10px] uppercase tracking-[0.12em] text-muted ${className}`}>
      {children}
    </div>
  );
}

const TAG_TONES: Record<string, { bg: string; fg: string; dot: string }> = {
  confirmed: { bg: "#e4f3ec", fg: "#15623f", dot: "#2f9e73" },
  due: { bg: "#fbf0d8", fg: "#8a6410", dot: "#e8a93b" },
  overdue: { bg: "#fadfdb", fg: "#9a2f22", dot: "#d8503f" },
  muted: { bg: "#e8e1d4", fg: "#756f64", dot: "" },
};

export function StatusTag({
  tone = "muted",
  dot = true,
  children,
}: {
  tone?: keyof typeof TAG_TONES;
  dot?: boolean;
  children: React.ReactNode;
}) {
  const t = TAG_TONES[tone] ?? TAG_TONES.muted;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold"
      style={{ background: t.bg, color: t.fg }}
    >
      {dot && t.dot ? <span className="h-[7px] w-[7px] rounded-full" style={{ background: t.dot }} /> : null}
      {children}
    </span>
  );
}

/** The signature cream sheet that overlaps the hero with a soft rounded top. */
export function Sheet({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`relative z-10 -mt-7 rounded-t-[28px] bg-paper px-5 pt-6 lg:px-8 ${className}`}
    >
      {children}
    </div>
  );
}

/** Full hero for the dashboard — photo, countdown, title, crowd. */
export function Hero({ trip }: { trip: Trip }) {
  return (
    <header className="relative overflow-hidden bg-photo px-5 pb-12 pt-12 text-white lg:mt-6 lg:rounded-[28px] lg:px-8">
      {trip.theme.gold ? (
        <span
          className="pointer-events-none absolute right-8 top-16 h-12 w-12 rounded-full"
          style={{ background: trip.theme.gold, boxShadow: `0 0 44px ${trip.theme.gold}b3` }}
        />
      ) : null}

      <div className="flex items-center justify-between">
        <Link href="/" className="mono text-[11px] uppercase tracking-[0.14em] opacity-90 hover:opacity-100">
          ‹ {trip.subdomain}
        </Link>
        {/* countdown */}
        <div className="rounded-2xl border border-white/30 bg-white/15 px-3.5 py-2 text-center backdrop-blur-md">
          <div className="mono text-2xl font-bold leading-none">{trip.daysToGo}</div>
          <div className="mono text-[9px] uppercase tracking-[0.12em] opacity-90">days to go</div>
        </div>
      </div>

      <div className="mt-14 lg:mt-20">
        <div className="mono text-[11px] uppercase tracking-[0.14em] opacity-90">{trip.location}</div>
        <h1 className="display mt-1 text-[42px] font-extrabold leading-[0.96] tracking-tight drop-shadow-[0_2px_18px_rgba(0,0,0,0.25)] lg:text-6xl">
          {trip.titleLines[0]}
          <br />
          {trip.titleLines[1]}
        </h1>
        <div className="mt-3 flex items-center gap-2.5">
          <AvatarStack ids={trip.crowd.ids} extra={trip.crowd.extra} size={32} ring={trip.theme.accentInk} />
          <span className="text-xs opacity-90">{trip.goingLabel}</span>
        </div>
      </div>
    </header>
  );
}

/** Shorter header for inner screens. */
export function PageHero({
  kicker,
  title,
  right,
}: {
  kicker: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="relative overflow-hidden bg-photo px-5 pb-9 pt-12 text-white lg:mt-6 lg:rounded-[28px] lg:px-8">
      <div className="flex items-end justify-between">
        <div>
          <Link href="/" className="mono text-[11px] uppercase tracking-[0.14em] opacity-90 hover:opacity-100">
            ‹ {kicker}
          </Link>
          <h1 className="display mt-1.5 text-3xl font-extrabold tracking-tight lg:text-4xl">{title}</h1>
        </div>
        {right ? <div className="mono pb-1 text-[13px] opacity-90">{right}</div> : null}
      </div>
    </header>
  );
}

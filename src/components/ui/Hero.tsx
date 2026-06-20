import Link from "next/link";
import type { ReactNode } from "react";

import { AvatarStack } from "../Avatar";

type Crowd = { members: { initials: string; name?: string }[]; extra?: number };

/** Full hero for a trip dashboard — photo, countdown, title, crowd. */
export function Hero({
  backHref = "/",
  backLabel,
  location,
  titleLines,
  daysToGo,
  daysToGoLabel,
  crowd,
  goingLabel,
  ringColor,
  spotlight,
}: {
  backHref?: string;
  backLabel: string;
  location: string;
  titleLines: [string, string];
  daysToGo: number;
  daysToGoLabel: string;
  crowd?: Crowd;
  goingLabel?: string;
  ringColor?: string;
  spotlight?: string;
}) {
  return (
    <header className="bg-photo relative overflow-hidden px-5 pb-12 pt-12 text-white lg:mt-6 lg:rounded-[28px] lg:px-8">
      {spotlight ? (
        <span
          className="pointer-events-none absolute right-8 top-16 h-12 w-12 rounded-full"
          style={{ background: spotlight, boxShadow: `0 0 44px ${spotlight}b3` }}
        />
      ) : null}

      <div className="flex items-center justify-between">
        <Link
          href={backHref}
          className="mono text-[11px] uppercase tracking-[0.14em] opacity-90 hover:opacity-100"
        >
          ‹ {backLabel}
        </Link>
        <div className="rounded-2xl border border-white/30 bg-white/15 px-3.5 py-2 text-center backdrop-blur-md">
          <div className="mono text-2xl font-bold leading-none">{daysToGo}</div>
          <div className="mono text-[9px] uppercase tracking-[0.12em] opacity-90">
            {daysToGoLabel}
          </div>
        </div>
      </div>

      <div className="mt-14 lg:mt-20">
        <div className="mono text-[11px] uppercase tracking-[0.14em] opacity-90">{location}</div>
        <h1 className="display mt-1 text-[42px] font-extrabold leading-[0.96] tracking-tight drop-shadow-[0_2px_18px_rgba(0,0,0,0.25)] lg:text-6xl">
          {titleLines[0]}
          <br />
          {titleLines[1]}
        </h1>
        {crowd ? (
          <div className="mt-3 flex items-center gap-2.5">
            <AvatarStack members={crowd.members} extra={crowd.extra} size={32} ring={ringColor} />
            {goingLabel ? <span className="text-xs opacity-90">{goingLabel}</span> : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}

/** Shorter header for inner screens. */
export function PageHero({
  backHref = "/",
  kicker,
  title,
  right,
}: {
  backHref?: string;
  kicker: string;
  title: string;
  right?: ReactNode;
}) {
  return (
    <header className="bg-photo relative overflow-hidden px-5 pb-9 pt-12 text-white lg:mt-6 lg:rounded-[28px] lg:px-8">
      <div className="flex items-end justify-between">
        <div>
          <Link
            href={backHref}
            className="mono text-[11px] uppercase tracking-[0.14em] opacity-90 hover:opacity-100"
          >
            ‹ {kicker}
          </Link>
          <h1 className="display mt-1.5 text-3xl font-extrabold tracking-tight lg:text-4xl">
            {title}
          </h1>
        </div>
        {right ? <div className="mono pb-1 text-[13px] opacity-90">{right}</div> : null}
      </div>
    </header>
  );
}

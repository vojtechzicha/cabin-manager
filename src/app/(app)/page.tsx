import Link from "next/link";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { sampleThemes, themeForTrip, themeVars } from "@/components/theme";
import { getTranslator } from "@/i18n";
import { getRequestLocale } from "@/i18n/server";
import { listMemberTrips } from "@/services/trips";
import type { Messages } from "@/i18n";
import type { Trip } from "@/payload-types";

import { signOutAction } from "./auth/actions";
import { getCurrentIdentity } from "./auth/current-user";

function phaseLabel(m: Messages, phase: Trip["phase"]): string {
  switch (phase) {
    case "ideation":
      return m.lifecycle.phaseIdeation;
    case "planning":
      return m.lifecycle.phasePlanning;
    case "finances":
      return m.lifecycle.phaseFinances;
    case "archived":
      return m.lifecycle.phaseArchived;
    default:
      return m.lifecycle.phaseDraft;
  }
}

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

function daysUntil(date?: string | null): number | null {
  if (!date) return null;
  const ms = new Date(date).getTime() - Date.now();
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}

/** "14 Aug – 17 Aug · Beskydy" — the dates·location subline on a lobby trip card. */
function tripWhen(locale: string, trip: Trip): string | null {
  const start = trip.dates?.start;
  if (!start) return trip.location ?? null;
  const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const end = trip.dates?.end;
  const range = end
    ? `${fmt.format(new Date(start))} – ${fmt.format(new Date(end))}`
    : fmt.format(new Date(start));
  return trip.location ? `${range} · ${trip.location}` : range;
}

/** The Chata A-frame mark — currentColor so it reverses to white on the dark lobby. */
function ChataMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={(size / 28) * 26} viewBox="0 0 48 44" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M24 2 L45.5 41 H2.5 Z M24 21 L34 41 H14 Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The dark, color-rich lobby background: deep radial wash + accent glow blobs. */
function LobbyBackdrop() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-24 h-[520px] w-[520px] blur-2xl"
        style={{ background: "radial-gradient(circle, rgba(240,101,60,.5), transparent 62%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-24 top-40 h-[480px] w-[480px] blur-2xl"
        style={{ background: "radial-gradient(circle, rgba(58,91,255,.45), transparent 62%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-36 -left-28 h-[420px] w-[420px] blur-2xl"
        style={{ background: "radial-gradient(circle, rgba(47,158,115,.45), transparent 62%)" }}
      />
    </>
  );
}

export default async function Home() {
  const locale = await getRequestLocale();
  const { m, t } = getTranslator(locale);
  const { payload, identity } = await getCurrentIdentity();

  // ── Signed-out lobby ──────────────────────────────────────────────────────
  if (!identity) {
    return (
      <main
        className="relative flex min-h-screen flex-col overflow-hidden text-white"
        style={{
          background: "radial-gradient(90% 90% at 88% -10%, #2a2740 0%, #1a1822 45%, #131118 100%)",
        }}
      >
        <LobbyBackdrop />

        <div className="relative mx-auto flex w-full max-w-[1120px] flex-1 flex-col px-5 py-6 sm:px-8">
          {/* nav */}
          <nav className="flex items-center justify-between">
            <span className="flex items-center gap-2.5 text-white">
              <ChataMark size={28} />
              <span className="display text-2xl font-extrabold">{m.common.appName}</span>
            </span>
            <div className="flex items-center gap-2 sm:gap-3">
              <LanguageSwitcher tone="dark" />
              <Link
                href="/sign-in"
                className="hidden rounded-[12px] px-3 py-2.5 text-sm font-semibold text-white/80 hover:text-white sm:inline-flex"
              >
                {m.auth.signIn}
              </Link>
              <Link
                href="/sign-in"
                className="hidden rounded-[12px] bg-white px-4 py-2.5 text-sm font-bold text-[#16151c] lg:inline-flex"
              >
                {m.lobby.start}
              </Link>
            </div>
          </nav>

          {/* hero */}
          <section className="mt-8 flex flex-1 flex-col lg:mt-16 lg:grid lg:grid-cols-2 lg:items-center lg:gap-10 lg:pb-16">
            <div className="flex flex-1 flex-col lg:block">
              <div className="mono text-[12px] uppercase tracking-[0.22em] text-white/55">
                {m.lobby.kicker}
              </div>
              <h1 className="display mt-3.5 text-[clamp(46px,8vw,74px)] font-extrabold leading-[0.92] tracking-[-0.035em]">
                {m.lobby.title}
                <br />
                <span
                  style={{
                    background:
                      "linear-gradient(100deg,#ffd06b,#f0653c 40%,#c23f6a 70%,#3a5bff)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  {m.lobby.titleAccent}
                </span>
              </h1>
              <p className="mt-5 max-w-[440px] text-[16px] leading-relaxed text-white/80 sm:text-[17px]">
                {m.lobby.tagline}
              </p>

              {/* desktop CTAs + feature dots */}
              <div className="mt-7 hidden flex-wrap gap-3 lg:flex">
                <Link
                  href="/sign-in"
                  className="rounded-[14px] bg-white px-6 py-3.5 text-[15px] font-bold text-[#16151c]"
                >
                  {m.lobby.start}
                </Link>
                <Link
                  href="/sign-in"
                  className="rounded-[14px] border border-white/20 bg-white/10 px-6 py-3.5 text-[15px] font-semibold text-white backdrop-blur-md"
                >
                  {m.lobby.haveInvite} →
                </Link>
              </div>
              <div className="mt-7 hidden flex-wrap gap-x-5 gap-y-2 text-[13px] text-white/70 lg:flex">
                <span className="flex items-center gap-2">
                  <span style={{ color: "#7cd0a6" }}>●</span>
                  {m.lobby.featureDates}
                </span>
                <span className="flex items-center gap-2">
                  <span style={{ color: "#8aa0ff" }}>●</span>
                  {m.lobby.featureBeds}
                </span>
                <span className="flex items-center gap-2">
                  <span style={{ color: "#ffb27a" }}>●</span>
                  {m.lobby.featureMoney}
                </span>
              </div>

              {/* mobile teaser cards */}
              <div aria-hidden className="relative mt-8 h-[96px] lg:hidden">
                {[
                  { theme: sampleThemes.cabin, rot: -5, pos: "left-0 top-2", tag: "T-23", name: "Summer Cabin" },
                  { theme: sampleThemes.baltic, rot: 4, pos: "right-0 top-0", tag: "T-40", name: "Baltic Ride" },
                ].map((c) => (
                  <div
                    key={c.name}
                    className={`absolute ${c.pos} h-[84px] w-[150px] overflow-hidden rounded-[16px] p-3 text-white shadow-[0_16px_30px_-14px_rgba(0,0,0,.5)]`}
                    style={{ background: c.theme?.photo, transform: `rotate(${c.rot}deg)` }}
                  >
                    <div className="mono text-[8px] uppercase tracking-[0.1em] opacity-85">{c.tag}</div>
                    <div className="display absolute bottom-2.5 text-[15px] font-extrabold">{c.name}</div>
                  </div>
                ))}
              </div>

              {/* mobile bottom-pinned CTAs */}
              <div className="mt-auto flex flex-col gap-2.5 pb-1 pt-8 lg:hidden">
                <Link
                  href="/sign-in"
                  className="rounded-[14px] bg-white px-6 py-4 text-center text-[16px] font-bold text-[#16151c]"
                >
                  {m.lobby.start}
                </Link>
                <Link
                  href="/sign-in"
                  className="rounded-[14px] border border-white/20 bg-white/8 px-6 py-4 text-center text-[16px] font-semibold text-white"
                >
                  {m.lobby.haveInvite} →
                </Link>
                <div className="pt-2 text-center text-[13px] text-white/60">
                  {m.lobby.signInPrompt}{" "}
                  <Link href="/sign-in" className="font-bold text-white">
                    {m.auth.signIn}
                  </Link>
                </div>
              </div>
            </div>

            {/* desktop decorative trip-card cluster — the same app, re-skinned per trip */}
            <div aria-hidden className="relative hidden h-[420px] lg:block">
              {[
                { theme: sampleThemes.cabin, rot: -6, pos: "left-8 top-6", kicker: "Beskydy · T-23", name: "Summer Cabin" },
                { theme: sampleThemes.la2028, rot: 5, pos: "right-6 top-28 z-10", kicker: "Los Angeles · T-512", name: "Road to LA 2028" },
                { theme: sampleThemes.baltic, rot: -2, pos: "bottom-2 left-20", kicker: "Gdańsk → Hel · T-40", name: "Ride to the Baltic" },
              ].map((c) => (
                <div
                  key={c.name}
                  className={`absolute ${c.pos} h-[172px] w-[280px] overflow-hidden rounded-[20px] p-4 text-white shadow-[0_30px_60px_-24px_rgba(0,0,0,.6)]`}
                  style={{ background: c.theme?.photo, transform: `rotate(${c.rot}deg)` }}
                >
                  <div className="mono text-[10px] uppercase tracking-[0.14em] opacity-85">
                    {c.kicker}
                  </div>
                  <div className="display absolute bottom-4 text-[26px] font-extrabold">
                    {c.name}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    );
  }

  // ── Signed-in lobby (dark) ────────────────────────────────────────────────
  const trips = await listMemberTrips(payload, identity.id);
  const displayName = identity.displayName ?? identity.email;
  const active = trips.filter(({ trip }) => trip.phase !== "archived");
  const past = trips.filter(({ trip }) => trip.phase === "archived");
  const isEmpty = trips.length === 0;

  return (
    <main
      className="relative min-h-screen overflow-hidden text-white"
      style={{
        background: "radial-gradient(95% 80% at 88% -10%, #232130 0%, #16151c 52%, #100f15 100%)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-36 -top-28 h-[520px] w-[520px] blur-2xl"
        style={{ background: "radial-gradient(circle, rgba(58,91,255,.32), transparent 62%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 top-16 h-[460px] w-[460px] blur-2xl"
        style={{ background: "radial-gradient(circle, rgba(47,158,115,.26), transparent 62%)" }}
      />

      <div className="relative mx-auto w-full max-w-[1100px] px-5 py-8 sm:px-8">
        {/* greeting */}
        <header className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg,#2f9e73,#18694a)" }}
          >
            {initialsOf(displayName)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="mono text-[11px] uppercase tracking-[0.2em] text-white/50">
              {m.home.greeting}
            </div>
            <div className="display truncate text-2xl font-extrabold tracking-tight">
              {m.home.welcomeBackName.replace("{name}", displayName)}
            </div>
          </div>
          <LanguageSwitcher tone="dark" />
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-[10px] border border-white/16 bg-white/8 px-3 py-2 text-[13px] font-semibold text-white/80 hover:text-white"
            >
              {m.auth.signOut}
            </button>
          </form>
        </header>
        {active.length > 0 ? (
          <div className="mt-1.5 pl-14 text-[14px] text-white/60">
            {t((mm) => mm.home.tripsInMotion, { count: active.length })}
          </div>
        ) : null}

        {isEmpty ? (
          /* First-run empty state */
          <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-[28px] border border-white/18 bg-white/7 text-white shadow-[0_0_60px_rgba(124,208,166,.3)]">
              <ChataMark size={48} />
            </div>
            <h2 className="display mt-6 text-[40px] font-extrabold tracking-tight">{m.home.empty}</h2>
            <p className="mt-3.5 max-w-[440px] text-[16px] leading-relaxed text-white/78">
              {m.home.emptyHint}
            </p>
            <Link
              href="/trips/new"
              className="mt-7 rounded-[14px] bg-white px-7 py-3.5 text-[16px] font-bold text-[#16151c]"
            >
              + {m.lobby.start}
            </Link>
            <div className="mt-9 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[13px] text-white/65">
              <span className="flex items-center gap-2">
                <span style={{ color: "#7cd0a6" }}>●</span>
                {m.lobby.featureDates}
              </span>
              <span className="flex items-center gap-2">
                <span style={{ color: "#8aa0ff" }}>●</span>
                {m.lobby.featureBeds}
              </span>
              <span className="flex items-center gap-2">
                <span style={{ color: "#ffb27a" }}>●</span>
                {m.lobby.featureMoney}
              </span>
            </div>
          </div>
        ) : (
          <>
            {/* your chatas */}
            <div className="mt-8 flex items-baseline gap-2.5 px-1">
              <span className="mono text-[11px] uppercase tracking-[0.16em] text-white/55">
                {m.home.yourChatas}
              </span>
              <span className="mono text-[11px] text-white/40">
                {active.length} {m.home.active}
              </span>
            </div>

            <div className="mt-3.5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {active.map(({ trip }) => {
                const theme = themeForTrip(trip.theme?.color, trip.theme?.coverImage);
                const days = daysUntil(trip.dates?.start);
                return (
                  <Link
                    key={trip.id}
                    href={`/trips/${trip.id}`}
                    style={themeVars(theme)}
                    className="bg-photo relative block h-[200px] overflow-hidden rounded-[20px] p-[18px] text-white shadow-[0_24px_50px_-22px_rgba(0,0,0,.5)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold backdrop-blur-sm">
                        {phaseLabel(m, trip.phase)}
                      </span>
                      {days != null ? (
                        <span className="text-center">
                          <span className="mono block text-[22px] font-bold leading-none">{days}</span>
                          <span className="mono block text-[8px] uppercase tracking-[0.12em] opacity-85">
                            {m.home.days}
                          </span>
                        </span>
                      ) : null}
                    </div>
                    <div className="absolute inset-x-[18px] bottom-[18px]">
                      <div className="display text-[26px] font-extrabold leading-none tracking-tight">
                        {trip.name}
                      </div>
                      {tripWhen(locale, trip) ? (
                        <div className="mono mt-1 text-[12px] opacity-85">{tripWhen(locale, trip)}</div>
                      ) : null}
                    </div>
                  </Link>
                );
              })}

              <Link
                href="/trips/new"
                className="flex items-center justify-center gap-2 rounded-[18px] border border-dashed border-white/25 px-4 py-5 text-[15px] font-bold text-white/85 hover:border-white/40 hover:text-white sm:col-span-2 lg:col-span-3"
              >
                <span className="text-xl">+</span> {m.home.startNew}
              </Link>
            </div>

            {/* past trips */}
            {past.length > 0 ? (
              <div className="mt-7 flex flex-wrap items-center gap-2.5 border-t border-white/8 px-1 pt-5">
                <span className="mono mr-1 text-[11px] uppercase tracking-[0.16em] text-white/40">
                  {m.home.past} · {past.length}
                </span>
                {past.map(({ trip }) => {
                  const theme = themeForTrip(trip.theme?.color, trip.theme?.coverImage);
                  return (
                    <Link
                      key={trip.id}
                      href={`/trips/${trip.id}`}
                      className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1.5 pl-2 pr-3.5 text-[13px] text-white/70 hover:text-white"
                    >
                      <span
                        className="h-[22px] w-[22px] rounded-[7px]"
                        style={{ background: theme.photo }}
                      />
                      {trip.shortName}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

import Link from "next/link";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { themeForTrip, themeVars } from "@/components/theme";
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

function roleLabel(m: Messages, role: string | null | undefined): string {
  if (role === "organizer") return m.home.roleOrganizer;
  if (role === "co-organizer") return m.home.roleCoOrganizer;
  return m.home.roleParticipant;
}

export default async function Home() {
  const locale = await getRequestLocale();
  const { m } = getTranslator(locale);
  const { payload, identity } = await getCurrentIdentity();

  // ── Guest landing ─────────────────────────────────────────────────────────
  if (!identity) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[760px] flex-col justify-center px-6 py-16">
        <div className="mb-8">
          <LanguageSwitcher />
        </div>
        <span className="mono text-[11px] uppercase tracking-[0.14em] text-muted">zicha.travel</span>
        <h1 className="display mt-2 text-5xl font-extrabold leading-[0.96] tracking-tight">
          {m.common.appName}
        </h1>
        <p className="mt-4 max-w-prose text-muted">{m.common.tagline}</p>
        <div className="mt-8 flex flex-wrap gap-3 text-sm">
          <Link
            href="/sign-in"
            className="rounded-[14px] bg-accent px-4 py-2.5 font-semibold text-white"
          >
            {m.auth.signIn}
          </Link>
          <Link
            href="/gallery"
            className="rounded-[14px] border border-line px-4 py-2.5 font-semibold text-ink"
          >
            {m.gallery.title}
          </Link>
        </div>
      </main>
    );
  }

  // ── Authenticated trip picker ─────────────────────────────────────────────
  const trips = await listMemberTrips(payload, identity.id);

  return (
    <main className="mx-auto w-full max-w-[760px] px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <span className="mono text-[11px] uppercase tracking-[0.14em] text-muted">
          {m.auth.signedInAs.replace("{name}", identity.displayName ?? identity.email)}
        </span>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-[13px] font-semibold text-muted hover:text-ink"
            >
              {m.auth.signOut}
            </button>
          </form>
        </div>
      </div>

      <div className="flex items-end justify-between">
        <h1 className="display text-4xl font-extrabold tracking-tight">{m.home.yourTrips}</h1>
        <Link
          href="/trips/new"
          className="rounded-btn bg-accent px-4 py-2.5 text-sm font-semibold text-white"
        >
          + {m.home.create}
        </Link>
      </div>

      {trips.length === 0 ? (
        <div className="mt-8 rounded-card border border-line bg-card p-8 text-center">
          <div className="display text-xl font-bold">{m.home.empty}</div>
          <p className="mt-1 text-sm text-muted">{m.home.emptyHint}</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {trips.map(({ trip, membership }) => {
            const theme = themeForTrip(trip.theme?.color, trip.theme?.coverImage);
            return (
              <Link
                key={trip.id}
                href={`/trips/${trip.id}`}
                style={themeVars(theme)}
                className="group overflow-hidden rounded-card border border-line bg-card transition-shadow hover:shadow-[0_14px_30px_-18px_rgba(20,30,25,.4)]"
              >
                <div className="bg-photo relative h-28">
                  <span className="absolute bottom-2 left-3 mono text-[11px] uppercase tracking-[0.14em] text-white/90">
                    {trip.shortName}
                  </span>
                </div>
                <div className="p-4">
                  <div className="display text-lg font-bold">{trip.name}</div>
                  {trip.location ? (
                    <div className="text-[13px] text-muted">{trip.location}</div>
                  ) : null}
                  <div className="mt-3 flex items-center gap-2 text-[12px]">
                    <span className="rounded-full bg-accent-soft px-2.5 py-1 font-semibold text-accent-ink">
                      {roleLabel(m, membership.role)}
                    </span>
                    <span className="mono uppercase tracking-[0.1em] text-muted">
                      {phaseLabel(m, trip.phase)}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}

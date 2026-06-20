import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell, type NavItem, type TripChip } from "@/components/AppShell";
import { themeForTrip, themeVars } from "@/components/theme";
import { getTranslator } from "@/i18n";
import { getRequestLocale } from "@/i18n/server";
import { getMembership, listMemberTrips } from "@/services/trips";
import { ORGANIZER_ROLES } from "@/access";

import { requireIdentity } from "../../auth/current-user";

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

const isOrganizerRole = (role: string | null | undefined): boolean =>
  role != null && (ORGANIZER_ROLES as readonly string[]).includes(role);

/** Resolve a trip's cover URL: uploaded media (GridFS) first, else the URL override. */
function coverUrlOf(trip: {
  theme?: { coverMedia?: unknown; coverImage?: string | null } | null;
}): string | null {
  const cover = trip.theme?.coverMedia;
  if (cover && typeof cover === "object" && "url" in cover) {
    return (cover as { url?: string | null }).url ?? null;
  }
  return trip.theme?.coverImage ?? null;
}

/**
 * Organizer/participant console shell for one trip (T-201). Loads the trip,
 * **authorizes membership** server-side (a non-member 404s — they can't even see
 * the trip exists), applies the trip's theme via CSS variables, and frames the
 * sections in the shared `AppShell`. Organizer-only sections (People, Settings)
 * are hidden from plain participants here *and* enforced in their pages/actions.
 */
export default async function TripConsoleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const { payload, identity } = await requireIdentity(`/trips/${tripId}`);

  const membership = await getMembership(payload, tripId, identity.id);
  if (!membership || membership.status !== "active") {
    // Hide existence from non-members (PRD §5 least-privilege).
    if (identity.role !== "admin") notFound();
  }

  let trip;
  try {
    trip = await payload.findByID({ collection: "trips", id: tripId, overrideAccess: true });
  } catch {
    notFound();
  }
  if (!trip) redirect("/");

  const locale = await getRequestLocale();
  const { m } = getTranslator(locale);
  const isOrganizer = membership ? isOrganizerRole(membership.role) : identity.role === "admin";

  const theme = themeForTrip(trip.theme?.color, coverUrlOf(trip));
  const base = `/trips/${tripId}`;
  const nav: NavItem[] = [
    { key: "overview", href: base, label: m.console.overview, icon: "⌂" },
    { key: "info", href: `${base}/info`, label: m.console.info, icon: "ⓘ" },
    ...(isOrganizer
      ? [
          { key: "people", href: `${base}/people`, label: m.console.people, icon: "👥" },
          { key: "settings", href: `${base}/settings`, label: m.console.settings, icon: "⚙" },
        ]
      : []),
  ];

  const myTrips = await listMemberTrips(payload, identity.id);
  const chips: TripChip[] = myTrips.map(({ trip: t }) => {
    const tt = themeForTrip(t.theme?.color, coverUrlOf(t));
    return { slug: `trips/${t.id}`, shortName: t.shortName, accent: tt.accent, photo: tt.photo };
  });

  const displayName = membership?.displayName ?? identity.displayName ?? identity.email;

  return (
    <div style={themeVars(theme)}>
      <AppShell
        slug={`trips/${tripId}`}
        brand={trip.shortName}
        nav={nav}
        trips={chips}
        user={{
          initials: initialsOf(displayName),
          name: displayName,
          role: isOrganizer ? m.home.roleOrganizer : m.home.roleParticipant,
        }}
      >
        {children}
      </AppShell>
    </div>
  );
}

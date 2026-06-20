import { notFound } from "next/navigation";
import { getTrip, TRIPS } from "@/lib/trips";
import { AppShell, type TripChip } from "@/components/AppShell";

const tripChips: TripChip[] = TRIPS.map((t) => ({
  slug: t.slug,
  shortName: t.shortName,
  accent: t.theme.accent,
  photo: t.theme.photo,
}));

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ trip: string }>;
}) {
  const { trip } = await params;
  const t = getTrip(trip);
  if (!t) notFound();

  return (
    <AppShell slug={t.slug} subdomain={t.subdomain} nav={t.nav} trips={tripChips}>
      {children}
    </AppShell>
  );
}

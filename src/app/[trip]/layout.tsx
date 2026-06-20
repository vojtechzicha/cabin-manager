import { notFound } from "next/navigation";
import { getTrip, tripSlugs } from "@/lib/trips";
import { themeVars } from "@/lib/theme";

export function generateStaticParams() {
  return tripSlugs().map((trip) => ({ trip }));
}

export async function generateMetadata({ params }: { params: Promise<{ trip: string }> }) {
  const { trip } = await params;
  const t = getTrip(trip);
  if (!t) return {};
  return {
    title: `${t.shortName} · Chata`,
    description: t.blurb,
  };
}

export default async function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ trip: string }>;
}) {
  const { trip } = await params;
  const t = getTrip(trip);
  if (!t) notFound();

  // Every child inherits the trip's accent + photo from here.
  return (
    <div style={themeVars(t.theme)} className="min-h-screen bg-paper">
      {children}
    </div>
  );
}

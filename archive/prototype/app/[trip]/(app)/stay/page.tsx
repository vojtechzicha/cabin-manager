import { notFound } from "next/navigation";
import { getTrip, member } from "@/lib/trips";
import type { Bed, Room } from "@/lib/trips";
import { PageHero, Sheet } from "@/components/ui";
import { Avatar } from "@/components/Avatar";

function BedCell({ bed }: { bed: Bed }) {
  if (bed.kind === "taken") {
    const m = member(bed.member);
    return (
      <div className="flex aspect-square flex-1 flex-col items-center justify-center gap-1 rounded-xl bg-accent-soft">
        <Avatar id={bed.member} size={30} />
        <div className="text-[9px] font-semibold text-accent-ink">{m.name}</div>
      </div>
    );
  }
  if (bed.kind === "claim") {
    return (
      <button className="flex aspect-square flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl border-[1.5px] border-dashed border-accent bg-card">
        <span className="text-lg leading-none text-accent">+</span>
        <span className="text-[9px] font-bold text-accent-ink">Claim</span>
      </button>
    );
  }
  return (
    <div className="flex aspect-square flex-1 items-center justify-center rounded-xl border-[1.5px] border-dashed border-[#d8cfbe] bg-card text-[10px] text-sand">
      free
    </div>
  );
}

function RoomCard({ room }: { room: Room }) {
  return (
    <div className="mb-3 rounded-[18px] border border-line bg-card p-3.5 lg:mb-0">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[15px] font-bold">{room.name}</div>
        <div className="mono text-[11px]" style={{ color: room.open ? "#c2851f" : "var(--muted)", fontWeight: room.open ? 700 : 400 }}>
          {room.open ? "● " : ""}
          {room.meta}
        </div>
      </div>
      {room.wide ? (
        <div className="flex min-h-[68px] items-center justify-center gap-0 rounded-xl bg-accent-soft py-3">
          {room.beds.map((b, i) =>
            b.kind === "taken" ? (
              <span key={i} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                <Avatar id={b.member} size={34} ring="#fff" />
              </span>
            ) : null,
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          {room.beds.map((b, i) => (
            <BedCell key={i} bed={b} />
          ))}
        </div>
      )}
    </div>
  );
}

export default async function StayPage({ params }: { params: Promise<{ trip: string }> }) {
  const { trip } = await params;
  const t = getTrip(trip);
  if (!t) notFound();

  return (
    <>
      <PageHero kicker="Stay" title={t.rooms.headline} right={t.rooms.claimed} />
      <Sheet className="pb-8">
        <div className="lg:grid lg:grid-cols-2 lg:gap-4">
          {t.rooms.rooms.map((r) => (
            <RoomCard key={r.name} room={r} />
          ))}
        </div>
      </Sheet>
    </>
  );
}

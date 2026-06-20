import Link from "next/link";
import { notFound } from "next/navigation";
import { getTrip, member } from "@/lib/trips";
import type { BalanceRow } from "@/lib/trips";
import { Sheet, SectionLabel } from "@/components/ui";
import { Avatar } from "@/components/Avatar";

// A static "QR Platba" stand-in — real codes get generated server-side later.
const QR = [
  1, 0, 1, 1, 0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1,
];

function QrGlyph({ size = 84 }: { size?: number }) {
  return (
    <div
      className="grid shrink-0 rounded-2xl border border-line bg-white p-2"
      style={{ width: size, height: size, gridTemplateColumns: "repeat(5,1fr)", gridTemplateRows: "repeat(5,1fr)", gap: 2 }}
    >
      {QR.map((on, i) => (
        <span key={i} style={on ? { background: "#1c1b18", borderRadius: 2 } : undefined} />
      ))}
    </div>
  );
}

function Row({ row }: { row: BalanceRow }) {
  const owed = row.direction === "owed";
  // Money is semantic, not themed: green when you're owed, red when you owe.
  const color = owed ? "#15623f" : "#9a2f22";
  const m = member(row.member);
  return (
    <div className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
      <Avatar id={row.member} size={38} />
      <div className="flex-1">
        <div className="text-[15px] font-semibold">{m.name}</div>
        <div className="text-xs" style={{ color }}>{row.note}</div>
      </div>
      <div className="mono text-base font-bold" style={{ color }}>
        {row.amount}
      </div>
    </div>
  );
}

export default async function MoneyPage({ params }: { params: Promise<{ trip: string }> }) {
  const { trip } = await params;
  const t = getTrip(trip);
  if (!t) notFound();
  const f = t.finances;

  return (
    <>
      <header className="relative overflow-hidden bg-photo px-5 pb-9 pt-12 text-white lg:mt-6 lg:rounded-[28px] lg:px-8">
        <Link href="/" className="mono text-[11px] uppercase tracking-[0.14em] opacity-90 hover:opacity-100">
          ‹ Your balance
        </Link>
        <div className="mono mt-3 text-[40px] font-bold leading-none">{f.balanceValue}</div>
        <div className="mt-1.5 text-[13px] opacity-90">{f.balanceNote}</div>
      </header>

      <Sheet className="pb-8">
        {/* tabs */}
        <div className="mb-3.5 flex gap-2">
          {f.tabs.map((tab, i) => (
            <span
              key={tab}
              className="rounded-full px-4 py-2 text-[13px]"
              style={
                i === 0
                  ? { background: "var(--accent)", color: "#fff", fontWeight: 700 }
                  : { background: "var(--card)", border: "1px solid var(--line)", fontWeight: 500 }
              }
            >
              {tab}
            </span>
          ))}
        </div>

        <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
          <div>
            {f.rows.map((r) => (
              <Row key={r.member} row={r} />
            ))}
          </div>

          {/* QR settle */}
          <div className="mt-3.5 rounded-[18px] border border-line bg-card p-4 shadow-[0_12px_26px_-16px_rgba(20,30,40,.4)] lg:mt-0">
            <SectionLabel className="mb-3">QR settle</SectionLabel>
            <div className="flex items-center gap-4">
              <QrGlyph />
              <div className="flex-1">
                <div className="mono text-[11px] uppercase tracking-[0.14em] text-muted">QR Platba</div>
                <div className="mono mt-0.5 text-2xl font-bold">{f.qr.amount}</div>
                <div className="text-xs text-muted">to {f.qr.to} · scan in your bank app</div>
              </div>
            </div>
          </div>
        </div>
      </Sheet>
    </>
  );
}

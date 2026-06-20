/*
  Mock data layer for the Chata prototype.

  Everything the UI renders comes from these plain objects. To turn this
  prototype into a real product, this file is the seam: replace the exported
  helpers with calls to a database / API and the screens stay untouched.
*/

export type Tone = "accent" | "dark" | "confirmed" | "due" | "overdue";

export type Member = {
  id: string;
  initials: string;
  name: string;
  /** CSS background for the avatar */
  gradient: string;
  /** dark text on light avatars */
  ink?: boolean;
};

export type Theme = {
  accent: string;
  accentInk: string;
  accentSoft: string;
  /** hero photo, expressed as a gradient stand-in (drop in a real photo later) */
  photo: string;
  /** optional accent garnish, e.g. the Olympic "sun" */
  gold?: string;
};

export type NavItem = { key: string; label: string; icon: string; href: string };

export type Stat = {
  icon: string;
  label: string;
  value: string;
  sub: string;
  /** colours the sub line */
  tone?: "confirmed" | "due" | "overdue" | "muted";
  dot?: boolean;
};

export type NextUp = {
  kicker: string;
  title: string;
  sub: string;
  cta: string;
  tone: Tone;
};

export type VoteOption = {
  dateLabel: string;
  votes: number;
  /** 0–100 fill of the bar */
  pct: number;
  voters: string[];
  extra?: number;
  winner?: boolean;
  pending?: boolean;
};

export type StartPoint = {
  name: string;
  note: string;
  votes: number;
  selected?: boolean;
};

export type Vote = {
  step: string;
  question: string;
  optimalTitle: string;
  optimalNote: string;
  options: VoteOption[];
  startLabel?: string;
  startPoints?: StartPoint[];
  cta: string;
};

export type Bed =
  | { kind: "taken"; member: string }
  | { kind: "claim" }
  | { kind: "free" };

export type Room = {
  name: string;
  meta: string;
  /** highlight the meta line when beds are open */
  open?: boolean;
  /** wide bed cell (e.g. a double) */
  wide?: boolean;
  beds: Bed[];
};

export type BalanceRow = {
  member: string;
  note: string;
  amount: string;
  direction: "owed" | "owe";
};

export type Finances = {
  balanceValue: string;
  balanceNote: string;
  positive: boolean;
  tabs: string[];
  rows: BalanceRow[];
  qr: { amount: string; to: string };
};

export type RideOffer = {
  member: string;
  title: string;
  note: string;
  cta: string;
};

export type Destination = {
  kicker: string;
  name: string;
  address: string;
  mapsLabel: string;
  facts: { label: string; value: string }[];
  transportLabel: string;
  rides: RideOffer[];
  offerCta: string;
  notes: string[];
};

export type OrgLoop = {
  section: string;
  status: string;
  statusTone: "confirmed" | "due";
  title: string;
  note?: string;
  members?: string[];
  cta?: string;
};

export type OrgNudge = {
  title: string;
  body: string;
  primary: string;
  secondary?: string;
  highlight?: boolean;
};

export type Organize = {
  readyPercent: number;
  overviewKicker: string;
  overviewTitle: string;
  loops: OrgLoop[];
  nudges: OrgNudge[];
  week: { text: string; done?: boolean }[];
};

export type Trip = {
  slug: string;
  subdomain: string;
  shortName: string;
  /** hero title split across two lines */
  titleLines: [string, string];
  location: string;
  daysToGo: number;
  goingLabel: string;
  /** initials displayed in hero/avatar stacks, last entry can be "+N" */
  crowd: { ids: string[]; extra?: number };
  blurb: string;
  theme: Theme;
  nav: NavItem[];
  nextUp: NextUp;
  stats: Stat[];
  pulse: string[];
  vote: Vote;
  destination: Destination;
  rooms: { headline: string; claimed: string; rooms: Room[] };
  finances: Finances;
  organize: Organize;
};

// ---------------------------------------------------------------------------
// Cast — shared across every trip
// ---------------------------------------------------------------------------

export const MEMBERS: Record<string, Member> = {
  TZ: { id: "TZ", initials: "TZ", name: "Tomáš", gradient: "linear-gradient(135deg,#f0653c,#c23f6a)" },
  KV: { id: "KV", initials: "KV", name: "Klára", gradient: "linear-gradient(135deg,#3a5bff,#1f33b0)" },
  AM: { id: "AM", initials: "AM", name: "Adam", gradient: "linear-gradient(135deg,#ffd06b,#e8a93b)", ink: true },
  PN: { id: "PN", initials: "PN", name: "Petr", gradient: "linear-gradient(135deg,#e8a93b,#c2851f)" },
  JS: { id: "JS", initials: "JS", name: "Jana", gradient: "linear-gradient(135deg,#3a5bff,#2230a8)" },
  MV: { id: "MV", initials: "MV", name: "Martin", gradient: "linear-gradient(135deg,#8a8275,#5b554b)" },
  EV: { id: "EV", initials: "EV", name: "Eva", gradient: "linear-gradient(135deg,#c23f6a,#7a2342)" },
};

export function member(id: string): Member {
  return MEMBERS[id] ?? { id, initials: id, name: id, gradient: "#b7aa97" };
}

// ---------------------------------------------------------------------------
// Default navigation (most trips share it; cycling overrides "Plan" → "Route")
// ---------------------------------------------------------------------------

const baseNav = (slug: string, planLabel = "Plan", planIcon = "🗳"): NavItem[] => [
  { key: "home", label: "Home", icon: "⌂", href: `/${slug}` },
  { key: "plan", label: planLabel, icon: planIcon, href: `/${slug}/plan` },
  { key: "stay", label: "Stay", icon: "🛏", href: `/${slug}/stay` },
  { key: "money", label: "Money", icon: "💸", href: `/${slug}/money` },
  { key: "info", label: "Info", icon: "ⓘ", href: `/${slug}/info` },
];

// ---------------------------------------------------------------------------
// Trips
// ---------------------------------------------------------------------------

const cabin: Trip = {
  slug: "cabin",
  subdomain: "cabin.zicha.travel",
  shortName: "Summer Cabin",
  titleLines: ["Summer", "Cabin"],
  location: "Beskydy · CZ",
  daysToGo: 23,
  goingLabel: "11 going",
  crowd: { ids: ["TZ", "KV", "AM"], extra: 8 },
  blurb: "The neutral default — sage & forest, a chata in the hills.",
  theme: {
    accent: "#2f9e73",
    accentInk: "#15623f",
    accentSoft: "#e3f3ec",
    photo: "radial-gradient(125% 90% at 76% 0%, #8fd9b4 0%, #2f9e73 42%, #18694a 76%, #0e4732 100%)",
  },
  nav: baseNav("cabin"),
  nextUp: {
    kicker: "Next up · deposit due Fri",
    title: "Pay your deposit",
    sub: "1 500 Kč",
    cta: "Pay",
    tone: "accent",
  },
  stats: [
    { icon: "📅", label: "Dates", value: "14–17 Aug", sub: "Locked in", tone: "confirmed", dot: true },
    { icon: "🛏", label: "Beds", value: "7 of 11", sub: "claimed", tone: "muted" },
    { icon: "💸", label: "Your balance", value: "+840 Kč", sub: "you're owed", tone: "confirmed" },
    { icon: "🎒", label: "Packing", value: "12 left", sub: "on your list", tone: "muted" },
  ],
  pulse: ["Klára claimed the attic bed", "Adam added 6 items to shopping"],
  vote: {
    step: "Plan · step 1",
    question: "When's the cabin weekend?",
    optimalTitle: "Best for everyone",
    optimalNote: "14–17 Aug · 9 of 11 free",
    options: [
      { dateLabel: "14–17\nAUG", votes: 8, pct: 100, voters: ["TZ", "KV", "AM"], extra: 5, winner: true },
      { dateLabel: "21–24\nAUG", votes: 5, pct: 57, voters: ["KV", "PN"], extra: 3 },
      { dateLabel: "7–10\nAUG", votes: 2, pct: 24, voters: [], pending: true },
    ],
    cta: "Lock in 14–17 Aug",
  },
  destination: {
    kicker: "The destination",
    name: "Chata Pod Lysou",
    address: "Krásná 142 · Beskydy",
    mapsLabel: "📍 Open in Maps · 14 km from Frýdlant",
    facts: [
      { label: "Check-in", value: "15:00 Thu" },
      { label: "Wi-Fi", value: "Yes · 50 Mb" },
      { label: "Sleeps", value: "11 people" },
      { label: "Nightly", value: "4 200 Kč" },
    ],
    transportLabel: "Getting there · 3 cars",
    rides: [
      { member: "TZ", title: "Tomáš · from Brno", note: "Thu 14:00 · 2 seats left", cta: "Claim" },
      { member: "KV", title: "Klára · from Praha", note: "Thu 12:30 · 1 seat left", cta: "Claim" },
    ],
    offerCta: "+ Offer a ride",
    notes: ["Firewood & sauna included", "Bring indoor slippers", "No pets · quiet after 22:00"],
  },
  rooms: {
    headline: "Pick your bed",
    claimed: "7 / 11",
    rooms: [
      {
        name: "Attic loft",
        meta: "3 / 4 · upstairs",
        beds: [{ kind: "taken", member: "KV" }, { kind: "taken", member: "AM" }, { kind: "taken", member: "PN" }, { kind: "claim" }],
      },
      {
        name: "Master room",
        meta: "2 / 2 · full",
        wide: true,
        beds: [{ kind: "taken", member: "TZ" }, { kind: "taken", member: "EV" }],
      },
      {
        name: "Bunk room",
        meta: "2 / 4 · 2 free",
        open: true,
        beds: [{ kind: "taken", member: "JS" }, { kind: "taken", member: "MV" }, { kind: "claim" }, { kind: "free" }],
      },
    ],
  },
  finances: {
    balanceValue: "+840 Kč",
    balanceNote: "You're owed more than you owe",
    positive: true,
    tabs: ["Balances", "Expenses", "Deposits"],
    rows: [
      { member: "KV", note: "owes you · groceries", amount: "+540", direction: "owed" },
      { member: "AM", note: "owes you · taxi", amount: "+260", direction: "owed" },
      { member: "TZ", note: "owes you · firewood", amount: "+40", direction: "owed" },
    ],
    qr: { amount: "320 Kč", to: "Adam" },
  },
  organize: {
    readyPercent: 68,
    overviewKicker: "Organizer overview · 23 days out",
    overviewTitle: "5 open loops to close",
    loops: [
      { section: "Dates", status: "✓ Done", statusTone: "confirmed", title: "Dates locked · 14–17 Aug", note: "All 11 voted" },
      { section: "Deposits", status: "4 unpaid", statusTone: "due", title: "6 000 Kč outstanding", members: ["KV", "PN", "MV", "EV"], cta: "Nudge 4 →" },
      { section: "Rooms", status: "4 free", statusTone: "due", title: "4 beds unclaimed", note: "3 people haven't picked", cta: "Remind →" },
      { section: "Lists", status: "6 open", statusTone: "due", title: "6 shopping items unassigned", note: "Breakfast & firewood run", cta: "Assign →" },
    ],
    nudges: [
      {
        title: "Deposit reminder",
        body: "“Ahoj! Quick nudge — the cabin deposit (1 500 Kč) is due Friday. QR's in the app 💚”",
        primary: "Send to 4",
        secondary: "Edit",
        highlight: true,
      },
      { title: "Bed picker poke", body: "3 people still need a bed. Send a friendly reminder?", primary: "Remind them" },
    ],
    week: [
      { text: "Klára claimed the attic bed" },
      { text: "Adam paid his deposit · +1 500 Kč" },
      { text: "Booking deadline in 4 days", done: true },
    ],
  },
};

const olympics: Trip = {
  slug: "la2028",
  subdomain: "la2028.zicha.travel",
  shortName: "Road to LA 2028",
  titleLines: ["Road to", "LA 2028"],
  location: "Los Angeles · USA",
  daysToGo: 512,
  goingLabel: "6 going",
  crowd: { ids: ["TZ", "KV", "AM"], extra: 3 },
  blurb: "Electric and civic — cobalt & gold, the Games at last.",
  theme: {
    accent: "#3a5bff",
    accentInk: "#1f33b0",
    accentSoft: "#e6e9ff",
    gold: "#ffd23f",
    photo: "radial-gradient(125% 95% at 22% 0%, #93a6ff 0%, #3a5bff 38%, #2230a8 72%, #131a4d 100%)",
  },
  nav: baseNav("la2028"),
  nextUp: {
    kicker: "Next up · closes Sunday",
    title: "Ticket lottery",
    sub: "Athletics · 100m final",
    cta: "Enter",
    tone: "dark",
  },
  stats: [
    { icon: "📅", label: "Dates", value: "14–22 Jul", sub: "Locked in", tone: "confirmed", dot: true },
    { icon: "🎟", label: "Events", value: "5 booked", sub: "2 in lottery", tone: "muted" },
    { icon: "💸", label: "Your balance", value: "−2 100 Kč", sub: "you owe Tomáš", tone: "overdue" },
    { icon: "✈️", label: "Flights", value: "Searching", sub: "3 options saved", tone: "muted" },
  ],
  pulse: ["Tomáš booked the AirBnB in Venice Beach", "Klára saved a flight via Reykjavík"],
  vote: {
    step: "Plan · step 1",
    question: "Which week do we fly in?",
    optimalTitle: "Best for everyone",
    optimalNote: "Arrive 12 Jul · all 6 off work",
    options: [
      { dateLabel: "12–24\nJUL", votes: 6, pct: 100, voters: ["TZ", "KV", "AM"], extra: 3, winner: true },
      { dateLabel: "14–22\nJUL", votes: 4, pct: 60, voters: ["TZ", "PN"], extra: 2 },
      { dateLabel: "16–26\nJUL", votes: 1, pct: 18, voters: [], pending: true },
    ],
    startLabel: "Fly from",
    startPoints: [
      { name: "Praha", note: "1 stop · cheapest", votes: 4, selected: true },
      { name: "Vienna", note: "direct · pricier", votes: 2 },
    ],
    cta: "Lock in 12 Jul · from Praha",
  },
  destination: {
    kicker: "Base camp",
    name: "Venice Beach House",
    address: "Abbot Kinney · Los Angeles",
    mapsLabel: "📍 Open in Maps · 12 km from SoFi Stadium",
    facts: [
      { label: "Check-in", value: "16:00 Sun" },
      { label: "Wi-Fi", value: "Yes · 200 Mb" },
      { label: "Sleeps", value: "6 people" },
      { label: "Nightly", value: "$ 240" },
    ],
    transportLabel: "Getting around · rentals",
    rides: [
      { member: "TZ", title: "Tomáš · minivan", note: "Picks up at LAX · 3 seats", cta: "Claim" },
      { member: "AM", title: "Adam · metro pass", note: "Sharing a TAP card · day 2", cta: "Join" },
    ],
    offerCta: "+ Add a rental",
    notes: ["Bikes & boards in the garage", "Tap card needed for the metro", "AC runs hot — bring layers"],
  },
  rooms: {
    headline: "Pick your room",
    claimed: "4 / 6",
    rooms: [
      {
        name: "Ocean room",
        meta: "2 / 2 · full",
        wide: true,
        beds: [{ kind: "taken", member: "TZ" }, { kind: "taken", member: "KV" }],
      },
      {
        name: "Studio",
        meta: "1 / 2 · 1 free",
        open: true,
        beds: [{ kind: "taken", member: "AM" }, { kind: "claim" }],
      },
      {
        name: "Loft",
        meta: "1 / 2 · 1 free",
        open: true,
        beds: [{ kind: "taken", member: "PN" }, { kind: "claim" }],
      },
    ],
  },
  finances: {
    balanceValue: "−2 100 Kč",
    balanceNote: "You owe more than you're owed",
    positive: false,
    tabs: ["Balances", "Expenses", "Deposits"],
    rows: [
      { member: "TZ", note: "you owe · flights", amount: "−2 100", direction: "owe" },
      { member: "KV", note: "owes you · groceries", amount: "+540", direction: "owed" },
      { member: "AM", note: "owes you · taxi", amount: "+260", direction: "owed" },
    ],
    qr: { amount: "2 100 Kč", to: "Tomáš" },
  },
  organize: {
    readyPercent: 41,
    overviewKicker: "Organizer overview · 512 days out",
    overviewTitle: "4 open loops to close",
    loops: [
      { section: "Dates", status: "✓ Done", statusTone: "confirmed", title: "Arrival locked · 12 Jul", note: "All 6 voted" },
      { section: "Tickets", status: "2 pending", statusTone: "due", title: "2 events in the lottery", members: ["TZ", "KV"], cta: "Check →" },
      { section: "Flights", status: "open", statusTone: "due", title: "Flights not booked", note: "3 options saved", cta: "Compare →" },
      { section: "Money", status: "1 unpaid", statusTone: "due", title: "Adam owes the flight split", note: "2 100 Kč", cta: "Nudge →" },
    ],
    nudges: [
      {
        title: "Lottery closes Sunday",
        body: "“Reminder: the 100m final lottery closes Sun 23:59. Enter in the app so we maximise our odds 🤞”",
        primary: "Send to 6",
        secondary: "Edit",
        highlight: true,
      },
      { title: "Flight compare", body: "3 saved options expire in 5 days. Pick one as a group?", primary: "Open compare" },
    ],
    week: [
      { text: "Tomáš booked the Venice Beach house" },
      { text: "Klára saved a flight via Reykjavík" },
      { text: "Lottery deadline in 3 days", done: true },
    ],
  },
};

const cycling: Trip = {
  slug: "baltic",
  subdomain: "balt.zicha.travel",
  shortName: "Ride to the Baltic",
  titleLines: ["Ride to", "the Baltic"],
  location: "Gdańsk → Hel · PL",
  daysToGo: 40,
  goingLabel: "7 riders",
  crowd: { ids: ["TZ", "KV", "AM"], extra: 4 },
  blurb: "Sunset coral & Baltic teal — 420 km to the sea.",
  theme: {
    accent: "#f0653c",
    accentInk: "#b23c1c",
    accentSoft: "#ffe7df",
    photo: "radial-gradient(130% 100% at 74% 0%, #ffd06b 0%, #f0653c 32%, #c23f6a 60%, #2b6f8f 100%)",
  },
  nav: baseNav("baltic", "Route", "🗺"),
  nextUp: {
    kicker: "Next up · ends in 2 days",
    title: "Confirm bike rental",
    sub: "900 Kč · gravel + panniers",
    cta: "OK",
    tone: "accent",
  },
  stats: [
    { icon: "🚲", label: "Route", value: "420 km", sub: "6 days · 4 stops", tone: "muted" },
    { icon: "🛏", label: "Hostels", value: "4 of 7", sub: "3 to book", tone: "due", dot: true },
    { icon: "💸", label: "Your balance", value: "+560 Kč", sub: "you're owed", tone: "confirmed" },
    { icon: "🎒", label: "Packing", value: "Panniers", sub: "8 to pack", tone: "muted" },
  ],
  pulse: ["Adam mapped day 3 — Łeba to Władysławowo", "Klára booked the hostel in Sopot"],
  vote: {
    step: "Route · step 1",
    question: "When do we ride?",
    optimalTitle: "Best for everyone",
    optimalNote: "21–28 Jun · all 7 riders free",
    options: [
      { dateLabel: "21–28\nJUN", votes: 7, pct: 100, voters: ["TZ", "KV", "AM"], extra: 4, winner: true },
      { dateLabel: "28 Jun–\n5 JUL", votes: 4, pct: 57, voters: ["TZ", "EV"], extra: 2 },
      { dateLabel: "5–12\nJUL", votes: 2, pct: 28, voters: [], pending: true },
    ],
    startLabel: "Start point",
    startPoints: [
      { name: "Gdańsk", note: "train-friendly", votes: 5, selected: true },
      { name: "Świnoujście", note: "flatter route", votes: 2 },
    ],
    cta: "Lock in 21–28 Jun · Gdańsk",
  },
  destination: {
    kicker: "The route",
    name: "Gdańsk → Hel",
    address: "Baltic coast · 420 km",
    mapsLabel: "📍 Open route · 6 days, 4 overnight stops",
    facts: [
      { label: "Distance", value: "420 km" },
      { label: "Climb", value: "1 800 m" },
      { label: "Surface", value: "70% paved" },
      { label: "Per day", value: "~70 km" },
    ],
    transportLabel: "Getting there · train",
    rides: [
      { member: "TZ", title: "Tomáš · bikes by train", note: "Praha → Gdańsk · 2 bike spots", cta: "Claim" },
      { member: "KV", title: "Klára · van shuttle", note: "Brno → Gdańsk · 3 seats", cta: "Claim" },
    ],
    offerCta: "+ Offer transport",
    notes: ["Gravel tyres recommended", "Headwind likely days 4–5", "Ferry from Hel back to Gdańsk"],
  },
  rooms: {
    headline: "Book the hostels",
    claimed: "4 / 7",
    rooms: [
      {
        name: "Sopot · night 1",
        meta: "Booked · dorm of 7",
        beds: [
          { kind: "taken", member: "TZ" }, { kind: "taken", member: "KV" }, { kind: "taken", member: "AM" }, { kind: "taken", member: "PN" },
        ],
      },
      {
        name: "Łeba · night 3",
        meta: "2 / 7 · to book",
        open: true,
        beds: [{ kind: "taken", member: "JS" }, { kind: "taken", member: "MV" }, { kind: "claim" }, { kind: "free" }],
      },
      {
        name: "Władysławowo · night 5",
        meta: "Not booked · 3 to confirm",
        open: true,
        beds: [{ kind: "claim" }, { kind: "free" }, { kind: "free" }],
      },
    ],
  },
  finances: {
    balanceValue: "+560 Kč",
    balanceNote: "You're owed more than you owe",
    positive: true,
    tabs: ["Balances", "Expenses", "Deposits"],
    rows: [
      { member: "AM", note: "owes you · hostel", amount: "+420", direction: "owed" },
      { member: "KV", note: "owes you · bike rental", amount: "+140", direction: "owed" },
      { member: "TZ", note: "you owe · train", amount: "−200", direction: "owe" },
    ],
    qr: { amount: "200 Kč", to: "Tomáš" },
  },
  organize: {
    readyPercent: 57,
    overviewKicker: "Organizer overview · 40 days out",
    overviewTitle: "3 open loops to close",
    loops: [
      { section: "Dates", status: "✓ Done", statusTone: "confirmed", title: "Dates locked · 21–28 Jun", note: "All 7 voted" },
      { section: "Hostels", status: "3 to book", statusTone: "due", title: "3 nights unbooked", note: "Łeba & Władysławowo", cta: "Book →" },
      { section: "Bikes", status: "2 pending", statusTone: "due", title: "2 rentals unconfirmed", members: ["JS", "MV"], cta: "Nudge →" },
      { section: "Route", status: "open", statusTone: "due", title: "Day 4 GPX missing", note: "Łeba → Władysławowo", cta: "Assign →" },
    ],
    nudges: [
      {
        title: "Hostel deadline",
        body: "“Ahoj riders! Łeba hostel holds our beds till Friday. Confirm in the app so we don't lose them 🚲”",
        primary: "Send to 7",
        secondary: "Edit",
        highlight: true,
      },
      { title: "Bike rental poke", body: "Jana & Martin haven't confirmed gravel bikes. Remind them?", primary: "Remind them" },
    ],
    week: [
      { text: "Adam mapped day 3 — Łeba to Władysławowo" },
      { text: "Klára booked the hostel in Sopot" },
      { text: "Hostel hold expires in 4 days", done: true },
    ],
  },
};

// ---------------------------------------------------------------------------
// Access helpers — the seam a real backend would slot into
// ---------------------------------------------------------------------------

export const TRIPS: Trip[] = [cabin, olympics, cycling];

export function getTrip(slug: string): Trip | undefined {
  return TRIPS.find((t) => t.slug === slug);
}

export function tripSlugs(): string[] {
  return TRIPS.map((t) => t.slug);
}

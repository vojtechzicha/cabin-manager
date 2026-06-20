# Chata — group-trip prototype

A Next.js prototype of the **Chata** design system: _one app, re-skinned by photo
and accent for every trip._ Built from the `Chata Screens` / `Chata Design System`
boards. This is a clickable, fully-responsive prototype with mock data — the
intended next step is to swap the data layer for a real backend.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # all routes prerender (SSG)
```

## The idea

A trip is deployed to its own subdomain and themed by **three knobs only**: a
background photo, an accent colour sampled from it, and an icon. Layout, type,
spacing and components never change — so there is exactly one system to maintain.

Three seeded trips show the same screens re-skinned:

| Trip | Accent | Route |
| --- | --- | --- |
| Summer Cabin | sage / forest | `/cabin` |
| Road to LA 2028 | cobalt / gold | `/la2028` |
| Ride to the Baltic | sunset coral | `/baltic` |

## Screens

Consumer app (mobile-first, responsive) — bottom glass nav on phones, left
side-rail on desktop:

- `/[trip]` — **Dashboard**: hero, countdown, next-up, stat grid, trip pulse
- `/[trip]/plan` — **Voting**: optimal-date suggestion, vote bars, start point
- `/[trip]/stay` — **Rooms & beds**: claim a bed before someone else does
- `/[trip]/money` — **Finances**: balances, expenses, deposits, QR settle
- `/[trip]/info` — **Destination**: facts, getting there, good to know

Organizer (desktop-first, collapses to one column on mobile):

- `/[trip]/organize` — **The organizer's desk**: open loops + assistant nudges

Plus `/` — a landing / trip picker.

## How the theming works

Theming is driven entirely by four CSS variables set once per trip:

```
--accent  --accent-ink  --accent-soft  --photo
```

`src/lib/theme.ts` turns a trip's `Theme` into those variables; the `[trip]`
layout spreads them onto a wrapper, and every `bg-accent`, `.bg-photo`, glass
tint, etc. below re-skins automatically. Tailwind's `@theme inline` (in
`globals.css`) maps the warm neutral spine and the accent utilities to those
variables.

## The seam (turning this into the real thing)

All data lives in **`src/lib/trips.ts`** as plain typed objects, behind
`getTrip()` / `TRIPS`. Replace those helpers with database / API calls and the
screens stay untouched. Hero "photos" are gradient stand-ins — drop in real
images (and resample the accent) without changing layout.

## Stack

Next.js 16 (App Router, RSC) · TypeScript · Tailwind v4 · `next/font`
(Bricolage Grotesque / Hanken Grotesk / Space Mono). No client state beyond the
nav active-state; every page is a static Server Component.

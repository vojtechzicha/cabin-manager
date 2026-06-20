# zicha.travel — Build-Ready Engineering Tickets

**Companion to:** `zicha-travel-PRD.md` (referenced by section, e.g. §8.5)
**For:** Claude Code
**Design:** Delivered as HTML mockups — these tickets cover converting that design to the real implementation, not visual design.

---

## 0. Stack & architecture (read first — applies to every ticket)

### 0.1 Technology (pinned)

- **TypeScript** — latest 5.x, `strict: true`, `noUncheckedIndexedAccess: true`.
- **Next.js 16.2.x (LTS)** — App Router, Turbopack default, React 19, React Compiler on. Node.js 20+.
- **Payload CMS 3.85.x (latest stable)** — installed into the Next.js `/app` folder. **Do not use Payload v4 beta** for the foundation.
- **MongoDB** via `@payloadcms/db-mongodb` (`mongooseAdapter`). Use a replica-set–capable MongoDB (Atlas or local RS) so **multi-document transactions** are available — required for finance integrity.
- **Email:** a transactional provider (e.g. Resend/Postmark) behind an interface; no provider lock-in in the domain.

### 0.2 Architecture principles (the foundation — non-negotiable)

This product's value is correctness of money and state. Enforce strict layering:

```
src/
  domain/            # PURE TypeScript. No Payload, Next, Mongo, or React imports.
    finance/         #   settlement engine (§8.5 math)
    scheduling/      #   optimal-date algorithm (§8.2.1)
    lifecycle/       #   state-machine guards (§7)
  payments/          # SPAYD QR + CZ account↔IBAN (pure, framework-free)
  i18n/              # locale config, catalogs, formatters
  collections/       # Payload collections = data schema + access control
  access/            # reusable access predicates (per-membership/role)
  services/          # application/use-case layer; orchestrates domain + Payload local API
  components/        # React design system (built from the HTML mockups)
  app/
    (payload)/       # Payload admin + REST/GraphQL — ADMIN ONLY
    (app)/           # frontend: organizer console + participant app
  lib/
```

- **The `domain/` and `payments/` layers must not import from `collections/`, `app/`, Payload, Next, or Mongo.** Enforce with `eslint-plugin-boundaries` (or `import/no-restricted-paths`). A violating import fails CI. This is itself a ticket (T-002).
- **Money/state math lives only in `domain/`** and is unit-tested in isolation. Services map Payload documents → domain inputs → domain outputs → Payload writes.
- **Authorization is server-side only**, expressed as Payload `access` functions keyed on the requesting user's Membership/role. The client is never trusted. There is no organizer admin panel — `(payload)` is reachable only by `role: admin`.
- **Lifecycle locking is enforced server-side** (a Closed ledger rejects writes), not just hidden in the UI.
- **Generated types:** run Payload type generation; share generated types with services; never hand-maintain duplicate types.

### 0.3 Definition of Done (every ticket)

- Type-checks under strict mode; no `any` in domain/services.
- Unit tests for domain logic; integration tests for access control and lifecycle guards; the listed acceptance criteria are covered by tests.
- Boundary lint passes (no illegal cross-layer imports).
- Strings are localized (no hardcoded UI copy); CS + EN catalogs updated.
- Audit entries written for finance, deposit, and lifecycle actions where applicable.
- Mobile-first; matches the delivered HTML design.

### 0.4 Ticket conventions

Each ticket has: **Summary · Tasks · Acceptance criteria · Depends on · Notes · Size** (S/M/L/XL). Build order follows PRD phasing (P1 → P2 → P3); Epic 0 and the settlement engine (T-501) come first regardless of phase.

---

## Epic 0 — Foundation & architecture

### T-001 · Project bootstrap — Next 16 + Payload 3.85 + MongoDB

**Summary:** Stand up the monorepo-free single app with Payload embedded in Next.js, MongoDB adapter, strict TS, route groups.
**Tasks:**

- Scaffold Next.js 16 (App Router, Turbopack). Add Payload 3.85 into `/app` with the `(payload)` route group; create the `(app)` route group for the frontend.
- Configure `@payloadcms/db-mongodb` (`mongooseAdapter`) pointing at a replica-set Mongo (`DATABASE_URI`). Set `PAYLOAD_SECRET`.
- TS strict config; path aliases for the layer folders.
- `.env` schema + validation; Dockerized local Mongo RS for dev.
- Health check route.
  **Acceptance criteria:** `pnpm dev` runs; Payload admin loads at `/admin`; a trivial collection persists to Mongo; transactions are available (RS confirmed); type generation works.
  **Depends on:** —
  **Notes:** Align the exact Next version to Payload 3.85's peer requirement if it lags 16.2. Keep CZK/Czech specifics out of bootstrap.
  **Size:** M

### T-002 · Architecture boundaries & CI guardrails

**Summary:** Encode the layering rules so they can't rot.
**Tasks:**

- Add `eslint-plugin-boundaries`; declare layer elements and allowed dependencies (domain → nothing; payments → nothing; services → domain/payments/collections; collections → access/i18n; app → services/components).
- Forbid Payload/Next/Mongo/React imports inside `domain/` and `payments/`.
- CI pipeline: typecheck, lint (incl. boundaries), unit + integration tests.
- Commit a short `ARCHITECTURE.md` describing the layers and the "money math only in domain" rule.
  **Acceptance criteria:** an intentional illegal import (e.g. importing a Payload collection into `domain/finance`) fails CI; valid imports pass.
  **Depends on:** T-001
  **Size:** S

### T-003 · i18n foundation (multilingual is core — §6)

**Summary:** Locale routing, message catalogs, per-user language, locale-aware formatting.
**Tasks:**

- Locale strategy for App Router (CS default, EN), with architecture to add locales as content.
- Message catalog structure + typed message access; CS + EN baseline.
- Per-user `preferredLanguage` on Identity; resolve order: user pref → request header → default.
- Formatters for date/time/number/currency (CZK default), locale-aware.
- Helper to render **system messages (email/reminders/share text) in the recipient's** language, independent of the sender's UI locale.
  **Acceptance criteria:** switching a user's language switches all chrome; a reminder to a CS user renders CS even if triggered by an EN organizer; CZK and dates format per locale.
  **Depends on:** T-001
  **Notes:** Czech banking/QR stays locale-independent (handled in `payments/`).
  **Size:** M

### T-004 · Design system from HTML mockups

**Summary:** Convert the delivered HTML design into reusable React components + tokens.
**Tasks:**

- Extract design tokens (colors, radii, typography, spacing, the glass-morphism surfaces) into a theme.
- Build the core component library (buttons, cards, sheets, lists, form controls, status badges for settled/owing/confirmed/provisional, the mobile app shell + nav).
- Per-trip theming hook (color/photo/icon brands each trip).
- Ensure thumb-reachable primary actions; mobile-first breakpoints.
  **Acceptance criteria:** a component gallery renders all primitives; status semantics are consistent and colorblind-distinguishable; matches mockups on a 380px viewport.
  **Depends on:** T-001, T-003
  **Size:** L

### T-005 · Audit log infrastructure

**Summary:** Append-only audit trail for sensitive actions.
**Tasks:**

- `AuditEntry` collection (actor, action, targetType, targetId, metadata, timestamp); write-only via a service helper.
- Service helper used by finance, deposit, lifecycle transitions.
  **Acceptance criteria:** closing accounts / confirming a deposit / editing an expense each write an immutable audit entry; entries are queryable by trip.
  **Depends on:** T-001
  **Size:** S

### T-006 · Test harness, fixtures & seed

**Summary:** Make the listed acceptance criteria runnable.
**Tasks:**

- Unit runner for `domain/`/`payments/` (fast, no DB).
- Integration runner with an ephemeral Mongo RS; auth/membership test helpers.
- Seed script: a sample trip with participants, expenses, prepayments, rooms, cars, polls.
- Optional e2e smoke (Playwright) for the few critical flows (login, vote, pay deposit, settle).
  **Acceptance criteria:** `pnpm test` runs unit + integration green; seed produces a navigable demo trip.
  **Depends on:** T-001
  **Size:** M

---

## Epic 1 — Identity, accounts & authentication (PRD §4–§5) · P1

### T-101 · Core collections: Identity, Membership, Trip, Invitation + baseline access

**Summary:** The relational backbone (§4, §9).
**Tasks:**

- `Identity` (verified email, linked providers, contact channels, displayName, avatar, preferredLanguage, preferredChannel).
- `Trip` (config per §9, lifecycle + per-area state fields, banker ref, deposit config, invite settings).
- `Membership` (Identity↔Trip, role, isBanker, confirmed, attendance block, bank account/IBAN).
- `Invitation` (target, token, status, source).
- Baseline access: a user reads only Trips they have a Membership in.
  **Acceptance criteria:** a person with memberships in 2 trips sees exactly those 2; cross-trip reads are denied by access control (integration test).
  **Depends on:** T-001, T-002
  **Notes:** Model "pending membership" so an organizer can pre-fill data before the invitee has an Identity.
  **Size:** L

### T-102 · OAuth login (Google, Microsoft)

**Summary:** Provider login that creates/links an Identity.
**Tasks:** OAuth flows; link provider to existing Identity by verified email; first-login provisioning.
**Acceptance criteria:** Google and Microsoft logins both resolve to one Identity when emails match; new users get an Identity.
**Depends on:** T-101
**Size:** M

### T-103 · Magic-link passwordless auth

**Summary:** Tokenized one-time login/invite URLs.
**Tasks:** generate signed, single-use, expiring tokens; consume → session; bind token to email/membership; replay protection.
**Acceptance criteria:** a used or expired token is rejected; a valid token logs in and resolves any pending membership.
**Depends on:** T-101
**Notes:** The token is the auth; delivery is separate (T-105).
**Size:** M

### T-104 · Invitations: direct + open-join (approval default)

**Summary:** §5 invite flows.
**Tasks:**

- Direct invite (email/phone/handle/name) → pending membership + token.
- Open-join link per trip (toggle, default off); join requests **require organizer approval by default** (toggle to auto-accept).
- Approval queue UI for organizer.
  **Acceptance criteria:** open-join requests land in an approval queue unless auto-accept is on; approving activates membership.
  **Depends on:** T-101, T-103
  **Size:** M

### T-105 · Invite & notification delivery: email + share intents

**Summary:** Deliver tokenized URLs (§4, §11).
**Tasks:**

- Transactional email service behind an interface (localized templates).
- Share-intent link builder: `wa.me/?text=…`, `t.me/share/url?…`, `mailto:`, copy/native share — all client-side, no APIs.
- Always email when an address exists; always offer share intents.
  **Acceptance criteria:** invite email arrives localized; WhatsApp/Telegram buttons open the respective app with the correct pre-filled, URL-encoded text and the live token URL.
  **Depends on:** T-003, T-103
  **Size:** M

### T-106 · Authorization model + admin lockdown

**Summary:** Per-membership/role access across collections; `(payload)` admin-only.
**Tasks:**

- Reusable access predicates in `access/` (isMember, isOrganizer, isBanker, isPlatformAdmin, isSelf).
- Apply to every collection's read/create/update/delete.
- Restrict Payload admin (`/admin`) to `role: admin`; block all others with a route guard.
- **Votes readable by all trip members** (§8.2); finances/personal data least-privilege.
  **Acceptance criteria:** a participant cannot reach `/admin`; a participant cannot edit another's banking; all members can read all votes; integration tests for each predicate.
  **Depends on:** T-101
  **Size:** L

---

## Epic 2 — Trip lifecycle & configuration (PRD §7, §8.1) · P1

### T-201 · Trip creation & organizer console shell

**Summary:** Frontend-only trip creation/config and the organizer console frame.
**Tasks:** create-trip flow (name/short name/location/theme/photo/icon, enabled areas, banker + account); console navigation shell; co-organizer management.
**Acceptance criteria:** an organizer creates and configures a trip entirely on the frontend (never touching `/admin`).
**Depends on:** T-101, T-106, T-004
**Size:** M

### T-202 · Lifecycle & area-locking state machine

**Summary:** §7 — the integrity backbone for state.
**Tasks:**

- `domain/lifecycle` pure guards: allowed transitions for trip phase and per-area states (poll Open→Closed; roster Open→Locked; **finances Open→Settling→Closed**).
- Rule: overlaps allowed **unless they break logic** (block settling a date that isn't chosen, etc.).
- Server-side enforcement: a Closed ledger rejects expense/prepayment writes; re-open is explicit and audited.
- Transition service writes audit entries.
  **Acceptance criteria:** writing an expense to a Closed ledger is rejected server-side (not just hidden); illegal transitions throw; re-open is logged; unit tests cover the transition table.
  **Depends on:** T-002, T-005, T-101
  **Notes:** This guards the §14.7 "must close accounts" decision.
  **Size:** L

### T-203 · Trip info & content (destination, directions, transport reference)

**Summary:** §8.7 read-mostly content maintained by organizer.
**Tasks:** destination block (name, location, description, links, photos, basic-info bullets); driving directions per origin; parking; public-transport options (line, from/to, times).
**Acceptance criteria:** organizer edits content; participants view it localized in chrome, content as authored.
**Depends on:** T-201
**Size:** M

---

## Epic 3 — Ideation: voting (PRD §8.2) · P1

### T-301 · Poll / Option / Vote model (votes public)

**Summary:** Data + access for date and location polls.
**Tasks:** `Poll` (type, method, state, winner), `PollOption` (value, suggestedBy), `Vote` (option, membership, value); **all votes readable by trip members**.
**Acceptance criteria:** votes are visible to all members with voter identity; one membership = one vote per option (updatable).
**Depends on:** T-101, T-106
**Size:** M

### T-302 · Voting UI — approval + grid/single-choice, live tally

**Summary:** §8.2 — both methods supported, organizer picks per poll.
**Tasks:** approval voting (Yes/If-needed/No); availability grid for dates; single-choice for location; live-updating tally.
**Acceptance criteria:** organizer chooses method per poll; tallies update near-live for all viewers; mobile-friendly grid.
**Depends on:** T-301, T-004
**Size:** L

### T-303 · Participant-suggested options + moderation

**Summary:** Let participants add options; organizer curate.
**Tasks:** suggestion flow flagged `suggestedBy`; organizer merge/hide/promote.
**Acceptance criteria:** a participant adds a date/location option others can vote on; organizer can hide/merge it.
**Depends on:** T-301
**Size:** S

### T-304 · Optimal-date suggestion algorithm (§8.2.1)

**Summary:** Pure domain module that recommends best windows.
**Tasks:**

- `domain/scheduling`: given availability + desired length N + optional VIP weights, score each contiguous window (Yes 1.0 / If-needed 0.5 / No 0 or exclude); tie-breakers (more full-Yes, fewer If-needed, earlier, weekend coverage).
- Output ranked windows with attendance preview + "can't make it" list.
- Organizer UI to view suggestions; never auto-commits.
  **Acceptance criteria:** unit tests over crafted availability sets produce the expected ranking and tie-break order; UI shows top suggestions with the missing-people breakdown.
  **Depends on:** T-002, T-301
  **Notes:** Pure function, no DB — heavily unit-tested.
  **Size:** M

### T-305 · Close poll → promote winner

**Summary:** Lock a poll and write the decision onto the trip.
**Tasks:** close action (uses T-202 guards); promote winning date → trip dates, winning location → destination.
**Acceptance criteria:** closing is idempotent; winner is written to the trip; re-opening is audited.
**Depends on:** T-202, T-301
**Size:** S

---

## Epic 5 — Finances core (PRD §8.5) · P2 — **build the engine first**

### T-501 · Settlement engine (pure domain) — highest priority

**Summary:** The crown jewel. All money math, isolated and exhaustively tested (§8.5.1–8.5.2).
**Tasks:**

- `domain/finance`: model Expense (equal/weighted, planned/actual), Prepayment (advance/supplement/refund/distribution).
- Compute per-participant `paidExternal`, `plannedPaidExternal`, `prepaidInternal`, `cost`, `plannedCost`, and `balance` exactly per §8.5.2.
- **1 Kč settlement threshold**; classify debtor/creditor/settled.
- Compute minimal banker-hub transfer set.
- Rounding-safe integer/decimal handling; never lose or invent money (sum of balances ≈ 0 within threshold).
  **Acceptance criteria:** comprehensive unit tests including weighted splits, weight-0 exclusion, planned vs actual separation, negative amounts/refunds, threshold edge cases, and a balance-conservation property test; **zero** Payload/DB imports.
  **Depends on:** T-002
  **Notes:** This module must be implementable and testable with no database. Services adapt Payload docs to/from it.
  **Size:** XL

### T-502 · Finance collections + auto-add suggestions

**Summary:** Persist expenses/prepayments; wire participative behavior (§8.5.3).
**Tasks:** `Expense` (+ state planned/actual, suggestedBy, weights), `Prepayment`; access rules; **participant-suggested expenses auto-add while ledger Open**; participant can opt in/out and edit own weight; organizer can edit/remove.
**Acceptance criteria:** a participant adds an expense and it appears for all immediately; a participant toggling their own inclusion updates their share; writes blocked when ledger is Settling/Closed (via T-202).
**Depends on:** T-202, T-501, T-106
**Size:** L

### T-503 · Czech payments module — SPAYD QR + account↔IBAN

**Summary:** `payments/` framework-free module (§8.5.4).
**Tasks:** generate SPAYD ("QR Platba") strings + QR images (IBAN, amount, CZK, message = short name + purpose); convert Czech account `prefix-number/bank` ↔ IBAN both directions with validation.
**Acceptance criteria:** known account/IBAN pairs convert correctly both ways; generated SPAYD validates against the spec and scans in a banking app (manual check) ; invalid inputs rejected.
**Depends on:** T-002
**Size:** M

### T-504 · Finance UI

**Summary:** Surface the engine (§8.5.3–8.5.4).
**Tasks:** expense list with each member's share; "you're in for X" per expense; opt in/out + own-weight control; running balance; QR-to-pay the banker; creditor refund account capture.
**Acceptance criteria:** numbers match the engine; balances update on changes; QR renders for the amount owed.
**Depends on:** T-501, T-502, T-503, T-004
**Size:** L

### T-505 · Accounts lifecycle (Open → Settling → Closed)

**Summary:** Make finances stop changing on command (§7, §14.7).
**Tasks:** organizer controls to advance ledger state; immutability in Settling/Closed; explicit, audited re-open.
**Acceptance criteria:** in Closed, all expense/prepayment mutations are rejected server-side; state and transitions are visible and audited.
**Depends on:** T-202, T-502
**Size:** M

### T-506 · Banker confirmation flows

**Summary:** Banker-confirms-only money receipt (§8.3.2, §8.5).
**Tasks:** banker UI to confirm received advances/supplements (incl. deposits), and issue refunds/distributions; each confirmation writes audit + updates balances. No participant self-declared "paid" state.
**Acceptance criteria:** a payment counts only after banker confirmation; confirming a deposit flips the participant's `confirmed` flag (see T-404).
**Depends on:** T-501, T-502, T-005
**Size:** M

---

## Epic 4 — Planning: attendance, deposit, sleeping, transport (PRD §8.3) · P2

### T-401 · Attendance confirmation

**Summary:** §8.3.1.
**Tasks:** status (Coming/Not/Maybe), duration (nights / arrival-departure), companions + pets; organizer roster + headcount lock.
**Acceptance criteria:** participant sets attendance; organizer sees live roster and can lock it.
**Depends on:** T-201, T-101
**Size:** M

### T-402 · Sleeping — rooms/beds inventory + claims

**Summary:** §8.3.3.
**Tasks:** organizer defines rooms→beds (+capacity, photos, pet-friendly); participant claims a bed (optional night-range); conflict prevention; organizer override + confirm.
**Acceptance criteria:** two participants can't claim the same bed/night; organizer can reassign; final map confirmable.
**Depends on:** T-401, T-004
**Size:** L

### T-403 · Transport — cars, seats, equipment

**Summary:** §8.3.4 self-service rides + reference linkage.
**Tasks:** participant declares driving (creates car: driver, front passenger, seats, equipment list) / riding (claims seat) / own transport (links to T-203 public transport); organizer car-manifest view with "no ride yet" flags.
**Acceptance criteria:** seats fill correctly; manifest shows unassigned riders and free seats; equipment list editable per car.
**Depends on:** T-401, T-203
**Size:** L

### T-404 · Deposit-to-confirm (gated, planned-cost basis, banker-confirmed)

**Summary:** §8.3.2 — confirmation backed by money.
**Tasks:** deposit config (enabled, gating ON, basis = participant's `plannedCost` share from T-501); compute each deposit; QR to pay; status (Due → Confirmed); confirmation only via banker (T-506) flips `confirmed`; refund on drop-out via T-506.
**Acceptance criteria:** deposit equals the participant's planned-cost share; participant is provisional until the banker confirms; confirmation sets `confirmed`; dropping out refunds cleanly.
**Depends on:** T-501, T-503, T-506, T-401
**Size:** L

---

## Epic 6 — Logistics: lists (PRD §8.4) · P3

### T-601 · Shopping list + buy→expense

**Summary:** §8.4 group provisioning.
**Tasks:** items (name, qty/unit, category, estCost, assignee, status Needed→Claimed→Bought); collaborative add/claim; **one-tap Bought→Expense** prefilling payer/amount/split into finances (T-502); optional templates.
**Acceptance criteria:** marking bought offers to create an expense that lands in the ledger with the buyer as payer.
**Depends on:** T-502, T-004
**Size:** M

### T-602 · Packing list (shared gear ↔ car equipment; personal checklist)

**Summary:** §8.4.
**Tasks:** shared-gear list with claimed-by, **linkable to a car's equipment** (T-403); private personal checklist seeded from a template.
**Acceptance criteria:** claimed gear can be attached to a car for transport; personal checklist is private to its owner.
**Depends on:** T-403, T-004
**Size:** M

---

## Epic 7 — Organizer assistant (PRD §8.6) · P3

### T-701 · Open-loop dashboard

**Summary:** Computed "who hasn't done their part" signals.
**Tasks:** derive loops — not voted / not confirmed / deposit unpaid / no ride (and free seats) / no bed / owes money / claimed-but-not-bought — as pure selectors over trip state.
**Acceptance criteria:** dashboard lists each open loop with the affected people; selectors unit-tested against seeded states.
**Depends on:** T-401, T-403, T-404, T-502
**Size:** M

### T-702 · Reminders & nudges engine

**Summary:** §8.6 messaging.
**Tasks:** one-tap nudge per loop/person and broadcast; localized templates rendered in recipient language; channel routing (email default + share-intent fallback + in-app); rate-limit and **respect "already done"** state.
**Acceptance criteria:** nudging "drivers to confirm seats" messages only drivers, in their language; someone who already acted isn't re-nudged; rate limit holds.
**Depends on:** T-105, T-701, T-003
**Size:** L

### T-703 · Scheduled / automated reminders + jobs

**Summary:** §8.6 automation.
**Tasks:** use Payload's job queue for opt-in scheduled reminders (deposit due, T-7 rides, post-trip settle, "accounts open N days" organizer nudge); idempotent sends; per-trip enable.
**Acceptance criteria:** scheduled jobs fire once per target/window; disabling a trip's automation stops sends.
**Depends on:** T-702
**Size:** M

---

## Recommended build order

1. **Foundation:** T-001 → T-002 → T-006 → T-003 → T-004 → T-005.
2. **Identity/auth (P1):** T-101 → T-106 → T-102/T-103 → T-104 → T-105.
3. **Lifecycle & trips (P1):** T-201 → T-202 → T-203.
4. **Ideation (P1):** T-301 → T-302 → T-303 → T-304 → T-305.
5. **Finance engine first (P2):** **T-501** → T-503 → T-502 → T-505 → T-506 → T-504.
6. **Planning (P2):** T-401 → T-402 → T-403 → T-404.
7. **Lists & assistant (P3):** T-601/T-602 → T-701 → T-702 → T-703.

> Sequencing rule: T-501 (settlement engine) and T-202 (lifecycle guards) are prerequisites for anything touching money or state. Build and test them before the finance UI and deposits.

---

## Cross-cutting acceptance gates (per milestone)

- **Architecture gate:** boundary lint green; no money/state logic outside `domain/`; settlement engine has zero framework imports.
- **Security gate:** `/admin` unreachable by non-admins; per-membership access tests green; no client-trusted authorization.
- **Integrity gate:** Closed ledger rejects writes; balance-conservation property test passes; deposits equal planned-cost share.
- **i18n gate:** no hardcoded strings; recipient-language system messages verified.

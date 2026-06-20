# Build Notes — for the engineers picking up Epics 3+

This is a working handoff from **Epics 0–2** (Foundation, Identity/auth, and
Lifecycle/Trips/Console) to the people building the feature epics on top.
Read [`prd.md`](prd.md) for *what* and [`build.md`](build.md) for the ticket
list; this note is *how the foundation is wired and how to extend it without
fighting it*. **Epic 2 is mapped in §9; its placeholders & debt in §10.**

---

## 1. What already exists (and what doesn't)

**Done (Epic 0 — T-001…T-006):**

- Next 16 + Payload 3.85 + MongoDB (replica set) running; `/admin`, REST,
  GraphQL, `/healthz`.
- Route groups: `src/app/(payload)` (admin, **admin-only later**) and
  `src/app/(app)` (the participant + organizer frontend).
- Strict layered architecture enforced in CI (`eslint-plugin-boundaries`).
- i18n core (cs default, en): catalogs, translator, locale-aware formatters,
  recipient-language system messages, request-locale resolution + a switcher.
- Design system ported from the prototype: tokens, primitives, status badges,
  Avatar, AppShell, per-trip theming, gallery at `/gallery`.
- Audit log: append-only `AuditEntries` + `recordAudit` service helper.
- Test harness: Vitest unit (no DB) + integration (ephemeral Mongo RS) + a
  Playwright e2e/screenshot smoke. Idempotent `pnpm seed`.

**Done (Epic 1 — T-101…T-106):** see [§8](#8-epic-1-identity-auth--invitations--what-exists-now)
for the full map. In short:

- Core collections: `Identities` (the auth collection — **replaced `Users`**),
  `Trips`, `Memberships`, `Invitations`, `LoginTokens`. Pending memberships
  modeled (no `identity` until first login).
- Real access control (`src/access/`) + admin lockdown — `/admin` is `role:
  admin` only; per-membership scoping on every collection.
- Auth: magic-link (passwordless), OAuth (Google + Microsoft), tokenized invites
  (direct + approval-gated open-join), all provisioning to **one Identity per
  human**.
- Delivery (`src/services/delivery.ts`): localized email **text** + share intents.

**Done since (Epic 2 — T-201…T-203 + a UI overhaul):** lifecycle guards
(`domain/lifecycle`, T-202), the organizer console + all the auth UI screens
(sign-in, approval queue, co-organizer mgmt), trip info content (T-203), the
Czech **IBAN** half of `payments/` (T-503), media uploads, and a photo-forward
dashboard. **See §9 for the full map and §10 for what's placeholder / needs
refactor.**

**Still NOT done yet (your job):**

- Feature collections: polls, expenses, prepayments, rooms/beds, cars, lists,
  reminders.
- The **settlement engine** (`domain/finance`, T-501) — directory still a
  placeholder. (Lifecycle guards `domain/lifecycle` are **done**.)
- **SPAYD QR** generation (`payments/`, T-503 remainder). The account↔IBAN
  conversion + validation (`payments/iban.ts`) **is done and tested**.
- The **organizer assistant** (open-loop dashboard + nudges, Epic 7). Epic 2
  built the *participant-style* dashboard, not the prototype's assistant console.
- **Email HTML templates + a real provider (T-105 remainder).** Epic 1 ships the
  adapter *interface* and the **localized template text** (subjects/bodies, CS+EN,
  recipient-language). What's missing: branded **HTML** bodies (the `EmailMessage.html`
  field is unused) and a real provider — currently a `LoggingEmailAdapter` prints
  the email (incl. magic/invite URLs) to the dev console. Swap via
  `setEmailAdapter(...)`; natural to do alongside reminders (T-702).

The **`archive/`** folder holds the original clickable prototype (feature
screens for dashboard/plan/stay/money/info/organize + the mock `trips.ts` data
model). It is excluded from build/lint/typecheck — use it as **visual + data-shape
reference** when you build the real screens. Design-system files already ported
into `src/` were removed from the archive.

---

## 2. Run & verify

```bash
pnpm install
pnpm mongo:up                 # docker Mongo replica set on :27018
pnpm dev                      # /admin, /healthz, /gallery
pnpm seed                     # admin@chata.test / chata-admin-123
                              #   + demo trip (organizer@chata.test) and a
                              #   pending invite whose URL is printed to stdout

pnpm typecheck                # strict tsc
pnpm lint                     # eslint incl. architecture boundaries
pnpm test                     # unit + integration
pnpm test:e2e                 # Playwright (needs mongo up); writes docs/screenshots
pnpm generate:types           # after ANY collection change → src/payload-types.ts
```

Run scripts that need the Payload Local API with `pnpm payload run <file>` (it
resolves the `@/*` and `@payload-config` aliases and loads `.env`). Examples in
`scripts/verify-*.ts` and `src/scripts/seed.ts`.

---

## 3. The layering rule (do not route around it)

See [`../ARCHITECTURE.md`](../ARCHITECTURE.md) for the table. The short version:

- **`domain/` and `payments/` are pure.** No Payload/Next/Mongo/React imports —
  CI fails on violation. All money/state math lives here and is unit-tested with
  **no database**. This is the whole point: the settlement engine must be
  provably correct in isolation.
- **`services/`** is the bridge: it reads Payload docs → maps to domain inputs →
  calls domain functions → writes Payload docs. Services may import
  `domain/payments/collections/access/i18n/lib`.
- **`collections/`** = schema + access control only. Keep business logic out;
  put it in `services/` (orchestration) or `domain/` (math).
- **`app/`** imports `services` + `components`, never `domain` directly for
  money math.

Adding a layer alias? They're in `tsconfig.json` (`@domain/*`, `@services/*`, …)
and mirrored in `eslint.config.mjs` (`layerElements` + `allowedDeps`). Update
both.

---

## 4. Conventions by layer

### Collections (`src/collections/`)
- One file per collection, registered in `src/payload.config.ts`'s `collections`
  array. **Run `pnpm generate:types` after every change** — never hand-edit
  `src/payload-types.ts`.
- Access control belongs here, but the **reusable predicates live in
  `src/access/`** (T-106, now built): `isPlatformAdmin`, `isMemberOf`,
  `isOrganizerOf`, `isBankerOf`, and the composed per-collection policies
  (`tripsAccess`, `membershipsAccess`, …). New collections should import a policy
  from `@/access` rather than inline `() => true`. See §8 for the model.
- A field with a `defaultValue` **must not** also be `required: true` — Payload
  still types it as required in the generated *create* type, so callers that rely
  on the default fail typecheck. Use the default alone (it's always applied).
- `AuditEntries.trip` is intentionally a **text field** (trip id), not a
  relationship: an audit log must survive referential cleanup, so it stays
  decoupled from `trips`. Don't "fix" it to a relationship.
- Multi-document writes that must be atomic (all finance/deposit flows) must
  share a transaction. Pass `req` through to every `payload.create/update` and
  to `recordAudit` so they commit together (the DB is a replica set for exactly
  this).

### Audit (`src/services/audit.ts`)
- Every sensitive action (finance edits, deposit confirmation, lifecycle
  transitions, account close/reopen) **must** call `recordAudit(payload, {...},
  req)`. Use the `AuditAction` constants; add new keys there.
- Entries are immutable (update/delete throw at the hook level). Don't try to
  "fix" an entry — append a correcting one.

### Domain (`src/domain/`)
- Pure functions + types. No I/O. Co-locate `*.test.ts` (picked up by the unit
  project). The settled threshold (1 Kč), planned-vs-actual separation, and the
  balance formula (PRD §8.5.2) live in `domain/finance` (T-501). Lifecycle
  transition tables live in `domain/lifecycle` (T-202).

### i18n (`src/i18n/`)
- Add UI strings to `messages/cs.ts` (the source of truth) **and**
  `messages/en.ts`. The `Messages` type forces parity — a missing key fails
  typecheck. Adding a locale = add to `config.ts` + a catalog; no other code.
- Server components: `getTranslator(locale)` / `getRequestLocale()`
  (from `@/i18n/server`). Client components: `useI18n()` from `@/i18n/react`
  (the `(app)` layout already wraps everything in `<I18nProvider>`).
- **System messages (emails, reminders, share text) MUST render in the
  recipient's language**, not the sender's — use `renderSystemMessage(
  recipientLocale, …)`. There's a unit test guarding this; keep it green when you
  build reminders (T-702).
- Money/dates: `getFormatters(locale)` (CZK default). Czech banking/QR is
  locale-independent and belongs in `payments/`, not here.

### Design system (`src/components/`)
- Compose from `@/components/ui` (Button, Card, Sheet, List, Field, Input,
  StatusBadge, Hero) + `Avatar`/`AppShell`. See them all at `/gallery`.
- **Status semantics are a shared vocabulary** (`StatusBadge` tones:
  settled/confirmed/owing/overdue/due/provisional/neutral) and are
  colorblind-safe (glyph **and** label, never color alone). Reuse these for both
  finances and rosters — don't invent per-screen colors.
- Per-trip theming: wrap a subtree in `themeVars(theme)` and everything below
  re-skins via CSS vars (`--accent`, `--photo`, …). Layout/spacing/components
  never change between trips — only those knobs.
- Mobile-first, thumb-reachable primary actions. Verified at 380px (see
  `docs/screenshots/`).

### Auth & services (`src/services/`)
- **Auth provisioning is centralized.** `ensureIdentity` / `findIdentityByEmail`
  (`identity.ts`) are the *only* places that create or link an Identity — always
  via the Local API with `overrideAccess: true` (the `identities` collection
  denies public create). One human → one Identity, keyed on the verified email.
- **Tokens are hash-only.** `lib/tokens.ts` mints a raw secret + stores only its
  SHA-256. Magic links (`magic-link.ts`) and invites (`invitations.ts`) verify by
  hashing the presented token; raw tokens live only in delivered URLs and are
  **never recoverable from the DB**. Burn-on-use (`usedAt`/`acceptedAt`) gives
  replay protection.
- **Issuing a login** = `issueAuthToken` (`sessions.ts`) builds a Payload JWT
  cookie (`getFieldsToSign` + `jwtSign`); the route sets it (see `auth/session.ts`).
  Sessions are disabled on `identities`, so the stateless JWT authenticates on its
  own via Payload's built-in `local-jwt` strategy.
- **Every login resolves pending invites** for the verified email
  (`resolvePendingInvitesForEmail`) — call it from any new login path you add.

### Env (`src/lib/env.ts`)
- Add new **required** vars to the `Env` interface + `parseEnv` validation, and to
  `.env.example`. Access via `getEnv()` (lazy/memoized — never a top-level
  `parseEnv()` call, so importing the module in tests doesn't throw).
- **Optional** vars use the `optional("KEY")` helper and stay `undefined` when
  unset. The OAuth credentials (`GOOGLE_/MICROSOFT_CLIENT_ID/SECRET`) are optional:
  a provider only activates when both halves are present.

---

## 5. Testing patterns

- **Unit** (`pnpm test:unit`): pure logic under `domain/payments/i18n/lib`,
  co-located `*.test.ts`. No DB. This is where the settlement engine gets its
  exhaustive coverage (T-501: weighted splits, weight-0 exclusion, planned vs
  actual, refunds, threshold edges, and a balance-conservation property test).
- **Integration** (`pnpm test:int`): boots Payload against an ephemeral Mongo
  replica set (`tests/integration/`). Use `getTestPayload()` + `ensureCollections()`
  + `createTestUser()`. Write access-control and lifecycle-guard tests here.
  - **Testing access control:** call the Local API with `overrideAccess: false`
    and `user: { ...identity, collection: "identities" }` to run a request *as*
    that identity through the real access functions. See
    `identity-access.test.ts` (cross-trip isolation, field-level role guard) and
    `auth-flows.test.ts` (magic-link/invite/open-join/OAuth) for the patterns.
  - `createTestUser()` now creates an **`identities`** doc (the rename); the name
    is kept for continuity.
- **E2e** (`pnpm test:e2e`): Playwright smoke + screenshots; needs `pnpm mongo:up`.
  Note: the OAuth handshake and the `/admin` HTTP block are **not** covered by
  automated tests (they need live provider creds / a running server) — the
  provisioning and access *logic* behind them is integration-tested.

---

## 6. Gotchas that already cost time (so they don't cost you)

- **Mongo dev port is 27018, not 27017** (27017 was taken on this machine). It's
  a single-node **replica set** — required for transactions.
- **`sharp` must be 0.35.x**, even though Payload's blank template pins 0.34.2 —
  3.85's bundled types reference 0.35 APIs. The config asserts
  `sharp as SharpDependency` (overload drift); leave that cast.
- **pnpm build-script approvals** live in `pnpm-workspace.yaml`
  (`allowBuilds:`), not the `pnpm` field in package.json (ignored by pnpm 11.8).
- **Integration tests + a fresh DB**: creating a namespace inside a transaction
  races. The harness warms up each collection with a non-transactional native
  write and bumps `maxTransactionLockRequestTimeoutMillis` to 5000 on the test
  RS. If you add collections, add their slugs to `ensureCollections()`.
- **First Payload write after adding a collection** can hit a transient
  namespace error against an already-running server — restart `pnpm dev` so
  Payload (re)initializes the collection outside a transaction. The **seed** now
  guards against this itself (it warms up namespaces non-transactionally and
  bumps the txn lock timeout on the dev RS, mirroring the test harness); if you
  add collections, add their slugs to that list in `src/scripts/seed.ts` **and**
  to `ensureCollections()`.

---

## 7. Recommended next steps (build order from build.md)

Epics 0, 1, and **2 are done** (see §9 for Epic 2). The next slices:

1. **Epic 3 — Ideation / voting (T-301…T-305).** The first feature epic on top
   of the console: `Poll`/`PollOption`/`Vote` collections (votes public), the
   voting UI, participant-suggested options, the **optimal-date algorithm**
   (`domain/scheduling`, pure/test-first), and close-poll → promote-winner (uses
   the §9 lifecycle service + `transitionArea(..., "datePoll", "closed")`). When
   the date poll closes, write `trip.dates` — the dashboard countdown/stat card
   already reads it.
2. **Finance engine first (T-501).** `domain/finance` settlement engine — pure,
   exhaustively unit-tested, before any finance UI. The **lifecycle ledger
   write-guard already exists** (`assertLedgerWritable`, `domain/lifecycle`) and
   just needs wiring into the finance collections' `beforeChange` hook (T-502).
   `payments/iban.ts` is done; **SPAYD QR is still T-503's remaining half.**
3. Then planning (T-401…T-404), lists (T-601/2), and the **organizer assistant
   (Epic 7)** — the open-loop/nudge console the prototype shows but Epic 2 did
   **not** build (see §10).

Reuse everywhere: the design system, i18n, audit helper, access predicates (§8),
the lifecycle service (§9), and the dashboard stat-card pattern (light up the
"set up later" placeholders as each epic lands).

---

## 8. Epic 1 (identity, auth & invitations) — what exists now

The auth backbone is built and tested; the **UI** for it is not (that's Epic 2).
Drive it via these routes/services until the screens exist.

### Collections (`src/collections/`)
- **`Identities`** — the auth collection (replaced `Users`; `payload.config.ts`
  `admin.user` + `AuditEntries.actor` point here). One per human: verified email,
  `role` (admin/user, admin-only to set), `preferredLanguage`/`preferredChannel`,
  linked OAuth `providers[]`, extra `contactChannels[]`. Sessions disabled (JWT
  cookie only). Password local strategy retained for the platform admin.
- **`Trips`** — name/shortName/theme, `enabledAreas`, `phase` + per-area states
  (`datePollState`/`locationPollState`/`rosterState`/`financeState`), `dates`,
  `banker` group, `deposit` config, `invites` (open-join toggle + token hash).
- **`Memberships`** — Identity↔Trip, `role`, `isBanker`, `confirmed`, `status`
  (pending→active), attendance, refund banking. **Privileged fields (`role`,
  `isBanker`, `confirmed`, `status`) are organizer/admin-only at the field level.**
  A **pending** membership has no `identity` until first login claims it.
- **`Invitations`** — tokenized join (hash stored), `targetType`/`targetValue`,
  `status`, `source` (direct/open-link), `expiresAt`.
- **`LoginTokens`** — single-use magic-link credentials (system-managed; all API
  access denied).

### Access model (`src/access/`)
- `predicates.ts` — boolean checks (`isMemberOf`/`isOrganizerOf`/`isBankerOf`/
  `isPlatformAdminReq`) + `*TripIds(req)` helpers. **The internal membership
  lookup runs with `overrideAccess: true`** — required, or membership read-access
  recurses into itself.
- `collections.ts` — composed per-collection policies + the `/admin` lockdown
  (`identitiesAccess.admin = role === "admin"`).

### Auth routes (`src/app/(app)/`)
| Route | What it does |
|---|---|
| `POST /auth/magic/request` `{email}` | mint + email a magic link (always `{ok:true}`; no enumeration) |
| `GET /auth/magic?token=` | consume → provision/login → set cookie → `/` |
| `GET /auth/invite?token=` | redeem direct invite → activate membership → login |
| `GET /join?token=` | open-join request (needs a session; approval-gated by default) |
| `GET /auth/oauth/{google\|microsoft}` + `/callback` | OAuth start + callback (needs creds) |

Auth state isn't shown in the landing UI yet — verify a session with
`GET /api/identities/me` (the `me` endpoint of the auth collection).

### Services (the API for Epic 2 to call)
- `identity.ts` · `magic-link.ts` · `oauth.ts` · `invitations.ts`
  (`createDirectInvite` / `redeemInvitation` / `enableOpenJoin` / `requestOpenJoin`
  / `listJoinRequests` / `approveJoinRequest`) · `trips.ts` (`createTrip`) ·
  `delivery.ts` · `email.ts` · `sessions.ts` · `urls.ts`.
- Typed failures throw `AuthError` with a `code` (`auth-errors.ts`); routes map
  the code to a redirect query (`?auth=used_token`, …).

### Not done in Epic 1 (carry-over)
- **Email HTML templates + real provider** — see §1. Text templates exist
  (CS+EN, recipient-localized); HTML + provider are deferred. The dev adapter
  logs the full email body so magic/invite URLs are visible during manual testing.
- **All auth UI** (sign-in, approval queue, co-organizer management) → done in
  Epic 2 (§9).
- OAuth `preferredLanguage` is defaulted to `cs`, not read from the provider's
  locale claim (small future enhancement in `loginWithOAuth`).

---

## 9. Epic 2 (lifecycle, trips, console + UI overhaul) — what exists now

The whole organizer/participant frontend is built on the Epic 1 backbone. Sign in
as the organizer (`organizer@chata.test`, magic link printed to `pnpm dev`) — the
platform admin is back-office only and isn't a trip member, so its frontend trip
list is intentionally empty.

### Domain & services (the state/money seam)
- **`domain/lifecycle`** (pure, 24 unit tests) — the T-202 state machine: phase
  transitions (forward-any, one-step-back reversal), per-area graphs (poll
  open→closed, roster open→locked, **finance open→settling→closed, never
  skipping settling**), the cross-area invariant *can't settle a date that isn't
  chosen*, and the ledger write-guard `assertLedgerWritable` (Open-only).
- **`services/lifecycle.ts`** — `transitionPhase` / `transitionArea` enforce the
  guards, write audit entries (dedicated `FinanceAccountsClosed/Reopened` keys),
  and expose `legalPhaseTransitions` / `legalAreaTransitions` for the UI (the app
  layer can't import `domain`, so legal-move listing is surfaced here).
- **`services/trips.ts`** (extended) — `updateTripConfig`, `listMemberTrips`,
  `listMemberships`, `getMembership`, `identityOrganizesTrip`, `setMembershipRole`,
  `setBanker` (moves the `isBanker` flag + stores account/IBAN on `trip.banker`).
- **`services/trip-content.ts`** — `getTripContent` / `upsertTripContent` (one
  `trip-content` row per trip, idempotent).
- **`services/banking.ts`** — thin re-export of the pure `payments/iban.ts`
  (`czAccountToIban`/`ibanToCzAccount`/validators) so server actions can use it.
- **`payments/iban.ts`** (pure, 21 unit tests) — Czech account↔IBAN + mod-11
  account checksum + mod-97 IBAN validation. SPAYD QR is **not** here yet.

### Collections (`src/collections/`)
- **`TripContent`** (slug `trip-content`) — destination (name/location/mapUrl/
  description/basicInfo[]/goodToKnow[]), directions[], parking, publicTransport[],
  notes. Member-read, organizer-write (`tripContentAccess`).
- **`Media`** — image uploads, **`disableLocalStorage:true`**; bytes live in
  **MongoDB/GridFS** via `src/storage/gridfs.ts` + `@payloadcms/plugin-cloud-storage`
  (wired in `payload.config.ts`). Served at `/api/media/file/<name>`. Public read,
  authenticated write. `Trip.theme.coverMedia` references it.

### Frontend (`src/app/(app)/`)
- **Auth UI**: `sign-in/` (magic-link + OAuth), `auth/actions.ts` (`signOutAction`,
  a Server Action — sign-out must not be a `<Link>` or the router cache shows the
  stale authed page), `auth/current-user.ts` (`getCurrentIdentity`/`requireIdentity`),
  and `components/PostLoginRefresh` (see the OAuth note below).
- **Home** (`page.tsx`): guest landing vs membership-scoped trip picker.
- **Console** (`trips/[tripId]/`): `layout.tsx` authorizes membership + themes the
  subtree (cover photo → CSS vars), reusing `AppShell` with `slug="trips/<id>"`.
  `page.tsx` is the **photo dashboard** (Hero/countdown/crowd + `PhaseBar` +
  stat cards). `settings/`, `people/`, `info/` (+ `info/edit/`) are the
  organizer surfaces. `trips/new/` is the create flow.
- **Server actions** (`trips/actions.ts`): create/config (multipart — cover file
  uploaded to GridFS via `handleCover`), lifecycle transitions, banker (auto-IBAN
  + validation), invites/approval/roles/open-join, info save (structured JSON).
  Form result shape in `trips/form-state.ts` (`useActionState`).
- **Components**: `BrandingFields` (cover upload + emoji icon + accent, live
  preview), `RepeatableRows` (structured info editor), `CopyField` (open-join
  link), `InviteForm`, `SignInForm`, and co-located `PhaseBar` (the interactive
  phase stepper + area-lock chips). Client forms that call server actions live
  **under `app/`**, not `components/` (boundary: `components → app` is forbidden).

### Two things to know
- **GridFS storage**: chosen over local disk so uploads survive redeploys / work
  across instances with no extra service. `mongodb` is a direct runtime dep.
  Verify with `pnpm payload run scripts/verify-media.ts`.
- **OAuth cross-site cookie workaround**: the magic-link flow lands authed
  immediately, but the OAuth callback's `SameSite=Lax` cookie isn't sent on the
  *first* `/` request after the cross-site redirect, so the login routes redirect
  to `/?signedin=1` and `PostLoginRefresh` does one `router.refresh()` to pick up
  the cookie. Works, but it's a workaround (see §10).

---

## 10. Placeholders, known gaps & refactor candidates

Honest debt so the next epic doesn't trip on it:

- **Dashboard stat cards are placeholders.** `Beds / Money / Lists / Deposit`
  render muted "set up later" cards, gated by `enabledAreas`. Wire them to real
  data as Epic 4 (sleeping), Epic 5 (finance), Epic 6 (lists) land — the grid
  pattern is in `trips/[tripId]/page.tsx`.
- **No organizer assistant.** The prototype's open-loop + nudge console
  (`archive/prototype/.../organize/page.tsx`) is Epic 7; Epic 2 ships the
  participant-style dashboard instead.
- **Finance not started.** `domain/finance` (T-501) and SPAYD QR (T-503 half) are
  not built. The ledger write-guard exists but **isn't wired** into any
  `beforeChange` hook yet (no finance collections to attach it to — T-502).
- **Email** still the `LoggingEmailAdapter` (carry-over §1/§8).
- **Banker has two account fields — don't conflate.** `trip.banker.{bankAccount,
  iban}` is the banker's *receiving* account (set in Settings). `membership.
  {bankAccount,iban}` is each participant's *refund* account (T-404/T-506,
  unused UI yet). `setBanker` flips `isBanker` in a per-member loop (N updates,
  not a single batch) — fine for typical trips.
- **Deposit config is shallow.** The "deposit" area toggle doubles as
  `deposit.enabled`; gating/basis/cap (T-404) aren't surfaced.
- **Info "getting there" is reference-only.** Directions/parking/public-transport
  are editable; participant **rides (cars/seats)** are T-403, not built.
  `RepeatableRows` has no row reorder / per-field validation, and the 5-column
  public-transport editor wraps tightly on mobile.
- **Images aren't optimized.** Served through the app (no CDN); `Hero`/cover use
  CSS `background-image` (not `next/image`); `imageSizes` are generated but a tiny
  source may skip them. `Trip.theme.coverImage` (text URL) is kept as a redundant
  fallback beside `coverMedia`.
- **Hero countdown wart**: with no `trip.dates`, the chip shows `0` + "Not set
  yet". Cosmetic; will be moot once the date poll writes `trip.dates` (Epic 3).
- **Perf not tuned.** The console layout *and* the dashboard each refetch the
  trip + memberships + `listMemberTrips` per request (N queries, no caching). PRD
  §10 wants efficiency at 100+ trips — revisit with caching/`use cache` later.
- **Admin-on-frontend edge.** Per the agreed decision the frontend is
  membership-scoped (admins use their organizer login). The trip `layout` still
  admits `role:admin` to *view* any trip, but People/Settings gate on
  `identityOrganizesTrip` (admin isn't auto-organizer) — a mild inconsistency if
  an admin opens a trip they don't organize.
- **Validation messages** are returned as codes and localized client-side (the
  server actions don't localize). Fine, just not symmetric with email i18n.
- **No UI tests in CI.** Domain/services/integration are covered; the form/
  picker/dashboard flows are validated by **manual Playwright** only — consider
  promoting those into `tests/` specs.
- **Multi-domain routing** (custom per-trip domains, PRD §8.1) is not done;
  routing is by trip id (`/trips/<id>`).

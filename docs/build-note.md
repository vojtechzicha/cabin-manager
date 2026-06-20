# Build Notes — for the engineers picking up Epics 2+

This is a working handoff from **Epic 0 (Foundation)** and **Epic 1 (Identity,
accounts & authentication)** to the people building everything on top of them.
Read [`prd.md`](prd.md) for *what* and [`build.md`](build.md) for the ticket
list; this note is *how the foundation is wired and how to extend it without
fighting it*.

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

**Deliberately NOT done yet (your job):**

- Feature collections: polls, expenses, prepayments, rooms/beds, cars, lists,
  reminders.
- The settlement engine (`domain/finance`, T-501) and lifecycle guards
  (`domain/lifecycle`, T-202) — directories exist with placeholder `index.ts`.
- SPAYD QR + IBAN (`payments/`, T-503) — placeholder only.
- **Email HTML templates + a real provider (T-105 remainder).** Epic 1 ships the
  adapter *interface* and the **localized template text** (subjects/bodies, CS+EN,
  recipient-language). What's missing: branded **HTML** bodies (the `EmailMessage.html`
  field is unused) and a real provider — currently a `LoggingEmailAdapter` prints
  the email (incl. magic/invite URLs) to the dev console. Swap via
  `setEmailAdapter(...)`; natural to do alongside reminders (T-702).
- **Auth UI screens.** The auth *backend* + routes exist, but there is no sign-in
  page, no organizer "approval queue" view, no co-organizer management UI — those
  belong to the organizer console (T-201, Epic 2). Today you drive auth via the
  routes/services directly (see §8).

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

Epic 1 is done. The next slice is **Epic 2 (lifecycle & trips)** and the
**finance engine**, both of which everything money/state depends on:

1. **T-201** trip creation & organizer console shell — the first real frontend.
   Reuse `createTrip` (`services/trips.ts`) and the auth/membership model; build
   the sign-in screen + approval-queue UI that Epic 1 deliberately left out.
2. **T-202** lifecycle guards (`domain/lifecycle`) — pure transition tables for
   trip phase + per-area states; the `Trip` already persists those state fields.
3. **T-501** settlement engine (`domain/finance`) and **T-503** SPAYD/IBAN
   (`payments/`) — pure, test-first, before any finance UI.
4. Then the feature epics (voting, planning, lists, assistant), reusing the
   design system, i18n, audit helper, and the access predicates from §8.

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
- **All auth UI** (sign-in, approval queue, co-organizer management) → T-201.
- OAuth `preferredLanguage` is defaulted to `cs`, not read from the provider's
  locale claim (small future enhancement in `loginWithOAuth`).

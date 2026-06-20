# Build Notes — for the engineers picking up Epics 1+

This is a working handoff from **Epic 0 (Foundation & architecture)** to the
people building everything on top of it. Read [`prd.md`](prd.md) for *what* and
[`build.md`](build.md) for the ticket list; this note is *how the foundation is
wired and how to extend it without fighting it*.

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

**Deliberately NOT done yet (your job):**

- Real domain collections: `Identity/Trip/Membership/Invitation` (T-101),
  polls, expenses, prepayments, rooms/beds, cars, lists, reminders.
- The settlement engine (`domain/finance`, T-501) and lifecycle guards
  (`domain/lifecycle`, T-202) — directories exist with placeholder `index.ts`.
- SPAYD QR + IBAN (`payments/`, T-503) — placeholder only.
- Real access control / admin lockdown (T-106) — current access is permissive
  placeholder; **tighten before shipping anything with real data**.
- Email delivery (T-105) — Payload logs a "no email adapter" warning; that's
  expected until then.

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
- Access control belongs here, but build the **reusable predicates in
  `src/access/`** (T-106: `isMember`, `isOrganizer`, `isBanker`,
  `isPlatformAdmin`, `isSelf`) and reference them. The current `Users`/
  `HealthChecks`/`AuditEntries` access is placeholder.
- For the `trip` link on `AuditEntries` we used a **text field** (trip id) so the
  log is queryable today; convert it to a `relationship` once `Trip` exists
  (T-101) — search for the `TODO(T-101)` note.
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

### Env (`src/lib/env.ts`)
- Add new required vars to the `Env` interface + `parseEnv` validation, and to
  `.env.example`. Access via `getEnv()` (lazy/memoized — never a top-level
  `parseEnv()` call, so importing the module in tests doesn't throw).

---

## 5. Testing patterns

- **Unit** (`pnpm test:unit`): pure logic under `domain/payments/i18n/lib`,
  co-located `*.test.ts`. No DB. This is where the settlement engine gets its
  exhaustive coverage (T-501: weighted splits, weight-0 exclusion, planned vs
  actual, refunds, threshold edges, and a balance-conservation property test).
- **Integration** (`pnpm test:int`): boots Payload against an ephemeral Mongo
  replica set (`tests/integration/`). Use `getTestPayload()` + `ensureCollections()`
  + `createTestUser()`. Write access-control and lifecycle-guard tests here.
- **E2e** (`pnpm test:e2e`): Playwright smoke + screenshots; needs `pnpm mongo:up`.

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
  Payload (re)initializes the collection outside a transaction.

---

## 7. Recommended next steps (build order from build.md)

1. **T-101** core collections (`Identity/Trip/Membership/Invitation`) + baseline
   access — then convert `AuditEntries.trip` to a relationship and extend the
   seed into a real demo trip.
2. **T-106** access predicates in `src/access/` + admin lockdown — do this early;
   everything else relies on it.
3. **T-202** lifecycle guards (`domain/lifecycle`) and **T-501** settlement
   engine (`domain/finance`) — pure, test-first, before any finance UI.
4. Then the feature epics, reusing the design system, i18n, and audit helper.

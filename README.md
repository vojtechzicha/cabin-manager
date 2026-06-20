# Chata — zicha.travel

Run the whole life of a group trip — **ideation → planning → finances** — as one
collaborative, mobile-first, multilingual app. See [`docs/prd.md`](docs/prd.md)
for the product spec and [`docs/build.md`](docs/build.md) for the engineering
tickets.

This repository currently implements **Epics 0–2** — Foundation, Identity &
auth, and Lifecycle / Trips / Organizer console (see
[`docs/build-note.md`](docs/build-note.md) §9–§10 for the Epic 2 map, placeholders,
and tech-debt).

## Stack

- **Next.js 16** (App Router, Turbopack, React 19 + React Compiler)
- **Payload CMS 3.85** embedded in the app (`/admin`, REST + GraphQL)
- **MongoDB** via `@payloadcms/db-mongodb`, run as a **replica set** (transactions
  are required for finance integrity)
- **TypeScript** strict + `noUncheckedIndexedAccess`
- **Tailwind v4** design system (glass-morphism, per-trip theming)
- **Vitest** (unit + integration) · **eslint-plugin-boundaries** (architecture)

Architecture and layer rules: [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Getting started

```bash
pnpm install
cp .env.example .env            # then set PAYLOAD_SECRET (openssl rand -base64 32)
pnpm mongo:up                   # docker: single-node Mongo replica set on :27018
pnpm dev                        # http://localhost:3000  ·  admin at /admin
pnpm seed                       # admin@chata.test / chata-admin-123 + sample data
```

Health check: `GET /healthz` reports DB connectivity and transaction support.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` / `pnpm build` | Next dev / production build |
| `pnpm mongo:up` / `pnpm mongo:down` | Start/stop the local Mongo replica set |
| `pnpm typecheck` | `tsc --noEmit` (strict) |
| `pnpm lint` | ESLint incl. architecture boundaries |
| `pnpm test` | Unit (no DB) + integration (ephemeral Mongo RS) |
| `pnpm test:e2e` | Playwright smoke + screenshots (needs `pnpm mongo:up`) |
| `pnpm generate:types` | Regenerate `src/payload-types.ts` |
| `pnpm seed` | Idempotent dev seed |

## Layout

```
src/
  domain/      pure money/state math (settlement, scheduling, lifecycle)
  payments/    pure SPAYD QR + CZ account↔IBAN
  i18n/        locales, catalogs (cs/en), formatters, recipient-language messages
  collections/ Payload schema + access control
  access/      reusable access predicates
  services/    use-case layer (e.g. audit log)
  components/   React design system
  app/(payload) admin · app/(app) frontend
  lib/         universal leaf utilities (env, …)
archive/       frozen prototype — design + screen reference for later epics
```

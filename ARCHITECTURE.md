# Architecture

zicha.travel (codename **Chata**) is a single Next.js 16 app with Payload CMS 3
embedded. Its value is **correctness of money and state**, so the codebase is
organized into strict layers and the boundaries between them are enforced in CI
(`eslint-plugin-boundaries`) — a violating import fails the build.

## Layers

```
src/
  domain/            PURE TypeScript. No Payload, Next, Mongo, or React.
    finance/           settlement engine (PRD §8.5 math)
    scheduling/        optimal-date algorithm (PRD §8.2.1)
    lifecycle/         state-machine guards (PRD §7)
  payments/          SPAYD QR + CZ account↔IBAN. Pure, framework-free.
  i18n/              locale config, message catalogs, formatters
  collections/       Payload collections = data schema + access control
  access/            reusable access predicates (per-membership / role)
  services/          use-case layer; orchestrates domain + Payload local API
  components/         React design system (built from the HTML mockups)
  app/
    (payload)/       Payload admin + REST/GraphQL — ADMIN ONLY
    (app)/           frontend: organizer console + participant app
  lib/               universal leaf utilities (env, small helpers)
  payload.config.ts  wires collections + db + adapters together
```

## The one rule that matters most

**Money and state math lives only in `domain/`** (and the pure `payments/`
module). These layers are plain TypeScript with **zero** framework imports, so
the settlement engine, scheduling algorithm, and lifecycle guards can be
unit-tested in isolation with no database. Services map Payload documents →
domain inputs → domain outputs → Payload writes; they never re-implement the
math.

## Allowed dependencies

| From          | May import                                                        |
| ------------- | ----------------------------------------------------------------- |
| `domain`      | *(nothing — pure)*                                                 |
| `payments`    | *(nothing — pure)*                                                 |
| `lib`         | *(nothing — universal leaf)*                                       |
| `i18n`        | `lib`                                                             |
| `access`      | `collections`, `i18n`, `lib`                                       |
| `collections` | `access`, `i18n`, `lib`                                            |
| `services`    | `domain`, `payments`, `collections`, `access`, `i18n`, `lib`       |
| `components`  | `i18n`, `lib`                                                      |
| `app`         | `services`, `components`, `collections`, `config`, `access`, `i18n`, `lib` |

Additionally, **`domain` and `payments` may not import** `payload`,
`@payloadcms/*`, `next`, `react`, `react-dom`, `mongoose`, or `mongodb`
(`boundaries/external`).

## Other invariants

- **Authorization is server-side only**, expressed as Payload `access` functions
  keyed on the requesting user's Membership/role. The client is never trusted.
- **There is no organizer admin panel.** The `(payload)` route group (`/admin`)
  is reachable only by platform admins (`role: admin`).
- **Lifecycle locking is enforced server-side** — a Closed ledger rejects writes,
  not merely hides the button.
- **Generated types** (`src/payload-types.ts`) come from `pnpm generate:types`;
  never hand-maintain duplicate types.

## Verifying boundaries locally

```bash
pnpm lint        # includes boundaries rules; an illegal import errors here
pnpm typecheck   # strict TS, noUncheckedIndexedAccess
pnpm test        # unit (domain/payments, no DB) + integration (ephemeral Mongo RS)
```

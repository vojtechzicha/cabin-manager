# zicha.travel — Product Requirements Document

**Type:** Full specification for a green-field rebuild (no existing code reused)
**Audience:** Claude Design (UX/UI) and Claude Code (implementation)
**Author:** Vojtěch Zicha

**Domain language.** A _Trip_ (internally still a **Chata** — Czech for a cottage/cabin getaway) is one group stay. The **Organizer** creates and runs it. **Participants** are the invited people. The **Banker** is the participant who holds the shared money.

> This document specifies the product from zero. Where it describes behavior that exists in the current zicha.travel (expense settlement, Czech QR payments, bedroom/car organization, trip info), it is restating it as a requirement to be re-implemented, not assuming any code is carried over.

---

## 1. Vision

zicha.travel runs the entire life of a group trip — from "should we even go, and when?" through "who sleeps where and who's driving" to "who owes whom" — as one collaborative app. Every participant is an authenticated contributor who fills in their own information; the organizer curates, confirms, and closes. It is mobile-first, multilingual, and built around Czech-friendly settlement (bank QR codes), while remaining usable internationally.

The product replaces three things people currently cobble together from a chat group, a Doodle poll, and a spreadsheet: **scheduling**, **logistics**, and **shared finances**.

---

## 2. Goals & non-goals

### Goals

1. Take a trip through its full lifecycle: **Ideation → Planning → Finances**, with explicit close/lock points so nothing drifts forever.
2. Make every participant a first-class contributor (votes, attendance, sleeping, transport, expenses, lists).
3. Keep the organizer in control through curation, confirmation, and an assistant that nudges people to do their part.
4. Settle shared money fairly and transparently, with one-tap Czech bank payments.
5. Be genuinely multilingual from day one.
6. Low-friction entry: log in with Google/Microsoft or a magic link, and receive invites over whatever channel suits (email, WhatsApp, Telegram, copy link).

### Non-goals

- Public trip discovery / marketplace. Trips are invite-only.
- In-app real-money processing. Settlement is QR + manual bank transfer.
- Native mobile apps. Responsive PWA only.
- Automatic translation of user-generated content (future idea).

---

## 3. Personas & roles

| Role               | Can do                                                                                                                                                                                          | Surface           |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| **Organizer**      | Everything for their trip: create/configure, invite, curate vote options, run phases, confirm participant input, manage finances as banker (or assign a banker), run the assistant, close/lock. | Frontend app      |
| **Co-organizer**   | Same as organizer; multiple allowed.                                                                                                                                                            | Frontend app      |
| **Participant**    | Vote, suggest options, confirm attendance, pay deposit, claim bed, offer/join rides, add expenses, edit their own share, manage lists, set their preferences.                                   | Frontend app      |
| **Banker**         | A participant designation: receives money, confirms received payments and deposits, runs settlement. Usually the organizer but can be anyone.                                                   | Frontend app      |
| **Platform admin** | Operates the platform (manage accounts, troubleshoot, global assets). **The only role with access to any back-office/admin surface.**                                                           | Admin back-office |

**Hard boundary:** organizers and participants do _everything_ in the normal app. There is no organizer "admin panel." Any back-office surface is reachable only by the platform admin.

---

## 4. Identity, accounts & authentication

A clean unified model (chosen as "the best" design):

- **Identity (Account)** — one per human. Carries a verified primary email, optional linked auth providers (Google, Microsoft), optional contact channels (additional email, phone for WhatsApp, Telegram), display name/avatar, and **preferred language** + **preferred contact channel**.
- **Membership** — links one Identity to one Trip, with a role (organizer / co-organizer / participant), the banker flag, and all trip-specific data (banking details, attendance, sleeping, rides, balances). A person who joins five trips has one Identity and five Memberships.
- **Pending membership** — an invite created before the person has an account, keyed by email/phone/handle. It resolves to an Identity on first login and inherits any data the organizer pre-filled.

### Authentication methods

- **OAuth:** Google, Microsoft.
- **Magic link (passwordless):** a one-time tokenized URL. The token _is_ the auth; the channel is only transport.

There is no password-based login for participants. The platform admin may have a separate secured login.

### Invite & magic-link delivery

The app mints a tokenized URL; delivering it is **free and channel-agnostic** — no messaging Business APIs required:

- **Transactional email** — system-sent (primary default channel).
- **Share intents** — when email isn't the right channel, present share buttons: WhatsApp (`https://wa.me/?text=…`), Telegram (`https://t.me/share/url?url=…&text=…`), copy link, native share sheet. These open the sender's own app with the invite text pre-filled; the human taps send. No API, no per-message cost.

The system always sends a transactional email when an address is known, and additionally offers share intents so the organizer can reach people who don't do email.

---

## 5. Invitations & access

- **Direct invitation:** organizer adds a person (email / phone / Telegram handle / or just a name) → tokenized join link, delivered by email and/or shared. First open creates or links the Identity and activates the membership.
- **Open join link:** organizer can enable a per-trip shareable link. Anyone opening it can **request to join**; **organizer approval is required by default** (toggle to auto-accept). Disabled by default.
- **Authorization:** a person sees only trips they're a member of, and within a trip only what their role allows. Votes are visible to the whole trip (see §8.2); finances and personal data follow least-privilege.

---

## 6. Internationalization (first-class requirement)

Multilingual is a core requirement, not a late add-on.

- **Full UI localization.** All app chrome is translatable. Ship **Czech and English** at launch; the architecture must make adding locales a content task, not a code change.
- **Per-user language.** Detected from the browser, overridable in profile, persisted on the Identity.
- **Localized system messages.** Every email, reminder, nudge, and pre-filled share text is rendered in the _recipient's_ language.
- **Locale-aware formatting.** Dates, times, numbers, and currency formatted per locale.
- **Czech-specific settlement is locale-independent.** Bank account / IBAN handling and QR payment codes (Czech SPAYD/“QR Platba”) work regardless of UI language; CZK is the default trip currency. (Multi-currency trips are a future idea — see §16.)
- **User-generated content** (trip names, notes, expense titles) is stored as authored; no auto-translation at launch.

---

## 7. Trip lifecycle & state model

A trip moves through phases, but **phases overlap freely except where overlap breaks logic** (e.g. you can't settle finances for a date that hasn't been chosen). Each functional area also has its own **open → locked** state so things stop changing when they should.

```
        ┌── Ideation ──┐
Draft ──┤              ├── Planning ──── Finances ──── Archived
        └─ (date/loc) ─┘   (overlaps)     (overlaps)
```

- **Draft** — organizer setting up; invisible to participants.
- **Ideation** — voting on date and location open.
- **Planning** — date/location decided; attendance, deposit, sleeping, transport, lists active.
- **Finances** — expenses and settlement active (may begin during Planning, e.g. deposits).
- **Archived** — read-only history.

**Area-level locking (important).** Because participant-suggested expenses are **auto-added** (§8.5), finances would otherwise change forever. So each area can be explicitly **closed/locked** by the organizer:

- **Date poll / Location poll:** Open → Closed (winner promoted to the trip).
- **Attendance & rosters:** Open → Locked (final headcount).
- **Finances / “Accounts”:** Open → **Settling** → **Closed**. While Open, expenses can be added/edited; in Settling, balances are final and people pay up; once **Closed**, the ledger is read-only and immutable. Re-opening is an explicit, logged organizer action.

Organizer-driven transitions are explicit and reversible (reversal is logged), except a Closed ledger which requires a deliberate re-open.

---

## 8. Functional requirements

### 8.1 Trip creation & configuration (Organizer)

- Create a trip with: name, short name (used in payment messages), location label, description, theme color, icon, cover/background image.
- Optional custom domain(s) that load this trip directly (multi-domain routing).
- Configure which areas are enabled (voting, sleeping, transport, lists, finances, deposit).
- Configure invite settings (channels, open-join toggle + approval requirement).
- Assign banker (defaults to organizer) and the banker's bank account (Czech account number and/or IBAN).

**Stories:** As an organizer I spin up a trip, set the vibe (name/photo/color), choose what the group will collaborate on, and invite people.

### 8.2 Ideation — voting

Two polls per trip: **date/time** and **location**. Both share mechanics; **all votes are public to the trip** (everyone sees who voted what), which keeps the group honest and social.

**Options**

- Organizer seeds options; **participants may suggest** additional options.
- Suggested options are flagged as participant-suggested; organizer can merge/hide/promote.

**Voting methods (organizer picks per poll — both are supported):**

- **Approval voting:** each participant marks every option _Yes / If-needed / No_. Good for "which of these dates works for the most people."
- **Availability grid / ranked or single-choice:** a Doodle-style grid across candidate dates, or a simple single-pick for location. Organizer chooses the style that fits.

**Live tally** visible to all, updating as people vote.

**Closing** is an explicit organizer action that locks the poll and **promotes the winner** onto the trip (chosen date range → trip dates; chosen location → destination details).

#### 8.2.1 Automated optimal-date suggestion

Given availability input and a desired trip length, the system recommends the best date window(s) to the organizer:

- **Inputs:** per-participant availability (Yes/If-needed/No or grid), desired contiguous length (N nights; can be flexible), and optional VIP weighting (e.g. the banker or people with cars count more — organizer toggle).
- **Scoring:** for each candidate window, score = Σ over participants of availability weight (Yes = 1.0, If-needed = 0.5, No = 0 or hard-exclude). Tie-breakers: more full-Yes, fewer If-needed, earlier date, weekend coverage.
- **Output:** ranked top suggestions with an attendance preview and an explicit "can't make it" list per option. The organizer still decides and closes; the suggestion never auto-commits.

**Stories:** As a participant I mark when I can come and propose a weekend nobody listed. As an organizer I see "the system says the 12th–14th gets 9 of 11, missing Petr and Jana," and I lock it.

### 8.3 Planning — attendance, deposit, sleeping, transport

#### 8.3.1 Attendance confirmation

- Each participant sets status: **Coming / Not coming / Maybe**.
- Optional **duration**: which nights, or arrival/departure, they'll be present (per-night granularity).
- Optional companions and **pets** (affects rooming).
- Organizer sees a live roster and can lock the final headcount.

#### 8.3.2 Deposit-to-confirm (gated, based on planned cost)

Confirmation is backed by money: **paying the deposit is what secures a spot.** Deposits are **always gated** when enabled — provisional until paid.

- The organizer enters **planned (upfront) costs** during Planning — typically the accommodation booking (see §8.5; these are expenses in a _planned_ state).
- The system computes each participant's deposit as **their projected share of the planned cost** (the default and required basis). The organizer may cap or round it, but the basis is planned-cost share.
- A participant pays the banker via the trip's **QR/IBAN** flow.
- **Verification is banker-confirms-only:** the deposit counts only when the banker marks it received. No participant self-declared "I paid" state. On confirmation, the participant becomes a **Confirmed participant**; until then they're provisional.
- Deposit status is visible to each participant (Due → Confirmed) with the QR code to pay.
- Drop-outs are refunded through the normal refund/distribution flow (§8.5).

**Stories:** As a participant I see "Deposit 1 500 Kč to confirm your spot," scan the QR, pay, and once the banker confirms I'm locked in. As an organizer I watch deposits land and the confirmed roster fill.

#### 8.3.3 Sleeping (where they'll sleep)

- Organizer defines accommodation **rooms**, each with **beds** (named: double bed, top bunk, etc.) and a max sleeping capacity; rooms can have photos/descriptions.
- **Participants claim a bed** (optionally for a specific night-range) from what's available; conflicts are prevented or surfaced for the organizer to resolve.
- Organizer can override/assign and confirm the final sleeping map.
- Pet-friendly room handling where relevant.

#### 8.3.4 Transport (how they'll get there)

Two layers, both reused by lists/equipment:

- **Reference info (organizer-provided):** driving directions per origin (from, duration, distance, route notes), parking info, and public-transport options (e.g. train/bus connections with line number, from/to, departure/arrival times).
- **Participant self-service rides:** each participant declares a plan —
  - **Driving:** creates a shared car offering seats (with driver, optional front passenger, remaining seats, and an **equipment/cargo** list — e.g. who's bringing the beer crate).
  - **Riding:** joins an existing car (claims a seat).
  - **Own transport:** e.g. taking the train; links to the public-transport reference.
- Organizer sees a car manifest (who drives, who rides, who has no ride yet) and can rearrange/confirm.

**Stories:** As a participant I offer two seats from Prague and note I'll bring the grill. As another I grab a seat in that car. As an organizer I spot that three confirmed people still have no ride and nudge the drivers (§8.6).

### 8.4 Logistics — packing & shopping lists

Two collaborative list types per trip (each toggleable).

**Shopping list (group provisioning)**

- Shared list of things to acquire for the group (food, drinks, supplies).
- Each item: name, quantity + unit, category, optional estimated cost, **assignee** (who'll buy it), status **Needed → Claimed → Bought**.
- Anyone can add/claim items; organizer can curate.
- **One-tap "Bought → Expense":** marking an item bought offers to create an expense (payer = buyer, amount, split = everyone or chosen subset), flowing straight into finances (§8.5).
- Optional starter templates by trip type.

**Packing list**

- **Shared gear** mode: coordinate who brings shared items (speaker, board games, first-aid, projector). Item + claimed-by. Claimed gear can be **linked to a car's equipment** for transport (ties into §8.3.4).
- **Personal checklist** mode: each participant's private packing checklist, optionally seeded from an organizer/template list. Private to the participant.

**Stories:** As a participant I add "20 rohlíků" to the shopping list and claim the first-aid kit on the packing list; when I buy the rohlíky I tap once and it becomes a shared expense.

### 8.5 Finances — expenses & settlement (full engine, specified from scratch)

The heart of the app. This section fully specifies the settlement model so it can be built without reference to prior code.

#### 8.5.1 Concepts

- **Banker** holds the shared money. All settlement is expressed relative to the banker.
- **Expense:** something paid for the group. Fields: title, amount (negative allowed for corrections/refunds), **payer** (a participant), **split type**, optional split detail, note, timestamp, **state** (planned vs actual), and **suggestedBy**.
  - **Equal split:** cost divided equally among all participants.
  - **Weighted split:** cost divided by per-participant weights (e.g. 1, 0.5 for a child, 2 for someone taking a double portion). A participant with weight 0 (or absent) is not part of that expense.
- **Prepayment:** money moved between a participant and the banker, of four types:
  - **Advance (záloha):** participant pays money in up front (also how deposits are recorded).
  - **Supplement (doplatek):** participant tops up later.
  - **Refund:** banker returns money to a participant (negative direction).
  - **Distribution:** banker disburses pooled money back out (negative direction).

#### 8.5.2 Balance computation

For each participant, compute:

- `paidExternal` — sum of actual expenses they paid on behalf of the group.
- `plannedPaidExternal` — same, for **planned** (not-yet-real) expenses.
- `prepaidInternal` — net money moved to the banker (advances + supplements − refunds − distributions).
- `cost` — their share of **actual** expenses (per equal/weighted split).
- `plannedCost` — their share of **planned** expenses (this is the basis for deposits, §8.3.2).

**Balance** = `paidExternal + plannedPaidExternal + prepaidInternal − cost − plannedCost`.

- **Settlement threshold:** treat anyone within **1 Kč** of zero as settled (avoids showing meaningless rounding). Balance < −1 → **debtor** (owes), > +1 → **creditor** (is owed).
- Produce a ranked list of debtors and creditors and the **minimal set of transfers** to settle (each debtor pays the banker / banker pays each creditor). The banker is the hub; participants don't pay each other directly.

#### 8.5.3 Participative behavior & lifecycle

- **Participants suggest expenses, which are auto-added** to the ledger (no approval gate) — _while the ledger is Open_. Each is attributed (`suggestedBy`) and editable/removable by the organizer.
- Participants can **see exactly what they're part of** (their personal share per expense) and **opt in/out of an expense** or adjust their own weight, so fair shares stay correct without the organizer maintaining everyone's weights by hand.
- **Closing accounts (required lifecycle):** because suggestions auto-add, the organizer must be able to move finances **Open → Settling → Closed**. In Settling, balances are frozen and people pay up; once **Closed**, the ledger is immutable and read-only. This resolves the "it would change forever" problem. Re-opening is explicit and logged.
- **Planned expenses** (e.g. the accommodation booking) feed deposits and projected balances but are clearly separated from actuals; converting planned → actual is an organizer action when the money really moves.

#### 8.5.4 Czech payments (QR)

- Generate a **Czech bank QR payment code (SPAYD / “QR Platba”)** for each amount owed to the banker, encoding the banker's IBAN, amount, currency (CZK), and a message (trip short name + purpose).
- Accept and convert between **Czech account-number format** (e.g. `123456789/0100`) and **IBAN**, in both directions, so the organizer/participants can enter either.
- Creditors needing repayment provide their own account/IBAN for refunds.

**Stories:** As a participant I add the firewood I bought, the group's split updates, and I see my balance go from −400 to +100; I scan one QR to settle with the banker. As an organizer I close accounts two weeks after the trip so the numbers stop moving.

### 8.6 Organizer assistant — nudges, reminders & suggestions

A built-in assistant that helps the organizer herd the group. This is a headline feature, not a footnote.

**Open-loop dashboard.** The organizer sees who still hasn't done their part, grouped by area:

- Hasn't voted on date/location.
- Hasn't confirmed attendance.
- Confirmed but **hasn't paid the deposit**.
- Confirmed but **has no ride** (and the inverse: seats still free in offered cars).
- Hasn't claimed a bed.
- Owes money at settlement time / hasn't paid their balance.
- Claimed a shopping item but hasn't marked it bought.

**Reminders.**

- **One-tap nudge** per loop or per person: sends a localized, templated message via the recipient's preferred channel (transactional email by default, with share-intent fallback if email isn't ideal for them).
- **Broadcast announcements** to the whole trip.
- **Suggested/automated reminders** (organizer opt-in, schedulable): e.g. "deposit due in 3 days," "T-7: offer or claim a ride," "post-trip: settle up," and a self-directed nudge to the organizer: "accounts have been open 14 days — consider closing."
- Examples explicitly requested: _remind everyone to offer/claim a car_, _remind everyone to pay (deposit and final balance)_.

**Tone & frequency guards.** Reminders are rate-limited and respect a participant's "I've done it" state so nobody gets pestered after acting.

**Stories:** As an organizer I tap "Remind drivers to confirm seats" and the three people who offered cars get a message in their language; a day before the deadline, the four who haven't paid deposits get an automatic reminder.

### 8.7 Trip info & content

Reference content the organizer maintains and everyone reads:

- **Destination:** name, specific location, description, useful links, photos, basic-info bullets.
- **Directions & transport reference** (as in §8.3.4).
- **House/trip notes.**
  All localized in chrome; content shown as authored.

---

## 9. Data model (entities)

Indicative, not prescriptive about storage.

- **Identity** — primary email, linked auth providers, contact channels (email/phone/Telegram), display name, avatar, preferred language, preferred channel.
- **Trip (Chata)** — name, short name, location, description, theme/icon/background, domains, enabled-area flags, lifecycle state + per-area states, invite settings (channels, open-join, approval), banker reference + banker bank account/IBAN, deposit config (enabled, basis = planned-cost share, gating on), trip dates, destination block, directions block.
- **Membership (Participant)** — Identity ref, Trip ref, role, isBanker, confirmed flag, attendance (status, night-range, companions, pet), bank account/IBAN (for refunds), preferred channel override.
- **Invitation** — Trip, target (email/phone/handle/name), token, status (pending/accepted/expired), source (direct/open-link).
- **Poll** — Trip, type (date/location), method (approval/grid/single), state (open/closed), winning option.
- **PollOption** — Poll, value (date-range or location detail), suggestedBy.
- **Vote** — PollOption, Membership, value (yes/if-needed/no or grid cell). Public to the trip.
- **Room** / **Bed** / **BedClaim** — accommodation inventory + per-night claims by Membership.
- **Car** — Trip, driver (Membership), front passenger, seats, equipment items; **SeatClaim** — Car, Membership.
- **Expense** — Trip, title, amount, payer (Membership), splitType (equal/weighted), weights[], state (planned/actual), suggestedBy, note, timestamp.
- **Prepayment** — Trip, Membership (from), amount, type (advance/supplement/refund/distribution), note, timestamp.
- **ShoppingItem** — Trip, name, qty/unit, category, estCost, assignee, status, linkedExpense.
- **PackingItem** — Trip, scope (shared/personal), name, claimedBy/owner, linkedCarEquipment.
- **Reminder/Nudge** — Trip, target(s), area, template, channel, schedule, sent state.
- **AuditEntry** — actor, action, target, timestamp (finances, deposits, phase changes, lock/unlock).

---

## 10. Non-functional requirements

- **Mobile-first PWA.** Every flow works one-handed on a phone; installable; offline-tolerant reads where reasonable.
- **Multilingual** as specified in §6.
- **Authorization & privacy.** Least-privilege per membership/role. Votes public within a trip; finances and personal data restricted appropriately. No unauthenticated access to trip data.
- **Real-time-ish collaboration.** Votes, tallies, lists, rosters, and balances update promptly for everyone (live or near-live).
- **Auditability.** Finance, deposit, and lifecycle actions are logged (who/what/when), especially around closing accounts.
- **Performance.** Balance/stat computation stays efficient for typical (10–30 people) and large (100+) trips; avoid per-row expensive recomputation in list views.
- **Reliability of money math.** Settlement is deterministic and rounding-safe (1 Kč threshold); never silently lose or invent money.
- **Accessibility.** Reasonable contrast, keyboard/screen-reader support for core flows.

---

## 11. Notifications & communication

- **Transactional email** is the default system channel (invites, magic links, deposit/payment reminders, phase changes, announcements), localized per recipient.
- **Share intents** (WhatsApp/Telegram/copy/native) available wherever a link or reminder can be sent, for people who don't use email.
- **In-app notifications** for everything, so the app works even with no external channel.
- Per-user channel preference; reminders respect "already done" state and are rate-limited.

---

## 12. Design direction (for Claude Design)

- Preserve the current **glass-morphism, photo-forward, warm** aesthetic as the starting point but treat this as a fresh design — pick the best.
- Per-trip theming (color/photo/icon) should visibly brand each trip.
- Mobile-first layouts; thumb-reachable primary actions (vote, pay, claim, confirm).
- Clear **status semantics** with color (e.g. settled/positive vs owing/negative; confirmed vs provisional) — consistent across finances and rosters.
- The **organizer assistant** deserves a strong dashboard pattern (open loops → one-tap nudge).
- Design the **lifecycle/locking** affordances so "this is closed/final" is unmistakable.

## 13. Architecture guidance (for Claude Code — recommended, not mandated)

Green-field; choose the best stack. Sensible guardrails:

- Multi-tenant by trip; strong per-membership access control enforced server-side.
- First-class i18n framework with externalized strings and locale-aware formatting.
- OAuth (Google/Microsoft) + passwordless magic-link auth; tokenized invite URLs.
- A transactional email provider; share-intent links need no third-party API.
- Czech QR (SPAYD) generation and account↔IBAN conversion as a small dedicated module.
- A pure, well-tested **settlement engine** (the §8.5 math) isolated from UI and storage, with the 1 Kč threshold and planned-vs-actual separation as first-class concepts.

---

## 14. Resolved decisions

These are settled and should be treated as requirements:

1. **Green-field rebuild** — nothing from the existing codebase is reused.
2. **Identity model** — unified Identity + per-trip Membership (the "best" design), as in §4.
3. **Votes are public** to the trip.
4. **Both voting methods** supported (approval voting _and_ availability grid / single-choice), organizer's choice per poll.
5. **Open-join requires organizer approval by default.**
6. **Phases overlap freely** unless overlap breaks logic; each area has its own open/locked state.
7. **Participant-suggested expenses auto-add** (no approval gate) while accounts are Open; the organizer **must close accounts** (Open → Settling → Closed) so balances stop changing.
8. **Deposit is gated** (provisional until paid) and **based on each participant's planned-cost share.**
9. **Deposit/payment verification is banker-confirms-only** (no participant self-declared "paid").
10. **Transactional emails included**, with **share intents** offered when email isn't the best channel.

---

## 15. Suggested phasing

- **P1 — Foundation & Ideation.** Identity/auth (OAuth + magic link), invitations (direct + approved open-join), trips & configuration, multilingual scaffolding (CS/EN), lifecycle/locking model, date & location voting **with optimal-date suggestion**, attendance confirmation.
- **P2 — Money & logistics.** Full settlement engine + Czech QR, deposit-to-confirm, sleeping (rooms/beds/claims), transport/rides + reference info, transactional email + reminders for the highest-value loops (deposit, rides, pay-up).
- **P3 — Collaboration & polish.** Shopping & packing lists (incl. buy→expense and gear→car links), full organizer assistant (open-loop dashboard, scheduled/automated reminders, broadcasts), auditability, accounts-closing flows, refunds-on-dropout.

---

## 16. Out of scope / future ideas

Multi-currency trips, automatic translation of user content, recurring/annual trip templates, public discovery, in-app payment processing, post-trip photo galleries, expense receipts/OCR.

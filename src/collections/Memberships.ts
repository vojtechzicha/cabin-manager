import type { CollectionConfig, FieldAccess, Where } from "payload";

import {
  membershipsAccess,
  isPlatformAdminField,
  isOrganizerOf,
  serviceOwnedField,
  bankingFieldRead,
} from "@/access";
import { rejectIfArchived, rejectIfRosterLocked, rejectMemberRemovalWhenClosed } from "./guards";

/**
 * Membership — links one Identity to one Trip with a role and all trip-specific
 * data (PRD §4, §9). The unit of authorization: access control keys on the
 * caller's Membership in a trip.
 *
 * **Pending membership** (PRD §4): an organizer can create a Membership with no
 * `identity` yet (status `pending`), pre-filling `displayName` and an invite
 * target. It is claimed on the invitee's first login (T-103), which sets
 * `identity` and flips `status` to `active`, inheriting the pre-filled data.
 *
 * Field-level access protects privileged fields: a participant may edit their
 * own attendance and refund banking, but only an organizer/admin may set `role`,
 * `isBanker`, or `confirmed` (deposit confirmation is banker-driven, T-506).
 */

/**
 * Field access: writable only by the trip's organizer (or admin), never by the
 * member themselves. On create the trip is in `data`; on update we fall back to
 * the persisted `doc`.
 */
const organizerOnlyField: FieldAccess = ({ req, data, doc }) =>
  isOrganizerOf(req, (data?.trip ?? doc?.trip) as string | undefined);

export const Memberships: CollectionConfig = {
  slug: "memberships",
  admin: {
    useAsTitle: "displayName",
    defaultColumns: ["displayName", "trip", "role", "status", "confirmed"],
  },
  access: membershipsAccess,
  indexes: [
    // One membership per (identity, trip). Pending rows have no identity yet, so
    // a plain unique index can't cover them; the beforeChange hook below enforces
    // it at the data layer for claimed (identity-bearing) rows.
    { fields: ["trip", "identity"] },
  ],
  hooks: {
    beforeChange: [
      // Enforce one membership per (trip, identity) at the data layer — a
      // participant must not be able to join a trip twice, nor (with `trip`
      // immutable below) relocate their row into another trip.
      async ({ req, data, operation, originalDoc }) => {
        const identity = data.identity ?? originalDoc?.identity;
        const trip = data.trip ?? originalDoc?.trip;
        if (!identity || !trip) return data; // pending rows (no identity) are exempt
        const idOf = (v: unknown) =>
          v && typeof v === "object" ? String((v as { id: unknown }).id) : String(v);
        const clauses: Where[] = [
          { trip: { equals: idOf(trip) } },
          { identity: { equals: idOf(identity) } },
        ];
        if (operation === "update" && originalDoc?.id) {
          clauses.push({ id: { not_equals: String(originalDoc.id) } });
        }
        // Read outside the write transaction (committed rows only) to avoid
        // nesting a query in the create/update's own transaction.
        const dupes = await req.payload.find({
          collection: "memberships",
          overrideAccess: true,
          depth: 0,
          limit: 1,
          where: { and: clauses },
        });
        if (dupes.docs.length > 0) {
          throw new Error("A membership for this person already exists in this trip.");
        }
        return data;
      },
      rejectIfArchived,
      rejectIfRosterLocked,
    ],
    beforeDelete: [rejectMemberRemovalWhenClosed],
  },
  fields: [
    {
      name: "trip",
      type: "relationship",
      relationTo: "trips",
      required: true,
      index: true,
      // Immutable after creation: prevents a member relocating their row to
      // another trip via a direct API edit (set once by the service on create).
      access: { update: serviceOwnedField },
    },
    {
      name: "identity",
      type: "relationship",
      relationTo: "identities",
      index: true,
      // Service-owned: set on create, then on invite-claim (both via
      // overrideAccess). A member can never re-point their row at another identity.
      access: { update: serviceOwnedField },
      admin: { description: "Null until the invitee logs in and claims the pending membership." },
    },
    {
      name: "displayName",
      type: "text",
      admin: { description: "Organizer pre-fill; falls back to the Identity's display name once claimed." },
    },
    {
      name: "role",
      type: "select",
      defaultValue: "participant",
      access: { create: isPlatformAdminField, update: organizerOnlyField },
      options: [
        { label: "Organizer", value: "organizer" },
        { label: "Co-organizer", value: "co-organizer" },
        { label: "Participant", value: "participant" },
      ],
    },
    {
      name: "status",
      type: "select",
      defaultValue: "pending",
      index: true,
      access: { update: organizerOnlyField },
      options: [
        { label: "Pending", value: "pending" },
        { label: "Active", value: "active" },
      ],
    },
    {
      name: "isBanker",
      type: "checkbox",
      defaultValue: false,
      access: { create: isPlatformAdminField, update: organizerOnlyField },
      admin: { description: "The participant who holds the shared money (PRD §8.5)." },
    },
    {
      name: "confirmed",
      type: "checkbox",
      defaultValue: false,
      access: { create: isPlatformAdminField, update: organizerOnlyField },
      admin: { description: "Deposit-confirmed (banker-driven, T-506). Provisional until set." },
    },
    {
      name: "attendance",
      type: "group",
      admin: { description: "Self-service attendance (T-401 expands this)." },
      fields: [
        {
          name: "status",
          type: "select",
          options: [
            { label: "Coming", value: "coming" },
            { label: "Not coming", value: "not" },
            { label: "Maybe", value: "maybe" },
          ],
        },
        { name: "arrival", type: "date" },
        { name: "departure", type: "date" },
        { name: "companions", type: "number", min: 0 },
        { name: "pet", type: "checkbox", defaultValue: false },
      ],
    },
    {
      name: "bankAccount",
      type: "text",
      // Personal banking is not roster-public: readable only by the member, the
      // trip's organizers, and its banker (PRD §5/§10).
      access: { read: bankingFieldRead },
      admin: { description: "Czech account for refunds (PRD §8.5.4)." },
    },
    { name: "iban", type: "text", access: { read: bankingFieldRead } },
    {
      name: "preferredChannelOverride",
      type: "select",
      options: [
        { label: "Email", value: "email" },
        { label: "WhatsApp", value: "whatsapp" },
        { label: "Telegram", value: "telegram" },
        { label: "In-app", value: "inapp" },
      ],
    },
  ],
};

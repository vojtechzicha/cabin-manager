import type { CollectionConfig, FieldAccess } from "payload";

import { membershipsAccess, isPlatformAdminField, isOrganizerOf } from "@/access";

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
    // the uniqueness is enforced in the invite service rather than a DB index.
    { fields: ["trip", "identity"] },
  ],
  fields: [
    {
      name: "trip",
      type: "relationship",
      relationTo: "trips",
      required: true,
      index: true,
    },
    {
      name: "identity",
      type: "relationship",
      relationTo: "identities",
      index: true,
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
      admin: { description: "Czech account for refunds (PRD §8.5.4)." },
    },
    { name: "iban", type: "text" },
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

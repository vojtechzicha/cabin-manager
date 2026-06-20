import type { CollectionConfig } from "payload";

import { tripsAccess, serviceOwnedField } from "@/access";
import { rejectArchivedTripWrite, rejectArchivedTripDelete } from "./guards";

/**
 * Lifecycle, poll-lock, promoted, and banker fields are **service-owned**: they
 * change only through the lifecycle/poll/banker services (which run with
 * `overrideAccess`), never a direct REST/GraphQL write — so the state machine and
 * the audit log can't be bypassed. The reusable deny-write field access.
 */
const lifecycleField = { access: { update: serviceOwnedField } } as const;

/**
 * Trip (internally a *Chata*) — one group stay (PRD §8.1, §9). Holds the trip's
 * identity (name/short name/theme), which areas are enabled, the lifecycle phase
 * plus each area's own open→locked state (PRD §7), invite settings, and the
 * banker's bank details used for settlement QR codes.
 *
 * A caller reads only trips they are a member of (access scoping in
 * `tripsAccess`). Lifecycle *transitions* are guarded server-side by the
 * lifecycle state machine (T-202); the fields here are the persisted state.
 */
export const Trips: CollectionConfig = {
  slug: "trips",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "shortName", "phase", "financeState"],
  },
  access: tripsAccess,
  hooks: {
    // An archived trip is read-only history: block edits (except un-archiving)
    // and deletion until it's un-archived (PRD §7).
    beforeChange: [rejectArchivedTripWrite],
    beforeDelete: [rejectArchivedTripDelete],
  },
  fields: [
    { name: "name", type: "text", required: true },
    {
      name: "shortName",
      type: "text",
      required: true,
      admin: { description: "Used in payment messages (PRD §8.1). Keep it short." },
    },
    { name: "location", type: "text" },
    { name: "description", type: "textarea" },
    {
      name: "theme",
      type: "group",
      admin: { description: "Per-trip branding (PRD §8.1, §12)." },
      fields: [
        { name: "color", type: "text", admin: { description: "Accent color, e.g. #3b82f6." } },
        { name: "icon", type: "text", admin: { description: "Emoji glyph branding the trip." } },
        {
          name: "coverMedia",
          type: "relationship",
          relationTo: "media",
          admin: { description: "Uploaded cover photo (stored in MongoDB/GridFS)." },
        },
        {
          name: "coverImage",
          type: "text",
          admin: { description: "Optional cover image URL override (used if no upload)." },
        },
      ],
    },
    {
      name: "enabledAreas",
      type: "group",
      admin: { description: "Which areas the group collaborates on (PRD §8.1)." },
      fields: [
        { name: "voting", type: "checkbox", defaultValue: true },
        { name: "sleeping", type: "checkbox", defaultValue: true },
        { name: "transport", type: "checkbox", defaultValue: true },
        { name: "lists", type: "checkbox", defaultValue: true },
        { name: "finances", type: "checkbox", defaultValue: true },
        { name: "deposit", type: "checkbox", defaultValue: false },
      ],
    },
    {
      name: "phase",
      type: "select",
      defaultValue: "draft",
      index: true,
      ...lifecycleField,
      options: [
        { label: "Draft", value: "draft" },
        { label: "Ideation", value: "ideation" },
        { label: "Planning", value: "planning" },
        { label: "Finances", value: "finances" },
        { label: "Archived", value: "archived" },
      ],
    },
    // Per-area locking states (PRD §7). Transitions are enforced by T-202.
    {
      name: "datePollState",
      type: "select",
      defaultValue: "open",
      ...lifecycleField,
      options: [
        { label: "Open", value: "open" },
        { label: "Closed", value: "closed" },
      ],
    },
    {
      name: "locationPollState",
      type: "select",
      defaultValue: "open",
      ...lifecycleField,
      options: [
        { label: "Open", value: "open" },
        { label: "Closed", value: "closed" },
      ],
    },
    {
      name: "rosterState",
      type: "select",
      defaultValue: "open",
      ...lifecycleField,
      options: [
        { label: "Open", value: "open" },
        { label: "Locked", value: "locked" },
      ],
    },
    {
      name: "financeState",
      type: "select",
      defaultValue: "open",
      ...lifecycleField,
      options: [
        { label: "Open", value: "open" },
        { label: "Settling", value: "settling" },
        { label: "Closed", value: "closed" },
      ],
    },
    {
      name: "dates",
      type: "group",
      ...lifecycleField,
      admin: { description: "Promoted from the date poll when it closes (T-305)." },
      fields: [
        { name: "start", type: "date" },
        { name: "end", type: "date" },
      ],
    },
    {
      name: "banker",
      type: "group",
      ...lifecycleField,
      admin: { description: "Banker bank details for settlement QR codes (PRD §8.5.4)." },
      fields: [
        {
          name: "membership",
          type: "relationship",
          relationTo: "memberships",
          admin: { description: "The banker Membership (also flagged isBanker)." },
        },
        { name: "bankAccount", type: "text", admin: { description: "Czech account, e.g. 123456789/0100." } },
        { name: "iban", type: "text" },
      ],
    },
    {
      name: "deposit",
      type: "group",
      admin: { description: "Deposit-to-confirm config (PRD §8.3.2)." },
      fields: [
        { name: "enabled", type: "checkbox", defaultValue: false },
        {
          name: "gated",
          type: "checkbox",
          defaultValue: true,
          admin: { description: "Provisional until paid. Always on when deposit is enabled." },
        },
        {
          name: "basis",
          type: "select",
          defaultValue: "plannedCost",
          options: [{ label: "Planned-cost share", value: "plannedCost" }],
          admin: { description: "The required basis is the participant's planned-cost share (T-501)." },
        },
      ],
    },
    {
      name: "invites",
      type: "group",
      admin: { description: "Invite settings (PRD §5)." },
      fields: [
        {
          name: "openJoinEnabled",
          type: "checkbox",
          defaultValue: false,
          admin: { description: "Per-trip shareable join link. Off by default." },
        },
        {
          name: "openJoinAutoAccept",
          type: "checkbox",
          defaultValue: false,
          admin: { description: "Approve open-join requests automatically. Approval is required by default." },
        },
        {
          name: "openJoinToken",
          type: "text",
          index: true,
          admin: {
            readOnly: true,
            description:
              "The open-join link's shareable token. Unlike auth tokens (magic link / invites) this is stored in the clear, because it's a non-secret, approval-gated link the organizer needs to re-display and share repeatedly.",
          },
        },
      ],
    },
    {
      name: "createdBy",
      type: "relationship",
      relationTo: "identities",
      admin: { readOnly: true, description: "Identity that created the trip (the first organizer)." },
    },
  ],
};

import type { CollectionConfig } from "payload";

import { invitationsAccess } from "@/access";

/**
 * Invitation — a tokenized join request for a trip (PRD §5, §9). Created by an
 * organizer for a direct invite, or by an open-join request. It points at the
 * pending Membership it will activate, and stores only the **hash** of its token
 * (the raw token lives only in the delivered URL, T-105).
 *
 * Redemption happens through the auth route (T-103) with elevated access, not
 * via the REST API — so only organizers read/manage invitations here.
 */
export const Invitations: CollectionConfig = {
  slug: "invitations",
  admin: {
    useAsTitle: "targetValue",
    defaultColumns: ["targetValue", "trip", "status", "source", "expiresAt"],
  },
  access: invitationsAccess,
  fields: [
    { name: "trip", type: "relationship", relationTo: "trips", required: true, index: true },
    {
      name: "membership",
      type: "relationship",
      relationTo: "memberships",
      admin: { description: "The pending membership this invitation activates." },
    },
    {
      name: "targetType",
      type: "select",
      defaultValue: "email",
      options: [
        { label: "Email", value: "email" },
        { label: "Phone", value: "phone" },
        { label: "Handle", value: "handle" },
        { label: "Name", value: "name" },
      ],
    },
    {
      name: "targetValue",
      type: "text",
      required: true,
      admin: { description: "Email / phone / handle / name the invite was addressed to." },
    },
    {
      name: "tokenHash",
      type: "text",
      required: true,
      index: true,
      admin: { readOnly: true, description: "SHA-256 of the invite token. The raw token is never stored." },
    },
    {
      name: "status",
      type: "select",
      defaultValue: "pending",
      index: true,
      options: [
        { label: "Pending", value: "pending" },
        { label: "Accepted", value: "accepted" },
        { label: "Expired", value: "expired" },
      ],
    },
    {
      name: "source",
      type: "select",
      defaultValue: "direct",
      options: [
        { label: "Direct invite", value: "direct" },
        { label: "Open-join link", value: "open-link" },
      ],
    },
    { name: "expiresAt", type: "date", required: true },
    {
      name: "acceptedAt",
      type: "date",
      admin: { readOnly: true, description: "When the invite was redeemed (single-use replay guard)." },
    },
  ],
};

import type { CollectionConfig } from "payload";

import { votesAccess } from "@/access";

/**
 * Vote — one member's stance on one poll option (T-301, §8.2). Votes are
 * **public to the trip** (everyone sees who voted what) but writable only by
 * the voter (or an organizer). One row per `(option, membership)`, updatable.
 *
 * - Approval / grid: `value` is yes | ifneeded | no per option.
 * - Single choice (location): the chosen option gets `value: yes`; the service
 *   keeps at most one such row per membership per poll.
 *
 * `poll` and `trip` are denormalized for querying and access scoping.
 */
export const Votes: CollectionConfig = {
  slug: "votes",
  admin: { useAsTitle: "value", defaultColumns: ["membership", "option", "value", "trip"] },
  access: votesAccess,
  indexes: [{ fields: ["option", "membership"], unique: true }],
  fields: [
    { name: "poll", type: "relationship", relationTo: "polls", required: true, index: true },
    { name: "trip", type: "relationship", relationTo: "trips", required: true, index: true },
    { name: "option", type: "relationship", relationTo: "poll-options", required: true, index: true },
    { name: "membership", type: "relationship", relationTo: "memberships", required: true, index: true },
    {
      name: "value",
      type: "select",
      required: true,
      defaultValue: "yes",
      options: [
        { label: "Yes", value: "yes" },
        { label: "If needed", value: "ifneeded" },
        { label: "No", value: "no" },
      ],
    },
  ],
};

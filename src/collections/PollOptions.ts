import type { CollectionConfig } from "payload";

import { pollOptionsAccess } from "@/access";

/**
 * PollOption — a candidate the group votes on (T-301, §8.2). For a date poll
 * it's a window (`dateStart`/`dateEnd`); for a location poll it's a `label`.
 *
 * Any member may create one (participant-suggested options are flagged via
 * `suggestedBy`); only organizers edit/hide/promote/delete them. `trip` is
 * denormalized alongside `poll` so access control can scope without a join.
 */
export const PollOptions: CollectionConfig = {
  slug: "poll-options",
  admin: { useAsTitle: "label", defaultColumns: ["label", "kind", "trip", "hidden"] },
  access: pollOptionsAccess,
  fields: [
    { name: "poll", type: "relationship", relationTo: "polls", required: true, index: true },
    { name: "trip", type: "relationship", relationTo: "trips", required: true, index: true },
    {
      name: "kind",
      type: "select",
      required: true,
      options: [
        { label: "Date", value: "date" },
        { label: "Location", value: "location" },
      ],
    },
    { name: "dateStart", type: "date", admin: { description: "Date polls: window start." } },
    { name: "dateEnd", type: "date", admin: { description: "Date polls: window end." } },
    { name: "label", type: "text", admin: { description: "Location polls: the place; also a display label for date windows." } },
    {
      name: "suggestedBy",
      type: "relationship",
      relationTo: "memberships",
      admin: { description: "The participant who suggested it; null = organizer-seeded." },
    },
    { name: "hidden", type: "checkbox", defaultValue: false, admin: { description: "Moderated out of the vote." } },
    { name: "order", type: "number", defaultValue: 0 },
  ],
};

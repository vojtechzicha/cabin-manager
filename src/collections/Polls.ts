import type { CollectionConfig } from "payload";

import { pollsAccess } from "@/access";

/**
 * Poll — the date/time and location votes for a trip (T-301, PRD §8.2). Exactly
 * two polls per trip (`kind: date | location`); the row holds the chosen
 * **method** and, once closed, the **winner**.
 *
 * The poll's open/closed lock is *not* stored here — it lives on the Trip
 * (`datePollState` / `locationPollState`) and is driven by the lifecycle state
 * machine (T-202), since closing the date poll gates settlement. `published`
 * gates participant visibility: an organizer builds candidate options while the
 * poll is a draft, then publishes to open voting.
 */
export const Polls: CollectionConfig = {
  slug: "polls",
  admin: { useAsTitle: "kind", defaultColumns: ["kind", "trip", "method", "published"] },
  access: pollsAccess,
  indexes: [{ fields: ["trip", "kind"], unique: true }],
  fields: [
    { name: "trip", type: "relationship", relationTo: "trips", required: true, index: true },
    {
      name: "kind",
      type: "select",
      required: true,
      index: true,
      options: [
        { label: "Date", value: "date" },
        { label: "Location", value: "location" },
      ],
    },
    {
      name: "method",
      type: "select",
      defaultValue: "approval",
      options: [
        { label: "Approval (Yes / If-needed / No)", value: "approval" },
        { label: "Availability grid", value: "grid" },
        { label: "Single choice", value: "single" },
      ],
      admin: { description: "Date polls use approval or grid; location polls use single or approval." },
    },
    {
      name: "published",
      type: "checkbox",
      defaultValue: false,
      admin: { description: "Draft while the organizer seeds options; published opens voting." },
    },
    {
      name: "winnerOption",
      type: "relationship",
      relationTo: "poll-options",
      admin: { description: "Set when the poll is closed and the winner is promoted to the trip." },
    },
  ],
};

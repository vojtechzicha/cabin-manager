import type { CollectionConfig } from "payload";

import { tripContentAccess } from "@/access";

/**
 * Trip info & content (build.md T-203, PRD §8.7) — the read-mostly reference
 * material the organizer maintains and everyone reads: the destination block,
 * driving directions per origin, parking, and public-transport options.
 *
 * One row per trip (enforced in the `upsertTripContent` service, since a pending
 * trip may have none yet). Content is shown *as authored* — only the surrounding
 * chrome is localized (PRD §6). Read is scoped to trip members; edits are
 * organizer-only, both via `tripContentAccess`.
 *
 * Transport here is the **reference** layer (directions, parking, public
 * transport). Participant self-service rides (cars/seats) are a separate
 * concern in T-403.
 */
export const TripContent: CollectionConfig = {
  slug: "trip-content",
  admin: {
    useAsTitle: "trip",
    defaultColumns: ["trip", "updatedAt"],
  },
  access: tripContentAccess,
  fields: [
    {
      name: "trip",
      type: "relationship",
      relationTo: "trips",
      required: true,
      unique: true,
      index: true,
      admin: { description: "The trip this content belongs to (one row per trip)." },
    },
    {
      name: "destination",
      type: "group",
      admin: { description: "The destination block (PRD §8.7)." },
      fields: [
        { name: "name", type: "text", admin: { description: "e.g. Chata Pod Lysou." } },
        { name: "location", type: "text", admin: { description: "Address / area, e.g. Krásná 142 · Beskydy." } },
        { name: "mapUrl", type: "text", admin: { description: "Open-in-Maps link." } },
        { name: "description", type: "textarea" },
        {
          name: "basicInfo",
          type: "array",
          admin: { description: "Quick-facts grid (check-in, Wi-Fi, sleeps, nightly rate, …)." },
          fields: [
            { name: "label", type: "text", required: true },
            { name: "value", type: "text", required: true },
          ],
        },
        {
          name: "links",
          type: "array",
          admin: { description: "Useful links (booking, reviews, house rules)." },
          fields: [
            { name: "label", type: "text", required: true },
            { name: "url", type: "text", required: true },
          ],
        },
        {
          name: "photos",
          type: "array",
          fields: [
            { name: "url", type: "text", required: true },
            { name: "caption", type: "text" },
          ],
        },
        {
          name: "goodToKnow",
          type: "array",
          admin: { description: "Free-form bullets (PRD §8.7 basic-info)." },
          fields: [{ name: "text", type: "text", required: true }],
        },
      ],
    },
    {
      name: "directions",
      type: "array",
      admin: { description: "Driving directions per origin (PRD §8.3.4 reference)." },
      fields: [
        { name: "origin", type: "text", required: true, admin: { description: "From where, e.g. Brno." } },
        { name: "duration", type: "text", admin: { description: "e.g. 2 h 10 min." } },
        { name: "distance", type: "text", admin: { description: "e.g. 180 km." } },
        { name: "notes", type: "textarea", admin: { description: "Route notes / turn-by-turn." } },
      ],
    },
    {
      name: "parking",
      type: "textarea",
      admin: { description: "Parking info at the destination." },
    },
    {
      name: "publicTransport",
      type: "array",
      admin: { description: "Public-transport options (PRD §8.3.4)." },
      fields: [
        { name: "line", type: "text", required: true, admin: { description: "Line / service, e.g. R 18 Beskydy." } },
        { name: "from", type: "text" },
        { name: "to", type: "text" },
        { name: "departs", type: "text", admin: { description: "Departure time(s)." } },
        { name: "arrives", type: "text", admin: { description: "Arrival time(s)." } },
        { name: "notes", type: "text" },
      ],
    },
    {
      name: "notes",
      type: "textarea",
      admin: { description: "House / trip notes shown to everyone (PRD §8.7)." },
    },
  ],
};

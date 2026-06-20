import type { CollectionConfig } from "payload";

import { votesAccess, serviceOwnedField } from "@/access";
import { rejectIfArchived, rejectDeleteWhenArchived } from "./guards";

const idOf = (v: unknown): string =>
  v && typeof v === "object" ? String((v as { id: unknown }).id) : String(v);

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
  hooks: {
    beforeChange: [
      // Data-layer integrity for every vote write (direct API or service): the
      // option must be visible, its poll published and the trip's poll-lock open,
      // and trip/poll are taken from the option (authoritative) so a client can't
      // submit inconsistent references. The membership must be an active member
      // of the same trip. Vote *ownership* (your own membership) is enforced in
      // `votesAccess.create`.
      async ({ req, data, originalDoc }) => {
        const optionId = idOf(data.option ?? originalDoc?.option);
        const membershipId = idOf(data.membership ?? originalDoc?.membership);

        // Reads run outside the vote's write transaction (committed rows only).
        const option = await req.payload.findByID({ collection: "poll-options", id: optionId, overrideAccess: true, depth: 0 });
        if (option.hidden) throw new Error("That option has been hidden — voting on it is not allowed.");

        const poll = await req.payload.findByID({ collection: "polls", id: idOf(option.poll), overrideAccess: true, depth: 0 });
        if (!poll.published) throw new Error("This poll is not open for voting yet.");

        const trip = await req.payload.findByID({ collection: "trips", id: idOf(option.trip), overrideAccess: true, depth: 0 });
        const lock = poll.kind === "date" ? trip.datePollState : trip.locationPollState;
        if (lock === "closed") throw new Error("This poll is closed.");

        const membership = await req.payload.findByID({ collection: "memberships", id: membershipId, overrideAccess: true, depth: 0 });
        if (idOf(membership.trip) !== idOf(option.trip)) throw new Error("Vote references a membership from another trip.");
        if (membership.status !== "active") throw new Error("Only active members can vote.");

        // Take trip/poll from the option, ignoring any client-supplied values.
        data.trip = idOf(option.trip);
        data.poll = idOf(option.poll);
        return data;
      },
      rejectIfArchived,
    ],
    beforeDelete: [rejectDeleteWhenArchived("votes")],
  },
  fields: [
    { name: "poll", type: "relationship", relationTo: "polls", required: true, index: true, access: { update: serviceOwnedField } },
    { name: "trip", type: "relationship", relationTo: "trips", required: true, index: true, access: { update: serviceOwnedField } },
    { name: "option", type: "relationship", relationTo: "poll-options", required: true, index: true, access: { update: serviceOwnedField } },
    { name: "membership", type: "relationship", relationTo: "memberships", required: true, index: true, access: { update: serviceOwnedField } },
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

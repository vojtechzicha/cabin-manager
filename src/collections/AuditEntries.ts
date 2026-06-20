import type { CollectionConfig } from "payload";

/**
 * Append-only audit trail for sensitive actions — finance, deposits, and
 * lifecycle transitions (PRD §10, build.md T-005). Entries are written only
 * through the `recordAudit` service helper (Local API) and can never be edited
 * or deleted: immutability is enforced here at the data layer, not just in the
 * UI, so the record holds even against trusted server code.
 */
export const AuditEntries: CollectionConfig = {
  slug: "audit-entries",
  labels: { singular: "Audit entry", plural: "Audit log" },
  admin: {
    useAsTitle: "action",
    defaultColumns: ["action", "targetType", "trip", "createdAt"],
  },
  access: {
    // Reads are tightened to admins + trip members in T-106. Writes are
    // system-only: the helper uses the Local API (overrideAccess), while these
    // false values block any create/update/delete over REST/GraphQL.
    read: () => true,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  // createdAt is the immutable audit timestamp.
  timestamps: true,
  hooks: {
    beforeChange: [
      ({ operation, data }) => {
        if (operation === "update") {
          throw new Error("Audit entries are append-only and cannot be modified.");
        }
        return data;
      },
    ],
    beforeDelete: [
      () => {
        throw new Error("Audit entries cannot be deleted.");
      },
    ],
  },
  fields: [
    {
      name: "actor",
      type: "relationship",
      relationTo: "users",
      required: false,
      admin: { description: "Who performed the action (null for system actions)." },
    },
    {
      name: "action",
      type: "text",
      required: true,
      index: true,
      admin: { description: "Dotted action key, e.g. finance.accounts.closed." },
    },
    { name: "targetType", type: "text", required: true },
    { name: "targetId", type: "text", required: true },
    {
      name: "trip",
      type: "text",
      index: true,
      admin: { description: "Trip id the entry belongs to (queryable). Becomes a relationship in T-101." },
    },
    { name: "metadata", type: "json" },
  ],
};

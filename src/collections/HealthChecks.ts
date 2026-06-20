import type { CollectionConfig } from "payload";

/**
 * Trivial collection used by the bootstrap acceptance criteria and the /healthz
 * route: it proves a document round-trips to Mongo (and, via the health route,
 * that multi-document transactions are available on the replica set).
 */
export const HealthChecks: CollectionConfig = {
  slug: "health-checks",
  admin: { useAsTitle: "note" },
  fields: [
    { name: "note", type: "text", required: true },
    { name: "ok", type: "checkbox", defaultValue: true },
  ],
};

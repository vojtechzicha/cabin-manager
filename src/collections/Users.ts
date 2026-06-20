import type { CollectionConfig } from "payload";

/**
 * Platform accounts that can authenticate. In Epic 0 this is the minimal auth
 * collection Payload requires for the admin panel; later epics (T-101) evolve
 * the identity model. The `role` field is the seed of the admin lockdown
 * (T-106): only `admin` may reach the Payload admin surface.
 */
export const Users: CollectionConfig = {
  slug: "users",
  auth: true,
  admin: { useAsTitle: "email" },
  fields: [
    { name: "name", type: "text" },
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "user",
      options: [
        { label: "Platform admin", value: "admin" },
        { label: "User", value: "user" },
      ],
    },
  ],
};

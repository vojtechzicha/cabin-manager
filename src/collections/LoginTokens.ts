import type { CollectionConfig } from "payload";

/**
 * LoginToken — a single-use, expiring magic-link credential (PRD §4, T-103).
 * Used for passwordless login of an existing Identity. (Invite redemption uses
 * the `invitations` collection's token instead; this is for "email me a link to
 * sign in".)
 *
 * Only the token **hash** is stored; the raw token lives only in the delivered
 * URL. The collection is entirely **system-managed** — minted and consumed
 * through the auth service via the Local API (elevated access). All API
 * create/read/update/delete is denied so a leaked token row is inert.
 */
export const LoginTokens: CollectionConfig = {
  slug: "login-tokens",
  admin: { useAsTitle: "email", hidden: true },
  access: {
    read: () => false,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: "email",
      type: "text",
      required: true,
      index: true,
      admin: { description: "Email the magic link was issued for (lowercased)." },
    },
    {
      name: "identity",
      type: "relationship",
      relationTo: "identities",
      admin: { description: "Resolved at mint time when the email already has an Identity." },
    },
    { name: "tokenHash", type: "text", required: true, index: true },
    { name: "expiresAt", type: "date", required: true },
    {
      name: "usedAt",
      type: "date",
      admin: { description: "Set on first redemption; a used token is rejected (replay protection)." },
    },
  ],
};

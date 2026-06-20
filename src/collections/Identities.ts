import type { CollectionConfig } from "payload";

import { identitiesAccess, isPlatformAdminField } from "@/access";
import { locales, defaultLocale } from "@/i18n";

/**
 * Identity — one per human (PRD §4, §9). Carries the verified primary email,
 * linked OAuth providers, optional extra contact channels, display name/avatar,
 * and the per-user locale + preferred contact channel. A person who joins five
 * trips has **one** Identity and five Memberships.
 *
 * This is the platform's auth collection. The local (password) strategy is kept
 * for the platform admin; participants authenticate passwordlessly via the
 * magic-link custom strategy (T-103) or OAuth (T-102), both of which provision
 * or link an Identity server-side. Sessions are disabled so a freshly minted
 * JWT cookie alone authenticates a magic-link / OAuth login.
 *
 * The `role` field is the seed of the admin lockdown (T-106): only `admin` may
 * reach the Payload admin surface, and only an admin may set it.
 */
export const Identities: CollectionConfig = {
  slug: "identities",
  auth: {
    useSessions: false,
  },
  admin: {
    useAsTitle: "email",
    defaultColumns: ["email", "displayName", "role"],
  },
  access: identitiesAccess,
  fields: [
    { name: "displayName", type: "text" },
    { name: "avatar", type: "text", admin: { description: "Avatar image URL." } },
    {
      name: "role",
      type: "select",
      defaultValue: "user",
      access: {
        // Privilege escalation guard: only the platform admin may grant roles.
        create: isPlatformAdminField,
        update: isPlatformAdminField,
      },
      options: [
        { label: "Platform admin", value: "admin" },
        { label: "User", value: "user" },
      ],
    },
    {
      name: "preferredLanguage",
      type: "select",
      defaultValue: defaultLocale,
      options: locales.map((l) => ({ label: l.toUpperCase(), value: l })),
      admin: { description: "Per-user UI + system-message language (PRD §6)." },
    },
    {
      name: "preferredChannel",
      type: "select",
      defaultValue: "email",
      options: [
        { label: "Email", value: "email" },
        { label: "WhatsApp", value: "whatsapp" },
        { label: "Telegram", value: "telegram" },
        { label: "In-app", value: "inapp" },
      ],
    },
    {
      // Linked OAuth providers (T-102). Login by a provider links to the
      // existing Identity when the verified email matches.
      name: "providers",
      type: "array",
      labels: { singular: "Linked provider", plural: "Linked providers" },
      fields: [
        {
          name: "provider",
          type: "select",
          required: true,
          options: [
            { label: "Google", value: "google" },
            { label: "Microsoft", value: "microsoft" },
          ],
        },
        { name: "providerAccountId", type: "text", required: true },
        { name: "email", type: "text" },
      ],
    },
    {
      // Additional ways to reach this person (PRD §4): extra email, phone for
      // WhatsApp, Telegram handle. The primary email lives in the auth field.
      name: "contactChannels",
      type: "array",
      fields: [
        {
          name: "type",
          type: "select",
          required: true,
          options: [
            { label: "Email", value: "email" },
            { label: "Phone", value: "phone" },
            { label: "Telegram", value: "telegram" },
          ],
        },
        { name: "value", type: "text", required: true },
        { name: "label", type: "text" },
      ],
    },
  ],
};

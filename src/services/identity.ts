/**
 * Identity provisioning & linking (build.md T-101/T-102).
 *
 * One Identity per human (PRD §4): logins by Google, Microsoft, or magic link
 * all resolve to a **single** Identity keyed on the verified email. This service
 * is the only place that creates or links identities, always via the Local API
 * with elevated access (the `identities` collection denies public create).
 */
import type { Payload, PayloadRequest } from "payload";

import { defaultLocale, isLocale, type Locale } from "@/i18n";
import { generateToken } from "@/lib/tokens";
import type { Identity } from "@/payload-types";

export type OAuthProvider = "google" | "microsoft";

/** Lowercase + trim so lookups and uniqueness are case-insensitive. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Find an Identity by its primary email (normalized), or null. */
export async function findIdentityByEmail(
  payload: Payload,
  email: string,
  req?: PayloadRequest,
): Promise<Identity | null> {
  const res = await payload.find({
    collection: "identities",
    where: { email: { equals: normalizeEmail(email) } },
    limit: 1,
    overrideAccess: true,
    req,
  });
  return res.docs[0] ?? null;
}

export interface EnsureIdentityInput {
  email: string;
  displayName?: string | null;
  preferredLanguage?: Locale;
}

/**
 * Find the Identity for `email`, creating one on first sight. Returns the
 * Identity and whether it was just created (first-login provisioning).
 */
export async function ensureIdentity(
  payload: Payload,
  input: EnsureIdentityInput,
  req?: PayloadRequest,
): Promise<{ identity: Identity; created: boolean }> {
  const email = normalizeEmail(input.email);
  const existing = await findIdentityByEmail(payload, email, req);
  if (existing) return { identity: existing, created: false };

  const preferredLanguage =
    input.preferredLanguage && isLocale(input.preferredLanguage)
      ? input.preferredLanguage
      : defaultLocale;

  const identity = await payload.create({
    collection: "identities",
    overrideAccess: true,
    req,
    data: {
      email,
      displayName: input.displayName ?? undefined,
      role: "user",
      preferredLanguage,
      // Passwordless accounts still need a password column populated; a random,
      // unknowable value keeps the local (password) strategy unusable for them.
      password: generateToken().raw,
    },
  });
  return { identity, created: true };
}

/**
 * Link an OAuth provider account to an Identity (idempotent). Matching by
 * verified email means Google and Microsoft logins for the same address resolve
 * to one Identity (T-102 acceptance criteria).
 */
export async function linkProvider(
  payload: Payload,
  identity: Identity,
  link: { provider: OAuthProvider; providerAccountId: string; email?: string },
  req?: PayloadRequest,
): Promise<Identity> {
  const providers = identity.providers ?? [];
  const already = providers.some(
    (p) => p.provider === link.provider && p.providerAccountId === link.providerAccountId,
  );
  if (already) return identity;

  return payload.update({
    collection: "identities",
    id: identity.id,
    overrideAccess: true,
    req,
    data: {
      providers: [
        ...providers.map((p) => ({
          provider: p.provider,
          providerAccountId: p.providerAccountId,
          email: p.email ?? undefined,
        })),
        { provider: link.provider, providerAccountId: link.providerAccountId, email: link.email },
      ],
    },
  });
}

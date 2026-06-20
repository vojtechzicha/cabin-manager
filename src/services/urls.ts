/**
 * Absolute URL builders for tokenized auth links (build.md T-103/T-104/T-105).
 * Centralized so the route paths exist in exactly one place and every channel
 * (email, share intents) emits the same live link.
 */
import { getEnv } from "@/lib/env";

function base(): string {
  return getEnv().APP_URL.replace(/\/+$/, "");
}

/** Magic-link sign-in URL for an existing Identity. */
export function magicLinkUrl(rawToken: string): string {
  return `${base()}/auth/magic?token=${encodeURIComponent(rawToken)}`;
}

/** Direct-invite redemption URL (creates/links Identity, activates membership). */
export function inviteUrl(rawToken: string): string {
  return `${base()}/auth/invite?token=${encodeURIComponent(rawToken)}`;
}

/** Per-trip open-join link (request to join, approval-gated by default). */
export function openJoinUrl(rawToken: string): string {
  return `${base()}/join?token=${encodeURIComponent(rawToken)}`;
}

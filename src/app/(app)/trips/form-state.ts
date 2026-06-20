/**
 * Shared result shape for the trip forms driven by `useActionState` (T-201).
 * Lives in its own module (not the `"use server"` actions file, which may only
 * export async functions) so both the actions and the client forms can import
 * it. `fieldErrors` values are validation *codes* (e.g. "required") that the
 * client maps to localized messages.
 */
import type { ShareIntent } from "@/lib/share-intents";

export type FormState =
  | { ok?: boolean; error?: string; message?: string; fieldErrors?: Record<string, string> }
  | null;

/** Result of creating a direct invite: the URL + share intents, or an error code. */
export type InviteState = { url?: string; shareIntents?: ShareIntent[]; error?: string } | null;

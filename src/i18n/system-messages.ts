import type { Locale } from "./config";
import { getFormatters } from "./format";
import { getMessages, interpolate, type MessageParams, type MessageSelector } from "./translator";

/**
 * Render a system message (email, reminder, share text) in the **recipient's**
 * language — independent of whoever triggered it (PRD §6, T-003). A reminder an
 * English-speaking organizer fires at a Czech participant renders in Czech,
 * because only `recipientLocale` is consulted here.
 */
export function renderSystemMessage(
  recipientLocale: Locale,
  select: MessageSelector,
  params?: MessageParams,
): string {
  return interpolate(select(getMessages(recipientLocale)), params);
}

/** Formatters bound to the recipient's locale, for amounts/dates inside messages. */
export function recipientFormatters(recipientLocale: Locale, currency?: string) {
  return getFormatters(recipientLocale, currency);
}

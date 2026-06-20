/**
 * Invite & notification delivery (build.md T-105, PRD §4/§11).
 *
 * Every tokenized link can reach a recipient two ways: a transactional email
 * (sent whenever an address is known) and share intents (WhatsApp/Telegram/
 * mailto/copy/native) the organizer can tap to send over any channel. Both
 * carry the **recipient-localized** message (PRD §6) — the text is rendered with
 * `renderSystemMessage` against the recipient's locale, never the sender's.
 */
import type { Payload } from "payload";

import { renderSystemMessage, type Locale } from "@/i18n";
import { buildShareIntents, type ShareIntent } from "@/lib/share-intents";

import { sendEmail } from "./email";

export interface DeliveryResult {
  subject: string;
  body: string;
  /** Share buttons for the organizer (always offered). */
  shareIntents: ShareIntent[];
  /** True if a transactional email was sent (an address was known). */
  emailed: boolean;
}

export interface DeliverInviteInput {
  recipientLocale: Locale;
  recipientName?: string;
  organizerName: string;
  tripName: string;
  url: string;
  /** When present, a transactional email is sent here. */
  email?: string;
}

/** Deliver a direct invite: email (if addressable) + share intents. */
export async function deliverInvite(
  payload: Payload,
  input: DeliverInviteInput,
): Promise<DeliveryResult> {
  const { recipientLocale: loc } = input;
  const subject = renderSystemMessage(loc, (m) => m.invite.subject, { trip: input.tripName });
  const body = renderSystemMessage(loc, (m) => m.invite.body, {
    name: input.recipientName ?? "",
    organizer: input.organizerName,
    trip: input.tripName,
  });
  const shareText = renderSystemMessage(loc, (m) => m.invite.shareText, { trip: input.tripName });
  const shareIntents = buildShareIntents({ url: input.url, text: shareText, subject });

  let emailed = false;
  if (input.email) {
    await sendEmail(payload, { to: input.email, subject, text: `${body}\n${input.url}` });
    emailed = true;
  }
  return { subject, body, shareIntents, emailed };
}

export interface DeliverMagicLinkInput {
  recipientLocale: Locale;
  email: string;
  url: string;
  expiresMinutes: number;
}

/** Deliver a magic-link sign-in email (always to a known address). */
export async function deliverMagicLink(
  payload: Payload,
  input: DeliverMagicLinkInput,
): Promise<DeliveryResult> {
  const { recipientLocale: loc } = input;
  const subject = renderSystemMessage(loc, (m) => m.magicLink.subject);
  const body = renderSystemMessage(loc, (m) => m.magicLink.body, {
    minutes: input.expiresMinutes,
  });
  const shareIntents = buildShareIntents({ url: input.url, text: body, subject });

  await sendEmail(payload, { to: input.email, subject, text: `${body}\n${input.url}` });
  return { subject, body, shareIntents, emailed: true };
}

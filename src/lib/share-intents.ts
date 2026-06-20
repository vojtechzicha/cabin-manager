/**
 * Share-intent link builder (build.md T-105, PRD §4/§11).
 *
 * Delivering a tokenized invite/magic URL is "free and channel-agnostic" — no
 * messaging Business APIs. We just construct deep links that open the sender's
 * own app with the invite text pre-filled; the human taps send. Everything here
 * is pure string-building (a `lib` leaf), so it is fully unit-tested and works
 * the same on the server or client.
 *
 * The `text` passed in is already localized for the *recipient* (PRD §6) by the
 * caller via `renderSystemMessage`; this module only handles transport.
 */

export interface ShareIntent {
  /** Stable channel key for choosing an icon/label in the UI. */
  channel: "whatsapp" | "telegram" | "email" | "copy" | "native";
  /** Deep link to open (absent for `copy`, which uses the clipboard). */
  href?: string;
  /** Payload for the native Web Share API / clipboard (channel `native`/`copy`). */
  share?: { title?: string; text: string; url: string };
}

export interface ShareIntentInput {
  /** The live tokenized URL to deliver (invite or magic link). */
  url: string;
  /** Recipient-localized message body. The URL is appended where needed. */
  text: string;
  /** Optional subject line, used by the email intent. */
  subject?: string;
}

/** Compose the message + url the way most chat apps expect (text then link). */
function bodyWithUrl(text: string, url: string): string {
  return text.includes(url) ? text : `${text}\n${url}`;
}

/** WhatsApp share intent: `https://wa.me/?text=…` (PRD §4). */
export function whatsAppIntent({ url, text }: ShareIntentInput): ShareIntent {
  const t = encodeURIComponent(bodyWithUrl(text, url));
  return { channel: "whatsapp", href: `https://wa.me/?text=${t}` };
}

/** Telegram share intent: `https://t.me/share/url?url=…&text=…` (PRD §4). */
export function telegramIntent({ url, text }: ShareIntentInput): ShareIntent {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  return { channel: "telegram", href: `https://t.me/share/url?url=${u}&text=${t}` };
}

/** `mailto:` intent with the URL appended to the body. */
export function emailIntent({ url, text, subject }: ShareIntentInput): ShareIntent {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  params.set("body", bodyWithUrl(text, url));
  // URLSearchParams encodes spaces as "+"; mail clients want %20 in mailto bodies.
  const query = params.toString().replace(/\+/g, "%20");
  return { channel: "email", href: `mailto:?${query}` };
}

/** Copy-to-clipboard intent (no href; the UI copies `share.text`). */
export function copyIntent({ url, text }: ShareIntentInput): ShareIntent {
  return { channel: "copy", share: { text: bodyWithUrl(text, url), url } };
}

/** Native Web Share API intent (`navigator.share`). */
export function nativeIntent({ url, text, subject }: ShareIntentInput): ShareIntent {
  return { channel: "native", share: { title: subject, text, url } };
}

/** All supported share intents for a message, in display order. */
export function buildShareIntents(input: ShareIntentInput): ShareIntent[] {
  return [
    whatsAppIntent(input),
    telegramIntent(input),
    emailIntent(input),
    copyIntent(input),
    nativeIntent(input),
  ];
}

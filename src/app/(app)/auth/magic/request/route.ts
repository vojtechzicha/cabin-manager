import config from "@payload-config";
import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { defaultLocale, isLocale } from "@/i18n";
import { deliverMagicLink } from "@/services/delivery";
import { findIdentityByEmail } from "@/services/identity";
import { mintMagicLink, MAGIC_LINK_TTL_MINUTES } from "@/services/magic-link";

/**
 * Request a magic link (T-103). Mints a token and delivers it by email, in the
 * recipient's language (their saved preference, else the requested locale, else
 * the default — PRD §6). Always responds `ok` so the endpoint never reveals
 * whether an email is registered (no account enumeration).
 */
export async function POST(request: Request): Promise<Response> {
  let email = "";
  let requestedLocale: string | undefined;
  let next: string | undefined;
  try {
    const body = (await request.json()) as { email?: unknown; locale?: unknown; next?: unknown };
    if (typeof body.email === "string") email = body.email.trim();
    if (typeof body.locale === "string") requestedLocale = body.locale;
    // Only accept an in-app path (open redirect guard).
    if (typeof body.next === "string" && body.next.startsWith("/")) next = body.next;
  } catch {
    // fall through to the validation below
  }
  if (!email) return NextResponse.json({ error: "email_required" }, { status: 400 });

  const payload = await getPayload({ config });
  const identity = await findIdentityByEmail(payload, email);
  const recipientLocale =
    (identity?.preferredLanguage && isLocale(identity.preferredLanguage)
      ? identity.preferredLanguage
      : undefined) ??
    (requestedLocale && isLocale(requestedLocale) ? requestedLocale : undefined) ??
    defaultLocale;

  const minted = await mintMagicLink(payload, email, { next });
  await deliverMagicLink(payload, {
    email,
    url: minted.url,
    recipientLocale,
    expiresMinutes: MAGIC_LINK_TTL_MINUTES,
  });

  return NextResponse.json({ ok: true });
}

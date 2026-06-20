"use client";

import { useState, type FormEvent } from "react";

import { Button, Field, Input } from "@/components/ui";
import { useI18n } from "@/i18n/react";

/**
 * Passwordless sign-in (T-201, the UI Epic 1 left out). Posts the email to the
 * magic-link request route — which always answers `ok` so we never reveal
 * whether an account exists — then shows a "check your inbox" state. OAuth
 * providers are plain links to the start routes (they no-op if unconfigured).
 *
 * `next` is carried through so the magic-link/OAuth flow can land the user back
 * where they were headed.
 */
export function SignInForm({ next }: { next?: string }) {
  const { m, locale } = useI18n();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setPending(true);
    try {
      await fetch("/auth/magic/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), locale }),
      });
      setSent(true);
    } finally {
      setPending(false);
    }
  }

  const oauthHref = (provider: string) =>
    next ? `/auth/oauth/${provider}?next=${encodeURIComponent(next)}` : `/auth/oauth/${provider}`;

  if (sent) {
    return (
      <div className="rounded-card border border-line bg-card p-5">
        <div className="display text-xl font-bold">{m.auth.sent}</div>
        <p className="mt-1 text-sm text-muted">{m.auth.sentHint}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label={m.auth.email} htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </Field>
        <Button type="submit" disabled={pending}>
          {m.auth.sendLink}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-[12px] text-muted">
        <span className="h-px flex-1 bg-line" />
        {m.auth.continueWith}
        <span className="h-px flex-1 bg-line" />
      </div>

      <div className="flex gap-3">
        <a
          href={oauthHref("google")}
          className="flex min-h-11 flex-1 items-center justify-center rounded-btn border border-line bg-card text-sm font-semibold"
        >
          {m.auth.google}
        </a>
        <a
          href={oauthHref("microsoft")}
          className="flex min-h-11 flex-1 items-center justify-center rounded-btn border border-line bg-card text-sm font-semibold"
        >
          {m.auth.microsoft}
        </a>
      </div>
    </div>
  );
}

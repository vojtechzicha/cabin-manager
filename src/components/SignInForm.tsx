"use client";

import { useEffect, useState, type FormEvent } from "react";

import { useI18n } from "@/i18n/react";

const RESEND_COOLDOWN = 45; // seconds

/** Google "G" — conic wedge mark with a white core. */
function GoogleGlyph() {
  return (
    <span
      aria-hidden
      className="inline-flex h-5 w-5 items-center justify-center rounded-full"
      style={{
        background:
          "conic-gradient(from -45deg, #ea4335 0deg 90deg, #fbbc05 90deg 180deg, #34a853 180deg 270deg, #4285f4 270deg 360deg)",
      }}
    >
      <span className="h-[9px] w-[9px] rounded-full bg-white" />
    </span>
  );
}

/** Microsoft four-square mark. */
function MicrosoftGlyph() {
  return (
    <span aria-hidden className="grid grid-cols-2 grid-rows-2 gap-[2px]">
      <span className="h-[9px] w-[9px] bg-[#f25022]" />
      <span className="h-[9px] w-[9px] bg-[#7fba00]" />
      <span className="h-[9px] w-[9px] bg-[#00a4ef]" />
      <span className="h-[9px] w-[9px] bg-[#ffb900]" />
    </span>
  );
}

/**
 * Passwordless sign-in (T-201). Posts the email to the magic-link request route
 * — which always answers `ok`, so we never reveal whether an account exists —
 * then flips to a "check your inbox" confirmation with a resend cooldown. OAuth
 * providers are plain links to the start routes (they no-op if unconfigured).
 *
 * `next` is carried through so the magic-link/OAuth flow lands the user back
 * where they were headed. Styled for the dark root lobby (Chata Sign In design).
 */
export function SignInForm({ next }: { next?: string }) {
  const { m, locale } = useI18n();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  async function send() {
    if (!email.trim()) return;
    setPending(true);
    try {
      await fetch("/auth/magic/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), locale, next }),
      });
      setSent(true);
      setCooldown(RESEND_COOLDOWN);
    } finally {
      setPending(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send();
  }

  const oauthHref = (provider: string) =>
    next ? `/auth/oauth/${provider}?next=${encodeURIComponent(next)}` : `/auth/oauth/${provider}`;

  // ── Confirmation: magic link sent ─────────────────────────────────────────
  if (sent) {
    const mmss = `${Math.floor(cooldown / 60)}:${String(cooldown % 60).padStart(2, "0")}`;
    return (
      <div className="flex flex-col items-center text-center">
        <div className="flex h-[88px] w-[88px] items-center justify-center rounded-[26px] border border-white/20 bg-white/8 text-[40px] shadow-[0_0_50px_rgba(124,208,166,.3)]">
          ✉
        </div>
        <h2 className="display mt-6 text-[32px] font-extrabold leading-none tracking-tight text-white">
          {m.auth.sent}
        </h2>
        <p className="mt-3.5 max-w-[280px] text-[15px] leading-relaxed text-white/80">
          {m.auth.sentHint.split("{email}")[0]}
          <span className="font-bold text-white">{email}</span>
          {m.auth.sentHint.split("{email}")[1]}
        </p>

        {cooldown > 0 ? (
          <div className="mono mt-7 text-[13px] text-white/55">
            {m.auth.resendIn.replace("{time}", mmss)}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void send()}
            disabled={pending}
            className="mt-7 text-[14px] font-bold text-white underline-offset-4 hover:underline disabled:opacity-60"
          >
            {m.auth.resend}
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            setSent(false);
            setCooldown(0);
          }}
          className="mt-3.5 text-[13px] text-white/70 hover:text-white"
        >
          {m.auth.differentEmail}
        </button>

        <div className="mt-6 flex items-center gap-2.5 rounded-[14px] border border-white/12 bg-white/5 px-3.5 py-3 text-left">
          <span aria-hidden className="text-base">
            💡
          </span>
          <div className="text-[12px] leading-snug text-white/70">{m.auth.spamHint}</div>
        </div>
      </div>
    );
  }

  // ── Sign-in form ──────────────────────────────────────────────────────────
  return (
    <div>
      {/* Mobile: large welcome headline (no card). */}
      <div className="mb-7 lg:hidden">
        <div className="mono text-[11px] uppercase tracking-[0.2em] text-white/55">
          {m.auth.welcomeBack}
        </div>
        <h1 className="display mt-3 text-[44px] font-extrabold leading-[0.94] tracking-tight text-white">
          {m.auth.signInHeadline}
        </h1>
      </div>
      {/* Desktop: compact card title. */}
      <div className="hidden lg:block">
        <div className="display text-[26px] font-bold tracking-tight text-white">{m.auth.signIn}</div>
        <div className="mt-1 text-[14px] text-white/65">{m.auth.subtitle}</div>
      </div>

      <form onSubmit={onSubmit}>
        <div className="mono mt-6 mb-2 text-[10px] uppercase tracking-[0.14em] text-white/50">
          {m.auth.emailAddress}
        </div>
        <div className="flex h-[52px] items-center gap-2.5 rounded-[14px] border border-white/18 bg-white/6 px-3.5 focus-within:border-white/40">
          <span aria-hidden className="text-base opacity-70">
            ✉
          </span>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={m.auth.emailPlaceholder}
            className="h-full flex-1 border-none bg-transparent text-[16px] text-white outline-none placeholder:text-white/40"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="mt-3.5 w-full rounded-[14px] bg-white py-4 text-[16px] font-bold text-[#16151c] disabled:opacity-60"
        >
          {m.auth.sendLink}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-white/14" />
        <span className="mono text-[11px] uppercase tracking-[0.14em] text-white/45">{m.auth.or}</span>
        <span className="h-px flex-1 bg-white/14" />
      </div>

      <a
        href={oauthHref("google")}
        className="mb-2.5 flex w-full items-center justify-center gap-2.5 rounded-[14px] bg-white py-3.5 text-[15px] font-semibold text-[#16151c]"
      >
        <GoogleGlyph />
        {m.auth.continueGoogle}
      </a>
      <a
        href={oauthHref("microsoft")}
        className="flex w-full items-center justify-center gap-2.5 rounded-[14px] border border-white/20 bg-white/8 py-3.5 text-[15px] font-semibold text-white"
      >
        <MicrosoftGlyph />
        {m.auth.continueMicrosoft}
      </a>

      <p className="mt-5 text-center text-[12px] leading-relaxed text-white/50">
        {m.auth.agree}{" "}
        <span className="font-semibold text-white/80">{m.auth.terms}</span> &amp;{" "}
        <span className="font-semibold text-white/80">{m.auth.privacy}</span>.
      </p>
    </div>
  );
}

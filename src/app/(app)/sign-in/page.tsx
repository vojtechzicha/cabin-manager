import { redirect } from "next/navigation";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SignInForm } from "@/components/SignInForm";
import { sampleThemes } from "@/components/theme";
import { getTranslator } from "@/i18n";
import { getRequestLocale } from "@/i18n/server";

import { getCurrentIdentity } from "../auth/current-user";

/** The Chata A-frame mark, reversed to white over the dark lobby. */
function ChataMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={(size / 28) * 26} viewBox="0 0 48 44" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M24 2 L45.5 41 H2.5 Z M24 21 L34 41 H14 Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Sign-in screen (T-201) — the dark root-lobby "door" (Chata Sign In design).
 * Already-authenticated visitors are bounced to their `next` target (or home).
 * A thin server shell: brand panel on desktop, the interactive `SignInForm`
 * card on every size. Auth runs through the Epic 1 magic-link / OAuth routes.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const { identity } = await getCurrentIdentity();
  if (identity) redirect(next && next.startsWith("/") ? next : "/");

  const locale = await getRequestLocale();
  const { m } = getTranslator(locale);

  const cluster = [
    { theme: sampleThemes.cabin, kicker: "Beskydy · T-23", name: "Summer Cabin" },
    { theme: sampleThemes.la2028, kicker: "LA · T-512", name: "Road to LA" },
    { theme: sampleThemes.baltic, kicker: "Gdańsk · T-40", name: "Baltic Ride" },
  ];

  return (
    <main
      className="relative flex min-h-screen flex-col overflow-hidden text-white"
      style={{
        background: "radial-gradient(90% 90% at 88% -10%, #2a2740 0%, #1a1822 45%, #131118 100%)",
      }}
    >
      {/* glow blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-36 -top-28 h-[520px] w-[520px] blur-2xl"
        style={{ background: "radial-gradient(circle, rgba(47,158,115,.45), transparent 62%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-16 h-[460px] w-[460px] blur-2xl"
        style={{ background: "radial-gradient(circle, rgba(240,101,60,.45), transparent 62%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 left-24 h-[480px] w-[480px] blur-2xl"
        style={{ background: "radial-gradient(circle, rgba(58,91,255,.45), transparent 62%)" }}
      />

      <div className="relative mx-auto flex w-full max-w-[1120px] flex-1 flex-col px-5 py-6 sm:px-8">
        {/* top bar */}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2.5 text-white">
            <ChataMark size={28} />
            <span className="display text-2xl font-extrabold">{m.common.appName}</span>
          </span>
          <LanguageSwitcher tone="dark" />
        </div>

        {/* body */}
        <div className="flex flex-1 items-center py-8">
          <div className="grid w-full items-center gap-12 lg:grid-cols-2">
            {/* brand panel — desktop only */}
            <div className="hidden lg:block">
              <div className="mono text-[12px] uppercase tracking-[0.22em] text-white/60">
                {m.auth.welcomeBack}
              </div>
              <h2 className="display mt-3.5 text-[60px] font-extrabold leading-[0.94] tracking-[-0.035em]">
                {m.auth.brandHeadline}
              </h2>
              <p className="mt-5 max-w-[380px] text-[17px] leading-relaxed text-white/78">
                {m.auth.brandTagline}
              </p>
              <div aria-hidden className="mt-9 flex gap-3">
                {cluster.map((c) => (
                  <div
                    key={c.name}
                    className="relative h-[90px] w-[150px] overflow-hidden rounded-[16px] p-3 text-white shadow-[0_20px_40px_-18px_rgba(0,0,0,.55)]"
                    style={{ background: c.theme?.photo }}
                  >
                    <div className="mono text-[8px] uppercase tracking-[0.12em] opacity-85">
                      {c.kicker}
                    </div>
                    <div className="display absolute bottom-3 text-[16px] font-extrabold">
                      {c.name}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-9 text-[13px] text-white/55">
                {m.auth.newHere} <span className="font-bold text-white">{m.lobby.start} →</span>
              </div>
            </div>

            {/* sign-in card (glass on desktop; bare on mobile) */}
            <div className="mx-auto w-full max-w-[440px] lg:rounded-[24px] lg:border lg:border-white/14 lg:bg-[rgba(28,27,34,0.72)] lg:p-8 lg:shadow-[0_30px_60px_-24px_rgba(0,0,0,.6)] lg:backdrop-blur-xl">
              <SignInForm next={next && next.startsWith("/") ? next : undefined} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

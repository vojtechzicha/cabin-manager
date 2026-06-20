"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { localeEnglishLabel, localeFlag, localeLabel, locales } from "@/i18n/config";
import { useI18n } from "@/i18n/react";

const LOCALE_COOKIE = "locale";
const ONE_YEAR = 60 * 60 * 24 * 365;

// Module-scope side effect: write the override cookie. Kept outside the
// component so it isn't treated as in-render mutation by the React Compiler.
function writeLocaleCookie(value: string) {
  document.cookie = `${LOCALE_COOKIE}=${value}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}

/**
 * Switches the active UI language. Writes the `locale` override cookie and
 * refreshes the server tree, so all chrome re-renders in the chosen language
 * (the cookie later defers to a persisted Identity.preferredLanguage — T-101).
 *
 * The control is the Chata Design System's globe switcher (`🌐 EN ▾`) — the same
 * shape on every screen. On desktop it opens a dropdown menu; on phones it opens
 * the design's bottom sheet (flag rows + native/English names). `tone` only
 * adapts its colours to the surface: glass-on-dark in the lobby, or a light card
 * on the bright trip screens.
 */
export function LanguageSwitcher({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { locale: active, m } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const dark = tone === "dark";

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(next: string) {
    setOpen(false);
    if (next === active) return;
    writeLocaleCookie(next); // immediate
    // Persist to the signed-in Identity (best-effort; the cookie already applies).
    void fetch("/auth/locale", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale: next }),
    }).catch(() => undefined);
    startTransition(() => router.refresh());
  }

  const check = dark ? "#7cd0a6" : "var(--accent)";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={m.common.language}
        className={`inline-flex items-center gap-1.5 rounded-[11px] border px-3 py-2 text-[14px] font-semibold backdrop-blur-md transition-colors disabled:opacity-60 ${
          dark ? "border-white/20 bg-white/10 text-white" : "border-line bg-card text-ink"
        }`}
      >
        <span aria-hidden>🌐</span>
        <span>{active.toUpperCase()}</span>
        <span aria-hidden className="text-[11px] opacity-60">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open ? (
        <>
          {/* ── Desktop: anchored dropdown ── */}
          <div
            role="menu"
            className={`absolute right-0 top-[calc(100%+6px)] z-50 hidden w-44 rounded-[14px] border p-1.5 shadow-[0_20px_40px_-16px_rgba(0,0,0,.45)] backdrop-blur-md sm:block ${
              dark ? "border-white/15 bg-[rgba(28,27,34,0.92)]" : "border-line bg-card"
            }`}
          >
            {locales.map((locale) => {
              const isActive = locale === active;
              return (
                <button
                  key={locale}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  onClick={() => choose(locale)}
                  disabled={pending}
                  className={`flex w-full items-center justify-between rounded-[9px] px-3 py-2.5 text-[14px] transition-colors disabled:opacity-60 ${
                    dark
                      ? isActive
                        ? "bg-white/10 font-semibold text-white"
                        : "text-white/80 hover:bg-white/5"
                      : isActive
                        ? "bg-accent-soft font-semibold text-accent-ink"
                        : "text-muted hover:bg-paper"
                  }`}
                >
                  <span>{localeLabel[locale]}</span>
                  {isActive ? (
                    <span aria-hidden style={{ color: check }}>
                      ✓
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* ── Mobile: bottom sheet ── */}
          <div className="fixed inset-0 z-50 sm:hidden">
            <div
              className="absolute inset-0 bg-black/55"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <div
              role="menu"
              className={`absolute inset-x-0 bottom-0 rounded-t-[28px] border-t px-[18px] pb-7 pt-[18px] ${
                dark ? "border-white/10 bg-[#1b1a22] text-white" : "border-line bg-card text-ink"
              }`}
            >
              <div
                className={`mx-auto mb-4 h-[5px] w-[42px] rounded-full ${
                  dark ? "bg-white/25" : "bg-line"
                }`}
                aria-hidden
              />
              <div className="display px-1.5 text-[22px] font-bold">{m.common.language}</div>
              <div
                className={`px-1.5 pb-3.5 pt-0.5 text-[13px] ${
                  dark ? "text-white/60" : "text-muted"
                }`}
              >
                {m.common.languageHint}
              </div>
              {locales.map((locale) => {
                const isActive = locale === active;
                return (
                  <button
                    key={locale}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isActive}
                    onClick={() => choose(locale)}
                    disabled={pending}
                    className={`mb-2 flex w-full items-center gap-3 rounded-[14px] border p-3.5 text-left transition-colors disabled:opacity-60 ${
                      dark
                        ? isActive
                          ? "border-white/16 bg-white/10"
                          : "border-transparent hover:bg-white/5"
                        : isActive
                          ? "border-line bg-accent-soft"
                          : "border-transparent hover:bg-paper"
                    }`}
                  >
                    <span className="text-xl" aria-hidden>
                      {localeFlag[locale]}
                    </span>
                    <span className="flex-1">
                      <span className="block text-[15px] font-bold">{localeLabel[locale]}</span>
                      <span
                        className={`block text-[12px] ${dark ? "text-white/55" : "text-muted"}`}
                      >
                        {localeEnglishLabel[locale]}
                      </span>
                    </span>
                    {isActive ? (
                      <span aria-hidden className="text-lg" style={{ color: check }}>
                        ✓
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

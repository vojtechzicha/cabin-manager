"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { localeLabel, locales } from "@/i18n/config";
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
 */
export function LanguageSwitcher() {
  const { locale: active } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: string) {
    writeLocaleCookie(next);
    startTransition(() => router.refresh());
  }

  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border border-line bg-card p-1"
      role="group"
      aria-label="Language"
    >
      {locales.map((locale) => {
        const isActive = locale === active;
        return (
          <button
            key={locale}
            type="button"
            onClick={() => choose(locale)}
            disabled={pending}
            aria-pressed={isActive}
            className="rounded-full px-3 py-1 text-[13px] font-semibold transition-colors disabled:opacity-60"
            style={
              isActive
                ? { background: "var(--accent)", color: "#fff" }
                : { color: "var(--muted)" }
            }
          >
            {localeLabel[locale]}
          </button>
        );
      })}
    </div>
  );
}

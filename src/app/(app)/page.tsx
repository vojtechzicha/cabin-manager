import Link from "next/link";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getTranslator } from "@/i18n";
import { getRequestLocale } from "@/i18n/server";

// Minimal landing for the bootstrap. Real trip-picker / organizer console
// arrive with Epic 1–2; the design-system gallery lives at /gallery (T-004).
export default async function Home() {
  const locale = await getRequestLocale();
  const { m } = getTranslator(locale);

  return (
    <main className="mx-auto flex min-h-screen max-w-[760px] flex-col justify-center px-6 py-16">
      <div className="mb-8">
        <LanguageSwitcher />
      </div>
      <span className="mono text-[11px] uppercase tracking-[0.14em] text-muted">zicha.travel</span>
      <h1 className="display mt-2 text-5xl font-extrabold leading-[0.96] tracking-tight">
        {m.common.appName}
      </h1>
      <p className="mt-4 max-w-prose text-muted">{m.common.tagline}</p>
      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link
          href="/gallery"
          className="rounded-[14px] bg-accent px-4 py-2.5 font-semibold text-white"
        >
          {m.gallery.title}
        </Link>
        <Link
          href="/admin"
          className="rounded-[14px] border border-line px-4 py-2.5 font-semibold text-ink"
        >
          {m.nav.organizer}
        </Link>
      </div>
    </main>
  );
}

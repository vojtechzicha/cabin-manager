import { redirect } from "next/navigation";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SignInForm } from "@/components/SignInForm";
import { getTranslator } from "@/i18n";
import { getRequestLocale } from "@/i18n/server";

import { getCurrentIdentity } from "../auth/current-user";

/**
 * Sign-in screen (T-201). Already-authenticated visitors are bounced to their
 * `next` target (or home). The page is a thin server shell around the client
 * `SignInForm`; the actual auth happens through the Epic 1 magic-link / OAuth
 * routes.
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

  return (
    <main className="mx-auto flex min-h-screen max-w-[440px] flex-col justify-center px-6 py-16">
      <div className="mb-8 flex items-center justify-between">
        <span className="mono text-[11px] uppercase tracking-[0.14em] text-muted">zicha.travel</span>
        <LanguageSwitcher />
      </div>
      <h1 className="display text-4xl font-extrabold tracking-tight">{m.auth.signIn}</h1>
      <p className="mb-8 mt-2 text-muted">{m.auth.subtitle}</p>
      <SignInForm next={next && next.startsWith("/") ? next : undefined} />
    </main>
  );
}

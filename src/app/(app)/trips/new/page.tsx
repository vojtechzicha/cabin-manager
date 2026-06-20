import Link from "next/link";

import { getTranslator } from "@/i18n";
import { getRequestLocale } from "@/i18n/server";

import { requireIdentity } from "../../auth/current-user";
import { CreateTripForm } from "./CreateTripForm";

/**
 * Create-trip flow (T-201). Thin server shell that authorizes the session and
 * renders the `useActionState` client form (validation + cover upload + theming).
 */
export default async function NewTripPage() {
  await requireIdentity("/trips/new");
  const locale = await getRequestLocale();
  const { m } = getTranslator(locale);

  return (
    <main className="mx-auto w-full max-w-[560px] px-6 py-10">
      <Link href="/" className="mono text-[11px] uppercase tracking-[0.14em] text-muted">
        ‹ {m.console.backToTrips}
      </Link>
      <h1 className="display mt-2 text-4xl font-extrabold tracking-tight">{m.createTrip.title}</h1>
      <p className="mb-8 mt-2 text-muted">{m.createTrip.subtitle}</p>
      <CreateTripForm />
    </main>
  );
}

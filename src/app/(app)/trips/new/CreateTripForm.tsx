"use client";

import { useActionState } from "react";

import { BrandingFields } from "@/components/BrandingFields";
import { Button, Field, Input, SectionLabel } from "@/components/ui";
import { useI18n } from "@/i18n/react";

import { createTripAction } from "../actions";
import type { FormState } from "../form-state";

const TEXTAREA =
  "rounded-btn border border-line bg-card px-3.5 py-2.5 text-sm outline-none focus:border-accent";

/**
 * Create-trip form (T-201) — a `useActionState` client form so validation
 * errors render inline. Submits multipart (the cover photo rides along) to
 * `createTripAction`, which uploads the cover to GridFS, seats the creator as
 * organizer + banker, and redirects into the new trip.
 */
export function CreateTripForm() {
  const { m } = useI18n();
  const [state, action, pending] = useActionState<FormState, FormData>(createTripAction, null);
  const err = (f: string) => {
    const code = state?.fieldErrors?.[f];
    return code ? (m.validation as Record<string, string>)[code] ?? code : null;
  };

  return (
    <form action={action} className="flex flex-col gap-5">
      <Field label={m.createTrip.name} htmlFor="name" hint={m.createTrip.nameHint}>
        <Input id="name" name="name" maxLength={120} aria-invalid={Boolean(err("name"))} />
        {err("name") ? <span className="text-[12px] text-owing">{err("name")}</span> : null}
      </Field>
      <Field label={m.createTrip.shortName} htmlFor="shortName" hint={m.createTrip.shortNameHint}>
        <Input id="shortName" name="shortName" maxLength={24} aria-invalid={Boolean(err("shortName"))} />
        {err("shortName") ? <span className="text-[12px] text-owing">{err("shortName")}</span> : null}
      </Field>
      <Field label={m.createTrip.location} htmlFor="location">
        <Input id="location" name="location" />
      </Field>
      <Field label={m.createTrip.description} htmlFor="description">
        <textarea id="description" name="description" rows={3} className={TEXTAREA} />
      </Field>

      <div className="flex flex-col gap-2">
        <SectionLabel>{m.settings.branding}</SectionLabel>
        <BrandingFields />
      </div>

      {state?.error ? <p className="text-[13px] text-owing">{state.error}</p> : null}
      <Button type="submit" disabled={pending} className="mt-1 self-start">
        {m.createTrip.submit}
      </Button>
    </form>
  );
}

"use client";

import { useActionState } from "react";

import { BrandingFields } from "@/components/BrandingFields";
import { Button, Card, Field, Input, SectionLabel } from "@/components/ui";
import { useI18n } from "@/i18n/react";
import type { Messages } from "@/i18n";

import { saveTripConfigAction } from "../../actions";
import type { FormState } from "../../form-state";

type AreaKey = "voting" | "sleeping" | "transport" | "lists" | "finances" | "deposit";

const AREAS: { key: AreaKey; icon: string; label: (m: Messages) => string; desc: (m: Messages) => string }[] = [
  { key: "voting", icon: "🗳", label: (m) => m.console.areaVoting, desc: (m) => m.console.areaVotingDesc },
  { key: "sleeping", icon: "🛏", label: (m) => m.console.areaSleeping, desc: (m) => m.console.areaSleepingDesc },
  { key: "transport", icon: "🚗", label: (m) => m.console.areaTransport, desc: (m) => m.console.areaTransportDesc },
  { key: "lists", icon: "🎒", label: (m) => m.console.areaLists, desc: (m) => m.console.areaListsDesc },
  { key: "finances", icon: "💸", label: (m) => m.console.areaFinances, desc: (m) => m.console.areaFinancesDesc },
  { key: "deposit", icon: "🔒", label: (m) => m.console.areaDeposit, desc: (m) => m.console.areaDepositDesc },
];

const TEXTAREA =
  "rounded-btn border border-line bg-card px-3.5 py-2.5 text-sm outline-none focus:border-accent";

export interface SettingsInitial {
  name: string;
  shortName: string;
  location: string;
  description: string;
  accent: string | null;
  icon: string | null;
  coverUrl: string | null;
  areas: Record<AreaKey, boolean>;
  depositEnabled: boolean;
}

/** Trip configuration form (T-201): identity, branding, enabled areas, deposit. */
export function SettingsForm({ tripId, initial }: { tripId: string; initial: SettingsInitial }) {
  const { m } = useI18n();
  const [state, action, pending] = useActionState<FormState, FormData>(
    saveTripConfigAction.bind(null, tripId),
    null,
  );
  const err = (f: string) => {
    const code = state?.fieldErrors?.[f];
    return code ? (m.validation as Record<string, string>)[code] ?? code : null;
  };

  return (
    <form action={action} className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <SectionLabel>{m.settings.identity}</SectionLabel>
        <Field label={m.createTrip.name} htmlFor="name">
          <Input id="name" name="name" defaultValue={initial.name} aria-invalid={Boolean(err("name"))} />
          {err("name") ? <span className="text-[12px] text-owing">{err("name")}</span> : null}
        </Field>
        <Field label={m.createTrip.shortName} htmlFor="shortName">
          <Input id="shortName" name="shortName" defaultValue={initial.shortName} maxLength={24} aria-invalid={Boolean(err("shortName"))} />
          {err("shortName") ? <span className="text-[12px] text-owing">{err("shortName")}</span> : null}
        </Field>
        <Field label={m.createTrip.location} htmlFor="location">
          <Input id="location" name="location" defaultValue={initial.location} />
        </Field>
        <Field label={m.createTrip.description} htmlFor="description">
          <textarea id="description" name="description" rows={3} defaultValue={initial.description} className={TEXTAREA} />
        </Field>
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionLabel>{m.settings.branding}</SectionLabel>
        <BrandingFields
          initialAccent={initial.accent}
          initialIcon={initial.icon}
          initialCoverUrl={initial.coverUrl}
        />
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionLabel>{m.console.areasLabel}</SectionLabel>
        <div className="grid gap-2 sm:grid-cols-2">
          {AREAS.map((a) => (
            <label
              key={a.key}
              className="flex cursor-pointer items-start gap-3 rounded-btn border border-line bg-card p-3"
            >
              <input
                type="checkbox"
                name={a.key}
                defaultChecked={initial.areas[a.key]}
                className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <span>{a.icon}</span>
                  {a.label(m)}
                </span>
                <span className="mt-0.5 block text-[12px] text-muted">{a.desc(m)}</span>
              </span>
            </label>
          ))}
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {m.info.save}
        </Button>
        {state?.ok ? <span className="text-[13px] font-semibold text-settled">✓ {m.settings.saved}</span> : null}
      </div>
    </form>
  );
}

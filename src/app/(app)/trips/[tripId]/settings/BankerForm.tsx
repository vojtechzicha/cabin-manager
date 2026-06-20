"use client";

import { useActionState } from "react";

import { Button, Field, Input } from "@/components/ui";
import { useI18n } from "@/i18n/react";

import { setBankerAction } from "../../actions";
import type { FormState } from "../../form-state";

export interface BankerMember {
  id: string;
  name: string;
}

/**
 * Banker configuration (T-201/T-503): pick which member holds the money, enter
 * their Czech account, and the action auto-computes + validates the IBAN
 * server-side (the app layer can't run the pure `payments` code directly). The
 * computed IBAN comes back in the action's `message` for immediate confirmation.
 */
export function BankerForm({
  tripId,
  members,
  initial,
}: {
  tripId: string;
  members: BankerMember[];
  initial: { bankerId: string | null; account: string | null; iban: string | null };
}) {
  const { m } = useI18n();
  const [state, action, pending] = useActionState<FormState, FormData>(
    setBankerAction.bind(null, tripId),
    null,
  );
  const err = (f: string) => {
    const code = state?.fieldErrors?.[f];
    return code ? (m.validation as Record<string, string>)[code] ?? code : null;
  };

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label={m.settings.bankerMember} htmlFor="banker" hint={m.settings.bankerHint}>
        <select
          id="banker"
          name="banker"
          defaultValue={initial.bankerId ?? ""}
          className="min-h-11 rounded-btn border border-line bg-card px-3.5 text-sm outline-none focus:border-accent"
        >
          {members.map((mem) => (
            <option key={mem.id} value={mem.id}>
              {mem.name}
            </option>
          ))}
        </select>
        {err("banker") ? <span className="text-[12px] text-owing">{err("banker")}</span> : null}
      </Field>

      <Field label={m.settings.czechAccount} htmlFor="bankAccount" hint={m.settings.accountHint}>
        <Input
          id="bankAccount"
          name="bankAccount"
          defaultValue={initial.account ?? ""}
          placeholder="19-2000145399/0800"
          aria-invalid={Boolean(err("bankAccount"))}
        />
        {err("bankAccount") ? (
          <span className="text-[12px] text-owing">{err("bankAccount")}</span>
        ) : null}
      </Field>

      <Field label={m.settings.iban} htmlFor="iban" hint={m.settings.ibanComputed}>
        <Input
          id="iban"
          name="iban"
          defaultValue={initial.iban ?? ""}
          placeholder="CZ65 0800 0000 1920 0014 5399"
          aria-invalid={Boolean(err("iban"))}
        />
        {err("iban") ? <span className="text-[12px] text-owing">{err("iban")}</span> : null}
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {m.settings.saveBanker}
        </Button>
        {state?.ok ? (
          <span className="text-[13px] font-semibold text-settled">
            ✓ {m.settings.saved}
            {state.message ? <span className="mono ml-2 text-muted">{state.message}</span> : null}
          </span>
        ) : null}
      </div>
    </form>
  );
}

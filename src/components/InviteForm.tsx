"use client";

import { useActionState } from "react";

import { Button, Field, Input } from "@/components/ui";
import { useI18n } from "@/i18n/react";

type InviteState = { url?: string; error?: string } | null;
type InviteAction = (prev: InviteState, formData: FormData) => Promise<InviteState>;

/**
 * Direct-invite form (T-104/T-201). Submits to a bound `createInviteAction`
 * Server Action via `useActionState`, then shows the freshly-minted invite URL
 * so the organizer can copy or share it (delivery also emails it — T-105).
 */
export function InviteForm({ action }: { action: InviteAction }) {
  const { m } = useI18n();
  const [state, formAction, pending] = useActionState<InviteState, FormData>(action, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Field label={m.people.inviteEmail} htmlFor="invite-email">
        <Input id="invite-email" name="email" type="email" required placeholder="you@example.com" />
      </Field>
      <Field label={m.people.inviteName} htmlFor="invite-name">
        <Input id="invite-name" name="name" />
      </Field>
      <Button type="submit" disabled={pending} className="self-start">
        {m.people.sendInvite}
      </Button>

      {state?.error ? <p className="text-[13px] text-owing">{state.error}</p> : null}
      {state?.url ? (
        <div className="rounded-btn border border-line bg-paper p-3">
          <div className="mono text-[10px] uppercase tracking-[0.12em] text-muted">
            {m.people.inviteCreated}
          </div>
          <div className="mono mt-1 break-all text-[12px] text-accent-ink">{state.url}</div>
        </div>
      ) : null}
    </form>
  );
}

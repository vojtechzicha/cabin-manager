"use client";

import { useActionState, useState } from "react";

import { Button, Field, Input } from "@/components/ui";
import type { Messages } from "@/i18n";
import { useI18n } from "@/i18n/react";
import type { ShareIntent } from "@/lib/share-intents";

// Structural mirror of the action's `InviteState` (kept here so this leaf
// component doesn't import from the `app` layer — architecture boundary).
type InviteState = { url?: string; shareIntents?: ShareIntent[]; error?: string } | null;
type InviteAction = (prev: InviteState, formData: FormData) => Promise<NonNullable<InviteState>>;
type Target = "email" | "phone" | "handle" | "name";

/**
 * Direct-invite form (T-104/T-201, PRD §5). Invite by email, phone, Telegram
 * handle, or name; on success it shows the invite URL plus **share intents** the
 * organizer can tap to send over any channel (email is also delivered server-side).
 */
export function InviteForm({ action }: { action: InviteAction }) {
  const { m } = useI18n();
  const [state, formAction, pending] = useActionState<NonNullable<InviteState>, FormData>(action, {});
  const [target, setTarget] = useState<Target>("email");

  const targetLabel: Record<Target, string> = {
    email: m.people.targetEmail,
    phone: m.people.targetPhone,
    handle: m.people.targetHandle,
    name: m.people.targetName,
  };
  const placeholder =
    target === "email" ? "you@example.com" : target === "phone" ? "+420 …" : target === "handle" ? "@handle" : m.people.targetName;
  const errorText =
    state.error === "value_required"
      ? m.people.errValueRequired
      : state.error === "create_failed"
        ? m.people.errCreateFailed
        : state.error;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="targetType" value={target} />
      <Field label={m.people.inviteVia}>
        <div className="flex flex-wrap gap-1.5 rounded-[13px] bg-paper p-1">
          {(["email", "phone", "handle", "name"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTarget(t)}
              className={`rounded-[10px] px-3 py-1.5 text-[13px] transition-colors ${
                t === target ? "bg-card font-bold text-accent-ink shadow-[0_2px_6px_-3px_rgba(20,30,25,.3)]" : "font-semibold text-sand"
              }`}
            >
              {targetLabel[t]}
            </button>
          ))}
        </div>
      </Field>

      <Field label={m.people.inviteValue} htmlFor="invite-value">
        <Input
          id="invite-value"
          name="targetValue"
          type={target === "email" ? "email" : "text"}
          required
          placeholder={placeholder}
        />
      </Field>
      {target !== "name" ? (
        <Field label={m.people.inviteName} htmlFor="invite-name">
          <Input id="invite-name" name="name" />
        </Field>
      ) : null}

      <Button type="submit" disabled={pending} className="self-start">
        {m.people.sendInvite}
      </Button>

      {errorText ? <p className="text-[13px] text-owing">{errorText}</p> : null}
      {state.url ? (
        <div className="rounded-btn border border-line bg-paper p-3">
          <div className="mono text-[10px] uppercase tracking-[0.12em] text-muted">{m.people.inviteCreated}</div>
          <div className="mono mt-1 break-all text-[12px] text-accent-ink">{state.url}</div>
          {state.shareIntents && state.shareIntents.length > 0 ? (
            <ShareRow intents={state.shareIntents} m={m} />
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

function ShareRow({ intents, m }: { intents: ShareIntent[]; m: Messages }) {
  const [copied, setCopied] = useState(false);
  const cls = "rounded-full border border-line bg-card px-3 py-1.5 text-[12px] font-semibold";
  const label = (c: ShareIntent["channel"]) =>
    c === "whatsapp"
      ? m.people.shareWhatsapp
      : c === "telegram"
        ? m.people.shareTelegram
        : c === "email"
          ? m.people.shareEmail
          : c === "copy"
            ? copied
              ? m.people.copied
              : m.people.copy
            : m.people.shareNative;

  return (
    <div className="mt-3">
      <div className="mono mb-1.5 text-[10px] uppercase tracking-[0.12em] text-muted">{m.people.shareVia}</div>
      <div className="flex flex-wrap gap-1.5">
        {intents.map((it) => {
          if (it.href) {
            return (
              <a key={it.channel} href={it.href} target="_blank" rel="noreferrer" className={cls}>
                {label(it.channel)}
              </a>
            );
          }
          if (it.channel === "copy") {
            return (
              <button
                key="copy"
                type="button"
                className={cls}
                onClick={async () => {
                  if (it.share) {
                    await navigator.clipboard.writeText(it.share.text);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }
                }}
              >
                {label("copy")}
              </button>
            );
          }
          return (
            <button
              key="native"
              type="button"
              className={cls}
              onClick={() => {
                if (it.share && typeof navigator !== "undefined" && navigator.share) {
                  void navigator.share(it.share).catch(() => undefined);
                }
              }}
            >
              {label("native")}
            </button>
          );
        })}
      </div>
    </div>
  );
}

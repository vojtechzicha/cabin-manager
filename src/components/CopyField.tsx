"use client";

import { useState } from "react";

import { useI18n } from "@/i18n/react";

/**
 * A read-only value (e.g. the open-join link) with a one-tap copy button.
 * Used wherever the organizer needs to grab a shareable URL (T-104/T-201).
 */
export function CopyField({ value }: { value: string }) {
  const { m } = useI18n();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context / permissions) — the value is still
      // visible for manual selection, so fail silently.
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-btn border border-line bg-paper p-2">
      <span className="mono min-w-0 flex-1 truncate text-[12px] text-accent-ink" title={value}>
        {value}
      </span>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-[10px] bg-accent px-3 py-1.5 text-[13px] font-semibold text-white"
      >
        {copied ? m.people.copied : m.people.copy}
      </button>
    </div>
  );
}

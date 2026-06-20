"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Locale } from "./config";
import { getFormatters } from "./format";
import type { Messages } from "./messages/cs";
import { interpolate, type MessageParams, type MessageSelector } from "./translator";

type I18nValue = { locale: Locale; messages: Messages };

const I18nContext = createContext<I18nValue | null>(null);

/**
 * Provides the resolved locale + catalog to client components. The server
 * layout resolves the locale once and passes the matching catalog down.
 */
export function I18nProvider({
  locale,
  messages,
  children,
}: I18nValue & { children: ReactNode }) {
  return <I18nContext.Provider value={{ locale, messages }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within an <I18nProvider>");
  }
  const { locale, messages } = ctx;
  return {
    locale,
    m: messages,
    t: (select: MessageSelector, params?: MessageParams) =>
      interpolate(select(messages), params, locale),
    format: getFormatters(locale),
  };
}

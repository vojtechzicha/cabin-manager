import type { Locale } from "./config";
import { cs, type Messages } from "./messages/cs";
import { en } from "./messages/en";

const catalogs: Record<Locale, Messages> = { cs, en };

export type MessageParams = Record<string, string | number>;

/** Replace `{token}` placeholders; unknown tokens are left intact. */
export function interpolate(template: string, params: MessageParams = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

export function getMessages(locale: Locale): Messages {
  return catalogs[locale];
}

/** A message selector points at one string in the catalog (type-checked). */
export type MessageSelector = (messages: Messages) => string;

/**
 * Build a translator bound to a locale. `m` is the typed catalog for direct
 * access in chrome; `t` resolves a selector and interpolates params.
 */
export function getTranslator(locale: Locale) {
  const messages = getMessages(locale);
  return {
    locale,
    m: messages,
    t: (select: MessageSelector, params?: MessageParams) =>
      interpolate(select(messages), params),
  };
}

export type Translator = ReturnType<typeof getTranslator>;

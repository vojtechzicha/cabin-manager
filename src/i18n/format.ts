import { localeTag, type Locale } from "./config";

/** CZK is the default trip currency (PRD §6). */
export const DEFAULT_CURRENCY = "CZK";

/**
 * Locale-aware formatters for dates, times, numbers, and currency. Czech
 * banking/QR is locale-independent and lives in `payments/`; this is purely for
 * display chrome.
 */
export function getFormatters(locale: Locale, currency: string = DEFAULT_CURRENCY) {
  const tag = localeTag[locale];
  return {
    number: (value: number) => new Intl.NumberFormat(tag).format(value),
    currency: (value: number) =>
      new Intl.NumberFormat(tag, { style: "currency", currency }).format(value),
    date: (value: Date) => new Intl.DateTimeFormat(tag, { dateStyle: "medium" }).format(value),
    time: (value: Date) => new Intl.DateTimeFormat(tag, { timeStyle: "short" }).format(value),
    dateTime: (value: Date) =>
      new Intl.DateTimeFormat(tag, { dateStyle: "medium", timeStyle: "short" }).format(value),
  };
}

export type Formatters = ReturnType<typeof getFormatters>;

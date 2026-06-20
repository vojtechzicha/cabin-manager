import { localeTag, type Locale } from "./config";
import { cs, type Messages } from "./messages/cs";
import { en } from "./messages/en";

const catalogs: Record<Locale, Messages> = { cs, en };

export type MessageParams = Record<string, string | number>;

// Cache one PluralRules per locale (constructing them is comparatively costly).
const pluralRules = new Map<string, Intl.PluralRules>();
function rulesFor(locale: string): Intl.PluralRules {
  let r = pluralRules.get(locale);
  if (!r) {
    r = new Intl.PluralRules(localeTag[locale as Locale] ?? locale);
    pluralRules.set(locale, r);
  }
  return r;
}

// One ICU-style plural block: `{count, plural, one {…} few {…} other {…}}`.
// Forms select on the named count param via the locale's CLDR plural category
// (Czech: one=1, few=2–4, other=0/5+; English: one=1, other=else); `#` prints
// the number. Keeping the number outside the forms (a separate `{count}` token)
// is also fine — forms here contain no nested braces.
const PLURAL_RE = /\{(\w+),\s*plural,\s*((?:[^{}]|\{[^{}]*\})*)\}/g;
const FORM_RE = /(\w+)\s*\{([^{}]*)\}/g;

/**
 * Resolve a message template: first any ICU plural blocks (grammatically correct
 * per `locale`), then simple `{token}` placeholders. Unknown tokens are left
 * intact. Defaults to an English-style one/other rule when no locale is given.
 */
export function interpolate(
  template: string,
  params: MessageParams = {},
  locale?: string,
): string {
  const select = (n: number): Intl.LDMLPluralRule =>
    locale ? rulesFor(locale).select(n) : n === 1 ? "one" : "other";

  const withPlurals = template.replace(PLURAL_RE, (_match, key: string, body: string) => {
    const n = Number(params[key] ?? 0);
    const forms: Record<string, string> = {};
    for (const f of body.matchAll(FORM_RE)) {
      const cat = f[1];
      if (cat) forms[cat] = f[2] ?? "";
    }
    const chosen = forms[select(n)] ?? forms.other ?? Object.values(forms)[0] ?? "";
    return chosen.replace(/#/g, String(n));
  });

  return withPlurals.replace(/\{(\w+)\}/g, (match, key: string) =>
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
      interpolate(select(messages), params, locale),
  };
}

export type Translator = ReturnType<typeof getTranslator>;

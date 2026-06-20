/**
 * Czech message catalog — the source of truth for the message shape. Every
 * other locale's catalog is typed as `Messages`, so a missing or misspelled key
 * fails typecheck (CS/EN parity is enforced by the compiler).
 *
 * `{placeholder}` tokens are interpolated by the translator.
 */
export const cs = {
  common: {
    appName: "Chata",
    tagline: "Celý život skupinového výletu — v jedné aplikaci.",
    language: "Jazyk",
  },
  nav: {
    dashboard: "Přehled",
    plan: "Plánování",
    stay: "Nocleh",
    money: "Finance",
    info: "Info",
    organizer: "Organizátor",
  },
  status: {
    settled: "Vyrovnáno",
    owing: "Dluží",
    confirmed: "Potvrzeno",
    provisional: "Předběžně",
    due: "K úhradě",
  },
  reminders: {
    depositDue:
      "Ahoj {name}, na výlet „{trip}“ prosím uhraď zálohu {amount} do {date}.",
    offerRide: "Ahoj {name}, nabídni nebo si zajisti odvoz na výlet „{trip}“.",
    payUp: "Ahoj {name}, na výletu „{trip}“ ti zbývá doplatit {amount}.",
  },
  gallery: {
    title: "Designový systém",
    subtitle: "Komponenty, stavy a barvy sdílené napříč aplikací.",
  },
} as const;

export type Messages = {
  [Group in keyof typeof cs]: {
    [Key in keyof (typeof cs)[Group]]: string;
  };
};

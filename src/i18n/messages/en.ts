import type { Messages } from "./cs";

/**
 * English message catalog. Typed as `Messages`, so it must mirror the Czech
 * catalog's keys exactly — the compiler rejects drift in either direction.
 */
export const en: Messages = {
  common: {
    appName: "Chata",
    tagline: "The whole life of a group trip — in one app.",
    language: "Language",
  },
  nav: {
    dashboard: "Dashboard",
    plan: "Planning",
    stay: "Sleeping",
    money: "Finances",
    info: "Info",
    organizer: "Organizer",
  },
  status: {
    settled: "Settled",
    owing: "Owing",
    confirmed: "Confirmed",
    provisional: "Provisional",
    due: "Due",
  },
  reminders: {
    depositDue: "Hi {name}, please pay the {amount} deposit for “{trip}” by {date}.",
    offerRide: "Hi {name}, offer or claim a ride for “{trip}”.",
    payUp: "Hi {name}, you still owe {amount} on “{trip}”.",
  },
  invite: {
    subject: "You're invited to “{trip}”",
    body: "Hi {name}, {organizer} invited you to “{trip}”. Join with this link:",
    shareText: "Come join us on “{trip}”! Join here:",
  },
  magicLink: {
    subject: "Sign in to Chata",
    body: "Hi, sign in to Chata with this link. It's valid for {minutes} minutes:",
  },
  gallery: {
    title: "Design system",
    subtitle: "Components, states, and colors shared across the app.",
  },
};

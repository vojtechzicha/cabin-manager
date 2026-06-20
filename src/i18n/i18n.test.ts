import { describe, expect, it } from "vitest";

import { getFormatters } from "./format";
import { parseAcceptLanguage, resolveLocale } from "./resolve";
import { renderSystemMessage } from "./system-messages";
import { getTranslator } from "./translator";

describe("locale resolution (user pref → header → default)", () => {
  it("prefers an explicit valid user preference over everything", () => {
    expect(resolveLocale({ userPreference: "en", acceptLanguage: "cs-CZ" })).toBe("en");
  });

  it("falls back to Accept-Language when no user preference", () => {
    expect(resolveLocale({ acceptLanguage: "en-US,en;q=0.9" })).toBe("en");
  });

  it("honors q-weights in Accept-Language", () => {
    expect(parseAcceptLanguage("de;q=0.2, en;q=0.4, cs;q=0.9")).toBe("cs");
  });

  it("ignores an unsupported user preference and uses the next source", () => {
    expect(resolveLocale({ userPreference: "de", acceptLanguage: "en" })).toBe("en");
  });

  it("defaults to Czech when nothing matches", () => {
    expect(resolveLocale({ acceptLanguage: "de,fr;q=0.5" })).toBe("cs");
    expect(resolveLocale({})).toBe("cs");
  });
});

describe("translator switches all chrome by locale", () => {
  it("returns Czech vs English for the same selector", () => {
    const cs = getTranslator("cs");
    const en = getTranslator("en");
    expect(cs.t((m) => m.nav.money)).toBe("Finance");
    expect(en.t((m) => m.nav.money)).toBe("Finances");
    expect(cs.m.status.settled).toBe("Vyrovnáno");
    expect(en.m.status.settled).toBe("Settled");
  });

  it("interpolates parameters", () => {
    const en = getTranslator("en");
    expect(en.t((m) => m.reminders.payUp, { name: "Jana", trip: "Cabin", amount: "400 Kč" })).toBe(
      "Hi Jana, you still owe 400 Kč on “Cabin”.",
    );
  });

  it("applies correct Czech plural forms (1 / 2–4 / 0,5+)", () => {
    const cs = getTranslator("cs");
    const votes = (n: number) => cs.t((m) => m.voting.votesCount, { count: n });
    expect(votes(0)).toBe("0 hlasů");
    expect(votes(1)).toBe("1 hlas");
    expect(votes(2)).toBe("2 hlasy");
    expect(votes(4)).toBe("4 hlasy");
    expect(votes(5)).toBe("5 hlasů");
    expect(votes(11)).toBe("11 hlasů");
  });

  it("applies English one/other plural forms", () => {
    const en = getTranslator("en");
    const votes = (n: number) => en.t((m) => m.voting.votesCount, { count: n });
    expect(votes(1)).toBe("1 vote");
    expect(votes(0)).toBe("0 votes");
    expect(votes(3)).toBe("3 votes");
  });
});

describe("system messages render in the recipient's language", () => {
  it("renders Czech to a CS recipient even when triggered in an EN context", () => {
    // Simulate an English-speaking organizer firing a reminder at a Czech participant.
    const senderUiLocale = "en"; // intentionally unused by the renderer
    void senderUiLocale;
    const message = renderSystemMessage("cs", (m) => m.reminders.depositDue, {
      name: "Petr",
      trip: "Letní chata",
      amount: "1 500 Kč",
      date: "12. 7.",
    });
    expect(message).toBe(
      "Ahoj Petr, na výlet „Letní chata“ prosím uhraď zálohu 1 500 Kč do 12. 7..",
    );
    expect(message).not.toContain("Hi ");
  });
});

describe("locale-aware formatting (CZK default)", () => {
  it("formats currency per locale", () => {
    const cs = getFormatters("cs").currency(1500);
    const en = getFormatters("en").currency(1500);
    // Both render CZK, but grouping/symbol placement differ by locale.
    expect(cs).toMatch(/Kč/);
    expect(cs.replace(/\s| | /g, "")).toContain("1500");
    expect(en).toMatch(/CZK|Kč/);
  });

  it("formats dates per locale", () => {
    const date = new Date(Date.UTC(2026, 6, 12, 9, 30));
    const cs = getFormatters("cs").date(date);
    const en = getFormatters("en").date(date);
    expect(cs).not.toBe(en);
    expect(cs).toMatch(/2026/);
    expect(en).toMatch(/2026/);
  });
});

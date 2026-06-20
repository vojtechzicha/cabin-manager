import { describe, expect, it } from "vitest";

import {
  czAccountToIban,
  ibanToCzAccount,
  isValidCzAccount,
  isValidIban,
  parseCzAccount,
} from "./iban";

// Canonical worked example from the Czech IBAN spec.
const ACCOUNT = "19-2000145399/0800";
const IBAN = "CZ6508000000192000145399";

describe("parseCzAccount", () => {
  it("splits prefix / number / bank", () => {
    expect(parseCzAccount(ACCOUNT)).toEqual({ prefix: "19", number: "2000145399", bank: "0800" });
  });
  it("handles a prefix-less account", () => {
    expect(parseCzAccount("123456789/0100")).toEqual({
      prefix: "",
      number: "123456789",
      bank: "0100",
    });
  });
  it("rejects malformed input", () => {
    for (const bad of ["", "abc", "123/01", "12345/12345", "/0800", "19-2000145399"]) {
      expect(parseCzAccount(bad)).toBeNull();
    }
  });
});

describe("czAccountToIban", () => {
  it("matches the canonical example", () => {
    expect(czAccountToIban(ACCOUNT)).toBe(IBAN);
  });
  it("zero-pads prefix and number into the 24-char IBAN", () => {
    const iban = czAccountToIban("123456789/0100");
    expect(iban).toMatch(/^CZ\d{22}$/);
    expect(iban).not.toBeNull();
    expect(isValidIban(iban!)).toBe(true);
  });
  it("returns null on malformed input", () => {
    expect(czAccountToIban("nonsense")).toBeNull();
  });
});

describe("ibanToCzAccount", () => {
  it("inverts the canonical example", () => {
    expect(ibanToCzAccount(IBAN)).toBe(ACCOUNT);
  });
  it("accepts spaced / lowercased IBAN input", () => {
    expect(ibanToCzAccount("cz65 0800 0000 1920 0014 5399")).toBe(ACCOUNT);
  });
  it("drops a zero prefix", () => {
    expect(ibanToCzAccount(czAccountToIban("123456789/0100")!)).toBe("123456789/0100");
  });
  it("rejects a non-Czech or invalid IBAN", () => {
    expect(ibanToCzAccount("DE89370400440532013000")).toBeNull();
    expect(ibanToCzAccount("CZ6508000000192000145390")).toBeNull(); // tampered
  });
});

describe("account ⇄ IBAN round-trip", () => {
  const accounts = ["19-2000145399/0800", "123456789/0100", "35-1234567890/0300", "12/0710"];
  for (const acct of accounts) {
    it(acct, () => {
      const iban = czAccountToIban(acct);
      expect(iban).not.toBeNull();
      expect(ibanToCzAccount(iban!)).toBe(acct);
    });
  }
});

describe("isValidCzAccount (mod-11 weighted checksum)", () => {
  it("accepts checksum-valid accounts", () => {
    expect(isValidCzAccount(ACCOUNT)).toBe(true);
    expect(isValidCzAccount("2000145399/0800")).toBe(true);
  });
  it("rejects a number that fails the weighted checksum", () => {
    expect(isValidCzAccount("2000145398/0800")).toBe(false);
  });
  it("rejects a prefix that fails the weighted checksum", () => {
    expect(isValidCzAccount("18-2000145399/0800")).toBe(false);
  });
  it("rejects malformed accounts", () => {
    expect(isValidCzAccount("12345")).toBe(false);
  });
});

describe("isValidIban (mod-97)", () => {
  it("accepts valid Czech and foreign IBANs", () => {
    expect(isValidIban(IBAN)).toBe(true);
    expect(isValidIban("CZ65 0800 0000 1920 0014 5399")).toBe(true);
    expect(isValidIban("DE89370400440532013000")).toBe(true);
  });
  it("rejects a tampered check digit", () => {
    expect(isValidIban("CZ6608000000192000145399")).toBe(false);
  });
  it("rejects a CZ IBAN of the wrong length", () => {
    expect(isValidIban("CZ650800000019200014539")).toBe(false);
  });
});

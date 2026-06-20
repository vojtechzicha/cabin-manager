import { describe, expect, it } from "vitest";

import {
  expiryFromNow,
  generateToken,
  hashToken,
  isExpired,
  tokensMatch,
} from "./tokens";

describe("token primitives (T-103)", () => {
  it("mints a raw token whose hash matches hashToken(raw)", () => {
    const { raw, hash } = generateToken();
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/); // base64url
    expect(raw.length).toBeGreaterThanOrEqual(40);
    expect(hash).toBe(hashToken(raw));
    expect(hash).toHaveLength(64); // sha-256 hex
  });

  it("never repeats a token (high entropy)", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateToken().raw));
    expect(tokens.size).toBe(100);
  });

  it("matches equal hashes and rejects different ones in constant time", () => {
    const a = hashToken("alpha");
    const b = hashToken("beta");
    expect(tokensMatch(a, a)).toBe(true);
    expect(tokensMatch(a, b)).toBe(false);
  });

  it("rejects empty or malformed hashes", () => {
    expect(tokensMatch("", "")).toBe(false);
    expect(tokensMatch("ab", "abcd")).toBe(false);
  });
});

describe("expiry helpers", () => {
  const now = new Date("2026-06-20T12:00:00.000Z");

  it("treats past expiries as expired and future ones as valid", () => {
    expect(isExpired(new Date("2026-06-20T11:59:59.000Z"), now)).toBe(true);
    expect(isExpired(new Date("2026-06-20T12:00:01.000Z"), now)).toBe(false);
  });

  it("treats the exact instant as expired (boundary is inclusive)", () => {
    expect(isExpired(now, now)).toBe(true);
  });

  it("parses ISO string expiries", () => {
    expect(isExpired("2026-06-20T11:00:00.000Z", now)).toBe(true);
  });

  it("computes a future expiry from a ttl", () => {
    expect(expiryFromNow(60_000, now).toISOString()).toBe("2026-06-20T12:01:00.000Z");
  });
});

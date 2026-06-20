import { describe, expect, it } from "vitest";

import { parseEnv } from "./env";

const valid = {
  DATABASE_URI: "mongodb://localhost:27018/chata?replicaSet=rs0",
  PAYLOAD_SECRET: "a-sufficiently-long-secret",
  APP_URL: "https://chata.example",
};

describe("parseEnv", () => {
  it("accepts a valid environment and freezes the result", () => {
    const env = parseEnv({ ...valid });
    expect(env.DATABASE_URI).toBe(valid.DATABASE_URI);
    expect(env.APP_URL).toBe("https://chata.example");
    expect(Object.isFrozen(env)).toBe(true);
  });

  it("defaults APP_URL and NODE_ENV when unset", () => {
    const env = parseEnv({ DATABASE_URI: valid.DATABASE_URI, PAYLOAD_SECRET: valid.PAYLOAD_SECRET });
    expect(env.APP_URL).toBe("http://localhost:3000");
    expect(env.NODE_ENV).toBe("development");
  });

  it("rejects a missing DATABASE_URI", () => {
    expect(() => parseEnv({ PAYLOAD_SECRET: valid.PAYLOAD_SECRET })).toThrow(/DATABASE_URI/);
  });

  it("rejects a non-mongodb DATABASE_URI", () => {
    expect(() => parseEnv({ ...valid, DATABASE_URI: "postgres://x" })).toThrow(/mongodb/);
  });

  it("rejects a too-short PAYLOAD_SECRET", () => {
    expect(() => parseEnv({ ...valid, PAYLOAD_SECRET: "short" })).toThrow(/at least 16/);
  });

  it("reports every problem at once", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URI[\s\S]*PAYLOAD_SECRET/);
  });
});

/**
 * Environment schema + validation.
 *
 * Centralizes every environment variable the app reads, validates them once at
 * import time, and exposes a typed, frozen object. A missing or malformed
 * required variable fails fast with a clear message instead of surfacing as an
 * obscure runtime error deep inside Payload or Mongo.
 *
 * This module is intentionally dependency-free so it can be imported from the
 * Payload config, Next runtime, scripts, and tests alike.
 */

type NodeEnv = "development" | "production" | "test";

export interface Env {
  readonly NODE_ENV: NodeEnv;
  /** MongoDB connection string. Must point at a replica set for transactions. */
  readonly DATABASE_URI: string;
  /** Secret used by Payload to sign/encrypt tokens and seeds. */
  readonly PAYLOAD_SECRET: string;
  /** Public origin used when building absolute URLs (invites, magic links). */
  readonly APP_URL: string;
  /**
   * OAuth provider credentials (T-102). Optional: a provider is only offered
   * when both its id and secret are present, so local dev and tests run without
   * any OAuth setup.
   */
  readonly GOOGLE_CLIENT_ID?: string;
  readonly GOOGLE_CLIENT_SECRET?: string;
  readonly MICROSOFT_CLIENT_ID?: string;
  readonly MICROSOFT_CLIENT_SECRET?: string;
}

class EnvError extends Error {
  constructor(problems: string[]) {
    super(
      `Invalid environment configuration:\n` +
        problems.map((p) => `  - ${p}`).join("\n") +
        `\n\nCopy .env.example to .env and fill in the required values.`,
    );
    this.name = "EnvError";
  }
}

type EnvSource = Record<string, string | undefined>;

function required(source: EnvSource, key: keyof Env, problems: string[]): string {
  const value = source[key];
  if (value === undefined || value.trim() === "") {
    problems.push(`${key} is required but was not set`);
    return "";
  }
  return value;
}

export function parseEnv(source: EnvSource = process.env): Env {
  const problems: string[] = [];

  const nodeEnvRaw = source.NODE_ENV ?? "development";
  const NODE_ENV: NodeEnv =
    nodeEnvRaw === "production" || nodeEnvRaw === "test" ? nodeEnvRaw : "development";

  const DATABASE_URI = required(source, "DATABASE_URI", problems);
  if (DATABASE_URI && !/^mongodb(\+srv)?:\/\//.test(DATABASE_URI)) {
    problems.push(`DATABASE_URI must be a mongodb:// or mongodb+srv:// connection string`);
  }

  const PAYLOAD_SECRET = required(source, "PAYLOAD_SECRET", problems);
  if (PAYLOAD_SECRET && PAYLOAD_SECRET.length < 16) {
    problems.push(`PAYLOAD_SECRET must be at least 16 characters`);
  }

  const APP_URL = source.APP_URL?.trim() || "http://localhost:3000";

  const optional = (key: string): string | undefined => {
    const v = source[key]?.trim();
    return v ? v : undefined;
  };

  if (problems.length > 0) {
    throw new EnvError(problems);
  }

  return Object.freeze({
    NODE_ENV,
    DATABASE_URI,
    PAYLOAD_SECRET,
    APP_URL,
    GOOGLE_CLIENT_ID: optional("GOOGLE_CLIENT_ID"),
    GOOGLE_CLIENT_SECRET: optional("GOOGLE_CLIENT_SECRET"),
    MICROSOFT_CLIENT_ID: optional("MICROSOFT_CLIENT_ID"),
    MICROSOFT_CLIENT_SECRET: optional("MICROSOFT_CLIENT_SECRET"),
  });
}

let cached: Env | undefined;

/**
 * Lazily parse and memoize the process environment. Lazy (not a module-level
 * constant) so importing this module — e.g. to unit-test `parseEnv` — never
 * triggers validation against an unconfigured environment.
 */
export function getEnv(): Env {
  return (cached ??= parseEnv());
}

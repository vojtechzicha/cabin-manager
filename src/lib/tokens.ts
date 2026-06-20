/**
 * Pure token primitives for magic links and invitations (build.md T-103).
 *
 * The token *is* the auth (PRD §4): a high-entropy random string handed to the
 * user. We never store the raw token — only its SHA-256 hash — so a database
 * read cannot reveal a usable credential. Verification hashes the presented
 * token and compares in constant time.
 *
 * This is a `lib` leaf (no app layers, no framework): it uses only Node's
 * `crypto`, so it is trivially unit-testable.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Raw token entropy in bytes (256 bits → 43-char base64url). */
const TOKEN_BYTES = 32;

export interface GeneratedToken {
  /** The secret to deliver to the user. Never persisted. */
  raw: string;
  /** SHA-256 hex of `raw`. Safe to store and index. */
  hash: string;
}

/** Mint a new single-use token: a random secret plus its storable hash. */
export function generateToken(): GeneratedToken {
  const raw = randomBytes(TOKEN_BYTES).toString("base64url");
  return { raw, hash: hashToken(raw) };
}

/** SHA-256 hex digest of a raw token. Deterministic; used for lookup + compare. */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Constant-time comparison of two token hashes (hex strings of equal length). */
export function tokensMatch(aHash: string, bHash: string): boolean {
  const a = Buffer.from(aHash, "hex");
  const b = Buffer.from(bHash, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

/** True once `expiresAt` is in the past relative to `now` (default: real now). */
export function isExpired(expiresAt: Date | string, now: Date = new Date()): boolean {
  const exp = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  return exp.getTime() <= now.getTime();
}

/** A future expiry `ttlMs` from `now`. */
export function expiryFromNow(ttlMs: number, now: Date = new Date()): Date {
  return new Date(now.getTime() + ttlMs);
}

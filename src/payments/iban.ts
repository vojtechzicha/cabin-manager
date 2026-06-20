/**
 * Czech bank account ↔ IBAN conversion and validation (build.md T-503, PRD
 * §8.5.4). PURE — no Payload/Next/Mongo/React (enforced by boundaries). The
 * organizer enters an account in the familiar `[prefix-]number/bank` form and we
 * derive the IBAN the QR-payment code needs, validating both ends.
 *
 * Czech IBAN layout (24 chars): `CZ` + 2 check digits + 4-digit bank code +
 * 6-digit account prefix + 10-digit account number (prefix/number zero-padded).
 * Check digits are the ISO 7064 mod-97-10 of the rearranged string.
 */

/** A Czech domestic account number, split into its three parts. */
export interface CzAccount {
  /** Optional account prefix (0–6 digits). */
  prefix: string;
  /** Account number (2–10 digits). */
  number: string;
  /** 4-digit bank (clearing) code. */
  bank: string;
}

const ACCOUNT_RE = /^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/;

/**
 * Per-digit weights (right→left) for the Czech account checksum. The weighted
 * digit sum of the prefix and of the base number must each be divisible by 11.
 */
const WEIGHTS = [1, 2, 4, 8, 5, 10, 9, 7, 3, 6];

function weightedSumOk(part: string): boolean {
  let sum = 0;
  for (let i = 0; i < part.length; i++) {
    const digit = part.charCodeAt(part.length - 1 - i) - 48;
    sum += digit * WEIGHTS[i]!;
  }
  return sum % 11 === 0;
}

/** Parse `[prefix-]number/bank` into its parts, or null if malformed. */
export function parseCzAccount(input: string): CzAccount | null {
  const match = ACCOUNT_RE.exec(input.trim());
  if (!match) return null;
  return { prefix: match[1] ?? "", number: match[2]!, bank: match[3]! };
}

/**
 * Validate a Czech account string: well-formed *and* both the prefix and the
 * base number satisfy the CNB mod-11 weighted checksum (the real-world check
 * that catches typos), with a known bank code shape.
 */
export function isValidCzAccount(input: string): boolean {
  const acct = parseCzAccount(input);
  if (!acct) return false;
  if (acct.prefix && !weightedSumOk(acct.prefix)) return false;
  return weightedSumOk(acct.number);
}

/** Convert a value's letters to digits (A=10 … Z=35) for the mod-97 step. */
function toNumeric(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) out += String(code - 55);
    else out += ch;
  }
  return out;
}

/** ISO 7064 mod-97 of a (possibly long) numeric string, computed iteratively. */
function mod97(numeric: string): number {
  let remainder = 0;
  for (const ch of numeric) {
    remainder = (remainder * 10 + (ch.charCodeAt(0) - 48)) % 97;
  }
  return remainder;
}

const pad = (s: string, len: number): string => s.padStart(len, "0");

/**
 * Build the Czech IBAN for an account string (e.g. `19-2000145399/0800` →
 * `CZ6508000000192000145399`). Returns null if the account is malformed.
 */
export function czAccountToIban(input: string): string | null {
  const acct = parseCzAccount(input);
  if (!acct) return null;
  const bban = acct.bank + pad(acct.prefix, 6) + pad(acct.number, 10);
  // Rearrange: BBAN + "CZ00", letters→digits, then check = 98 - (n mod 97).
  const check = 98 - mod97(toNumeric(bban + "CZ00"));
  return `CZ${pad(String(check), 2)}${bban}`;
}

/** Normalize an IBAN: strip spaces, uppercase. */
export function normalizeIban(iban: string): string {
  return iban.replace(/\s+/g, "").toUpperCase();
}

/**
 * Validate any IBAN by the ISO 7064 mod-97-10 rule (rearrange first 4 chars to
 * the end, letters→digits, value mod 97 === 1). Czech IBANs must also be 24
 * chars long.
 */
export function isValidIban(iban: string): boolean {
  const v = normalizeIban(iban);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(v)) return false;
  if (v.startsWith("CZ") && v.length !== 24) return false;
  return mod97(toNumeric(v.slice(4) + v.slice(0, 4))) === 1;
}

/**
 * Convert a Czech IBAN back to the domestic `[prefix-]number/bank` form, or null
 * if it isn't a valid Czech IBAN.
 */
export function ibanToCzAccount(iban: string): string | null {
  const v = normalizeIban(iban);
  if (!v.startsWith("CZ") || v.length !== 24 || !isValidIban(v)) return null;
  const bank = v.slice(4, 8);
  const prefix = v.slice(8, 14).replace(/^0+/, "");
  const number = v.slice(14, 24).replace(/^0+/, "");
  return `${prefix ? `${prefix}-` : ""}${number}/${bank}`;
}

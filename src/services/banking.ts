/**
 * Banking helpers for the app layer (T-201/T-503). The pure Czech account↔IBAN
 * logic lives in `payments/` (which the app/components layers may not import
 * directly — architecture boundary), so the server actions reach it through
 * this thin service re-export.
 */
import {
  czAccountToIban,
  ibanToCzAccount,
  isValidCzAccount,
  isValidIban,
  normalizeIban,
} from "@/payments";

export { czAccountToIban, ibanToCzAccount, isValidCzAccount, isValidIban, normalizeIban };

/** Compute the IBAN for a Czech account, or null if the account is invalid. */
export function deriveIban(account: string): string | null {
  return isValidCzAccount(account) ? czAccountToIban(account) : null;
}

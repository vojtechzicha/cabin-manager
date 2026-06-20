import type { Payload, PayloadRequest } from "payload";

import type { AuditEntry } from "@/payload-types";

/**
 * Canonical audit action keys. Finance, deposit, and lifecycle flows record
 * through these so the log vocabulary stays consistent and greppable.
 */
export const AuditAction = {
  FinanceAccountsClosed: "finance.accounts.closed",
  FinanceAccountsReopened: "finance.accounts.reopened",
  FinanceExpenseEdited: "finance.expense.edited",
  DepositConfirmed: "deposit.confirmed",
  LifecycleTransition: "lifecycle.transition",
} as const;

export type AuditActionKey = (typeof AuditAction)[keyof typeof AuditAction];

export interface AuditInput {
  /** User id who performed the action; omit for system actions. */
  actor?: string | null;
  /** Dotted action key (use AuditAction constants where possible). */
  action: AuditActionKey | string;
  /** Entity kind acted upon, e.g. "trip", "expense", "membership". */
  targetType: string;
  /** Entity id acted upon. */
  targetId: string;
  /** Trip id the entry belongs to, so the log is queryable by trip. */
  trip?: string | null;
  /** Arbitrary structured context (amounts, from/to states, …). */
  metadata?: Record<string, unknown>;
}

/**
 * The single write path into the audit log. Pass the surrounding `req` so the
 * audit entry participates in the same transaction as the action it records —
 * either both commit or neither does (finance integrity, build.md §0.1).
 */
export async function recordAudit(
  payload: Payload,
  input: AuditInput,
  req?: PayloadRequest,
): Promise<AuditEntry> {
  return payload.create({
    collection: "audit-entries",
    data: {
      actor: input.actor ?? undefined,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      trip: input.trip ?? undefined,
      metadata: input.metadata ?? {},
    },
    req,
  });
}

/** Fetch the audit trail for one trip, newest first. */
export async function auditEntriesForTrip(
  payload: Payload,
  tripId: string,
  limit = 100,
): Promise<AuditEntry[]> {
  const result = await payload.find({
    collection: "audit-entries",
    where: { trip: { equals: tripId } },
    sort: "-createdAt",
    limit,
  });
  return result.docs;
}

/**
 * Atomic multi-document service writes (build.md §0.1). A service that writes
 * several documents (trip + membership + banker, lifecycle write + audit, poll
 * close + promote, invite create/redeem) must commit all-or-nothing, or a
 * partial failure leaves corrupted state.
 *
 * `withTransaction` runs `fn` inside a DB transaction:
 * - If the caller already passed a `req` with an in-flight transaction, we join
 *   it and let the outer owner commit (so nested services compose).
 * - Otherwise we build a local `req`, begin a transaction, and commit on success
 *   or roll back on any thrown error.
 */
import { commitTransaction, createLocalReq, initTransaction, killTransaction } from "payload";
import type { Payload, PayloadRequest } from "payload";

export async function withTransaction<T>(
  payload: Payload,
  req: PayloadRequest | undefined,
  fn: (req: PayloadRequest) => Promise<T>,
): Promise<T> {
  const scopedReq = req ?? (await createLocalReq({}, payload));
  const startedHere = await initTransaction(scopedReq);
  try {
    const result = await fn(scopedReq);
    if (startedHere) await commitTransaction(scopedReq);
    return result;
  } catch (err) {
    if (startedHere) await killTransaction(scopedReq);
    throw err;
  }
}

import config from "@payload-config";
import { getPayload, type Payload } from "payload";

let cached: Promise<Payload> | null = null;

/** A process-wide Payload instance bound to the ephemeral test replica set. */
export function getTestPayload(): Promise<Payload> {
  if (!cached) cached = getPayload({ config });
  return cached;
}

type NativeDb = {
  listCollections(): { toArray(): Promise<{ name: string }[]> };
  collection(name: string): {
    insertOne(doc: object): Promise<unknown>;
    deleteMany(filter: object): Promise<unknown>;
  };
};

function nativeDb(payload: Payload): NativeDb {
  return (payload.db as unknown as { connection: { db: NativeDb } }).connection.db;
}

/**
 * Warm up collections via a NON-transactional native write+clear. This creates
 * each namespace and settles the catalog before any of Payload's transactional
 * writes run — avoiding both the "create namespace inside a transaction" race
 * and the "catalog changed, please retry" write-conflict on the first insert.
 */
export async function ensureCollections(payload: Payload): Promise<void> {
  const db = nativeDb(payload);
  const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));
  for (const slug of [
    "identities",
    "trips",
    "memberships",
    "invitations",
    "login-tokens",
    "health-checks",
    "audit-entries",
  ]) {
    if (!existing.has(slug)) {
      const col = db.collection(slug);
      await col.insertOne({ __warmup: true });
      await col.deleteMany({ __warmup: true });
    }
  }
}

/** Hard-clear a collection via the native driver (bypasses append-only hooks). */
export async function clearCollection(payload: Payload, slug: string): Promise<void> {
  await nativeDb(payload).collection(slug).deleteMany({});
}

let userCounter = 0;

/**
 * Create a test Identity. Defaults to a unique email and the participant role.
 * (Named `createTestUser` for continuity with Epic 0 tests; the auth collection
 * is now `identities`.)
 */
export async function createTestUser(
  payload: Payload,
  overrides: {
    email?: string;
    password?: string;
    name?: string;
    role?: "admin" | "user";
  } = {},
) {
  userCounter += 1;
  const email = overrides.email ?? `user-${userCounter}-${Date.now()}@chata.test`;
  return payload.create({
    collection: "identities",
    overrideAccess: true,
    data: {
      email,
      password: overrides.password ?? "test-password-123",
      displayName: overrides.name ?? "Test User",
      role: overrides.role ?? "user",
    },
  });
}

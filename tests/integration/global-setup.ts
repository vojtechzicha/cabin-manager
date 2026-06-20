import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";

/**
 * Boots an ephemeral single-node Mongo **replica set** for the integration
 * suite (transactions require a replica set). The connection string is written
 * to a temp file that each worker reads in `setup-env.ts` before importing the
 * Payload config — env mutated here would not otherwise reach forked workers.
 *
 * Set TEST_DATABASE_URI to reuse an external replica set (e.g. the docker one)
 * and skip the in-memory download.
 */
export const URI_FILE = join(tmpdir(), "chata-test-db.json");

export default async function setup() {
  let replset: MongoMemoryReplSet | undefined;
  let uri: string;

  if (process.env.TEST_DATABASE_URI) {
    uri = process.env.TEST_DATABASE_URI;
  } else {
    const dir = mkdtempSync(join(tmpdir(), "chata-mongo-"));
    replset = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: "wiredTiger" },
      instanceOpts: [{ dbPath: dir }],
    });
    uri = replset.getUri("chata_test");
  }

  // MongoDB's default transaction lock timeout is 5ms, which flakes when the
  // first transactional write contends with a freshly created collection's
  // catalog lock. Give transactions room to acquire locks in the test RS.
  const client = new MongoClient(uri);
  try {
    await client.connect();
    await client
      .db("admin")
      .command({ setParameter: 1, maxTransactionLockRequestTimeoutMillis: 5000 });
  } finally {
    await client.close();
  }

  writeFileSync(
    URI_FILE,
    JSON.stringify({ uri, secret: "integration-test-secret-key" }),
    "utf8",
  );

  return async () => {
    await replset?.stop();
    rmSync(URI_FILE, { force: true });
  };
}

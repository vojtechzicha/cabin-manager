/**
 * Verifies media upload round-trips through MongoDB/GridFS (no local disk).
 * Run: pnpm payload run scripts/verify-media.ts
 */
import config from "@payload-config";
import { getPayload } from "payload";

const payload = await getPayload({ config });

// A minimal valid 1×1 PNG.
const buffer = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const filename = `verify-${Date.now()}.png`;
const doc = await payload.create({
  collection: "media",
  data: { alt: "verify" },
  file: { data: buffer, name: filename, mimetype: "image/png", size: buffer.length },
});
payload.logger.info(`created media id=${doc.id} filename=${doc.filename} url=${doc.url}`);

const db = (payload.db as unknown as { connection: { db: import("mongodb").Db } }).connection.db;
const files = await db.collection("media.files").find({ filename: doc.filename }).toArray();
const totalFiles = await db.collection("media.files").countDocuments();
const totalChunks = await db.collection("media.chunks").countDocuments();
payload.logger.info(
  `GridFS: main file present=${files.length > 0}; media.files total=${totalFiles}; media.chunks total=${totalChunks}`,
);

// Read the bytes back out of GridFS and confirm they match.
const { GridFSBucket } = await import("mongodb");
const bucket = new GridFSBucket(db, { bucketName: "media" });
const readBack = await new Promise<Buffer>((resolve, reject) => {
  const parts: Buffer[] = [];
  bucket
    .openDownloadStreamByName(doc.filename!)
    .on("data", (c: Buffer) => parts.push(c))
    .on("end", () => resolve(Buffer.concat(parts)))
    .on("error", reject);
});
payload.logger.info(`read back ${readBack.length} bytes; matches original=${readBack.equals(buffer)}`);

await payload.delete({ collection: "media", id: doc.id });
const afterDelete = await db.collection("media.files").find({ filename: doc.filename }).toArray();
payload.logger.info(`after delete, main file remains=${afterDelete.length > 0} (should be false)`);

process.exit(files.length > 0 && readBack.equals(buffer) ? 0 : 1);

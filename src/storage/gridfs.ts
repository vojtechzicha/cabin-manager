import { Readable } from "node:stream";

import type { Adapter } from "@payloadcms/plugin-cloud-storage/types";
import { GridFSBucket, type Db } from "mongodb";
import type { PayloadRequest } from "payload";

/**
 * A cloud-storage adapter that keeps uploaded files **in the same MongoDB** via
 * GridFS (build.md T-201 branding / media). Chosen over local disk so uploads
 * survive redeploys and work across instances on the server, with no extra
 * service to run. Bytes are chunked into the `media` GridFS bucket and streamed
 * back through Payload's own `/api/media/file/<name>` route, so normal access
 * control still applies.
 *
 * The native `Db` is taken from the live mongoose connection on each request
 * (`req.payload.db.connection.db`) — the same accessor the test/seed harnesses
 * use to warm up namespaces.
 */

const BUCKET = "media";

function bucketFor(req: PayloadRequest): GridFSBucket {
  const db = (req.payload.db as unknown as { connection: { db: Db } }).connection.db;
  return new GridFSBucket(db, { bucketName: BUCKET });
}

/** Remove every stored revision of a filename (idempotent re-upload / delete). */
async function deleteByName(bucket: GridFSBucket, filename: string): Promise<void> {
  const existing = await bucket.find({ filename }).toArray();
  for (const file of existing) await bucket.delete(file._id);
}

/**
 * Build the GridFS storage adapter. Payload calls `handleUpload` once per stored
 * file — the original plus each generated image size — so we just persist
 * whatever `(filename, buffer)` we're handed.
 */
export function gridfsAdapter(): Adapter {
  return () => ({
    name: "gridfs",

    async handleUpload({ file, req }) {
      const bucket = bucketFor(req);
      await deleteByName(bucket, file.filename); // overwrite cleanly
      await new Promise<void>((resolve, reject) => {
        Readable.from(file.buffer)
          .pipe(bucket.openUploadStream(file.filename, { contentType: file.mimeType }))
          .on("error", reject)
          .on("finish", () => resolve());
      });
    },

    async handleDelete({ filename, req }) {
      await deleteByName(bucketFor(req), filename);
    },

    async staticHandler(req, { params }) {
      const bucket = bucketFor(req);
      const files = await bucket.find({ filename: params.filename }).toArray();
      const meta = files[files.length - 1];
      if (!meta) return new Response("Not found", { status: 404 });

      const stream = bucket.openDownloadStreamByName(params.filename);
      return new Response(Readable.toWeb(stream) as ReadableStream, {
        headers: {
          "Content-Type": meta.contentType ?? "application/octet-stream",
          "Content-Length": String(meta.length),
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    },

    generateURL: ({ collection: col, filename }) => `/api/${col.slug}/file/${filename}`,
  });
}

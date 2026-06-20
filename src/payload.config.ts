import path from "path";
import { fileURLToPath } from "url";

import { mongooseAdapter } from "@payloadcms/db-mongodb";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { buildConfig, type SharpDependency } from "payload";
import sharp from "sharp";

import { getEnv } from "@/lib/env";
import { Users } from "@/collections/Users";
import { HealthChecks } from "@/collections/HealthChecks";
import { AuditEntries } from "@/collections/AuditEntries";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const env = getEnv();

export default buildConfig({
  serverURL: env.APP_URL,
  admin: {
    user: Users.slug,
  },
  collections: [Users, HealthChecks, AuditEntries],
  editor: lexicalEditor(),
  secret: env.PAYLOAD_SECRET,
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  db: mongooseAdapter({
    url: env.DATABASE_URI,
    // Transactions are required for finance integrity (build.md §0.1). The
    // mongoose adapter uses them automatically when the server is a replica
    // set; leaving transactionOptions at its default keeps them enabled.
  }),
  // sharp's overloaded factory doesn't structurally match Payload's
  // single-signature SharpDependency type (upstream drift); the runtime value
  // is exactly what Payload expects, so we assert the type at this boundary.
  sharp: sharp as SharpDependency,
});

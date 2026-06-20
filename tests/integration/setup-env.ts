import { readFileSync } from "node:fs";

import { URI_FILE } from "./global-setup";

/**
 * Per-worker setup: runs before any test module imports the Payload config, so
 * the env the config validates is already populated with the ephemeral DB URI.
 */
const { uri, secret } = JSON.parse(readFileSync(URI_FILE, "utf8")) as {
  uri: string;
  secret: string;
};

process.env.DATABASE_URI = uri;
process.env.PAYLOAD_SECRET ||= secret;
process.env.APP_URL ||= "http://localhost:3000";

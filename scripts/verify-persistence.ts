/**
 * Bootstrap acceptance check (T-001): proves a trivial collection round-trips to
 * Mongo and that the Payload Local API is wired correctly. Run with:
 *   pnpm payload run scripts/verify-persistence.ts
 */
import config from "@payload-config";
import { getPayload } from "payload";

const payload = await getPayload({ config });

const created = await payload.create({
  collection: "health-checks",
  data: { note: `bootstrap check ${new Date().toISOString()}`, ok: true },
});
payload.logger.info(`created health-check id=${created.id}`);

const found = await payload.findByID({ collection: "health-checks", id: created.id });
payload.logger.info(`read back note="${found.note}" ok=${found.ok}`);

const { totalDocs } = await payload.count({ collection: "health-checks" });
payload.logger.info(`health-checks totalDocs=${totalDocs}`);

// Clean up so repeated runs stay idempotent.
await payload.delete({ collection: "health-checks", id: created.id });
payload.logger.info(`deleted id=${created.id} — persistence round-trip OK`);

process.exit(0);

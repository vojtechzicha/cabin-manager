import config from "@payload-config";
import { getPayload } from "payload";
import { NextResponse } from "next/server";

/**
 * Liveness + dependency check. Confirms the app can reach Mongo (a real
 * round-trip against the trivial `health-checks` collection) and whether
 * multi-document transactions are available — the latter requires a replica
 * set and is a hard requirement for finance integrity (build.md §0.1).
 */
export async function GET() {
  try {
    const payload = await getPayload({ config });

    const { totalDocs } = await payload.count({ collection: "health-checks" });

    // Probe transaction support: begin one and roll it straight back.
    let transactions = false;
    const txID = await payload.db.beginTransaction?.();
    if (txID !== null && txID !== undefined) {
      await payload.db.rollbackTransaction?.(txID);
      transactions = true;
    }

    return NextResponse.json({
      status: "ok",
      db: "connected",
      transactions,
      healthChecks: totalDocs,
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", error: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }
}

/**
 * GET /api/health/ready
 *
 * Readiness probe. Returns 200 only when the database is migrated and seeded.
 * Returns 503 while the database is unavailable so a deployment orchestrator
 * knows not to route traffic to this instance.
 */

import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/health/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await checkDatabaseHealth();
  const ready = db.status === "healthy";
  return NextResponse.json(
    {
      status: ready ? "ready" : "not-ready",
      database: db.status,
      timestamp: new Date().toISOString(),
    },
    { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}

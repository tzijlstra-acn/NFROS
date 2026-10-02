/**
 * GET /api/health/live
 *
 * Liveness probe. Returns 200 as long as the process is running.
 * No database check: this endpoint is called frequently by load balancers
 * and must never block on I/O.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { status: "alive", timestamp: new Date().toISOString() },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}

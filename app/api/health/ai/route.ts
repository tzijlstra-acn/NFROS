/**
 * GET /api/health/ai
 *
 * Returns safe status metadata only. There is no code path here that can
 * reach the key value: `getPublicHealth` constructs a narrow object, and the
 * loader never returns the secret to begin with.
 */

import { NextResponse } from "next/server";
import { getPublicHealth } from "@/server/config/runtime";
import { isDatabaseReady } from "@/db/client";

export const dynamic = "force-dynamic";

export function GET() {
  const health = getPublicHealth();
  return NextResponse.json(
    { ...health, databaseSeeded: isDatabaseReady() },
    { headers: { "cache-control": "no-store" } },
  );
}

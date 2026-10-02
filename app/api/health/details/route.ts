/**
 * GET /api/health/details
 *
 * Full component health breakdown. Intended for administrator use only.
 *
 * IMPORTANT: This endpoint should be protected by administrator authentication
 * in production. In demonstration mode it is open. The response never contains
 * secrets, prompts, raw evidence or user message bodies.
 */

import { NextResponse } from "next/server";
import { getHealthSummary } from "@/health/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const summary = await getHealthSummary(true);
  return NextResponse.json(
    {
      ...summary,
      _note:
        "Protect this endpoint with administrator authentication in production. No secrets or content are included in this response.",
    },
    { headers: { "cache-control": "no-store" } },
  );
}

/**
 * GET /api/health/demo
 *
 * Demonstration readiness for the meeting. 200 when the scripted journey can
 * run (database migrated and seeded, the first question answered from the
 * records); 503 otherwise. `cleanDay` says whether the day still shows earlier
 * analyses, approvals or agents, in which case the presenter resets first.
 *
 * Read-only and model-free: the first answer is built in memory to prove it
 * and to warm the analysis, never stored or audited. Public like the other
 * health probes; it returns no record content beyond the scripted answer's
 * headline figures, which the synthetic institution shows to anyone signed in.
 */

import { NextResponse } from "next/server";
import { checkDemoReadiness } from "@/demo/readiness";

export const dynamic = "force-dynamic";

export function GET() {
  const readiness = checkDemoReadiness();
  return NextResponse.json(readiness, {
    status: readiness.ready ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}

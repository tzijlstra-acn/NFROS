/**
 * GET /api/workday/search?role=<role>
 *
 * The search scope and the palette commands for one role, read when the
 * palette is first opened. Thin: the scope, the routing and the commands are
 * `readSearchPayload` in `src/features/search/read.ts`.
 *
 * Read only. A role the release gate does not open gets no scope, the same
 * answer its routes give.
 */

import { NextResponse, type NextRequest } from "next/server";
import { isDatabaseReady } from "@/db/client";
import { ROLE_IDS, type RoleId } from "@/db/schema/core";
import { readSearchPayload } from "@/features/search/read";
import { getScenarioState } from "@/scenario/engine/state";
import { gateForRole } from "@/workday/role-gate";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

export async function GET(request: NextRequest) {
  const role = request.nextUrl.searchParams.get("role") ?? "";
  if (!(ROLE_IDS as readonly string[]).includes(role)) {
    return NextResponse.json({ error: "unknown role" }, { status: 400, headers: NO_STORE });
  }
  if (gateForRole(role).kind !== "open") {
    return NextResponse.json({ error: "role not in this release" }, { status: 403, headers: NO_STORE });
  }
  if (!isDatabaseReady()) return NextResponse.json({ error: "not seeded" }, { status: 503, headers: NO_STORE });
  const state = getScenarioState();
  if (!state) return NextResponse.json({ error: "no scenario" }, { status: 503, headers: NO_STORE });

  try {
    return NextResponse.json(readSearchPayload(role as RoleId, state), { headers: NO_STORE });
  } catch {
    // The message is withheld, as in the partner route: an error body is the
    // easiest place for a configuration detail to reach a browser.
    return NextResponse.json({ error: "search unavailable" }, { status: 500, headers: NO_STORE });
  }
}

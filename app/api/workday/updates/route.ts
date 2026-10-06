/**
 * GET /api/workday/updates?role=<role>
 *
 * The role's material updates, after the notification budget, read when the
 * Updates panel opens. Thin: the classification and the budget are
 * `readUpdates` in `src/features/updates/read.ts`, the same call the header
 * count comes from, so the badge and the list are one read.
 *
 * Read only. Marking an arrival read is the server action in
 * `src/features/updates/actions.ts`.
 */

import { NextResponse, type NextRequest } from "next/server";
import { isDatabaseReady } from "@/db/client";
import { ROLE_IDS, type RoleId } from "@/db/schema/core";
import { readUpdates } from "@/features/updates/read";
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

  return NextResponse.json(readUpdates(role as RoleId, state), { headers: NO_STORE });
}

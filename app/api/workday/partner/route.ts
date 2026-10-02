/**
 * The AI Partner's server data, on demand.
 *
 * V2 rendered the dock on the server on every workday route, because there
 * the dock was always on screen. V3.1 collapses it by default, and the brief
 * is explicit that the default screen should not carry what the reader has
 * not asked for. Measured, that difference is most of the gap between a 59KB
 * role home and a 373KB one.
 *
 * So the dock's data is a fetch rather than a prop. The dock itself, the
 * streaming, the authority gate and the chat transport are all unchanged and
 * shared with V2: this endpoint exists to move WHEN the data is read, not to
 * read it differently. `buildPartnerData` is the same function the V2 server
 * slot calls.
 *
 * It is read only. Nothing here mutates, approves or executes. The actions
 * the dock offers continue to go through the existing server actions and the
 * authority gate, which is the only place a decision can be recorded.
 */

import { NextResponse, type NextRequest } from "next/server";
import { buildPartnerData } from "@/components/workday-v2/PartnerSlot";
import { isDatabaseReady } from "@/db/client";
import { ROLE_IDS, type RoleId } from "@/db/schema/core";
import { getScenarioState } from "@/scenario/engine/state";
import { parseSelectionParam } from "@/workday/selection-url";
import type { Language } from "@/i18n/labels";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const role = request.nextUrl.searchParams.get("role") ?? "";

  if (!(ROLE_IDS as readonly string[]).includes(role)) {
    return NextResponse.json({ error: "unknown role" }, { status: 400 });
  }

  if (!isDatabaseReady()) {
    return NextResponse.json({ error: "not seeded" }, { status: 503 });
  }

  const state = getScenarioState();
  if (!state) {
    return NextResponse.json({ error: "no scenario" }, { status: 503 });
  }

  /*
   * The selection travels in the query string, as it does everywhere else in
   * this product, and is parsed by the same pure function the server
   * components use. A dock asked about a specific object should answer about
   * that object, so the endpoint cannot ignore it.
   */
  const selection = parseSelectionParam(request.nextUrl.searchParams.get("selection"));

  try {
    const { threadId, ...data } = buildPartnerData(
      role as RoleId,
      state.language as Language,
      state,
      selection,
    );
    return NextResponse.json({ ...data, initialThreadId: threadId });
  } catch {
    /*
     * The message is withheld deliberately. A failure in here can have come
     * from a query that mentions a connector target or a configuration value,
     * and an error body is the easiest place for something like that to leak
     * into a browser. The dock has a degraded rendering; this is how it gets
     * there.
     */
    return NextResponse.json({ error: "partner data unavailable" }, { status: 500 });
  }
}

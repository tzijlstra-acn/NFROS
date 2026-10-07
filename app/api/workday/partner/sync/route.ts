/**
 * POST /api/workday/partner/sync
 *
 * The workday frame tells the AI Partner what the person is looking at, and
 * the Partner keeps that context, settles answered suggestions and runs the
 * routines the scenario clock has made due (`syncPartner`). Thin: the body is
 * the role and the focus, every identifier in it is checked against the
 * database before anything is kept, and the rules live in
 * `src/features/partner/`.
 *
 * A Demo or Planned role is refused, as every other workday route refuses it.
 * The response says only whether something changed, so the client knows to
 * refresh the route; it carries no record content.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { ROLE_IDS, type RoleId } from "@/db/schema/core";
import { isDatabaseReady } from "@/db/client";
import { bootstrapServer } from "@/server/bootstrap";
import { gateForRole } from "@/workday/role-gate";
import { revalidateWorkday } from "@/workday/revalidate";
import { partnerFocusSchema } from "@/features/partner/focus";
import { syncPartner } from "@/features/partner/sync";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ roleId: z.enum(ROLE_IDS), focus: partnerFocusSchema });

export async function POST(request: Request) {
  bootstrapServer();
  if (!isDatabaseReady()) return NextResponse.json({ error: "not seeded" }, { status: 503 });

  let parsed;
  try {
    parsed = bodySchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!parsed.success) return NextResponse.json({ error: "invalid request" }, { status: 400 });
  const roleId = parsed.data.roleId as RoleId;
  if (gateForRole(roleId).kind !== "open") return NextResponse.json({ error: "role not available" }, { status: 403 });

  try {
    const result = await syncPartner(roleId, parsed.data.focus);
    if (result.changed) revalidateWorkday(roleId, "routine");
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "sync unavailable" }, { status: 500 });
  }
}

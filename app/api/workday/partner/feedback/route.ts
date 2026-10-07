/**
 * POST /api/workday/partner/feedback
 *
 * Gives or takes back one kind of structured feedback on a suggestion, a chat
 * answer or a routine run (plan 4.11, Feedback). Thin: the links the record
 * carries (task kind, configuration, prompt version, model profile, sources,
 * role) are resolved by `togglePartnerFeedback` in
 * `src/features/partner/feedback.ts`, and the Product Owner Console reads the
 * rows through `src/db/repositories/ai-feedback.ts`.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { ROLE_IDS, type RoleId } from "@/db/schema/core";
import { isDatabaseReady } from "@/db/client";
import { getScenarioState } from "@/scenario/engine/state";
import { bootstrapServer } from "@/server/bootstrap";
import { gateForRole } from "@/workday/role-gate";
import { togglePartnerFeedback } from "@/features/partner/feedback";
import { PARTNER_FEEDBACK_KINDS, PARTNER_FEEDBACK_TARGETS } from "@/features/partner/rules";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  roleId: z.enum(ROLE_IDS),
  targetKind: z.enum(PARTNER_FEEDBACK_TARGETS),
  targetId: z.string().min(1).max(160),
  kind: z.enum(PARTNER_FEEDBACK_KINDS),
  comment: z.string().max(600).optional(),
});

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
  const state = getScenarioState();
  if (!state) return NextResponse.json({ error: "no scenario" }, { status: 503 });

  const result = togglePartnerFeedback(
    {
      roleId,
      targetKind: parsed.data.targetKind,
      targetId: parsed.data.targetId,
      kind: parsed.data.kind,
      ...(parsed.data.comment !== undefined ? { comment: parsed.data.comment } : {}),
    },
    state,
  );
  return NextResponse.json(result.ok ? { ok: true, given: result.given, kinds: result.kinds } : result, {
    status: result.ok ? 200 : 404,
    headers: { "cache-control": "no-store" },
  });
}

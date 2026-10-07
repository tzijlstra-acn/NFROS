/**
 * POST /api/workday/partner/suggestion
 *
 * Records a person's answer to a suggestion: review, accept, modify, reject or
 * snooze (plan 4.11, suggestion lifecycle). Thin: the rules are
 * `answerSuggestion` in `src/features/partner/lifecycle.ts`.
 *
 * It never executes anything. Accepting a material suggestion returns the
 * decision record as the next step, where the authority gate and the payload
 * bound approval apply; the suggestion is recorded as executed only after
 * that governed path has recorded the decision.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { ROLE_IDS, type RoleId } from "@/db/schema/core";
import { isDatabaseReady } from "@/db/client";
import { getScenarioState } from "@/scenario/engine/state";
import { bootstrapServer } from "@/server/bootstrap";
import { gateForRole } from "@/workday/role-gate";
import { revalidateWorkday } from "@/workday/revalidate";
import { answerSuggestion } from "@/features/partner/lifecycle";
import { PARTNER_ANSWERS } from "@/features/partner/rules";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  roleId: z.enum(ROLE_IDS),
  suggestionId: z.string().min(1).max(160),
  answer: z.enum(PARTNER_ANSWERS),
  recommendation: z.string().max(1600).optional(),
  reason: z.string().max(600).optional(),
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

  const result = answerSuggestion(
    {
      roleId,
      suggestionId: parsed.data.suggestionId,
      answer: parsed.data.answer,
      ...(parsed.data.recommendation !== undefined ? { recommendation: parsed.data.recommendation } : {}),
      ...(parsed.data.reason !== undefined ? { reason: parsed.data.reason } : {}),
    },
    state,
  );
  if (result.ok) revalidateWorkday(roleId, "suggestion");
  return NextResponse.json(result, { status: result.ok ? 200 : 409, headers: { "cache-control": "no-store" } });
}

/**
 * POST /api/agent
 *
 * One turn of the Personal NFR Work Agent.
 *
 * The route assembles the tool context server side from the scenario run
 * rather than trusting anything the client sends about autonomy level, clock
 * or acting user. A client that claims a higher autonomy level than the run
 * holds changes nothing, because the value is read from the database here.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { ROLE_IDS } from "@/db/schema/core";
import { isDatabaseReady } from "@/db/client";
import { requireScenarioState } from "@/scenario/engine/state";
import { runManagerTurn } from "@/agents/manager";
import { getResolvedDemoMode } from "@/server/config/runtime";
import { createLogger } from "@/server/logging/redact";
import type { ToolContext } from "@/agents/tools/runtime";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const log = createLogger("api-agent");

const bodySchema = z.object({
  roleId: z.enum(ROLE_IDS),
  input: z.string().min(1).max(4000),
  beatKey: z.string().max(120).optional(),
  preferSpecialist: z.string().max(80).optional(),
});

/** Role to holder. Resolved server side, so a client cannot impersonate. */
const ROLE_HOLDERS: Record<string, string> = {
  tprm: "P-002",
  rcsa: "P-003",
  "control-assurance": "P-004",
  "incident-resilience": "P-005",
  "regulatory-change": "P-006",
  "nfr-governance": "P-001",
};

export async function POST(request: Request) {
  if (!isDatabaseReady()) {
    return NextResponse.json(
      { error: "The scenario has not been seeded. Run npm run db:migrate and npm run db:seed." },
      { status: 503 },
    );
  }

  let parsed;
  try {
    parsed = bodySchema.safeParse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "The request body could not be read as JSON." },
      { status: 400 },
    );
  }

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", issues: parsed.error.issues.map((issue) => issue.message) },
      { status: 400 },
    );
  }

  const state = requireScenarioState();

  /*
   * Authoritative context. The role comes from the request, but the autonomy
   * level, the scenario clock and the acting user do not: those are read from
   * the run, so none of them can be escalated from the browser.
   */
  const context: ToolContext = {
    runId: state.runId,
    roleId: parsed.data.roleId,
    autonomyLevel: state.autonomyLevel,
    actingUserId: ROLE_HOLDERS[parsed.data.roleId] ?? "P-001",
    atMoment: state.currentMoment,
    sessionId: `session-${parsed.data.roleId}`,
    actorKind: "manager-agent",
    language: state.language,
  };

  try {
    const result = await runManagerTurn({
      context,
      userInput: parsed.data.input,
      ...(parsed.data.beatKey ? { beatKey: parsed.data.beatKey } : {}),
      ...(parsed.data.preferSpecialist ? { preferSpecialist: parsed.data.preferSpecialist } : {}),
    });

    return NextResponse.json(
      {
        output: result.output,
        source: result.source,
        mode: getResolvedDemoMode().mode,
        model: result.model,
        durationMs: result.durationMs,
        tokens: { input: result.inputTokens, output: result.outputTokens },
        estimatedCostUsd: Number(result.estimatedCostUsd.toFixed(6)),
        costBasis: "illustrative",
        specialistsUsed: result.specialistsUsed,
        refusals: result.refusals,
        proposals: result.proposals,
        guardrailNote: result.guardrailNote,
        compaction: result.compaction,
        autonomyLevel: state.autonomyLevel,
        atMoment: state.currentMoment,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    log.error("An agent turn failed.", { error });
    return NextResponse.json(
      { error: "The agent turn failed. The interactive surfaces remain usable." },
      { status: 500 },
    );
  }
}

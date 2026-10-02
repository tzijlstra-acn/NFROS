/**
 * POST /api/workday/suggestion
 *
 * Returns the prepared suggestion for one work object, generating it if there
 * is nothing valid for the current state.
 *
 * The route is thin on purpose. Everything that matters, the deduplication,
 * the required source gate, the stage contract and the validation, lives in
 * `src/agents/suggestions/generate.ts`, so the same behaviour is available to
 * the event channel and to the verification script without going through
 * HTTP.
 *
 * Like `app/api/agent/route.ts`, the authoritative context is assembled
 * server side from the scenario run. The body carries the role and the object
 * and nothing else of consequence: a client that claimed a higher autonomy
 * level, a different acting user or a later clock would change nothing,
 * because none of those values is read from here.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { ROLE_IDS } from "@/db/schema/core";
import { isDatabaseReady } from "@/db/client";
import { generateSuggestion } from "@/agents/suggestions/generate";
import { createLogger } from "@/server/logging/redact";
import { bootstrapServer } from "@/server/bootstrap";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const log = createLogger("api-workday-suggestion");

const bodySchema = z.object({
  roleId: z.enum(ROLE_IDS),
  objectType: z.string().min(1).max(60),
  objectId: z.string().min(1).max(120),
  eventId: z.string().max(120).optional(),
  /** The only manual control in the product. There is no Generate button. */
  refresh: z.boolean().optional(),
  /**
   * Accepted because the live player genuinely owns the viewed moment, and
   * looking at an earlier moment is not a privilege: it grants nothing and
   * reveals nothing that the scenario has not already published.
   */
  viewedMoment: z
    .string()
    .regex(/^[0-2][0-9]:[0-5][0-9]$/)
    .optional(),
});

export async function POST(request: Request) {
  bootstrapServer();
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

  try {
    const result = await generateSuggestion({
      roleId: parsed.data.roleId,
      objectType: parsed.data.objectType,
      objectId: parsed.data.objectId,
      eventId: parsed.data.eventId ?? null,
      ...(parsed.data.refresh === true ? { refresh: true } : {}),
      ...(parsed.data.viewedMoment ? { viewedMoment: parsed.data.viewedMoment } : {}),
    });

    /*
     * The payload is assembled field by field rather than spread.
     *
     * `details` is the only place a model name or a duration may appear, and
     * the interface shows it behind an explicit disclosure. Spreading the
     * internal result would eventually leak a field that belongs on the
     * server into the neutral product surface, which is the kind of mistake
     * that is invisible until someone screenshots it.
     */
    return NextResponse.json(
      {
        suggestion: result.suggestion,
        generation: result.generation,
        cached: result.cached,
        ...(result.error !== undefined ? { error: result.error } : {}),
        ...(result.retryable !== undefined ? { retryable: result.retryable } : {}),
        ...(result.details !== undefined ? { details: result.details } : {}),
        ...(result.dedupeReason !== undefined && result.dedupeReason !== "none"
          ? { dedupeReason: result.dedupeReason }
          : {}),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    log.error("A suggestion request failed.", { error });
    return NextResponse.json(
      {
        suggestion: null,
        generation: { state: "error", completedStages: [], label: "Suggestion unavailable" },
        cached: false,
        error:
          "Preparing a suggestion failed. The deterministic evidence, the decision brief and the work object remain usable.",
        retryable: true,
      },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}

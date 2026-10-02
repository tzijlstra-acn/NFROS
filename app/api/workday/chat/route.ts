/**
 * POST /api/workday/chat
 *
 * One turn of the persistent contextual chat.
 *
 * The body carries the question, the thread and what the user has selected.
 * It carries nothing that could escalate anything: the autonomy level, the
 * acting user and the scenario clock are read from the run inside the
 * service, and the selection is used only to decide which records to read.
 *
 * `blocked` in the response is the authority gate's denial code, not a
 * message this route composed. That is the point: when a natural language
 * request asks for something prohibited, the refusal is attributable to the
 * deterministic gate rather than to a sentence in a prompt.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { ROLE_IDS } from "@/db/schema/core";
import { isDatabaseReady } from "@/db/client";
import { postChatTurn } from "@/agents/chat/service";
import { createLogger } from "@/server/logging/redact";
import { bootstrapServer } from "@/server/bootstrap";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const log = createLogger("api-workday-chat");

/** Mirrors `WorkdaySelection` in the shared contract. */
const selectionSchema = z.object({
  objectType: z.enum([
    "risk",
    "control",
    "supplier",
    "service",
    "test-case",
    "incident",
    "obligation",
    "decision",
    "process",
    "theme",
    "assessment",
    "action",
  ]),
  objectId: z.string().min(1).max(120),
  label: z.string().max(240),
});

const bodySchema = z.object({
  roleId: z.enum(ROLE_IDS),
  threadId: z.string().max(120).optional(),
  input: z.string().min(1).max(4000),
  selection: selectionSchema.optional(),
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
    const result = await postChatTurn({
      roleId: parsed.data.roleId,
      threadId: parsed.data.threadId ?? null,
      input: parsed.data.input,
      selection: parsed.data.selection ?? null,
    });

    return NextResponse.json(
      {
        threadId: result.threadId,
        turn: result.turn,
        ...(result.blocked !== undefined ? { blocked: result.blocked } : {}),
        // Model and duration only, and only here. The interface puts this
        // object behind an explicit disclosure and never inside the reply.
        ...(result.details !== undefined ? { details: result.details } : {}),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    log.error("A chat turn failed.", { error });
    return NextResponse.json(
      {
        error:
          "The chat turn failed. The decision brief, the evidence corpus and the work object remain usable.",
      },
      { status: 500 },
    );
  }
}

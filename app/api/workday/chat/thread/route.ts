/**
 * GET /api/workday/chat/thread?roleId=...&threadId=...
 *
 * Returns the turns of one chat thread so the panel can restore the
 * conversation after navigation or a reload.
 *
 * The role is checked against the thread inside the service rather than here.
 * Naming another role's thread returns an empty list rather than its content,
 * which is the behaviour wanted: the six roles share one institution and one
 * day, and they do not share each other's conversations.
 *
 * `threadId` is optional. Without it the role's open thread is returned, which
 * is what a freshly loaded panel needs and saves it a round trip to discover
 * an identifier it has no way of knowing.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { ROLE_IDS } from "@/db/schema/core";
import { isDatabaseReady } from "@/db/client";
import { getOrCreateThread, getThreadTurns } from "@/agents/chat/service";
import { createLogger } from "@/server/logging/redact";

export const dynamic = "force-dynamic";

const log = createLogger("api-workday-chat-thread");

const querySchema = z.object({
  roleId: z.enum(ROLE_IDS),
  threadId: z.string().max(120).optional(),
});

export async function GET(request: Request) {
  if (!isDatabaseReady()) {
    return NextResponse.json(
      { error: "The scenario has not been seeded. Run npm run db:migrate and npm run db:seed." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    roleId: url.searchParams.get("roleId") ?? undefined,
    threadId: url.searchParams.get("threadId") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", issues: parsed.error.issues.map((issue) => issue.message) },
      { status: 400 },
    );
  }

  try {
    const thread = getOrCreateThread({
      roleId: parsed.data.roleId,
      threadId: parsed.data.threadId ?? null,
    });

    const turns = getThreadTurns({ roleId: parsed.data.roleId, threadId: thread.id });

    return NextResponse.json(
      {
        threadId: thread.id,
        turns: turns.map((turn) => ({
          id: turn.id,
          author: turn.author,
          parts: turn.parts,
          atMoment: turn.atMoment,
          contextObjectId: turn.contextObjectId,
        })),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    log.error("Reading a chat thread failed.", { error });
    return NextResponse.json({ error: "The chat thread could not be read." }, { status: 500 });
  }
}

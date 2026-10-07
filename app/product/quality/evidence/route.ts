/**
 * Export evidence for one evaluation run, as a JSON download.
 *
 * Thin: the permission is checked through the console's governed path
 * (`quality.export-evidence`), the export is recorded as a console read, and
 * the document is built in `src/features/product/quality/evidence.ts`.
 */

import { NextResponse, type NextRequest } from "next/server";
import { authorizeConsoleAction, recordConsoleRead } from "@/features/product/governance";
import { buildEvaluationEvidence } from "@/features/product/quality/evidence";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get("run") ?? "";
  if (!/^[A-Za-z0-9._:-]{1,120}$/.test(runId)) {
    return NextResponse.json({ message: "Name an evaluation run." }, { status: 400 });
  }
  const target = { kind: "ai-evaluation-run", id: runId };
  const authorized = await authorizeConsoleAction("quality.export-evidence", target);
  if (!authorized.ok) return NextResponse.json({ message: authorized.reason.en }, { status: 403 });

  const document = buildEvaluationEvidence(runId, authorized.actor.label);
  if (!document) return NextResponse.json({ message: "There is no evaluation run with this identifier." }, { status: 404 });

  recordConsoleRead("quality.export-evidence", authorized.actor, target, {
    en: `Exported the evidence of evaluation run ${runId}.`,
    de: `Nachweise des Evaluationslaufs ${runId} exportiert.`,
  });
  return new NextResponse(JSON.stringify(document, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="evaluation-evidence-${runId}.json"`,
      "cache-control": "no-store",
    },
  });
}

/**
 * Download diagnostic bundle (plan 7.6), as a JSON file built in memory.
 *
 * Thin: the permission is checked through the console's governed path
 * (`integration.download-diagnostics`), the download is recorded as a
 * console read, and the bundle is built in
 * `src/features/product/integrations/diagnostics.ts`. It carries no secret.
 */

import { NextResponse } from "next/server";
import { authorizeConsoleAction, recordConsoleRead } from "@/features/product/governance";
import { buildDiagnosticBundle } from "@/features/product/integrations/diagnostics";

export const dynamic = "force-dynamic";

export async function GET() {
  const target = { kind: "integration-diagnostics", id: "bundle" };
  const authorized = await authorizeConsoleAction("integration.download-diagnostics", target);
  if (!authorized.ok) return NextResponse.json({ message: authorized.reason.en }, { status: 403 });

  const bundle = await buildDiagnosticBundle(authorized.actor.label);
  recordConsoleRead("integration.download-diagnostics", authorized.actor, target, {
    en: "Downloaded the integration diagnostic bundle.",
    de: "Diagnosepaket der Integrationen heruntergeladen.",
  });
  return new NextResponse(JSON.stringify(bundle, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${String(bundle.bundleId)}.json"`,
      "cache-control": "no-store",
    },
  });
}

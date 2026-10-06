/**
 * GET /product/pilot/evidence-pack: the pilot evidence pack as a download.
 *
 * Thin. Built on the server by `serveEvidencePack`
 * (`src/features/product/pilot/evidence-download.ts`), which checks the
 * acting persona, refuses a pack holding anything shaped like a credential
 * and records the download in the audit trail. Never cached.
 */

import { serveEvidencePack } from "@/features/product/pilot/evidence-download";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const result = await serveEvidencePack();
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  };
  if (result.filename) headers["content-disposition"] = `attachment; filename="${result.filename}"`;
  return new Response(result.body, { status: result.status, headers });
}

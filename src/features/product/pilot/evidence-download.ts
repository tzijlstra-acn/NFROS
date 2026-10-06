/**
 * Serving the pilot evidence pack.
 *
 * Server only. The route handler calls this and returns what it returns. The
 * acting persona must be able to open the pilot workspace and hold the
 * evidence generation authority (`release.generate-evidence-pack`): the Pilot
 * Lead does, and the Platform Product Owner does, read only. A refused request
 * is audited by `authorizeConsoleAction`; a served pack is audited as a
 * console read with its digest, so the trail shows which state was handed
 * out.
 */

import { authorizeConsoleAction, recordConsoleRead } from "@/features/product/governance";
import { pilotPageAllowed } from "./access";
import { buildPilotEvidencePack } from "./evidence-pack";
import { PILOT_AUDIT_KINDS, readPilotWorkspace } from "./workspace";

export interface EvidenceDownload {
  status: number;
  body: string;
  filename: string | null;
}

export async function serveEvidencePack(): Promise<EvidenceDownload> {
  const workspace = readPilotWorkspace();
  if (!workspace) return { status: 404, body: JSON.stringify({ error: "No pilot is configured." }), filename: null };

  const target = { kind: PILOT_AUDIT_KINDS.programme, id: workspace.pilot.id };
  const authorized = await authorizeConsoleAction("release.generate-evidence-pack", target);
  if (!authorized.ok) return { status: 403, body: JSON.stringify({ error: authorized.reason.en }), filename: null };
  if (!pilotPageAllowed(authorized.actor.personaId, "evidence-pack").canOpen) {
    return { status: 403, body: JSON.stringify({ error: "The pilot evidence pack is open to the Pilot Lead and the Platform Product Owner." }), filename: null };
  }

  const built = buildPilotEvidencePack(workspace);
  if (!built.ok) return { status: 500, body: JSON.stringify({ error: built.reason }), filename: null };

  recordConsoleRead("release.generate-evidence-pack", authorized.actor, target, {
    en: `Pilot evidence pack generated for ${workspace.pilot.id}, digest ${built.pack.digest.slice(0, 16)}.`,
    de: `Pilot-Nachweispaket fuer ${workspace.pilot.id} erzeugt.`,
  });
  const stamp = built.pack.generatedAt.slice(0, 19).replace(/[:T]/g, "-");
  return { status: 200, body: built.body, filename: `pilot-evidence-${workspace.pilot.id}-${stamp}.json` };
}

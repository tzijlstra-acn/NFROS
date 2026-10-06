/**
 * SourceLoader: lifecycle steps 2 and 3, load the sources and say how they are.
 *
 * Each source in the stage contract names a registered loader and, when the
 * data comes from a connected system, the connector instance that supplies it.
 * The loader reads the database; this module decides the status around it.
 *
 * Three honest answers are distinguished, because they mean different things
 * to the professional and the copy has to say which:
 *
 *   empty         the read worked and returned nothing (zero recorded losses
 *                 is a finding, not a gap)
 *   stale         the read worked and a record is marked stale
 *   unavailable   the read did not happen: the connected system is down, or
 *                 no loader exists in this build
 *
 * A required source that is unavailable parks the AI preparation as Waiting
 * for source. A helpful source that is unavailable only limits it.
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { connectorInstances } from "@/db/schema/integration";
import type { Bilingual, RoleProcessStage, StageSourceSpec } from "@/role-apps/contracts";
import { getSourceLoader, type SourceLoaderContext } from "./registry";
import type { LoadedSource, SourceLoadResult } from "./types";
import { createLogger } from "@/server/logging/redact";

const log = createLogger("process-sources");

const EMPTY_RESULT: SourceLoadResult = {
  status: "unavailable",
  records: [],
  evidenceIds: [],
  asOf: null,
  note: null,
};

interface ConnectorCheck {
  available: boolean;
  mode: string | null;
  name: string | null;
  reason: Bilingual | null;
}

function checkConnector(connectorInstanceId: string | null): ConnectorCheck {
  if (connectorInstanceId === null) return { available: true, mode: null, name: null, reason: null };

  const instance = getDb()
    .select()
    .from(connectorInstances)
    .where(eq(connectorInstances.id, connectorInstanceId))
    .get();

  if (!instance) {
    return {
      available: false,
      mode: null,
      name: connectorInstanceId,
      reason: {
        en: `The connected system ${connectorInstanceId} is not configured in this deployment.`,
        de: `Das angebundene System ${connectorInstanceId} ist in dieser Installation nicht eingerichtet.`,
      },
    };
  }

  const down =
    instance.healthState === "unavailable" ||
    instance.mode === "configured-unavailable" ||
    instance.mode === "planned";

  if (down) {
    return {
      available: false,
      mode: instance.mode,
      name: instance.sourceSystem,
      reason: {
        en: `${instance.sourceSystem} is unavailable. ${instance.healthMessage}`.trim(),
        de: `${instance.sourceSystem} ist nicht verfuegbar.`,
      },
    };
  }

  return { available: true, mode: instance.mode, name: instance.sourceSystem, reason: null };
}

function loadOne(
  spec: StageSourceSpec,
  necessity: "required" | "helpful",
  context: SourceLoaderContext,
): LoadedSource {
  const connector = checkConnector(spec.connectorInstanceId);
  if (!connector.available) {
    return {
      spec,
      necessity,
      status: "unavailable",
      result: EMPTY_RESULT,
      connectorMode: connector.mode,
      connectorName: connector.name,
      unavailableReason: connector.reason,
    };
  }

  const loader = getSourceLoader(spec.loader);
  if (!loader) {
    return {
      spec,
      necessity,
      status: "unavailable",
      result: EMPTY_RESULT,
      connectorMode: connector.mode,
      connectorName: connector.name,
      unavailableReason: {
        en: "No loader for this source is implemented in this build.",
        de: "Fuer diese Quelle ist in diesem Build kein Ladevorgang umgesetzt.",
      },
    };
  }

  try {
    const result = loader(context);
    return {
      spec,
      necessity,
      status: result.status,
      result,
      connectorMode: connector.mode,
      connectorName: connector.name,
      /* A loader that finds its record not yet in existence says why in its note. */
      unavailableReason: result.status === "unavailable" ? result.note : null,
    };
  } catch (error) {
    log.warn("A stage source could not be read.", { loader: spec.loader, error });
    return {
      spec,
      necessity,
      status: "unavailable",
      result: EMPTY_RESULT,
      connectorMode: connector.mode,
      connectorName: connector.name,
      unavailableReason: {
        en: "The source could not be read. The failure is recorded in the server log.",
        de: "Die Quelle konnte nicht gelesen werden. Der Fehler ist im Serverprotokoll erfasst.",
      },
    };
  }
}

/** Loads every required and helpful source of a stage. Never throws. */
export function loadStageSources(context: SourceLoaderContext): LoadedSource[] {
  const stage: RoleProcessStage = context.stage;
  return [
    ...stage.requiredSources.map((spec) => loadOne(spec, "required", context)),
    ...stage.helpfulSources.map((spec) => loadOne(spec, "helpful", context)),
  ];
}

/** Required sources that could not be read. These hold the preparation. */
export function unavailableRequiredSources(sources: readonly LoadedSource[]): LoadedSource[] {
  return sources.filter((source) => source.necessity === "required" && source.status === "unavailable");
}

/** Every evidence identifier the loaded sources returned. The citation whitelist. */
export function knownEvidenceIds(sources: readonly LoadedSource[]): Set<string> {
  const ids = new Set<string>();
  for (const source of sources) {
    for (const id of source.result.evidenceIds) ids.add(id);
    for (const record of source.result.records) for (const id of record.evidenceIds) ids.add(id);
  }
  return ids;
}

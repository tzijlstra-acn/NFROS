/**
 * Connector registration.
 *
 * Importing this module registers every connector implementation in this
 * build. It is imported by `IntegrationRuntime`, which is the entry point the
 * rest of the application uses, so nothing else has to remember to do it.
 *
 * Registration is idempotent through `registerConnectorsOnce`. Without the
 * guard, the module would throw on a second import in a test file that
 * imports both the runtime and a connector module directly, because
 * `registerConnector` refuses to overwrite a key. Refusing to overwrite is the
 * right behaviour and the guard is the right way to live with it.
 */

import { registerConnector, hasConnector } from "@/integrations/core/ConnectorRegistry";
import { grcSimulatorFactory, GRC_SIMULATOR_KEY } from "./grc";
import { microsoft365Factory, MICROSOFT_365_KEY } from "./microsoft365";
import { processIntelligenceFactory, PROCESS_INTELLIGENCE_KEY } from "./process-intelligence";
import { documentRepositoryFactory, DOCUMENT_REPOSITORY_KEY } from "./document-repository";
import { genericWebhookFactory, GENERIC_WEBHOOK_KEY } from "../webhook";
import {
  genericRestFactory,
  GENERIC_REST_KEY,
  plannedAdapterFactory,
  PLANNED_ADAPTERS,
} from "../generic-rest";
import { microsoftGraphFactory, MICROSOFT_GRAPH_KEY } from "../microsoft-graph";

let registered = false;

export function registerConnectorsOnce(): void {
  if (registered) return;
  registered = true;

  /* The five simulated instances the brief names. */
  if (!hasConnector(MICROSOFT_365_KEY)) registerConnector(MICROSOFT_365_KEY, microsoft365Factory);
  if (!hasConnector(GRC_SIMULATOR_KEY)) registerConnector(GRC_SIMULATOR_KEY, grcSimulatorFactory);
  if (!hasConnector(PROCESS_INTELLIGENCE_KEY)) {
    registerConnector(PROCESS_INTELLIGENCE_KEY, processIntelligenceFactory);
  }
  if (!hasConnector(DOCUMENT_REPOSITORY_KEY)) {
    registerConnector(DOCUMENT_REPOSITORY_KEY, documentRepositoryFactory);
  }
  if (!hasConnector(GENERIC_WEBHOOK_KEY)) {
    registerConnector(GENERIC_WEBHOOK_KEY, genericWebhookFactory);
  }

  /* The sandbox or live capable adapter. */
  if (!hasConnector(MICROSOFT_GRAPH_KEY)) {
    registerConnector(MICROSOFT_GRAPH_KEY, microsoftGraphFactory);
  }

  /* The configured but unreachable generic adapter. */
  if (!hasConnector(GENERIC_REST_KEY)) registerConnector(GENERIC_REST_KEY, genericRestFactory);

  /* The named adapters on the roadmap, each refusing every operation. */
  for (const spec of PLANNED_ADAPTERS) {
    if (!hasConnector(spec.key)) registerConnector(spec.key, plannedAdapterFactory(spec));
  }
}

export { GRC_SIMULATOR_KEY, GRC_SIMULATOR_CAPABILITIES, GRC_SYSTEM_KEY } from "./grc";
export {
  MICROSOFT_365_KEY,
  MICROSOFT_365_CAPABILITIES,
  MICROSOFT_365_SYSTEM_KEY,
} from "./microsoft365";
export {
  PROCESS_INTELLIGENCE_KEY,
  PROCESS_INTELLIGENCE_CAPABILITIES,
  PROCESS_INTELLIGENCE_SYSTEM_KEY,
  PROCESS_DEVIATION_EVENT,
  processDeviationSignal,
} from "./process-intelligence";
export {
  DOCUMENT_REPOSITORY_KEY,
  DOCUMENT_REPOSITORY_CAPABILITIES,
  DOCUMENT_REPOSITORY_SYSTEM_KEY,
} from "./document-repository";
export {
  applyExternalWrite,
  countExternalObjects,
  countWriteAttempts,
  isSystemAvailable,
  listExternalObjects,
  resetExternalStore,
  setSystemAvailability,
} from "./external-store";

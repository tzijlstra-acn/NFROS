/**
 * The document repository simulator.
 *
 * Stands in for the evidence vault, which in this synthetic institution is
 * "SYS-0032 Arcadia Evidence Vault". It projects the seeded evidence corpus,
 * including the documents the seed marks stale, which matters more than it
 * looks: the staleness flag on a document and the freshness state of the
 * connector are different claims, and the product needs both. A current
 * connector can hold a document that is itself out of date, and the interface
 * has to be able to say so.
 *
 * Read only, with attachments and deep linking. There is no write capability
 * because the product requests documents rather than depositing them, and
 * `requestEvidenceDocument` is a local action that records a request.
 */

import type { ConnectorCapabilities } from "@/integrations/core/Connector";
import { simulatedConnector } from "./base";
import { documentRecords } from "./scenario-source";

export const DOCUMENT_REPOSITORY_KEY = "simulated.document-repository";
export const DOCUMENT_REPOSITORY_SYSTEM_KEY = "document-repository-simulator";

export const DOCUMENT_REPOSITORY_CAPABILITIES: ConnectorCapabilities = {
  read: ["dms.document"],
  search: ["dms.document"],
  events: ["dms.document.added", "dms.document.superseded"],
  draft: [],
  write: [],
  attachments: true,
  deepLinks: true,
  deltaSync: true,
  /*
   * No webhooks. A document repository in this institution is polled, and
   * saying otherwise would make the freshness indicator report "live" for a
   * source that is in fact read on a schedule.
   */
  webhooks: false,
};

export const documentRepositoryFactory = simulatedConnector({
  key: DOCUMENT_REPOSITORY_KEY,
  packId: "document-knowledge",
  displayName: "Document repository simulator",
  sourceSystem: "Document repository",
  vendorLabel: "Simulator for a document and knowledge repository",
  endpointLabel: "In process simulator over the seeded evidence corpus",
  deepLinkTemplate: "https://evidence.arcadia.example/document/{externalId}",
  readinessNote:
    "Simulated. Projects the seeded evidence corpus including the documents marked stale. Read only. No vendor adapter is implemented.",
  capabilities: DOCUMENT_REPOSITORY_CAPABILITIES,
  idPrefix: "DMS",
  systemKey: DOCUMENT_REPOSITORY_SYSTEM_KEY,
  projections: {
    "dms.document": (runId: string) => documentRecords(runId),
  },
  statement: (envelope, externalId) => ({
    /* Unreachable: the write array is empty. Kept honest rather than removed. */
    en: `${envelope.intentStatement} recorded in the document repository as ${externalId}.`,
    de: `${envelope.intentStatement} im Dokumentenarchiv als ${externalId} erfasst.`,
  }),
  subscription: {
    mechanism: "polling",
    eventTypes: DOCUMENT_REPOSITORY_CAPABILITIES.events,
    endpointLabel: "Polled by the sync coordinator",
    active: true,
    note: "Polled rather than pushed, so data from this source is reported as current at best and never as live.",
  },
});

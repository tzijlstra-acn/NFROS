/**
 * The Microsoft 365 simulator.
 *
 * Stands in for the collaboration suite: mail, calendar, meetings, chat
 * messages and the people directory. It projects the seeded inbox, the seeded
 * meetings, the seeded collaboration messages and the people register, so the
 * integration centre and the personal work layer are looking at the same
 * messages rather than at two parallel inboxes.
 *
 * It has one write capability, and the restriction on it is the important
 * part. `m365.chatMessage` writes an internal collaboration message. There is
 * no capability for mail, because sending mail outside this machine is a
 * registered PROHIBITED tool, and a connector that declared the capability
 * would create the impression that the refusal is a configuration choice
 * rather than a design decision.
 *
 * This connector is also what the Microsoft Graph adapter degrades to when no
 * credential is configured, which is why its projections are exported.
 */

import type { ConnectorCapabilities, OutboundCommandEnvelope } from "@/integrations/core/Connector";
import { simulatedConnector } from "./base";
import {
  collaborationRecords,
  mailRecords,
  meetingRecords,
  personRecords,
} from "./scenario-source";

export const MICROSOFT_365_KEY = "simulated.microsoft-365";
export const MICROSOFT_365_SYSTEM_KEY = "microsoft-365-simulator";

export const MICROSOFT_365_CAPABILITIES: ConnectorCapabilities = {
  read: ["m365.message", "m365.event", "m365.chatMessage", "m365.user"],
  search: ["m365.message", "m365.chatMessage"],
  events: ["m365.message.received", "m365.event.updated", "m365.chatMessage.posted"],
  draft: ["m365.message", "m365.chatMessage"],
  /* Chat only. Mail is absent because `sendExternalEmail` is a PROHIBITED
   * tool and this capability list must not imply otherwise. */
  write: ["m365.chatMessage"],
  attachments: true,
  deepLinks: true,
  deltaSync: true,
  webhooks: true,
};

/** The projections the Graph adapter reuses when it degrades. */
export const MICROSOFT_365_PROJECTIONS = {
  "m365.message": mailRecords,
  "m365.event": meetingRecords,
  "m365.chatMessage": collaborationRecords,
  "m365.user": personRecords,
};

function statement(
  envelope: OutboundCommandEnvelope,
  externalId: string,
): { en: string; de: string } {
  return {
    en: `Internal collaboration message posted as ${externalId}. Simulated only: it never reaches a recipient outside this machine.`,
    de: `Interne Nachricht als ${externalId} veroeffentlicht. Nur simuliert: sie erreicht keinen Empfaenger ausserhalb dieses Rechners.`,
  };
}

export const microsoft365Factory = simulatedConnector({
  key: MICROSOFT_365_KEY,
  packId: "microsoft-365",
  displayName: "Microsoft 365 simulator",
  sourceSystem: "Microsoft 365",
  vendorLabel: "Simulator for a collaboration suite",
  endpointLabel: "In process simulator over the seeded mail, calendar and chat",
  deepLinkTemplate: "https://workspace.arcadia.example/item/{externalId}",
  readinessNote:
    "Simulated. Projects the seeded inbox, meetings, collaboration messages and people register. Writes a simulated internal message only. No Graph call is made.",
  capabilities: MICROSOFT_365_CAPABILITIES,
  idPrefix: "M365",
  systemKey: MICROSOFT_365_SYSTEM_KEY,
  projections: MICROSOFT_365_PROJECTIONS,
  statement,
  subscription: {
    mechanism: "simulated",
    eventTypes: MICROSOFT_365_CAPABILITIES.events,
    endpointLabel: "Simulated webhook at /api/integrations/webhook/simulated.microsoft-365",
    active: true,
    note: "Simulated deliveries only. No Graph change notification subscription exists.",
  },
});

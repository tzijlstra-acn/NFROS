/**
 * Where an inbox message came from, in the plan's six source kinds.
 *
 * Pure. The plan names six sources for one unified inbox: mail,
 * collaboration, the GRC queue, a monitoring event, a service-management
 * update and a supplier submission. The seeded inbox carries five transport
 * channels (`inbox_messages.channel`); the sixth, a supplier submission, is a
 * message a supplier's own contact sent about the supplier's evidence or
 * arrangement, whatever transport carried it. It is derived here from the
 * sender's record (an external person) and what the message is about, and the
 * transport is still shown beside it, so the label adds a fact rather than
 * hiding one.
 *
 * Every message in this release is synthetic and no connector delivered it.
 * The Microsoft 365 and GRC connectors are simulated projections of the same
 * seeded rows, so each source is labelled Simulated, in the product's status
 * vocabulary, wherever it is shown.
 */

import type { Pair } from "../../copy";
import type { InboxRow, WorkSharedData } from "../../shared";

export const INBOX_SOURCE_KINDS = [
  "mail",
  "collaboration",
  "grc-queue",
  "monitoring-event",
  "service-management",
  "supplier-submission",
] as const;

export type InboxSourceKind = (typeof INBOX_SOURCE_KINDS)[number];

export const SOURCE_LABELS: Record<InboxSourceKind, Pair> = {
  mail: { en: "Mail", de: "E-Mail" },
  collaboration: { en: "Collaboration", de: "Zusammenarbeit" },
  "grc-queue": { en: "GRC queue", de: "GRC-Warteschlange" },
  "monitoring-event": { en: "Monitoring event", de: "Ueberwachungsereignis" },
  "service-management": { en: "Service-management update", de: "Service-Management-Meldung" },
  "supplier-submission": { en: "Supplier submission", de: "Lieferanteneinreichung" },
};

/** The transport channels, as the seeded rows name them. */
export const CHANNEL_LABELS: Record<string, Pair> = {
  mail: { en: "Mail", de: "E-Mail" },
  collaboration: { en: "Collaboration", de: "Zusammenarbeit" },
  "grc-queue": { en: "GRC queue", de: "GRC-Warteschlange" },
  "service-management": { en: "Service management", de: "Service-Management" },
  alert: { en: "Monitoring alert", de: "Ueberwachungsalarm" },
};

const CHANNEL_SOURCE: Record<string, InboxSourceKind> = {
  mail: "mail",
  collaboration: "collaboration",
  "grc-queue": "grc-queue",
  alert: "monitoring-event",
  "service-management": "service-management",
};

/**
 * Object kinds a supplier's own submission is about: the supplier, its
 * services, subcontractors and arrangements, and the evidence it provides.
 */
const SUPPLIER_OBJECT_KINDS: ReadonlySet<string> = new Set([
  "supplier",
  "subprocessor",
  "service",
  "contract",
  "contract-appendix",
  "evidence-document",
]);

export interface MessageSource {
  kind: InboxSourceKind | null;
  /** The source label, or the raw channel when it is not one the inbox knows. */
  label: Pair;
  /** The transport, shown beside a derived source so it is never hidden. */
  channel: Pair;
  /** Always true in this release: no connector delivered any message. */
  simulated: boolean;
  /** True for a sender with a person record the reply can be addressed to. */
  replyable: boolean;
  /** True when the sender is a person outside the institution. */
  external: boolean;
}

export function messageSource(
  row: Pick<InboxRow, "channel" | "fromUserId" | "relatedObjectKind">,
  shared: Pick<WorkSharedData, "people">,
): MessageSource {
  const channel = CHANNEL_LABELS[row.channel] ?? { en: row.channel, de: row.channel };
  const sender = row.fromUserId ? shared.people.get(row.fromUserId) : undefined;
  const external = sender?.line === "external";
  const base = CHANNEL_SOURCE[row.channel] ?? null;
  const supplierSubmission =
    external && row.relatedObjectKind !== null && SUPPLIER_OBJECT_KINDS.has(row.relatedObjectKind);
  const kind: InboxSourceKind | null = supplierSubmission ? "supplier-submission" : base;
  return {
    kind,
    label: kind ? SOURCE_LABELS[kind] : channel,
    channel,
    simulated: true,
    replyable: sender !== undefined,
    external,
  };
}

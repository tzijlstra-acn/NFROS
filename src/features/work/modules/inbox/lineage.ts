/**
 * What an inbox message became, read from the stored lineage.
 *
 * Pure. Since migration 0008 the message records what it became
 * (`conversion_kind`, with who and when), who confirmed its classification
 * and why, the evidence document it was filed as and the colleague it was
 * delegated to. The work it became carries the other direction:
 *
 *   an action raised from the message carries `actions.source_message_id`,
 *   and the message carries `linked_action_id`;
 *   an evidence document filed from it carries
 *   `evidence_documents.source_message_id`;
 *   a decision it was routed to is `inbox_messages.linked_decision_id`;
 *   a process stage it joined holds it as a stage input
 *   (`process_stage_inputs`, source kind message), which the process engine
 *   reads into the stage;
 *   a delegation or a reply is a simulated collaboration message of that
 *   `kind` that points at the message.
 *
 * Who did it is the stored attribution where the message records it; the
 * backbone event the handler published in the same transaction supplies the
 * scenario moment, and who did a later conversion the row does not hold.
 *
 * A message is in exactly one place, by its stored conversion:
 *
 *   Converted to work   `conversion_kind` is a work kind: it became an
 *                       action, a decision input, evidence, a process input
 *                       or a delegation;
 *   Handled             it was dismissed (`conversion_kind` dismissed),
 *                       filed as information or answered, and needs nothing
 *                       further. Filed and answered are not conversions, so
 *                       they are read from the classification and the reply;
 *   Needs me            everything else. A message the AI proposes as noise
 *                       stays here, in its own group, until a person
 *                       dismisses it: the AI never clears a message on its
 *                       own.
 */

import type { OsEventView } from "@/features/events/backbone";
import type { WorkActionRow, WorkEvidenceRow, WorkFollowUpRow } from "@/db/repositories/work-hub";
import type { ProcessStageInput } from "@/db/repositories/process-stage-inputs";
import { INBOX_WORK_CONVERSION_KINDS, type InboxConversionKind } from "@/db/schema/work";
import type { Language } from "@/i18n/labels";
import { fill, say } from "../../copy";
import { timeOf, type RelatedLink } from "../../model";
import { processLink } from "../../related";
import { actionTitle, decisionTitle, objectName, personName, type InboxRow, type WorkSharedData } from "../../shared";
import { itemHref } from "../../url";
import { INBOX_COPY } from "./copy";
import { isInboxClassification, type InboxClassification, type TriageProposal } from "./triage-schema";

/* ==========================================================================
   The event contract the handlers publish and this module reads
   ========================================================================== */

export const INBOX_EVENT_SOURCE = "inbox" as const;

/**
 * The channel names a delegation and a reply are recorded under. Shown on the
 * trust page as they are. They are labels only: what a simulated message is
 * comes from `collaboration_messages.kind`.
 */
export const DELEGATION_CHANNEL = "Inbox delegation";
export const REPLY_CHANNEL = "Inbox reply";

export type InboxEventOperation = "triage" | "link" | "evidence" | "process" | "delegate" | "reply";

/**
 * The payload of every inbox event. Structured detail only: identifiers,
 * classifications and the person's own reason. Never the message text, which
 * is an external party's free text.
 */
export interface InboxEventPayload {
  source: typeof INBOX_EVENT_SOURCE;
  messageId: string;
  operation: InboxEventOperation;
  toolName: string;
  outcome: "executed";
  from?: string | null;
  to?: string;
  reason?: string;
  targetKind?: "action" | "decision";
  targetId?: string;
  created?: boolean;
  evidenceDocumentId?: string;
  objectIds?: string[];
  processRunId?: string;
  stageId?: string;
  stageRunId?: string | null;
  collaborationMessageId?: string;
  toUserIds?: string[];
}

export interface InboxEventFact {
  id: string;
  sequence: number;
  type: string;
  atMoment: string;
  occurredAt: string;
  actorUserId: string | null;
  summary: string;
  processRunId: string | null;
  stageId: string | null;
  payload: InboxEventPayload;
}

const OPERATIONS: readonly InboxEventOperation[] = ["triage", "link", "evidence", "process", "delegate", "reply"];

/** Reads one backbone event as an inbox event, or null when it is not one. */
export function readInboxEvent(event: Pick<OsEventView, "id" | "sequence" | "type" | "atMoment" | "occurredAt" | "actorUserId" | "summary" | "processRunId" | "stageId" | "payload">): InboxEventFact | null {
  const payload = event.payload;
  if (payload["source"] !== INBOX_EVENT_SOURCE) return null;
  const messageId = payload["messageId"];
  const operation = payload["operation"];
  if (typeof messageId !== "string" || !OPERATIONS.includes(operation as InboxEventOperation)) return null;
  return {
    id: event.id,
    sequence: event.sequence,
    type: event.type,
    atMoment: event.atMoment,
    occurredAt: event.occurredAt,
    actorUserId: event.actorUserId,
    summary: event.summary,
    processRunId: event.processRunId,
    stageId: event.stageId,
    payload: payload as unknown as InboxEventPayload,
  };
}

/* ==========================================================================
   Lineage
   ========================================================================== */

export type ConversionKind = Exclude<InboxConversionKind, "dismissed">;

/** True when the stored conversion is work (not a dismissal, and not nothing). */
export function isWorkConversion(kind: InboxConversionKind | null | undefined): kind is ConversionKind {
  return kind !== null && kind !== undefined && INBOX_WORK_CONVERSION_KINDS.includes(kind);
}
export type InboxPlace = "needs-me" | "converted" | "handled";
export type InboxClosure = "filed" | "dismissed" | "replied";

export interface ConversionFact {
  kind: ConversionKind;
  id: string;
  label: string;
  /** The short form for a queue chip. */
  chip: string;
  note: string;
  href: string | null;
  link: RelatedLink | null;
  at: string | null;
  by: string | null;
  /** For a process conversion, the stage's name. */
  stage?: string;
}

export interface ReplyFact {
  id: string;
  subject: string;
  to: string;
  at: string;
  by: string | null;
}

export interface TriageFact {
  eventId: string;
  from: string | null;
  to: InboxClassification;
  reason: string;
  at: string;
  by: string | null;
}

export interface MessageLineage {
  place: InboxPlace;
  likelyNoise: boolean;
  confirmed: InboxClassification | null;
  /** The person's classification when there is one, otherwise the validated proposal's. */
  effective: InboxClassification | null;
  conversions: ConversionFact[];
  closure: InboxClosure | null;
  replies: ReplyFact[];
  /** Every triage the person recorded, oldest first. */
  triage: TriageFact[];
  filed: WorkEvidenceRow[];
  action: WorkActionRow | null;
  /** The delegate, when the message was delegated. */
  delegatedTo: { userId: string; name: string } | null;
}

export interface LineageInput {
  filed: readonly WorkEvidenceRow[];
  raised: readonly WorkActionRow[];
  outbound: readonly WorkFollowUpRow[];
  /** The stage inputs the message is (`findStageInputsForSource("message", id)`). */
  stageInputs: readonly ProcessStageInput[];
  events: readonly InboxEventFact[];
  proposal: TriageProposal | null;
}

export const EMPTY_LINEAGE_INPUT: LineageInput = { filed: [], raised: [], outbound: [], stageInputs: [], events: [], proposal: null };

function eventFor(events: readonly InboxEventFact[], test: (payload: InboxEventPayload) => boolean): InboxEventFact | undefined {
  return [...events].reverse().find((event) => test(event.payload));
}

function evidenceTitle(doc: WorkEvidenceRow, language: Language): string {
  return language === "de" && doc.titleDe.length > 0 ? doc.titleDe : doc.title;
}

export function deriveLineage(
  row: InboxRow,
  input: LineageInput,
  shared: Pick<WorkSharedData, "language" | "roleId" | "actions" | "decisions" | "people" | "processScopes" | "objectLabels">,
): MessageLineage {
  const { language, roleId } = shared;
  const t = (pair: { en: string; de: string }) => say(pair, language);
  const by = (event: InboxEventFact | undefined) => (event ? personName(shared, event.actorUserId) : null);
  /*
   * The stored attribution describes the message's first conversion to work,
   * of the kind `conversion_kind` names, whatever that kind is. It attributes
   * the first fact of that kind; any later conversion is attributed by its own
   * event. The event's scenario moment is preferred for when, because the
   * stored time is the machine's clock and the inbox speaks in the day's.
   */
  const storedKind = isWorkConversion(row.conversionKind) ? row.conversionKind : null;
  const rowBy = personName(shared, row.convertedByUserId ?? null);
  const rowAt = row.convertedAt ? timeOf(row.convertedAt) : null;
  const attributed = new Set<ConversionKind>();
  const attribution = (kind: ConversionKind, event: InboxEventFact | undefined): { at: string | null; by: string | null } => {
    const first = kind === storedKind && !attributed.has(kind);
    attributed.add(kind);
    return { at: event?.atMoment ?? (first ? rowAt : null), by: (first ? rowBy : null) ?? by(event) };
  };
  const conversions: ConversionFact[] = [];

  /* Actions: the link on the message, and any action that names the message as its source. */
  const actionIds = [...new Set([row.linkedActionId, ...input.raised.map((action) => action.id)].filter((id): id is string => typeof id === "string" && id.length > 0))];
  let firstAction: WorkActionRow | null = null;
  for (const id of actionIds) {
    const action = shared.actions.find((candidate) => candidate.id === id) ?? input.raised.find((candidate) => candidate.id === id) ?? null;
    if (action && !firstAction) firstAction = action;
    const event = eventFor(input.events, (payload) => payload.operation === "link" && payload.targetKind === "action" && payload.targetId === id);
    const raised = action?.sourceMessageId === row.id || event?.payload.created === true;
    const title = action ? actionTitle(action, language) : id;
    conversions.push({
      kind: "action",
      id,
      label: title,
      chip: fill(t(INBOX_COPY.becameAction), { id }),
      note: t(raised ? INBOX_COPY.raisedFrom : INBOX_COPY.linkedFrom),
      href: itemHref(roleId, "actions", id),
      link: { kind: "action", id, label: title, href: itemHref(roleId, "actions", id), note: t(raised ? INBOX_COPY.raisedFrom : INBOX_COPY.linkedFrom) },
      ...attribution("action", event),
    });
  }

  /* The decision it was routed to. */
  if (row.linkedDecisionId) {
    const decision = shared.decisions.find((candidate) => candidate.id === row.linkedDecisionId);
    const event = eventFor(input.events, (payload) => payload.operation === "link" && payload.targetKind === "decision" && payload.targetId === row.linkedDecisionId);
    const title = decision ? decisionTitle(decision, language) : row.linkedDecisionId;
    const href = `/workday/${roleId}/decisions#${encodeURIComponent(row.linkedDecisionId)}`;
    conversions.push({
      kind: "decision",
      id: row.linkedDecisionId,
      label: title,
      chip: fill(t(INBOX_COPY.becameDecision), { id: row.linkedDecisionId }),
      note: t(INBOX_COPY.routedTo),
      href,
      link: { kind: "decision", id: row.linkedDecisionId, label: title, href, note: t(INBOX_COPY.routedTo) },
      ...attribution("decision", event),
    });
  }

  /* Evidence documents filed from it. */
  for (const doc of input.filed) {
    const event = eventFor(input.events, (payload) => payload.operation === "evidence" && payload.evidenceDocumentId === doc.id);
    const objects = doc.relatedObjectIds.filter((id) => id !== row.id);
    const objectText = objects
      .map((id) => {
        const name = objectName({ objectLabels: shared.objectLabels, language }, id);
        return name === id ? id : `${id} ${name}`;
      })
      .join(", ");
    conversions.push({
      kind: "evidence",
      id: doc.id,
      label: evidenceTitle(doc, language),
      chip: fill(t(INBOX_COPY.becameEvidence), { id: doc.id }),
      note: objects.length > 0 ? fill(t(INBOX_COPY.filedAgainst), { objects: objectText }) : t(INBOX_COPY.filedFrom),
      href: null,
      link: { kind: "evidence", id: doc.id, label: `${doc.id} ${evidenceTitle(doc, language)}`, href: null, drawerTab: "evidence", note: t(INBOX_COPY.filedFrom) },
      ...attribution("evidence", event),
    });
  }

  /* Process stages it joined: the stage inputs it is, each with who attached it and when. */
  for (const stageInput of input.stageInputs) {
    if (stageInput.sourceKind !== "message" || stageInput.sourceId !== row.id) continue;
    const runId = stageInput.processRunId;
    const stageId = stageInput.stageId;
    const scope = shared.processScopes.find((candidate) => candidate.roleAppRunId === runId);
    const stageLabel = scope?.stageNames[stageId];
    const stageName = stageLabel ? say(stageLabel, language) : stageId;
    const link = scope ? processLink(scope, language, stageId) : null;
    conversions.push({
      kind: "process",
      id: `${runId}:${stageId}`,
      label: scope ? say(scope.processName, language) : runId,
      chip: fill(t(INBOX_COPY.becameStage), { stage: stageName }),
      note: fill(t(INBOX_COPY.attachedTo), { stage: stageName }),
      href: link?.href ?? null,
      link: link ? { ...link, note: fill(t(INBOX_COPY.attachedTo), { stage: stageName }) } : null,
      at: stageInput.addedAtMoment,
      by: personName(shared, stageInput.addedByUserId),
      stage: stageName,
    });
  }

  /* A delegation, and the replies: simulated messages of those kinds. The delegate is the one the message records. */
  const delegatedTo: MessageLineage["delegatedTo"] = row.delegatedToUserId
    ? { userId: row.delegatedToUserId, name: personName(shared, row.delegatedToUserId) ?? row.delegatedToUserId }
    : null;
  const replies: ReplyFact[] = [];
  for (const sent of input.outbound) {
    const event = eventFor(input.events, (payload) => payload.collaborationMessageId === sent.id);
    if (sent.kind === "delegation") {
      const recipient = sent.toUserIds[0] ?? "";
      const name = personName(shared, recipient) ?? recipient;
      conversions.push({
        kind: "delegated",
        id: sent.id,
        label: name,
        chip: fill(t(INBOX_COPY.becameDelegated), { name }),
        note: t(INBOX_COPY.delegatedTo),
        href: null,
        link: null,
        ...attribution("delegated", event),
        at: sent.sentAtMoment,
      });
    } else if (sent.kind === "reply") {
      replies.push({
        id: sent.id,
        subject: sent.subject,
        to: sent.toUserIds.map((id) => personName(shared, id) ?? id).join(", ") || row.fromLabel,
        at: sent.sentAtMoment,
        by: by(event),
      });
    }
  }

  /* The person's triage, oldest first, and what the message is classified as. */
  const triage: TriageFact[] = input.events
    .filter((event) => event.payload.operation === "triage" && isInboxClassification(event.payload.to))
    .map((event) => ({
      eventId: event.id,
      from: event.payload.from ?? null,
      to: event.payload.to as InboxClassification,
      reason: event.payload.reason ?? "",
      at: event.atMoment,
      by: personName(shared, event.actorUserId),
    }));
  const confirmed = isInboxClassification(row.confirmedTriage) ? row.confirmedTriage : null;
  const effective = confirmed ?? input.proposal?.classification ?? null;

  /* The place is the stored conversion. Filed and answered are not conversions, so they are read as they are. */
  const converted = storedKind !== null;
  const closure: InboxClosure | null = converted
    ? null
    : row.conversionKind === "dismissed"
      ? "dismissed"
      : confirmed === "information"
        ? "filed"
        : replies.length > 0
          ? "replied"
          : null;
  const place: InboxPlace = converted ? "converted" : closure ? "handled" : "needs-me";

  return {
    place,
    likelyNoise: place === "needs-me" && confirmed === null && input.proposal?.classification === "noise",
    confirmed,
    effective,
    conversions,
    closure,
    replies,
    triage,
    filed: [...input.filed],
    action: firstAction,
    delegatedTo,
  };
}

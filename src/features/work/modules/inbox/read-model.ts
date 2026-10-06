/**
 * The Inbox module read model: one unified inbox that turns communication
 * into governed work.
 *
 * Pure. Built from the shared hub data and the module's extras (what each
 * message became, read from the objects it became; the backbone events that
 * say who did it; the open process stages a message can join), so the unit
 * tests drive it with plain objects.
 *
 * For every message it shows the plan's eight facts (section 4.8): source,
 * sender, subject, linked object, proposed classification, the rationale for
 * it, the response deadline, and one primary action. The classification is
 * the AI layer's (`triage.ts`), validated before it is shown, and never shown
 * without its rationale; a message with no valid proposal says so.
 *
 * Three places, each message in exactly one (`lineage.ts`): Needs me,
 * Converted to work, Handled. All shows everything, so a handled message is
 * still one click away, and global search finds it too.
 */

import { AUTHORITY_LABELS } from "@/features/decisions/copy";
import type { Language } from "@/i18n/labels";
import type { WorkActionRow, WorkAuditRow, WorkEvidenceRow, WorkFollowUpRow } from "@/db/repositories/work-hub";
import type { ProcessStageInput } from "@/db/repositories/process-stage-inputs";
import { COPY, KIND_LABELS, fill, say, type Pair } from "../../copy";
import { evidenceRef } from "../../freshness";
import {
  dateOf,
  displayDate,
  minutesOf,
  timeOf,
  type ActivityEntry,
  type AuditRef,
  type DetailBase,
  type DetailFact,
  type EvidenceRef,
  type ModuleQueueView,
  type QueueRowView,
  type WorkChip,
} from "../../model";
import {
  actionLink,
  compactLinks,
  decisionLink,
  evidenceLink,
  auditLink,
  findProcessFor,
  messageLink,
  objectLink,
  processLink,
} from "../../related";
import { directAiContext, partnerTypeFor, subjectAiContext } from "../../selection";
import {
  actionTitle,
  decisionTitle,
  matchesObject,
  messageSubject,
  objectKindLabel,
  objectName,
  personName,
  type InboxRow,
  type WorkSharedData,
} from "../../shared";
import { DEFAULT_QUERY, INBOX_VIEWS, workHref, type InboxViewId, type WorkQuery } from "../../url";
import { INBOX_COPY } from "./copy";
import {
  deriveLineage,
  EMPTY_LINEAGE_INPUT,
  isWorkConversion,
  type ConversionFact,
  type InboxEventFact,
  type InboxPlace,
  type MessageLineage,
  type ReplyFact,
} from "./lineage";
import { messageSource, type MessageSource } from "./sources";
import { proposeTriage, type TriageModeSetting, type TriageResult } from "./triage";
import { INBOX_CLASSIFICATIONS, type InboxClassification } from "./triage-schema";
import { INBOX_TOOLS } from "./tool-names";

/* ==========================================================================
   Extras
   ========================================================================== */

/** One open stage of one of the role's running processes, which a message can join. */
export interface ProcessStageOption {
  processRunId: string;
  processName: Pair;
  subjectId: string;
  scopeIds: readonly string[];
  stageId: string;
  stageName: Pair;
  stageRunId: string;
  current: boolean;
}

export interface InboxExtras {
  /** Evidence documents a message names directly. */
  evidence: ReadonlyMap<string, WorkEvidenceRow>;
  /** Evidence documents filed from each message (`source_message_id`). */
  filed: ReadonlyMap<string, readonly WorkEvidenceRow[]>;
  /** Actions raised from each message (`source_message_id`). */
  raised: ReadonlyMap<string, readonly WorkActionRow[]>;
  /** Simulated delegations and replies about each message. */
  outbound: ReadonlyMap<string, readonly WorkFollowUpRow[]>;
  /** The process stages each message was attached to, as stage inputs. */
  stageInputs: ReadonlyMap<string, readonly ProcessStageInput[]>;
  /** The backbone events the inbox handlers published, per message, oldest first. */
  events: ReadonlyMap<string, readonly InboxEventFact[]>;
  /** Audit rows, loaded for the selected message only. */
  audit: ReadonlyMap<string, readonly WorkAuditRow[]>;
  stages: readonly ProcessStageOption[];
  /** The AI mode the classification runs in. */
  triageMode: TriageModeSetting;
}

export const EMPTY_INBOX_EXTRAS: InboxExtras = {
  evidence: new Map(),
  filed: new Map(),
  raised: new Map(),
  outbound: new Map(),
  stageInputs: new Map(),
  events: new Map(),
  audit: new Map(),
  stages: [],
  triageMode: { mode: "safe", live: false },
};

export const INBOX_MODULE_TOOLS: readonly string[] = INBOX_TOOLS;

/* ==========================================================================
   Operations
   ========================================================================== */

export const INBOX_OPERATIONS = [
  "confirm-triage",
  "change-triage",
  "create-action",
  "link-evidence",
  "add-to-process",
  "delegate",
  "draft-reply",
  "dismiss",
] as const;
export type InboxOperationId = (typeof INBOX_OPERATIONS)[number];

/** The registry tools each operation runs, in order. */
export const INBOX_OPERATION_TOOLS: Readonly<Record<InboxOperationId, readonly string[]>> = {
  "confirm-triage": ["recordInboxTriage"],
  "change-triage": ["recordInboxTriage"],
  "create-action": ["createAction", "linkInboxMessage"],
  "link-evidence": ["fileInboxMessageAsEvidence"],
  "add-to-process": ["addInboxMessageToProcess"],
  delegate: ["delegateInboxMessage"],
  /* Drafting is reachable where sending may not be; the send step carries its own verdict (`forms.send`). */
  "draft-reply": ["draftInboxReply"],
  dismiss: ["recordInboxTriage"],
};

export interface InboxOperationView {
  id: InboxOperationId;
  label: string;
  primary: boolean;
  enabled: boolean;
  disabledReason: string;
  /** True when the message itself rules the operation out, rather than the gate. */
  stateBlocked: boolean;
  authorityLabel: string;
  needsApproval: boolean;
  material: boolean;
  /** Plan section 9.5: what the AI prepared, what the person decides, what changes, what approval. */
  aiPrepared: string;
  youDecide: string;
  willChange: string;
  approval: string;
}

export interface InboxForms {
  classifications: Array<{ id: InboxClassification; label: string }>;
  assignable: Array<{ id: string; label: string }>;
  holderUserId: string | null;
  actionKinds: Array<{ id: string; label: string }>;
  defaultKind: string;
  defaultTitle: string;
  /** ISO date, or empty when the message has no deadline on or after the scenario day. */
  defaultDue: string;
  minDate: string;
  existingAction: { id: string; title: string } | null;
  routeDecision: { id: string; title: string } | null;
  evidenceObjects: Array<{ id: string; label: string; checked: boolean }>;
  defaultEvidenceTitle: string;
  stages: Array<{ value: string; label: string; coversObject: boolean; selected: boolean; warning: string | null }>;
  delegates: Array<{ id: string; label: string; suggested: boolean }>;
  replyTo: string;
  /** Whether a drafted reply can be sent at this autonomy level, in the gate's words when not. */
  send: { enabled: boolean; reason: string; needsApproval: boolean };
}

/* ==========================================================================
   The detail
   ========================================================================== */

export interface InboxDetail extends DetailBase {
  kind: "message";
  source: { label: string; channel: string; simulated: string };
  from: string;
  received: string;
  body: string;
  classification: {
    available: boolean;
    label: string;
    tone: WorkChip["tone"];
    /** True when a person recorded the triage. */
    confirmed: boolean;
    /** The validated proposal's classification, the person's, and the one in force. */
    proposedId: InboxClassification | null;
    confirmedId: InboxClassification | null;
    effectiveId: InboxClassification | null;
    /** The AI proposal, which is shown even after a person classified the message. */
    proposedLabel: string | null;
    rationale: string;
    rationaleNote: string | null;
    confidence: number | null;
    mode: string;
    modeNote: string;
  };
  personTriage: { label: string; note: string; reason: string | null } | null;
  primaryAction: string;
  respondBy: { text: string; passed: boolean } | null;
  place: InboxPlace;
  placeLabel: string;
  conversions: ConversionFact[];
  replies: ReplyFact[];
  closureLabel: string | null;
  operations: InboxOperationView[];
  forms: InboxForms;
  duplicateOf: { id: string; subject: string; href: string } | null;
}

/* ==========================================================================
   Shared derivations
   ========================================================================== */

interface MessageView {
  row: InboxRow;
  source: MessageSource;
  triage: TriageResult;
  lineage: MessageLineage;
}

function knownIdsFor(shared: WorkSharedData, extras: InboxExtras): Set<string> {
  const ids = new Set<string>();
  for (const message of shared.messages) {
    ids.add(message.id);
    for (const id of [message.relatedObjectId, message.linkedActionId, message.linkedDecisionId, message.isDuplicateOf]) {
      if (id) ids.add(id);
    }
  }
  for (const id of shared.people.keys()) ids.add(id);
  for (const decision of shared.decisions) ids.add(decision.id);
  for (const action of shared.actions) ids.add(action.id);
  for (const id of extras.evidence.keys()) ids.add(id);
  return ids;
}

function viewsOf(shared: WorkSharedData, extras: InboxExtras): MessageView[] {
  const known = knownIdsFor(shared, extras);
  return shared.messages.map((row) => {
    const source = messageSource(row, shared);
    const decisionId = row.linkedDecisionId ?? (row.relatedObjectKind === "decision" ? row.relatedObjectId : null);
    const original = row.isDuplicateOf ? (shared.messages.find((candidate) => candidate.id === row.isDuplicateOf) ?? null) : null;
    const triage = proposeTriage(
      row,
      {
        knownIds: known,
        source,
        original,
        decisionStatus: decisionId ? (shared.decisions.find((decision) => decision.id === decisionId)?.status ?? null) : null,
      },
      extras.triageMode,
    );
    const lineage = deriveLineage(
      row,
      {
        ...EMPTY_LINEAGE_INPUT,
        filed: extras.filed.get(row.id) ?? [],
        raised: extras.raised.get(row.id) ?? [],
        outbound: extras.outbound.get(row.id) ?? [],
        stageInputs: extras.stageInputs.get(row.id) ?? [],
        events: extras.events.get(row.id) ?? [],
        proposal: triage.proposal,
      },
      shared,
    );
    return { row, source, triage, lineage };
  });
}

function classificationLabel(shared: WorkSharedData, triage: string | null): { label: string; tone: WorkChip["tone"] } {
  if (!triage) return { label: say(INBOX_COPY.notClassified, shared.language), tone: "neutral" };
  const config = shared.config.inboxClassifications[triage];
  return config ? { label: say(config.label, shared.language), tone: config.tone } : { label: triage, tone: "neutral" };
}

/** A time for today's messages, a date and time for older ones. */
function receivedText(receivedAt: string, scenarioDate: string): string {
  const date = dateOf(receivedAt);
  return date === scenarioDate ? timeOf(receivedAt) : `${displayDate(date)} ${timeOf(receivedAt)}`;
}

/** True when a response deadline is before the scenario clock. */
function deadlinePassed(respondBy: string, shared: Pick<WorkSharedData, "scenarioDate" | "currentMoment">): boolean {
  const day = dateOf(respondBy);
  if (day !== shared.scenarioDate) return day < shared.scenarioDate;
  return minutesOf(timeOf(respondBy)) < minutesOf(shared.currentMoment);
}

function inView(view: InboxViewId, message: MessageView): boolean {
  switch (view) {
    case "needs-triage":
      return message.lineage.place === "needs-me";
    case "converted":
      return message.lineage.place === "converted";
    case "handled":
      return message.lineage.place === "handled";
    case "all":
      return true;
  }
}

function viewLabel(view: InboxViewId): Pair {
  switch (view) {
    case "needs-triage":
      return INBOX_COPY.needsMe;
    case "converted":
      return INBOX_COPY.converted;
    case "handled":
      return INBOX_COPY.handled;
    case "all":
      return INBOX_COPY.all;
  }
}

function closureLabel(lineage: MessageLineage, language: Language): string | null {
  switch (lineage.closure) {
    case "filed":
      return say(INBOX_COPY.closedFiled, language);
    case "dismissed":
      return say(INBOX_COPY.closedDismissed, language);
    case "replied":
      return say(INBOX_COPY.closedReplied, language);
    default:
      return null;
  }
}

export function countInbox(
  shared: WorkSharedData,
  extras: InboxExtras = EMPTY_INBOX_EXTRAS,
): { triage: number; respond: number; duplicates: number; converted: number; handled: number; noise: number } {
  const views = viewsOf(shared, extras);
  const needsMe = views.filter((view) => view.lineage.place === "needs-me");
  return {
    triage: needsMe.filter((view) => !view.lineage.likelyNoise).length,
    respond: needsMe.filter((view) => view.row.requiresResponseBy !== null).length,
    duplicates: views.filter((view) => view.row.isDuplicateOf !== null).length,
    converted: views.filter((view) => view.lineage.place === "converted").length,
    handled: views.filter((view) => view.lineage.place === "handled").length,
    noise: needsMe.filter((view) => view.lineage.likelyNoise).length,
  };
}

/* ==========================================================================
   Search
   ========================================================================== */

/** One message as global search lists it. The shape of `SearchEntry`, kind `message`. */
export interface InboxSearchEntry {
  kind: "message";
  id: string;
  label: string;
  reference: string;
  /** Where it is now: Needs me, or what it became, or how it was handled. Never the message text. */
  detail: string | null;
  href: string;
  keywords: string;
}

/**
 * Every message that has reached the role, in every place, so a message that
 * was converted, filed or dismissed stays findable. It opens in the inbox
 * view that holds it, selected, and is found by its subject in both
 * languages, its sender, its source, its linked object and the identifiers
 * of what it became.
 */
export function buildInboxSearchEntries(shared: WorkSharedData, extras: InboxExtras): InboxSearchEntry[] {
  const { language, roleId } = shared;
  return viewsOf(shared, extras).map(({ row, source, lineage }) => {
    const place = lineage.place === "needs-me" ? "needs-triage" : lineage.place;
    const where =
      lineage.place === "converted"
        ? `${say(INBOX_COPY.converted, language)}: ${lineage.conversions.map((conversion) => conversion.chip).join(", ")}`
        : lineage.place === "handled"
          ? `${say(INBOX_COPY.handled, language)}: ${closureLabel(lineage, language) ?? ""}`
          : say(INBOX_COPY.needsMe, language);
    return {
      kind: "message",
      id: row.id,
      label: messageSubject(row, language),
      reference: row.id,
      detail: `${say(source.label, language)}, ${where}`,
      href: workHref(roleId, DEFAULT_QUERY, { tab: "inbox", inboxView: place, item: row.id }),
      keywords: [
        row.subject,
        row.subjectDe,
        row.fromLabel,
        source.label.en,
        source.label.de,
        row.relatedObjectId ?? "",
        ...lineage.conversions.map((conversion) => conversion.id),
      ].join(" "),
    };
  });
}

/* ==========================================================================
   The queue
   ========================================================================== */

function rowChips(shared: WorkSharedData, message: MessageView): WorkChip[] {
  const { language } = shared;
  const { row, lineage, triage } = message;
  const chips: WorkChip[] = [];
  const label = classificationLabel(shared, lineage.effective);
  if (lineage.confirmed) {
    chips.push({ label: fill(say(INBOX_COPY.confirmedClass, language), { label: label.label }), tone: label.tone });
  } else if (triage.proposal) {
    /* The rationale travels with the chip, as its title, so the classification is never alone. */
    chips.push({
      label: fill(say(INBOX_COPY.aiClass, language), { label: label.label }),
      tone: label.tone,
      title: say({ en: triage.proposal.rationale.en, de: triage.proposal.rationale.de ?? triage.proposal.rationale.en }, language),
    });
  } else {
    chips.push({ label: say(INBOX_COPY.notClassified, language), tone: "neutral", title: say(triage.note, language) });
  }

  if (lineage.place === "converted") {
    const [first, ...rest] = lineage.conversions;
    if (first) chips.push({ label: first.chip, tone: "success", title: first.note });
    if (rest.length > 0) chips.push({ label: fill(say(INBOX_COPY.more, language), { count: rest.length }), tone: "neutral" });
  } else if (lineage.place === "handled") {
    const closed = closureLabel(lineage, language);
    if (closed) chips.push({ label: closed, tone: "neutral" });
  } else {
    if (row.isDuplicateOf) chips.push({ label: say(INBOX_COPY.duplicate, language), tone: "neutral" });
    if (row.requiresResponseBy) {
      chips.push({
        label: fill(say(INBOX_COPY.respondBy, language), { when: receivedText(row.requiresResponseBy, shared.scenarioDate) }),
        tone: deadlinePassed(row.requiresResponseBy, shared) ? "danger" : "warning",
      });
    }
  }
  return chips;
}

function queueRow(shared: WorkSharedData, message: MessageView, query: WorkQuery): QueueRowView {
  const { language, roleId } = shared;
  const { row, source, lineage } = message;
  const needsMe = lineage.place === "needs-me";
  return {
    id: row.id,
    kind: "message",
    /* Today's messages by time, older ones by day and month: the lead column is narrow. */
    lead: dateOf(row.receivedAt) === shared.scenarioDate ? timeOf(row.receivedAt) : displayDate(dateOf(row.receivedAt)).slice(0, 6),
    title: messageSubject(row, language),
    sub: `${say(source.label, language)}, ${row.fromLabel}`,
    chips: rowChips(shared, message),
    trailing: needsMe && !row.isRead ? say(INBOX_COPY.unread, language) : "",
    trailingTone: needsMe && !row.isRead ? "info" : "neutral",
    href: workHref(roleId, query, { item: row.id }),
    selected: query.item === row.id,
    flag: needsMe && row.requiresResponseBy ? (deadlinePassed(row.requiresResponseBy, shared) ? "danger" : "warning") : null,
  };
}

export function buildInboxView(shared: WorkSharedData, extras: InboxExtras, query: WorkQuery): ModuleQueueView {
  const { language, roleId } = shared;
  const views = viewsOf(shared, extras).filter((view) =>
    matchesObject(
      query.object,
      view.row.id,
      view.row.relatedObjectId,
      view.row.linkedActionId,
      view.row.linkedDecisionId,
      ...view.lineage.conversions.map((conversion) => conversion.id),
    ),
  );
  const pool = views.filter((view) => inView(query.inboxView, view));
  const kindOf = (view: MessageView) => view.lineage.effective ?? "unclassified";
  const kinds = [...new Set(pool.map(kindOf))].sort();
  const shown = query.kind ? pool.filter((view) => kindOf(view) === query.kind) : pool;

  const counts = countInbox(shared, extras);
  const emptyText =
    query.inboxView === "converted" ? INBOX_COPY.noneConverted : query.inboxView === "handled" ? INBOX_COPY.noneHandled : INBOX_COPY.noneNeedsMe;

  /*
   * Needs me holds two groups: the messages that need a person, and the ones
   * the AI proposes as noise. Those wait for a person to dismiss them; the AI
   * does not clear the inbox by itself, so they are shown, last and quietly.
   */
  const groups =
    shared.messages.length === 0
      ? []
      : query.inboxView === "needs-triage"
        ? [
            {
              id: "needs-me",
              label: say(INBOX_COPY.needsMe, language),
              rows: shown.filter((view) => !view.lineage.likelyNoise).map((view) => queueRow(shared, view, query)),
              emptyText: say(emptyText, language),
            },
            {
              id: "likely-noise",
              label: say(INBOX_COPY.likelyNoise, language),
              rows: shown.filter((view) => view.lineage.likelyNoise).map((view) => queueRow(shared, view, query)),
              emptyText: null,
            },
          ].filter((group) => group.id === "needs-me" || group.rows.length > 0)
        : [
            {
              id: query.inboxView,
              label: say(viewLabel(query.inboxView), language),
              rows: shown.map((view) => queueRow(shared, view, query)),
              emptyText: say(emptyText, language),
            },
          ];

  return {
    tab: "inbox",
    savedViews: INBOX_VIEWS.map((id) => ({
      id,
      label: say(viewLabel(id), language),
      count: views.filter((view) => inView(id, view) && !(id === "needs-triage" && view.lineage.likelyNoise)).length,
      href: workHref(roleId, query, { inboxView: id, kind: null }),
      active: query.inboxView === id,
    })),
    filters:
      kinds.length > 1
        ? [
            { id: "all", label: say(COPY.allKinds, language), count: pool.length, href: workHref(roleId, query, { kind: null }), active: query.kind === null },
            ...kinds.map((kind) => ({
              id: kind,
              label: classificationLabel(shared, kind === "unclassified" ? null : kind).label,
              count: pool.filter((view) => kindOf(view) === kind).length,
              href: workHref(roleId, query, { kind }),
              active: query.kind === kind,
            })),
          ]
        : [],
    objectFilter: query.object
      ? { id: query.object, label: objectName(shared, query.object), clearHref: workHref(roleId, query, { object: null }) }
      : null,
    groups,
    empty: shared.messages.length === 0 ? { title: say(INBOX_COPY.emptyTitle, language), body: say(INBOX_COPY.emptyBody, language) } : null,
    proposals: [],
    summary: fill(say(INBOX_COPY.summary, language), { needsMe: counts.triage, respond: counts.respond, converted: counts.converted }),
  };
}

/* ==========================================================================
   Operations availability and the primary action
   ========================================================================== */

/** The operation each classification implies, which the role's configuration names in its own words. */
const NATURAL_OPERATION: Record<InboxClassification, InboxOperationId> = {
  decision: "confirm-triage",
  action: "create-action",
  evidence: "link-evidence",
  information: "confirm-triage",
  delegate: "delegate",
  noise: "dismiss",
};

/**
 * The one primary action for a message, from its classification and its
 * place. A decision the role can already see is routed to it; one it cannot
 * goes into the running process that covers it, or becomes an action. A
 * message already turned into work offers the reply to its sender, once.
 */
function primaryOperation(
  message: MessageView,
  context: { existingAction: boolean; routeDecision: boolean; coveredByProcess: boolean },
): InboxOperationId | null {
  const { lineage, source } = message;
  if (lineage.place !== "needs-me") {
    return lineage.place === "converted" && source.replyable && lineage.replies.length === 0 ? "draft-reply" : null;
  }
  switch (lineage.effective) {
    case "decision":
      return context.routeDecision ? "confirm-triage" : context.coveredByProcess ? "add-to-process" : "create-action";
    case "action":
      return "create-action";
    case "evidence":
      return "link-evidence";
    case "information":
      return "confirm-triage";
    case "delegate":
      return "delegate";
    case "noise":
      return "dismiss";
    default:
      return "change-triage";
  }
}

function operationsFor(
  shared: WorkSharedData,
  message: MessageView,
  forms: InboxForms,
  primary: InboxOperationId | null,
): InboxOperationView[] {
  const { language, gate } = shared;
  const t = (pair: Pair) => say(pair, language);
  const { lineage, triage, source } = message;
  const converted = lineage.place === "converted";
  const alreadyConverted = { en: "Already turned into work.", de: "Bereits in Arbeit ueberfuehrt." };

  const confirmWill =
    forms.routeDecision && lineage.effective === "decision"
      ? fill(t(INBOX_COPY.willRoute), { id: forms.routeDecision.id })
      : lineage.effective === "information"
        ? t(INBOX_COPY.willFile)
        : lineage.effective === "noise"
          ? t(INBOX_COPY.willDismiss)
          : t(INBOX_COPY.willConfirm);

  const spec: Record<InboxOperationId, { label: string; blockedBy: string | null; aiPrepared: string; youDecide: string; willChange: string }> = {
    "confirm-triage": {
      label: t(INBOX_COPY.opConfirm),
      blockedBy: !triage.proposal
        ? t(INBOX_COPY.unavailableToConfirm)
        : lineage.confirmed === triage.proposal.classification && !(forms.routeDecision && !converted)
          ? t(INBOX_COPY.alreadyConfirmed)
          : null,
      aiPrepared: t(INBOX_COPY.aiPreparedTriage),
      youDecide: t(INBOX_COPY.youDecideConfirm),
      willChange: confirmWill,
    },
    "change-triage": {
      label: t(INBOX_COPY.opChange),
      blockedBy: null,
      aiPrepared: triage.proposal ? t(INBOX_COPY.aiPreparedTriage) : t(INBOX_COPY.aiPreparedNone),
      youDecide: t(INBOX_COPY.youDecideChange),
      willChange: t(INBOX_COPY.willChange),
    },
    "create-action": {
      label: t(INBOX_COPY.opCreateAction),
      blockedBy: lineage.action ? fill(t(INBOX_COPY.alreadyActionShort), { id: lineage.action.id }) : null,
      aiPrepared: t(INBOX_COPY.aiPreparedNone),
      youDecide: t(INBOX_COPY.youDecideAction),
      willChange: forms.existingAction
        ? `${t(INBOX_COPY.willCreateAction)} ${fill(t(INBOX_COPY.willLinkAction), { id: forms.existingAction.id })}`
        : t(INBOX_COPY.willCreateAction),
    },
    "link-evidence": {
      label: t(INBOX_COPY.opLinkEvidence),
      blockedBy: lineage.filed[0] ? fill(t(INBOX_COPY.alreadyFiledShort), { id: lineage.filed[0].id }) : null,
      aiPrepared: t(INBOX_COPY.aiPreparedNone),
      youDecide: t(INBOX_COPY.youDecideEvidence),
      willChange: t(INBOX_COPY.willLinkEvidence),
    },
    "add-to-process": {
      label: t(INBOX_COPY.opAddToProcess),
      blockedBy: forms.stages.length === 0 ? t(INBOX_COPY.noOpenStage) : null,
      aiPrepared: t(INBOX_COPY.aiPreparedNone),
      youDecide: t(INBOX_COPY.youDecideProcess),
      willChange: t(INBOX_COPY.willAddToProcess),
    },
    delegate: {
      label: t(INBOX_COPY.opDelegate),
      blockedBy: lineage.delegatedTo ? fill(t(INBOX_COPY.alreadyDelegatedShort), { name: lineage.delegatedTo.name }) : null,
      aiPrepared: forms.delegates.some((person) => person.suggested) ? t(INBOX_COPY.aiPreparedDelegate) : t(INBOX_COPY.aiPreparedNone),
      youDecide: t(INBOX_COPY.youDecideDelegate),
      willChange: t(INBOX_COPY.willDelegate),
    },
    "draft-reply": {
      label: t(INBOX_COPY.opDraftReply),
      blockedBy: source.replyable ? null : t(INBOX_COPY.noReplyAddress),
      aiPrepared: t(INBOX_COPY.aiPreparedReply),
      youDecide: t(INBOX_COPY.youDecideReply),
      willChange: `${t(INBOX_COPY.willDraft)} ${t(INBOX_COPY.willSend)}`,
    },
    dismiss: {
      label: t(INBOX_COPY.opDismiss),
      blockedBy: lineage.confirmed === "noise" ? t(INBOX_COPY.alreadyDismissedShort) : converted ? t(alreadyConverted) : null,
      aiPrepared: triage.proposal?.classification === "noise" ? t(INBOX_COPY.aiPreparedTriage) : t(INBOX_COPY.aiPreparedNone),
      youDecide: t(INBOX_COPY.youDecideDismiss),
      willChange: t(INBOX_COPY.willDismiss),
    },
  };

  return INBOX_OPERATIONS.map((id) => {
    const tools = INBOX_OPERATION_TOOLS[id];
    const verdicts = tools.map((tool) => gate[tool]).filter((verdict): verdict is NonNullable<typeof verdict> => verdict !== undefined);
    const governing = verdicts[0];
    const unreachable = verdicts.find((verdict) => !verdict.reachable);
    /* A tool the gate has no verdict for is unavailable, never assumed allowed. */
    const gateReason = verdicts.length < tools.length ? t(INBOX_COPY.notRegistered) : unreachable ? unreachable.reason : "";
    const needsApproval = verdicts.some((verdict) => verdict.needsApproval);
    const material = id === "create-action" && verdicts.some((verdict) => verdict.material);
    const isDraft = governing?.authorityClass === "DRAFT";
    const entry = spec[id];
    const disabledReason = entry.blockedBy ?? gateReason;
    return {
      id,
      label: entry.label,
      primary: id === primary,
      enabled: disabledReason.length === 0,
      disabledReason,
      stateBlocked: entry.blockedBy !== null,
      authorityLabel: governing ? say(AUTHORITY_LABELS[governing.authorityClass], language) : "",
      needsApproval,
      material,
      aiPrepared: entry.aiPrepared,
      youDecide: entry.youDecide,
      willChange: entry.willChange,
      approval: material
        ? t(INBOX_COPY.approvalMaterial)
        : isDraft
          ? `${t(INBOX_COPY.approvalDraft)} ${forms.send.enabled ? (forms.send.needsApproval ? t(INBOX_COPY.approvalSendYours) : t(INBOX_COPY.approvalNone)) : forms.send.reason}`.trim()
          : needsApproval
            ? t(INBOX_COPY.approvalYours)
            : t(INBOX_COPY.approvalNone),
    };
  });
}

/* ==========================================================================
   Forms
   ========================================================================== */

const PERSON_ID = /\bP-\d{3}\b/g;

function formsFor(shared: WorkSharedData, extras: InboxExtras, message: MessageView): InboxForms {
  const { language, config } = shared;
  const { row, triage, lineage } = message;
  const t = (pair: Pair) => say(pair, language);

  const existing =
    row.relatedObjectKind === "action" && row.relatedObjectId
      ? shared.actions.find((action) => action.id === row.relatedObjectId && action.status !== "completed" && action.status !== "cancelled")
      : undefined;
  const decisionId = row.linkedDecisionId ?? (row.relatedObjectKind === "decision" ? row.relatedObjectId : null);
  const decision = decisionId ? shared.decisions.find((candidate) => candidate.id === decisionId) : undefined;

  const kinds = Object.entries(config.actionKinds).map(([id, kind]) => ({ id, label: say(kind.label, language) }));
  const defaultKind = lineage.effective === "evidence" && config.actionKinds["evidence-request"] ? "evidence-request" : config.actionKinds["remediation"] ? "remediation" : (kinds[0]?.id ?? "");

  const due = row.requiresResponseBy ? dateOf(row.requiresResponseBy) : "";

  /* Evidence: the object the message is about, and the process subject that covers it. */
  const scope = findProcessFor([row.relatedObjectId], shared.processScopes);
  const objectIds = [
    ...new Set(
      [row.relatedObjectKind !== "action" && row.relatedObjectKind !== "decision" ? row.relatedObjectId : null, scope?.subjectId ?? null].filter(
        (id): id is string => typeof id === "string" && id.length > 0,
      ),
    ),
  ];

  /* Process stages: every open stage of a running process, the one covering the message first. */
  const covering = extras.stages.filter((stage) => row.relatedObjectId !== null && stage.scopeIds.includes(row.relatedObjectId));
  const preferred = covering.find((stage) => stage.current) ?? covering[0] ?? extras.stages.find((stage) => stage.current) ?? extras.stages[0];
  const stages = extras.stages.map((stage) => {
    const coversObject = row.relatedObjectId !== null && stage.scopeIds.includes(row.relatedObjectId);
    return {
      value: `${stage.processRunId}::${stage.stageId}`,
      label: `${say(stage.processName, language)} (${stage.subjectId}): ${say(stage.stageName, language)}${stage.current ? `, ${t(INBOX_COPY.currentStage)}` : ""}`,
      coversObject,
      selected: preferred !== undefined && preferred.processRunId === stage.processRunId && preferred.stageId === stage.stageId,
      warning: coversObject || !row.relatedObjectId ? null : fill(t(INBOX_COPY.notInScope), { object: row.relatedObjectId }),
    };
  });

  /* Delegates: internal people other than the holder; the ones the rationale or the message names first. */
  const named = new Set([
    ...(triage.proposal?.rationale.en.match(PERSON_ID) ?? []),
    ...row.body.match(PERSON_ID) ?? [],
  ]);
  const delegates = shared.assignable
    .filter((person) => person.id !== shared.holderUserId)
    .map((person) => ({
      id: person.id,
      label: `${person.name}, ${person.jobTitle}${named.has(person.id) ? ` (${t(INBOX_COPY.suggested)})` : ""}`,
      suggested: named.has(person.id),
    }))
    .sort((a, b) => Number(b.suggested) - Number(a.suggested));

  const sender = row.fromUserId ? shared.people.get(row.fromUserId) : undefined;
  const sendVerdict = shared.gate["sendInboxReply"];

  return {
    classifications: INBOX_CLASSIFICATIONS.filter((id) => config.inboxClassifications[id]).map((id) => ({ id, label: classificationLabel(shared, id).label })),
    assignable: shared.assignable.map((person) => ({ id: person.id, label: `${person.name}, ${person.jobTitle}` })),
    holderUserId: shared.holderUserId,
    actionKinds: kinds,
    defaultKind,
    defaultTitle: messageSubject(row, language),
    defaultDue: due && due >= shared.scenarioDate ? due : "",
    minDate: shared.scenarioDate,
    existingAction: existing ? { id: existing.id, title: actionTitle(existing, language) } : null,
    routeDecision: decision && decision.status === "open" ? { id: decision.id, title: decisionTitle(decision, language) } : null,
    evidenceObjects: objectIds.map((id) => {
      const name = objectName(shared, id);
      return { id, label: name === id ? id : `${id} ${name}`, checked: true };
    }),
    defaultEvidenceTitle: messageSubject(row, language),
    stages,
    delegates,
    replyTo: sender ? sender.name : row.fromLabel,
    send: sendVerdict
      ? { enabled: sendVerdict.reachable, reason: sendVerdict.reason, needsApproval: sendVerdict.needsApproval }
      : { enabled: false, reason: t(INBOX_COPY.notRegistered), needsApproval: false },
  };
}

/* ==========================================================================
   Resolving one message
   ========================================================================== */

function historyOf(shared: WorkSharedData, events: readonly InboxEventFact[]): ActivityEntry[] {
  const { language } = shared;
  return events.map((event) => {
    const operation = event.payload.operation;
    const label =
      operation === "triage"
        ? INBOX_COPY.historyTriage
        : operation === "delegate"
          ? INBOX_COPY.historyDelegated
          : operation === "reply"
            ? INBOX_COPY.historyReply
            : INBOX_COPY.historyConverted;
    return {
      id: event.id,
      at: event.atMoment,
      actor: personName(shared, event.actorUserId) ?? "",
      text: event.summary,
      tone: operation === "triage" || operation === "reply" ? "neutral" : "success",
      evidenceIds: event.payload.evidenceDocumentId ? [event.payload.evidenceDocumentId] : [],
      label: say(label, language),
    };
  });
}

export function resolveInboxDetail(
  itemId: string,
  shared: WorkSharedData,
  extras: InboxExtras,
  query: WorkQuery,
): InboxDetail | null {
  const message = viewsOf(shared, extras).find((candidate) => candidate.row.id === itemId);
  if (!message) return null;
  const { row, source, triage, lineage } = message;
  const { language, roleId } = shared;
  const t = (pair: Pair) => say(pair, language);
  const subject = messageSubject(row, language);
  const effective = classificationLabel(shared, lineage.effective);
  const proposed = triage.proposal ? classificationLabel(shared, triage.proposal.classification) : null;
  const config = lineage.effective ? shared.config.inboxClassifications[lineage.effective] : undefined;

  const linkedDecision = row.linkedDecisionId
    ? shared.decisions.find((decision) => decision.id === row.linkedDecisionId)
    : row.relatedObjectKind === "decision"
      ? shared.decisions.find((decision) => decision.id === row.relatedObjectId)
      : undefined;
  const linkedAction =
    lineage.action ?? shared.actions.find((action) => row.relatedObjectKind === "action" && action.id === row.relatedObjectId) ?? null;
  const original = row.isDuplicateOf ? shared.messages.find((candidate) => candidate.id === row.isDuplicateOf) : undefined;
  const scope = findProcessFor([row.relatedObjectId], shared.processScopes);

  /* Evidence: the document it names, and the documents filed from it. */
  const evidence: EvidenceRef[] = [];
  if (row.relatedObjectKind === "evidence-document" && row.relatedObjectId) {
    const doc = extras.evidence.get(row.relatedObjectId);
    if (doc) evidence.push(evidenceRef(doc, t({ en: "Named in the message", de: "In der Nachricht genannt" }), language));
  }
  /* The relation already says it came from this message, so the shared "filed from" note is not repeated. */
  for (const doc of lineage.filed) evidence.push(evidenceRef({ ...doc, sourceMessageId: null }, t(INBOX_COPY.filedFrom), language));

  const audit: AuditRef[] = (extras.audit.get(row.id) ?? []).map((entry) => ({
    id: entry.id,
    at: entry.atMoment,
    summary: entry.summary,
    actor: personName(shared, entry.actorUserId) ?? entry.actorKind,
    blocked: entry.blocked,
  }));

  const objectIsLinkable =
    row.relatedObjectId !== null &&
    row.relatedObjectKind !== null &&
    row.relatedObjectKind !== "decision" &&
    row.relatedObjectKind !== "action" &&
    row.relatedObjectKind !== "evidence-document";

  const related = compactLinks([
    ...lineage.conversions.map((conversion) => conversion.link).filter((link) => link?.kind !== "evidence"),
    scope ? processLink(scope, language) : null,
    linkedDecision ? decisionLink(roleId, linkedDecision.id, decisionTitle(linkedDecision, language), say(COPY.relatedDecision, language)) : null,
    linkedAction ? actionLink(roleId, linkedAction.id, actionTitle(linkedAction, language), say(COPY.relatedAction, language)) : null,
    original ? messageLink(roleId, original.id, messageSubject(original, language), t(INBOX_COPY.duplicateOf)) : null,
    objectIsLinkable && row.relatedObjectId
      ? objectLink(roleId, row.relatedObjectId, objectName(shared, row.relatedObjectId), objectKindLabel(shared, row.relatedObjectKind), language, "inbox")
      : null,
    evidenceLink(evidence.length, language),
    auditLink(audit.length, language),
  ]);

  const sourceText =
    source.kind === "supplier-submission"
      ? fill(t(INBOX_COPY.viaChannel), { source: say(source.label, language), channel: say(source.channel, language) })
      : say(source.label, language);
  const respondBy = row.requiresResponseBy
    ? { text: `${displayDate(dateOf(row.requiresResponseBy))} ${timeOf(row.requiresResponseBy)}`, passed: deadlinePassed(row.requiresResponseBy, shared) }
    : null;

  const facts: DetailFact[] = [
    { label: say(COPY.factSource, language), value: `${sourceText}, ${t(INBOX_COPY.simulated)}` },
    { label: say(COPY.factFrom, language), value: row.fromLabel },
    { label: say(COPY.factReceived, language), value: `${displayDate(dateOf(row.receivedAt))} ${timeOf(row.receivedAt)}` },
    ...(respondBy
      ? [{ label: say(COPY.factRespondBy, language), value: respondBy.text, tone: respondBy.passed ? ("danger" as const) : ("warning" as const) }]
      : []),
    ...(row.relatedObjectId
      ? [
          {
            label: t(INBOX_COPY.linkedObject),
            value: `${objectKindLabel(shared, row.relatedObjectKind)}: ${objectName(shared, row.relatedObjectId) === row.relatedObjectId ? row.relatedObjectId : `${row.relatedObjectId} ${objectName(shared, row.relatedObjectId)}`}`,
          },
        ]
      : []),
    { label: say(COPY.factReference, language), value: row.id, mono: true },
  ];

  /* The partner reads the action or decision the message became or names, else the object it is about. */
  const kindLabel = say(KIND_LABELS.message, language);
  const ai = linkedAction
    ? directAiContext("action", linkedAction.id, subject, kindLabel, language)
    : linkedDecision
      ? directAiContext("decision", linkedDecision.id, subject, kindLabel, language)
      : partnerTypeFor(row.relatedObjectKind)
        ? subjectAiContext(row.relatedObjectKind, row.relatedObjectId, subject, kindLabel, language)
        : subjectAiContext(null, null, subject, kindLabel, language);

  const forms = formsFor(shared, extras, message);
  const primary = primaryOperation(message, {
    existingAction: forms.existingAction !== null,
    routeDecision: forms.routeDecision !== null,
    coveredByProcess: forms.stages.some((stage) => stage.coversObject),
  });
  /*
   * The role's words for the primary action belong beside it only when the
   * primary action is the one the classification implies. A decision the role
   * cannot see yet goes into a process instead, and "Open the decision" next
   * to "Add to process" would promise a decision that is not there.
   */
  const natural = lineage.effective ? NATURAL_OPERATION[lineage.effective] : null;
  const roleWords = config && primary !== null && primary === natural ? say(config.primaryAction, language) : "";

  /*
   * Who confirmed the classification, when and why, as the message records it
   * (migration 0008). A classification the conversion confirmed carries the
   * conversion's own time, which is how it is told apart. The latest triage
   * event to the same classification gives the day's moment and what it was
   * changed from; without one, the departure is from the AI's proposal.
   */
  const latestTriage = [...lineage.triage].reverse().find((entry) => entry.to === lineage.confirmed);
  const confirmer = personName(shared, row.triageConfirmedByUserId ?? null);
  const byConversion = row.triageConfirmedAt !== null && row.triageConfirmedAt === row.convertedAt && isWorkConversion(row.conversionKind);
  const conversionAt = byConversion ? (lineage.conversions.find((conversion) => conversion.kind === row.conversionKind)?.at ?? null) : null;
  const confirmedWhen = (byConversion ? conversionAt : latestTriage?.at) ?? (row.triageConfirmedAt ? timeOf(row.triageConfirmedAt) : "");
  const departedFrom = latestTriage?.from ?? triage.proposal?.classification ?? null;
  const triageReason = row.triageReason ?? "";
  const personTriage = lineage.confirmed
    ? {
        label: classificationLabel(shared, lineage.confirmed).label,
        note: confirmer
          ? fill(t(byConversion ? INBOX_COPY.confirmedWithConversion : INBOX_COPY.confirmedBy), { person: confirmer, when: confirmedWhen })
          : t(INBOX_COPY.confirmedUnattributed),
        reason:
          triageReason.length > 0 && departedFrom && departedFrom !== lineage.confirmed
            ? fill(t(INBOX_COPY.changedFrom), { from: classificationLabel(shared, departedFrom).label, reason: triageReason })
            : null,
      }
    : null;

  const modeLabel = triage.mode === "safe" ? INBOX_COPY.modeSafe : triage.mode === "offline" ? INBOX_COPY.modeOffline : INBOX_COPY.modeUnavailable;
  const placeLabel = t(viewLabel(lineage.place === "needs-me" ? "needs-triage" : lineage.place));

  return {
    kind: "message",
    id: row.id,
    reference: row.id,
    title: subject,
    kindLabel,
    homeTab: "inbox",
    homeHref: workHref(roleId, query, {
      tab: "inbox",
      inboxView: lineage.place === "needs-me" ? "needs-triage" : lineage.place,
      item: row.id,
    }),
    status: lineage.confirmed
      ? { label: fill(t(INBOX_COPY.confirmedClass), { label: effective.label }), tone: effective.tone }
      : triage.proposal
        ? { label: fill(t(INBOX_COPY.aiClass), { label: effective.label }), tone: effective.tone }
        : { label: t(INBOX_COPY.notClassified), tone: "neutral" },
    facts,
    context: row.body,
    evidence,
    related,
    activity: historyOf(shared, extras.events.get(row.id) ?? []),
    audit,
    /*
     * Every message in the scenario is synthetic and no connector delivered
     * it, so the source is labelled Simulated by name rather than shown as if
     * it had arrived from the channel it names.
     */
    freshness: {
      label: say(COPY.freshnessSimulated, language),
      tone: "neutral",
      detail: fill(t(INBOX_COPY.simulatedSource), { source: sourceText }),
    },
    ai,
    source: { label: sourceText, channel: say(source.channel, language), simulated: t(INBOX_COPY.simulated) },
    from: row.fromLabel,
    received: `${displayDate(dateOf(row.receivedAt))} ${timeOf(row.receivedAt)}`,
    body: row.body,
    classification: {
      available: triage.proposal !== null,
      label: effective.label,
      tone: effective.tone,
      confirmed: lineage.confirmed !== null,
      proposedId: triage.proposal?.classification ?? null,
      confirmedId: lineage.confirmed,
      effectiveId: lineage.effective,
      proposedLabel: proposed?.label ?? null,
      rationale: triage.proposal
        ? language === "de" && triage.proposal.rationale.de
          ? triage.proposal.rationale.de
          : triage.proposal.rationale.en
        : "",
      rationaleNote: triage.proposal && language === "de" && triage.proposal.rationale.de === null ? t(INBOX_COPY.rationaleEnglish) : null,
      confidence: triage.proposal?.confidence !== null && triage.proposal?.confidence !== undefined ? Math.round(triage.proposal.confidence * 100) : null,
      mode: t(modeLabel),
      modeNote: t(triage.note),
    },
    personTriage,
    primaryAction: roleWords,
    respondBy,
    place: lineage.place,
    placeLabel,
    conversions: lineage.conversions,
    replies: lineage.replies,
    closureLabel: closureLabel(lineage, language),
    operations: operationsFor(shared, message, forms, primary),
    forms,
    duplicateOf: original
      ? { id: original.id, subject: messageSubject(original, language), href: workHref(roleId, query, { inboxView: "all", item: original.id }) }
      : null,
  };
}

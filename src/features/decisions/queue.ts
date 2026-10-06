/**
 * Builds the V3.3 decision workspace.
 *
 * Server side. Everything here is a read: the decisions and their options come
 * from `getDecisions`, the plan for each option from the decision engine's own
 * `planDecisionOption`, the receipt and the outcome from the decisions
 * repository, the process stage from the Role App contract, the meeting and
 * the deadline from the work tables, and the authority position from the
 * authority gate's `toolsAvailableAt`. Nothing about the domain, the approval
 * model or the audit trail is decided in this file, and nothing is written by
 * it.
 *
 * Three things are worth stating because they are acceptance criteria rather
 * than incidental choices.
 *
 * The exact changes shown on Options and approved on Confirm and execute are
 * the engine's plan, not a description of it. The same function computes the
 * payloads and fingerprints the engine will execute, and the engine re-plans
 * at confirm time and refuses if the two differ.
 *
 * A recorded decision is rendered from what the database holds: the receipt
 * lines for what executed and the outcome record for what did not. The receipt
 * a reader saw when they confirmed is therefore the receipt they see after a
 * refresh (J21).
 *
 * Links are derived, never guessed. A decision has a process link only when an
 * installed stage contract binds it, and a meeting link only when a meeting of
 * the same role is held on its subject or shares its evidence. Otherwise the
 * workspace says there is none.
 */

import type { AutonomyLevel, RoleId } from "@/db/schema/core";
import type { AuthorityClass } from "@/db/schema/decisions";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import {
  getDecisions,
  getEntity,
  getEvidenceDocuments,
  getInbox,
  getMeetings,
  getRole,
  getUser,
  type DecisionWithOptions,
} from "@/db/repositories/workday";
import { getDecisionOutcome, getDecisionSubject } from "@/db/repositories/decisions";
import { firstClause, firstSentence } from "@/db/repositories/focus";
import { planDecisionOption, type ConsequencePlan } from "@/scenario/engine/decide";
import { findDecisionProcessBinding, stageHref } from "@/scenario/engine/decision-links";
import { getScenarioState } from "@/scenario/engine/state";
import { toolsAvailableAt } from "@/server/security/authority";
import { buildStageContext, findActiveProcessRun } from "@/features/process/orchestrator";
import { itemHref } from "@/features/work/url";
import { getInstalledRoleApps, getProcessDefinition } from "@/role-apps/registry";
import { AUTONOMY_LABELS, NAV_LABELS, PROVENANCE_LABELS, t, type Language } from "@/i18n/labels";
import { momentToMinutes } from "@/domain/nfr/calculators";
import { createLogger } from "@/server/logging/redact";
import {
  AUTHORITY_LABELS,
  CONSEQUENCE_LABELS,
  COPY,
  DENIAL_REASONS_DE,
  JUDGMENT_FALLBACK,
  JUDGMENT_LABELS,
  LOCAL_SYSTEM,
  PAYLOAD_FIELD_LABELS,
  RECEIPT_LABELS,
  REGISTER_FALLBACK,
  SUBJECT_KIND_LABELS,
  TOOL_REGISTERS,
  VALUE_LABELS,
  fill,
  say,
  type Pair,
} from "./copy";
import type {
  ActiveDecisionView,
  ChangeFieldView,
  ChangeView,
  DecisionAuthorityView,
  DecisionContextView,
  DecisionEvidenceView,
  DecisionOptionCard,
  DecisionQueueRow,
  DecisionQueueViewModel,
  EvidenceItemView,
  FailedChangeView,
  LinkView,
  ReceiptLineView,
  RecordedDecisionView,
  StageDecisionRow,
} from "./model";

const log = createLogger("decision-queue");

export interface DecisionQueueOptions {
  roleId: RoleId;
  atMoment: string;
  language: Language;
  autonomyLevel: AutonomyLevel;
  runId?: string;
}

type Decision = DecisionWithOptions["decision"];
type DecisionOption = DecisionWithOptions["options"][number];

/* ==========================================================================
   Small text helpers
   ========================================================================== */

/**
 * One short paragraph, at most two sentences.
 *
 * Built on the repository's `firstSentence` rather than a second cutting rule,
 * because that function already learned the lesson about clause cuts breaking
 * before the clause that carried the point.
 */
export function shortParagraph(text: string, limit = 280): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) return "";

  /*
   * One sentence is enough when it is already a long one. Appending a second
   * inside a tight budget ends the paragraph in the middle of the clause that
   * carried the point, and a reader given half a thought has to open
   * something else to finish it.
   */
  const first = firstSentence(trimmed, limit);
  if (first.endsWith("...") || first.length > limit - 120) return first;

  const rest = trimmed.slice(first.length).trim();
  if (rest.length === 0) return first;

  const second = firstSentence(rest, limit - first.length - 1);
  return second.length === 0 ? first : `${first} ${second}`;
}

/** A recorded value as words. Unlisted values are shown with their hyphens replaced. */
export function valueLabel(value: string, language: Language): string {
  const pair = VALUE_LABELS[value];
  return pair ? say(pair, language) : value.replace(/-/g, " ");
}

function localised(language: Language, en: string, de: string | null | undefined): string {
  return language === "de" && de && de.length > 0 ? de : en;
}

function pairOr(pair: Pair | undefined, fallback: string, language: Language): string {
  return pair ? say(pair, language) : fallback;
}

/** "22.05.2026" from an ISO date or timestamp. */
function displayDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-");
  return year && month && day ? `${day}.${month}.${year}` : iso;
}

/** The clock time of a scenario timestamp. The seed writes scenario time as UTC. */
function timeOf(iso: string): string {
  return iso.slice(11, 16);
}

/** The tool a seeded consequence kind executes through, for records that name only the tool. */
const TOOL_TO_KIND: Record<string, string> = {
  updateControlRating: "set-control-effectiveness",
  updateAssessment: "version-assessment",
  proposeAndRecordResidualRisk: "set-residual-risk",
  initiateReassessment: "create-reassessment",
  createAction: "create-action",
  createIssue: "create-issue",
  addCommitteeAgendaItem: "add-committee-item",
  activateMonitoring: "activate-monitoring",
  sendSimulatedCollaborationMessage: "send-collaboration-message",
  requestFactualValidation: "request-factual-validation",
  setSupplierCriticality: "set-supplier-criticality",
  recordSupplierAssessment: "record-supplier-assessment",
  applySupplierRestriction: "apply-supplier-restriction",
  recordTestConclusion: "record-test-conclusion",
  classifyTestException: "classify-test-exception",
  recordFinding: "record-finding",
  classifyIncident: "classify-incident",
  escalateIncident: "escalate-incident",
  recordNotificationRecommendation: "record-notification-recommendation",
  selectRecoveryOption: "select-recovery-option",
  captureLessonsLearned: "capture-lessons-learned",
  recordObligationInterpretation: "record-obligation-interpretation",
  setPortfolioMateriality: "set-portfolio-materiality",
  requestEvidenceDocument: "request-evidence",
};

function consequenceLabel(kind: string | null, language: Language): string {
  if (!kind) return say(REGISTER_FALLBACK, language);
  return pairOr(CONSEQUENCE_LABELS[kind], kind, language);
}

function registerOf(toolName: string | null, language: Language): string {
  return say((toolName ? TOOL_REGISTERS[toolName] : undefined) ?? REGISTER_FALLBACK, language);
}

/**
 * The gate's reason, in the reader's language.
 *
 * The runtime prefixes a handler failure with "The tool failed:", which is the
 * product's architecture talking; the receipt already labels the line as a
 * failure while executing, so the prefix is dropped.
 */
function reasonText(reason: string | null, code: string | null, language: Language): string {
  if (language === "de") {
    const translated = code ? DENIAL_REASONS_DE[code] : undefined;
    if (translated) return translated;
  }
  return (reason ?? "").replace(/^The tool failed: /, "");
}

/* ==========================================================================
   The authority position
   ========================================================================== */

/**
 * The authority position, as the gate reports it.
 *
 * `toolsAvailableAt` is the gate's own interface facing query, so a class with
 * no available tool is a class this role cannot reach today, and the confirm
 * control is disabled with the gate's wording rather than a sentence invented
 * here.
 */
function authorityView(options: {
  authorityClass: AuthorityClass;
  requiresApproval: boolean;
  roleId: RoleId;
  autonomyLevel: AutonomyLevel;
  approverName: string;
  approverTitle: string;
  language: Language;
}): DecisionAuthorityView {
  const { available, withheld } = toolsAvailableAt(options.autonomyLevel, options.roleId);
  const reachable = available.some((tool) => tool.authorityClass === options.authorityClass);
  const refusal = withheld.find((entry) => entry.tool.authorityClass === options.authorityClass);

  return {
    authorityClass: options.authorityClass,
    authorityLabel: say(AUTHORITY_LABELS[options.authorityClass], options.language),
    requiresApproval: options.requiresApproval,
    reachable,
    gateNote: reachable ? "" : (refusal?.reason ?? say(COPY.blockedByGate, options.language)),
    approverName: options.approverName,
    approverTitle: options.approverTitle,
    autonomyLabel: t(AUTONOMY_LABELS, options.autonomyLevel, options.language),
  };
}

/* ==========================================================================
   2. Context
   ========================================================================== */

function processLink(decision: Decision, runId: string, language: Language): LinkView | null {
  const binding = findDecisionProcessBinding(decision.id, decision.roleId, runId);
  if (!binding) return null;

  const detail = !binding.processRunId
    ? COPY.noRun
    : binding.stageStatus === "completed"
      ? COPY.stageCompleted
      : binding.isCurrentStage
        ? COPY.stageCurrent
        : binding.stageRunId
          ? COPY.stageOpenNotCurrent
          : COPY.stageNotOpened;

  return {
    label: fill(say(COPY.stagePosition, language), {
      process: localised(language, binding.process.name, binding.process.nameDe),
      sequence: binding.stage.sequence,
      stage: localised(language, binding.stage.name, binding.stage.nameDe),
    }),
    href: binding.processRunId ? stageHref(binding) : null,
    detail: say(detail, language),
  };
}

/**
 * The meeting about this decision's subject, if the role holds one.
 *
 * Same subject first, then the most shared cited evidence, then the earliest.
 * A meeting that only shares one document is not offered: one shared citation
 * is coincidence as often as it is relevance.
 */
function meetingLink(
  decision: Decision,
  meetings: ReturnType<typeof getMeetings>,
  language: Language,
): LinkView | null {
  const cited = new Set([...decision.supportingEvidenceIds, ...decision.opposingEvidenceIds]);
  const ranked = meetings
    .map((meeting) => ({
      meeting,
      sameSubject: decision.relatedObjectId !== null && meeting.subjectId === decision.relatedObjectId,
      shared: meeting.evidenceDocumentIds.filter((id) => cited.has(id)).length,
    }))
    .filter((entry) => entry.sameSubject || entry.shared >= 2)
    .sort(
      (a, b) =>
        Number(b.sameSubject) - Number(a.sameSubject) ||
        b.shared - a.shared ||
        a.meeting.scheduledFor.localeCompare(b.meeting.scheduledFor),
    );

  const best = ranked[0];
  if (!best) return null;
  const time = best.meeting.momentLabel || timeOf(best.meeting.scheduledFor);
  return {
    label: localised(language, best.meeting.title, best.meeting.titleDe),
    href: itemHref(decision.roleId, "meetings", best.meeting.id),
    detail: best.sameSubject
      ? fill(say(COPY.meetingBasis, language), { time })
      : fill(say(COPY.meetingBasisEvidence, language), { time, count: best.shared }),
  };
}

/**
 * The response due on this decision's subject, from the role's inbox.
 *
 * The decisions table holds no due date. What the record does hold is a
 * message on the same subject that asks for an answer by a time, so that is
 * the deadline shown, with the message named as its basis. The earliest one
 * still ahead wins; when every one has passed, the latest passed is shown as
 * passed rather than hidden.
 */
function deadlineFor(
  decision: Decision,
  inbox: ReturnType<typeof getInbox>,
  scenarioDate: string,
  atMoment: string,
  language: Language,
): DecisionContextView["deadline"] {
  if (!decision.relatedObjectId) return null;
  const candidates = inbox
    .filter((row) => row.relatedObjectId === decision.relatedObjectId && row.requiresResponseBy)
    .map((row) => {
      const due = row.requiresResponseBy ?? "";
      const date = due.slice(0, 10);
      const passed = date < scenarioDate || (date === scenarioDate && momentToMinutes(timeOf(due)) < momentToMinutes(atMoment));
      return { row, due, date, passed };
    })
    .sort((a, b) => a.due.localeCompare(b.due));

  const ahead = candidates.find((entry) => !entry.passed);
  const chosen = ahead ?? candidates[candidates.length - 1];
  if (!chosen) return null;

  const when =
    chosen.date === scenarioDate
      ? fill(say(COPY.today, language), { time: timeOf(chosen.due) })
      : fill(say(COPY.onDate, language), { date: displayDate(chosen.due), time: timeOf(chosen.due) });

  return {
    label: fill(say(chosen.passed ? COPY.deadlinePassed : COPY.deadlineDue, language), { when }),
    basis: fill(say(COPY.deadlineBasis, language), {
      subject: localised(language, chosen.row.subject, chosen.row.subjectDe),
    }),
    passed: chosen.passed,
  };
}

function currentPosition(decision: Decision, runId: string, language: Language): {
  affected: DecisionContextView["affected"];
  position: string | null;
} {
  const subject = getDecisionSubject(decision.relatedObjectKind, decision.relatedObjectId, runId);
  if (!subject) {
    return {
      affected: decision.relatedObjectId
        ? {
            kindLabel: pairOr(SUBJECT_KIND_LABELS[decision.relatedObjectKind ?? ""], decision.relatedObjectKind ?? "", language),
            label: decision.relatedObjectId,
          }
        : null,
      position: null,
    };
  }

  const v = (key: string) => valueLabel(subject.position[key] ?? "", language);
  let position: string | null = null;
  switch (subject.kind) {
    case "control":
      position = fill(say(COPY.positionControl, language), { effectiveness: v("effectiveness"), firstLine: v("firstLine") });
      break;
    case "kri":
      position = fill(say(COPY.positionKri, language), {
        status: v("status"),
        value: subject.position["value"] ?? "",
        unit: subject.position["unit"] ?? "",
      });
      break;
    case "risk":
      position = fill(say(COPY.positionRisk, language), { appetite: v("appetite") });
      break;
    case "supplier":
      position = fill(say(COPY.positionSupplier, language), { criticality: v("criticality"), status: v("status") });
      break;
    case "assessment":
      position = fill(say(COPY.positionAssessment, language), {
        version: subject.position["version"] ?? "",
        status: v("status"),
        residual: v("residual"),
      });
      break;
    case "contract":
      position = fill(say(COPY.positionContract, language), {
        effectiveFrom: displayDate(subject.position["effectiveFrom"] ?? ""),
      });
      break;
    default:
      position = null;
  }

  return {
    affected: {
      kindLabel: pairOr(SUBJECT_KIND_LABELS[subject.kind], subject.kind, language),
      label: language === "de" ? subject.labelDe : subject.label,
    },
    position,
  };
}

/* ==========================================================================
   3. Evidence
   ========================================================================== */

function evidenceView(decision: Decision, runId: string, language: Language): DecisionEvidenceView {
  const ids = [...new Set([...decision.supportingEvidenceIds, ...decision.opposingEvidenceIds])];
  const documents = new Map(getEvidenceDocuments(ids, runId).map((doc) => [doc.id, doc]));

  const toView = (id: string): EvidenceItemView | null => {
    const doc = documents.get(id);
    if (!doc) return null;
    return {
      id: doc.id,
      reference: doc.reference,
      title: localised(language, doc.title, doc.titleDe),
      source: `${doc.sourceSystem}, ${displayDate(doc.documentDate)}`,
      provenance: t(PROVENANCE_LABELS, doc.provenance, language),
      summary: firstSentence(doc.summary, 200),
      stale: doc.isStale,
      staleNote: doc.isStale ? firstSentence(doc.stalenessNote, 220) : "",
      status: doc.status,
      statusLabel: valueLabel(doc.status, language),
    };
  };

  const supporting = decision.supportingEvidenceIds.map(toView).filter((v): v is EvidenceItemView => v !== null);
  const opposing = decision.opposingEvidenceIds.map(toView).filter((v): v is EvidenceItemView => v !== null);
  const all = [...supporting, ...opposing];
  const unique = all.filter((item, index) => all.findIndex((other) => other.id === item.id) === index);

  const conflict: DecisionEvidenceView["conflict"] =
    supporting.length > 0 && opposing.length > 0
      ? {
          state: "conflicting",
          label: fill(say(COPY.conflicting, language), { for: supporting.length, against: opposing.length }),
        }
      : supporting.length > 0
        ? { state: "one-sided", label: fill(say(COPY.oneSided, language), { count: supporting.length }) }
        : opposing.length > 0
          ? {
              state: "conflicting",
              label: fill(say(COPY.conflicting, language), { for: 0, against: opposing.length }),
            }
          : { state: "uncontested", label: say(COPY.uncontested, language) };

  return {
    strongestSupporting: supporting[0] ?? null,
    strongestOpposing: opposing[0] ?? null,
    supporting,
    opposing,
    conflict,
    stale: unique.filter((item) => item.stale),
    missing: unique.filter((item) => item.status === "requested" || item.status === "missing"),
    unresolvedIds: ids.filter((id) => !documents.has(id)),
    uncertainty: shortParagraph(decision.uncertaintyNote, 260),
    preparedPosition: shortParagraph(decision.preparedPosition, 260),
  };
}

/* ==========================================================================
   4. Options, with the engine's plan
   ========================================================================== */

/** A payload value as text. Enumerated values become words; everything else is shown as is. */
function payloadValue(value: unknown, language: Language): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map((entry) => payloadValue(entry, language)).join(", ");
  if (typeof value === "boolean") return valueLabel(String(value), language);
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return /^[a-z][a-z-]*$/.test(value) ? valueLabel(value, language) : value;
  return JSON.stringify(value);
}

/**
 * The exact payload as labelled fields.
 *
 * Every field is shown, because the approval binds to every field. The
 * decision and entity identifiers go last: they bind the change to this
 * decision, and a reader checks them after the fields that say what changes.
 */
function payloadFields(payload: Record<string, unknown>, language: Language): ChangeFieldView[] {
  const trailing = new Set(["decisionId", "entityId"]);
  const keys = Object.keys(payload).sort((a, b) => Number(trailing.has(a)) - Number(trailing.has(b)));
  return keys
    .map((key) => ({
      label: pairOr(PAYLOAD_FIELD_LABELS[key], key, language),
      value: payloadValue(payload[key], language),
    }))
    .filter((field) => field.value.length > 0);
}

function changeView(optionId: string, entry: ConsequencePlan, language: Language): ChangeView {
  return {
    key: `${optionId}:${entry.index}`,
    label: consequenceLabel(entry.consequence.kind, language),
    register: registerOf(entry.toolName, language),
    targetId: entry.consequence.targetId,
    system: say(LOCAL_SYSTEM, language),
    fields: entry.payload ? payloadFields(entry.payload, language) : [],
    fingerprint: entry.fingerprint,
    reference: entry.fingerprint ? entry.fingerprint.slice(0, 12) : "",
    requiresApproval: entry.verdict.allowed ? entry.verdict.requiresApproval : false,
    refusal: entry.verdict.allowed ? null : reasonText(entry.verdict.reason, entry.verdict.code, language),
  };
}

function optionCards(
  decision: Decision,
  options: DecisionOption[],
  approverName: string,
  runId: string,
  language: Language,
): DecisionOptionCard[] {
  return options.map((option) => {
    const plan = planDecisionOption({ decisionId: decision.id, optionId: option.id, runId });
    const changes = (plan?.consequences ?? []).map((entry) => changeView(option.id, entry, language));
    const systems = [...new Set(changes.map((change) => change.register))];
    const approvalsNeeded = changes.filter((change) => change.requiresApproval).length;
    const refused = changes.some((change) => change.refusal !== null);

    const approvalSummary =
      approvalsNeeded === 0
        ? say(COPY.optionNoApproval, language)
        : approvalsNeeded === 1
          ? fill(say(COPY.optionApprovalsOne, language), { name: approverName })
          : fill(say(COPY.optionApprovals, language), { count: approvalsNeeded, name: approverName });

    return {
      id: option.id,
      label: localised(language, option.label, option.labelDe),
      implication: option.riskImplication.length > 0 ? option.riskImplication : option.description,
      description: option.description,
      isRecommended: option.isRecommended,
      recommendationBasis: option.recommendationBasis,
      requiresApproval: option.requiresApproval,
      changes,
      systems,
      approvalsNeeded,
      approvalSummary,
      refused,
    };
  });
}

/* ==========================================================================
   A recorded decision's receipt
   ========================================================================== */

function recordedView(
  decision: Decision,
  options: DecisionOption[],
  headline: string,
  links: { process: LinkView | null; meeting: LinkView | null },
  approverFallback: string,
  runId: string,
  language: Language,
): RecordedDecisionView {
  const outcome = getDecisionOutcome(decision.id, runId);
  const chosen = options.find((option) => option.id === decision.chosenOptionId);
  const decidedBy = decision.decidedByUserId ? getUser(decision.decidedByUserId, runId) : undefined;
  const approver = outcome.approvals[0] ? getUser(outcome.approvals[0].approvedByUserId, runId) : undefined;
  const linesById = new Map(outcome.lines.map((line) => [line.id, line]));
  const toolByApproval = new Map(outcome.approvals.map((approval) => [approval.id, approval.toolName]));

  /*
   * In German the line is composed from a German label and the record it
   * names. The handler's English sentence ends in the identifier of the record
   * it created when it created one ("Issue raised: ISS-..."), and that
   * identifier is kept; anything else after the colon is English prose, so the
   * targeted record is named instead.
   */
  const statementOf = (line: (typeof outcome.lines)[number]): string => {
    if (language !== "de") return line.statement;
    if (line.statementDe.length > 0) return line.statementDe;
    const label = RECEIPT_LABELS[line.objectKind];
    if (!label) return line.statement;
    const suffix = line.statement.split(": ").slice(1).join(": ").trim();
    const created = /^[A-Z]{2,}[A-Z0-9-]*-[A-Z0-9-]+$/.test(suffix) ? suffix : line.objectId;
    return `${label.de}: ${created}`;
  };

  const executed: ReceiptLineView[] = [];
  const failed: FailedChangeView[] = [];
  const claimed = new Set<string>();

  for (const consequence of outcome.consequences) {
    const kind = consequence.kind ?? (consequence.toolName ? (TOOL_TO_KIND[consequence.toolName] ?? null) : null);
    if (consequence.outcome === "executed") {
      const lines = consequence.receiptLineIds
        .map((id) => linesById.get(id))
        .filter((line): line is NonNullable<typeof line> => line !== undefined);
      const first = lines[0];
      // An executed change is listed only when a real line backs it.
      if (!first) continue;
      for (const line of lines) claimed.add(line.id);
      executed.push({
        id: first.id,
        label: pairOr(kind ? RECEIPT_LABELS[kind] : undefined, consequenceLabel(kind, language), language),
        statements: lines.map(statementOf),
        register: registerOf(consequence.toolName, language),
        targetId: consequence.targetId ?? first.objectId,
        executedAtMoment: first.executedAtMoment,
        auditEventId: first.auditEventId,
      });
      continue;
    }

    failed.push({
      key: `${decision.id}:failed:${consequence.index}`,
      label: consequenceLabel(kind, language),
      register: registerOf(consequence.toolName, language),
      targetId: consequence.targetId ?? "",
      reason: reasonText(consequence.reason, consequence.code ?? (consequence.outcome === "failed" ? "failed" : null), language),
      outcomeLabel: say(
        consequence.outcome === "blocked"
          ? COPY.outcomeRefusedByGate
          : consequence.outcome === "failed"
            ? COPY.outcomeFailed
            : COPY.outcomeNotAttempted,
        language,
      ),
    });
  }

  // Lines no consequence claimed, which an older record can hold. Shown, never dropped.
  for (const line of outcome.lines) {
    if (claimed.has(line.id)) continue;
    const toolName = line.approvalId ? (toolByApproval.get(line.approvalId) ?? null) : null;
    executed.push({
      id: line.id,
      label: pairOr(RECEIPT_LABELS[line.objectKind], line.objectKind, language),
      statements: [statementOf(line)],
      register: registerOf(toolName, language),
      targetId: line.objectId,
      executedAtMoment: line.executedAtMoment,
      auditEventId: line.auditEventId,
    });
  }

  const total = executed.length + failed.length;
  const kind: RecordedDecisionView["outcome"] =
    total === 0 ? "no-changes" : failed.length === 0 ? "complete" : executed.length === 0 ? "none-executed" : "partial";
  const outcomeLine =
    kind === "no-changes"
      ? say(COPY.outcomeNoChanges, language)
      : kind === "complete"
        ? fill(say(COPY.outcomeComplete, language), { executed: executed.length, total })
        : fill(say(COPY.outcomePartial, language), { executed: executed.length, total, failed: failed.length });

  return {
    decisionId: decision.id,
    reference: decision.reference,
    headline,
    question: decision.question,
    chosenOptionLabel: chosen ? localised(language, chosen.label, chosen.labelDe) : null,
    rationale: decision.recordedRationale,
    decidedByName: decidedBy?.name ?? decision.decidedByUserId ?? "",
    decidedByTitle: decidedBy?.jobTitle ?? "",
    decidedAtMoment: decision.decidedAtMoment,
    approvalCount: outcome.approvals.length,
    approverName: approver?.name ?? approverFallback,
    executed,
    failed,
    outcome: kind,
    outcomeLine,
    process: links.process,
    meeting: links.meeting,
  };
}

/* ==========================================================================
   Process stage decisions
   ========================================================================== */

/**
 * The judgments a process stage is waiting on, from the process engine.
 *
 * A stage decision, such as the TPRM Stage 4 gate, lives on the stage rather
 * than in the `decisions` table, and it is recorded there because its options
 * depend on the evidence dispositions recorded in the same stage. The queue
 * lists it, with a link, so a reader does not have to know where to look. Read
 * through the engine's own context builder, which writes nothing.
 */
function stageDecisionRows(
  roleId: RoleId,
  language: Language,
  runId: string,
): { rows: StageDecisionRow[]; unavailable: boolean } {
  try {
    const rows: StageDecisionRow[] = [];
    for (const app of getInstalledRoleApps(roleId)) {
      const run = findActiveProcessRun(roleId, app.id, runId);
      if (!run || run.status === "completed") continue;
      const process = getProcessDefinition(app.processId);
      if (!process) continue;

      const context = buildStageContext({ processRunId: run.id, runId });
      if (!context.stageRun || context.stageRun.status === "completed") continue;

      for (const state of context.decisions) {
        if (state.spec.binding.kind !== "stage-decision" || state.status === "recorded") continue;
        const ready = context.preparation.state === "completed";
        rows.push({
          key: `${run.id}:${context.stage.id}:${state.spec.key}`,
          label: say(state.spec.label, language),
          question: say(state.spec.question, language),
          where: fill(say(COPY.stagePosition, language), {
            process: localised(language, process.name, process.nameDe),
            sequence: context.stage.sequence,
            stage: localised(language, context.stage.name, context.stage.nameDe),
          }),
          options: state.options.map((option) => say(option.label, language)),
          href: app.entryRoute ? `${app.entryRoute}?stage=${encodeURIComponent(context.stage.id)}` : null,
          ready,
          readyNote: say(ready ? COPY.stageReady : COPY.stageWaitingPreparation, language),
        });
      }
    }
    return { rows, unavailable: false };
  } catch (error) {
    log.warn("Process stage decisions could not be read.", { roleId, error });
    return { rows: [], unavailable: true };
  }
}

/* ==========================================================================
   The whole view
   ========================================================================== */

/**
 * Assembles the whole workspace for one role at one moment.
 *
 * Open decisions carry their five parts, so selecting another row is a local
 * state change rather than a round trip. Recorded decisions carry their
 * receipt, so reopening one from "Recorded today" is too.
 */
export function buildDecisionQueueView(options: DecisionQueueOptions): DecisionQueueViewModel {
  const { roleId, atMoment, language, autonomyLevel } = options;
  const runId = options.runId ?? DEFAULT_RUN_ID;
  const state = getScenarioState(runId);
  const scenarioDate = state?.scenarioDate ?? "";

  const role = getRole(roleId, runId);
  const holder = role ? getUser(role.holderUserId, runId) : undefined;
  const entity = role ? getEntity(role.entityId, runId) : undefined;

  const roleTitle = role ? (language === "de" ? role.titleDe : role.title) : roleId;
  const approverName = holder?.name ?? role?.holderUserId ?? roleId;
  // The job title is seeded in English only; in German the role's own German title is the person's title.
  const approverTitle = language === "de" && role?.titleDe ? role.titleDe : (holder?.jobTitle ?? "");

  const entries = getDecisions(roleId, atMoment, runId);
  const meetings = getMeetings(roleId, runId);
  const inbox = getInbox(roleId, atMoment, runId);

  /*
   * Headlines are made unique before anything is rendered. The seeded titles
   * are distinct, so in normal use this does nothing; it guards the failure
   * the queue was built to end, a screen that repeats one heading.
   */
  const seen = new Map<string, number>();
  const headlineFor = (title: string, reference: string): string => {
    const count = seen.get(title) ?? 0;
    seen.set(title, count + 1);
    return count === 0 ? title : `${title} (${reference})`;
  };

  const rows: DecisionQueueRow[] = [];
  const recorded: DecisionQueueRow[] = [];
  const details: ActiveDecisionView[] = [];
  const recordedDetails: RecordedDecisionView[] = [];

  for (const entry of entries) {
    const decision = entry.decision;
    const headline = headlineFor(localised(language, decision.title, decision.titleDe), decision.reference);

    const requiresApproval = entry.options.some((option) => option.requiresApproval);
    const authorityClass: AuthorityClass = requiresApproval ? "APPROVAL_REQUIRED" : "PROPOSE";
    const evidenceCount = new Set([...decision.supportingEvidenceIds, ...decision.opposingEvidenceIds]).size;
    const judgment = JUDGMENT_LABELS[decision.judgmentKind] ?? JUDGMENT_FALLBACK;
    const isOpen = decision.status === "open";
    const links = { process: processLink(decision, runId, language), meeting: meetingLink(decision, meetings, language) };

    const row: DecisionQueueRow = {
      decisionId: decision.id,
      reference: decision.reference,
      headline,
      summary: firstClause(decision.question, 110),
      judgmentLabel: say(judgment, language),
      authorityClass,
      authorityLabel: say(AUTHORITY_LABELS[authorityClass], language),
      presentedAtMoment: decision.presentedAtMoment,
      decidedAtMoment: decision.decidedAtMoment,
      status: isOpen ? "open" : "recorded",
      fromSharedEvent: decision.fromSharedEvent,
      evidenceCount,
      optionCount: entry.options.length,
      receiptCount: 0,
      failedCount: 0,
      chosenOptionLabel: null,
    };

    if (!isOpen) {
      const view = recordedView(decision, entry.options, headline, links, approverName, runId, language);
      row.receiptCount = view.executed.reduce((sum, change) => sum + change.statements.length, 0);
      row.failedCount = view.failed.length;
      row.chosenOptionLabel = view.chosenOptionLabel;
      recorded.push(row);
      recordedDetails.push(view);
      continue;
    }

    const optionsView = optionCards(decision, entry.options, approverName, runId, language);
    const changeCounts = optionsView.map((option) => option.changes.length);
    const minChanges = changeCounts.length === 0 ? 0 : Math.min(...changeCounts);
    const maxChanges = changeCounts.length === 0 ? 0 : Math.max(...changeCounts);
    const anyApproval = optionsView.some((option) => option.approvalsNeeded > 0);
    const position = currentPosition(decision, runId, language);

    rows.push(row);
    details.push({
      decisionId: decision.id,
      reference: decision.reference,
      headline,
      question: decision.question,
      judgmentLabel: say(judgment, language),
      authoritySummary: {
        prepared: fill(say(COPY.preparedSummary, language), { count: evidenceCount }),
        decides: fill(say(COPY.decidesSummary, language), { count: entry.options.length }),
        changes:
          minChanges === maxChanges
            ? fill(say(COPY.changesSummaryExact, language), { count: maxChanges })
            : fill(say(COPY.changesSummary, language), { min: minChanges, max: maxChanges }),
        approval: anyApproval
          ? fill(say(COPY.approvalSummary, language), { name: approverName })
          : say(COPY.approvalSummaryNone, language),
      },
      context: {
        trigger: shortParagraph(decision.whyThisMatters),
        triggerMeta: [
          fill(say(COPY.presentedAt, language), { moment: decision.presentedAtMoment }),
          decision.fromSharedEvent ? say(COPY.sharedEvent, language) : null,
        ]
          .filter((part): part is string => part !== null)
          .join(". "),
        process: links.process,
        meeting: links.meeting,
        affected: position.affected,
        deadline: deadlineFor(decision, inbox, scenarioDate, atMoment, language),
        currentPosition: position.position,
      },
      evidence: evidenceView(decision, runId, language),
      options: optionsView,
      authority: authorityView({
        authorityClass,
        requiresApproval,
        roleId,
        autonomyLevel,
        approverName,
        approverTitle,
        language,
      }),
      status: "open",
      proseIsEnglish: language === "de",
    });
  }

  const stage = stageDecisionRows(roleId, language, runId);

  const counts = [
    fill(say(COPY.contextOpen, language), { count: rows.length }),
    stage.rows.length > 0 ? fill(say(COPY.contextInStage, language), { count: stage.rows.length }) : null,
    fill(say(COPY.contextRecorded, language), { count: recorded.length }),
  ].filter((part): part is string => part !== null);

  return {
    roleId,
    language,
    currentMoment: atMoment,
    locationParts: [roleTitle, entity?.shortName ?? role?.entityId ?? ""].filter((part) => part.length > 0),
    pageTitle: t(NAV_LABELS, "decisions", language),
    contextLine: `${counts.join(", ")}. ${say(COPY.oneAtATime, language)}`,
    rows,
    recorded,
    initialActiveId: rows[0]?.decisionId ?? null,
    details,
    recordedDetails,
    stageRows: stage.rows,
    stageRowsUnavailable: stage.unavailable,
  };
}

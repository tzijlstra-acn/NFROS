/**
 * The Inbox module's operations: triage, and conversion into governed work.
 *
 * Server only, called from the server actions in
 * `app/workday/[role]/work/inbox-actions.ts`, which validate the input shape
 * and revalidate the workday afterwards. Each operation does what the Actions
 * operations do and no more:
 *
 *   resolves the message as the reader sees it, through the same read model
 *   the detail pane renders, so the operation refuses exactly what the pane
 *   shows as unavailable (a message that already became an action, a stage
 *   that is not open, a delegate who is not offered);
 *   builds the payload the person is approving;
 *   runs it through `runGoverned`, which asks the gate, records the person's
 *   payload bound approval where the gate needs one, and calls the handler.
 *
 * Nothing here writes a row. A message becomes an action through the
 * existing `createAction` tool, with the message as the action's source, and
 * is then linked to it; it joins a process stage as a stage input and
 * through the backbone, and the stage is brought up to date through the
 * process engine's public API (`syncStage`), never by writing the engine's
 * tables.
 */

import type { RoleId } from "@/db/schema/core";
import { getRole } from "@/db/repositories/workday";
import { linkStageInputRecords } from "@/db/repositories/process-stage-inputs";
import { linkOsEventAudit } from "@/features/events/backbone";
import { buildStageContext, routeRoleRefusal, syncStage } from "@/features/process/orchestrator";
import { requireScenarioState } from "@/scenario/engine/state";
import { createLogger } from "@/server/logging/redact";
import { fill, say, type Pair } from "../../copy";
import { firstLine } from "../../model";
import { runGoverned, type GovernedContext, type GovernedResult } from "../../governance";
import { loadWorkShared } from "../../hub-data";
import type { WorkSharedData } from "../../shared";
import { DEFAULT_QUERY } from "../../url";
import type { OperationOutcome } from "../actions/operations";
import { loadInboxExtras } from "./load";
import { resolveInboxDetail, type InboxDetail, type InboxOperationId } from "./read-model";
import { isInboxClassification } from "./triage-schema";

const log = createLogger("work-inbox");

const MESSAGES = {
  notYours: {
    en: "This message is not in this role's inbox at the current moment, so nothing was changed.",
    de: "Diese Nachricht ist zum aktuellen Zeitpunkt nicht im Posteingang dieser Rolle, daher wurde nichts geaendert.",
  },
  needReason: { en: "Give a reason of your own for this classification.", de: "Geben Sie eine eigene Begruendung fuer diese Einordnung an." },
  unknownClassification: { en: "That is not one of the six classifications.", de: "Das ist keine der sechs Einordnungen." },
  sameClassification: { en: "That is already the classification. Nothing was changed.", de: "Das ist bereits die Einordnung. Nichts wurde geaendert." },
  materialConfirm: {
    en: "Raising an action is a material change. Confirm that the action, its owner, its due date and the reason are your own.",
    de: "Eine Massnahme anzulegen ist eine wesentliche Aenderung. Bestaetigen Sie, dass Massnahme, verantwortliche Person, Faelligkeit und Begruendung Ihre eigenen sind.",
  },
  ownerNotOffered: {
    en: "The owner must be an internal person who can hold accountability for an action.",
    de: "Verantwortlich muss eine interne Person sein, die Verantwortung fuer eine Massnahme tragen kann.",
  },
  kindNotOffered: { en: "That kind of action is not configured for this role.", de: "Diese Art von Massnahme ist fuer diese Rolle nicht konfiguriert." },
  dueRequired: { en: "An action from the inbox needs a due date.", de: "Eine Massnahme aus dem Posteingang braucht eine Faelligkeit." },
  pastDate: { en: "A due date cannot be set before the scenario day.", de: "Ein Faelligkeitsdatum kann nicht vor dem Szenariotag liegen." },
  noExisting: { en: "There is no open action to link this message to.", de: "Es gibt keine offene Massnahme, mit der diese Nachricht verknuepft werden kann." },
  objectNotOffered: {
    en: "The message can be filed only against the objects it or the role's running processes concern.",
    de: "Die Nachricht kann nur zu Objekten abgelegt werden, die sie oder die laufenden Prozesse der Rolle betreffen.",
  },
  stageNotOffered: { en: "That stage is not an open stage of this role's running processes.", de: "Diese Stufe ist keine offene Stufe der laufenden Prozesse dieser Rolle." },
  delegateNotOffered: { en: "That person cannot take on this message.", de: "Diese Person kann diese Nachricht nicht uebernehmen." },
  linkFailed: {
    en: "Action {id} was raised with this message as its source, but the message could not be linked to it: {reason}",
    de: "Die Massnahme {id} wurde mit dieser Nachricht als Quelle angelegt, aber die Nachricht konnte nicht verknuepft werden: {reason}",
  },
  stageSynced: { en: "Process stage {stage} brought up to date through the process engine", de: "Prozessstufe {stage} ueber die Prozess-Engine aktualisiert" },
  stageUnreadable: {
    en: "The process stage could not be brought up to date now. It shows the message the next time it is opened.",
    de: "Die Prozessstufe konnte jetzt nicht aktualisiert werden. Sie zeigt die Nachricht beim naechsten Oeffnen.",
  },
  triaged: { en: "Triage recorded.", de: "Einordnung erfasst." },
  routed: { en: "Routed to the decision.", de: "An die Entscheidung weitergeleitet." },
  dismissed: { en: "Dismissed. It stays searchable.", de: "Verworfen. Sie bleibt auffindbar." },
  actionRaised: { en: "Action raised from the message.", de: "Massnahme aus der Nachricht angelegt." },
  actionLinked: { en: "Linked to the action.", de: "Mit der Massnahme verknuepft." },
  filed: { en: "Filed as evidence.", de: "Als Nachweis abgelegt." },
  attached: { en: "Added to the process stage.", de: "Der Prozessstufe zugeordnet." },
  delegated: { en: "Delegated. Nothing left this machine.", de: "Delegiert. Nichts hat diesen Rechner verlassen." },
  drafted: { en: "Reply drafted. Nothing was sent.", de: "Antwort entworfen. Nichts wurde gesendet." },
  replied: { en: "Simulated reply recorded. Nothing left this machine.", de: "Simulierte Antwort erfasst. Nichts hat diesen Rechner verlassen." },
  notDone: { en: "Nothing was changed.", de: "Nichts wurde geaendert." },
} as const satisfies Record<string, Pair>;

interface Scope {
  shared: WorkSharedData;
  detail: InboxDetail;
  language: "en" | "de";
}

function refusal(message: string): OperationOutcome {
  return { ok: false, message, receipt: [], blocked: [message] };
}

function isOutcome(value: Scope | OperationOutcome): value is OperationOutcome {
  return "ok" in value;
}

/** The message as the reader sees it, or the refusal. */
function scoped(roleId: RoleId, messageId: string): Scope | OperationOutcome {
  const state = requireScenarioState();
  const shared = loadWorkShared(roleId);
  if (!shared || !shared.messages.some((row) => row.id === messageId)) return refusal(say(MESSAGES.notYours, state.language));
  const extras = loadInboxExtras(shared, { ...DEFAULT_QUERY, tab: "inbox", item: messageId });
  const detail = resolveInboxDetail(messageId, shared, extras, DEFAULT_QUERY);
  if (!detail) return refusal(say(MESSAGES.notYours, state.language));
  return { shared, detail, language: state.language };
}

/**
 * Refuses an operation the message cannot take (already converted, no open
 * stage, no reply address), in the detail pane's own words, before anything
 * is asked of the gate. An operation the gate itself would refuse is not
 * refused here: it goes on to the gate, which refuses it and writes the
 * blocked attempt to the audit trail, as every Work Hub refusal does.
 */
function unavailable(scope: Scope, id: InboxOperationId): OperationOutcome | null {
  const operation = scope.detail.operations.find((entry) => entry.id === id);
  if (!operation) return refusal(say(MESSAGES.notDone, scope.language));
  return operation.stateBlocked ? refusal(operation.disabledReason) : null;
}

function governed(roleId: RoleId, messageId: string, rationale: string, extra: Partial<GovernedContext> = {}): GovernedContext {
  return { roleId, confirmed: true, rationale, subjectKind: "inbox-message", subjectId: messageId, ...extra };
}

/**
 * Links the backbone event a handler published, and the stage input it
 * recorded, to the audit row the runtime wrote after it.
 */
function linkAudit(result: GovernedResult): void {
  const data = result.data as { eventId?: unknown; stageInputId?: unknown } | null;
  if (result.ok && typeof data?.eventId === "string" && result.auditEventId) {
    try {
      linkOsEventAudit(data.eventId, result.auditEventId);
    } catch (error) {
      log.warn("The inbox event was not linked to its audit row.", { error });
    }
  }
  if (result.ok && typeof data?.stageInputId === "string" && result.auditEventId) {
    try {
      linkStageInputRecords(data.stageInputId, { auditEventId: result.auditEventId });
    } catch (error) {
      log.warn("The stage input was not linked to its audit row.", { error });
    }
  }
}

function outcomeOf(language: "en" | "de", results: readonly GovernedResult[], done: Pair, extraReceipt: string[] = []): OperationOutcome {
  for (const result of results) linkAudit(result);
  const ok = results.length > 0 && results.every((result) => result.ok);
  const blocked = results.filter((result) => !result.ok).map((result) => result.summary);
  return {
    ok,
    message: ok ? say(done, language) : (blocked[0] ?? say(MESSAGES.notDone, language)),
    receipt: [...results.flatMap((result) => result.receipt), ...(ok ? extraReceipt : [])],
    blocked,
  };
}

async function chain(steps: ReadonlyArray<() => Promise<GovernedResult>>): Promise<GovernedResult[]> {
  const results: GovernedResult[] = [];
  for (const step of steps) {
    const result = await step();
    results.push(result);
    if (!result.ok) break;
  }
  return results;
}

/* ==========================================================================
   Triage
   ========================================================================== */

export async function confirmTriage(input: { roleId: RoleId; messageId: string }): Promise<OperationOutcome> {
  const scope = scoped(input.roleId, input.messageId);
  if (isOutcome(scope)) return scope;
  const blocked = unavailable(scope, "confirm-triage");
  if (blocked) return blocked;
  const { detail, language } = scope;
  const classification = detail.classification.proposedId;
  if (!classification) return refusal(say(MESSAGES.unknownClassification, language));

  const route = classification === "decision" ? detail.forms.routeDecision : null;
  const steps: Array<() => Promise<GovernedResult>> = [];
  if (detail.classification.confirmedId !== classification) {
    steps.push(() =>
      runGoverned(
        { toolName: "recordInboxTriage", payload: { messageId: input.messageId, classification, proposed: classification, reason: "" } },
        governed(input.roleId, input.messageId, `Confirmed the proposed classification of ${input.messageId}.`),
      ),
    );
  }
  if (route) {
    steps.push(() =>
      runGoverned(
        { toolName: "linkInboxMessage", payload: { messageId: input.messageId, targetKind: "decision", targetId: route.id, created: false } },
        governed(input.roleId, input.messageId, `Routed ${input.messageId} to decision ${route.id}.`),
      ),
    );
  }
  const results = await chain(steps);
  return outcomeOf(language, results, route ? MESSAGES.routed : classification === "noise" ? MESSAGES.dismissed : MESSAGES.triaged);
}

/** The validated proposal's classification, or null when none passed the checks. */
function proposalClassification(scope: Scope): string | null {
  return scope.detail.classification.proposedId;
}

export async function changeTriage(input: {
  roleId: RoleId;
  messageId: string;
  classification: string;
  reason: string;
}): Promise<OperationOutcome> {
  const scope = scoped(input.roleId, input.messageId);
  if (isOutcome(scope)) return scope;
  const blocked = unavailable(scope, "change-triage");
  if (blocked) return blocked;
  const { language } = scope;
  if (!isInboxClassification(input.classification)) return refusal(say(MESSAGES.unknownClassification, language));
  const proposed = proposalClassification(scope);
  if (scope.detail.classification.confirmedId === input.classification) return refusal(say(MESSAGES.sameClassification, language));
  if (input.classification !== proposed && input.reason.trim().length === 0) return refusal(say(MESSAGES.needReason, language));

  const results = await chain([
    () =>
      runGoverned(
        {
          toolName: "recordInboxTriage",
          payload: { messageId: input.messageId, classification: input.classification, proposed: proposed ?? "", reason: input.reason.trim() },
        },
        governed(input.roleId, input.messageId, input.reason.trim() || `Classified ${input.messageId} as ${input.classification}.`),
      ),
  ]);
  return outcomeOf(language, results, input.classification === "noise" ? MESSAGES.dismissed : MESSAGES.triaged);
}

export async function dismissMessage(input: { roleId: RoleId; messageId: string; reason: string }): Promise<OperationOutcome> {
  const scope = scoped(input.roleId, input.messageId);
  if (isOutcome(scope)) return scope;
  const blocked = unavailable(scope, "dismiss");
  if (blocked) return blocked;
  const proposed = proposalClassification(scope);
  if (proposed !== "noise" && input.reason.trim().length === 0) return refusal(say(MESSAGES.needReason, scope.language));
  const results = await chain([
    () =>
      runGoverned(
        { toolName: "recordInboxTriage", payload: { messageId: input.messageId, classification: "noise", proposed: proposed ?? "", reason: input.reason.trim() } },
        governed(input.roleId, input.messageId, input.reason.trim() || `Dismissed ${input.messageId} as proposed.`),
      ),
  ]);
  return outcomeOf(scope.language, results, MESSAGES.dismissed);
}

/* ==========================================================================
   Message to action
   ========================================================================== */

export interface CreateActionInput {
  roleId: RoleId;
  messageId: string;
  /** Link to the existing open action the message concerns, instead of raising a new one. */
  linkExisting: boolean;
  title: string;
  kind: string;
  ownerUserId: string;
  dueOn: string | null;
  reason: string;
  confirmed: boolean;
}

export async function createActionFromMessage(input: CreateActionInput): Promise<OperationOutcome> {
  const scope = scoped(input.roleId, input.messageId);
  if (isOutcome(scope)) return scope;
  const blocked = unavailable(scope, "create-action");
  if (blocked) return blocked;
  const { shared, detail, language } = scope;
  const t = (pair: Pair) => say(pair, language);

  if (input.linkExisting) {
    const existing = detail.forms.existingAction;
    if (!existing) return refusal(t(MESSAGES.noExisting));
    const results = await chain([
      () =>
        runGoverned(
          { toolName: "linkInboxMessage", payload: { messageId: input.messageId, targetKind: "action", targetId: existing.id, created: false } },
          governed(input.roleId, input.messageId, `Linked ${input.messageId} to ${existing.id}.`),
        ),
    ]);
    return outcomeOf(language, results, MESSAGES.actionLinked);
  }

  /* Material: refused before any approval is recorded, so an unconfirmed request leaves nothing behind. */
  if (!input.confirmed || input.reason.trim().length === 0) return refusal(t(MESSAGES.materialConfirm));
  if (!detail.forms.assignable.some((person) => person.id === input.ownerUserId)) return refusal(t(MESSAGES.ownerNotOffered));
  if (!detail.forms.actionKinds.some((kind) => kind.id === input.kind)) return refusal(t(MESSAGES.kindNotOffered));
  if (!input.dueOn) return refusal(t(MESSAGES.dueRequired));
  if (input.dueOn < shared.scenarioDate) return refusal(t(MESSAGES.pastDate));

  const row = shared.messages.find((candidate) => candidate.id === input.messageId);
  if (!row) return refusal(t(MESSAGES.notYours));
  const entityId = getRole(input.roleId)?.entityId ?? "ARC-DE";
  const related =
    row.relatedObjectKind && row.relatedObjectId && row.relatedObjectKind !== "action" && row.relatedObjectKind !== "decision"
      ? { relatedObjectKind: row.relatedObjectKind, relatedObjectId: row.relatedObjectId }
      : {};
  const decisionId = row.linkedDecisionId ?? (row.relatedObjectKind === "decision" ? row.relatedObjectId : null);

  const created = await runGoverned(
    {
      toolName: "createAction",
      payload: {
        title: input.title.trim(),
        description: `${input.title.trim()}\n\nRaised from inbox message ${row.id} from ${row.fromLabel}: ${firstLine(row.subject, 200)}`,
        kind: input.kind,
        ownerUserId: input.ownerUserId,
        entityId,
        dueOn: input.dueOn,
        priority: row.requiresResponseBy ? "high" : "medium",
        ...related,
        ...(decisionId ? { decisionId } : {}),
        sourceMessageId: row.id,
      },
    },
    /* The link step publishes the one account of the new action, with the action as its subject. */
    governed(input.roleId, input.messageId, input.reason.trim(), { confirmed: input.confirmed, publish: false }),
  );
  if (!created.ok) return outcomeOf(language, [created], MESSAGES.actionRaised);

  const actionId = (created.data as { actionId?: unknown } | null)?.actionId;
  if (typeof actionId !== "string") return outcomeOf(language, [created], MESSAGES.actionRaised);
  const linked = await runGoverned(
    { toolName: "linkInboxMessage", payload: { messageId: row.id, targetKind: "action", targetId: actionId, created: true } },
    governed(input.roleId, input.messageId, `Linked ${row.id} to ${actionId}, raised from it.`),
  );
  if (!linked.ok) {
    /*
     * The action exists and names the message as its source, so the lineage
     * still reads from the action; the person is told the second half did
     * not happen rather than shown a success.
     */
    const message = fill(t(MESSAGES.linkFailed), { id: actionId, reason: linked.summary });
    return { ok: false, message, receipt: created.receipt, blocked: [message] };
  }
  return outcomeOf(language, [created, linked], MESSAGES.actionRaised);
}

/* ==========================================================================
   Message to evidence
   ========================================================================== */

export async function linkAsEvidence(input: {
  roleId: RoleId;
  messageId: string;
  objectIds: string[];
  title: string;
}): Promise<OperationOutcome> {
  const scope = scoped(input.roleId, input.messageId);
  if (isOutcome(scope)) return scope;
  const blocked = unavailable(scope, "link-evidence");
  if (blocked) return blocked;
  const offered = new Set(scope.detail.forms.evidenceObjects.map((object) => object.id));
  if (input.objectIds.some((id) => !offered.has(id))) return refusal(say(MESSAGES.objectNotOffered, scope.language));
  const results = await chain([
    () =>
      runGoverned(
        { toolName: "fileInboxMessageAsEvidence", payload: { messageId: input.messageId, objectIds: input.objectIds, title: input.title.trim() } },
        governed(input.roleId, input.messageId, `Filed ${input.messageId} as evidence.`),
      ),
  ]);
  return outcomeOf(scope.language, results, MESSAGES.filed);
}

/* ==========================================================================
   Message to process
   ========================================================================== */

/** Brings the stage up to date through the engine's public API. Never writes the engine's tables. */
async function updateStage(processRunId: string, stageId: string, language: "en" | "de"): Promise<string> {
  try {
    const context = buildStageContext({ processRunId, stageId });
    const stage = say({ en: context.stage.name, de: context.stage.nameDe }, language);
    await syncStage(processRunId, stageId);
    return fill(say(MESSAGES.stageSynced, language), { stage });
  } catch (error) {
    log.warn("The process stage of an inbox message was not brought up to date.", { processRunId, stageId, error });
    return say(MESSAGES.stageUnreadable, language);
  }
}

export async function addToProcess(input: {
  roleId: RoleId;
  messageId: string;
  processRunId: string;
  stageId: string;
}): Promise<OperationOutcome> {
  const scope = scoped(input.roleId, input.messageId);
  if (isOutcome(scope)) return scope;
  const blocked = unavailable(scope, "add-to-process");
  if (blocked) return blocked;
  const { language } = scope;
  if (!scope.detail.forms.stages.some((stage) => stage.value === `${input.processRunId}::${input.stageId}`)) {
    return refusal(say(MESSAGES.stageNotOffered, language));
  }
  /* The process engine's own rule: a request from another role's workday is refused before anything is written. */
  const wrongRole = routeRoleRefusal(input.processRunId, input.roleId);
  if (wrongRole) return refusal(say(wrongRole.message, language));

  const classification = proposalClassification(scope);
  const results = await chain([
    () =>
      runGoverned(
        {
          toolName: "addInboxMessageToProcess",
          payload: {
            messageId: input.messageId,
            processRunId: input.processRunId,
            stageId: input.stageId,
            classification: scope.detail.classification.confirmedId ? "" : (classification ?? ""),
          },
        },
        governed(input.roleId, input.messageId, `Attached ${input.messageId} to stage ${input.stageId} of ${input.processRunId}.`),
      ),
  ]);
  const ok = results.every((result) => result.ok);
  const stageNote = ok ? await updateStage(input.processRunId, input.stageId, language) : null;
  return outcomeOf(language, results, MESSAGES.attached, stageNote ? [stageNote] : []);
}

/* ==========================================================================
   Delegate and reply
   ========================================================================== */

export async function delegateMessage(input: {
  roleId: RoleId;
  messageId: string;
  toUserId: string;
  note: string;
}): Promise<OperationOutcome> {
  const scope = scoped(input.roleId, input.messageId);
  if (isOutcome(scope)) return scope;
  const blocked = unavailable(scope, "delegate");
  if (blocked) return blocked;
  if (!scope.detail.forms.delegates.some((person) => person.id === input.toUserId)) return refusal(say(MESSAGES.delegateNotOffered, scope.language));
  const results = await chain([
    () =>
      runGoverned(
        { toolName: "delegateInboxMessage", payload: { messageId: input.messageId, toUserId: input.toUserId, note: input.note.trim() } },
        governed(input.roleId, input.messageId, input.note.trim()),
      ),
  ]);
  return outcomeOf(scope.language, results, MESSAGES.delegated);
}

export async function draftReply(input: { roleId: RoleId; messageId: string }): Promise<OperationOutcome> {
  const scope = scoped(input.roleId, input.messageId);
  if (isOutcome(scope)) return scope;
  const blocked = unavailable(scope, "draft-reply");
  if (blocked) return blocked;
  const result = await runGoverned(
    { toolName: "draftInboxReply", payload: { messageId: input.messageId } },
    governed(input.roleId, input.messageId, "", { confirmed: false }),
  );
  if (!result.ok) return refusal(result.summary);
  const draft = result.data as { subject?: unknown; body?: unknown } | null;
  return {
    ok: true,
    message: say(MESSAGES.drafted, scope.language),
    receipt: [],
    blocked: [],
    draft: {
      subject: typeof draft?.subject === "string" ? draft.subject : "",
      body: typeof draft?.body === "string" ? draft.body : "",
    },
  };
}

export async function sendReply(input: { roleId: RoleId; messageId: string; subject: string; body: string }): Promise<OperationOutcome> {
  const scope = scoped(input.roleId, input.messageId);
  if (isOutcome(scope)) return scope;
  const blocked = unavailable(scope, "draft-reply");
  if (blocked) return blocked;
  /* Sending has its own verdict (drafting is reachable lower); a gate refusal is left to the gate, which audits it. */
  const results = await chain([
    () =>
      runGoverned(
        { toolName: "sendInboxReply", payload: { messageId: input.messageId, subject: input.subject.trim(), body: input.body.trim() } },
        governed(input.roleId, input.messageId, input.subject.trim()),
      ),
  ]);
  return outcomeOf(scope.language, results, MESSAGES.replied);
}

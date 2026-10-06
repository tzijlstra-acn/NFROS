/**
 * The meeting lifecycle's operations.
 *
 * Server only, called from the server actions in
 * `app/workday/[role]/work/actions.ts`, which validate the input shape and
 * revalidate the workday afterwards. Each operation does what the Actions
 * operations do and no more: checks the meeting is on this role's agenda,
 * builds the exact payload the person is approving, checks it against the
 * institution before any approval is recorded, and runs it through
 * `runGoverned`. Nothing here writes a row; the handlers in `tools.ts` do,
 * after the gate.
 *
 *   Capture, draft and save write the minutes draft. The draft each one
 *   writes is built here from the version the person was looking at, and the
 *   version travels with it, so a stale form is refused rather than
 *   overwriting someone's later edit.
 *
 *   Confirm is the material one. It requires the person's explicit
 *   confirmation of the decisions, the actions with their owners and due
 *   dates, and the distribution, and a reason of their own; the approval it
 *   records binds to the draft's version and digest, the actions it will
 *   raise and the recipients. A confirmation of minutes that are already
 *   confirmed writes nothing and says so. After the confirmation commits, the
 *   process stage the meeting serves is brought up to date through the
 *   process engine's public API, and the simulated distribution follows as
 *   its own governed step.
 */

import type { RoleId } from "@/db/schema/core";
import { getEvidenceByIds } from "@/db/repositories/work-hub";
import { getMeetingTranscript } from "@/db/repositories/meetings";
import { linkOsEventAudit } from "@/features/events/backbone";
import { buildStageContext, syncStage } from "@/features/process/orchestrator";
import { createLogger } from "@/server/logging/redact";
import { requireScenarioState } from "@/scenario/engine/state";
import { fill, say, type Pair } from "../../copy";
import { minutesOf, timeOf } from "../../model";
import { runGoverned, runGovernedChain } from "../../governance";
import { loadWorkShared } from "../../hub-data";
import type { MeetingRow, WorkSharedData } from "../../shared";
import type { OperationOutcome } from "../actions/operations";
import {
  emptyMinutesDraft,
  minutesDraftSchema,
  validateMinutesDraft,
  type MinutesDecisionOutcome,
  type MinutesDraft,
  type MinutesItemKind,
} from "./ai-schema";
import { digestOf, draftMinutes } from "./ai";
import { mentionedIds, mergeIntoDraft, nextItemKey } from "./compose";
import {
  actionIdForMinutes,
  draftOfMinutes,
  evidenceIdForMinutes,
  heardTurns,
  isConfirmedMinutes,
  minutesIdForMeeting,
  minutesValidationContext,
} from "./lifecycle";
import { workingMinutes } from "./load";

const log = createLogger("work-meetings");

export interface MeetingOperationOutcome extends OperationOutcome {
  minutesId?: string;
  version?: number;
}

const MESSAGES = {
  notYours: {
    en: "This meeting is not on this role's agenda, so nothing was changed.",
    de: "Diese Besprechung steht nicht auf der Agenda dieser Rolle, daher wurde nichts geaendert.",
  },
  notStarted: {
    en: "The meeting starts at {time}. It can be minuted once it has started.",
    de: "Die Besprechung beginnt um {time}. Sie kann protokolliert werden, sobald sie begonnen hat.",
  },
  confirmed: {
    en: "These minutes are confirmed. A confirmed record is not changed.",
    de: "Dieses Protokoll ist bestaetigt. Eine bestaetigte Aufzeichnung wird nicht geaendert.",
  },
  alreadyConfirmed: {
    en: "These minutes were already confirmed on {when}. Nothing was written a second time.",
    de: "Dieses Protokoll wurde bereits am {when} bestaetigt. Nichts wurde ein zweites Mal geschrieben.",
  },
  alreadyDrafted: {
    en: "The minutes draft already exists. Edit it; it is yours.",
    de: "Der Protokollentwurf liegt bereits vor. Bearbeiten Sie ihn; er gehoert Ihnen.",
  },
  stale: {
    en: "The minutes changed since this page was loaded (version {current}, not {version}). Reload and make the change again.",
    de: "Das Protokoll hat sich seit dem Laden geaendert (Version {current}, nicht {version}). Laden Sie neu und wiederholen Sie die Aenderung.",
  },
  noMinutes: { en: "These minutes do not exist for this role.", de: "Dieses Protokoll existiert fuer diese Rolle nicht." },
  confirmAll: {
    en: "Confirm the decisions, the actions with their owners and due dates, and the distribution, and give a reason of your own.",
    de: "Bestaetigen Sie die Entscheidungen, die Massnahmen mit Verantwortlichen und Fristen sowie den Verteiler, und geben Sie eine eigene Begruendung an.",
  },
  invalid: { en: "Nothing was written:", de: "Nichts wurde geschrieben:" },
  emptyItem: { en: "The item is empty.", de: "Der Eintrag ist leer." },
  captured: { en: "Captured into the minutes draft.", de: "Im Protokollentwurf erfasst." },
  saved: { en: "Draft saved.", de: "Entwurf gespeichert." },
  done: { en: "Minutes confirmed.", de: "Protokoll bestaetigt." },
  stageSynced: {
    en: "Process stage {stage} brought up to date through the process engine",
    de: "Prozessstufe {stage} ueber die Prozess-Engine aktualisiert",
  },
  stageNotOpen: {
    en: "Process stage {stage} is not open yet; the confirmed minutes are its meeting record when it opens",
    de: "Prozessstufe {stage} ist noch nicht offen; das bestaetigte Protokoll ist ihre Besprechungsaufzeichnung, sobald sie oeffnet",
  },
  stageCompleted: {
    en: "Process stage {stage} is already complete; the minutes are filed against it",
    de: "Prozessstufe {stage} ist bereits abgeschlossen; das Protokoll ist ihr zugeordnet",
  },
  stageUnreadable: {
    en: "The process stage could not be brought up to date now. It reads the meeting record when it is next opened.",
    de: "Die Prozessstufe konnte jetzt nicht aktualisiert werden. Sie liest die Besprechungsaufzeichnung beim naechsten Oeffnen.",
  },
} as const satisfies Record<string, Pair>;

function refusal(message: string): MeetingOperationOutcome {
  return { ok: false, message, receipt: [], blocked: [message] };
}

interface Scope {
  shared: WorkSharedData;
  meeting: MeetingRow;
  language: "en" | "de";
}

function scoped(roleId: RoleId, meetingId: string): Scope | MeetingOperationOutcome {
  const state = requireScenarioState();
  const shared = loadWorkShared(roleId);
  const meeting = shared?.meetings.find((candidate) => candidate.id === meetingId);
  if (!shared || !meeting) return refusal(say(MESSAGES.notYours, state.language));
  return { shared, meeting, language: state.language };
}

function isOutcome(value: Scope | MeetingOperationOutcome): value is MeetingOperationOutcome {
  return "ok" in value;
}

/** Checked before an approval is recorded, so a premature request leaves nothing behind. The handler checks again. */
function notStarted(scope: Scope): MeetingOperationOutcome | null {
  const { meeting, shared } = scope;
  const day = meeting.scheduledFor.slice(0, 10);
  const early =
    meeting.status !== "concluded" &&
    (day > shared.scenarioDate ||
      (day === shared.scenarioDate && minutesOf(timeOf(meeting.scheduledFor)) > minutesOf(shared.currentMoment)));
  return early ? refusal(fill(say(MESSAGES.notStarted, scope.language), { time: timeOf(meeting.scheduledFor) })) : null;
}

function evidenceFor(meeting: MeetingRow, draft: MinutesDraft | null, extra: readonly string[] = []) {
  const ids = new Set<string>([...meeting.evidenceDocumentIds, ...extra, ...(draft?.evidenceIds ?? [])]);
  for (const item of [...(draft?.facts ?? []), ...(draft?.actions ?? [])]) for (const id of item.evidenceIds) ids.add(id);
  return getEvidenceByIds([...ids]);
}

/** Validates a draft as a person's, and turns the failures into the refusal the person reads. */
function checked(scope: Scope, draft: unknown, extraEvidence: readonly string[] = [], forConfirmation = false) {
  const turns = getMeetingTranscript(scope.meeting.id);
  const parsed = minutesDraftSchema.safeParse(draft);
  const evidence = evidenceFor(scope.meeting, parsed.success ? parsed.data : null, extraEvidence);
  const result = validateMinutesDraft(draft, minutesValidationContext(scope.shared, scope.meeting, { turns, evidence }, "person", forConfirmation));
  if (result.ok) return { ok: true as const, draft: result.output };
  const reasons = [...new Set(result.failures.map((failure) => say(failure.message, scope.language)))];
  return { ok: false as const, outcome: { ok: false, message: `${say(MESSAGES.invalid, scope.language)} ${reasons.slice(0, 4).join(" ")}`, receipt: [], blocked: reasons } };
}

function fromChain(language: "en" | "de", chain: { ok: boolean; receipt: string[]; blocked: string[] }, done: Pair): MeetingOperationOutcome {
  return {
    ok: chain.ok,
    message: chain.ok ? say(done, language) : (chain.blocked[0] ?? ""),
    receipt: chain.receipt,
    blocked: chain.blocked,
  };
}

/** The draft the meeting's working minutes hold, or a fresh one addressed to the meeting's internal participants. */
function currentDraft(scope: Scope) {
  const minutes = workingMinutes(scope.shared, scope.meeting.id);
  if (minutes) return { minutes, minutesId: minutes.id, version: minutes.version, draft: draftOfMinutes(minutes, scope.language) };
  const internal = new Set(scope.shared.assignable.map((person) => person.id));
  const draft = emptyMinutesDraft(scope.language);
  draft.distribution = [
    ...new Set([...(scope.shared.holderUserId ? [scope.shared.holderUserId] : []), ...scope.meeting.participantUserIds]),
  ].filter((id) => internal.has(id));
  return { minutes: null, minutesId: minutesIdForMeeting(scope.meeting.id), version: 0, draft };
}

/* ==========================================================================
   During the meeting: capture
   ========================================================================== */

export interface CaptureInput {
  roleId: RoleId;
  meetingId: string;
  kind: MinutesItemKind;
  turnId: string | null;
  text: string;
  decisionId: string | null;
  outcome: MinutesDecisionOutcome;
  existingActionId: string | null;
  ownerUserId: string | null;
  ownerLabel: string;
  dueOn: string | null;
  actionKind: string;
  completionCondition: string;
  evidenceIds: string[];
}

export async function captureMeetingItem(input: CaptureInput): Promise<MeetingOperationOutcome> {
  const scope = scoped(input.roleId, input.meetingId);
  if (isOutcome(scope)) return scope;
  const early = notStarted(scope);
  if (early) return early;
  const current = currentDraft(scope);
  if (current.minutes && isConfirmedMinutes(current.minutes)) return refusal(say(MESSAGES.confirmed, scope.language));
  const text = input.text.trim();
  if (text.length === 0) return refusal(say(MESSAGES.emptyItem, scope.language));

  const draft: MinutesDraft = structuredClone(current.draft);
  const key = nextItemKey(draft, input.kind);
  const turnIds = input.turnId ? [input.turnId] : [];
  const evidenceIds = [...new Set(input.evidenceIds)];
  switch (input.kind) {
    case "fact":
      draft.facts.push({ key, text, evidenceIds, turnIds, origin: "person" });
      break;
    case "decision":
      draft.decisions.push({ key, text, decisionId: input.decisionId, outcome: input.outcome, turnIds, origin: "person" });
      break;
    case "unresolved":
      draft.unresolved.push({ key, text, turnIds, origin: "person" });
      break;
    case "action": {
      const existing = input.existingActionId ? scope.shared.actions.find((action) => action.id === input.existingActionId) : undefined;
      draft.actions.push({
        key,
        title: existing ? existing.title : text,
        existingActionId: existing ? existing.id : null,
        ownerUserId: existing ? existing.ownerUserId : input.ownerUserId,
        ownerLabel: existing ? existing.ownerLabel : input.ownerLabel.trim(),
        dueOn: existing ? existing.dueOn : input.dueOn,
        kind: existing ? existing.kind : input.actionKind,
        completionCondition: existing ? text : input.completionCondition.trim(),
        evidenceIds,
        turnIds,
        origin: "person",
      });
      break;
    }
  }
  draft.evidenceIds = [...new Set([...draft.evidenceIds, ...evidenceIds])].slice(0, 40);

  const check = checked(scope, draft);
  if (!check.ok) return check.outcome;

  const chain = await runGovernedChain(
    [
      {
        toolName: "captureMeetingItem",
        payload: { meetingId: scope.meeting.id, minutesId: current.minutesId, expectedVersion: current.version, itemKind: input.kind, draft: check.draft },
      },
    ],
    { roleId: input.roleId, confirmed: true, rationale: text, subjectKind: "minutes", subjectId: current.minutesId },
  );
  return { ...fromChain(scope.language, chain, MESSAGES.captured), minutesId: current.minutesId, version: current.version + 1 };
}

/* ==========================================================================
   After the meeting: draft and save
   ========================================================================== */

export async function prepareMinutes(input: { roleId: RoleId; meetingId: string }): Promise<MeetingOperationOutcome> {
  const scope = scoped(input.roleId, input.meetingId);
  if (isOutcome(scope)) return scope;
  const early = notStarted(scope);
  if (early) return early;
  const current = currentDraft(scope);
  if (current.minutes && isConfirmedMinutes(current.minutes)) return refusal(say(MESSAGES.confirmed, scope.language));
  if (current.minutes?.preparedMode) return refusal(say(MESSAGES.alreadyDrafted, scope.language));

  const { shared, meeting, language } = scope;
  const all = getMeetingTranscript(meeting.id);
  const turns = heardTurns(meeting, all, shared.scenarioDate, shared.currentMoment);
  const mentioned = turns.flatMap((turn) => [
    ...(turn.contradictsEvidenceId ? [turn.contradictsEvidenceId] : []),
    ...mentionedIds(turn.content).filter((id) => id.startsWith("EVD-")),
  ]);
  const evidence = evidenceFor(meeting, current.draft, mentioned);
  const internal = new Set(shared.assignable.map((person) => person.id));
  const kinds = Object.keys(shared.config.actionKinds);
  const result = draftMinutes(
    {
      meeting,
      typeLabel: say(shared.config.meetingTypes[meeting.kind]?.label ?? { en: meeting.kind, de: meeting.kind }, language),
      turns,
      complete: turns.length === all.length,
      language,
      internalPeople: internal,
      decisions: shared.decisions,
      openActions: shared.actions.filter((action) => action.status !== "completed" && action.status !== "cancelled"),
      knownEvidenceIds: new Set(evidence.keys()),
      actionKinds: [...kinds.filter((kind) => kind === "evidence-request"), ...kinds.filter((kind) => kind !== "evidence-request")],
      holderUserId: shared.holderUserId,
    },
    minutesValidationContext(shared, meeting, { turns: all, evidence }, "ai"),
  );
  if (!result.draft) return refusal(say(result.note, language));

  const merged = mergeIntoDraft(result.draft, current.minutes ? current.draft : null);
  const check = checked(scope, merged);
  if (!check.ok) return check.outcome;

  const chain = await runGovernedChain(
    [
      {
        toolName: "prepareMeetingMinutes",
        payload: { meetingId: meeting.id, minutesId: current.minutesId, expectedVersion: current.version, draft: check.draft, preparedMode: result.mode },
      },
    ],
    { roleId: input.roleId, confirmed: true, rationale: say(result.note, language), subjectKind: "minutes", subjectId: current.minutesId },
  );
  return {
    ...fromChain(language, chain, result.note),
    minutesId: current.minutesId,
    version: current.version + 1,
  };
}

function sameItem(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Marks as the person's every item they added or changed. An AI item the
 * person left exactly as drafted keeps its origin, so the record still says
 * which words the person wrote.
 */
function ownChanges(previous: MinutesDraft, next: MinutesDraft): MinutesDraft {
  const before = new Map<string, unknown>();
  for (const item of [...previous.facts, ...previous.decisions, ...previous.actions, ...previous.unresolved]) before.set(item.key, item);
  const mark = <T extends { key: string; origin: "ai" | "person" }>(item: T): T => {
    const old = before.get(item.key);
    if (old && sameItem({ ...(old as T), origin: item.origin }, item)) return item;
    return { ...item, origin: "person" };
  };
  return {
    ...next,
    facts: next.facts.map(mark),
    decisions: next.decisions.map(mark),
    actions: next.actions.map(mark),
    unresolved: next.unresolved.map(mark),
  };
}

export async function saveMinutes(input: {
  roleId: RoleId;
  meetingId: string;
  minutesId: string;
  version: number;
  draft: unknown;
}): Promise<MeetingOperationOutcome> {
  const scope = scoped(input.roleId, input.meetingId);
  if (isOutcome(scope)) return scope;
  const minutes = scope.shared.minutes.find((entry) => entry.id === input.minutesId && entry.meetingId === scope.meeting.id);
  if (!minutes) return refusal(say(MESSAGES.noMinutes, scope.language));
  if (isConfirmedMinutes(minutes)) return refusal(say(MESSAGES.confirmed, scope.language));
  if (minutes.version !== input.version) {
    return refusal(fill(say(MESSAGES.stale, scope.language), { current: minutes.version, version: input.version }));
  }
  const parsed = minutesDraftSchema.safeParse(input.draft);
  if (!parsed.success) {
    const check = checked(scope, input.draft);
    return check.ok ? refusal(say(MESSAGES.invalid, scope.language)) : check.outcome;
  }
  const next = ownChanges(draftOfMinutes(minutes, scope.language), parsed.data);
  const check = checked(scope, next);
  if (!check.ok) return check.outcome;

  const chain = await runGovernedChain(
    [
      {
        toolName: "editMeetingMinutes",
        payload: { meetingId: scope.meeting.id, minutesId: minutes.id, expectedVersion: minutes.version, draft: check.draft },
      },
    ],
    { roleId: input.roleId, confirmed: true, rationale: say(MESSAGES.saved, scope.language), subjectKind: "minutes", subjectId: minutes.id },
  );
  return { ...fromChain(scope.language, chain, MESSAGES.saved), minutesId: minutes.id, version: minutes.version + 1 };
}

/* ==========================================================================
   Confirmation
   ========================================================================== */

export interface ConfirmInput {
  roleId: RoleId;
  minutesId: string;
  version: number;
  confirmDecisions: boolean;
  confirmActions: boolean;
  confirmDistribution: boolean;
  confirmed: boolean;
  rationale: string;
}

/** Brings the process stage the meeting serves up to date, through the engine's public API. */
async function updateStage(
  process: { runId: string; stageId: string | null } | null,
  language: "en" | "de",
): Promise<string | null> {
  if (!process || !process.stageId) return null;
  try {
    const context = buildStageContext({ processRunId: process.runId, stageId: process.stageId });
    const stage = say({ en: context.stage.name, de: context.stage.nameDe }, language);
    if (!context.stageRun) return fill(say(MESSAGES.stageNotOpen, language), { stage });
    if (context.stageRun.status === "completed") return fill(say(MESSAGES.stageCompleted, language), { stage });
    await syncStage(process.runId, process.stageId);
    return fill(say(MESSAGES.stageSynced, language), { stage });
  } catch (error) {
    log.warn("The process stage of confirmed minutes was not brought up to date.", { process, error });
    return say(MESSAGES.stageUnreadable, language);
  }
}

export async function confirmMinutes(input: ConfirmInput): Promise<MeetingOperationOutcome> {
  const state = requireScenarioState();
  const language = state.language;
  const shared = loadWorkShared(input.roleId);
  const minutes = shared?.minutes.find((entry) => entry.id === input.minutesId);
  const meeting = minutes ? shared?.meetings.find((candidate) => candidate.id === minutes.meetingId) : undefined;
  if (!shared || !minutes || !meeting) return refusal(say(MESSAGES.noMinutes, language));
  const scope: Scope = { shared, meeting, language };

  /* Idempotent: confirming confirmed minutes writes nothing, records no approval, and says so. */
  if (isConfirmedMinutes(minutes)) {
    return {
      ok: true,
      message: fill(say(MESSAGES.alreadyConfirmed, language), { when: minutes.confirmedAt ? `${minutes.confirmedAt.slice(8, 10)}.${minutes.confirmedAt.slice(5, 7)}.${minutes.confirmedAt.slice(0, 4)}` : "" }),
      receipt: [],
      blocked: [],
      minutesId: minutes.id,
      version: minutes.version,
    };
  }
  if (minutes.version !== input.version) {
    return refusal(fill(say(MESSAGES.stale, language), { current: minutes.version, version: input.version }));
  }
  if (!input.confirmDecisions || !input.confirmActions || !input.confirmDistribution || !input.confirmed || input.rationale.trim().length === 0) {
    return refusal(say(MESSAGES.confirmAll, language));
  }
  const early = notStarted(scope);
  if (early) return early;

  const check = checked(scope, draftOfMinutes(minutes, language), [], true);
  if (!check.ok) return check.outcome;
  const draft = check.draft;

  const plannedIds: string[] = [];
  for (const action of draft.actions) {
    if (action.existingActionId === null) plannedIds.push(actionIdForMinutes(minutes.id, plannedIds.length + 1));
  }
  const governed = {
    roleId: input.roleId,
    confirmed: true,
    rationale: input.rationale.trim(),
    subjectKind: "minutes",
    subjectId: minutes.id,
  };

  const confirmation = await runGoverned(
    {
      toolName: "confirmMeetingMinutes",
      payload: {
        minutesId: minutes.id,
        meetingId: meeting.id,
        version: minutes.version,
        contentDigest: digestOf(draft),
        distribution: draft.distribution,
        actionIds: plannedIds,
        evidenceDocumentId: evidenceIdForMinutes(minutes.id),
        processRunId: meeting.processRunId,
        stageId: meeting.stageId,
      },
    },
    governed,
  );
  if (!confirmation.ok) {
    return { ok: false, message: confirmation.summary, receipt: [], blocked: [confirmation.summary], minutesId: minutes.id, version: minutes.version };
  }

  /* The backbone events were published inside the handler's transaction; the runtime wrote the audit row after it. */
  const data = (confirmation.data ?? {}) as { eventIds?: unknown; process?: { runId: string; stageId: string | null } | null };
  if (confirmation.auditEventId && Array.isArray(data.eventIds)) {
    for (const eventId of data.eventIds) if (typeof eventId === "string") linkOsEventAudit(eventId, confirmation.auditEventId);
  }

  const receipt = [...confirmation.receipt];
  const blocked: string[] = [];
  const stageLine = await updateStage(data.process ?? null, language);
  if (stageLine) receipt.push(stageLine);

  if (draft.distribution.length > 0) {
    const distribution = await runGovernedChain(
      [{ toolName: "distributeMeetingMinutes", payload: { minutesId: minutes.id, recipients: draft.distribution } }],
      governed,
    );
    receipt.push(...distribution.receipt);
    blocked.push(...distribution.blocked);
  }

  return {
    ok: true,
    message: blocked.length > 0 ? `${say(MESSAGES.done, language)} ${blocked[0] ?? ""}` : say(MESSAGES.done, language),
    receipt,
    blocked,
    minutesId: minutes.id,
    version: minutes.version,
  };
}

/**
 * The Actions module's operations.
 *
 * Server only, and called only from the server actions in
 * `app/workday/[role]/work/actions.ts`, which validate the input and
 * revalidate the workday afterwards. Each operation does three things and no
 * more: checks that the action is on this role's desk, builds the payload the
 * person is approving, and runs it through `runGoverned`. Nothing here writes
 * a row; the tool handlers do, after the gate.
 *
 * The rules a person might expect the interface to enforce are enforced here
 * again, because the interface is not the only possible caller:
 *
 *   a material change needs the person's explicit confirmation;
 *   closing an action of a kind that needs evidence needs cited evidence
 *   (and the handler refuses again on its own);
 *   accountability can be transferred, never removed (the handler refuses an
 *   empty owner whatever arrives here).
 */

import type { RoleId } from "@/db/schema/core";
import { getRole } from "@/db/repositories/workday";
import { getEvidenceByIds, getWorkActions, type WorkActionRow } from "@/db/repositories/work-hub";
import { requireScenarioState } from "@/scenario/engine/state";
import { say } from "../../copy";
import { getWorkRoleConfig } from "../../roles";
import { runGoverned, runGovernedChain, type GovernedContext } from "../../governance";
import { firstLine } from "../../model";
import { actionMateriality, evidenceRequiredToComplete } from "./policy";

export interface OperationOutcome {
  ok: boolean;
  message: string;
  receipt: string[];
  blocked: string[];
  draft?: { subject: string; body: string };
}

const MESSAGES = {
  notYours: {
    en: "This action is not on this role's desk, so nothing was changed.",
    de: "Diese Massnahme gehoert nicht zu dieser Rolle, daher wurde nichts geaendert.",
  },
  materialConfirm: {
    en: "This is a material change. Confirm that the judgment and the reason are your own.",
    de: "Dies ist eine wesentliche Aenderung. Bestaetigen Sie, dass Beurteilung und Begruendung Ihre eigenen sind.",
  },
  evidenceNeeded: {
    en: "This kind of action closes only with cited evidence. Select or enter the document that shows the condition is met.",
    de: "Diese Art von Massnahme wird nur mit zitiertem Nachweis geschlossen. Waehlen oder nennen Sie das Dokument, das die Erfuellung belegt.",
  },
  unknownEvidence: {
    en: "These evidence references do not exist, so nothing was closed:",
    de: "Diese Nachweisreferenzen existieren nicht, daher wurde nichts geschlossen:",
  },
  pastDate: {
    en: "A due date cannot be set before the scenario day.",
    de: "Ein Faelligkeitsdatum kann nicht vor dem Szenariotag liegen.",
  },
  noRemoval: {
    en: "Accountability cannot be removed from an action. Name the person it transfers to.",
    de: "Verantwortung kann einer Massnahme nicht entzogen werden. Nennen Sie die Person, an die sie uebergeht.",
  },
  done: { en: "Recorded.", de: "Erfasst." },
  drafted: { en: "Reminder drafted. Nothing was sent.", de: "Erinnerung entworfen. Nichts wurde gesendet." },
  notDone: { en: "Nothing was changed.", de: "Nichts wurde geaendert." },
} as const;

interface Scoped {
  row: WorkActionRow;
  language: "en" | "de";
}

function scoped(roleId: RoleId, actionId: string): Scoped | OperationOutcome {
  const state = requireScenarioState();
  const holder = getRole(roleId)?.holderUserId ?? null;
  const row = getWorkActions(roleId, holder).find((candidate) => candidate.id === actionId);
  if (!row) return refusal(say(MESSAGES.notYours, state.language));
  return { row, language: state.language };
}

function refusal(message: string): OperationOutcome {
  return { ok: false, message, receipt: [], blocked: [message] };
}

function isOutcome(value: Scoped | OperationOutcome): value is OperationOutcome {
  return "ok" in value;
}

function governedFor(roleId: RoleId, row: WorkActionRow, confirmed: boolean, rationale: string): GovernedContext {
  return { roleId, confirmed, rationale, subjectKind: "action", subjectId: row.id };
}

function fromChain(
  language: "en" | "de",
  chain: { ok: boolean; receipt: string[]; blocked: string[] },
): OperationOutcome {
  return {
    ok: chain.ok,
    message: chain.ok ? say(MESSAGES.done, language) : (chain.blocked[0] ?? say(MESSAGES.notDone, language)),
    receipt: chain.receipt,
    blocked: chain.blocked,
  };
}

function isMaterial(roleId: RoleId, row: WorkActionRow, language: "en" | "de"): boolean {
  const config = getWorkRoleConfig(roleId);
  return config ? actionMateriality(row, config, language).material : true;
}

/* ==========================================================================
   Operations
   ========================================================================== */

export async function assignAction(input: {
  roleId: RoleId;
  actionId: string;
  ownerUserId: string;
  reason: string;
  confirmed: boolean;
}): Promise<OperationOutcome> {
  const scope = scoped(input.roleId, input.actionId);
  if (isOutcome(scope)) return scope;
  if (!input.confirmed) return refusal(say(MESSAGES.materialConfirm, scope.language));
  /*
   * Refused before an approval is recorded, so a request to remove
   * accountability leaves no approval behind. The handler refuses it again.
   */
  if (input.ownerUserId.trim().length === 0) return refusal(say(MESSAGES.noRemoval, scope.language));
  const chain = await runGovernedChain(
    [{ toolName: "reassignAction", payload: { actionId: scope.row.id, ownerUserId: input.ownerUserId, reason: input.reason } }],
    governedFor(input.roleId, scope.row, input.confirmed, input.reason),
  );
  return fromChain(scope.language, chain);
}

export async function changeDueDate(input: {
  roleId: RoleId;
  actionId: string;
  dueOn: string;
  reason: string;
  confirmed: boolean;
}): Promise<OperationOutcome> {
  const scope = scoped(input.roleId, input.actionId);
  if (isOutcome(scope)) return scope;
  /*
   * A material due date never moves without the person's confirmation. A
   * routine one still records an approval in their name, because the gate
   * classes every due date change as needing one; the difference is only
   * whether the interface asks them to tick a statement first.
   */
  if (isMaterial(input.roleId, scope.row, scope.language) && !input.confirmed) {
    return refusal(say(MESSAGES.materialConfirm, scope.language));
  }
  if (input.dueOn < requireScenarioState().scenarioDate) {
    return refusal(say(MESSAGES.pastDate, scope.language));
  }
  const chain = await runGovernedChain(
    [{ toolName: "changeActionDueDate", payload: { actionId: scope.row.id, dueOn: input.dueOn, reason: input.reason } }],
    governedFor(input.roleId, scope.row, true, input.reason),
  );
  return fromChain(scope.language, chain);
}

export async function requestEvidence(input: {
  roleId: RoleId;
  actionId: string;
  what: string;
  fromUserId: string | null;
  fromLabel: string;
  dueOn: string | null;
}): Promise<OperationOutcome> {
  const scope = scoped(input.roleId, input.actionId);
  if (isOutcome(scope)) return scope;
  const { row } = scope;
  const ownerUserId = input.fromUserId ?? row.ownerUserId ?? "";
  const ownerLabel = input.fromLabel.trim();
  const chain = await runGovernedChain(
    [
      {
        toolName: "requestEvidenceDocument",
        payload: {
          documentDescription: input.what,
          ownerUserId,
          ownerLabel,
          relatedObjectKind: "action",
          relatedObjectId: row.id,
          entityId: row.entityId,
          ...(input.dueOn ? { dueOn: input.dueOn } : {}),
        },
      },
      {
        toolName: "addActionUpdate",
        payload: {
          actionId: row.id,
          entryKind: "REQ",
          note: `Evidence requested${ownerLabel ? ` from ${ownerLabel}` : ""}: ${firstLine(input.what, 200)}`,
        },
      },
    ],
    governedFor(input.roleId, row, true, input.what),
  );
  return fromChain(scope.language, chain);
}

export async function addUpdate(input: {
  roleId: RoleId;
  actionId: string;
  note: string;
  evidenceIds: string[];
  blocker: "set" | "clear" | null;
  entryKind: "UPD" | "CC";
}): Promise<OperationOutcome> {
  const scope = scoped(input.roleId, input.actionId);
  if (isOutcome(scope)) return scope;
  const chain = await runGovernedChain(
    [
      {
        toolName: "addActionUpdate",
        payload: {
          actionId: scope.row.id,
          note: input.note,
          entryKind: input.entryKind,
          ...(input.evidenceIds.length > 0 ? { evidenceIds: input.evidenceIds } : {}),
          ...(input.blocker ? { blocker: input.blocker } : {}),
        },
      },
    ],
    governedFor(input.roleId, scope.row, true, input.note),
  );
  return fromChain(scope.language, chain);
}

export async function draftReminder(input: { roleId: RoleId; actionId: string }): Promise<OperationOutcome> {
  const scope = scoped(input.roleId, input.actionId);
  if (isOutcome(scope)) return scope;
  const result = await runGoverned(
    { toolName: "draftActionReminder", payload: { actionId: scope.row.id } },
    governedFor(input.roleId, scope.row, false, ""),
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

export async function sendReminder(input: {
  roleId: RoleId;
  actionId: string;
  subject: string;
  body: string;
}): Promise<OperationOutcome> {
  const scope = scoped(input.roleId, input.actionId);
  if (isOutcome(scope)) return scope;
  const { row } = scope;
  const recipient = row.ownerLabel.trim().length > 0 ? row.ownerLabel.trim() : (row.ownerUserId ?? "");
  const chain = await runGovernedChain(
    [
      {
        toolName: "sendSimulatedCollaborationMessage",
        payload: {
          subject: input.subject,
          body: input.body,
          toUserIds: row.ownerUserId ? [row.ownerUserId] : [],
          kind: "follow-up",
          channelName: "Action follow-up",
          relatedObjectKind: "action",
          relatedObjectId: row.id,
        },
      },
      {
        toolName: "addActionUpdate",
        payload: {
          actionId: row.id,
          entryKind: "RMD",
          note: `Simulated reminder sent to ${recipient}: ${firstLine(input.subject, 160)}`,
        },
      },
    ],
    governedFor(input.roleId, row, true, input.subject),
  );
  return fromChain(scope.language, chain);
}

export async function completeWithEvidence(input: {
  roleId: RoleId;
  actionId: string;
  note: string;
  evidenceIds: string[];
  confirmed: boolean;
}): Promise<OperationOutcome> {
  const scope = scoped(input.roleId, input.actionId);
  if (isOutcome(scope)) return scope;
  const { row, language } = scope;
  const config = getWorkRoleConfig(input.roleId);
  if (config && evidenceRequiredToComplete(row.kind, config) && input.evidenceIds.length === 0) {
    return refusal(say(MESSAGES.evidenceNeeded, language));
  }
  /* Material closure is human: no confirmation, no approval, no closure. */
  if (isMaterial(input.roleId, row, language) && !input.confirmed) {
    return refusal(say(MESSAGES.materialConfirm, language));
  }
  const known = getEvidenceByIds(input.evidenceIds);
  const unknown = input.evidenceIds.filter((id) => !known.has(id));
  if (unknown.length > 0) {
    return refusal(`${say(MESSAGES.unknownEvidence, language)} ${unknown.join(", ")}`);
  }
  const chain = await runGovernedChain(
    [{ toolName: "completeAction", payload: { actionId: row.id, note: input.note, evidenceIds: input.evidenceIds } }],
    governedFor(input.roleId, row, true, input.note),
  );
  return fromChain(language, chain);
}

export async function reopenAction(input: {
  roleId: RoleId;
  actionId: string;
  reason: string;
  confirmed: boolean;
}): Promise<OperationOutcome> {
  const scope = scoped(input.roleId, input.actionId);
  if (isOutcome(scope)) return scope;
  if (isMaterial(input.roleId, scope.row, scope.language) && !input.confirmed) {
    return refusal(say(MESSAGES.materialConfirm, scope.language));
  }
  const chain = await runGovernedChain(
    [{ toolName: "reopenAction", payload: { actionId: scope.row.id, reason: input.reason } }],
    governedFor(input.roleId, scope.row, true, input.reason),
  );
  return fromChain(scope.language, chain);
}

export async function escalateAction(input: {
  roleId: RoleId;
  actionId: string;
  reason: string;
  confirmed: boolean;
}): Promise<OperationOutcome> {
  const scope = scoped(input.roleId, input.actionId);
  if (isOutcome(scope)) return scope;
  const { row, language } = scope;
  if (!input.confirmed) return refusal(say(MESSAGES.materialConfirm, language));
  const config = getWorkRoleConfig(input.roleId);
  const route = config?.professionalActions.escalation;
  const chain = await runGovernedChain(
    [
      {
        toolName: "addCommitteeAgendaItem",
        payload: {
          title: `Escalation: ${row.reference} ${firstLine(row.title, 120)}`,
          summary: input.reason,
          itemType: "escalation",
          relatedObjectKind: "action",
          relatedObjectId: row.id,
          entityId: row.entityId,
          ...(route
            ? { committeeRef: route.committeeRef, committeeName: route.committeeName, meetingDate: route.meetingDate }
            : {}),
        },
      },
      {
        toolName: "addActionUpdate",
        payload: {
          actionId: row.id,
          entryKind: "ESC",
          note: `Escalated to ${route?.committeeRef ?? "the committee"}. Reason: ${firstLine(input.reason, 200)}`,
        },
      },
    ],
    governedFor(input.roleId, row, true, input.reason),
  );
  return fromChain(language, chain);
}

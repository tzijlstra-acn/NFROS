/**
 * The governed path for every Product Owner Console action.
 *
 * One function, `governConsoleAction`, and every console write goes through
 * it, so the three conditions hold everywhere and in the same order:
 *
 *   1. permission: the acting persona holds the action's scope
 *      (`CONSOLE_ACTIONS` in `permissions.ts`), checked here on the server on
 *      every call, whatever the interface showed;
 *   2. approval, for a material action: the person saw exactly what will
 *      change, confirmed the rationale is their own, and the approval is
 *      bound to a fingerprint of that change. The server recomputes the
 *      change from the current state, so a change that moved between review
 *      and submission is refused rather than executed under an approval
 *      given for something else;
 *   3. the action's own rule (no release while a mandatory gate fails, no
 *      approval without a passing evaluation, and so on), evaluated against
 *      the current state.
 *
 * Then the change and its audit record are written in one transaction. A
 * refusal at any step writes a blocked audit event with the reason, because a
 * gate that refuses silently teaches an auditor nothing.
 *
 * Audit. The authority record stays `audit_events`, as the data model asks
 * (plan 8.3: product configuration history is not domain audit). An approval
 * is its own audit event, category "approval", carrying the fingerprint, the
 * rationale and the approver's scopes; the change's audit event and the
 * product history row (`role_app_lifecycle_events.approval_id`,
 * `product_release_events.approval_id`) name it. The workday's `approvals`
 * table is not used: it is keyed by a workday role and read by the analyst's
 * own activity rail, and a product owner's approval is neither.
 *
 * Reuse. The fingerprint is the authority gate's own `fingerprintPayload`,
 * so the console binds approvals exactly as the workday does.
 *
 * Server only.
 */

import { getSqlite } from "@/db/client";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import { getScenarioState } from "@/scenario/engine/state";
import { fingerprintPayload } from "@/server/security/authority";
import { recordAuditEvent } from "@/server/security/audit";
import { createLogger } from "@/server/logging/redact";
import {
  CONSOLE_ACTIONS,
  checkConsolePermission,
  type Bilingual,
  type ConsoleActionDefinition,
  type ConsoleActionId,
  type ProductPersonaId,
} from "./permissions";
import { actingLabel, readActingConsoleIdentity, type ActingConsoleIdentity } from "./persona/acting";

const log = createLogger("product-console");

/** The smallest rationale a material approval accepts, in characters. */
export const MIN_RATIONALE_LENGTH = 12;

export interface ConsoleActor {
  personaId: ProductPersonaId | null;
  userId: string | null;
  /** "Platform Product Owner (demonstration persona)", as history and audit record it. */
  label: string;
  identity: ActingConsoleIdentity;
}

export interface ConsoleTarget {
  /** For example "role-app", "role-app-version", "product-release". */
  kind: string;
  id: string;
}

/** What the person confirmed when approving a material action. */
export interface ConsoleApprovalInput {
  /** The fingerprint of the change the person reviewed, from the form. */
  reviewedFingerprint: string;
  rationale: string;
  rationaleConfirmed: boolean;
}

export type ConsoleRefusalCode =
  | "no-persona"
  | "missing-scope"
  | "approval-missing"
  | "approval-not-confirmed"
  | "approval-payload-mismatch"
  | "rule"
  | "failed";

export type ConsoleActionResult<T> =
  | { ok: true; value: T; message: Bilingual; auditEventId: string; approvalId: string | null }
  | { ok: false; code: ConsoleRefusalCode; reason: Bilingual; auditEventId: string | null };

export interface ConsoleExecutionContext {
  actor: ConsoleActor;
  /** The approval audit event, for a material action; null otherwise. */
  approvalId: string | null;
  /** Wall clock time of the change, ISO. */
  at: string;
  /** The rationale the person gave, for a material action; "" otherwise. */
  rationale: string;
}

export interface GovernedConsoleAction<P, T> {
  actionId: ConsoleActionId;
  target: ConsoleTarget;
  /**
   * The change, recomputed on the server from the current state. A material
   * action's approval is bound to its fingerprint.
   */
  payload: unknown;
  approval?: ConsoleApprovalInput | null;
  /** One sentence for the audit trail, saying what was asked. */
  summary: Bilingual;
  /** The action's rule against the current state: a reason to refuse, or null. */
  rule?: () => Bilingual | null;
  /**
   * Work that must happen before the write and cannot sit in a database
   * transaction: running the release gate's checks, writing a file. Runs
   * after permission, approval and rule have passed.
   */
  prepare?: (actor: ConsoleActor) => Promise<P>;
  /** The write. Synchronous, so it runs in one transaction with its audit record. */
  execute: (context: ConsoleExecutionContext, prepared: P) => T;
  /** What to tell the person once it is done. */
  success: (value: T) => Bilingual;
}

/** The fingerprint a material action's approval binds to. */
export function fingerprintConsoleChange(actionId: ConsoleActionId, payload: unknown): string {
  return fingerprintPayload(`console:${actionId}`, payload);
}

function auditScope(): { runId: string; atMoment: string } {
  try {
    const state = getScenarioState();
    return { runId: state?.runId ?? DEFAULT_RUN_ID, atMoment: state?.currentMoment ?? "00:00" };
  } catch {
    return { runId: DEFAULT_RUN_ID, atMoment: "00:00" };
  }
}

function actorFrom(identity: ActingConsoleIdentity): ConsoleActor {
  return {
    personaId: identity.persona?.id ?? null,
    userId: identity.userId,
    label: actingLabel(identity),
    identity,
  };
}

function recordRefusal(
  definition: ConsoleActionDefinition,
  actor: ConsoleActor,
  target: ConsoleTarget,
  code: ConsoleRefusalCode,
  reason: Bilingual,
): string | null {
  try {
    const { runId, atMoment } = auditScope();
    return recordAuditEvent({
      runId,
      atMoment,
      category: "blocked",
      action: `console:${definition.id}`,
      objectKind: target.kind,
      objectId: target.id,
      summary: `Product owner console refused "${definition.label.en}" for ${actor.label}: ${reason.en}`,
      actorUserId: actor.userId,
      actorKind: "human",
      authorityClass: definition.material ? "APPROVAL_REQUIRED" : null,
      blocked: true,
      blockedReason: `${code}: ${reason.en}`,
      reversible: true,
      detail: { console: true, actionId: definition.id, personaId: actor.personaId, code },
    });
  } catch (error) {
    log.error("A console refusal could not be audited.", { error });
    return null;
  }
}

/**
 * Checks permission only, without writing anything but a refusal. For a
 * console read that is an action in the plan (Compare versions, Inspect
 * failed case) and for any caller that needs the actor before building a
 * proposal.
 */
export async function authorizeConsoleAction(
  actionId: ConsoleActionId,
  target: ConsoleTarget,
): Promise<{ ok: true; actor: ConsoleActor } | { ok: false; code: ConsoleRefusalCode; reason: Bilingual; auditEventId: string | null }> {
  const definition = CONSOLE_ACTIONS[actionId];
  const identity = await readActingConsoleIdentity();
  const actor = actorFrom(identity);
  const verdict = checkConsolePermission(identity.scopes, actionId);
  if (!verdict.allowed) {
    return { ok: false, code: verdict.code, reason: verdict.reason, auditEventId: recordRefusal(definition, actor, target, verdict.code, verdict.reason) };
  }
  return { ok: true, actor };
}

/** Records a permitted console read in the audit trail, as a tool call. */
export function recordConsoleRead(actionId: ConsoleActionId, actor: ConsoleActor, target: ConsoleTarget, summary: Bilingual): string | null {
  try {
    const { runId, atMoment } = auditScope();
    return recordAuditEvent({
      runId,
      atMoment,
      category: "tool-call",
      action: `console:${actionId}`,
      objectKind: target.kind,
      objectId: target.id,
      summary: `Product owner console, ${actor.label}: ${summary.en}`,
      actorUserId: actor.userId,
      actorKind: "human",
      authorityClass: "READ",
      reversible: true,
      detail: { console: true, actionId, personaId: actor.personaId },
    });
  } catch (error) {
    log.error("A console read could not be audited.", { error });
    return null;
  }
}

/**
 * The approval check for a material action. Pure, so it can be tested
 * without a database: the reviewed fingerprint must match the change as it
 * is now, and the rationale must be stated and confirmed.
 */
export function checkConsoleApproval(
  approval: ConsoleApprovalInput | null | undefined,
  currentFingerprint: string,
): { ok: true } | { ok: false; code: "approval-missing" | "approval-not-confirmed" | "approval-payload-mismatch"; reason: Bilingual } {
  if (!approval || approval.reviewedFingerprint.length === 0) {
    return {
      ok: false,
      code: "approval-missing",
      reason: {
        en: "This change is material and needs an approval. Review what will change and approve it.",
        de: "Diese Aenderung ist wesentlich und braucht eine Genehmigung. Pruefen Sie, was sich aendert, und genehmigen Sie es.",
      },
    };
  }
  if (approval.reviewedFingerprint !== currentFingerprint) {
    return {
      ok: false,
      code: "approval-payload-mismatch",
      reason: {
        en: "The record changed after you reviewed it, so the approval no longer matches the change. Review it again.",
        de: "Der Datensatz hat sich nach Ihrer Pruefung geaendert, die Genehmigung passt daher nicht mehr zur Aenderung. Pruefen Sie erneut.",
      },
    };
  }
  if (!approval.rationaleConfirmed || approval.rationale.trim().length < MIN_RATIONALE_LENGTH) {
    return {
      ok: false,
      code: "approval-not-confirmed",
      reason: {
        en: `State the rationale in your own words (at least ${MIN_RATIONALE_LENGTH} characters) and confirm it is yours.`,
        de: `Begruenden Sie in eigenen Worten (mindestens ${MIN_RATIONALE_LENGTH} Zeichen) und bestaetigen Sie, dass die Begruendung Ihre ist.`,
      },
    };
  }
  return { ok: true };
}

/** Runs one console action through permission, approval, rule, write and audit. */
export async function governConsoleAction<P = undefined, T = unknown>(
  input: GovernedConsoleAction<P, T>,
): Promise<ConsoleActionResult<T>> {
  const definition = CONSOLE_ACTIONS[input.actionId];

  /* 1. Permission. */
  const authorized = await authorizeConsoleAction(input.actionId, input.target);
  if (!authorized.ok) return authorized;
  const actor = authorized.actor;

  /* 2. Approval, bound to the change as it is now. */
  const fingerprint = fingerprintConsoleChange(input.actionId, input.payload);
  if (definition.material) {
    const approval = checkConsoleApproval(input.approval, fingerprint);
    if (!approval.ok) {
      return { ok: false, code: approval.code, reason: approval.reason, auditEventId: recordRefusal(definition, actor, input.target, approval.code, approval.reason) };
    }
  }

  /* 3. The action's own rule. */
  const ruleRefusal = input.rule ? input.rule() : null;
  if (ruleRefusal) {
    return { ok: false, code: "rule", reason: ruleRefusal, auditEventId: recordRefusal(definition, actor, input.target, "rule", ruleRefusal) };
  }

  let prepared: P;
  try {
    prepared = input.prepare ? await input.prepare(actor) : (undefined as P);
  } catch (error) {
    log.error("A console action could not be prepared.", { error, actionId: input.actionId });
    const reason = {
      en: "The action could not be completed. The error is recorded in the server log.",
      de: "Die Aktion konnte nicht ausgefuehrt werden. Der Fehler ist im Serverprotokoll erfasst.",
    };
    return { ok: false, code: "failed", reason, auditEventId: recordRefusal(definition, actor, input.target, "failed", reason) };
  }

  /* 4. The write and its audit record, in one transaction. */
  const { runId, atMoment } = auditScope();
  const at = new Date().toISOString();
  const rationale = definition.material ? (input.approval?.rationale.trim() ?? "") : "";
  try {
    const write = getSqlite().transaction(() => {
      const approvalId = definition.material
        ? recordAuditEvent({
            runId,
            atMoment,
            category: "approval",
            action: `console:${definition.id}`,
            objectKind: input.target.kind,
            objectId: input.target.id,
            summary: `${actor.label} approved "${definition.label.en}": ${input.summary.en}`,
            actorUserId: actor.userId,
            actorKind: "human",
            authorityClass: "APPROVAL_REQUIRED",
            reversible: false,
            detail: {
              console: true,
              actionId: definition.id,
              personaId: actor.personaId,
              scopes: actor.identity.scopes ?? [],
              payloadFingerprint: fingerprint,
              rationale,
              rationaleConfirmed: true,
            },
          })
        : null;
      const value = input.execute({ actor, approvalId, at, rationale }, prepared);
      const auditEventId = recordAuditEvent({
        runId,
        atMoment,
        category: "mutation",
        action: `console:${definition.id}`,
        objectKind: input.target.kind,
        objectId: input.target.id,
        summary: `Product owner console, ${actor.label}: ${input.summary.en}`,
        actorUserId: actor.userId,
        actorKind: "human",
        authorityClass: definition.material ? "APPROVAL_REQUIRED" : "POLICY_BOUND_AUTONOMOUS",
        approvalId,
        reversible: !definition.material,
        detail: { console: true, actionId: definition.id, personaId: actor.personaId, payloadFingerprint: fingerprint },
      });
      return { value, approvalId, auditEventId };
    });
    const { value, approvalId, auditEventId } = write();
    return { ok: true, value, message: input.success(value), auditEventId, approvalId };
  } catch (error) {
    log.error("A console action failed.", { error, actionId: input.actionId });
    const reason = {
      en: "The action could not be completed. Nothing was changed, and the error is recorded in the server log.",
      de: "Die Aktion konnte nicht ausgefuehrt werden. Es wurde nichts geaendert, der Fehler ist im Serverprotokoll erfasst.",
    };
    return { ok: false, code: "failed", reason, auditEventId: recordRefusal(definition, actor, input.target, "failed", reason) };
  }
}

/* ==========================================================================
   For server actions
   ========================================================================== */

/** The state a console form shows after a submission. */
export interface ConsoleFormState {
  ok: boolean;
  message: string;
  /** Set when a refusal named a code, for tests and for the form's tone. */
  code?: ConsoleRefusalCode;
}

/** A result in the reader's language, for a server action's return value. */
export function toFormState(result: ConsoleActionResult<unknown>, language: "en" | "de"): ConsoleFormState {
  if (result.ok) return { ok: true, message: language === "de" ? result.message.de : result.message.en };
  return { ok: false, message: language === "de" ? result.reason.de : result.reason.en, code: result.code };
}

/** Reads the approval fields every material console form posts. */
export function readApprovalFields(data: FormData): ConsoleApprovalInput {
  const confirmed = data.get("rationaleConfirmed");
  return {
    reviewedFingerprint: String(data.get("fingerprint") ?? ""),
    rationale: String(data.get("rationale") ?? "").slice(0, 2000),
    rationaleConfirmed: confirmed === "on" || confirmed === "true",
  };
}

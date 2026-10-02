/**
 * The server side of the AI Partner.
 *
 * It reads the real state of the day and hands it to the dock, so the first
 * paint already shows what happened while the user was away. A dock that
 * mounted empty and filled in a moment later would have failed at the one job
 * it has, which is answering "what changed" before the user has to ask.
 */

import type { RoleId } from "@/db/schema/core";
import type { ScenarioState } from "@/scenario/engine/state";
import { getResolvedDemoMode } from "@/server/config/runtime";
import {
  getActiveSuggestions,
  getActivityEntries,
  getOpenChatThreadId,
  getSourceAttributions,
} from "@/db/repositories/partner";
import { buildWorkdayContext } from "@/db/repositories/shell";
import { getExecutionReceipt } from "@/db/repositories/workday";
import type { ExecutionReceiptLineView, WorkdaySelection } from "@/workday/contracts";
import type { Language } from "@/i18n/labels";
import { PartnerClient } from "./PartnerClient";

/**
 * Reads everything the dock needs, as plain serialisable data.
 *
 * Exported because V3.1 does not render the dock on the server. The dock is
 * collapsed by default there, and putting its data in the first response
 * would undo the thing that made the V3 role home a 59KB document against
 * V2's 373KB. `app/api/workday/partner/route.ts` serves this on first open
 * instead. Every field is JSON, which is what makes that possible without a
 * second implementation of the dock.
 */
export function buildPartnerData(
  roleId: RoleId,
  language: Language,
  state: ScenarioState,
  selection: WorkdaySelection | null,
) {
  const demoMode = getResolvedDemoMode().mode;

  const context = buildWorkdayContext(roleId, {
    language,
    demoMode,
    selection,
  });

  const suggestions = getActiveSuggestions(roleId, state.currentMoment, { language });
  const activity = getActivityEntries(roleId, state.currentMoment);

  /*
   * Receipt lines for the decisions this role has already taken today, so the
   * dock can show what was actually carried out rather than what was asked
   * for. Local lines are marked `local`; an external line carries its target
   * system and the reference that system returned, and a queued or failed
   * line looks different from an acknowledged one. The product never reports
   * an external change as complete before the target confirms it.
   */
  const receiptLines: ExecutionReceiptLineView[] = context.recentDecisionIds.flatMap(
    (decisionId, decisionIndex) =>
      getExecutionReceipt(decisionId).map((line, lineIndex) => ({
        id: `${decisionId}-${lineIndex}`,
        statement: line.statement,
        targetSystem: null,
        externalType: null,
        externalId: null,
        externalUrl: null,
        status: "local" as const,
        statusDetail: "",
        retryState: "",
        attempts: 1,
        completedAt: null,
        auditEventId: null,
        sequence: decisionIndex * 100 + lineIndex,
      })),
  );

  const generationSources = selection
    ? getSourceAttributions(selection.objectType, selection.objectId)
    : [];

  const threadId = getOpenChatThreadId(roleId);

  return { context, suggestions, activity, receiptLines, generationSources, threadId };
}

export function PartnerSlot({
  roleId,
  language,
  state,
  selection = null,
}: {
  roleId: RoleId;
  language: Language;
  state: ScenarioState;
  selection?: WorkdaySelection | null;
}) {
  const { threadId, ...data } = buildPartnerData(roleId, language, state, selection);
  return <PartnerClient {...data} initialThreadId={threadId} />;
}

/**
 * The collapsed rendering.
 *
 * Same data, same component, `presence` set. It is the same dock rather than a
 * second cut down one, so the state the user sees on a 1366 projector is the
 * state the dock actually holds, and opening it reveals detail rather than
 * loading it.
 */
export function PartnerPresenceSlot({
  roleId,
  language,
  state,
  selection = null,
}: {
  roleId: RoleId;
  language: Language;
  state: ScenarioState;
  selection?: WorkdaySelection | null;
}) {
  const { threadId, ...data } = buildPartnerData(roleId, language, state, selection);
  return <PartnerClient {...data} initialThreadId={threadId} presence />;
}

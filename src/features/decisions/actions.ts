"use server";

/**
 * The Decisions workspace's one server action.
 *
 * A thin wrapper, like every server action in this product: validate the
 * input, refuse what the screen would not have allowed, call the governed
 * engine, revalidate the role's workday, and answer in the reader's language.
 * It holds no rule about authority. Whether the decision may be recorded,
 * whether each change may execute and who approves it are decided by
 * `recordDecisionAndExecute` and the authority gate, which re-read the
 * database on every call, so a crafted request cannot do what the disabled
 * button would not.
 *
 * Three things it adds over the shared `actionRecordDecision` in
 * `app/actions.ts`, which the V1 and V2 surfaces still use:
 *
 *   It states the acting role, the route's role, so a decision of another
 *   role is refused before anything is written.
 *
 *   It enforces the rationale minimum on the server. The 20 character floor
 *   was client side only, and the server accepted one character (J22).
 *
 *   It sends the fingerprints of the changes the person approved one by one,
 *   so the engine can refuse a confirmation whose changes are not the ones
 *   that would now execute.
 */

import { z } from "zod";
import { ROLE_IDS, type RoleId } from "@/db/schema/core";
import { recordDecisionAndExecute } from "@/scenario/engine/decide";
import { getScenarioState } from "@/scenario/engine/state";
import { revalidateWorkday } from "@/workday/revalidate";
import { createLogger } from "@/server/logging/redact";
import { COPY, fill, REFUSAL_MESSAGES, say } from "./copy";
import { MINIMUM_RATIONALE_LENGTH } from "./model";

const log = createLogger("decision-actions");

export interface DecisionConfirmInput {
  roleId: string;
  decisionId: string;
  optionId: string;
  rationale: string;
  rationaleConfirmed: boolean;
  /** The fingerprints of the changes the person approved, in execution order. */
  approvedChanges: string[];
}

export interface DecisionConfirmState {
  ok: boolean;
  /** True when the decision is on the record, whatever happened to its changes. */
  recorded: boolean;
  message: string;
  /** Plain reasons, one per change that did not execute or would be refused. */
  reasons: string[];
  executedCount: number;
  failedCount: number;
}

const identifier = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9._:-]+$/);

const schema = z.object({
  roleId: z.enum(ROLE_IDS),
  decisionId: identifier,
  optionId: identifier,
  rationale: z.string().max(4000),
  rationaleConfirmed: z.boolean(),
  approvedChanges: z.array(z.string().regex(/^[a-f0-9]{8,64}$/)).max(50),
});

function language(): "en" | "de" {
  return getScenarioState()?.language === "de" ? "de" : "en";
}

function refusal(code: string, values: Record<string, string | number> = {}): DecisionConfirmState {
  const pair = REFUSAL_MESSAGES[code] ?? REFUSAL_MESSAGES["invalid"];
  return {
    ok: false,
    recorded: false,
    message: pair ? fill(say(pair, language()), values) : "",
    reasons: [],
    executedCount: 0,
    failedCount: 0,
  };
}

/**
 * Records the decision and executes the changes the person approved.
 *
 * The response is a courtesy for the moment between the click and the
 * re-render. The page re-renders from the database in the same response, and
 * the receipt it shows is the persisted one.
 */
export async function actionConfirmDecision(input: DecisionConfirmInput): Promise<DecisionConfirmState> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return refusal("invalid");

  const data = parsed.data;
  if (!data.rationaleConfirmed) return refusal("approval-not-confirmed");
  if (data.rationale.trim().length < MINIMUM_RATIONALE_LENGTH) {
    return refusal("rationale-short", { minimum: MINIMUM_RATIONALE_LENGTH });
  }

  try {
    const result = await recordDecisionAndExecute({
      decisionId: data.decisionId,
      optionId: data.optionId,
      rationale: data.rationale.trim(),
      rationaleConfirmed: true,
      actingRoleId: data.roleId as RoleId,
      approvedFingerprints: data.approvedChanges,
    });

    if (!result.recorded) {
      const refused = result.consequences.filter((entry) => entry.reason !== null).length;
      const state = refusal(result.refusal ?? "invalid", { count: refused });
      return { ...state, reasons: result.blockedReasons.filter((reason) => reason.includes(":")) };
    }

    revalidateWorkday(data.roleId as RoleId, "decision");
    const lang = language();
    const total = result.executedCount + result.failedCount;
    const message =
      total === 0
        ? say(COPY.outcomeNoChanges, lang)
        : result.failedCount === 0
          ? fill(say(COPY.outcomeComplete, lang), { executed: result.executedCount, total })
          : fill(say(COPY.outcomePartial, lang), {
              executed: result.executedCount,
              total,
              failed: result.failedCount,
            });

    return {
      ok: result.ok,
      recorded: true,
      message,
      reasons: result.blockedReasons,
      executedCount: result.executedCount,
      failedCount: result.failedCount,
    };
  } catch (error) {
    log.error("Recording a decision failed.", { error });
    return refusal("error");
  }
}

"use server";

/**
 * Server actions.
 *
 * These are the only way the browser changes scenario state, and each one is a
 * thin wrapper that validates its input and then calls the governed path. The
 * decision and approval actions deliberately go through `executeTool`, so a
 * click in the interface is subject to exactly the same authority gate as a
 * request from the model. There is no privileged interface route.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AUTONOMY_LEVELS, ROLE_IDS, type AutonomyLevel, type RoleId } from "@/db/schema/core";
import {
  setAutonomyLevel,
  setLanguage,
  setMoment,
  setWorldView,
  switchRole,
  requireScenarioState,
} from "@/scenario/engine/state";
import { recordDecisionAndExecute, grantApproval } from "@/scenario/engine/decide";
import { resetScenarioDay } from "@/scenario/engine/reset";
import { createLogger } from "@/server/logging/redact";

const log = createLogger("actions");

const roleIdSchema = z.enum(ROLE_IDS);
const autonomySchema = z.enum(AUTONOMY_LEVELS);
const momentSchema = z.string().regex(/^\d{2}:\d{2}$/, "A moment must be a 24 hour time label.");

function revalidateWorkday(): void {
  revalidatePath("/workday", "layout");
  revalidatePath("/control-room");
  revalidatePath("/trust");
  revalidatePath("/value");
}

export async function actionSwitchRole(roleId: string): Promise<void> {
  const parsed = roleIdSchema.parse(roleId);
  const state = requireScenarioState();
  const holder = state.activeRoleId;
  switchRole(parsed, { actorUserId: resolveHolderUserId(holder) });
  revalidateWorkday();
}

export async function actionSetAutonomy(level: string): Promise<void> {
  const parsed = autonomySchema.parse(level) as AutonomyLevel;
  const state = requireScenarioState();
  setAutonomyLevel(parsed, { actorUserId: resolveHolderUserId(state.activeRoleId) });
  revalidateWorkday();
}

export async function actionSetMoment(moment: string): Promise<void> {
  const parsed = momentSchema.parse(moment);
  const state = requireScenarioState();
  setMoment(parsed, { roleId: state.activeRoleId });
  revalidateWorkday();
}

export async function actionSetWorldView(view: string): Promise<void> {
  setWorldView(view === "today" ? "today" : "future");
  revalidateWorkday();
}

export async function actionSetLanguage(language: string): Promise<void> {
  setLanguage(language === "de" ? "de" : "en");
  revalidateWorkday();
}

const decisionInputSchema = z.object({
  decisionId: z.string().min(1),
  optionId: z.string().min(1),
  rationale: z.string().min(1, "A rationale is required before a decision is recorded."),
  rationaleConfirmed: z.boolean(),
});

export interface DecisionActionResult {
  ok: boolean;
  message: string;
  receiptStatements: string[];
  blockedReasons: string[];
  approvalId?: string;
}

/**
 * Records a human decision and executes its consequences.
 *
 * The rationale confirmation is not a formality. Without it the authority gate
 * refuses every material change, which is why it is validated here and then
 * validated again independently inside the gate.
 */
export async function actionRecordDecision(input: {
  decisionId: string;
  optionId: string;
  rationale: string;
  rationaleConfirmed: boolean;
}): Promise<DecisionActionResult> {
  const parsed = decisionInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues.map((i) => i.message).join(" "),
      receiptStatements: [],
      blockedReasons: [],
    };
  }

  if (!parsed.data.rationaleConfirmed) {
    return {
      ok: false,
      message:
        "The rationale must be confirmed as your own before a material change can be executed.",
      receiptStatements: [],
      blockedReasons: ["approval-not-confirmed"],
    };
  }

  try {
    const result = await recordDecisionAndExecute(parsed.data);
    revalidateWorkday();
    return result;
  } catch (error) {
    log.error("Recording a decision failed.", { error });
    return {
      ok: false,
      message: error instanceof Error ? error.message : "The decision could not be recorded.",
      receiptStatements: [],
      blockedReasons: [],
    };
  }
}

/** Grants an approval for a specific proposed payload. */
export async function actionGrantApproval(input: {
  decisionId: string;
  toolName: string;
  payloadFingerprint: string;
  rationale: string;
  rationaleConfirmed: boolean;
}): Promise<{ ok: boolean; approvalId?: string; message: string }> {
  const schema = z.object({
    decisionId: z.string().min(1),
    toolName: z.string().min(1),
    payloadFingerprint: z.string().min(8),
    rationale: z.string().min(1),
    rationaleConfirmed: z.literal(true),
  });

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        "An approval requires a decision, a tool, the exact payload it authorises, a rationale and an explicit confirmation.",
    };
  }

  const approvalId = grantApproval(parsed.data);
  revalidateWorkday();
  return { ok: true, approvalId, message: "Approval recorded." };
}

/** Restores the original seeded day. */
export async function actionResetScenario(): Promise<{ ok: boolean; message: string }> {
  try {
    const summary = resetScenarioDay();
    revalidateWorkday();
    revalidatePath("/");
    return {
      ok: true,
      message: `The day was restored. ${summary.rowsWritten} rows rewritten across ${summary.tablesWritten} tables.`,
    };
  } catch (error) {
    log.error("Reset failed.", { error });
    return {
      ok: false,
      message: error instanceof Error ? error.message : "The reset failed.",
    };
  }
}

/** Maps a role to the user who holds it, for audit attribution. */
function resolveHolderUserId(roleId: RoleId): string {
  const holders: Record<RoleId, string> = {
    tprm: "P-002",
    rcsa: "P-003",
    "control-assurance": "P-004",
    "incident-resilience": "P-005",
    "regulatory-change": "P-006",
    "nfr-governance": "P-001",
  };
  return holders[roleId];
}

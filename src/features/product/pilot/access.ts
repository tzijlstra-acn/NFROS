/**
 * Who may open which part of the pilot workspace.
 *
 * Server only. Pilot actions are the Pilot Lead's: the console permission map
 * gives the pilot scopes to that persona alone, and every action checks them
 * again on the server (`governConsoleAction`). Reading follows the same
 * division of responsibility (plan 6.1):
 *
 *   Pilot Lead               every pilot page, with its actions
 *   Platform Product Owner   the overview with readiness, the weekly view,
 *                            the exit decisions and the evidence pack, read
 *                            only: the product release is theirs, the pilot
 *                            is not
 *   anyone else              no pilot page; the reason names who can open it
 *
 * Setup and baseline stay with the Pilot Lead, because they hold the cohort,
 * the support contacts and the design partner's own figures.
 */

import { checkConsolePermission, type ConsoleActionId } from "@/features/product/permissions";
import { readActingConsoleIdentity, type ActingConsoleIdentity } from "@/features/product/persona/acting";

export type PilotPage = "overview" | "setup" | "baseline" | "weekly" | "exit" | "evidence-pack";

const READ_ONLY_PAGES: readonly PilotPage[] = ["overview", "weekly", "exit", "evidence-pack"];

export interface PilotAccess {
  identity: ActingConsoleIdentity;
  canOpen: boolean;
  /** True for the Platform Product Owner: the page renders with every action disabled. */
  readOnly: boolean;
  can: (actionId: ConsoleActionId) => boolean;
  /** Why an action is not available to this persona, in both languages. */
  reasonFor: (actionId: ConsoleActionId) => { en: string; de: string } | null;
}

/** Pure, so the rule can be tested. */
export function pilotPageAllowed(personaId: string | null, page: PilotPage): { canOpen: boolean; readOnly: boolean } {
  if (personaId === "pilot-lead") return { canOpen: true, readOnly: false };
  if (personaId === "platform-product-owner") return { canOpen: READ_ONLY_PAGES.includes(page), readOnly: true };
  return { canOpen: false, readOnly: true };
}

export async function readPilotAccess(page: PilotPage): Promise<PilotAccess> {
  const identity = await readActingConsoleIdentity();
  const allowed = pilotPageAllowed(identity.persona?.id ?? null, page);
  return {
    identity,
    ...allowed,
    can: (actionId) => checkConsolePermission(identity.scopes, actionId).allowed,
    reasonFor: (actionId) => {
      const verdict = checkConsolePermission(identity.scopes, actionId);
      return verdict.allowed ? null : verdict.reason;
    },
  };
}

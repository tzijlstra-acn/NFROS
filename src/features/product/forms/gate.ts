/**
 * The props a console form needs to say in advance whether it can be used.
 *
 * Pure. The server checks again on submission; this is only so a control the
 * persona cannot use is disabled and says why, instead of failing after a
 * round trip. Visible text stays short: with no persona acting, the strip at
 * the top of the console already says the console is read only, so a page of
 * controls does not repeat it under each one; with the wrong persona, the
 * control names who holds the authority.
 */

import {
  checkConsolePermission,
  personasWithScope,
  CONSOLE_ACTIONS,
  type Bilingual,
  type ConsoleActionId,
} from "../permissions";

export interface FormGate {
  permitted: boolean;
  blockedReason: string | null;
  permissionTitle: string | null;
}

export function formGate(
  scopes: readonly string[] | null,
  actionId: ConsoleActionId,
  language: "en" | "de",
  ruleBlock: Bilingual | null = null,
): FormGate {
  const say = (pair: Bilingual) => (language === "de" ? pair.de : pair.en);
  const verdict = checkConsolePermission(scopes, actionId);
  if (!verdict.allowed) {
    if (verdict.code === "no-persona") return { permitted: false, blockedReason: null, permissionTitle: say(verdict.reason) };
    const holders = personasWithScope(CONSOLE_ACTIONS[actionId].scope).map((persona) => say(persona.label));
    return {
      permitted: false,
      blockedReason: language === "de" ? `Befugt: ${holders.join(", ")}` : `Held by: ${holders.join(", ")}`,
      permissionTitle: say(verdict.reason),
    };
  }
  return { permitted: true, blockedReason: ruleBlock ? say(ruleBlock) : null, permissionTitle: null };
}

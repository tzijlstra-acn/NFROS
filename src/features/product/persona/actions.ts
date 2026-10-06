"use server";

/**
 * Choosing the acting product-owner persona.
 *
 * The demonstration persona mechanism, nothing more: the chosen persona is
 * signed into the demonstration session (`localDemoProvider.signIn`), and
 * "No persona" signs it out. Allowed only where role switching is allowed,
 * which is demonstration mode; in design-partner mode the persona is the
 * signed-in account's and cannot be changed from a page.
 *
 * Switching is recorded in the audit trail as a session event, so the trail
 * shows who was acting when a later console action was taken.
 */

import { revalidatePath } from "next/cache";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import { getActiveProvider, getProductMode, isRoleSwitchingAllowed } from "@/identity";
import { getScenarioState } from "@/scenario/engine/state";
import { recordAuditEvent } from "@/server/security/audit";
import { createLogger } from "@/server/logging/redact";
import { PRODUCT_PERSONAS, isProductPersonaId } from "../permissions";

const log = createLogger("product-console-persona");

export async function actionSwitchConsolePersona(data: FormData): Promise<void> {
  const requested = String(data.get("personaId") ?? "");
  if (!isRoleSwitchingAllowed(getProductMode())) return;
  if (requested !== "none" && !isProductPersonaId(requested)) return;

  const provider = getActiveProvider();
  try {
    if (requested === "none") {
      await provider.signOut();
    } else {
      await provider.signIn(requested);
    }
    const state = getScenarioState();
    recordAuditEvent({
      runId: state?.runId ?? DEFAULT_RUN_ID,
      atMoment: state?.currentMoment ?? "00:00",
      category: "system",
      action: "console:switch-persona",
      objectKind: "console-session",
      objectId: requested,
      summary:
        requested === "none"
          ? "Product owner console: the demonstration persona was cleared. The console is read only."
          : `Product owner console: acting as ${PRODUCT_PERSONAS[requested].label.en} (demonstration persona).`,
      actorUserId: requested === "none" ? null : PRODUCT_PERSONAS[requested].demoUserId,
      actorKind: "human",
      reversible: true,
      detail: { console: true, personaId: requested },
    });
  } catch (error) {
    log.error("The console persona could not be switched.", { error });
  }
  revalidatePath("/product", "layout");
}

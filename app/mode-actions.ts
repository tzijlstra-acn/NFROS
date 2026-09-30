"use server";

/**
 * Mode selection action, kept separate from the scenario actions so the entry
 * screen does not pull the decision engine into its module graph.
 */

import { revalidatePath } from "next/cache";
import { isDemoMode } from "@/server/config/demo-mode";
import { setResolvedDemoMode } from "@/server/config/runtime";

export async function actionSetDemoMode(mode: string): Promise<{ mode: string; reason: string | null }> {
  if (!isDemoMode(mode)) {
    return { mode: "safe", reason: "An unknown mode was requested, so presenter safe mode was kept." };
  }
  const resolution = setResolvedDemoMode(mode);
  revalidatePath("/");
  revalidatePath("/control-room");
  revalidatePath("/workday", "layout");
  return { mode: resolution.mode, reason: resolution.reason ?? null };
}

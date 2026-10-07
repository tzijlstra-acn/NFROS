"use server";

/**
 * Server actions for the Releases page. Thin: each calls one function in
 * `release.ts`, which goes through `governConsoleAction`, then refreshes the
 * console and returns the result in the reader's language.
 */

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { readAdminLanguage } from "@/product/status/sources";
import { createLogger } from "@/server/logging/redact";
import { readApprovalFields, toFormState, type ConsoleFormState } from "../governance";
import { approvePilotRelease, completeReleaseGate, deployRelease, generateEvidencePack, rollBackRelease, startReleaseGate } from "./release";

const log = createLogger("product-console-release");

function done(result: Parameters<typeof toFormState>[0]): ConsoleFormState {
  if (result.ok) revalidatePath("/product", "layout");
  return toFormState(result, readAdminLanguage());
}

/**
 * Starts the gate and runs its checks after the response, so the page is not
 * held for the minutes a full secret scan takes. The page follows the stored
 * run (`GateRunFollow`) until it completes.
 */
export async function actionRunReleaseGate(_previous: ConsoleFormState | null, _data: FormData): Promise<ConsoleFormState> {
  const result = await startReleaseGate();
  if (result.ok) {
    const runId = result.value.id;
    after(async () => {
      try {
        await completeReleaseGate(runId);
      } catch (error) {
        log.error("The release gate did not complete.", { error });
      }
    });
  }
  return done(result);
}

export async function actionGenerateEvidencePack(_previous: ConsoleFormState | null, _data: FormData): Promise<ConsoleFormState> {
  return done(await generateEvidencePack());
}

export async function actionApprovePilotRelease(_previous: ConsoleFormState | null, data: FormData): Promise<ConsoleFormState> {
  return done(await approvePilotRelease(readApprovalFields(data)));
}

export async function actionDeployRelease(_previous: ConsoleFormState | null, data: FormData): Promise<ConsoleFormState> {
  return done(await deployRelease(readApprovalFields(data)));
}

export async function actionRollBackRelease(_previous: ConsoleFormState | null, data: FormData): Promise<ConsoleFormState> {
  return done(await rollBackRelease(readApprovalFields(data)));
}

"use server";

/**
 * Server actions for the Releases page. Thin: each calls one function in
 * `release.ts`, which goes through `governConsoleAction`, then refreshes the
 * console and returns the result in the reader's language.
 */

import { revalidatePath } from "next/cache";
import { readAdminLanguage } from "@/product/status/sources";
import { readApprovalFields, toFormState, type ConsoleFormState } from "../governance";
import { approvePilotRelease, deployRelease, generateEvidencePack, rollBackRelease, runReleaseGate } from "./release";

function done(result: Parameters<typeof toFormState>[0]): ConsoleFormState {
  if (result.ok) revalidatePath("/product", "layout");
  return toFormState(result, readAdminLanguage());
}

export async function actionRunReleaseGate(_previous: ConsoleFormState | null, _data: FormData): Promise<ConsoleFormState> {
  return done(await runReleaseGate());
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

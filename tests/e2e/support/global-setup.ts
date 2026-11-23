/**
 * Signs in once before the end-to-end suite, so every spec starts signed in.
 *
 * NFR Workspace v3 guards the workday and the administration surfaces. The
 * specs that test those surfaces are about the surfaces, not the sign-in, so
 * they run with the session this setup stores. The entrance spec opts out
 * with an empty storage state and signs in through the screen itself.
 *
 * The sign-in goes through `/api/session`, the same entrance the screen uses.
 * A server started with NFR_DEMO_AUTH=off answers the pages without a
 * session, and the stored state is then simply unused.
 */

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { request, type FullConfig } from "@playwright/test";

export const STORAGE_STATE = "test-results/.auth/admin.json";

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL ?? process.env.NFR_BASE_URL ?? "http://localhost:3000";
  mkdirSync(dirname(STORAGE_STATE), { recursive: true });
  const context = await request.newContext({ baseURL });
  const response = await context.post("/api/session", {
    data: {
      username: process.env.NFR_DEMO_USERNAME ?? "Admin",
      password: process.env.NFR_DEMO_PASSWORD ?? "Admin",
    },
    timeout: 180_000,
  });
  const body = (await response.json().catch(() => ({}))) as { ok?: boolean };
  if (!body.ok) {
    throw new Error(`The end-to-end sign-in was refused by ${baseURL}/api/session (HTTP ${response.status()}).`);
  }
  await context.storageState({ path: STORAGE_STATE });
  await context.dispose();
}

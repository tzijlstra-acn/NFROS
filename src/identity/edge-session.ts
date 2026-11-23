/**
 * Reads a signed demonstration session in the Edge runtime.
 *
 * The middleware cannot use `next/headers` or the database, so this is the
 * smallest check that is still a real one: the signature verifies, the
 * payload parses, and it has not expired. The role and scope checks that
 * matter stay where they always were, in the authority gate.
 */

import { verifyAndExtract } from "./session";

export interface EdgeSessionFacts {
  userId: string;
  displayName: string;
  isAdministrator: boolean;
  expiresAt: string;
}

export async function readEdgeSession(raw: string | undefined): Promise<EdgeSessionFacts | null> {
  if (!raw) return null;
  const verified = await verifyAndExtract(raw);
  if (!verified) return null;
  try {
    const parsed = JSON.parse(verified) as Partial<EdgeSessionFacts>;
    if (typeof parsed.userId !== "string" || typeof parsed.expiresAt !== "string") return null;
    if (new Date(parsed.expiresAt).getTime() < Date.now()) return null;
    return {
      userId: parsed.userId,
      displayName: typeof parsed.displayName === "string" ? parsed.displayName : parsed.userId,
      isAdministrator: parsed.isAdministrator === true,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

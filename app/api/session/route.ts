/**
 * POST   /api/session  signs in to NFR Workspace with the demonstration account.
 * DELETE /api/session  signs out.
 *
 * A route handler rather than a server action so that the sign-in screen, the
 * Playwright setup and the showcase launcher's warm-up all use one entrance.
 * The body is JSON, `{ username, password, next }`; credentials never travel
 * in a URL. A refusal says only that the details did not match, never which
 * of the two was wrong. Page and API guards for signed-out requests are in
 * middleware.ts and do answer 401.
 */

import { NextResponse } from "next/server";
import { signInToWorkspace, signOutOfWorkspace } from "@/features/entry/session";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = await request.json();
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, reason: "missing" }, { status: 400, headers: NO_STORE });
  }
  const result = await signInToWorkspace({ username: body["username"], password: body["password"], next: body["next"] });
  /*
   * A refused sign-in is an answer, not a failure of the request, so it is a
   * 200 with ok: false. A 401 here put a red resource error in the browser
   * console every time a presenter showed the invalid-credential state.
   */
  return NextResponse.json(result, { headers: NO_STORE });
}

export async function DELETE() {
  await signOutOfWorkspace();
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}

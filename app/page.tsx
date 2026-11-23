/**
 * The entrance to NFR Workspace.
 *
 * Opening the product plays the startup sequence and then asks for the
 * demonstration sign-in, the way an enterprise workspace is entered. A reader
 * who is already signed in goes straight to their workspace: replaying the
 * startup on every visit would be theatre, not information.
 *
 * The earlier marketing-style entrance (`src/components/landing`) is retired
 * from this route. The runtime state and the reset control it pointed
 * presenters to are in the account menu and the control room.
 */

import { redirect } from "next/navigation";
import { getSession } from "@/identity";
import { demoAuthEnabled } from "@/identity/demo-credentials";
import { DEFAULT_WORKSPACE_HREF } from "@/features/entry/routes";
import { EntryPage } from "@/components/entry/EntryPage";

export const dynamic = "force-dynamic";

export default async function Entrance() {
  const session = await getSession().catch(() => null);
  if (session || !demoAuthEnabled()) redirect(DEFAULT_WORKSPACE_HREF);
  return <EntryPage initialPhase="startup" next={null} />;
}

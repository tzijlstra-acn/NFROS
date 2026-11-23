/**
 * The sign-in screen without the startup sequence.
 *
 * Where the session guard sends a request for a workspace page, with the page
 * as `next`. `safeNextPath` accepts only a same-origin protected path, so the
 * parameter cannot send anyone elsewhere.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/identity";
import { safeNextPath } from "@/features/entry/routes";
import { EntryPage } from "@/components/entry/EntryPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sign in to NFR Workspace" };

export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  const requested = Array.isArray(next) ? next[0] : next;
  const session = await getSession().catch(() => null);
  if (session) redirect(safeNextPath(requested));
  return <EntryPage initialPhase="signin" next={requested ?? null} />;
}

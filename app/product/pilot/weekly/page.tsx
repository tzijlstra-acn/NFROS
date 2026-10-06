/**
 * Product Owner Console: the pilot's weekly view (plan 7.7). Thin; see
 * `src/features/product/pilot/views/WeeklyView.tsx`. `?week=` names the
 * Monday of the week to open.
 */

import { PilotWeeklyPage } from "@/features/product/pilot/views/PilotPages";

export const dynamic = "force-dynamic";

export default async function PilotWeeklyRoute({ searchParams }: { searchParams: Promise<{ week?: string | string[] }> }) {
  const { week } = await searchParams;
  return <PilotWeeklyPage week={typeof week === "string" ? week : null} />;
}

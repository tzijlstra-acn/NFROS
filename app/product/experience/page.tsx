/**
 * Product Owner Console: Experience (plan 7.4).
 *
 * Thin: the filters are parsed and the aggregates read in
 * `src/features/product/experience/analytics.ts`.
 */

import { readAdminLanguage } from "@/product/status/sources";
import { ExperienceConsole } from "@/features/product/experience/ExperienceConsole";
import { parseExperienceFilters } from "@/features/product/experience/analytics";

export const dynamic = "force-dynamic";

export default async function ProductExperiencePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ExperienceConsole language={readAdminLanguage()} filters={parseExperienceFilters(await searchParams)} />;
}

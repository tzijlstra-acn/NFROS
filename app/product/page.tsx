/**
 * Product Owner Console: Overview (plan 7.1).
 *
 * Thin: the figures and the four questions are read by
 * `src/features/product/overview/model.ts`.
 */

import { readAdminLanguage } from "@/product/status/sources";
import { OverviewConsole } from "@/features/product/overview/OverviewConsole";

export const dynamic = "force-dynamic";

export default function ProductOverviewPage() {
  return <OverviewConsole language={readAdminLanguage()} />;
}

/**
 * Product Owner Console: pilot overview and readiness (plan 7.7, Wave 5).
 *
 * Thin. The page is `PilotOverviewPage` in `src/features/product/pilot/`.
 */

import { PilotOverviewPage } from "@/features/product/pilot/views/PilotPages";

export const dynamic = "force-dynamic";

export default function PilotOverviewRoute() {
  return <PilotOverviewPage />;
}

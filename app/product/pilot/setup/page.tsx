/**
 * Product Owner Console: pilot setup (plan 7.7). Thin; see
 * `src/features/product/pilot/views/SetupView.tsx`.
 */

import { PilotSetupPage } from "@/features/product/pilot/views/PilotPages";

export const dynamic = "force-dynamic";

export default function PilotSetupRoute() {
  return <PilotSetupPage />;
}

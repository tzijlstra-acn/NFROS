/**
 * Product Owner Console: pilot baseline (plan 7.7). Thin; see
 * `src/features/product/pilot/views/BaselineView.tsx`.
 */

import { PilotBaselinePage } from "@/features/product/pilot/views/PilotPages";

export const dynamic = "force-dynamic";

export default function PilotBaselineRoute() {
  return <PilotBaselinePage />;
}

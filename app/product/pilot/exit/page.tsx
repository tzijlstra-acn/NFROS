/**
 * Product Owner Console: the pilot exit decision (plan 7.7, Wave 5). Thin;
 * see `src/features/product/pilot/views/ExitView.tsx`.
 */

import { PilotExitPage } from "@/features/product/pilot/views/PilotPages";

export const dynamic = "force-dynamic";

export default function PilotExitRoute() {
  return <PilotExitPage />;
}

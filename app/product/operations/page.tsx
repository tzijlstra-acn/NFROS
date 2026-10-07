/**
 * Product Owner Console: Operations, a summary of `/ops`.
 *
 * Thin: the readings come from `src/product/status/sources.ts`, the same
 * functions the operations console uses.
 */

import { readAdminLanguage } from "@/product/status/sources";
import { OperationsSummary } from "@/features/product/operations/OperationsSummary";

export const dynamic = "force-dynamic";

export default function ProductOperationsPage() {
  return <OperationsSummary language={readAdminLanguage()} />;
}

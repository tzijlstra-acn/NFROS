/**
 * Product Owner Console: one evaluation run, with Inspect failed case and
 * Compare output (plan 7.5).
 *
 * Thin: the view is `src/features/product/quality/RunDetail.tsx`.
 */

import { readAdminLanguage } from "@/product/status/sources";
import { RunDetail } from "@/features/product/quality/RunDetail";

export const dynamic = "force-dynamic";

export default async function ProductQualityRunPage({
  params,
  searchParams,
}: {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{ case?: string }>;
}) {
  const { runId } = await params;
  const { case: caseId } = await searchParams;
  return <RunDetail runId={decodeURIComponent(runId)} caseId={caseId ?? null} language={readAdminLanguage()} />;
}

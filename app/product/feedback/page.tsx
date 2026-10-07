/**
 * Product Owner Console: the feedback inbox (plan 7.8).
 *
 * Thin: the inbox is `src/features/product/feedback/FeedbackInbox.tsx`.
 */

import { readAdminLanguage } from "@/product/status/sources";
import { FeedbackInbox } from "@/features/product/feedback/FeedbackInbox";

export const dynamic = "force-dynamic";

export default async function ProductFeedbackPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  return <FeedbackInbox language={readAdminLanguage()} showAll={status === "all"} />;
}

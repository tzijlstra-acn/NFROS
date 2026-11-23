/**
 * One analysis on the insight canvas.
 *
 * Reads the stored run for this role; a run of another role, or one that no
 * longer passes the schema, is not shown as if it were sound. The permission
 * view of each proposed action is computed here so the canvas can show a
 * locked action as locked; the gate checks again at commit.
 */

import { notFound } from "next/navigation";
import { InsightCanvas } from "@/components/insights/InsightCanvas";
import { getInsight } from "@/features/insights/service";
import { insightsPageContext, permissionViews } from "@/features/insights/page-context";
import { committedRecommendations } from "@/features/insights/writeback";

export const dynamic = "force-dynamic";

export default async function InsightPage({ params }: { params: Promise<{ role: string; insightId: string }> }) {
  const { role, insightId } = await params;
  const page = await insightsPageContext(role);
  const stored = getInsight(page.roleId, insightId);
  if (!stored) notFound();
  if (!stored.response) {
    return (
      <div className="ins-page">
        <h1 className="ins-conclusion">{page.language === "de" ? "Diese Analyse kann nicht angezeigt werden." : "This analysis cannot be shown."}</h1>
        <p className="ins-question">{stored.question}</p>
      </div>
    );
  }
  const actorLabel = `${page.holderName}, ${page.roleLabel}${page.signedInAs ? `; signed in as ${page.signedInAs}` : ""}`;
  return (
    <InsightCanvas
      roleId={page.roleId}
      insightId={stored.id}
      response={stored.response}
      permissions={permissionViews(page.roleId, stored.response)}
      savedTitle={stored.savedTitle}
      committed={committedRecommendations(page.roleId, stored.id)}
      auditEventId={stored.auditEventId}
      actorLabel={actorLabel}
      agentHref={`/workday/${page.roleId}/agents?from=${encodeURIComponent(stored.id)}`}
    />
  );
}

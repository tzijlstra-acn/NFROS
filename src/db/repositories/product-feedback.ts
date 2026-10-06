/**
 * Data access for the product feedback inbox.
 *
 * A person submits; the product owner triages, assigns, sets severity and
 * links the item to a feature, a Role App, a stage and a release. The triage
 * vocabulary is the schema's; which transitions a triage may make is the
 * console's rule.
 */

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  PRODUCT_FEEDBACK_STATUSES,
  productFeedback,
  type ProductFeedbackKind,
  type ProductFeedbackStatus,
  type Severity,
} from "@/db/schema/product-console";

const db = () => getDb();

export type ProductFeedbackItem = typeof productFeedback.$inferSelect;
export type NewProductFeedbackItem = typeof productFeedback.$inferInsert;

/** What triage may change. Identity, the submitter and the context are kept as submitted. */
export type ProductFeedbackTriage = Partial<
  Pick<
    NewProductFeedbackItem,
    | "status"
    | "severity"
    | "ownerLabel"
    | "ownerUserId"
    | "triagedAt"
    | "triagedByLabel"
    | "resolution"
    | "closedAt"
    | "featureKey"
    | "roleAppId"
    | "stageId"
    | "releaseVersion"
  >
>;

export function submitProductFeedback(item: NewProductFeedbackItem): ProductFeedbackItem {
  db().insert(productFeedback).values(item).run();
  const written = getProductFeedback(item.id);
  if (!written) throw new Error(`Product feedback ${item.id} was not written.`);
  return written;
}

export function getProductFeedback(id: string): ProductFeedbackItem | undefined {
  return db().select().from(productFeedback).where(eq(productFeedback.id, id)).get();
}

/** Records a triage step. Returns the item as it now stands, or undefined for an unknown id. */
export function triageProductFeedback(id: string, triage: ProductFeedbackTriage): ProductFeedbackItem | undefined {
  const set = Object.fromEntries(Object.entries(triage).filter(([, value]) => value !== undefined)) as ProductFeedbackTriage;
  if (Object.keys(set).length > 0) db().update(productFeedback).set(set).where(eq(productFeedback.id, id)).run();
  return getProductFeedback(id);
}

export interface ProductFeedbackFilter {
  statuses?: readonly ProductFeedbackStatus[];
  kinds?: readonly ProductFeedbackKind[];
  severities?: readonly Severity[];
  roleAppId?: string;
  stageId?: string;
  releaseVersion?: string;
  limit?: number;
}

/** The inbox, newest first. */
export function listProductFeedback(filter: ProductFeedbackFilter = {}): ProductFeedbackItem[] {
  const query = db()
    .select()
    .from(productFeedback)
    .where(
      and(
        filter.statuses && filter.statuses.length > 0 ? inArray(productFeedback.status, [...filter.statuses]) : undefined,
        filter.kinds && filter.kinds.length > 0 ? inArray(productFeedback.kind, [...filter.kinds]) : undefined,
        filter.severities && filter.severities.length > 0 ? inArray(productFeedback.severity, [...filter.severities]) : undefined,
        filter.roleAppId ? eq(productFeedback.roleAppId, filter.roleAppId) : undefined,
        filter.stageId ? eq(productFeedback.stageId, filter.stageId) : undefined,
        filter.releaseVersion ? eq(productFeedback.releaseVersion, filter.releaseVersion) : undefined,
      ),
    )
    .orderBy(desc(productFeedback.submittedAt), asc(productFeedback.id));
  return filter.limit !== undefined ? query.limit(filter.limit).all() : query.all();
}

/** Items per status, every status present: the inbox's counts and feedback closure (plan 12). */
export function countProductFeedbackByStatus(): Record<ProductFeedbackStatus, number> {
  const rows = db()
    .select({ status: productFeedback.status, n: sql<number>`count(*)` })
    .from(productFeedback)
    .groupBy(productFeedback.status)
    .all();
  const counts = Object.fromEntries(PRODUCT_FEEDBACK_STATUSES.map((status) => [status, 0])) as Record<ProductFeedbackStatus, number>;
  for (const row of rows) counts[row.status] = Number(row.n);
  return counts;
}

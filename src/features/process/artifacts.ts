/**
 * ArtifactService: lifecycle step 11, store what the stage produced.
 *
 * Artifacts are versioned per key and carry a content digest. Writing the
 * same content again is a no-op that returns the existing version, which is
 * how a repeated preparation or a retried completion avoids a pile of
 * identical rows. Writing different content creates the next version; nothing
 * is overwritten.
 *
 * Only persisted artifacts are ever shown. There is no static fallback: a
 * stage with nothing stored says so.
 */

import { createHash } from "node:crypto";
import {
  createArtifact,
  getLatestArtifact,
  type RoleAppArtifact,
} from "@/db/repositories/role-app-runtime";
import type { Bilingual } from "@/role-apps/contracts";

/** Stable digest over JSON content, independent of key order. */
export function digestContent(content: unknown): string {
  return createHash("sha256").update(canonical(content)).digest("hex").slice(0, 32);
}

function canonical(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
}

export interface StoreArtifactInput {
  runId: string;
  roleAppRunId: string;
  stageId: string;
  stageRunId: string;
  artifactKey: string;
  artifactKind: string;
  label: Bilingual;
  content: Record<string, unknown>;
  producedBy: "ai-preparation" | "stage-completion" | "human";
  mode: string | null;
  createdByUserId: string | null;
  createdAt?: string;
}

/**
 * Stores an artifact, returning the existing row when the content is unchanged.
 *
 * The label is stored in English; the bilingual label travels inside the
 * content so a reader can render either language.
 */
export function storeArtifact(input: StoreArtifactInput): { artifact: RoleAppArtifact; created: boolean } {
  const body = { label: input.label, ...input.content };
  const digest = digestContent(body);
  const latest = getLatestArtifact(input.roleAppRunId, input.stageId, input.artifactKey, input.runId);
  if (latest && latest.contentDigest === digest) return { artifact: latest, created: false };

  const version = (latest?.version ?? 0) + 1;
  const artifact = createArtifact({
    id: `ART-${input.stageRunId}-${input.artifactKey}-V${version}`,
    runId: input.runId,
    roleAppRunId: input.roleAppRunId,
    stageId: input.stageId,
    stageRunId: input.stageRunId,
    artifactKey: input.artifactKey,
    artifactKind: input.artifactKind,
    label: input.label.en,
    content: JSON.stringify(body),
    version,
    contentDigest: digest,
    producedBy: input.producedBy,
    mode: input.mode,
    createdByUserId: input.createdByUserId,
    createdAt: input.createdAt ?? new Date().toISOString(),
  });
  return { artifact, created: true };
}

/** Reads an artifact's bilingual label and content. Null when the content is not JSON. */
export function readArtifact(
  artifact: RoleAppArtifact,
): { label: Bilingual; content: Record<string, unknown> } | null {
  if (!artifact.content) return null;
  try {
    const parsed = JSON.parse(artifact.content) as Record<string, unknown> & { label?: Bilingual };
    const label = parsed.label ?? { en: artifact.label, de: artifact.label };
    return { label, content: parsed };
  } catch {
    return null;
  }
}

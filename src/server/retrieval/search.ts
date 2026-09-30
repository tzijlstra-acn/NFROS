/**
 * Hybrid evidence retrieval.
 *
 * Lexical retrieval uses the SQLite full text index, which is available in
 * every mode including offline. Semantic retrieval uses OpenAI embeddings and
 * is additive: when it is unavailable, search degrades to lexical rather than
 * failing.
 *
 * That ordering is the important design decision. A demonstration that cannot
 * search its own evidence corpus without a network call would be fragile in
 * exactly the situation where it matters most.
 *
 * Embeddings are cached in the database, so a corpus is embedded once rather
 * than on every run.
 */

import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb, getSqlite } from "@/db/client";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import { evidenceChunks, evidenceDocuments } from "@/db/schema/work";
import { getOpenAIClient } from "@/server/openai/client";
import { getResolvedModels } from "@/server/config/models";
import { getResolvedDemoMode } from "@/server/config/runtime";
import { createLogger } from "@/server/logging/redact";
import { momentToMinutes } from "@/domain/nfr/calculators";

const log = createLogger("retrieval");
const db = () => getDb();

export interface SearchHit {
  chunkId: string;
  documentId: string;
  locator: string;
  content: string;
  /** Combined score, higher is better. */
  score: number;
  lexicalScore: number;
  semanticScore: number | null;
  /** Document metadata, so a caller can cite without a second query. */
  documentReference: string;
  documentTitle: string;
  sourceType: string;
  sourceSystem: string;
  documentDate: string;
  status: string;
  provenance: string;
  isStale: boolean;
  entityIds: string[];
}

export interface SearchOptions {
  /** Limit results to documents visible at this scenario moment. */
  atMoment?: string;
  /** Restrict to these source types. */
  sourceTypes?: string[];
  /** Restrict to documents touching these entities. */
  entityIds?: string[];
  limit?: number;
  runId?: string;
  /** Set false to skip the embedding call even in live mode. */
  allowSemantic?: boolean;
}

/**
 * Escapes a user query for FTS5.
 *
 * FTS5 treats a number of characters as operators, and an unescaped quote in a
 * question turns a search into a syntax error. Each term is quoted and the
 * terms are combined with OR so a partial match still returns something.
 */
function toFtsQuery(query: string): string {
  const terms = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 2 && !STOP_WORDS.has(term));

  if (terms.length === 0) return "";
  return terms.map((term) => `"${term}"`).join(" OR ");
}

const STOP_WORDS = new Set([
  "the", "and", "for", "are", "was", "were", "has", "have", "had", "that", "this", "with",
  "which", "what", "who", "whom", "how", "why", "when", "does", "did", "our", "their", "its",
  "from", "into", "onto", "about", "would", "should", "could", "there", "here", "been", "being",
]);

/** Lexical retrieval over the full text index. */
export function lexicalSearch(
  query: string,
  options: SearchOptions = {},
): Array<{ chunkId: string; documentId: string; score: number }> {
  const runId = options.runId ?? DEFAULT_RUN_ID;
  const ftsQuery = toFtsQuery(query);
  if (ftsQuery.length === 0) return [];

  try {
    const rows = getSqlite()
      .prepare(
        `SELECT chunk_id AS chunkId, document_id AS documentId, bm25(evidence_chunks_fts) AS rank
         FROM evidence_chunks_fts
         WHERE evidence_chunks_fts MATCH ? AND run_id = ?
         ORDER BY rank
         LIMIT ?`,
      )
      .all(ftsQuery, runId, (options.limit ?? 12) * 4) as Array<{
      chunkId: string;
      documentId: string;
      rank: number;
    }>;

    // bm25 returns a negative number where more negative is better. Normalise
    // to a zero to one scale so it can be blended with cosine similarity.
    if (rows.length === 0) return [];
    const ranks = rows.map((row) => row.rank);
    const best = Math.min(...ranks);
    const worst = Math.max(...ranks);
    const span = worst - best || 1;

    return rows.map((row) => ({
      chunkId: row.chunkId,
      documentId: row.documentId,
      score: 1 - (row.rank - best) / span,
    }));
  } catch (error) {
    log.warn("Lexical search failed.", { error });
    return [];
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Embeds any chunks that do not yet have an embedding, and caches them.
 *
 * Returns the number embedded. In safe or offline mode this is a no-op, which
 * is why semantic search silently degrades rather than blocking.
 */
export async function ensureEmbeddings(runId = DEFAULT_RUN_ID): Promise<number> {
  const mode = getResolvedDemoMode();
  if (mode.mode === "offline") return 0;

  const openai = getOpenAIClient();
  if (!openai) return 0;

  const model = getResolvedModels().embedding;
  if (model === null) return 0;

  const pending = db()
    .select()
    .from(evidenceChunks)
    .where(eq(evidenceChunks.runId, runId))
    .all()
    .filter((chunk) => chunk.embedding === null);

  if (pending.length === 0) return 0;

  let embedded = 0;
  const batchSize = 64;

  for (let i = 0; i < pending.length; i += batchSize) {
    const batch = pending.slice(i, i + batchSize);
    try {
      const response = await openai.embeddings.create({
        model,
        input: batch.map((chunk) => chunk.content),
      });

      const now = new Date().toISOString();
      for (let j = 0; j < batch.length; j += 1) {
        const chunk = batch[j];
        const vector = response.data[j]?.embedding;
        if (!chunk || !vector) continue;
        db()
          .update(evidenceChunks)
          .set({ embedding: vector, embeddingModel: model, embeddedAt: now })
          .where(eq(evidenceChunks.id, chunk.id))
          .run();
        embedded += 1;
      }
    } catch (error) {
      log.warn("Embedding a batch failed. Semantic search will be partial.", { error });
      break;
    }
  }

  log.info("Embeddings cached.", { embedded, model });
  return embedded;
}

/** Embeds a single query string. */
async function embedQuery(query: string): Promise<number[] | null> {
  const openai = getOpenAIClient();
  if (!openai) return null;
  const model = getResolvedModels().embedding;
  if (model === null) return null;

  try {
    const response = await openai.embeddings.create({ model, input: query });
    return response.data[0]?.embedding ?? null;
  } catch (error) {
    log.warn("Embedding the query failed. Falling back to lexical retrieval only.", { error });
    return null;
  }
}

/**
 * Hybrid search.
 *
 * Lexical and semantic scores are blended with a fixed weighting rather than a
 * learned one, because there is no training signal here and a stated constant
 * is more honest than a tuned-looking number.
 */
export async function searchEvidence(
  query: string,
  options: SearchOptions = {},
): Promise<SearchHit[]> {
  const runId = options.runId ?? DEFAULT_RUN_ID;
  const limit = options.limit ?? 8;

  const lexical = lexicalSearch(query, options);
  const lexicalByChunk = new Map(lexical.map((hit) => [hit.chunkId, hit.score]));

  let semanticByChunk = new Map<string, number>();

  if (options.allowSemantic !== false) {
    const queryVector = await embedQuery(query);
    if (queryVector) {
      const embeddedChunks = db()
        .select()
        .from(evidenceChunks)
        .where(and(eq(evidenceChunks.runId, runId), isNotNull(evidenceChunks.embedding)))
        .all();

      for (const chunk of embeddedChunks) {
        if (!chunk.embedding) continue;
        semanticByChunk.set(chunk.id, cosineSimilarity(queryVector, chunk.embedding));
      }
    }
  }

  // Candidate set: anything either method found.
  const candidateIds = new Set<string>([...lexicalByChunk.keys(), ...semanticByChunk.keys()]);
  if (candidateIds.size === 0) return [];

  const chunks = db()
    .select()
    .from(evidenceChunks)
    .where(and(eq(evidenceChunks.runId, runId), inArray(evidenceChunks.id, Array.from(candidateIds))))
    .all();

  const documentIds = Array.from(new Set(chunks.map((chunk) => chunk.documentId)));
  const documents = db()
    .select()
    .from(evidenceDocuments)
    .where(and(eq(evidenceDocuments.runId, runId), inArray(evidenceDocuments.id, documentIds)))
    .all();
  const documentById = new Map(documents.map((doc) => [doc.id, doc]));

  const LEXICAL_WEIGHT = 0.55;
  const SEMANTIC_WEIGHT = 0.45;
  const now = options.atMoment ? momentToMinutes(options.atMoment) : null;

  const hits: SearchHit[] = [];

  for (const chunk of chunks) {
    const document = documentById.get(chunk.documentId);
    if (!document) continue;

    // Reveal filtering: a professional cannot search evidence that has not
    // arrived yet, which keeps the timeline honest.
    if (now !== null && momentToMinutes(document.revealedAtMoment) > now) continue;
    if (options.sourceTypes && !options.sourceTypes.includes(document.sourceType)) continue;
    if (
      options.entityIds &&
      !document.entityIds.some((entityId) => options.entityIds?.includes(entityId))
    ) {
      continue;
    }

    const lexicalScore = lexicalByChunk.get(chunk.id) ?? 0;
    const semanticRaw = semanticByChunk.get(chunk.id);
    const semanticScore = semanticRaw === undefined ? null : semanticRaw;

    const score =
      semanticScore === null
        ? lexicalScore
        : LEXICAL_WEIGHT * lexicalScore + SEMANTIC_WEIGHT * Math.max(0, semanticScore);

    hits.push({
      chunkId: chunk.id,
      documentId: chunk.documentId,
      locator: chunk.locator,
      content: chunk.content,
      score,
      lexicalScore,
      semanticScore,
      documentReference: document.reference,
      documentTitle: document.title,
      sourceType: document.sourceType,
      sourceSystem: document.sourceSystem,
      documentDate: document.documentDate,
      status: document.status,
      provenance: document.provenance,
      isStale: document.isStale,
      entityIds: document.entityIds,
    });
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

/**
 * Source coverage: the proportion of a set of claims that cite retrievable
 * evidence. Used by the value page and the evaluation suite.
 */
export function sourceCoverage(claimSourceIds: string[][], runId = DEFAULT_RUN_ID): number {
  if (claimSourceIds.length === 0) return 0;
  const known = new Set(
    db()
      .select({ id: evidenceDocuments.id })
      .from(evidenceDocuments)
      .where(eq(evidenceDocuments.runId, runId))
      .all()
      .map((row) => row.id),
  );

  const covered = claimSourceIds.filter(
    (ids) => ids.length > 0 && ids.some((id) => known.has(id)),
  ).length;
  return covered / claimSourceIds.length;
}

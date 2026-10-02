/**
 * Audit hash chain tests.
 *
 * Pure function tests (computeHash, canonicalize, GENESIS_HASH) need no
 * database. The database-dependent tests (verifyChain) use a minimal temporary
 * SQLite that has only the audit_chain_records table, created via raw SQL.
 * This avoids a dependency on the full migration set while still exercising
 * the real code paths.
 *
 * Note: appendChainRecord reads CHAIN_SCOPE from a module-level constant
 * evaluated at import time, so it is tested via its observable effects
 * (verifyChain on the inserted records) rather than by overriding the env var.
 *
 * The framing is adversarial: we are testing that the chain correctly
 * identifies tampering, not just that the happy path works.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { closeDb, getDb } from "@/db/client";
import {
  canonicalize,
  computeHash,
  GENESIS_HASH,
  HASH_ALGORITHM,
  type CanonicalEventInput,
} from "@/audit/chain";
import { verifyChain } from "@/audit/verify-chain";
import { auditChainRecords } from "@/db/schema/audit-chain";

/* --------------------------------------------------------------------------
   Temp database for DB-dependent tests
   -------------------------------------------------------------------------- */

let tempDir: string | null = null;
let tempDbPath: string;
let originalDbPath: string | undefined;

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS audit_chain_records (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    chain_scope TEXT NOT NULL,
    audit_event_id TEXT NOT NULL,
    event_kind TEXT NOT NULL,
    canonical_payload TEXT NOT NULL,
    previous_hash TEXT NOT NULL,
    event_hash TEXT NOT NULL,
    hash_algorithm TEXT NOT NULL DEFAULT 'sha256',
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS acr_scope_seq_idx ON audit_chain_records (chain_scope, sequence);
  CREATE INDEX IF NOT EXISTS acr_audit_event_idx ON audit_chain_records (audit_event_id);
  CREATE INDEX IF NOT EXISTS acr_run_idx ON audit_chain_records (run_id);
`;

beforeAll(() => {
  originalDbPath = process.env.NFR_DB_PATH;
  closeDb();

  tempDir = mkdtempSync(join(tmpdir(), "nfr-workos-audit-chain-test-"));
  tempDbPath = join(tempDir, "test.db");
  process.env.NFR_DB_PATH = tempDbPath;

  // Bootstrap the table directly so we do not need the full migration set.
  const sqlite = new Database(tempDbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(CREATE_TABLE_SQL);
  sqlite.close();
});

afterAll(() => {
  closeDb();
  if (originalDbPath !== undefined) {
    process.env.NFR_DB_PATH = originalDbPath;
  } else {
    delete process.env.NFR_DB_PATH;
  }
  if (tempDir !== null) {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Windows WAL sidecar files may be locked; the OS will reclaim them.
    }
    tempDir = null;
  }
});

/* --------------------------------------------------------------------------
   Helper: build a chain record deterministically from pure functions
   -------------------------------------------------------------------------- */

function buildChainRecord(params: {
  scope: string;
  sequence: number;
  previousHash: string;
  auditEventId: string;
  eventKind: string;
  actorKind: string;
  actorId: string | null;
  at: string;
  runId: string;
}) {
  const input: CanonicalEventInput = {
    sequence: params.sequence,
    chainScope: params.scope,
    eventKind: params.eventKind,
    auditEventId: params.auditEventId,
    actorKind: params.actorKind,
    actorId: params.actorId,
    at: params.at,
  };
  const canonical = canonicalize(input);
  const eventHash = computeHash(params.previousHash, canonical);
  return {
    id: `ACR-${params.scope}-${params.sequence}`,
    runId: params.runId,
    sequence: params.sequence,
    chainScope: params.scope,
    auditEventId: params.auditEventId,
    eventKind: params.eventKind,
    canonicalPayload: canonical,
    previousHash: params.previousHash,
    eventHash,
    hashAlgorithm: HASH_ALGORITHM,
    createdAt: params.at,
  };
}

/* --------------------------------------------------------------------------
   Pure function tests: no database required
   -------------------------------------------------------------------------- */

describe("GENESIS_HASH", () => {
  it("starts with the GENESIS prefix so it is identifiable in logs", () => {
    expect(GENESIS_HASH.startsWith("GENESIS-")).toBe(true);
  });

  it("is long enough to be unguessable (at least 64 hex characters after the prefix)", () => {
    const afterPrefix = GENESIS_HASH.slice("GENESIS-".length);
    expect(afterPrefix.length).toBeGreaterThanOrEqual(64);
  });

  it("contains only valid hex characters after the prefix", () => {
    const afterPrefix = GENESIS_HASH.slice("GENESIS-".length);
    expect(/^[0-9a-f]+$/.test(afterPrefix)).toBe(true);
  });
});

describe("canonicalize", () => {
  const sampleInput: CanonicalEventInput = {
    sequence: 1,
    chainScope: "org-arcadia-demo",
    eventKind: "approveSupplierRelease",
    auditEventId: "AUE-2024-0001",
    actorKind: "system",
    actorId: null,
    at: "2024-11-11T18:40:00.000Z",
  };

  it("returns the same string for the same input (determinism)", () => {
    expect(canonicalize(sampleInput)).toBe(canonicalize(sampleInput));
  });

  it("returns the same string when called twice with structurally identical input", () => {
    const a = canonicalize({ ...sampleInput });
    const b = canonicalize({ ...sampleInput });
    expect(a).toBe(b);
  });

  it("returns a valid JSON string", () => {
    const result = canonicalize(sampleInput);
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it("includes the algorithm field in the output", () => {
    const parsed = JSON.parse(canonicalize(sampleInput)) as Record<string, unknown>;
    expect(parsed.algorithm).toBe(HASH_ALGORITHM);
  });

  it("serialises actorId as null when not provided", () => {
    const parsed = JSON.parse(canonicalize(sampleInput)) as Record<string, unknown>;
    expect(parsed.actorId).toBeNull();
  });

  it("includes all required fields in the canonical payload", () => {
    const parsed = JSON.parse(canonicalize(sampleInput)) as Record<string, unknown>;
    expect(parsed).toHaveProperty("sequence");
    expect(parsed).toHaveProperty("chainScope");
    expect(parsed).toHaveProperty("eventKind");
    expect(parsed).toHaveProperty("auditEventId");
    expect(parsed).toHaveProperty("actorKind");
    expect(parsed).toHaveProperty("at");
  });

  it("produces different output for different sequence numbers", () => {
    const a = canonicalize({ ...sampleInput, sequence: 1 });
    const b = canonicalize({ ...sampleInput, sequence: 2 });
    expect(a).not.toBe(b);
  });
});

describe("computeHash", () => {
  it("returns a 64-character lowercase hex string", () => {
    const hash = computeHash(GENESIS_HASH, "payload");
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  it("is deterministic: same inputs produce the same hash", () => {
    const h1 = computeHash("prev", "payload");
    const h2 = computeHash("prev", "payload");
    expect(h1).toBe(h2);
  });

  it("changes when the previousHash changes", () => {
    const h1 = computeHash("hash-a", "payload");
    const h2 = computeHash("hash-b", "payload");
    expect(h1).not.toBe(h2);
  });

  it("changes when the canonicalPayload changes", () => {
    const h1 = computeHash("prev", "payload-a");
    const h2 = computeHash("prev", "payload-b");
    expect(h1).not.toBe(h2);
  });

  it("uses GENESIS_HASH as previousHash for the first record without error", () => {
    const payload = canonicalize({
      sequence: 1,
      chainScope: "org-arcadia-demo",
      eventKind: "approveSupplierRelease",
      auditEventId: "AUE-2024-0001",
      actorKind: "system",
      actorId: null,
      at: "2024-11-11T18:40:00.000Z",
    });
    // The hash should be reproducible.
    const h1 = computeHash(GENESIS_HASH, payload);
    const h2 = computeHash(GENESIS_HASH, payload);
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
  });
});

/* --------------------------------------------------------------------------
   Database-dependent tests
   -------------------------------------------------------------------------- */

describe("verifyChain (empty database)", () => {
  it("returns status 'empty' when no records exist for the scope", () => {
    const result = verifyChain("org-scope-never-written");
    expect(result.status).toBe("empty");
    expect(result.totalRecords).toBe(0);
    expect(result.verifiedThrough).toBe(0);
    expect(result.firstFailureSequence).toBeNull();
  });
});

describe("verifyChain (valid chain inserted directly)", () => {
  const SCOPE = "org-direct-valid";
  const RUN_ID = "run-test-valid";

  it("accepts a chain of three records built with the pure functions", () => {
    const db = getDb();

    const r1 = buildChainRecord({
      scope: SCOPE, sequence: 1, previousHash: GENESIS_HASH,
      auditEventId: "AUE-DV-001", eventKind: "createAction",
      actorKind: "human", actorId: "P-001",
      at: "2025-01-01T10:00:00.000Z", runId: RUN_ID,
    });
    const r2 = buildChainRecord({
      scope: SCOPE, sequence: 2, previousHash: r1.eventHash,
      auditEventId: "AUE-DV-002", eventKind: "updateControlRating",
      actorKind: "human", actorId: "P-002",
      at: "2025-01-01T11:00:00.000Z", runId: RUN_ID,
    });
    const r3 = buildChainRecord({
      scope: SCOPE, sequence: 3, previousHash: r2.eventHash,
      auditEventId: "AUE-DV-003", eventKind: "approveDecision",
      actorKind: "human", actorId: "P-003",
      at: "2025-01-01T12:00:00.000Z", runId: RUN_ID,
    });

    db.insert(auditChainRecords).values([r1, r2, r3]).run();

    const result = verifyChain(SCOPE);
    expect(result.status).toBe("valid");
    expect(result.totalRecords).toBe(3);
    expect(result.verifiedThrough).toBe(3);
    expect(result.firstFailureSequence).toBeNull();
  });
});

describe("verifyChain (tampered record)", () => {
  const SCOPE = "org-direct-tampered";
  const RUN_ID = "run-test-tampered";

  it("detects a tampered eventHash and reports the first broken sequence", () => {
    const db = getDb();

    const r1 = buildChainRecord({
      scope: SCOPE, sequence: 1, previousHash: GENESIS_HASH,
      auditEventId: "AUE-TP-001", eventKind: "createAction",
      actorKind: "human", actorId: "P-001",
      at: "2025-02-01T10:00:00.000Z", runId: RUN_ID,
    });
    // r2's previousHash will be the REAL r1.eventHash, but we will tamper with r1.eventHash.
    const r2 = buildChainRecord({
      scope: SCOPE, sequence: 2, previousHash: r1.eventHash,
      auditEventId: "AUE-TP-002", eventKind: "approveDecision",
      actorKind: "human", actorId: "P-002",
      at: "2025-02-01T11:00:00.000Z", runId: RUN_ID,
    });

    db.insert(auditChainRecords).values([r1, r2]).run();

    // Tamper with r1's eventHash so the chain breaks.
    // Use raw better-sqlite3 to bypass Drizzle's type system.
    const rawSqlite = new Database(tempDbPath);
    rawSqlite.prepare(
      `UPDATE audit_chain_records SET event_hash = ? WHERE chain_scope = ? AND sequence = 1`,
    ).run("tampered0000000000000000000000000000000000000000000000000000000000", SCOPE);
    rawSqlite.close();

    // The verifier must recompute from scratch and detect the break at sequence 2.
    // Sequence 1 passes because verifyChain computes computeHash(GENESIS_HASH, canonical)
    // and compares it to the STORED eventHash -- which is now tampered.
    // So the break is AT sequence 1.
    const result = verifyChain(SCOPE);
    expect(result.status).toBe("broken");
    // The first failure is at sequence 1 because that record's stored hash
    // no longer matches what is recomputed.
    expect(result.firstFailureSequence).toBe(1);
    expect(result.verifiedThrough).toBe(0);
    expect(result.totalRecords).toBe(2);
  });
});

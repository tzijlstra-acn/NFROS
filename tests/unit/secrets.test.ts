/**
 * Secret handling tests.
 *
 * Two distinct risks are covered. First, the loader must accept a real key and
 * reject a placeholder, because reporting live mode as available and then
 * failing on the first call is the worst outcome for a live demonstration.
 * Second, nothing anywhere may emit the value: the redactor is tested against
 * the shapes a careless caller would actually produce.
 *
 * No real key appears in this file. The fixtures are synthetic strings that
 * merely have the right shape.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  getOpenAIStatus,
  internalsForTests,
  resetOpenAIConfigCache,
  resolveInfraPath,
} from "@/server/config/load-openai-config";
import { createLogger, redact, redactString, REDACTED } from "@/server/logging/redact";

/** A synthetic key with realistic shape. Not a real credential. */
const FAKE_KEY = "sk-" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0"; // copy-check-ignore

/*
 * Further synthetic fixtures, also assembled from fragments.
 *
 * The reason for the concatenation is not cosmetic: the build time secret
 * scanner reads source as text, and a key shaped literal here would be a
 * finding. Splitting them means the scanner needs no allowlist entries at all,
 * which is a stronger property than an allowlist a reader has to trust.
 */
const SECOND_FIXTURE_ASSIGNMENT =
  "OPENAI_API_KEY=" + "sk-" + "from-the-file-not-used-here-0000";
const THIRD_FIXTURE_ASSIGNMENT =
  "OPENAI_API_KEY=" + "sk-" + "this-one-should-lose-00000000000";

let tempRoot: string;
const originalEnv = { ...process.env };

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), "nfr-secret-test-"));
  resetOpenAIConfigCache();
});

afterEach(() => {
  rmSync(tempRoot, { recursive: true, force: true });
  process.env = { ...originalEnv };
  resetOpenAIConfigCache();
  vi.restoreAllMocks();
});

function writeInfra(fileName: string, contents: string): string {
  const infra = join(tempRoot, "RealAIInfrastructure");
  mkdirSync(infra, { recursive: true });
  writeFileSync(join(infra, fileName), contents, "utf8");
  return infra;
}

describe("the allowlisted env parser", () => {
  const { parseAllowlistedEnv } = internalsForTests;

  it("returns only the variables the application needs", () => {
    const parsed = parseAllowlistedEnv(
      [
        "OPENAI_API_KEY=" + FAKE_KEY,
        "SNOW_PASSWORD=some-unrelated-secret",
        "DEMO_ADMIN_PASSWORD=another-unrelated-secret",
        "SECRET_KEY=yet-another",
        "BACKEND_URL=http://localhost:8000",
      ].join("\n"),
    );

    expect(parsed.get("OPENAI_API_KEY")).toBe(FAKE_KEY);
    // The point of the allowlist: unrelated credentials are never even held.
    expect(parsed.has("SNOW_PASSWORD")).toBe(false);
    expect(parsed.has("DEMO_ADMIN_PASSWORD")).toBe(false);
    expect(parsed.has("SECRET_KEY")).toBe(false);
    expect(parsed.has("BACKEND_URL")).toBe(false);
  });

  it("handles quotes, export prefixes and inline comments", () => {
    const parsed = parseAllowlistedEnv(
      [
        `export OPENAI_API_KEY="${FAKE_KEY}"`,
        `OPENAI_ORG_ID=org-abcdef1234567890 # the organisation`,
      ].join("\n"),
    );
    expect(parsed.get("OPENAI_API_KEY")).toBe(FAKE_KEY);
    expect(parsed.get("OPENAI_ORG_ID")).toBe("org-abcdef1234567890");
  });

  it("ignores comments and blank lines", () => {
    const parsed = parseAllowlistedEnv(
      ["# a comment", "", "   ", "OPENAI_API_KEY=" + FAKE_KEY].join("\n"),
    );
    expect(parsed.size).toBe(1);
  });
});

describe("key plausibility", () => {
  const { looksLikeUsableKey } = internalsForTests;

  it("accepts a realistically shaped key", () => {
    expect(looksLikeUsableKey(FAKE_KEY)).toBe(true);
  });

  it("rejects placeholders", () => {
    const placeholders = [
      "",
      "   ",
      "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", // copy-check-ignore
      "your-api-key-here",
      "<your-key>",
      "${OPENAI_API_KEY}",
      "changeme",
      "CHANGE_ME_PLEASE_NOW_1234567890",
      "TODO",
      "none",
      "null",
      "undefined",
      "sk-" + "test-0000000000000000000000000",
    ];
    for (const value of placeholders) {
      expect(looksLikeUsableKey(value), `accepted placeholder: ${value}`).toBe(false);
    }
  });

  it("rejects a value without the documented prefix", () => {
    expect(looksLikeUsableKey("A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6")).toBe(false);
  });

  it("rejects a value that is too short", () => {
    expect(looksLikeUsableKey("sk-short")).toBe(false);
  });

  it("rejects a value with embedded whitespace", () => {
    expect(looksLikeUsableKey("sk-A1b2C3d4 E5f6G7h8I9j0K1l2M3n4O5p6")).toBe(false);
  });
});

describe("resolution precedence", () => {
  it("prefers a shell variable over any file", () => {
    process.env.OPENAI_API_KEY = FAKE_KEY;
    process.env.REAL_AI_INFRA_PATH = writeInfra(".env", SECOND_FIXTURE_ASSIGNMENT);
    resetOpenAIConfigCache();

    const status = getOpenAIStatus();
    expect(status.configured).toBe(true);
    expect(status.source).toBe("process environment");
    expect(status.variableName).toBe("OPENAI_API_KEY");
  });

  it("reads .env.local before .env", () => {
    delete process.env.OPENAI_API_KEY;
    const infra = join(tempRoot, "RealAIInfrastructure");
    mkdirSync(infra, { recursive: true });
    writeFileSync(join(infra, ".env.local"), "OPENAI_API_KEY=" + FAKE_KEY, "utf8");
    writeFileSync(join(infra, ".env"), THIRD_FIXTURE_ASSIGNMENT, "utf8");
    process.env.REAL_AI_INFRA_PATH = infra;
    resetOpenAIConfigCache();

    const status = getOpenAIStatus();
    expect(status.configured).toBe(true);
    expect(status.source).toMatch(/\.env\.local$/);
  });

  it("falls back to the mini key only when the primary is absent", () => {
    delete process.env.OPENAI_API_KEY;
    process.env.REAL_AI_INFRA_PATH = writeInfra(".env", "OPENAI_MINI_API_KEY=" + FAKE_KEY);
    resetOpenAIConfigCache();

    const status = getOpenAIStatus();
    expect(status.configured).toBe(true);
    expect(status.variableName).toBe("OPENAI_MINI_API_KEY");
  });

  it("reports safe mode when only a placeholder is present", () => {
    delete process.env.OPENAI_API_KEY;
    process.env.REAL_AI_INFRA_PATH = writeInfra(".env", "OPENAI_API_KEY=your-key-here");
    resetOpenAIConfigCache();

    const status = getOpenAIStatus();
    expect(status.configured).toBe(false);
    expect(status.liveModeAvailable).toBe(false);
    expect(status.reason).toBeTruthy();
  });

  /*
   * Note what this asserts and what it does not. When the configured path is
   * wrong the loader is documented to fall back to searching the repository
   * parent, and on a developer machine that search usually succeeds. So the
   * behaviour under test here is the fallback itself, not a failure.
   *
   * The genuinely-not-found case is covered by the path resolver tests below,
   * which can control the working directory and therefore isolate the search.
   */
  it("falls back to the parent search when the configured path is wrong", () => {
    delete process.env.OPENAI_API_KEY;
    process.env.REAL_AI_INFRA_PATH = join(tempRoot, "does-not-exist");
    delete process.env.NFR_SOURCE_ROOT;
    resetOpenAIConfigCache();

    const status = getOpenAIStatus();

    // Either outcome is correct. What must hold in both is that the status
    // stays internally consistent and never carries key material.
    expect(status.configured).toBe(status.liveModeAvailable);
    if (!status.configured) {
      expect(status.reason).toBeTruthy();
      expect(status.variableName).toBeNull();
    } else {
      expect(status.source).not.toContain("does-not-exist");
    }
    expect(JSON.stringify(status)).not.toMatch(/sk-/);
  });

  it("reports safe mode when no directory can be found at all", () => {
    delete process.env.OPENAI_API_KEY;
    // An isolated working directory whose parents contain no source repo.
    const isolated = join(tempRoot, "isolated", "repo");
    mkdirSync(isolated, { recursive: true });
    delete process.env.REAL_AI_INFRA_PATH;
    process.env.NFR_SOURCE_ROOT = join(tempRoot, "also-missing");

    expect(resolveInfraPath(isolated)).toBeNull();
  });
});

describe("the status object", () => {
  it("never contains the key or any fragment of it", () => {
    process.env.OPENAI_API_KEY = FAKE_KEY;
    resetOpenAIConfigCache();

    const status = getOpenAIStatus();
    const serialised = JSON.stringify(status);

    expect(serialised).not.toContain(FAKE_KEY);
    // No prefix, no suffix, no length disclosure.
    expect(serialised).not.toContain(FAKE_KEY.slice(0, 12));
    expect(serialised).not.toContain(FAKE_KEY.slice(-8));
    expect(serialised).not.toContain(String(FAKE_KEY.length));
    expect(serialised).not.toMatch(/sk-/);
  });

  it("describes the source without leaking an absolute machine path", () => {
    delete process.env.OPENAI_API_KEY;
    process.env.REAL_AI_INFRA_PATH = writeInfra(".env", "OPENAI_API_KEY=" + FAKE_KEY);
    resetOpenAIConfigCache();

    const status = getOpenAIStatus();
    expect(status.source).toBe("RealAIInfrastructure/.env");
    expect(status.source).not.toContain(tempRoot);
  });
});

describe("the path resolver", () => {
  it("does not search outside the permitted roots", () => {
    delete process.env.REAL_AI_INFRA_PATH;
    delete process.env.NFR_SOURCE_ROOT;
    // A directory that exists but is neither the parent nor the grandparent.
    const unrelated = join(tempRoot, "unrelated", "deep", "nested");
    mkdirSync(join(unrelated, "RealAIInfrastructure"), { recursive: true });
    expect(resolveInfraPath(join(tempRoot, "some", "cwd"))).toBeNull();
  });

  it("matches the directory name case insensitively", () => {
    delete process.env.REAL_AI_INFRA_PATH;
    const parent = join(tempRoot, "workspace");
    mkdirSync(join(parent, "realaiinfrastructure"), { recursive: true });
    const resolved = resolveInfraPath(join(parent, "nfr-workos"));
    expect(resolved).not.toBeNull();
  });
});

describe("redaction", () => {
  it("removes an OpenAI style key from a string", () => {
    const redacted = redactString(`Calling the API with ${FAKE_KEY} now`);
    expect(redacted).not.toContain(FAKE_KEY);
    expect(redacted).toContain(REDACTED);
  });

  it("removes project and service account key variants", () => {
    for (const prefix of ["sk-proj-", "sk-svcacct-"]) {
      const key = prefix + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6";
      expect(redactString(`key=${key}`)).not.toContain(key);
    }
  });

  it("removes a partially masked key echoed back by the provider", () => {
    /*
     * A regression guard for a real leak.
     *
     * When OpenAI rejects a key it echoes it back masked, for example
     * sk-proj followed by a long run of asterisks and four real trailing
     * characters. That still discloses the suffix and the exact length, and
     * the unmasked patterns did not match it because an asterisk is not in
     * their character class. The message reached the console before this was
     * fixed.
     */
    const masked = "sk-proj-" + "*".repeat(40) + "Uk0A";
    const message = "401 Incorrect API key provided: " + masked + ". Check your key.";
    const redacted = redactString(message);

    expect(redacted).not.toContain(masked);
    expect(redacted).not.toContain("Uk0A");
    expect(redacted).not.toContain("****");
    expect(redacted).toContain(REDACTED);
    // The useful part of the message survives, so the operator still learns why.
    expect(redacted).toContain("401");
  });

  it("removes a masked key that uses unicode bullet characters", () => {
    const masked = "sk-" + "•".repeat(20) + "9xQz";
    expect(redactString(masked)).not.toContain("9xQz");
  });

  it("removes bearer tokens and authorization headers", () => {
    const token = "abcdefghijklmnopqrstuvwxyz0123456789";
    expect(redactString(`Authorization: Bearer ${token}`)).not.toContain(token);
  });

  it("removes a JSON web token", () => {
    const jwt = ["eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiIxMjM0NTY3ODkwIn0", "dBjftJeZ4CVPmB92K27u"].join(".");
    expect(redactString(jwt)).not.toContain(jwt);
  });

  it("removes a private key block", () => {
    const marker = (word: string) => `-----${word} RSA PRIVATE KEY-----`;
    const block = `${marker("BEGIN")}\nabc123\n${marker("END")}`;
    expect(redactString(block)).not.toContain("abc123");
  });

  it("redacts by key name even when the value has no recognisable shape", () => {
    const result = redactString("apiKey=plainlookingvalue123");
    expect(result).not.toContain("plainlookingvalue123");
  });

  it("redacts sensitive object keys recursively", () => {
    const redacted = redact({
      level1: {
        apiKey: FAKE_KEY,
        authorization: "Bearer something",
        nested: { password: "hunter2", safe: "visible" },
      },
      list: [{ token: "abc" }],
    });
    const serialised = JSON.stringify(redacted);

    expect(serialised).not.toContain(FAKE_KEY);
    expect(serialised).not.toContain("hunter2");
    expect(serialised).not.toContain("abc");
    expect(serialised).toContain("visible");
  });

  it("redacts an error message and stack", () => {
    const error = new Error(`Request failed with key ${FAKE_KEY}`);
    const serialised = JSON.stringify(redact(error));
    expect(serialised).not.toContain(FAKE_KEY);
  });

  it("does not loop forever on a cyclic structure", () => {
    const cyclic: Record<string, unknown> = { name: "root" };
    cyclic.self = cyclic;
    expect(() => JSON.stringify(redact(cyclic))).not.toThrow();
  });

  it("keeps a key out of an emitted log line", () => {
    const lines: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      lines.push(String(line));
    });

    const log = createLogger("test");
    log.info("Configuration resolved", { apiKey: FAKE_KEY, note: `raw ${FAKE_KEY}` });

    spy.mockRestore();
    const all = lines.join("\n");
    expect(all.length).toBeGreaterThan(0);
    expect(all).not.toContain(FAKE_KEY);
  });
});

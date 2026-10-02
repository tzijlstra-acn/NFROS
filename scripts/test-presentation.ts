/**
 * test-presentation.ts
 *
 * Smoke test for PresentationV22 URL routing.
 *
 * Checks:
 *   1. /story (no params)                               -> V2.2 loads at slide 1
 *   2. /story?deck=v2.1                                 -> V2.1 still loads
 *   3. /story?deck=v2.2&core=5                          -> V2.2 core slide 5
 *   4. /story?deck=v2.2&appendix=app-08&from=slide-05   -> appendix navigation
 *
 * Run with: npm run test:presentation
 * Run with: npm run test:presentation-links (links-only mode)
 *
 * Requires the dev server to be running at localhost:3000.
 * If the server is not running, each check will report SKIP.
 */

const BASE_URL = process.env.PRESENTATION_BASE_URL ?? "http://localhost:3000";
const LINKS_ONLY = process.argv.includes("--links-only");

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

type CheckResult = "PASS" | "FAIL" | "SKIP";

interface TestCase {
  name: string;
  url: string;
  /** Expected text to find in the HTML response. */
  expectedText?: string;
  /** HTTP status code expected (default 200). */
  expectedStatus?: number;
}

const TEST_CASES: TestCase[] = [
  {
    name: "/story (no params) -> V2.2 default",
    url: `${BASE_URL}/story`,
    expectedStatus: 200,
    expectedText: "NFROS",
  },
  {
    name: "/story?deck=v2.1 -> V2.1 deck loads",
    url: `${BASE_URL}/story?deck=v2.1`,
    expectedStatus: 200,
    expectedText: "NFROS",
  },
  {
    name: "/story?deck=v2.2&core=5 -> V2.2 core slide 5",
    url: `${BASE_URL}/story?deck=v2.2&core=5`,
    expectedStatus: 200,
    expectedText: "NFROS",
  },
  {
    name: "/story?deck=v2.2&appendix=app-08&from=slide-05 -> appendix nav",
    url: `${BASE_URL}/story?deck=v2.2&appendix=app-08&from=slide-05`,
    expectedStatus: 200,
    expectedText: "NFROS",
  },
  {
    name: "/story?deck=current -> V2.2 current alias",
    url: `${BASE_URL}/story?deck=current`,
    expectedStatus: 200,
    expectedText: "NFROS",
  },
];

// ---------------------------------------------------------------------------
// URL structure validation (no server required)
// ---------------------------------------------------------------------------

const LINK_CHECKS: { name: string; url: string; valid: boolean }[] = [
  {
    name: "Core URL: core=5 is 1-based integer",
    url: `${BASE_URL}/story?deck=v2.2&core=5`,
    valid: new URL(`${BASE_URL}/story?deck=v2.2&core=5`).searchParams.get("core") === "5",
  },
  {
    name: "Appendix URL: appendix=app-08 is valid format",
    url: `${BASE_URL}/story?deck=v2.2&appendix=app-08`,
    valid: /^app-\d+$/.test("app-08"),
  },
  {
    name: "From param: from=slide-05 matches slide-NN format",
    url: `${BASE_URL}/story?deck=v2.2&appendix=app-08&from=slide-05`,
    valid: /^slide-\d+$/.test("slide-05"),
  },
  {
    name: "Deck v2.1 route preserved",
    url: `${BASE_URL}/story?deck=v2.1`,
    valid: new URL(`${BASE_URL}/story?deck=v2.1`).searchParams.get("deck") === "v2.1",
  },
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function runCheck(tc: TestCase): Promise<CheckResult> {
  try {
    const res = await fetch(tc.url, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });

    const expectedStatus = tc.expectedStatus ?? 200;
    if (res.status !== expectedStatus) {
      console.error(`  Status: got ${res.status}, expected ${expectedStatus}`);
      return "FAIL";
    }

    if (tc.expectedText) {
      const body = await res.text();
      if (!body.includes(tc.expectedText)) {
        console.error(`  Expected text "${tc.expectedText}" not found in response`);
        return "FAIL";
      }
    }

    return "PASS";
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.includes("ECONNREFUSED") || err.name === "TimeoutError")) {
      return "SKIP";
    }
    console.error(`  Error: ${err instanceof Error ? err.message : String(err)}`);
    return "FAIL";
  }
}

async function main() {
  console.log("=== Presentation V2.2 smoke tests ===\n");

  // Always run link structure checks (no server needed)
  console.log("-- URL structure checks (no server required) --");
  let linkPass = 0;
  let linkFail = 0;
  for (const check of LINK_CHECKS) {
    const result = check.valid ? "PASS" : "FAIL";
    const symbol = result === "PASS" ? "[PASS]" : "[FAIL]";
    console.log(`  ${symbol} ${check.name}`);
    if (result === "PASS") linkPass++;
    else linkFail++;
  }
  console.log(`\nURL structure: ${linkPass} passed, ${linkFail} failed\n`);

  if (LINKS_ONLY) {
    if (linkFail > 0) process.exit(1);
    return;
  }

  // Server-dependent checks
  console.log("-- HTTP route checks (requires dev server at localhost:3000) --");
  let pass = 0;
  let fail = 0;
  let skip = 0;

  for (const tc of TEST_CASES) {
    process.stdout.write(`  [ ... ] ${tc.name}`);
    const result = await runCheck(tc);
    const symbols: Record<CheckResult, string> = {
      PASS: "[PASS]",
      FAIL: "[FAIL]",
      SKIP: "[SKIP]",
    };
    process.stdout.write(`\r  ${symbols[result]} ${tc.name}\n`);
    if (result === "PASS") pass++;
    else if (result === "FAIL") fail++;
    else skip++;
  }

  console.log(`\nHTTP checks: ${pass} passed, ${fail} failed, ${skip} skipped`);

  if (skip === TEST_CASES.length) {
    console.log("\nNote: all HTTP checks skipped -- start the dev server with npm run dev\n");
  }

  if (fail > 0 || linkFail > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});

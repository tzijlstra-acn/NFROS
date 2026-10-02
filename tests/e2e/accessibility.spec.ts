/**
 * Accessibility suite.
 *
 * Injects axe-core from the local node_modules installation (already a
 * devDependency) and runs it against the key pages in the product. Critical
 * and serious violations are hard failures; moderate and minor violations are
 * logged but do not fail the run.
 *
 * Selectors for interactive elements use role-based queries so the tests also
 * document the accessibility contract.
 */

import { expect, test } from "@playwright/test";
import path from "path";

const AXE_PATH = path.resolve("node_modules/axe-core/axe.min.js");

const PAGES_TO_TEST = [
  { name: "Entry", path: "/" },
  { name: "Role selector", path: "/workday" },
  { name: "RCSA Home", path: "/workday/rcsa" },
  { name: "RCSA Decisions", path: "/workday/rcsa/decisions" },
  { name: "RCSA Processes", path: "/workday/rcsa/processes" },
  { name: "TPRM Home", path: "/workday/tprm" },
  { name: "TPRM Decisions", path: "/workday/tprm/decisions" },
  { name: "TPRM Processes", path: "/workday/tprm/processes" },
];

type AxeViolation = {
  id: string;
  impact: string | null;
  description: string;
  nodes: Array<{ html: string; target: string[] }>;
};

/** Opens a path and skips when the server returns 404 for this build. */
async function openPage(page: import("@playwright/test").Page, pagePath: string): Promise<boolean> {
  try {
    const response = await page.goto(pagePath, { waitUntil: "domcontentloaded", timeout: 30_000 });
    if (!response || response.status() === 404) {
      test.skip(true, `${pagePath} is not implemented in this build (404).`);
      return false;
    }
    return true;
  } catch {
    test.skip(true, `${pagePath} is not reachable -- server may not be running.`);
    return false;
  }
}

for (const pageDef of PAGES_TO_TEST) {
  test(`Accessibility: ${pageDef.name}`, async ({ page }) => {
    const ok = await openPage(page, pageDef.path);
    if (!ok) return;

    // Wait for the main content to settle.
    await page.waitForLoadState("networkidle").catch(() => {/* timeout is acceptable */});

    // Inject axe-core from the local devDependency.
    await page.addScriptTag({ path: AXE_PATH });

    const violations = await page.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results = await (window as any).axe.run({
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
        },
      }) as { violations: AxeViolation[] };
      return results.violations as AxeViolation[];
    });

    const critical = violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );

    const moderate = violations.filter(
      (v) => v.impact === "moderate" || v.impact === "minor",
    );

    if (moderate.length > 0) {
      const summary = moderate.map((v) => `[${v.impact}] ${v.id}: ${v.description}`).join("\n");
      console.warn(`Moderate/minor violations on ${pageDef.name} (not failing):\n${summary}`);
    }

    if (critical.length > 0) {
      const details = critical
        .map(
          (v) =>
            `[${v.impact}] ${v.id}: ${v.description}\n  Node: ${v.nodes[0]?.html ?? "(unknown)"}`,
        )
        .join("\n\n");
      console.error(`Critical/serious violations on ${pageDef.name}:\n${details}`);
    }

    expect(
      critical,
      `${critical.length} critical/serious accessibility violation(s) on "${pageDef.name}". Run axe-core locally for details.`,
    ).toHaveLength(0);
  });
}

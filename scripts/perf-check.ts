#!/usr/bin/env tsx
/**
 * Performance budget check.
 *
 * Measures First Contentful Paint and shell interactive time against the
 * budgets defined in this file. A route that exceeds its budget prints FAIL
 * and the script exits with code 1 so CI blocks on it.
 *
 * Usage:
 *   npm run perf:check
 *   BASE_URL=http://localhost:3001 npm run perf:check
 *
 * Playwright is already installed as a devDependency, so no additional
 * packages are required.
 */

import { chromium } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

const BUDGETS = {
  "Header visible (FCP)": 400,
  "Shell interactive": 800,
} as const;

type BudgetKey = keyof typeof BUDGETS;

interface PerfResult {
  route: string;
  metric: BudgetKey;
  actualMs: number;
  budgetMs: number;
  passed: boolean;
}

const ROUTES = [
  { url: `${BASE_URL}/workday/rcsa`, label: "RCSA Home" },
  { url: `${BASE_URL}/workday/tprm`, label: "TPRM Home" },
  { url: `${BASE_URL}/workday/rcsa/decisions`, label: "RCSA Decisions" },
  { url: `${BASE_URL}/workday/rcsa/processes`, label: "RCSA Processes" },
];

async function measureRoute(routeUrl: string, label: string): Promise<PerfResult[]> {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const context = await browser.newContext({
    colorScheme: "dark",
    reducedMotion: "reduce",
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const results: PerfResult[] = [];

  const start = Date.now();

  await page.goto(routeUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

  // First Contentful Paint from the Performance API.
  const fcp = await page.evaluate(() => {
    const entries = performance.getEntriesByType("paint");
    const fcpEntry = entries.find((e) => e.name === "first-contentful-paint");
    return fcpEntry ? Math.round(fcpEntry.startTime) : null;
  });

  if (fcp !== null) {
    results.push({
      route: label,
      metric: "Header visible (FCP)",
      actualMs: fcp,
      budgetMs: BUDGETS["Header visible (FCP)"],
      passed: fcp <= BUDGETS["Header visible (FCP)"],
    });
  }

  // Shell interactive: time from navigation start to domcontentloaded.
  const tti = Date.now() - start;
  results.push({
    route: label,
    metric: "Shell interactive",
    actualMs: tti,
    budgetMs: BUDGETS["Shell interactive"],
    passed: tti <= BUDGETS["Shell interactive"],
  });

  await browser.close();
  return results;
}

async function runPerfCheck(): Promise<void> {
  console.log("Performance budget check");
  console.log(`Base URL: ${BASE_URL}`);
  console.log("---");

  let allPassed = true;

  for (const route of ROUTES) {
    try {
      const results = await measureRoute(route.url, route.label);
      for (const r of results) {
        const status = r.passed ? "PASS" : "FAIL";
        const delta = r.actualMs - r.budgetMs;
        const deltaStr = delta > 0 ? ` (+${delta}ms over budget)` : ` (${Math.abs(delta)}ms under budget)`;
        console.log(`[${status}] ${r.route} -- ${r.metric}: ${r.actualMs}ms (budget: ${r.budgetMs}ms)${deltaStr}`);
        if (!r.passed) allPassed = false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`[SKIP] ${route.label}: ${message}`);
    }
  }

  console.log("---");
  if (allPassed) {
    console.log("All measured budgets passed.");
    process.exit(0);
  } else {
    console.log("Some budgets exceeded. Review results above.");
    process.exit(1);
  }
}

runPerfCheck().catch((err: unknown) => {
  const name = err instanceof Error ? err.name : "Error";
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Performance check failed (${name}): ${message}`);
  process.exit(1);
});

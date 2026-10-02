/**
 * Captures the interactive workday at the three target viewports.
 *
 * Run with: node scripts/capture-screens.mjs [v1|v2] [outputDirectory]
 *
 * The application must already be running on http://localhost:3000. The script
 * deliberately does not start it: a capture run that boots its own server
 * cannot be pointed at a server a reviewer is already looking at, and the
 * whole purpose of these images is to agree with what is on screen.
 *
 * Two decisions worth stating.
 *
 * Viewport captures, not full page. The shell is fixed to the viewport, so a
 * full page capture of it is either identical to the viewport or, worse,
 * stretched to the height of an inner scroller and therefore a picture of
 * something no user ever sees. The point of capturing at 1366x768 is to show
 * what fits, and `fullPage` would destroy exactly that information.
 *
 * The version is forced through the query parameter rather than the
 * environment, so one run can capture both interfaces against one server and
 * the pair is genuinely comparable.
 */

import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const BASE = process.env.NFR_CAPTURE_BASE ?? "http://localhost:3000";

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
];

/** The two roles that carry the demonstration, captured on every route. */
const PRIMARY_ROLES = ["rcsa", "tprm"];

/** The remaining roles, captured on Today and the workbench only. */
const SECONDARY_ROLES = [
  "control-assurance",
  "incident-resilience",
  "regulatory-change",
  "nfr-governance",
];

const ROUTES = [
  { segment: "", name: "today" },
  { segment: "/workbench", name: "workbench" },
  { segment: "/decisions", name: "decisions" },
  { segment: "/mail", name: "mail" },
  { segment: "/collaboration", name: "collaboration" },
  { segment: "/calendar", name: "calendar" },
  { segment: "/meetings", name: "meetings" },
  { segment: "/assistant", name: "assistant" },
];

const SETTINGS = [
  "organisation",
  "branding",
  "integrations",
  "mappings",
  "role-packs",
  "authority",
  "deployment",
];

function buildPlan(version) {
  const plan = [];

  for (const role of PRIMARY_ROLES) {
    for (const route of ROUTES) {
      for (const viewport of VIEWPORTS) {
        plan.push({
          name: `${role}-${route.name}-${viewport.width}x${viewport.height}`,
          url: `${BASE}/workday/${role}${route.segment}?ui=${version}`,
          viewport,
        });
      }
    }
  }

  for (const role of SECONDARY_ROLES) {
    for (const route of [ROUTES[0], ROUTES[1]]) {
      for (const viewport of [VIEWPORTS[0], VIEWPORTS[2]]) {
        plan.push({
          name: `${role}-${route.name}-${viewport.width}x${viewport.height}`,
          url: `${BASE}/workday/${role}${route.segment}?ui=${version}`,
          viewport,
        });
      }
    }
  }

  plan.push({
    name: `workday-index-1920x1080`,
    url: `${BASE}/workday?ui=${version}`,
    viewport: VIEWPORTS[0],
  });

  /*
   * The administrator area exists only in V2, so it is captured only there.
   * Including it in a V1 run would produce a set of identical images that
   * invite the conclusion the area was redesigned when it was created.
   */
  if (version === "v2") {
    for (const area of SETTINGS) {
      plan.push({
        name: `settings-${area}-1920x1080`,
        url: `${BASE}/settings/${area}`,
        viewport: VIEWPORTS[0],
      });
    }
  }

  return plan;
}

async function main() {
  const version = process.argv[2] === "v1" ? "v1" : "v2";
  const outputDirectory = process.argv[3] ?? `docs/screenshots/workday-${version}`;

  await mkdir(outputDirectory, { recursive: true });

  const plan = buildPlan(version);
  const browser = await chromium.launch();
  const failures = [];

  console.log(`Capturing ${plan.length} screens of ${version} into ${outputDirectory}`);

  for (const entry of plan) {
    const page = await browser.newPage({ viewport: entry.viewport });
    try {
      const response = await page.goto(entry.url, {
        waitUntil: "networkidle",
        timeout: 90_000,
      });

      const status = response?.status() ?? 0;
      if (status >= 400) {
        failures.push(`${entry.name}: HTTP ${status}`);
        console.log(`  FAILED ${entry.name} HTTP ${status}`);
        await page.close();
        continue;
      }

      /*
       * Wait for the main region, then settle. The shell paints before the
       * data by design, so capturing on load alone would photograph the
       * skeletons rather than the product. The settle is deliberately short:
       * a long one would hide a genuinely slow route.
       */
      await page.waitForSelector("#main, main", { timeout: 30_000 }).catch(() => {});
      await page.waitForTimeout(1_500);

      await page.screenshot({
        path: `${outputDirectory}/${entry.name}.png`,
        fullPage: false,
      });
      console.log(`  ${entry.name}`);
    } catch (error) {
      failures.push(`${entry.name}: ${error instanceof Error ? error.message : "unknown"}`);
      console.log(`  FAILED ${entry.name}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();

  console.log(`\nCaptured ${plan.length - failures.length} of ${plan.length}.`);
  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const failure of failures) console.log(`  ${failure}`);
    process.exitCode = 1;
  }
}

await main();

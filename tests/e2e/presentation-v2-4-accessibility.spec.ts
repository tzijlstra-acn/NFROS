/**
 * Presentation V2.4 accessibility.
 *
 * Injects axe-core from node_modules (as tests/e2e/accessibility.spec.ts does) on the cover, a
 * standard slide, the authority slide, the closing slide, an appendix slide, the appendix index
 * and the keyboard help overlay. Serious and critical violations fail; moderate and minor ones,
 * and the checks axe could not decide, are attached as annotations and printed for the report.
 */

import path from "path";
import { expect, test, type Page } from "@playwright/test";

const AXE_PATH = path.resolve("node_modules/axe-core/axe.min.js");
const DECK = "/story?deck=v2.4";

type AxeViolation = {
  id: string;
  impact: string | null;
  help: string;
  nodes: Array<{ target: string[]; failureSummary?: string }>;
};

type Target = { name: string; url: string | ((page: Page) => Promise<string>); help?: boolean };

async function firstAppendixUrl(page: Page): Promise<string> {
  await page.goto(`${DECK}&view=appendix-index`, { waitUntil: "load" });
  const url = await page.evaluate(() => {
    const el = document.querySelector("script[data-presentation-slides]");
    if (!el) return null;
    try {
      const entries = JSON.parse(el.textContent || "[]") as Array<{ kind?: string; type?: string; url?: string; id?: string }>;
      const first = entries.find((e) => (e.kind ?? e.type) === "appendix");
      return first?.url ?? (first?.id ? `/story?deck=v2.4&appendix=${first.id}` : null);
    } catch {
      return null;
    }
  });
  return url ?? `${DECK}&appendix=app-01`;
}

const TARGETS: Target[] = [
  { name: "cover (core 1)", url: `${DECK}&core=1` },
  { name: "standard slide (core 3)", url: `${DECK}&core=3` },
  { name: "authority slide (core 9)", url: `${DECK}&core=9` },
  { name: "closing slide (core 14)", url: `${DECK}&core=14` },
  { name: "appendix slide", url: firstAppendixUrl },
  { name: "appendix index", url: `${DECK}&view=appendix-index` },
  { name: "help overlay on core 3", url: `${DECK}&core=3`, help: true },
];

async function openSettled(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction(
    () => {
      const slide = document.querySelector(".pv24-slide");
      if (!slide || !slide.querySelector("*")) return false;
      const ready = slide.getAttribute("data-slide-ready");
      return ready === null || ready === "true";
    },
    null,
    { timeout: 30_000 },
  );
  await page
    .waitForFunction(
      () =>
        document.getAnimations().every((a) => {
          const iterations = a.effect?.getTiming().iterations ?? 1;
          return !Number.isFinite(iterations) || a.playState !== "running";
        }),
      null,
      { timeout: 10_000 },
    )
    .catch(() => undefined);
  await page.waitForTimeout(300);
}

for (const target of TARGETS) {
  test(`axe: ${target.name}`, async ({ page }) => {
    const url = typeof target.url === "string" ? target.url : await target.url(page);
    await openSettled(page, url);

    if (target.help) {
      await page.keyboard.press("?");
      await expect(page.getByRole("dialog").first(), "? did not open the keyboard help").toBeVisible();
      await page.waitForTimeout(300);
    }

    await page.addScriptTag({ path: AXE_PATH });
    // axe's default rule set: WCAG 2.x A and AA plus best practice
    const { violations, incomplete } = await page.evaluate(async () => {
      type Run = { violations: unknown[]; incomplete: unknown[] };
      const axe = (window as unknown as { axe: { run: (ctx: Document) => Promise<Run> } }).axe;
      const results = await axe.run(document);
      return { violations: results.violations as AxeViolation[], incomplete: results.incomplete as AxeViolation[] };
    });

    const format = (v: AxeViolation) =>
      `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node${v.nodes.length === 1 ? "" : "s"}, first ${v.nodes[0]?.target.join(" ") ?? "?"})`;
    const blocking = violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    const advisory = violations.filter((v) => v.impact !== "critical" && v.impact !== "serious");

    for (const v of advisory) {
      test.info().annotations.push({ type: "axe-advisory", description: format(v) });
      console.log(`axe advisory on ${target.name}: ${format(v)}`);
    }
    for (const v of incomplete) {
      test.info().annotations.push({ type: "axe-needs-review", description: format(v) });
      console.log(`axe needs review on ${target.name}: ${format(v)}`);
    }
    expect(blocking.map(format), `serious or critical axe violations on ${target.name}`).toEqual([]);
  });
}

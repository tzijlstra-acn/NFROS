/**
 * Presentation V2.4 motion contract.
 *
 * - The reveal on every slide in play order completes within 4 seconds: at 4.2 s every finite
 *   Web Animation has finished and no element is still fading in.
 * - Export mode (`&export=1&safe=1`) and reduced motion render the final state at once.
 * - R replays the current slide; M pauses all motion and resumes it.
 *
 * Intentional loops are excluded: infinite animations, SMIL particles, and any subtree marked
 * `data-pv24-loop` (for loops built from repeated finite animations).
 */

import { expect, test, type Page } from "@playwright/test";

const DECK = "/story?deck=v2.4";
const PLAY_ORDER = Array.from({ length: 14 }, (_, i) => i + 1);
const REVEAL_DEADLINE_MS = 4_200;
const STATIC_DEADLINE_MS = 300;

/** Opens a slide and returns the moment its content mounted, which is when the reveal starts. */
async function openAndStartClock(page: Page, url: string): Promise<number> {
  await page.goto(url, { waitUntil: "commit" });
  await page.waitForFunction(() => document.querySelector(".pv24-slide")?.querySelector("*") != null, null, {
    polling: "raf",
    timeout: 30_000,
  });
  return Date.now();
}

async function waitUntil(page: Page, t0: number, ms: number): Promise<void> {
  const left = t0 + ms - Date.now();
  if (left > 0) await page.waitForTimeout(left);
}

/** Finite animations that have not finished, described for the failure message. */
function unfinishedAnimations(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    document.getAnimations().flatMap((a) => {
      const effect = a.effect;
      const iterations = effect?.getTiming().iterations ?? 1;
      if (!Number.isFinite(iterations) || a.playState === "finished") return [];
      const target = effect instanceof KeyframeEffect ? effect.target : null;
      if (target?.closest("[data-pv24-loop]")) return [];
      const kind =
        a instanceof CSSAnimation
          ? `css animation ${a.animationName}`
          : a instanceof CSSTransition
            ? `css transition ${a.transitionProperty}`
            : `animation of ${(effect instanceof KeyframeEffect ? effect.getKeyframes() : [])
                .flatMap((k) => Object.keys(k).filter((p) => !["offset", "easing", "composite", "computedOffset"].includes(p)))
                .filter((p, i, all) => all.indexOf(p) === i)
                .join("+")}`;
      const text = (target?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
      const end = Math.round(Number(effect?.getComputedTiming().endTime ?? 0));
      return [`${kind} ${a.playState} on <${target?.tagName.toLowerCase() ?? "?"}> "${text}" (ends at ${end} ms)`];
    }),
  );
}

/** Opacity of every element in the slide, keyed by a stable id that survives between samples. */
function sampleOpacities(page: Page): Promise<Record<string, number>> {
  return page.evaluate(() => {
    const w = window as unknown as { __pv24qa?: { ids: WeakMap<Element, number>; next: number; labels: Record<number, string> } };
    const qa = (w.__pv24qa ??= { ids: new WeakMap(), next: 1, labels: {} });
    const slide = document.querySelector(".pv24-slide");
    const out: Record<string, number> = {};
    if (!slide) return out;
    for (const el of Array.from(slide.querySelectorAll("*"))) {
      if (el.closest("[data-pv24-loop], animate, animateMotion, animateTransform, set, defs")) continue;
      if (el.querySelector(":scope > animate[attributeName='opacity'], :scope > set[attributeName='opacity']")) continue;
      if (el.getAnimations().some((a) => !Number.isFinite(a.effect?.getTiming().iterations ?? 1))) continue;
      let id = qa.ids.get(el);
      if (id === undefined) {
        id = qa.next++;
        qa.ids.set(el, id);
        const text = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
        qa.labels[id] = `<${el.tagName.toLowerCase()}>${text ? ` "${text}"` : ""}`;
      }
      out[String(id)] = Number(getComputedStyle(el).opacity || "1");
    }
    return out;
  });
}

/**
 * Elements below full opacity at the first sample that then rise and hold steady: an entrance
 * still in progress. Elements that keep changing are loops and are ignored.
 */
async function pendingEntrances(page: Page): Promise<string[]> {
  const first = await sampleOpacities(page);
  const later: Array<Record<string, number>> = [];
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(600);
    later.push(await sampleOpacities(page));
  }
  const labels = await page.evaluate(
    () => (window as unknown as { __pv24qa?: { labels: Record<number, string> } }).__pv24qa?.labels ?? {},
  );
  const pending: string[] = [];
  for (const [id, start] of Object.entries(first)) {
    if (start >= 0.99) continue;
    const values = later.map((s) => s[id]).filter((v): v is number => v !== undefined);
    if (values.length < later.length) continue;
    const settled = Math.max(...values) - Math.min(...values) <= 0.02;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    if (settled && mean - start >= 0.05) {
      pending.push(`${labels[Number(id)] ?? id} at opacity ${start.toFixed(2)}, settles at ${mean.toFixed(2)}`);
    }
  }
  return pending;
}

/** Opacity, box and transform of every element in the slide, for freeze and stillness checks. */
function visualSignature(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const slide = document.querySelector(".pv24-slide");
    const out: Record<string, string> = {};
    if (!slide) return out;
    Array.from(slide.querySelectorAll("*")).forEach((el, i) => {
      if (el.closest("animate, animateMotion, animateTransform, set, defs")) return;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 30);
      const key = `${i} <${el.tagName.toLowerCase()}>${text ? ` "${text}"` : ""}`;
      out[key] = [Number(cs.opacity).toFixed(3), r.x.toFixed(1), r.y.toFixed(1), r.width.toFixed(1), r.height.toFixed(1), cs.transform, cs.clipPath].join("|");
    });
    return out;
  });
}

function changedBetween(a: Record<string, string>, b: Record<string, string>): string[] {
  return Object.keys(a).filter((k) => b[k] !== undefined && a[k] !== b[k]);
}

function revealedTextHidden(page: Page): Promise<number> {
  return page.evaluate(() => {
    const slide = document.querySelector(".pv24-slide");
    if (!slide) return 0;
    let hidden = 0;
    for (const el of Array.from(slide.querySelectorAll("h1, p, span, div, text"))) {
      if (!Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim())) continue;
      let opacity = 1;
      for (let a: Element | null = el; a && a !== slide; a = a.parentElement) opacity *= Number(getComputedStyle(a).opacity || "1");
      if (opacity < 0.95) hidden++;
    }
    return hidden;
  });
}

test.describe("Presentation V2.4 reveal timing", () => {
  test.use({ reducedMotion: "no-preference" });

  for (const n of PLAY_ORDER) {
    test(`core ${n}: reveal completes within 4 seconds`, async ({ page }) => {
      const t0 = await openAndStartClock(page, `${DECK}&core=${n}`);
      await waitUntil(page, t0, REVEAL_DEADLINE_MS);
      const unfinished = await unfinishedAnimations(page);
      const pending = await pendingEntrances(page);
      expect.soft(unfinished, `core ${n}: finite animations still running 4.2 s after load`).toEqual([]);
      expect.soft(pending, `core ${n}: elements still fading in 4.2 s after load`).toEqual([]);
    });
  }
});

test.describe("Presentation V2.4 export mode renders the final state", () => {
  test.use({ reducedMotion: "no-preference" });

  for (const n of PLAY_ORDER) {
    test(`core ${n}: nothing animates with export=1&safe=1`, async ({ page }) => {
      await page.goto(`${DECK}&core=${n}&export=1&safe=1`, { waitUntil: "load" });
      await page.waitForFunction(() => document.querySelector(".pv24-slide")?.querySelector("*") != null, null, { timeout: 30_000 });
      const t0 = Date.now();
      await waitUntil(page, t0, STATIC_DEADLINE_MS);
      expect.soft(await unfinishedAnimations(page), `core ${n}: finite animations running in export mode`).toEqual([]);
      const before = await visualSignature(page);
      await page.waitForTimeout(800);
      const after = await visualSignature(page);
      expect.soft(changedBetween(before, after), `core ${n}: elements still moving in export mode`).toEqual([]);
    });
  }
});

test.describe("Presentation V2.4 reduced motion renders the final state", () => {
  test.use({ reducedMotion: "reduce" });

  for (const n of PLAY_ORDER) {
    test(`core ${n}: nothing animates with reduced motion`, async ({ page }) => {
      const t0 = await openAndStartClock(page, `${DECK}&core=${n}`);
      await waitUntil(page, t0, STATIC_DEADLINE_MS);
      expect.soft(await unfinishedAnimations(page), `core ${n}: finite animations running under reduced motion`).toEqual([]);
      const before = await visualSignature(page);
      await page.waitForTimeout(800);
      const after = await visualSignature(page);
      expect.soft(changedBetween(before, after), `core ${n}: elements still moving under reduced motion`).toEqual([]);
    });
  }
});

test.describe("Presentation V2.4 presenter motion keys", () => {
  test.use({ reducedMotion: "no-preference" });

  test("R replays the reveal on the same slide", async ({ page }) => {
    const t0 = await openAndStartClock(page, `${DECK}&core=3`);
    await waitUntil(page, t0, REVEAL_DEADLINE_MS + 300);
    const url = page.url();
    const title = await page.locator(".pv24-slide h1").first().textContent();
    expect(await revealedTextHidden(page), "the reveal had not settled before pressing R").toBe(0);

    await page.keyboard.press("r");
    const replayStart = Date.now();
    await expect
      .poll(() => revealedTextHidden(page), { message: "R did not restart the reveal", timeout: 1_000, intervals: [50] })
      .toBeGreaterThan(0);
    expect(page.url(), "R changed the URL").toBe(url);
    await expect(page.locator(".pv24-slide h1").first(), "R changed the slide").toHaveText(title ?? "");

    await waitUntil(page, replayStart, REVEAL_DEADLINE_MS);
    expect(await unfinishedAnimations(page), "the replayed reveal did not complete within 4 seconds").toEqual([]);
    expect(await revealedTextHidden(page), "text still hidden after the replayed reveal").toBe(0);
  });

  test("M pauses all motion and resumes it", async ({ page }) => {
    const t0 = await openAndStartClock(page, `${DECK}&core=3`);
    await waitUntil(page, t0, 800);

    await page.keyboard.press("m");
    await page.waitForTimeout(300);
    const running = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => !(a instanceof CSSTransition) && a.playState === "running")
        .map((a) => {
          const target = a.effect instanceof KeyframeEffect ? a.effect.target : null;
          return `<${target?.tagName.toLowerCase() ?? "?"}> "${(target?.textContent ?? "").trim().slice(0, 30)}"`;
        }),
    );
    expect.soft(running, "animations still running after M").toEqual([]);
    const frozenA = await visualSignature(page);
    await page.waitForTimeout(800);
    const frozenB = await visualSignature(page);
    expect.soft(changedBetween(frozenA, frozenB), "elements still moving while paused").toEqual([]);

    await page.keyboard.press("m");
    const resumedAt = Date.now();
    await page.waitForTimeout(600);
    const resumed = await visualSignature(page);
    expect(changedBetween(frozenB, resumed).length, "motion did not resume after the second M").toBeGreaterThan(0);

    await waitUntil(page, resumedAt, REVEAL_DEADLINE_MS);
    expect(await unfinishedAnimations(page), "the reveal did not complete after resuming").toEqual([]);
  });
});

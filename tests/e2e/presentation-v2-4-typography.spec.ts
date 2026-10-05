/**
 * Presentation V2.4 typography.
 *
 * Sizes are measured in slide pixels (the 1920 x 1080 design canvas), so the rule holds at
 * every projected viewport: computed font size times the cumulative transform scale (SVG text
 * uses its screen CTM, which includes the viewBox), divided by the slide scale.
 *
 * - Every visible text run on a core slide renders at 12 px or larger.
 * - Standard slides (all but the full-bleed cover and closing) share one title size.
 * - No text is cut off by an ancestor that clips its overflow.
 */

import { expect, test, type Page } from "@playwright/test";

const DECK = "/story?deck=v2.4";
const PLAY_ORDER = Array.from({ length: 14 }, (_, i) => i + 1);
const STANDARD = PLAY_ORDER.filter((n) => n !== 1 && n !== 14);
const MIN_TEXT_PX = 12;

type TextRun = { text: string; px: number; clippedBy: string | null; box: string };

async function openSettledSlide(page: Page, n: number): Promise<void> {
  await page.goto(`${DECK}&core=${n}`, { waitUntil: "load" });
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

function textRuns(page: Page): Promise<TextRun[]> {
  return page.evaluate(() => {
    const slide = document.querySelector<HTMLElement>(".pv24-slide");
    if (!slide) return [];
    const slideBox = slide.getBoundingClientRect();
    const slideScale = slideBox.width / 1920;

    const scaleOf = (m: DOMMatrixReadOnly) => Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
    const cssScale = (el: Element): number => {
      let k = 1;
      for (let a: Element | null = el; a; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.transform && cs.transform !== "none") k *= scaleOf(new DOMMatrixReadOnly(cs.transform));
        if (cs.scale && cs.scale !== "none") {
          const [sx = 1, sy = sx] = cs.scale.split(/\s+/).map(Number);
          k *= Math.sqrt(Math.abs(sx * sy));
        }
        const zoom = Number(cs.zoom || "1");
        if (Number.isFinite(zoom) && zoom > 0) k *= zoom;
      }
      return k;
    };
    const slidePx = (el: Element): number => {
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (el instanceof SVGGraphicsElement) {
        const ctm = el.getScreenCTM();
        if (ctm) return (size * scaleOf(DOMMatrixReadOnly.fromMatrix(ctm))) / slideScale;
      }
      return (size * cssScale(el)) / slideScale;
    };
    const shown = (el: Element): boolean => {
      let opacity = 1;
      for (let a: Element | null = el; a; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.display === "none") return false;
        if (cs.clip && cs.clip !== "auto") return false;
        opacity *= Number(cs.opacity || "1");
      }
      return getComputedStyle(el).visibility === "visible" && opacity >= 0.05;
    };
    const describe = (el: Element): string => {
      const cls = typeof el.className === "string" ? el.className : el.getAttribute("class") ?? "";
      return `<${el.tagName.toLowerCase()}${cls ? `.${cls.split(/\s+/)[0]}` : ""}>`;
    };

    const runs: TextRun[] = [];
    const walker = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const node = n as Text;
      const value = node.textContent ?? "";
      const el = node.parentElement;
      if (!el || !value.trim() || el.closest("script, style, noscript, template, title, desc, defs")) continue;
      if (!shown(el)) continue;
      const range = document.createRange();
      range.setStart(node, value.search(/\S/));
      range.setEnd(node, value.trimEnd().length);
      const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0.5 && r.height > 0.5);
      if (rects.length === 0) continue;
      const px = slidePx(el);

      // Overflow clipping: every line must sit inside each clipping ancestor. The top allows for
      // the empty space above cap height inside the line box; the bottom allows only a sliver.
      const em = px * slideScale;
      const tolX = 2 * slideScale;
      const tolTop = 0.15 * em + slideScale;
      const tolBottom = 0.05 * em + slideScale;
      let clippedBy: string | null = null;
      for (let a: Element | null = el; a && !clippedBy; a = a === slide ? null : a.parentElement) {
        const cs = getComputedStyle(a);
        const clipX = cs.overflowX !== "visible";
        const clipY = cs.overflowY !== "visible";
        if (!clipX && !clipY) continue;
        const b = a.getBoundingClientRect();
        for (const r of rects) {
          const outX = clipX && (r.left < b.left - tolX || r.right > b.right + tolX);
          const outY = clipY && (r.top < b.top - tolTop || r.bottom > b.bottom + tolBottom);
          if (outX || outY) {
            clippedBy = describe(a);
            break;
          }
        }
      }
      const first = rects[0];
      runs.push({
        text: value.replace(/\s+/g, " ").trim().slice(0, 60),
        px: Math.round(px * 100) / 100,
        clippedBy,
        box: first
          ? `[${Math.round((first.left - slideBox.left) / slideScale)}, ${Math.round((first.top - slideBox.top) / slideScale)}]`
          : "",
      });
    }
    return runs;
  });
}

test.describe("Presentation V2.4 typography", () => {
  for (const n of PLAY_ORDER) {
    test(`core ${n}: text is at least ${MIN_TEXT_PX} px and never clipped`, async ({ page }) => {
      await openSettledSlide(page, n);
      const runs = await textRuns(page);
      expect(runs.length, `core ${n} shows no text`).toBeGreaterThan(0);

      const small = runs.filter((r) => r.px < MIN_TEXT_PX - 0.05).map((r) => `${r.px} px "${r.text}" at ${r.box}`);
      const clipped = runs.filter((r) => r.clippedBy !== null).map((r) => `"${r.text}" at ${r.box} clipped by ${r.clippedBy}`);
      expect.soft(small, `core ${n}: text below ${MIN_TEXT_PX} px in slide pixels`).toEqual([]);
      expect.soft(clipped, `core ${n}: text clipped by an overflow container`).toEqual([]);
    });
  }

  test("standard slides share one title size", async ({ page }) => {
    test.setTimeout(180_000);
    const sizes: Record<string, number[]> = {};
    for (const n of STANDARD) {
      await openSettledSlide(page, n);
      const px = await page.evaluate(() => {
        const slide = document.querySelector(".pv24-slide");
        const title = slide?.querySelector(".pv24-title");
        if (!slide || !title) return null;
        const slideScale = slide.getBoundingClientRect().width / 1920;
        let k = 1;
        for (let a: Element | null = title; a; a = a.parentElement) {
          const t = getComputedStyle(a).transform;
          if (t && t !== "none") {
            const m = new DOMMatrixReadOnly(t);
            k *= Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
          }
        }
        return Math.round(((parseFloat(getComputedStyle(title).fontSize) * k) / slideScale) * 10) / 10;
      });
      expect.soft(px, `core ${n} has no .pv24-title`).not.toBeNull();
      if (px !== null) (sizes[String(px)] ??= []).push(n);
    }
    expect(Object.keys(sizes).length, `title sizes by slide: ${JSON.stringify(sizes)}`).toBe(1);
  });
});

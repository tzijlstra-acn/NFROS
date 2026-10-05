/**
 * Presentation V2.4 exhibit integrity.
 *
 * Every core slide renders its exhibit, nothing in the exhibit (text or painted boxes) leaves
 * the visible frame (`.pv24-exhibit` intersected with `.pv24-exhibit-area`), no two text runs
 * overlap anywhere on the slide, and no slide logs a console error or throws.
 *
 * Checked twice: on the live deck once the reveal has settled, and in export mode, because
 * some exhibits draw extra elements (icons, particles) only while motion is on.
 */

import { expect, test, type Page } from "@playwright/test";

const DECK = "/story?deck=v2.4";
const PLAY_ORDER = Array.from({ length: 14 }, (_, i) => i + 1);
const FULL_BLEED = new Set([1, 14]);

type LayoutReport = {
  hasExhibit: boolean;
  exhibitText: number;
  placeholder: boolean;
  title: string;
  outside: string[];
  overlaps: string[];
};

async function openSlide(page: Page, url: string): Promise<void> {
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
}

/** Waits for every finite animation to end, then lets motion commit its final frame. */
async function settle(page: Page, timeout = 10_000): Promise<void> {
  await page
    .waitForFunction(
      () =>
        document.getAnimations().every((a) => {
          const iterations = a.effect?.getTiming().iterations ?? 1;
          return !Number.isFinite(iterations) || a.playState !== "running";
        }),
      null,
      { timeout },
    )
    .catch(() => undefined);
  await page.waitForTimeout(500);
}

function layoutReport(page: Page, fullBleed: boolean): Promise<LayoutReport> {
  return page.evaluate((isFullBleed) => {
    type Box = { left: number; top: number; right: number; bottom: number };
    const slide = document.querySelector<HTMLElement>(".pv24-slide");
    const empty: LayoutReport = { hasExhibit: false, exhibitText: 0, placeholder: false, title: "", outside: [], overlaps: [] };
    if (!slide) return empty;
    const slideBox = slide.getBoundingClientRect();
    const scale = slideBox.width / 1920;
    const tol = 2 * scale;

    const box = (r: DOMRect | Box): Box => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    const intersect = (a: Box, b: Box): Box => ({
      left: Math.max(a.left, b.left),
      top: Math.max(a.top, b.top),
      right: Math.min(a.right, b.right),
      bottom: Math.min(a.bottom, b.bottom),
    });
    const isEmpty = (b: Box) => b.right - b.left <= 0.5 || b.bottom - b.top <= 0.5;
    const contains = (outer: Box, inner: Box, t: number) =>
      inner.left >= outer.left - t && inner.top >= outer.top - t && inner.right <= outer.right + t && inner.bottom <= outer.bottom + t;
    const toSlide = (b: Box) =>
      `[${Math.round((b.left - slideBox.left) / scale)}, ${Math.round((b.top - slideBox.top) / scale)}, ${Math.round(
        (b.right - slideBox.left) / scale,
      )}, ${Math.round((b.bottom - slideBox.top) / scale)}]`;
    const label = (el: Element): string => {
      const cls = typeof el.className === "string" ? el.className : el.getAttribute("class") ?? "";
      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 50);
      return `<${el.tagName.toLowerCase()}${cls ? ` class="${cls.slice(0, 40)}"` : ""}>${text ? ` "${text}"` : ""}`;
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

    const textRects = (node: Text): DOMRect[] => {
      const value = node.textContent ?? "";
      const start = value.search(/\S/);
      if (start < 0) return [];
      const end = value.length - (value.length - value.trimEnd().length);
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, end);
      return Array.from(range.getClientRects()).filter((r) => r.width > 0.5 && r.height > 0.5);
    };

    const textNodes = (root: Element): Array<{ node: Text; el: Element; rects: DOMRect[] }> => {
      const out: Array<{ node: Text; el: Element; rects: DOMRect[] }> = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const node = n as Text;
        const el = node.parentElement;
        if (!el || el.closest("script, style, noscript, template, title, desc, defs")) continue;
        if (!(node.textContent ?? "").trim() || !shown(el)) continue;
        const rects = textRects(node);
        if (rects.length > 0) out.push({ node, el, rects });
      }
      return out;
    };

    const title = (slide.querySelector("h1")?.textContent ?? "").trim();
    const placeholder = slide.querySelector(".pv24-exhibit-placeholder") !== null;
    const exhibit = slide.querySelector(".pv24-exhibit");
    const area = slide.querySelector(".pv24-exhibit-area");

    let frame: Box;
    let scope: Element;
    if (isFullBleed) {
      frame = box(slideBox);
      scope = slide;
    } else {
      if (!exhibit || !area) return { ...empty, title, placeholder };
      frame = intersect(box(exhibit.getBoundingClientRect()), box(area.getBoundingClientRect()));
      scope = exhibit;
    }

    // Clipping containers smaller than the frame really bound their content; a container
    // that covers the whole frame (exhibit root, 16:9 ratio box) clips at the frame edge.
    const visibleBox = (el: Element, rect: Box): Box => {
      let out = rect;
      for (let a = el.parentElement; a && a !== scope; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
        const clip = box(a.getBoundingClientRect());
        if (contains(clip, frame, tol)) continue;
        out = intersect(out, clip);
      }
      return out;
    };

    const outside: string[] = [];
    const exhibitTexts = textNodes(scope);
    for (const t of exhibitTexts) {
      for (const r of t.rects) {
        const vis = visibleBox(t.el, box(r));
        if (isEmpty(vis)) continue;
        if (!contains(frame, vis, tol)) {
          outside.push(`text ${label(t.el)} at ${toSlide(vis)} outside frame ${toSlide(frame)}`);
          break;
        }
      }
    }

    const SHAPES = "rect, circle, ellipse, line, path, polygon, polyline, image, use";
    const alpha = (color: string): number => {
      if (!color || color === "transparent") return 0;
      const m = /rgba?\(([^)]+)\)/.exec(color);
      if (!m?.[1]) return 1;
      const parts = m[1].split(/[\s,/]+/).filter(Boolean);
      return parts.length >= 4 ? Number(parts[3]) : 1;
    };
    const paints = (el: Element): boolean => {
      const cs = getComputedStyle(el);
      if (el instanceof SVGElement) {
        if (el.closest("defs, marker, clipPath, mask, pattern, symbol")) return false;
        if (!el.matches(SHAPES)) return false;
        const fill = cs.fill !== "none" && Number(cs.fillOpacity || "1") > 0.05 && alpha(cs.fill) > 0.05;
        const stroke = cs.stroke !== "none" && parseFloat(cs.strokeWidth || "0") > 0 && Number(cs.strokeOpacity || "1") > 0.05;
        return fill || stroke;
      }
      if (el.matches("img, video, canvas, iframe")) return true;
      if (alpha(cs.backgroundColor) > 0.05 || cs.backgroundImage !== "none") return true;
      return (["Top", "Right", "Bottom", "Left"] as const).some(
        (side) =>
          parseFloat(cs.getPropertyValue(`border-${side.toLowerCase()}-width`)) > 0 &&
          cs.getPropertyValue(`border-${side.toLowerCase()}-style`) !== "none" &&
          alpha(cs.getPropertyValue(`border-${side.toLowerCase()}-color`)) > 0.05,
      );
    };

    // Full-bleed slides may bleed decorative SVG geometry off the edge by design
    for (const el of Array.from(scope.querySelectorAll("*"))) {
      if (isFullBleed && el instanceof SVGElement) continue;
      if (!paints(el) || !shown(el)) continue;
      const rect = box(el.getBoundingClientRect());
      if (isEmpty(rect) || contains(rect, frame, tol)) continue;
      const vis = visibleBox(el, rect);
      if (isEmpty(vis)) continue;
      if (!contains(frame, vis, tol)) outside.push(`box ${label(el)} at ${toSlide(vis)} outside frame ${toSlide(frame)}`);
    }

    // Overlap: compare the glyph band of every text run (line box minus 20% top and bottom)
    const all = textNodes(slide).map((t) => ({
      el: t.el,
      bands: t.rects.map((r) => {
        const inset = r.height * 0.2;
        return { left: r.left, right: r.right, top: r.top + inset, bottom: r.bottom - inset };
      }),
    }));
    const overlaps: string[] = [];
    const minArea = 4 * scale * scale;
    for (let i = 0; i < all.length; i++) {
      const a = all[i];
      if (!a) continue;
      for (let j = i + 1; j < all.length; j++) {
        const b = all[j];
        if (!b) continue;
        let hit: Box | null = null;
        for (const ra of a.bands) {
          for (const rb of b.bands) {
            const x = intersect(ra, rb);
            if (!isEmpty(x) && (x.right - x.left) * (x.bottom - x.top) > minArea) hit = x;
          }
        }
        if (hit) overlaps.push(`${label(a.el)} overlaps ${label(b.el)} at ${toSlide(hit)}`);
      }
    }

    return {
      hasExhibit: isFullBleed ? title.length > 0 : !isEmpty(frame),
      exhibitText: exhibitTexts.length,
      placeholder,
      title,
      outside,
      overlaps,
    };
  }, fullBleed);
}

function expectCleanLayout(report: LayoutReport, n: number): void {
  expect(report.placeholder, `core ${n} still renders the exhibit placeholder`).toBe(false);
  expect(report.hasExhibit, `core ${n} renders no exhibit frame`).toBe(true);
  expect(report.exhibitText, `core ${n} exhibit shows no visible text`).toBeGreaterThan(0);
  expect.soft(report.outside, `core ${n}: exhibit content outside the visible frame`).toEqual([]);
  expect.soft(report.overlaps, `core ${n}: overlapping text`).toEqual([]);
}

test.describe("Presentation V2.4 exhibits, live deck after the reveal", () => {
  test.use({ reducedMotion: "no-preference" });

  for (const n of PLAY_ORDER) {
    test(`core ${n}: exhibit renders inside its frame without errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(`console: ${msg.text().slice(0, 300)}`);
      });
      page.on("pageerror", (err) => errors.push(`pageerror: ${err.message.slice(0, 300)}`));

      await openSlide(page, `${DECK}&core=${n}`);
      await settle(page);
      expectCleanLayout(await layoutReport(page, FULL_BLEED.has(n)), n);
      expect(errors, `core ${n}: console or page errors`).toEqual([]);
    });
  }
});

test.describe("Presentation V2.4 exhibits, export mode", () => {
  for (const n of PLAY_ORDER) {
    test(`core ${n}: final state stays inside its frame`, async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(`console: ${msg.text().slice(0, 300)}`);
      });
      page.on("pageerror", (err) => errors.push(`pageerror: ${err.message.slice(0, 300)}`));

      await openSlide(page, `${DECK}&core=${n}&export=1&safe=1`);
      await settle(page, 3_000);
      expectCleanLayout(await layoutReport(page, FULL_BLEED.has(n)), n);
      expect(errors, `core ${n}: console or page errors in export mode`).toEqual([]);
    });
  }
});

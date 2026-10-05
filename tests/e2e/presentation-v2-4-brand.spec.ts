/**
 * Presentation V2.4 brand rules, on every slide the audience can reach.
 *
 * - Visible text (including CSS generated content) carries no em dash, en dash or spaced
 *   double hyphen, and no arrow glyphs or ">" style markers.
 * - Every slide shows "Synthetic institution and data".
 * - Standard slides sit on a light background; the cover and closing slides are full-bleed
 *   brand purple by design.
 *
 * Appendix slides come from the page's `script[data-presentation-slides]` manifest.
 */

import { inflateSync } from "node:zlib";
import { expect, test, type Page } from "@playwright/test";

const DECK = "/story?deck=v2.4";
const PLAY_ORDER = Array.from({ length: 14 }, (_, i) => i + 1);
const FULL_BLEED = new Set([1, 14]);
const SYNTHETIC_LABEL = "Synthetic institution and data";

const PUNCTUATION: Array<[string, RegExp]> = [
  ["em dash", /\u2014/],
  ["en dash", /\u2013/],
  ["double hyphen", /(^|\s)--(\s|$)/],
];
const MARKERS: Array<[string, RegExp]> = [
  ["arrow glyph", /[\u2190-\u21FF\u2794-\u27BF\u27F0-\u27FF\u2900-\u297F]/],
  ["angle quote marker", /[\u2039\u203A\u00AB\u00BB]/],
  ["triangle marker", /[\u25B6\u25B8\u25BA\u25B9\u25BB]/],
  ["greater-than marker", /^\s*>|\s>\s|->|=>|>\s*$/],
];

type ManifestEntry = { kind?: string; type?: string; id?: string; key?: string; url?: string };

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
  await page.waitForTimeout(200);
}

/** Visible text on the slide: text nodes plus ::before and ::after content. */
function visibleText(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const slide = document.querySelector(".pv24-slide");
    if (!slide) return [];
    const slideBox = slide.getBoundingClientRect();
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
    const onSlide = (r: DOMRect) =>
      r.width > 0.5 && r.height > 0.5 && r.right > slideBox.left && r.left < slideBox.right && r.bottom > slideBox.top && r.top < slideBox.bottom;

    const out: string[] = [];
    const walker = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const value = n.textContent ?? "";
      const el = n.parentElement;
      if (!el || !value.trim() || el.closest("script, style, noscript, template, title, desc, defs")) continue;
      if (!shown(el)) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      if (!Array.from(range.getClientRects()).some(onSlide)) continue;
      out.push(value.replace(/\s+/g, " ").trim());
    }
    for (const el of Array.from(slide.querySelectorAll("*"))) {
      if (!shown(el)) continue;
      for (const pseudo of ["::before", "::after"]) {
        const cs = getComputedStyle(el, pseudo);
        if (cs.display === "none" || !cs.content || cs.content === "none" || cs.content === "normal") continue;
        for (const m of cs.content.matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
          if (m[1]?.trim()) out.push(`${m[1]} (${pseudo} of <${el.tagName.toLowerCase()}>)`);
        }
      }
    }
    return out;
  });
}

// Minimal PNG reader for Playwright screenshots (8-bit RGB or RGBA, not interlaced)
function decodePng(buf: Buffer): { width: number; height: number; channels: number; pixels: Uint8Array } {
  let pos = 8;
  let width = 0;
  let height = 0;
  let channels = 4;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[12] !== 0) throw new Error("Unsupported PNG layout");
      channels = data[9] === 6 ? 4 : data[9] === 2 ? 3 : 0;
      if (channels === 0) throw new Error(`Unsupported PNG colour type ${data[9]}`);
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)] ?? 0;
    const src = y * (stride + 1) + 1;
    const row = y * stride;
    for (let x = 0; x < stride; x++) {
      const value = raw[src + x] ?? 0;
      const left = x >= channels ? pixels[row + x - channels] ?? 0 : 0;
      const up = y > 0 ? pixels[row - stride + x] ?? 0 : 0;
      const upLeft = y > 0 && x >= channels ? pixels[row - stride + x - channels] ?? 0 : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      pixels[row + x] = (value + predictor) & 0xff;
    }
  }
  return { width, height, channels, pixels };
}

type BackgroundStats = { medianLuminance: number; lightShare: number; mean: [number, number, number] };

async function backgroundStats(page: Page): Promise<BackgroundStats> {
  const png = await page.locator(".pv24-slide").first().screenshot();
  const { width, height, channels, pixels } = decodePng(png);
  const linear = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const lum: number[] = [];
  const sum: [number, number, number] = [0, 0, 0];
  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 4) {
      const i = (y * width + x) * channels;
      const r = pixels[i] ?? 0;
      const g = pixels[i + 1] ?? 0;
      const b = pixels[i + 2] ?? 0;
      sum[0] += r;
      sum[1] += g;
      sum[2] += b;
      lum.push(0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b));
    }
  }
  lum.sort((a, b) => a - b);
  const count = lum.length || 1;
  return {
    medianLuminance: lum[Math.floor(lum.length / 2)] ?? 0,
    lightShare: lum.filter((l) => l >= 0.7).length / count,
    mean: [sum[0] / count, sum[1] / count, sum[2] / count],
  };
}

async function brandProblems(page: Page, fullBleed: boolean): Promise<string[]> {
  const problems: string[] = [];
  const texts = await visibleText(page);
  for (const text of texts) {
    for (const [name, pattern] of [...PUNCTUATION, ...MARKERS]) {
      if (pattern.test(text)) problems.push(`${name} in "${text.slice(0, 80)}"`);
    }
  }
  if (!texts.some((t) => t.includes(SYNTHETIC_LABEL))) problems.push(`"${SYNTHETIC_LABEL}" is not visible`);

  const bg = await backgroundStats(page);
  const [r, g, b] = bg.mean.map((v) => Math.round(v));
  if (fullBleed) {
    const purple = (r ?? 0) > (g ?? 0) * 1.3 && (b ?? 0) > (g ?? 0) * 1.6;
    if (bg.medianLuminance > 0.2 || !purple) {
      problems.push(`full-bleed slide is not brand purple (median luminance ${bg.medianLuminance.toFixed(2)}, mean rgb ${r} ${g} ${b})`);
    }
  } else if (bg.medianLuminance < 0.75 || bg.lightShare < 0.6) {
    problems.push(
      `background is not light (median luminance ${bg.medianLuminance.toFixed(2)}, ${Math.round(bg.lightShare * 100)}% light pixels)`,
    );
  }
  return problems;
}

test.describe("Presentation V2.4 brand rules", () => {
  for (const n of PLAY_ORDER) {
    test(`core ${n}: punctuation, synthetic label and background`, async ({ page }) => {
      await openSlide(page, `${DECK}&core=${n}`);
      expect(await brandProblems(page, FULL_BLEED.has(n)), `core ${n} brand problems`).toEqual([]);
    });
  }

  test("appendix slides: punctuation, synthetic label and background", async ({ page }) => {
    test.setTimeout(400_000);
    await openSlide(page, `${DECK}&view=appendix-index`);
    const manifest = await page.evaluate((): ManifestEntry[] | null => {
      const el = document.querySelector("script[data-presentation-slides]");
      if (!el) return null;
      try {
        const parsed: unknown = JSON.parse(el.textContent || el.getAttribute("data-presentation-slides") || "null");
        return Array.isArray(parsed) ? (parsed as ManifestEntry[]) : null;
      } catch {
        return null;
      }
    });
    if (manifest === null) {
      test.skip(true, "The deck exposes no script[data-presentation-slides] manifest, so the appendix slide list is unknown");
      return;
    }

    const entries = manifest.filter((e) => {
      const kind = e.kind ?? e.type;
      return kind === "appendix" || kind === "appendix-index";
    });
    expect(entries.length, "the manifest lists no appendix slides").toBeGreaterThan(0);

    const failures: string[] = [];
    for (const entry of entries) {
      const name = entry.id ?? entry.key ?? "appendix";
      const url = entry.url ?? (entry.id ? `${DECK}&appendix=${entry.id}` : null);
      if (!url) {
        failures.push(`${name}: manifest entry has no url`);
        continue;
      }
      await openSlide(page, url);
      for (const problem of await brandProblems(page, false)) failures.push(`${name}: ${problem}`);
    }
    expect(failures, `appendix brand problems across ${entries.length} slides`).toEqual([]);
  });
});

/**
 * Presentation V2.4 product proof.
 *
 * The slides that claim to show the product (6 workday, 7 role architecture, 8 Role Apps,
 * 10 evidence thread) must render at least one `[data-product-capture]` figure, none marked
 * `data-capture-missing="true"`, display at least one loaded image from
 * /presentation-assets/v2.4-final/, show no placeholder image, and every image they reference
 * must exist on the server.
 */

import { expect, test, type Page } from "@playwright/test";

const DECK = "/story?deck=v2.4";
const PROOF_SLIDES = [6, 7, 8, 10];
const ASSET_ROOT = "/presentation-assets/v2.4-final/";

type SlideImage = { src: string; currentSrc: string; naturalWidth: number };

/** The served file behind an image src, unwrapping the next/image optimiser URL. */
function assetPath(src: string): string {
  const url = new URL(src, "http://deck.local");
  const inner = url.pathname === "/_next/image" ? url.searchParams.get("url") : null;
  return decodeURIComponent(inner ? new URL(inner, "http://deck.local").pathname : url.pathname);
}

async function openSlide(page: Page, n: number): Promise<void> {
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
    .waitForFunction(() => Array.from(document.querySelectorAll<HTMLImageElement>(".pv24-slide img")).every((img) => img.complete), null, {
      timeout: 15_000,
    })
    .catch(() => undefined);
}

for (const n of PROOF_SLIDES) {
  test(`core ${n}: shows a loaded product capture from ${ASSET_ROOT}`, async ({ page }) => {
    await openSlide(page, n);
    const figures = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".pv24-slide [data-product-capture]")).map((f) => ({
        id: f.getAttribute("data-product-capture") ?? "",
        missing: f.getAttribute("data-capture-missing") === "true",
      })),
    );
    expect(figures.length, `core ${n} has no [data-product-capture] figure`).toBeGreaterThan(0);
    expect(
      figures.filter((f) => f.missing).map((f) => f.id),
      `core ${n} shows captures marked data-capture-missing`,
    ).toEqual([]);

    const images: SlideImage[] = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLImageElement>(".pv24-slide img")).map((img) => ({
        src: img.getAttribute("src") ?? "",
        currentSrc: img.currentSrc,
        naturalWidth: img.naturalWidth,
      })),
    );
    const listing = images.map((i) => `${assetPath(i.src)} (naturalWidth ${i.naturalWidth})`).join(", ") || "none";

    const proof = images.filter((i) => assetPath(i.src).includes(ASSET_ROOT) && i.naturalWidth > 0);
    expect(proof.length, `core ${n} shows no loaded capture from ${ASSET_ROOT}; images on the slide: ${listing}`).toBeGreaterThan(0);

    const placeholders = images.filter((i) => /placeholder/i.test(`${assetPath(i.src)} ${i.currentSrc}`));
    expect(placeholders.map((i) => assetPath(i.src)), `core ${n} shows placeholder images`).toEqual([]);

    const missing: string[] = [];
    for (const file of new Set(images.map((i) => assetPath(i.src)).filter((p) => p.startsWith("/")))) {
      const response = await page.request.get(file);
      if (response.status() !== 200) missing.push(`${file} returned ${response.status()}`);
    }
    expect(missing, `core ${n} references images that do not exist`).toEqual([]);
  });
}

import { unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Browser } from "@playwright/test";

export interface MontageTile {
  file: string;
  number: string;
  section: string;
  title: string;
}

const COLS = 4;
const TILE_W = 460;
const GAP = 24;
const PAD = 40;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Renders a labelled grid of slide images (all in `imageDir`) and saves it as a PNG. */
export async function renderMontage(
  browser: Browser,
  imageDir: string,
  tiles: readonly MontageTile[],
  heading: string,
  subheading: string,
  outputPath: string,
): Promise<void> {
  const figures = tiles
    .map(
      (t) => `<figure><img src="${esc(t.file)}" alt=""/><figcaption><span class="sec">${esc(t.section)}</span><span class="num">${esc(t.number)}</span>${esc(t.title)}</figcaption></figure>`,
    )
    .join("");
  const width = PAD * 2 + COLS * TILE_W + (COLS - 1) * GAP;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
html,body{margin:0;background:#F5F6F8;color:#1A1A1A;font-family:Arial,Helvetica,sans-serif}
.wrap{padding:${PAD}px;width:${width - PAD * 2}px}
h1{font-size:28px;margin:0 0 6px}
p.sub{margin:0 0 28px;color:#4A4A4A;font-size:16px}
.grid{display:grid;grid-template-columns:repeat(${COLS},${TILE_W}px);gap:28px ${GAP}px}
figure{margin:0;background:#FFFFFF;border:1px solid #D5D8DE}
img{display:block;width:${TILE_W}px;height:${(TILE_W * 9) / 16}px;border-bottom:1px solid #D5D8DE}
figcaption{padding:10px 12px 12px;font-size:14px;line-height:1.35}
.sec{display:block;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#5A5A5A;margin-bottom:4px}
.num{font-weight:700;color:#7500C0;margin-right:8px}
</style></head><body><div class="wrap"><h1>${esc(heading)}</h1><p class="sub">${esc(subheading)}</p><div class="grid">${figures}</div></div></body></html>`;

  const htmlPath = join(imageDir, "_montage.html");
  writeFileSync(htmlPath, html, "utf8");
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  try {
    await page.goto(pathToFileURL(htmlPath).toString(), { waitUntil: "load" });
    await page.evaluate(async () => {
      await Promise.all(Array.from(document.images).map((img) => img.decode().catch(() => undefined)));
    });
    const broken = await page.evaluate(() => Array.from(document.images).filter((img) => img.naturalWidth === 0).length);
    if (broken > 0) throw new Error(`${broken} montage image(s) failed to load.`);
    await page.screenshot({ path: outputPath, fullPage: true });
  } finally {
    await page.close();
    unlinkSync(htmlPath);
  }
}

// Renders public/brand/favicon.svg into a Windows icon (PNG entries at 256, 48, 32 and 16 px)
// for the desktop launcher. Run once: node scripts/launcher/make-icon.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const require = createRequire(join(root, "package.json"));
const { chromium } = require("playwright");

const svg = readFileSync(join(root, "public", "brand", "favicon.svg"), "utf8");
const sizes = [256, 48, 32, 16];
const browser = await chromium.launch();
const page = await browser.newPage();
const images = [];
for (const size of sizes) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg.replace("<svg ", `<svg style="display:block;width:${size}px;height:${size}px" `)}</body></html>`,
  );
  images.push(await page.screenshot({ omitBackground: true }));
}
await browser.close();

// ICO container: header, one directory entry per image, then the PNG data
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = 6 + 16 * images.length;
const entries = images.map((png, i) => {
  const entry = Buffer.alloc(16);
  const size = sizes[i];
  entry.writeUInt8(size >= 256 ? 0 : size, 0);
  entry.writeUInt8(size >= 256 ? 0 : size, 1);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += png.length;
  return entry;
});
const out = join(here, "nfros.ico");
writeFileSync(out, Buffer.concat([header, ...entries, ...images]));
console.log(`icon written: ${out}`);

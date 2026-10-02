/**
 * generate-placeholder-assets.ts
 *
 * Creates placeholder PNG files for every asset in the V2.3 asset registry.
 * Uses pure Node.js (zlib) — no canvas or sharp dependency required.
 *
 * Usage: npm run generate:placeholder-assets
 */

import { deflateSync } from "zlib";
import { writeFileSync, mkdirSync, existsSync, statSync, readFileSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { ASSET_REGISTRY, ASSET_DIR, ASSET_VERSION } from "../src/presentation-v2-3/product-proof/asset-registry";

/* --------------------------------------------------------------------------
   Minimal valid PNG writer (pure Node.js, no deps)
   -------------------------------------------------------------------------- */

function uint32BE(n: number): Buffer {
  const buf = Buffer.allocUnsafe(4);
  buf.writeUInt32BE(n, 0);
  return buf;
}

function crc32(data: Buffer): number {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (const byte of data) crc = (table[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const crcInput = Buffer.concat([typeBytes, data]);
  return Buffer.concat([uint32BE(data.length), typeBytes, data, uint32BE(crc32(crcInput))]);
}

function createPlaceholderPng(w: number, h: number, bgR = 245, bgG = 246, bgB = 248): Buffer {
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB truecolor
  // ihdr[10..12] are compression/filter/interlace, default 0

  // IDAT: filter byte 0 (None) + RGB pixels per scanline
  const scanline = Buffer.alloc(1 + w * 3);
  scanline[0] = 0; // filter: None
  for (let x = 0; x < w; x++) {
    scanline[1 + x * 3] = bgR;
    scanline[2 + x * 3] = bgG;
    scanline[3 + x * 3] = bgB;
  }
  const rows: Buffer[] = [];
  for (let y = 0; y < h; y++) rows.push(scanline);
  const raw = Buffer.concat(rows);
  const compressed = deflateSync(raw);

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // PNG signature
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/* --------------------------------------------------------------------------
   Main
   -------------------------------------------------------------------------- */

const ROOT = process.cwd();
const outDir = join(ROOT, ASSET_DIR);

if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
  console.log(`Created directory: ${ASSET_DIR}`);
}

type ManifestEntry = {
  id: string;
  file: string;
  placeholder: boolean;
  width: number;
  height: number;
  sizeBytes: number;
  sha256: string;
  generatedAt: string;
};

const manifest: { version: string; generatedAt: string; assets: ManifestEntry[] } = {
  version: ASSET_VERSION,
  generatedAt: new Date().toISOString(),
  assets: [],
};

let created = 0;
let skipped = 0;

for (const asset of ASSET_REGISTRY) {
  const outFile = join(outDir, asset.file);

  if (existsSync(outFile)) {
    console.log(`  skip  ${asset.file} (already exists)`);
    skipped++;

    // Still include in manifest
    const stat = statSync(outFile);
    const sha256 = createHash("sha256").update(readFileSync(outFile)).digest("hex");
    manifest.assets.push({
      id: asset.id,
      file: asset.file,
      placeholder: true,
      width: asset.width,
      height: asset.height,
      sizeBytes: stat.size,
      sha256,
      generatedAt: new Date().toISOString(),
    });
    continue;
  }

  const png = createPlaceholderPng(asset.width, asset.height, 245, 246, 248);
  writeFileSync(outFile, png);

  const sha256 = createHash("sha256").update(png).digest("hex");
  manifest.assets.push({
    id: asset.id,
    file: asset.file,
    placeholder: true,
    width: asset.width,
    height: asset.height,
    sizeBytes: png.length,
    sha256,
    generatedAt: new Date().toISOString(),
  });

  console.log(`  write ${asset.file} (${(png.length / 1024).toFixed(1)} KB)`);
  created++;
}

// Write manifest
const manifestPath = join(outDir, "manifest.json");
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`\nWrote manifest.json`);
console.log(`\nDone: ${created} created, ${skipped} skipped (${ASSET_REGISTRY.length} total)`);

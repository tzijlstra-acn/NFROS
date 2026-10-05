// Node only. Minimal PNG reader for capture and verify checks (8-bit, non-interlaced).

import { inflateSync } from "node:zlib";

export const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export type PngHeader = {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  interlace: number;
};

export type PngStats = PngHeader & {
  meanLuminance: number;
  luminanceStdDev: number;
  distinctColors: number;
  /** Most frequent colour on the outer border, as #rrggbb. */
  borderColor: string;
};

export function hasPngSignature(buf: Buffer): boolean {
  return buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIGNATURE);
}

export function readPngHeader(buf: Buffer): PngHeader {
  if (!hasPngSignature(buf)) throw new Error("Not a PNG: signature mismatch");
  if (buf.subarray(12, 16).toString("ascii") !== "IHDR") throw new Error("PNG has no IHDR chunk");
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bitDepth: buf.readUInt8(24),
    colorType: buf.readUInt8(25),
    interlace: buf.readUInt8(28),
  };
}

const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 4: 2, 6: 4 };

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/** Decodes to raw scanlines without filter bytes. */
function decodePixels(buf: Buffer, header: PngHeader): { data: Buffer; channels: number } {
  const channels = CHANNELS[header.colorType];
  if (header.bitDepth !== 8 || channels === undefined || header.interlace !== 0) {
    throw new Error(
      `Unsupported PNG layout (bitDepth ${header.bitDepth}, colorType ${header.colorType}, interlace ${header.interlace})`,
    );
  }
  const idat: Buffer[] = [];
  let offset = 8;
  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString("ascii");
    if (type === "IDAT") idat.push(buf.subarray(offset + 8, offset + 8 + length));
    if (type === "IEND") break;
    offset += 12 + length;
  }
  const inflated = inflateSync(Buffer.concat(idat));
  const stride = header.width * channels;
  const out = Buffer.alloc(stride * header.height);
  for (let y = 0; y < header.height; y++) {
    const filter = inflated[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const raw = inflated[src + x] ?? 0;
      const left = x >= channels ? (out[dst + x - channels] ?? 0) : 0;
      const up = y > 0 ? (out[dst - stride + x] ?? 0) : 0;
      const upLeft = y > 0 && x >= channels ? (out[dst - stride + x - channels] ?? 0) : 0;
      let value: number;
      switch (filter) {
        case 0:
          value = raw;
          break;
        case 1:
          value = raw + left;
          break;
        case 2:
          value = raw + up;
          break;
        case 3:
          value = raw + ((left + up) >> 1);
          break;
        case 4:
          value = raw + paeth(left, up, upLeft);
          break;
        default:
          throw new Error(`Unknown PNG filter ${String(filter)} on row ${y}`);
      }
      out[dst + x] = value & 0xff;
    }
  }
  return { data: out, channels };
}

export function computePngStats(buf: Buffer): PngStats {
  const header = readPngHeader(buf);
  const { data, channels } = decodePixels(buf, header);
  const pixels = header.width * header.height;
  let sum = 0;
  let sumSq = 0;
  const colors = new Set<number>();
  for (let i = 0; i < pixels; i++) {
    const o = i * channels;
    const r = data[o] ?? 0;
    const g = channels >= 3 ? (data[o + 1] ?? 0) : r;
    const b = channels >= 3 ? (data[o + 2] ?? 0) : r;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sum += lum;
    sumSq += lum * lum;
    if (i % 7 === 0 && colors.size < 5000) colors.add((r << 16) | (g << 8) | b);
  }
  const mean = sum / pixels;
  const variance = Math.max(0, sumSq / pixels - mean * mean);

  const border = new Map<number, number>();
  const tally = (x: number, y: number) => {
    const o = (y * header.width + x) * channels;
    const r = data[o] ?? 0;
    const g = channels >= 3 ? (data[o + 1] ?? 0) : r;
    const b = channels >= 3 ? (data[o + 2] ?? 0) : r;
    const key = (r << 16) | (g << 8) | b;
    border.set(key, (border.get(key) ?? 0) + 1);
  };
  for (let x = 0; x < header.width; x++) {
    tally(x, 0);
    tally(x, header.height - 1);
  }
  for (let y = 0; y < header.height; y++) {
    tally(0, y);
    tally(header.width - 1, y);
  }
  let modeKey = 0xffffff;
  let modeCount = -1;
  for (const [key, count] of border) {
    if (count > modeCount) {
      modeKey = key;
      modeCount = count;
    }
  }

  return {
    ...header,
    meanLuminance: mean,
    luminanceStdDev: Math.sqrt(variance),
    distinctColors: colors.size,
    borderColor: `#${modeKey.toString(16).padStart(6, "0")}`,
  };
}

/** Thresholds shared by capture and verify. */
export const IMAGE_QUALITY_V24 = {
  minBytes: 30 * 1024,
  minLuminanceStdDev: 6,
  minDistinctColors: 24,
  minLightMeanLuminance: 150,
} as const;

/** Returns problems with an image, or an empty list when it is a real capture. */
export function imageProblems(stats: PngStats, bytes: number, expectLight: boolean): string[] {
  const problems: string[] = [];
  if (bytes < IMAGE_QUALITY_V24.minBytes) {
    problems.push(`file is ${bytes} bytes, below ${IMAGE_QUALITY_V24.minBytes}`);
  }
  if (stats.luminanceStdDev < IMAGE_QUALITY_V24.minLuminanceStdDev) {
    problems.push(`image looks blank (luminance std dev ${stats.luminanceStdDev.toFixed(2)})`);
  }
  if (stats.distinctColors < IMAGE_QUALITY_V24.minDistinctColors) {
    problems.push(`image looks like a placeholder (${stats.distinctColors} distinct colours)`);
  }
  if (expectLight && stats.meanLuminance < IMAGE_QUALITY_V24.minLightMeanLuminance) {
    problems.push(`image is dark (mean luminance ${stats.meanLuminance.toFixed(1)}); expected the light theme`);
  }
  return problems;
}

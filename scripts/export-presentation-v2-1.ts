/**
 * Export pipeline for NFROS Risk Audience Presentation V2.1.
 *
 * Produces:
 *   exports/NFROS_Risk_Audience_Core.pdf               (13 core slides)
 *   exports/NFROS_Risk_Audience_Core_and_Appendix.pdf  (36 slides: 13 core + 23 appendix)
 *   exports/NFROS_Risk_Audience_Core_and_Appendix.pptx
 *   exports/NFROS_Risk_Audience_Speaker_Notes.md
 *   exports/NFROS_Risk_Audience_Export_Hash.txt
 *   exports/NFROS_Risk_Audience_Export_Metadata.json
 *
 * Then copies the two PDFs and metadata JSON to public/downloads/.
 *
 * Run with: npm run export:presentation
 */

import { chromium, type Browser, type Page } from "@playwright/test";
import PptxGenJS from "pptxgenjs";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  unlinkSync,
  copyFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { spawn, type ChildProcess, execSync } from "node:child_process";
import { createHash } from "node:crypto";

import { CORE_SLIDES } from "../src/presentation-v2-1/data/core-story";
import { APPENDIX_SLIDES } from "../src/presentation-v2-1/data/appendix";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const WIDTH = 1920;
const HEIGHT = 1080;
const BASE_URL = process.env.NFR_BASE_URL ?? "http://localhost:3000";
const EXPORT_DIR = resolve(process.cwd(), "exports");
const SLIDE_DIR = join(EXPORT_DIR, "slides-v2-1");
const DOWNLOADS_DIR = resolve(process.cwd(), "public", "downloads");

const CORE_SLIDE_COUNT = CORE_SLIDES.length; // 13
const APPENDIX_SLIDE_COUNT = APPENDIX_SLIDES.length; // 23

const CORE_PDF_NAME = "NFROS_Risk_Audience_Core.pdf";
const FULL_PDF_NAME = "NFROS_Risk_Audience_Core_and_Appendix.pdf";
const PPTX_NAME = "NFROS_Risk_Audience_Core_and_Appendix.pptx";
const NOTES_NAME = "NFROS_Risk_Audience_Speaker_Notes.md";
const HASH_NAME = "NFROS_Risk_Audience_Export_Hash.txt";
const META_NAME = "NFROS_Risk_Audience_Export_Metadata.json";

// ---------------------------------------------------------------------------
// Server management
// ---------------------------------------------------------------------------

/** Returns true if localhost:3000 is already responding. */
async function isServerRunning(): Promise<boolean> {
  try {
    await fetch(BASE_URL, { signal: AbortSignal.timeout(3000) });
    return true;
  } catch {
    return false;
  }
}

/** Waits up to timeoutMs for the server to respond. */
async function waitForServer(timeoutMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isServerRunning()) return true;
    await new Promise<void>((r) => setTimeout(r, 1500));
  }
  return false;
}

/** Ensures a Next.js dev server is running, spawning one if needed. */
async function ensureDevServer(): Promise<ChildProcess | null> {
  if (await isServerRunning()) {
    console.log("Using already-running server on port 3000.");
    return null;
  }

  console.log("Starting Next.js dev server ...");
  const child = spawn("npm", ["run", "dev"], {
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
    env: { ...process.env, NFR_DEMO_MODE: "safe" },
  });

  if (!(await waitForServer(30_000))) {
    child.kill();
    throw new Error("Dev server did not respond within 30 seconds.");
  }

  console.log("Dev server is ready.");
  return child;
}

// ---------------------------------------------------------------------------
// Playwright utilities
// ---------------------------------------------------------------------------

async function settle(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
}

// ---------------------------------------------------------------------------
// Screenshot capture
// ---------------------------------------------------------------------------

/** Captures all 13 core slides, one per URL param. Returns absolute paths. */
async function captureCore(page: Page): Promise<string[]> {
  const paths: string[] = [];

  for (let slideIndex = 1; slideIndex <= CORE_SLIDE_COUNT; slideIndex++) {
    const url = `${BASE_URL}/story?deck=v2.1&export=1&slide=${slideIndex}`;
    await page.goto(url, { waitUntil: "networkidle" });
    await settle(page);

    const padded = String(slideIndex).padStart(2, "0");
    const filePath = join(SLIDE_DIR, `core-${padded}.png`);
    await page.screenshot({ path: filePath, fullPage: false });
    paths.push(filePath);
    console.log(`  captured core slide ${padded}/${CORE_SLIDE_COUNT}`);
  }

  return paths;
}

/**
 * Captures all 23 appendix slides by navigating via keyboard from the
 * end-of-core prompt. Returns absolute paths.
 */
async function captureAppendix(page: Page): Promise<string[]> {
  const paths: string[] = [];

  // Start on the last core slide and trigger the end-of-core prompt.
  const url = `${BASE_URL}/story?deck=v2.1&export=1&slide=${CORE_SLIDE_COUNT}`;
  await page.goto(url, { waitUntil: "networkidle" });
  await settle(page);

  // Press ArrowRight to show the end-of-core prompt.
  await page.keyboard.press("ArrowRight");
  await page.waitForSelector('[role="dialog"][aria-label="End of core presentation"]', {
    state: "visible",
    timeout: 10_000,
  });

  // Click "Open appendix".
  await page.getByRole("button", { name: "Open appendix" }).click();
  await settle(page);

  // Screenshot and advance through all 23 appendix slides.
  for (let appIndex = 1; appIndex <= APPENDIX_SLIDE_COUNT; appIndex++) {
    const padded = String(appIndex).padStart(2, "0");
    const filePath = join(SLIDE_DIR, `appendix-${padded}.png`);
    await page.screenshot({ path: filePath, fullPage: false });
    paths.push(filePath);
    console.log(`  captured appendix slide ${padded}/${APPENDIX_SLIDE_COUNT}`);

    if (appIndex < APPENDIX_SLIDE_COUNT) {
      await page.keyboard.press("ArrowRight");
      await settle(page);
    }
  }

  return paths;
}

// ---------------------------------------------------------------------------
// PDF assembly
// ---------------------------------------------------------------------------

/**
 * Assembles a PDF from an ordered list of screenshot paths.
 * Each screenshot becomes one full-bleed 1920x1080 page.
 * Images are inlined as base64 data URIs to avoid origin restrictions.
 */
async function buildPdf(
  browser: Browser,
  screenshotPaths: string[],
  outputPath: string,
): Promise<void> {
  const pages = screenshotPaths
    .map((p) => {
      const encoded = readFileSync(p).toString("base64");
      return `<div class="page"><img src="data:image/png;base64,${encoded}" alt="" /></div>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html><head><meta charset="utf-8" /><style>
  @page { size: 1920px 1080px; margin: 0; }
  html, body { margin: 0; padding: 0; background: #0e0f14; }
  .page { width: 1920px; height: 1080px; page-break-after: always; overflow: hidden; }
  .page:last-child { page-break-after: auto; }
  img { width: 1920px; height: 1080px; display: block; }
</style></head><body>${pages}</body></html>`;

  const pdfPage = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
  await pdfPage.setContent(html, { waitUntil: "load" });

  const imageState = await pdfPage.evaluate(() => {
    const images = Array.from(document.images);
    return {
      total: images.length,
      complete: images.filter((img) => img.complete && img.naturalWidth > 0).length,
    };
  });

  if (imageState.complete !== imageState.total) {
    await pdfPage.close();
    throw new Error(
      `Only ${imageState.complete} of ${imageState.total} slide captures decoded for PDF.`,
    );
  }

  await pdfPage.pdf({
    path: outputPath,
    width: `${WIDTH}px`,
    height: `${HEIGHT}px`,
    printBackground: true,
    pageRanges: "",
  });
  await pdfPage.close();
}

// ---------------------------------------------------------------------------
// PPTX assembly
// ---------------------------------------------------------------------------

/**
 * Builds the PPTX from core and appendix screenshots with speaker notes
 * pulled from the slide data modules.
 */
async function buildPptx(
  corePaths: string[],
  appendixPaths: string[],
  outputPath: string,
): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "HD16x9", width: 13.333, height: 7.5 });
  pptx.layout = "HD16x9";
  pptx.author = "NFR WorkOS";
  pptx.company = "Synthetic institution and data";
  pptx.title = "NFROS Risk Audience Presentation V2.1";
  pptx.subject =
    "NFR Operating System. Synthetic institution and data. Illustrative regulatory context, not legal advice.";

  // Core slides
  CORE_SLIDES.forEach((slide, index) => {
    const screenshotPath = corePaths[index];
    if (!screenshotPath) return;

    const pptxSlide = pptx.addSlide();
    pptxSlide.background = { color: "E4E7EC" };
    pptxSlide.addImage({ path: screenshotPath, x: 0, y: 0, w: 13.333, h: 7.5 });

    const notes = [
      `Core slide ${index + 1} of ${CORE_SLIDE_COUNT}. Section: ${slide.section}.`,
      `Budget: ${slide.presentingTimeSeconds} seconds.`,
      "",
      slide.speakerNotes,
      "",
      "Synthetic institution and data. Illustrative regulatory context, not legal advice.",
    ].join("\n");
    pptxSlide.addNotes(notes);
  });

  // Appendix slides
  APPENDIX_SLIDES.forEach((slide, index) => {
    const screenshotPath = appendixPaths[index];
    if (!screenshotPath) return;

    const pptxSlide = pptx.addSlide();
    pptxSlide.background = { color: "E4E7EC" };
    pptxSlide.addImage({ path: screenshotPath, x: 0, y: 0, w: 13.333, h: 7.5 });

    const notes = [
      `Appendix slide ${index + 1} of ${APPENDIX_SLIDE_COUNT}: ${slide.title}.`,
      ...(slide.speakerNotes ? [slide.speakerNotes] : []),
      "",
      "Synthetic institution and data. Illustrative regulatory context, not legal advice.",
    ].join("\n");
    pptxSlide.addNotes(notes);
  });

  await pptx.writeFile({ fileName: outputPath });
}

// ---------------------------------------------------------------------------
// Speaker notes
// ---------------------------------------------------------------------------

function buildSpeakerNotes(outputPath: string): void {
  // If a hand-authored script exists, use it verbatim.
  const scriptSource = resolve(process.cwd(), "docs", "PRESENTATION_V2_1_SCRIPT.md");
  if (existsSync(scriptSource)) {
    copyFileSync(scriptSource, outputPath);
    return;
  }

  // Generate from slide data.
  const lines: string[] = [
    "# NFROS Risk Audience Presentation V2.1",
    "## Speaker notes",
    "",
    "Synthetic institution and data. Illustrative regulatory context, not legal advice.",
    "",
    `Core slides: ${CORE_SLIDE_COUNT}. Appendix slides: ${APPENDIX_SLIDE_COUNT}. Total: ${CORE_SLIDE_COUNT + APPENDIX_SLIDE_COUNT}.`,
    "",
  ];

  lines.push("## Core slides", "");

  CORE_SLIDES.forEach((slide, index) => {
    lines.push(`### Slide ${index + 1}: ${slide.title}`);
    if (slide.subtitle) lines.push(`*${slide.subtitle}*`);
    lines.push(`**Section:** ${slide.section}`);
    lines.push(`**Budget:** ${slide.presentingTimeSeconds} seconds`);
    lines.push("");
    lines.push(slide.speakerNotes);
    lines.push("");
  });

  lines.push("## Appendix slides", "");

  APPENDIX_SLIDES.forEach((slide, index) => {
    lines.push(`### Appendix ${index + 1}: ${slide.title}`);
    if (slide.speakerNotes) {
      lines.push("");
      lines.push(slide.speakerNotes);
    }
    lines.push("");
  });

  writeFileSync(outputPath, lines.join("\n"), "utf8");
}

// ---------------------------------------------------------------------------
// Content hash
// ---------------------------------------------------------------------------

function computeContentHash(pdfPaths: string[]): string {
  const hash = createHash("sha256");
  for (const pdfPath of pdfPaths) {
    hash.update(readFileSync(pdfPath));
  }
  return hash.digest("hex");
}

// ---------------------------------------------------------------------------
// Git commit
// ---------------------------------------------------------------------------

function getGitCommit(): string {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  mkdirSync(EXPORT_DIR, { recursive: true });
  mkdirSync(SLIDE_DIR, { recursive: true });
  mkdirSync(DOWNLOADS_DIR, { recursive: true });

  // Clear stale slide captures.
  for (const file of readdirSync(SLIDE_DIR)) {
    if (file.endsWith(".png")) unlinkSync(join(SLIDE_DIR, file));
  }

  const server = await ensureDevServer();
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch();
    const page = await browser.newPage({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 1,
      colorScheme: "dark",
      reducedMotion: "reduce",
    });

    console.log(`\nCapturing ${CORE_SLIDE_COUNT} core slides ...`);
    const corePaths = await captureCore(page);

    console.log(`\nCapturing ${APPENDIX_SLIDE_COUNT} appendix slides ...`);
    const appendixPaths = await captureAppendix(page);

    await page.close();
    console.log(
      `\nAll ${corePaths.length + appendixPaths.length} slides captured.`,
    );

    // Build PDFs.
    const corePdfPath = join(EXPORT_DIR, CORE_PDF_NAME);
    const fullPdfPath = join(EXPORT_DIR, FULL_PDF_NAME);

    console.log("\nBuilding core PDF ...");
    await buildPdf(browser, corePaths, corePdfPath);
    console.log(`  ${CORE_PDF_NAME} written (${corePaths.length} slides)`);

    console.log("Building full PDF ...");
    await buildPdf(browser, [...corePaths, ...appendixPaths], fullPdfPath);
    console.log(
      `  ${FULL_PDF_NAME} written (${corePaths.length + appendixPaths.length} slides)`,
    );

    // Build PPTX.
    const pptxPath = join(EXPORT_DIR, PPTX_NAME);
    console.log("\nBuilding PPTX ...");
    await buildPptx(corePaths, appendixPaths, pptxPath);
    console.log(`  ${PPTX_NAME} written`);

    // Speaker notes.
    const notesPath = join(EXPORT_DIR, NOTES_NAME);
    buildSpeakerNotes(notesPath);
    console.log(`  ${NOTES_NAME} written`);

    // Content hash (SHA-256 of core PDF + full PDF concatenated).
    const contentHash = computeContentHash([corePdfPath, fullPdfPath]);
    const hashPath = join(EXPORT_DIR, HASH_NAME);
    writeFileSync(hashPath, contentHash + "\n", "utf8");
    console.log(`  ${HASH_NAME} written`);

    // Metadata JSON.
    const metadata = {
      deckVersion: "v2.1",
      gitCommit: getGitCommit(),
      exportTime: new Date().toISOString(),
      coreSlideCount: CORE_SLIDE_COUNT,
      appendixSlideCount: APPENDIX_SLIDE_COUNT,
      totalSlideCount: CORE_SLIDE_COUNT + APPENDIX_SLIDE_COUNT,
      syntheticDataDisclosure: "Synthetic institution and data",
      regulatoryDisclaimer: "Illustrative regulatory context, not legal advice",
      contentHash,
    };
    const metaPath = join(EXPORT_DIR, META_NAME);
    writeFileSync(metaPath, JSON.stringify(metadata, null, 2) + "\n", "utf8");
    console.log(`  ${META_NAME} written`);

    // Copy to public/downloads/.
    console.log("\nCopying to public/downloads/ ...");
    copyFileSync(corePdfPath, join(DOWNLOADS_DIR, CORE_PDF_NAME));
    copyFileSync(fullPdfPath, join(DOWNLOADS_DIR, FULL_PDF_NAME));
    copyFileSync(metaPath, join(DOWNLOADS_DIR, META_NAME));
    console.log("  done");

    console.log("\nExport complete.");
    console.log(`  Core PDF:   ${corePdfPath}`);
    console.log(`  Full PDF:   ${fullPdfPath}`);
    console.log(`  PPTX:       ${pptxPath}`);
    console.log(`  Notes:      ${notesPath}`);
    console.log(`  Hash:       ${contentHash}`);
  } finally {
    if (browser) await browser.close();
    if (server) server.kill();
  }
}

main().catch((error: unknown) => {
  console.error("Export failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

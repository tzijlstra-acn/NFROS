/**
 * Export pipeline for NFROS Risk Audience Presentation V2.2.
 *
 * Produces:
 *   exports/NFROS_Risk_Audience_V22_Core.pdf
 *   exports/NFROS_Risk_Audience_V22_Core_and_Appendix.pdf
 *   exports/NFROS_Risk_Audience_V22_Core_and_Appendix.pptx
 *   exports/NFROS_Risk_Audience_V22_Speaker_Notes.md
 *   exports/NFROS_Risk_Audience_V22_Export_Hash.txt
 *   exports/NFROS_Risk_Audience_V22_Export_Metadata.json
 *
 * Then copies the two PDFs and metadata JSON to public/downloads/.
 *
 * Slide discovery: this script DOES NOT import legacy STORY_SCENES or
 * presentation-v2-1 data. It reads the `data-presentation-slides` attribute
 * emitted by PresentationV22 on the rendered page. If the attribute is absent,
 * the script fails with a clear error rather than falling back to legacy data.
 *
 * Run with: npm run export:presentation
 */

import { chromium, type Browser, type Page } from "@playwright/test";
import PptxGenJS from "pptxgenjs";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  unlinkSync,
  copyFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { spawn, type ChildProcess, execSync } from "node:child_process";
import { createHash } from "node:crypto";

import { CORE_SLIDES_V22 } from "../src/presentation-v2-2/data/core-story";
import { APPENDIX_SLIDES } from "../src/presentation-v2-2/data/appendix";
import { addPdfInternalLinks } from "../src/presentation-v2-2/export/pdf-links";

// ---------------------------------------------------------------------------
// Slide metadata type (emitted by PresentationV22 via data-presentation-slides)
// ---------------------------------------------------------------------------

interface SlideExportMeta {
  index: number;
  type: "core" | "appendix";
  title: string;
  section?: string;
  speakerNotes?: string;
  presentingTimeSeconds?: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const WIDTH = 1920;
const HEIGHT = 1080;
const BASE_URL = process.env.NFR_BASE_URL ?? "http://localhost:3000";
const EXPORT_DIR = resolve(process.cwd(), "exports");
const SLIDE_DIR = join(EXPORT_DIR, "slides-v2-2");
const DOWNLOADS_DIR = resolve(process.cwd(), "public", "downloads");

const CORE_PDF_NAME = "NFROS_Risk_Audience_V22_Core.pdf";
const FULL_PDF_NAME = "NFROS_Risk_Audience_V22_Core_and_Appendix.pdf";
const PPTX_NAME = "NFROS_Risk_Audience_V22_Core_and_Appendix.pptx";
const NOTES_NAME = "NFROS_Risk_Audience_V22_Speaker_Notes.md";
const HASH_NAME = "NFROS_Risk_Audience_V22_Export_Hash.txt";
const META_NAME = "NFROS_Risk_Audience_V22_Export_Metadata.json";

// ---------------------------------------------------------------------------
// Server management
// ---------------------------------------------------------------------------

async function isServerRunning(): Promise<boolean> {
  try {
    await fetch(BASE_URL, { signal: AbortSignal.timeout(3000) });
    return true;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isServerRunning()) return true;
    await new Promise<void>((r) => setTimeout(r, 1500));
  }
  return false;
}

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
// Slide discovery via data-presentation-slides
// ---------------------------------------------------------------------------

/**
 * Navigates to the V2.2 deck landing page and reads the `data-presentation-slides`
 * attribute. Fails with a descriptive error if the attribute is absent, rather
 * than falling back to legacy slide data.
 */
async function discoverSlides(page: Page): Promise<SlideExportMeta[]> {
  const discoveryUrl = `${BASE_URL}/story?deck=v2.2&export=1&safe=1`;
  console.log(`Discovering slides at: ${discoveryUrl}`);
  await page.goto(discoveryUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);

  const raw = await page.evaluate(() => {
    const el = document.querySelector("[data-presentation-slides]");
    return el ? el.getAttribute("data-presentation-slides") : null;
  });

  if (raw === null) {
    throw new Error(
      [
        "data-presentation-slides attribute not found on the V2.2 deck page.",
        "",
        "The export pipeline requires PresentationV22 to render an element with",
        "  data-presentation-slides='[{\"index\":1,\"type\":\"core\",...}]'",
        "so that the exporter can discover the current slide count and metadata",
        "without importing legacy scene data.",
        "",
        "Fix: add a hidden element with data-presentation-slides to PresentationV22",
        "before running this export script.",
      ].join("\n"),
    );
  }

  let slides: SlideExportMeta[];
  try {
    slides = JSON.parse(raw) as SlideExportMeta[];
  } catch (err) {
    throw new Error(
      `data-presentation-slides contained invalid JSON: ${String(err)}`,
    );
  }

  if (!Array.isArray(slides) || slides.length === 0) {
    throw new Error(
      "data-presentation-slides parsed to an empty or non-array value.",
    );
  }

  console.log(`  discovered ${slides.length} slide(s).`);
  return slides;
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

async function captureSlides(
  page: Page,
  slides: SlideExportMeta[],
): Promise<{ core: string[]; appendix: string[] }> {
  const corePaths: string[] = [];
  const appendixPaths: string[] = [];

  for (const slide of slides) {
    const url = `${BASE_URL}/story?deck=v2.2&export=1&safe=1&slide=${slide.index}`;
    await page.goto(url, { waitUntil: "networkidle" });
    await settle(page);

    const padded = String(slide.index).padStart(2, "0");
    const prefix = slide.type === "core" ? "core" : "appendix";
    const filePath = join(SLIDE_DIR, `${prefix}-${padded}.png`);
    await page.screenshot({ path: filePath, fullPage: false });

    if (slide.type === "core") {
      corePaths.push(filePath);
    } else {
      appendixPaths.push(filePath);
    }
    console.log(`  captured ${prefix} slide ${padded}`);
  }

  return { core: corePaths, appendix: appendixPaths };
}

// ---------------------------------------------------------------------------
// PDF assembly
// ---------------------------------------------------------------------------

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

async function buildPptx(
  slides: SlideExportMeta[],
  corePaths: string[],
  appendixPaths: string[],
  outputPath: string,
): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "HD16x9", width: 13.333, height: 7.5 });
  pptx.layout = "HD16x9";
  pptx.author = "NFR WorkOS";
  pptx.company = "Synthetic institution and data";
  pptx.title = "NFROS Risk Audience Presentation V2.2";
  pptx.subject =
    "NFR Operating System. Synthetic institution and data. Illustrative regulatory context, not legal advice.";

  const coreSlides    = slides.filter((s) => s.type === "core");
  const appendixSlides = slides.filter((s) => s.type === "appendix");

  // ---------------------------------------------------------------------------
  // PPTX internal-link geometry (pixels to inches, 1920x1080 -> 13.333x7.5)
  // ---------------------------------------------------------------------------
  const PX_TO_IN = 13.333 / 1920; // 0.006944 in/px (same ratio for x and y at 16:9)

  // Ref bar (AppendixRefBar): bottom:64px, left:48px, height:40px
  // Label section ("More detail" label + gap) = ~87px before first chip
  const REF_BAR_TOP_PX     = 1080 - 64 - 40;  // 976px from top
  const CHIP_START_X_PX    = 48 + 87;          // 135px from left (after label)
  const CHIP_W_PX          = 140;
  const CHIP_GAP_PX        = 12;               // --pv22-space-3
  const CHIP_H_PX          = 40;               // match bar height

  // Return button: right-aligned in appendix footer
  const RETURN_BTN_W_PX  = 120;
  const RETURN_BTN_H_PX  = 32;
  const RETURN_BTN_X_PX  = 1920 - 48 - RETURN_BTN_W_PX; // 1752px
  const RETURN_BTN_Y_PX  = 1040;              // approximate footer position

  // Build appendix id -> 1-based PPTX slide number map
  const appendixIdToSlideNum = new Map<string, number>();
  APPENDIX_SLIDES.forEach((slide, i) => {
    appendixIdToSlideNum.set(slide.id, coreSlides.length + i + 1);
  });

  // ---------------------------------------------------------------------------
  // Core slides
  // ---------------------------------------------------------------------------
  coreSlides.forEach((slide, index) => {
    const screenshotPath = corePaths[index];
    if (!screenshotPath) return;
    const pptxSlide = pptx.addSlide();
    pptxSlide.background = { color: "E4E7EC" };
    pptxSlide.addImage({ path: screenshotPath, x: 0, y: 0, w: 13.333, h: 7.5 });
    const notes = [
      `Core slide ${index + 1} of ${coreSlides.length}.${slide.section ? ` Section: ${slide.section}.` : ""}`,
      ...(slide.presentingTimeSeconds ? [`Budget: ${slide.presentingTimeSeconds} seconds.`] : []),
      "",
      slide.speakerNotes ?? "",
      "",
      "Synthetic institution and data. Illustrative regulatory context, not legal advice.",
    ].join("\n");
    pptxSlide.addNotes(notes);

    // Add transparent hyperlink shapes over each appendix ref chip
    const coreData = CORE_SLIDES_V22[index];
    if (coreData && coreData.appendixRefs && coreData.appendixRefs.length > 0) {
      coreData.appendixRefs.forEach((ref, chipIndex) => {
        const targetSlideNum = appendixIdToSlideNum.get(ref.appendixId);
        if (!targetSlideNum) return;

        const chipXIn = (CHIP_START_X_PX + chipIndex * (CHIP_W_PX + CHIP_GAP_PX)) * PX_TO_IN;
        const chipYIn = REF_BAR_TOP_PX * PX_TO_IN;

        pptxSlide.addShape("rect", {
          x: chipXIn,
          y: chipYIn,
          w: CHIP_W_PX * PX_TO_IN,
          h: CHIP_H_PX * PX_TO_IN,
          fill: { type: "none" },
          line: { type: "none" },
          hyperlink: { slide: targetSlideNum },
        });
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Appendix slides
  // ---------------------------------------------------------------------------
  appendixSlides.forEach((slide, index) => {
    const screenshotPath = appendixPaths[index];
    if (!screenshotPath) return;
    const pptxSlide = pptx.addSlide();
    pptxSlide.background = { color: "E4E7EC" };
    pptxSlide.addImage({ path: screenshotPath, x: 0, y: 0, w: 13.333, h: 7.5 });
    const notes = [
      `Appendix slide ${index + 1} of ${appendixSlides.length}: ${slide.title}.`,
      ...(slide.speakerNotes ? [slide.speakerNotes] : []),
      "",
      "Synthetic institution and data. Illustrative regulatory context, not legal advice.",
    ].join("\n");
    pptxSlide.addNotes(notes);

    // Add transparent hyperlink shape over the return button (links back to slide 1)
    pptxSlide.addShape("rect", {
      x: RETURN_BTN_X_PX * PX_TO_IN,
      y: RETURN_BTN_Y_PX * PX_TO_IN,
      w: RETURN_BTN_W_PX * PX_TO_IN,
      h: RETURN_BTN_H_PX * PX_TO_IN,
      fill: { type: "none" },
      line: { type: "none" },
      hyperlink: { slide: 1 },
    });
  });

  await pptx.writeFile({ fileName: outputPath });
}

// ---------------------------------------------------------------------------
// Speaker notes
// ---------------------------------------------------------------------------

function buildSpeakerNotes(slides: SlideExportMeta[], outputPath: string): void {
  const coreSlides = slides.filter((s) => s.type === "core");
  const appendixSlides = slides.filter((s) => s.type === "appendix");

  const lines: string[] = [
    "# NFROS Risk Audience Presentation V2.2",
    "## Speaker notes",
    "",
    "Synthetic institution and data. Illustrative regulatory context, not legal advice.",
    "",
    `Core slides: ${coreSlides.length}. Appendix slides: ${appendixSlides.length}. Total: ${slides.length}.`,
    "",
  ];

  lines.push("## Core slides", "");
  coreSlides.forEach((slide, index) => {
    lines.push(`### Slide ${index + 1}: ${slide.title}`);
    if (slide.section) lines.push(`**Section:** ${slide.section}`);
    if (slide.presentingTimeSeconds) lines.push(`**Budget:** ${slide.presentingTimeSeconds} seconds`);
    lines.push("");
    if (slide.speakerNotes) lines.push(slide.speakerNotes);
    lines.push("");
  });

  if (appendixSlides.length > 0) {
    lines.push("## Appendix slides", "");
    appendixSlides.forEach((slide, index) => {
      lines.push(`### Appendix ${index + 1}: ${slide.title}`);
      if (slide.speakerNotes) {
        lines.push("");
        lines.push(slide.speakerNotes);
      }
      lines.push("");
    });
  }

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
    const discoveryPage = await browser.newPage({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 1,
      colorScheme: "dark",
      reducedMotion: "reduce",
    });

    // Discover slides from the DOM attribute. Fails with clear error if absent.
    const slides = await discoverSlides(discoveryPage);
    await discoveryPage.close();

    const coreSlides = slides.filter((s) => s.type === "core");
    const appendixSlides = slides.filter((s) => s.type === "appendix");

    const capturePage = await browser.newPage({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 1,
      colorScheme: "dark",
      reducedMotion: "reduce",
    });

    console.log(`\nCapturing ${coreSlides.length} core slides and ${appendixSlides.length} appendix slides ...`);
    const { core: corePaths, appendix: appendixPaths } = await captureSlides(capturePage, slides);
    await capturePage.close();

    console.log(`\nAll ${slides.length} slides captured.`);

    // Build PDFs.
    const corePdfPath = join(EXPORT_DIR, CORE_PDF_NAME);
    const fullPdfPath = join(EXPORT_DIR, FULL_PDF_NAME);

    console.log("\nBuilding core PDF ...");
    await buildPdf(browser, corePaths, corePdfPath);
    console.log(`  ${CORE_PDF_NAME} written (${corePaths.length} slides)`);

    console.log("  Adding PDF link annotations to core PDF ...");
    {
      const annotated = await addPdfInternalLinks(new Uint8Array(readFileSync(corePdfPath)));
      writeFileSync(corePdfPath, annotated);
    }

    console.log("Building full PDF ...");
    await buildPdf(browser, [...corePaths, ...appendixPaths], fullPdfPath);
    console.log(`  ${FULL_PDF_NAME} written (${slides.length} slides)`);

    console.log("  Adding PDF link annotations to full PDF ...");
    {
      const annotated = await addPdfInternalLinks(new Uint8Array(readFileSync(fullPdfPath)));
      writeFileSync(fullPdfPath, annotated);
    }

    // Build PPTX.
    const pptxPath = join(EXPORT_DIR, PPTX_NAME);
    console.log("\nBuilding PPTX ...");
    await buildPptx(slides, corePaths, appendixPaths, pptxPath);
    console.log(`  ${PPTX_NAME} written`);

    // Speaker notes.
    const notesPath = join(EXPORT_DIR, NOTES_NAME);
    buildSpeakerNotes(slides, notesPath);
    console.log(`  ${NOTES_NAME} written`);

    // Content hash (SHA-256 of core PDF + full PDF concatenated).
    const contentHash = computeContentHash([corePdfPath, fullPdfPath]);
    const hashPath = join(EXPORT_DIR, HASH_NAME);
    writeFileSync(hashPath, contentHash + "\n", "utf8");
    console.log(`  ${HASH_NAME} written`);

    // Metadata JSON.
    const metadata = {
      deckVersion: "v2.2",
      gitCommit: getGitCommit(),
      exportTime: new Date().toISOString(),
      coreSlideCount: corePaths.length,
      appendixSlideCount: appendixPaths.length,
      totalSlideCount: slides.length,
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

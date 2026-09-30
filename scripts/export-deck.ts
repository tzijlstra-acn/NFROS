/**
 * Deck export.
 *
 * Captures every story scene at 1920x1080 in presenter safe mode and produces
 * a PDF, a PowerPoint and a separate speaker script.
 *
 * Two decisions worth stating. First, the capture runs against the real
 * application in presenter safe mode with `?export=1`, which forces every
 * reveal to its final state, so the exported image is the finished scene
 * rather than a frame caught mid transition. Second, the slides are full
 * bleed images rather than reconstructed native shapes: the visualisations are
 * SVG and CSS, and a native rebuild would lose fidelity and drift from the
 * live version, which remains the highest fidelity surface.
 *
 * Run with: npm run export:deck
 */

import { chromium, type Browser, type Page } from "@playwright/test";
import PptxGenJS from "pptxgenjs";
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";

const WIDTH = 1920;
const HEIGHT = 1080;
const BASE_URL = process.env.NFR_BASE_URL ?? "http://localhost:3000";
const EXPORT_DIR = resolve(process.cwd(), "exports");
const SCENE_DIR = join(EXPORT_DIR, "scenes");

interface SceneMeta {
  sceneNumber: number;
  id: string;
  title: string;
  subtitle: string;
  chapter: string;
  keyMessage: string;
  presenterNotes: string[];
  durationSeconds: number;
}

/** Waits for the health endpoint, so we never capture a half started app. */
async function waitForServer(timeoutMs = 180_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/api/health/ai`);
      if (response.ok) return true;
    } catch {
      // Not up yet.
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

/** Starts the production server when one is not already listening. */
async function ensureServer(): Promise<ChildProcess | null> {
  if (await waitForServer(3000)) {
    console.log("Using the server that is already running.");
    return null;
  }

  console.log("Starting the application in presenter safe mode ...");
  const child = spawn("npm", ["run", "start"], {
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
    env: { ...process.env, NFR_DEMO_MODE: "safe" },
  });

  if (!(await waitForServer())) {
    child.kill();
    throw new Error("The application did not become healthy within the timeout.");
  }
  console.log("Server is healthy.");
  return child;
}

/** Reads the scene metadata out of the running deck. */
async function readSceneMeta(page: Page): Promise<SceneMeta[]> {
  await page.goto(`${BASE_URL}/story?export=1&safe=1`, { waitUntil: "networkidle" });

  const meta = await page.evaluate(() => {
    const element = document.querySelector("[data-story-scenes]");
    const raw = element?.getAttribute("data-story-scenes");
    if (raw) {
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return null;
      }
    }
    return null;
  });

  if (Array.isArray(meta) && meta.length > 0) return meta as SceneMeta[];

  // Fallback: read the scene data module directly.
  const { STORY_SCENES } = await import("../src/scenario/data/story");
  return (STORY_SCENES as unknown as Array<Record<string, unknown>>).map((scene, index) => ({
    sceneNumber: Number(scene.sceneNumber ?? index + 1),
    id: String(scene.id ?? `scene-${index + 1}`),
    title: String(scene.title ?? ""),
    subtitle: String(scene.subtitle ?? ""),
    chapter: String(scene.chapter ?? ""),
    keyMessage: String(scene.keyMessage ?? ""),
    presenterNotes: Array.isArray(scene.presenterNotes)
      ? (scene.presenterNotes as unknown[]).map(String)
      : [],
    durationSeconds: Number(scene.durationSeconds ?? 0),
  }));
}

/** Captures one scene, returning the file path. */
async function captureScene(page: Page, sceneNumber: number): Promise<string> {
  const url = `${BASE_URL}/story?export=1&safe=1&scene=${sceneNumber}`;
  await page.goto(url, { waitUntil: "networkidle" });

  // Fonts must be loaded, or the capture shows fallback typography.
  await page.evaluate(() => document.fonts.ready);
  // A short settle so any layout driven by a resize observer has run.
  await page.waitForTimeout(600);

  const path = join(SCENE_DIR, `scene-${String(sceneNumber).padStart(2, "0")}.png`);
  await page.screenshot({ path, fullPage: false });
  return path;
}

/** Checks a captured page for vertical overflow, which must never happen. */
async function checkOverflow(page: Page): Promise<{ overflows: boolean; detail: string }> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const overflowY = doc.scrollHeight > window.innerHeight + 2;
    const overflowX = doc.scrollWidth > window.innerWidth + 2;
    return {
      overflows: overflowY || overflowX,
      detail: `scrollHeight ${doc.scrollHeight} against innerHeight ${window.innerHeight}, scrollWidth ${doc.scrollWidth} against innerWidth ${window.innerWidth}`,
    };
  });
}

async function buildPdf(browser: Browser, scenePaths: string[]): Promise<string> {
  /*
   * The PDF is assembled from one HTML page per scene rather than by printing
   * the deck directly, because printing a 100dvh scene reliably produces a
   * page break in the wrong place. One image per page at exactly 16:9 gives a
   * deck that projects correctly.
   */
  /*
   * The captures are inlined as data URIs rather than referenced with a
   * file:// URL.
   *
   * An earlier version referenced them, and the images silently failed to
   * load: a page created with `setContent` has an about:blank origin and no
   * file access, so the export produced a PDF with the right number of pages
   * and almost nothing on them. It was 11 kilobytes for sixteen full frames,
   * which is the kind of failure that only shows up if someone opens the file.
   * Inlining removes the origin question entirely.
   */
  const pages = scenePaths
    .map((path) => {
      const encoded = readFileSync(path).toString("base64");
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

  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
  await page.setContent(html, { waitUntil: "load" });

  /*
   * Confirm every image actually decoded before printing. This is the check
   * that would have caught the blank page export immediately.
   */
  const imageState = await page.evaluate(() => {
    const images = Array.from(document.images);
    return {
      total: images.length,
      complete: images.filter((img) => img.complete && img.naturalWidth > 0).length,
    };
  });
  if (imageState.complete !== imageState.total) {
    throw new Error(
      `Only ${imageState.complete} of ${imageState.total} scene captures decoded, so the PDF would contain blank pages.`,
    );
  }

  const pdfPath = join(EXPORT_DIR, "NFR_WorkOS_DACH_Banking.pdf");
  await page.pdf({
    path: pdfPath,
    width: `${WIDTH}px`,
    height: `${HEIGHT}px`,
    printBackground: true,
    pageRanges: "",
  });
  await page.close();
  return pdfPath;
}

async function buildPptx(scenes: SceneMeta[], scenePaths: string[]): Promise<string> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "HD16x9", width: 13.333, height: 7.5 });
  pptx.layout = "HD16x9";
  pptx.author = "NFR WorkOS";
  pptx.company = "Synthetic institution and data";
  pptx.title = "NFR WorkOS: Live the NFR Day";
  pptx.subject =
    "One work environment for non-financial risk. Synthetic institution and data. Illustrative regulatory context, not legal advice.";

  for (let index = 0; index < scenePaths.length; index += 1) {
    const path = scenePaths[index];
    const scene = scenes[index];
    if (!path) continue;

    const slide = pptx.addSlide();
    slide.background = { color: "0E0F14" };
    // Full bleed image, so the slide matches the live scene exactly.
    slide.addImage({ path, x: 0, y: 0, w: 13.333, h: 7.5 });

    if (scene) {
      const notes = [
        `Scene ${scene.sceneNumber} of ${scenes.length}. Chapter: ${scene.chapter}.`,
        `Budget: ${scene.durationSeconds} seconds.`,
        "",
        `Key message: ${scene.keyMessage}`,
        "",
        ...scene.presenterNotes,
        "",
        "Synthetic institution and data. Illustrative regulatory context, not legal advice.",
      ].join("\n");
      slide.addNotes(notes);
    }
  }

  const pptxPath = join(EXPORT_DIR, "NFR_WorkOS_DACH_Banking.pptx");
  await pptx.writeFile({ fileName: pptxPath });
  return pptxPath;
}

function buildSpeakerScript(scenes: SceneMeta[]): string {
  const totalSeconds = scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
  const lines: string[] = [
    "# NFR WorkOS: Live the NFR Day",
    "## Speaker script",
    "",
    "Synthetic institution and data. Illustrative regulatory context, not legal advice.",
    "",
    `Scenes: ${scenes.length}. Total budget: ${Math.round(totalSeconds / 60)} minutes (${totalSeconds} seconds).`,
    "",
    "This file is generated by `npm run export:deck` from the same scene data the live",
    "presentation renders, so it cannot drift from what the audience sees.",
    "",
  ];

  let currentChapter = "";
  for (const scene of scenes) {
    if (scene.chapter !== currentChapter) {
      currentChapter = scene.chapter;
      lines.push("", `## ${currentChapter}`, "");
    }
    lines.push(`### Scene ${scene.sceneNumber}: ${scene.title}`);
    lines.push("");
    if (scene.subtitle) lines.push(`*${scene.subtitle}*`, "");
    lines.push(`**Budget:** ${scene.durationSeconds} seconds`, "");
    lines.push(`**Key message:** ${scene.keyMessage}`, "");
    if (scene.presenterNotes.length > 0) {
      lines.push("**Speaking notes:**", "");
      for (const note of scene.presenterNotes) lines.push(`- ${note}`);
      lines.push("");
    }
  }

  const path = join(EXPORT_DIR, "NFR_WorkOS_Speaker_Script.md");
  writeFileSync(path, lines.join("\n"), "utf8");
  return path;
}

async function main(): Promise<void> {
  mkdirSync(EXPORT_DIR, { recursive: true });
  mkdirSync(SCENE_DIR, { recursive: true });

  // Clear stale captures so a removed scene cannot linger in the export.
  if (existsSync(SCENE_DIR)) {
    for (const file of readdirSync(SCENE_DIR)) {
      if (file.endsWith(".png")) unlinkSync(join(SCENE_DIR, file));
    }
  }

  const server = await ensureServer();
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch();
    const page = await browser.newPage({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 1,
      colorScheme: "dark",
      reducedMotion: "reduce",
    });

    const scenes = await readSceneMeta(page);
    console.log(`Found ${scenes.length} scenes.`);

    const scenePaths: string[] = [];
    const overflowFailures: string[] = [];

    for (const scene of scenes) {
      const path = await captureScene(page, scene.sceneNumber);
      const overflow = await checkOverflow(page);
      if (overflow.overflows) {
        overflowFailures.push(`Scene ${scene.sceneNumber} (${scene.title}): ${overflow.detail}`);
      }
      scenePaths.push(path);
      console.log(
        `  captured scene ${String(scene.sceneNumber).padStart(2, "0")}  ${scene.title}${overflow.overflows ? "  OVERFLOW" : ""}`,
      );
    }

    await page.close();

    const pdfPath = await buildPdf(browser, scenePaths);
    console.log(`PDF written to ${pdfPath}`);

    const pptxPath = await buildPptx(scenes, scenePaths);
    console.log(`PowerPoint written to ${pptxPath}`);

    const scriptPath = buildSpeakerScript(scenes);
    console.log(`Speaker script written to ${scriptPath}`);

    if (overflowFailures.length > 0) {
      console.error("\nScenes with overflow, which must be fixed before presenting:");
      for (const failure of overflowFailures) console.error(`  ${failure}`);
      process.exitCode = 1;
    } else {
      console.log("\nNo scene overflowed at 1920x1080.");
    }
  } finally {
    if (browser) await browser.close();
    if (server) server.kill();
  }
}

main().catch((error: unknown) => {
  console.error("The deck export failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

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

/** One captured frame, and which pane of which scene it is. */
interface SceneFrame {
  sceneNumber: number;
  path: string;
  /** One based. 1 of 1 for a single pane scene. */
  paneIndex: number;
  paneCount: number;
  /** The pane's own accessible label, for the speaker script. */
  paneLabel: string;
}

/** What the deck is showing right now: the step budget and the visible panes. */
async function readPaneState(page: Page): Promise<{ stepCount: number; panes: string[] }> {
  return page.evaluate(() => {
    const match = document.body.innerText.match(/reveal \d+ of (\d+)/);
    return {
      stepCount: match?.[1] ? Number(match[1]) : 1,
      panes: [...document.querySelectorAll(".scene-fit")]
        .filter((element) => element.getAttribute("data-shown") === "true")
        .map((element) => element.getAttribute("aria-label") ?? ""),
    };
  });
}

async function settle(page: Page): Promise<void> {
  // Fonts must be loaded, or the capture shows fallback typography.
  await page.evaluate(() => document.fonts.ready);
  // A short settle so any layout driven by a resize observer has run.
  await page.waitForTimeout(600);
}

/**
 * Captures every pane of one scene.
 *
 * A single pane scene yields one frame and keeps its original file name, which
 * is thirteen of the sixteen scenes.
 *
 * The other three need one frame each per pane, and the reason is a defect
 * this function used to have. A multi pane scene reveals one pane per step,
 * and three of them gate a pane on an EXACT step rather than a range. Export
 * mode resolves immediately to the FINAL step, so every intermediate pane was
 * simply absent from the deck: scene 12 exported one of its five panes and
 * lost the service dependency map, scene 14 exported one of four and lost the
 * portfolio decision thread, and scene 16 exported one of two. The deck had
 * the right number of pages and was missing eight panes of content.
 *
 * Panes are discovered rather than hardcoded. Asking the page which panes are
 * visible at each step means a scene that gains or loses a pane later is
 * captured correctly without anyone remembering to update a table here.
 */
async function captureScene(page: Page, sceneNumber: number): Promise<SceneFrame[]> {
  const base = `${BASE_URL}/story?export=1&safe=1&scene=${sceneNumber}`;
  await page.goto(base, { waitUntil: "networkidle" });
  await settle(page);

  const initial = await readPaneState(page);
  const padded = String(sceneNumber).padStart(2, "0");

  /*
   * A scene with no more than one pane is captured exactly as before, at its
   * final step and under its original file name. Stepping through it would
   * produce identical frames.
   */
  const paneCount = await (async () => {
    return page.evaluate(() => document.querySelectorAll(".scene-fit").length);
  })();

  if (paneCount <= 1) {
    const path = join(SCENE_DIR, `scene-${padded}.png`);
    await page.screenshot({ path, fullPage: false });
    return [
      {
        sceneNumber,
        path,
        paneIndex: 1,
        paneCount: 1,
        paneLabel: initial.panes[0] ?? "",
      },
    ];
  }

  const frames: SceneFrame[] = [];
  let previous = "";

  for (let step = 0; step < initial.stepCount; step += 1) {
    await page.goto(`${base}&step=${step}`, { waitUntil: "networkidle" });
    await settle(page);

    const state = await readPaneState(page);
    const signature = state.panes.join("|");
    // Only a change of pane is a new slide. Several steps reveal content
    // inside one pane, and those belong on one page.
    if (signature === previous || state.panes.length === 0) continue;
    previous = signature;

    const index = frames.length + 1;
    const path = join(SCENE_DIR, `scene-${padded}-${String(index).padStart(2, "0")}.png`);
    await page.screenshot({ path, fullPage: false });
    frames.push({
      sceneNumber,
      path,
      paneIndex: index,
      paneCount: 0,
      paneLabel: state.panes[0] ?? "",
    });
  }

  if (frames.length === 0) {
    // Nothing was discovered, so fall back to the previous behaviour rather
    // than dropping the scene from the deck entirely.
    const path = join(SCENE_DIR, `scene-${padded}.png`);
    await page.goto(base, { waitUntil: "networkidle" });
    await settle(page);
    await page.screenshot({ path, fullPage: false });
    return [{ sceneNumber, path, paneIndex: 1, paneCount: 1, paneLabel: "" }];
  }

  for (const frame of frames) frame.paneCount = frames.length;
  return frames;
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

/**
 * One slide per captured frame.
 *
 * Frames rather than a path array indexed in parallel with the scenes, because
 * the two are no longer the same length: a multi pane scene contributes
 * several frames. Pairing by index was correct while every scene produced
 * exactly one page and would have silently attached the wrong notes the moment
 * one produced two.
 */
async function buildPptx(scenes: SceneMeta[], frames: SceneFrame[]): Promise<string> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "HD16x9", width: 13.333, height: 7.5 });
  pptx.layout = "HD16x9";
  pptx.author = "NFR WorkOS";
  pptx.company = "Synthetic institution and data";
  pptx.title = "NFR WorkOS: Live the NFR Day";
  pptx.subject =
    "One work environment for non-financial risk. Synthetic institution and data. Illustrative regulatory context, not legal advice.";

  const sceneByNumber = new Map(scenes.map((scene) => [scene.sceneNumber, scene]));

  for (const frame of frames) {
    const scene = sceneByNumber.get(frame.sceneNumber);

    const slide = pptx.addSlide();
    slide.background = { color: "0E0F14" };
    // Full bleed image, so the slide matches the live scene exactly.
    slide.addImage({ path: frame.path, x: 0, y: 0, w: 13.333, h: 7.5 });

    if (scene) {
      /*
       * Every pane of a scene carries that scene's notes, with a line saying
       * which pane it is. A presenter reading the notes on page 14 needs to
       * know it is the third of five views of one scene rather than a scene
       * whose notes have been repeated by mistake.
       */
      const paneLine =
        frame.paneCount > 1
          ? `View ${frame.paneIndex} of ${frame.paneCount} of this scene${frame.paneLabel ? `: ${frame.paneLabel}` : ""}.`
          : null;

      const notes = [
        `Scene ${scene.sceneNumber} of ${scenes.length}. Chapter: ${scene.chapter}.`,
        ...(paneLine ? [paneLine] : []),
        `Budget: ${scene.durationSeconds} seconds${frame.paneCount > 1 ? " for the whole scene" : ""}.`,
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

function buildSpeakerScript(scenes: SceneMeta[], frames: SceneFrame[]): string {
  const totalSeconds = scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
  const lines: string[] = [
    "# NFR WorkOS: Live the NFR Day",
    "## Speaker script",
    "",
    "Synthetic institution and data. Illustrative regulatory context, not legal advice.",
    "",
    `Scenes: ${scenes.length}. Pages in the exported deck: ${frames.length}. Total budget: ${Math.round(totalSeconds / 60)} minutes (${totalSeconds} seconds).`,
    "",
    "Three scenes reveal several panes in sequence and are exported as one page",
    "per pane, so the page count exceeds the scene count. The notes on each page",
    "say which view of which scene it is.",
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
    const sceneFrames = frames.filter((frame) => frame.sceneNumber === scene.sceneNumber);
    if (sceneFrames.length > 1) {
      lines.push(`**Exported as ${sceneFrames.length} pages:**`, "");
      for (const frame of sceneFrames) {
        lines.push(`${frame.paneIndex}. ${frame.paneLabel || "(pane)"}`);
      }
      lines.push("");
    }
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

    const frames: SceneFrame[] = [];
    const overflowFailures: string[] = [];

    for (const scene of scenes) {
      const sceneFrames = await captureScene(page, scene.sceneNumber);
      /*
       * Overflow is checked on the page as it stands after the last capture
       * of this scene. That is the same check as before; it is not per pane,
       * because the stage is a fixed box and a pane that overflowed it would
       * be clipped rather than extend the document.
       */
      const overflow = await checkOverflow(page);
      if (overflow.overflows) {
        overflowFailures.push(`Scene ${scene.sceneNumber} (${scene.title}): ${overflow.detail}`);
      }
      frames.push(...sceneFrames);
      console.log(
        `  captured scene ${String(scene.sceneNumber).padStart(2, "0")}  ${scene.title}` +
          (sceneFrames.length > 1 ? `  ${sceneFrames.length} panes` : "") +
          (overflow.overflows ? "  OVERFLOW" : ""),
      );
    }

    await page.close();

    console.log(`\n${frames.length} pages from ${scenes.length} scenes.`);

    const pdfPath = await buildPdf(browser, frames.map((frame) => frame.path));
    console.log(`PDF written to ${pdfPath}`);

    const pptxPath = await buildPptx(scenes, frames);
    console.log(`PowerPoint written to ${pptxPath}`);

    const scriptPath = buildSpeakerScript(scenes, frames);
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

/**
 * Export pipeline for NFROS Risk Audience Presentation V2.4.
 *
 * Reads the deck manifest (`script[data-presentation-slides]`) from the running app,
 * captures every slide in export mode, measures `[data-link-target]` anchors and builds:
 *   exports/NFROS_Risk_Audience_V24_Core.pdf
 *   exports/NFROS_Risk_Audience_V24_Core_and_Appendix.pdf
 *   exports/NFROS_Risk_Audience_V24_Core_and_Appendix.pptx
 *   exports/NFROS_Risk_Audience_V24_Speaker_Notes.md
 *   exports/NFROS_Risk_Audience_V24_Export_Metadata.json
 *   exports/NFROS_Risk_Audience_V24_Export_Hash.txt
 *   exports/slides-v2-4/*.png and docs/screenshots/presentation-v2-4-final/montage-*.png
 * Publishes to public/downloads/ only after scripts/verify-presentation-exports-v2-4.ts passes.
 *
 * Flags:
 *   --client-facing  fail unless brand assets are configured and the brand preflight passes
 *   --draft          allow the data fallback and integrity warnings; never publishes
 *
 * The app must already be running (NFR_BASE_URL, default http://localhost:3000).
 */

import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import PptxGenJS from "pptxgenjs";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

import {
  CORE_PDF_NOTE,
  DECK_NAME,
  DECK_VERSION,
  DELIVERABLES,
  FILE_NAMES,
  SLIDE_H_PX,
  SLIDE_W_PX,
  type ExportFileRecord,
  type ExportMetadata,
  type ManifestEntry,
  type MeasuredAnchor,
  type ResolvedLink,
} from "../src/presentation-v2-4/export/types";
import { cleanCopy, corePageCount, documentSlides, kindLabel, parseManifest, validateManifest } from "../src/presentation-v2-4/export/manifest";
import { countLinks, linkObjectName, linkTooltip, overlappingLinks, resolveLinks } from "../src/presentation-v2-4/export/links";
import { buildImagePdf, type PdfPageInput } from "../src/presentation-v2-4/export/pdf";
import { resolveBrandAssets } from "../src/presentation-v2-4/export/brand";
import { renderMontage, type MontageTile } from "../src/presentation-v2-4/export/montage";

const args = new Set(process.argv.slice(2));
const CLIENT_FACING = args.has("--client-facing");
const DRAFT = args.has("--draft");

const ROOT = process.cwd();
const BASE_URL = process.env.NFR_BASE_URL ?? "http://localhost:3000";
const EXPORT_DIR = join(ROOT, "exports");
const SLIDE_DIR_NAME = "slides-v2-4";
const SLIDE_DIR = join(EXPORT_DIR, SLIDE_DIR_NAME);
const DOWNLOADS_DIR = join(ROOT, "public", "downloads");
const MONTAGE_DIR = join(ROOT, "docs", "screenshots", "presentation-v2-4-final");
const PROOF_SCRIPT = "scripts/verify-presentation-assets-v2-4.ts";
const BRAND_SCRIPT = "scripts/check-accenture-brand.ts";
const VERIFY_SCRIPT = "scripts/verify-presentation-exports-v2-4.ts";
const DSF = 2;
const JPEG_QUALITY = 92;
const READY_TIMEOUT_MS = 30_000;
const SYNTHETIC = "Synthetic institution and data.";
const REGULATORY = "Illustrative regulatory context, not legal advice.";

class ExportError extends Error {}

function fail(message: string): never {
  throw new ExportError(message);
}

function runTsx(script: string, extra: string[] = []): number {
  const cli = join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
  const result = spawnSync(process.execPath, [cli, script, ...extra], { cwd: ROOT, stdio: "inherit" });
  return result.status ?? 1;
}

function sha256(data: Buffer | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

function git(cmd: string): string {
  try {
    return execSync(`git ${cmd}`, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function slideUrl(entryUrl: string): URL {
  const url = new URL(entryUrl, BASE_URL);
  url.searchParams.set("deck", "v2.4");
  url.searchParams.set("export", "1");
  url.searchParams.set("safe", "1");
  return url;
}

function relativeUrl(url: URL): string {
  return `${url.pathname}${url.search}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function imageName(entry: ManifestEntry, index: number): string {
  return `${pad(index + 1)}-${entry.key.replace(/[^A-Za-z0-9-]+/g, "-")}.png`;
}

// ---------------------------------------------------------------------------
// Gates
// ---------------------------------------------------------------------------

interface GateResult {
  brandMode: string;
  brandAssets: ExportMetadata["brandAssets"];
  brandPreflight: ExportMetadata["brandPreflight"];
  productProofGate: ExportMetadata["productProofGate"];
}

function runGates(): GateResult {
  console.log("\nBrand gate");
  const assets = resolveBrandAssets();
  const preflightCode = runTsx(BRAND_SCRIPT);
  const brandPreflight = { status: preflightCode === 0 ? "passed" : "failed", exitCode: preflightCode } as const;
  if (CLIENT_FACING) {
    if (!assets.complete) fail(`Client-facing export blocked. Missing brand assets: ${assets.missing.join(", ")}.`);
    if (preflightCode !== 0) fail("Client-facing export blocked. The Accenture brand preflight failed.");
  }
  const brandMode = assets.complete && preflightCode === 0 ? "Brand preflight passed" : "Development only";
  console.log(`  brand mode: ${brandMode}${assets.complete ? "" : ` (missing: ${assets.missing.join(", ")})`}`);

  console.log("\nProduct proof gate");
  let productProofGate: ExportMetadata["productProofGate"];
  if (existsSync(join(ROOT, PROOF_SCRIPT))) {
    const code = runTsx(PROOF_SCRIPT);
    if (code !== 0) fail(`Product proof gate failed: ${PROOF_SCRIPT} exited with code ${code}.`);
    productProofGate = { status: "passed", script: PROOF_SCRIPT, detail: "Asset verifier passed.", pendingCaptureSlides: [] };
  } else {
    if (CLIENT_FACING) fail(`Client-facing export blocked: ${PROOF_SCRIPT} does not exist, so product proof cannot be verified.`);
    productProofGate = {
      status: "not-run",
      script: PROOF_SCRIPT,
      detail: "Asset verifier not present; the product proof gate could not run.",
      pendingCaptureSlides: [],
    };
  }
  console.log(`  product proof: ${productProofGate.status}`);

  return {
    brandMode,
    brandAssets: { configured: assets.configured, logo: assets.logo, greaterThan: assets.greaterThan, font: assets.font },
    brandPreflight,
    productProofGate,
  };
}

// ---------------------------------------------------------------------------
// Discovery and capture
// ---------------------------------------------------------------------------

async function ensureServer(): Promise<void> {
  try {
    const res = await fetch(slideUrl("/story?core=1"), { signal: AbortSignal.timeout(180_000) });
    if (!res.ok) fail(`The deck returned HTTP ${res.status}.`);
  } catch (err) {
    if (err instanceof ExportError) throw err;
    fail(`The app is not reachable at ${BASE_URL}. Start it with npm run dev and retry.`);
  }
}

async function discover(page: Page): Promise<{ slides: ManifestEntry[]; source: "dom" | "data-fallback" }> {
  await page.goto(slideUrl("/story?core=1").toString(), { waitUntil: "load", timeout: 180_000 });
  await page.waitForSelector(".pv24-slide", { state: "attached", timeout: 60_000 });
  await page
    .waitForSelector("script[data-presentation-slides]", { state: "attached", timeout: 15_000 })
    .catch(() => null);
  const raw = await page.evaluate(() => document.querySelector("script[data-presentation-slides]")?.textContent ?? null);

  if (raw !== null) {
    const slides = parseManifest(raw);
    console.log(`  manifest: ${slides.length} slides from the deck DOM`);
    return { slides, source: "dom" };
  }
  if (!DRAFT) {
    fail(
      "The deck does not publish script[data-presentation-slides] yet. Final exports must come from the DOM contract. Run with --draft for an unpublished draft built from the V2.4 data modules.",
    );
  }
  const { buildFallbackManifest } = await import("../src/presentation-v2-4/export/fallback-manifest");
  const slides = buildFallbackManifest();
  console.warn(`  manifest: DOM manifest absent, draft uses the V2.4 data modules (${slides.length} slides)`);
  return { slides, source: "data-fallback" };
}

interface Capture {
  url: string;
  png: Buffer;
  jpeg: Buffer;
  anchors: MeasuredAnchor[];
  ready: boolean;
  text: string;
  scale: number;
}

async function waitForAssets(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const images = Array.from(document.images);
    await Promise.all(
      images.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.addEventListener("load", () => resolve(), { once: true });
              img.addEventListener("error", () => resolve(), { once: true });
            }),
      ),
    );
    await Promise.all(images.map((img) => img.decode().catch(() => undefined)));
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

async function captureSlide(page: Page, entry: ManifestEntry): Promise<Capture> {
  const url = slideUrl(entry.url);
  await page.goto(url.toString(), { waitUntil: "load", timeout: 120_000 });
  await page.waitForSelector(".pv24-slide", { state: "attached", timeout: 60_000 });
  const ready = await page
    .waitForSelector('.pv24-slide[data-slide-ready="true"]', { state: "attached", timeout: READY_TIMEOUT_MS })
    .then(
      () => true,
      () => false,
    );
  await waitForAssets(page);
  if (!ready) await page.waitForTimeout(1500);

  const state = await page.evaluate((slideW: number) => {
    const slides = document.querySelectorAll(".pv24-slide");
    const slide = slides[0] as HTMLElement | undefined;
    if (!slide) return null;
    const r = slide.getBoundingClientRect();
    const scale = r.width / slideW;
    const anchors: Array<{ target: string; label: string; rect: { x: number; y: number; w: number; h: number } }> = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-link-target]"))) {
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (b.width < 1 || b.height < 1 || cs.visibility === "hidden" || cs.display === "none") continue;
      // Only the visible part is clickable: clip to the slide and to overflow-clipping ancestors
      let left = Math.max(b.left, r.left);
      let top = Math.max(b.top, r.top);
      let right = Math.min(b.right, r.right);
      let bottom = Math.min(b.bottom, r.bottom);
      for (let n = el.parentElement; n && n !== slide; n = n.parentElement) {
        const ns = getComputedStyle(n);
        if (ns.overflowX === "visible" && ns.overflowY === "visible") continue;
        const c = n.getBoundingClientRect();
        if (ns.overflowX !== "visible") {
          left = Math.max(left, c.left);
          right = Math.min(right, c.right);
        }
        if (ns.overflowY !== "visible") {
          top = Math.max(top, c.top);
          bottom = Math.min(bottom, c.bottom);
        }
      }
      if (right - left < 1 || bottom - top < 1) continue;
      anchors.push({
        target: el.getAttribute("data-link-target") ?? "",
        label: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
        rect: { x: (left - r.left) / scale, y: (top - r.top) / scale, w: (right - left) / scale, h: (bottom - top) / scale },
      });
    }
    return {
      count: slides.length,
      clip: { x: r.x, y: r.y, width: r.width, height: r.height },
      scale,
      text: slide.innerText || slide.textContent || "",
      anchors,
    };
  }, SLIDE_W_PX);
  if (!state) fail(`No .pv24-slide element rendered for ${entry.key} (${relativeUrl(url)}).`);

  const shot = { clip: state.clip, animations: "disabled", caret: "hide", scale: "device" } as const;
  const png = await page.screenshot({ ...shot, type: "png" });
  const jpeg = await page.screenshot({ ...shot, type: "jpeg", quality: JPEG_QUALITY });
  return { url: relativeUrl(url), png, jpeg, anchors: state.anchors, ready, text: state.text, scale: state.scale };
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

function notesBody(entry: ManifestEntry, slides: readonly ManifestEntry[]): string {
  const body = cleanCopy(entry.speakerNotes);
  if (body || entry.kind !== "appendix-index") return body;
  const count = slides.filter((s) => s.kind === "appendix").length;
  return `Use this index to open any of the ${count} reference slides. Each entry links to its appendix slide, and every appendix slide links back to the core slide that cites it.`;
}

function headerLine(entry: ManifestEntry, index: number, slides: readonly ManifestEntry[]): string {
  const counts = documentSlides(slides);
  const position =
    entry.kind === "core" ? ` ${entry.coreNumber ?? index + 1} of ${counts.core}` : "";
  return `Slide ${index + 1} of ${slides.length}. ${kindLabel(entry.kind)} slide${position}. Section: ${entry.section || "None"}.`;
}

function linkLine(entry: ManifestEntry, links: readonly ResolvedLink[], slides: readonly ManifestEntry[]): string {
  const out = links.filter((l) => l.sourceIndex === slides.indexOf(entry));
  const chips = out.filter((l) => l.kind === "appendix-chip");
  const ret = out.find((l) => l.kind === "return");
  const parts: string[] = [];
  if (chips.length > 0) {
    parts.push(`Appendix references: ${chips.map((l) => `slide ${l.targetIndex + 1}, ${slides[l.targetIndex]?.title ?? ""}`).join("; ")}.`);
  }
  if (ret) parts.push(`Return link: slide ${ret.targetIndex + 1}, ${slides[ret.targetIndex]?.title ?? ""}.`);
  return cleanCopy(parts.join(" "));
}

function buildNotesMarkdown(
  slides: readonly ManifestEntry[],
  links: readonly ResolvedLink[],
  context: { commit: string; exportedAt: string; brandMode: string },
): string {
  const counts = documentSlides(slides);
  const lines: string[] = [
    "# NFROS Risk Audience Presentation V2.4: speaker notes",
    "",
    `Deck version ${DECK_VERSION}. Exported ${context.exportedAt} from commit ${context.commit.slice(0, 12) || "unknown"}. Brand mode: ${context.brandMode}.`,
    "",
    `${slides.length} slides: ${counts.core} core, ${counts.closing} closing, ${counts.index} appendix index and ${counts.appendix} appendix slides.`,
    "",
    `${SYNTHETIC} ${REGULATORY}`,
    "",
  ];
  const groups: Array<[string, (s: ManifestEntry) => boolean]> = [
    ["Core story", (s) => s.kind === "core"],
    ["Closing", (s) => s.kind === "closing"],
    ["Appendix", (s) => s.kind === "appendix-index" || s.kind === "appendix"],
  ];
  for (const [heading, match] of groups) {
    lines.push(`## ${heading}`, "");
    slides.forEach((entry, index) => {
      if (!match(entry)) return;
      lines.push(`### Slide ${index + 1}: ${cleanCopy(entry.title)}`, "");
      const position = entry.kind === "core" && entry.coreNumber !== null ? ` ${entry.coreNumber} of ${counts.core}` : "";
      const meta = [`${kindLabel(entry.kind)} slide${position}`, `Section: ${entry.section || "None"}`];
      if (entry.group) meta.push(`Group: ${entry.group}`);
      lines.push(`${meta.join(". ")}.`, "");
      lines.push(notesBody(entry, slides), "");
      const link = linkLine(entry, links, slides);
      if (link) lines.push(`_${link}_`, "");
    });
  }
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

// ---------------------------------------------------------------------------
// PPTX
// ---------------------------------------------------------------------------

async function buildPptx(
  slides: readonly ManifestEntry[],
  captures: readonly Capture[],
  links: readonly ResolvedLink[],
): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = `${DECK_NAME} V2.4`;
  pptx.subject = `Deck version ${DECK_VERSION}. Core story, closing discussion and reference appendix. ${SYNTHETIC} ${REGULATORY}`;
  pptx.author = "NFR WorkOS";
  pptx.company = "NFR WorkOS";
  pptx.revision = "1";

  const W_IN = 13.333;
  const H_IN = 7.5;
  const toIn = (px: number, total: number, inches: number) => Math.round((px / total) * inches * 10000) / 10000;

  slides.forEach((entry, index) => {
    const capture = captures[index];
    if (!capture) fail(`Missing capture for ${entry.key}.`);
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    slide.addImage({
      data: `data:image/jpeg;base64,${capture.jpeg.toString("base64")}`,
      x: 0,
      y: 0,
      w: W_IN,
      h: H_IN,
      altText: `Slide ${index + 1}: ${cleanCopy(entry.title)}`,
      objectName: `slide image ${entry.key}`,
    });
    for (const link of links.filter((l) => l.sourceIndex === index)) {
      slide.addShape(pptx.ShapeType.rect, {
        x: toIn(link.rect.x, SLIDE_W_PX, W_IN),
        y: toIn(link.rect.y, SLIDE_H_PX, H_IN),
        w: toIn(link.rect.w, SLIDE_W_PX, W_IN),
        h: toIn(link.rect.h, SLIDE_H_PX, H_IN),
        fill: { color: "FFFFFF", transparency: 100 },
        line: { type: "none" },
        hyperlink: { slide: link.targetIndex + 1, tooltip: cleanCopy(linkTooltip(link, slides)) },
        objectName: linkObjectName(link.target),
      });
    }
    const notes = [headerLine(entry, index, slides), notesBody(entry, slides), linkLine(entry, links, slides)]
      .filter(Boolean)
      .join("  ");
    slide.addNotes(notes);
  });

  const out = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.from(out as ArrayBuffer);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`NFROS V2.4 export (${DRAFT ? "draft" : "release"}, ${CLIENT_FACING ? "client-facing" : "internal review"})`);
  const gates = runGates();

  await ensureServer();
  for (const dir of [EXPORT_DIR, SLIDE_DIR, MONTAGE_DIR, DOWNLOADS_DIR]) mkdirSync(dir, { recursive: true });
  for (const file of readdirSync(SLIDE_DIR)) {
    if (/\.(png|jpe?g|html)$/i.test(file)) unlinkSync(join(SLIDE_DIR, file));
  }

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch();
    const context: BrowserContext = await browser.newContext({
      viewport: { width: SLIDE_W_PX, height: SLIDE_H_PX },
      deviceScaleFactor: DSF,
      colorScheme: "light",
      reducedMotion: "reduce",
    });
    await context.addInitScript({ content: "window.__name = window.__name || function (f) { return f; };" });
    const page = await context.newPage();

    console.log("\nDiscovering slides");
    const { slides, source } = await discover(page);
    const problems: string[] = [];
    problems.push(...validateManifest(slides));

    console.log(`\nCapturing ${slides.length} slides at ${SLIDE_W_PX}x${SLIDE_H_PX}, device scale ${DSF}`);
    const captures: Capture[] = [];
    const seen = new Map<string, string>();
    for (const [index, entry] of slides.entries()) {
      const capture = await captureSlide(page, entry);
      captures.push(capture);
      writeFileSync(join(SLIDE_DIR, imageName(entry, index)), capture.png);

      if (!capture.ready) problems.push(`${entry.key}: data-slide-ready="true" was not observed within ${READY_TIMEOUT_MS / 1000}s.`);
      if (Math.abs(capture.scale - 1) > 0.01) problems.push(`${entry.key}: slide rendered at scale ${capture.scale.toFixed(3)}, not 1.`);
      if (!normalise(capture.text).includes(normalise(entry.title))) {
        problems.push(`${entry.key}: the captured page does not show the title "${entry.title}" (${capture.url}).`);
      }
      const digest = sha256(capture.png);
      const dup = seen.get(digest);
      if (dup) problems.push(`${entry.key}: capture is identical to ${dup}; the URL ${capture.url} did not open the right slide.`);
      seen.set(digest, entry.key);
      if (!notesBody(entry, slides)) problems.push(`${entry.key}: speaker notes are empty.`);
      const flag = capture.ready ? "" : " (no ready signal)";
      console.log(`  ${pad(index + 1)} ${entry.key.padEnd(16)} anchors ${capture.anchors.length}${flag}`);
    }
    await context.close();

    const anchors = captures.map((c) => c.anchors);
    const coreCount = corePageCount(slides);
    const full = resolveLinks(slides, anchors, slides.length);
    const core = resolveLinks(slides, anchors, coreCount);
    problems.push(...full.unresolved);

    // A cited appendix slide must return to a core slide that cites it; uncited ones may return anywhere in the core.
    const notices: string[] = [];
    for (const [index, entry] of slides.entries()) {
      if (entry.kind !== "appendix") continue;
      const citedBy = full.links.filter((l) => l.targetIndex === index && l.kind === "appendix-chip").map((l) => l.sourceIndex);
      const back = full.links.filter((l) => l.sourceIndex === index && l.kind === "return");
      if (back.length === 0) problems.push(`${entry.key}: no return control (data-link-target="core:N") found.`);
      for (const link of back) {
        if (citedBy.length === 0) {
          notices.push(`${entry.key} is not cited by any core slide; its return control goes to slide ${link.targetIndex + 1}.`);
        } else if (!citedBy.includes(link.targetIndex)) {
          problems.push(`${entry.key}: return goes to slide ${link.targetIndex + 1}, but it is cited from slide(s) ${citedBy.map((i) => i + 1).join(", ")}.`);
        }
      }
    }
    for (const [a, b] of overlappingLinks(full.links)) {
      notices.push(`${slides[a.sourceIndex]?.key ?? ""}: link areas for "${a.target}" and "${b.target}" overlap; "${b.target}" is on top.`);
    }
    const pendingCaptures = slides.filter((_, i) => /capture pending/i.test(captures[i]?.text ?? "")).map((s) => s.key);
    gates.productProofGate.pendingCaptureSlides = pendingCaptures;
    if (pendingCaptures.length > 0) {
      const msg = `Product capture placeholders ("Capture pending") on: ${pendingCaptures.join(", ")}.`;
      if (CLIENT_FACING) fail(`Client-facing export blocked. ${msg}`);
      console.warn(`\n${msg}`);
    }
    if (notices.length > 0) console.log(`\nLink notices:\n${notices.map((n) => `  - ${n}`).join("\n")}`);
    const indexPage = slides.findIndex((s) => s.kind === "appendix-index");
    for (const [index, entry] of slides.entries()) {
      if (entry.kind !== "appendix") continue;
      if (!full.links.some((l) => l.sourceIndex === indexPage && l.targetIndex === index)) {
        problems.push(`${entry.key}: the appendix index has no link to this slide.`);
      }
    }
    for (const [index, entry] of slides.entries()) {
      const cites = entry.kind === "core" || entry.kind === "closing";
      const chipsExpected = cites ? (anchors[index]?.filter((a) => a.target.startsWith("appendix:")).length ?? 0) : 0;
      const chipsLinked = full.links.filter((l) => l.sourceIndex === index && l.kind === "appendix-chip").length;
      if (chipsLinked !== chipsExpected) problems.push(`${entry.key}: ${chipsExpected} appendix chips measured but ${chipsLinked} linked.`);
    }

    if (problems.length > 0) {
      const list = problems.map((p) => `  - ${p}`).join("\n");
      if (!DRAFT) fail(`Export integrity checks failed:\n${list}`);
      console.warn(`\nDraft integrity warnings (${problems.length}):\n${list}`);
    }

    const exportedAt = new Date();
    const commit = git("rev-parse HEAD") || "unknown";
    const dirty = git("status --porcelain").length > 0;

    console.log("\nBuilding PDFs");
    const pdfMeta = {
      author: "NFR WorkOS",
      creator: `NFR WorkOS presentation export ${DECK_VERSION}`,
      producer: "NFR WorkOS export pipeline (pdf-lib)",
      date: exportedAt,
    };
    const toPages = (count: number, links: readonly ResolvedLink[]): PdfPageInput[] =>
      captures.slice(0, count).map((capture, index) => ({
        image: capture.jpeg,
        format: "jpeg",
        links: links
          .filter((l) => l.sourceIndex === index)
          .map((l) => ({ rect: l.rect, targetIndex: l.targetIndex, name: linkObjectName(l.target), tooltip: cleanCopy(linkTooltip(l, slides)) })),
      }));

    const corePdf = await buildImagePdf(toPages(coreCount, core.links), {
      ...pdfMeta,
      title: `${DECK_NAME} V2.4: core`,
      subject: `Deck version ${DECK_VERSION}. Core story and closing discussion, ${coreCount} slides. ${CORE_PDF_NOTE}`,
      keywords: ["NFROS", "deck v2.4", "core", "appendix references resolve in the full deck"],
    });
    const fullPdf = await buildImagePdf(toPages(slides.length, full.links), {
      ...pdfMeta,
      title: `${DECK_NAME} V2.4: core and appendix`,
      subject: `Deck version ${DECK_VERSION}. Core story, closing discussion, appendix index and appendix, ${slides.length} slides with internal links.`,
      keywords: ["NFROS", "deck v2.4", "core", "appendix", "internal links"],
    });
    writeFileSync(join(EXPORT_DIR, FILE_NAMES.corePdf), corePdf);
    writeFileSync(join(EXPORT_DIR, FILE_NAMES.fullPdf), fullPdf);
    console.log(`  core PDF ${coreCount} pages, ${core.links.length} links (${core.skippedAppendixRefs} appendix references left unlinked)`);
    console.log(`  full PDF ${slides.length} pages, ${full.links.length} links`);

    console.log("\nBuilding PPTX");
    const pptx = await buildPptx(slides, captures, full.links);
    writeFileSync(join(EXPORT_DIR, FILE_NAMES.pptx), pptx);
    console.log(`  ${slides.length} slides, ${full.links.length} link shapes`);

    const notes = buildNotesMarkdown(slides, full.links, {
      commit,
      exportedAt: exportedAt.toISOString(),
      brandMode: gates.brandMode,
    });
    writeFileSync(join(EXPORT_DIR, FILE_NAMES.notes), notes, "utf8");

    const files: ExportFileRecord[] = DELIVERABLES.map((name) => {
      const data = readFileSync(join(EXPORT_DIR, name));
      return { name, bytes: data.length, sha256: sha256(data) };
    });
    const counts = documentSlides(slides);
    const fullCounts = countLinks(full.links.map((l) => l.kind));
    const metadata: ExportMetadata = {
      deckVersion: DECK_VERSION,
      deckName: DECK_NAME,
      exportedAt: exportedAt.toISOString(),
      gitCommit: commit,
      workingTreeDirty: dirty,
      mode: DRAFT ? "draft" : "release",
      audience: CLIENT_FACING ? "client-facing" : "internal-review",
      brandMode: gates.brandMode,
      brandAssets: gates.brandAssets,
      brandPreflight: gates.brandPreflight,
      productProofGate: gates.productProofGate,
      manifestSource: source,
      capture: {
        viewport: `${SLIDE_W_PX}x${SLIDE_H_PX}`,
        deviceScaleFactor: DSF,
        documentImageFormat: "jpeg",
        jpegQuality: JPEG_QUALITY,
        readySignalObserved: captures.filter((c) => c.ready).length,
        readySignalMissing: slides.filter((_, i) => !captures[i]?.ready).map((s) => s.key),
      },
      slideCounts: {
        core: counts.core,
        closing: counts.closing,
        appendixIndex: counts.index,
        appendix: counts.appendix,
        total: slides.length,
        corePdfPages: coreCount,
        fullPdfPages: slides.length,
        pptxSlides: slides.length,
      },
      links: {
        corePdf: countLinks(core.links.map((l) => l.kind)),
        corePdfAppendixRefsNotLinked: core.skippedAppendixRefs,
        fullPdf: fullCounts,
        pptx: fullCounts,
      },
      corePdfNote: CORE_PDF_NOTE,
      files,
      slides: slides.map((entry, index) => ({
        page: index + 1,
        key: entry.key,
        kind: entry.kind,
        coreNumber: entry.coreNumber,
        id: entry.id,
        title: entry.title,
        section: entry.section,
        group: entry.group,
        url: captures[index]?.url ?? "",
        image: `${SLIDE_DIR_NAME}/${imageName(entry, index)}`,
        links: full.links
          .filter((l) => l.sourceIndex === index)
          .map((l) => ({ target: l.target, kind: l.kind, targetPage: l.targetIndex + 1, rect: l.rect })),
      })),
      integrityWarnings: problems,
      linkNotices: notices,
      disclosures: { syntheticData: SYNTHETIC, regulatory: REGULATORY },
    };
    const metaText = `${JSON.stringify(metadata, null, 2)}\n`;
    writeFileSync(join(EXPORT_DIR, FILE_NAMES.metadata), metaText, "utf8");

    const hashLines = [
      `${DECK_NAME} V2.4 export hashes (SHA-256)`,
      `Deck version ${DECK_VERSION}. Commit ${commit}. Exported ${exportedAt.toISOString()}. Brand mode: ${gates.brandMode}.`,
      "",
      ...files.map((f) => `${f.sha256}  ${f.name}`),
      `${sha256(Buffer.from(metaText, "utf8"))}  ${FILE_NAMES.metadata}`,
    ];
    writeFileSync(join(EXPORT_DIR, FILE_NAMES.hash), `${hashLines.join("\n")}\n`, "utf8");

    console.log("\nBuilding montages");
    const tile = (entry: ManifestEntry, index: number): MontageTile => ({
      file: imageName(entry, index),
      number: pad(index + 1),
      section: entry.kind === "appendix" ? `${entry.group ?? entry.section}  |  ${entry.id}` : entry.section || kindLabel(entry.kind),
      title: entry.title,
    });
    const coreTiles = slides.slice(0, coreCount).map(tile);
    const appendixTiles = slides.map(tile).slice(coreCount);
    await renderMontage(
      browser,
      SLIDE_DIR,
      coreTiles,
      "NFROS Risk Audience Presentation V2.4: core story and closing",
      `${coreTiles.length} slides in play order. Exported ${exportedAt.toISOString().slice(0, 10)}, commit ${commit.slice(0, 12)}, brand mode ${gates.brandMode}.`,
      join(MONTAGE_DIR, "montage-core.png"),
    );
    await renderMontage(
      browser,
      SLIDE_DIR,
      appendixTiles,
      "NFROS Risk Audience Presentation V2.4: appendix index and appendix",
      `${appendixTiles.length} slides in deck order. Exported ${exportedAt.toISOString().slice(0, 10)}, commit ${commit.slice(0, 12)}, brand mode ${gates.brandMode}.`,
      join(MONTAGE_DIR, "montage-appendix.png"),
    );
    console.log("  montage-core.png and montage-appendix.png written");
    await browser.close();
    browser = null;

    console.log("\nVerifying exports");
    if (runTsx(VERIFY_SCRIPT, ["--exports-only"]) !== 0) fail("Export verification failed; nothing was published.");

    if (DRAFT || source !== "dom") {
      console.log("\nDraft export: verification passed, public/downloads/ left unchanged.");
      return;
    }

    console.log("\nPublishing to public/downloads/");
    for (const name of [...DELIVERABLES, FILE_NAMES.metadata, FILE_NAMES.hash]) {
      copyFileSync(join(EXPORT_DIR, name), join(DOWNLOADS_DIR, name));
      console.log(`  ${name} (${statSync(join(DOWNLOADS_DIR, name)).size} bytes)`);
    }
    if (runTsx(VERIFY_SCRIPT) !== 0) fail("Verification of the published downloads failed.");
    console.log("\nExport complete.");
  } finally {
    if (browser) await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error("\nExport failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

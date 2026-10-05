/**
 * Verifies the NFROS V2.4 presentation exports in exports/ (and, unless --exports-only,
 * the published copies in public/downloads/). Exits non-zero on any failure.
 *
 * Run with: npm run verify:presentation-exports
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

import {
  DECK_VERSION,
  DELIVERABLES,
  FILE_NAMES,
  LINK_KINDS,
  type ExportMetadata,
  type LinkCounts,
  type LinkKind,
  type ManifestEntry,
} from "../src/presentation-v2-4/export/types";
import { classifyLink, parseLinkTarget, resolveTargetIndex, targetFromObjectName } from "../src/presentation-v2-4/export/links";
import { cleanCopy, parseManifest, validateManifest } from "../src/presentation-v2-4/export/manifest";
import { inspectPdf, PAGE_H_PT, PAGE_W_PT, slideRectToPdf, type PdfInspection } from "../src/presentation-v2-4/export/pdf";
import { inspectPptx, type PptxInspection } from "../src/presentation-v2-4/export/pptx-inspect";
import { loadEnvValues, scanText } from "../src/presentation-v2-4/export/safety";

const EXPORTS_ONLY = process.argv.includes("--exports-only");
const ROOT = process.cwd();
const EXPORT_DIR = join(ROOT, "exports");
const DOWNLOADS_DIR = join(ROOT, "public", "downloads");
const BASE_URL = process.env.NFR_BASE_URL ?? "http://localhost:3000";

type Level = "PASS" | "FAIL" | "WARN" | "SKIP";
const results: Array<{ level: Level; label: string; detail: string[] }> = [];

function check(label: string, pass: boolean, detail: string[] | string = []): boolean {
  const lines = Array.isArray(detail) ? detail : [detail];
  results.push({ level: pass ? "PASS" : "FAIL", label, detail: pass ? [] : lines });
  return pass;
}
function note(level: "WARN" | "SKIP", label: string, detail: string[] | string = []): void {
  results.push({ level, label, detail: Array.isArray(detail) ? detail : [detail] });
}

function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function tally(kinds: readonly LinkKind[]): LinkCounts {
  const counts = Object.fromEntries(LINK_KINDS.map((k) => [k, 0])) as Record<LinkKind, number>;
  for (const k of kinds) counts[k]++;
  return { ...counts, total: kinds.length };
}

function sameCounts(a: LinkCounts, b: LinkCounts | undefined): boolean {
  return Boolean(b) && LINK_KINDS.every((k) => a[k] === b?.[k]) && a.total === b?.total;
}

function fmtCounts(c: LinkCounts): string {
  return LINK_KINDS.filter((k) => c[k] > 0).map((k) => `${k} ${c[k]}`).join(", ") || "none";
}

function toManifest(meta: ExportMetadata): ManifestEntry[] {
  return meta.slides.map((s) => ({
    key: s.key,
    kind: s.kind,
    position: s.page,
    coreNumber: s.coreNumber,
    id: s.id,
    title: s.title,
    section: s.section,
    group: s.group,
    url: s.url,
    speakerNotes: "",
  }));
}

// ---------------------------------------------------------------------------

interface LinkCheck {
  kinds: LinkKind[];
  problems: string[];
  perPage: Map<number, Array<{ target: string; dest: number }>>;
}

function checkPdfLinks(pdf: PdfInspection, manifest: readonly ManifestEntry[], label: string): LinkCheck {
  const problems: string[] = [];
  const kinds: LinkKind[] = [];
  const perPage = new Map<number, Array<{ target: string; dest: number }>>();
  for (const link of pdf.links) {
    const where = `${label} page ${link.pageIndex + 1}`;
    const source = manifest[link.pageIndex];
    if (link.actionType !== "GoTo") problems.push(`${where}: link action is ${link.actionType}, expected GoTo.`);
    if (link.destPageIndex === null || link.destPageIndex < 0 || link.destPageIndex >= pdf.pageCount) {
      problems.push(`${where}: GoTo target page is not in the document.`);
      continue;
    }
    const target = targetFromObjectName(link.name);
    const parsed = target ? parseLinkTarget(target) : null;
    if (!target || !parsed || !source) {
      problems.push(`${where}: link has no recognisable target name ("${link.name}").`);
      continue;
    }
    const expected = resolveTargetIndex(parsed, manifest);
    if (expected !== link.destPageIndex) {
      problems.push(`${where}: "${target}" goes to page ${link.destPageIndex + 1} but the manifest places it on page ${expected + 1}.`);
    }
    const [x1, y1, x2, y2] = link.rect;
    if (!(x1 >= -0.5 && y1 >= -0.5 && x2 <= PAGE_W_PT + 0.5 && y2 <= PAGE_H_PT + 0.5 && x2 - x1 > 1 && y2 - y1 > 1)) {
      problems.push(`${where}: link rectangle [${link.rect.join(", ")}] is outside the page or empty.`);
    }
    kinds.push(classifyLink(source.kind, parsed));
    const list = perPage.get(link.pageIndex) ?? [];
    list.push({ target, dest: link.destPageIndex });
    perPage.set(link.pageIndex, list);
  }
  return { kinds, problems, perPage };
}

function checkPdf(
  name: string,
  pdf: PdfInspection,
  meta: ExportMetadata,
  manifest: readonly ManifestEntry[],
  scope: "core" | "full",
): void {
  const expectedPages = scope === "full" ? manifest.length : meta.slideCounts.corePdfPages;
  const coreAndClosing = manifest.filter((s) => s.kind === "core" || s.kind === "closing").length;
  check(`${name}: page count ${pdf.pageCount} matches the manifest (${expectedPages})`, pdf.pageCount === expectedPages && (scope === "full" || expectedPages === coreAndClosing));
  const badSize = pdf.pageSizes.findIndex((s) => Math.abs(s.width - PAGE_W_PT) > 0.5 || Math.abs(s.height - PAGE_H_PT) > 0.5);
  check(`${name}: every page is 16:9 (${PAGE_W_PT} x ${PAGE_H_PT} pt)`, badSize < 0, `page ${badSize + 1} has a different size`);

  const linkCheck = checkPdfLinks(pdf, manifest, name);
  const counts = tally(linkCheck.kinds);
  check(`${name}: every GoTo target is a valid page and the right slide (${pdf.links.length} links)`, linkCheck.problems.length === 0, linkCheck.problems);
  check(
    `${name}: link counts match the export metadata (${fmtCounts(counts)})`,
    sameCounts(counts, scope === "full" ? meta.links.fullPdf : meta.links.corePdf),
  );

  if (scope === "core") {
    const toAppendix = pdf.links.filter((l) => /^link (appendix|appendix-index)/.test(l.name));
    check(`${name}: no links to appendix pages that the core file does not contain`, toAppendix.length === 0, `${toAppendix.length} appendix links found`);
    check(`${name}: metadata notes that appendix references resolve in the full deck`, /resolve in the full deck/i.test(pdf.info.subject) && /full deck/i.test(meta.corePdfNote));
    return;
  }

  check(`${name}: link annotations exist`, pdf.links.length > 0);
  const geometry: string[] = [];
  meta.slides.forEach((slide, index) => {
    const actual = (linkCheck.perPage.get(index) ?? []).map((l) => `${l.target}>${l.dest + 1}`).sort();
    const expected = slide.links.map((l) => `${l.target}>${l.targetPage}`).sort();
    if (actual.join("|") !== expected.join("|")) geometry.push(`page ${index + 1}: annotations [${actual.join(", ")}] differ from measured anchors [${expected.join(", ")}]`);
  });
  pdf.links.forEach((link) => {
    const recorded = meta.slides[link.pageIndex]?.links.find(
      (l) => `link ${l.target}` === link.name && slideRectToPdf(l.rect, PAGE_W_PT, PAGE_H_PT).every((v, i) => Math.abs(v - (link.rect[i] ?? NaN)) < 0.6),
    );
    if (!recorded) geometry.push(`page ${link.pageIndex + 1}: "${link.name}" rectangle does not match any measured anchor`);
  });
  check(`${name}: annotations sit on the measured DOM anchors`, geometry.length === 0, geometry);

  const returns: string[] = [];
  const uncited: string[] = [];
  const indexPage = manifest.findIndex((s) => s.kind === "appendix-index");
  const isCore = (i: number) => manifest[i]?.kind === "core" || manifest[i]?.kind === "closing";
  manifest.forEach((entry, index) => {
    if (entry.kind !== "appendix") return;
    const citedBy = Array.from(linkCheck.perPage.entries())
      .filter(([page, list]) => isCore(page) && list.some((l) => l.dest === index))
      .map(([page]) => page);
    const back = (linkCheck.perPage.get(index) ?? []).filter((l) => l.target.startsWith("core:"));
    if (back.length === 0) returns.push(`${entry.key} (page ${index + 1}) has no return link`);
    for (const b of back) {
      if (!isCore(b.dest)) returns.push(`${entry.key} return goes to page ${b.dest + 1}, which is not a core slide`);
      else if (citedBy.length > 0 && !citedBy.includes(b.dest)) {
        returns.push(`${entry.key} returns to page ${b.dest + 1}, but it is cited from page(s) ${citedBy.map((p) => p + 1).join(", ")}`);
      } else if (citedBy.length === 0) uncited.push(`${entry.key} (page ${index + 1}) is not cited by any core slide; its return goes to page ${b.dest + 1}`);
    }
    if (!(linkCheck.perPage.get(indexPage) ?? []).some((l) => l.dest === index)) {
      returns.push(`${entry.key} is not linked from the appendix index (page ${indexPage + 1})`);
    }
  });
  check(`${name}: every cited appendix page returns to its origin core page and every appendix page is in the index`, returns.length === 0, returns);
  if (uncited.length > 0) note("WARN", `${name}: ${uncited.length} appendix pages have no citing core slide (reachable from the index)`, uncited);
  const chipPages = manifest
    .map((s, i) => ({ s, i }))
    .filter(({ s, i }) => (s.kind === "core" || s.kind === "closing") && (linkCheck.perPage.get(i) ?? []).some((l) => l.target.startsWith("appendix:")));
  check(`${name}: core reference chips are linked on ${chipPages.length} core pages`, chipPages.length > 0);
}

function checkPptx(pptx: PptxInspection, meta: ExportMetadata, manifest: readonly ManifestEntry[]): void {
  const name = FILE_NAMES.pptx;
  check(`${name}: opens as a ZIP package with ${pptx.slideCount} slides (manifest ${manifest.length})`, pptx.slideCount === manifest.length);
  const noImage = pptx.slides.filter((s) => s.imageCount < 1).map((s) => `slide ${s.number}`);
  check(`${name}: every slide carries its full-bleed image`, noImage.length === 0, noImage);

  const notes: string[] = [];
  pptx.slides.forEach((s, i) => {
    const entry = manifest[i];
    if (!s.notesPart) notes.push(`slide ${s.number}: no notes part`);
    else if (s.notesText.length < 40) notes.push(`slide ${s.number}: notes are empty or too short`);
    else if (!s.notesText.startsWith(`Slide ${i + 1} of ${manifest.length}.`)) notes.push(`slide ${s.number}: notes do not belong to this slide`);
    if (entry && entry.kind === "appendix" && s.notesText.includes("Section: None")) notes.push(`slide ${s.number}: section missing`);
  });
  check(`${name}: speaker notes on every slide`, notes.length === 0, notes);

  const problems: string[] = [];
  const kinds: LinkKind[] = [];
  pptx.slides.forEach((s, i) => {
    const source = manifest[i];
    for (const link of s.links) {
      const where = `slide ${s.number} "${link.name}"`;
      if (link.action !== "ppaction://hlinksldjump") problems.push(`${where}: action ${link.action || "none"}`);
      if (link.targetSlide === null || link.targetSlide < 1 || link.targetSlide > pptx.slideCount) {
        problems.push(`${where}: relationship ${link.relTarget || "missing"} does not point to an existing slide`);
        continue;
      }
      const target = targetFromObjectName(link.name);
      const parsed = target ? parseLinkTarget(target) : null;
      if (!parsed || !source) {
        problems.push(`${where}: no recognisable target name`);
        continue;
      }
      const expected = resolveTargetIndex(parsed, manifest) + 1;
      if (expected !== link.targetSlide) problems.push(`${where}: goes to slide ${link.targetSlide}, manifest expects ${expected}`);
      kinds.push(classifyLink(source.kind, parsed));
    }
    const expectedCount = meta.slides[i]?.links.length ?? 0;
    if (s.links.length !== expectedCount) problems.push(`slide ${s.number}: ${s.links.length} link shapes, ${expectedCount} measured anchors`);
  });
  const counts = tally(kinds);
  check(`${name}: internal slide hyperlinks point to existing, correct slides (${kinds.length} links)`, problems.length === 0 && kinds.length > 0, problems);
  check(`${name}: link counts match the export metadata (${fmtCounts(counts)})`, sameCounts(counts, meta.links.pptx));
  check(`${name}: document properties reference deck V2.4`, /V2\.4|v2\.4/.test(pptx.coreXml));
}

function checkNotes(md: string, manifest: readonly ManifestEntry[]): void {
  const name = FILE_NAMES.notes;
  const headings = Array.from(md.matchAll(/^### Slide (\d+): (.+)$/gm));
  const problems: string[] = [];
  if (headings.length !== manifest.length) problems.push(`${headings.length} slide headings, manifest has ${manifest.length}`);
  headings.forEach((h, i) => {
    const entry = manifest[i];
    if (!entry) return;
    if (Number(h[1]) !== i + 1) problems.push(`heading ${i + 1} is numbered ${h[1]}`);
    if ((h[2] ?? "").trim() !== cleanCopy(entry.title)) problems.push(`slide ${i + 1}: heading "${h[2]}" does not match "${entry.title}"`);
    const start = (h.index ?? 0) + h[0].length;
    const end = headings[i + 1]?.index ?? md.length;
    const body = md.slice(start, end).replace(/^## .*$/gm, "").trim();
    if (!/Section: /.test(body)) problems.push(`slide ${i + 1}: section line missing`);
    if (body.split("\n").filter((l) => l.trim()).length < 2 || body.length < 60) problems.push(`slide ${i + 1}: notes are empty`);
  });
  check(`${name}: every slide in order with number, section, title and notes`, problems.length === 0, problems);
  check(`${name}: references deck version v2.4`, md.includes(`Deck version ${DECK_VERSION}`) && md.includes("V2.4"));
}

async function liveCrossCheck(manifest: readonly ManifestEntry[]): Promise<void> {
  const url = new URL("/story", BASE_URL);
  for (const [k, v] of Object.entries({ deck: "v2.4", core: "1", export: "1", safe: "1" })) url.searchParams.set(k, v);
  let html: string;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    html = await res.text();
  } catch {
    note("SKIP", "Live deck cross-check: app not reachable");
    return;
  }
  const match = /<script[^>]*data-presentation-slides[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!match?.[1]) {
    note("SKIP", "Live deck cross-check: manifest not present in the server HTML");
    return;
  }
  let live: ManifestEntry[];
  try {
    live = parseManifest(match[1]);
  } catch {
    note("SKIP", "Live deck cross-check: server HTML manifest could not be parsed");
    return;
  }
  const a = live.map((s) => `${s.key}|${s.title}`).join("\n");
  const b = manifest.map((s) => `${s.key}|${s.title}`).join("\n");
  check("Live deck cross-check: exported slide order and titles match the running deck", a === b, "the deck changed since export; re-run the export");
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`Verifying NFROS V2.4 presentation exports${EXPORTS_ONLY ? " (exports only)" : ""}\n`);

  const minSize: Record<string, number> = {
    [FILE_NAMES.corePdf]: 200_000,
    [FILE_NAMES.fullPdf]: 200_000,
    [FILE_NAMES.pptx]: 200_000,
    [FILE_NAMES.notes]: 2_000,
    [FILE_NAMES.metadata]: 1_000,
    [FILE_NAMES.hash]: 200,
  };
  let missing = false;
  for (const [name, min] of Object.entries(minSize)) {
    const path = join(EXPORT_DIR, name);
    const size = existsSync(path) ? statSync(path).size : -1;
    if (!check(`${name}: exists and is non-trivial (${size < 0 ? "missing" : `${size} bytes`})`, size > min)) missing = true;
  }
  if (missing) return;

  const read = (name: string) => readFileSync(join(EXPORT_DIR, name));
  const metaText = read(FILE_NAMES.metadata).toString("utf8");
  let meta: ExportMetadata;
  try {
    meta = JSON.parse(metaText) as ExportMetadata;
  } catch (err) {
    check("Metadata parses as JSON", false, String(err));
    return;
  }
  const required = ["deckVersion", "gitCommit", "exportedAt", "brandMode", "slideCounts", "links", "files", "slides", "productProofGate"] as const;
  const absent = required.filter((k) => !(k in meta));
  check("Metadata: required fields present", absent.length === 0, `missing: ${absent.join(", ")}`);
  if (absent.length > 0) return;
  check(`Metadata: deck version is ${DECK_VERSION}`, meta.deckVersion === DECK_VERSION);
  check("Metadata: git commit recorded", /^[0-9a-f]{40}$/.test(meta.gitCommit));
  check(`Metadata: brand mode recorded ("${meta.brandMode}")`, typeof meta.brandMode === "string" && meta.brandMode.length > 0);

  const manifest = toManifest(meta);
  const order = validateManifest(manifest);
  check(`Manifest order: ${manifest.length} slides, core, closing, appendix index, appendix`, order.length === 0, order);
  const sc = meta.slideCounts;
  const kindCount = (k: ManifestEntry["kind"]) => manifest.filter((s) => s.kind === k).length;
  check(
    `Metadata: slide counts (${sc.core} core, ${sc.closing} closing, ${sc.appendixIndex} index, ${sc.appendix} appendix) agree with the manifest`,
    sc.core === kindCount("core") && sc.closing === kindCount("closing") && sc.appendixIndex === kindCount("appendix-index") &&
      sc.appendix === kindCount("appendix") && sc.total === manifest.length && sc.pptxSlides === manifest.length,
  );

  const hashProblems: string[] = [];
  for (const name of DELIVERABLES) {
    const rec = meta.files.find((f) => f.name === name);
    const actual = sha256(read(name));
    if (!rec) hashProblems.push(`${name}: not listed in metadata`);
    else if (rec.sha256 !== actual) hashProblems.push(`${name}: metadata ${rec.sha256.slice(0, 12)}, file ${actual.slice(0, 12)}`);
  }
  check("Metadata: SHA-256 of every deliverable matches", hashProblems.length === 0, hashProblems);
  const hashText = read(FILE_NAMES.hash).toString("utf8");
  const hashFileProblems: string[] = [];
  for (const name of [...DELIVERABLES, FILE_NAMES.metadata]) {
    const actual = sha256(read(name));
    if (!hashText.includes(`${actual}  ${name}`)) hashFileProblems.push(`${name}: hash line missing or stale`);
  }
  check(`${FILE_NAMES.hash}: SHA-256 lines match every file`, hashFileProblems.length === 0, hashFileProblems);

  const corePdf = await inspectPdf(read(FILE_NAMES.corePdf));
  const fullPdf = await inspectPdf(read(FILE_NAMES.fullPdf));
  checkPdf(FILE_NAMES.corePdf, corePdf, meta, manifest, "core");
  checkPdf(FILE_NAMES.fullPdf, fullPdf, meta, manifest, "full");
  check("PDFs: titles and subjects reference deck v2.4", [corePdf, fullPdf].every((p) => /V2\.4/.test(p.info.title) && /v2\.4/.test(p.info.subject)));

  let pptx: PptxInspection | null = null;
  try {
    pptx = inspectPptx(read(FILE_NAMES.pptx));
  } catch (err) {
    check(`${FILE_NAMES.pptx}: opens as a ZIP package`, false, err instanceof Error ? err.message : String(err));
  }
  if (pptx) checkPptx(pptx, meta, manifest);

  const notesMd = read(FILE_NAMES.notes).toString("utf8");
  checkNotes(notesMd, manifest);

  const envValues = loadEnvValues(ROOT);
  const forbidden = [ROOT, ROOT.replace(/\\/g, "/")];
  const strict = { envValues, forbidden, checkDashes: true };
  // Masters, layouts and themes are library boilerplate (bullet glyphs), not deck copy
  const authored = (part: string) => /^(ppt\/slides\/|ppt\/notesSlides\/|docProps\/)/.test(part);
  const issues: string[] = [
    ...scanText(FILE_NAMES.metadata, metaText, strict),
    ...scanText(FILE_NAMES.hash, hashText, strict),
    ...scanText(FILE_NAMES.notes, notesMd, strict),
    ...(pptx?.xmlParts.flatMap((p) => scanText(`${FILE_NAMES.pptx}/${p.part}`, p.text, { ...strict, checkDashes: authored(p.part) })) ?? []),
  ];
  for (const [name, pdf] of [[FILE_NAMES.corePdf, corePdf], [FILE_NAMES.fullPdf, fullPdf]] as const) {
    issues.push(...scanText(`${name} metadata`, Object.values(pdf.info).join("\n"), strict));
    pdf.textStreams.forEach((t, i) => issues.push(...scanText(`${name} stream ${i}`, t, { ...strict, checkDashes: false })));
  }
  check("No secrets, .env values, local paths or em/en dashes in text layers, notes or metadata", issues.length === 0, issues);

  if (meta.manifestSource !== "dom") note("WARN", "Slide list came from the data fallback, not the deck DOM manifest (draft only)");
  if (meta.integrityWarnings.length > 0) note("WARN", `${meta.integrityWarnings.length} capture integrity warnings recorded (draft only)`, meta.integrityWarnings);
  if ((meta.linkNotices ?? []).length > 0) note("WARN", `${meta.linkNotices.length} link notices recorded at export`, meta.linkNotices);
  if (meta.productProofGate.status !== "passed") note("WARN", `Product proof gate: ${meta.productProofGate.detail}`);
  const pending = meta.productProofGate.pendingCaptureSlides ?? [];
  if (pending.length > 0) {
    if (meta.audience === "client-facing") check("Client-facing export has no product capture placeholders", false, pending);
    else note("WARN", `Product capture placeholders shown on ${pending.length} slide(s)`, pending);
  }

  await liveCrossCheck(manifest);

  if (!EXPORTS_ONLY) {
    check(
      "Release export: DOM manifest, release mode and no integrity warnings",
      meta.manifestSource === "dom" && meta.mode === "release" && meta.integrityWarnings.length === 0,
      `manifest ${meta.manifestSource}, mode ${meta.mode}, ${meta.integrityWarnings.length} warnings`,
    );
    const published: string[] = [];
    for (const name of [...DELIVERABLES, FILE_NAMES.metadata, FILE_NAMES.hash]) {
      const path = join(DOWNLOADS_DIR, name);
      if (!existsSync(path)) published.push(`${name}: not published`);
      else if (sha256(readFileSync(path)) !== sha256(read(name))) published.push(`${name}: published copy differs from exports/`);
    }
    check("public/downloads/: published copies match the verified exports", published.length === 0, published);
  }

  console.log(`Links: full PDF ${fmtCounts(meta.links.fullPdf)}; core PDF ${fmtCounts(meta.links.corePdf)} (${meta.links.corePdfAppendixRefsNotLinked} appendix references unlinked); PPTX ${fmtCounts(meta.links.pptx)}\n`);
}

main()
  .catch((err: unknown) => {
    check("Verifier ran to completion", false, err instanceof Error ? (err.stack ?? err.message) : String(err));
  })
  .finally(() => {
    for (const r of results) {
      console.log(`[${r.level}] ${r.label}`);
      for (const line of r.detail.slice(0, 40)) console.log(`       ${line}`);
      if (r.detail.length > 40) console.log(`       ... ${r.detail.length - 40} more`);
    }
    const failed = results.filter((r) => r.level === "FAIL").length;
    console.log(`\n${results.length - failed}/${results.length} checks without failure.`);
    process.exitCode = failed > 0 ? 1 : 0;
  });

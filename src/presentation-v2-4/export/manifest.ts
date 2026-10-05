import type { ManifestEntry, SlideKind } from "./types";

const KINDS: readonly SlideKind[] = ["core", "closing", "appendix-index", "appendix"];

function str(value: unknown): string {
  return typeof value === "string" ? value : value === undefined || value === null ? "" : String(value);
}

function num(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value !== "" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function parseManifest(raw: string): ManifestEntry[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("The slide manifest is not a JSON array.");
  return parsed.map((item: unknown, index): ManifestEntry => {
    if (typeof item !== "object" || item === null) throw new Error(`Manifest entry ${index} is not an object.`);
    const o = item as Record<string, unknown>;
    const kind = str(o.kind) as SlideKind;
    if (!KINDS.includes(kind)) throw new Error(`Manifest entry ${index} has unknown kind "${str(o.kind)}".`);
    return {
      key: str(o.key),
      kind,
      position: num(o.position) ?? index + 1,
      coreNumber: num(o.coreNumber),
      id: str(o.id),
      title: str(o.title).trim(),
      section: str(o.section).trim(),
      group: o.group === undefined || o.group === null || o.group === "" ? null : str(o.group),
      url: str(o.url),
      speakerNotes: str(o.speakerNotes).trim(),
    };
  });
}

/** Checks the deck order contract: core 1..N, closing, appendix index, appendix slides. */
export function validateManifest(slides: readonly ManifestEntry[]): string[] {
  const problems: string[] = [];
  if (slides.length === 0) return ["The manifest is empty."];

  const order = slides.map((s) => s.kind);
  const firstNonCore = order.findIndex((k) => k !== "core");
  const coreCount = firstNonCore < 0 ? order.length : firstNonCore;
  const expected: SlideKind[] = [
    ...Array<SlideKind>(coreCount).fill("core"),
    "closing",
    "appendix-index",
    ...Array<SlideKind>(Math.max(0, slides.length - coreCount - 2)).fill("appendix"),
  ];
  if (order.join(",") !== expected.join(",")) {
    problems.push("Slide order must be core slides, closing, appendix index, then appendix slides.");
  }
  if (coreCount !== 13) problems.push(`Expected 13 core slides, found ${coreCount}.`);

  slides.forEach((s, i) => {
    if (s.kind === "core" && s.coreNumber !== i + 1) {
      problems.push(`Core slide at position ${i + 1} has coreNumber ${String(s.coreNumber)}.`);
    }
    if (!s.key) problems.push(`Slide at position ${i + 1} has no key.`);
    if (!s.title) problems.push(`Slide ${s.key || i + 1} has no title.`);
    if (!s.url) problems.push(`Slide ${s.key || i + 1} has no URL.`);
    if (s.kind === "appendix" && !/^app-/.test(s.id)) problems.push(`Appendix slide ${s.key} has id "${s.id}".`);
  });

  const keys = new Set<string>();
  for (const s of slides) {
    if (keys.has(s.key)) problems.push(`Duplicate slide key ${s.key}.`);
    keys.add(s.key);
  }
  const appendixIds = new Set<string>();
  for (const s of slides.filter((x) => x.kind === "appendix")) {
    if (appendixIds.has(s.id)) problems.push(`Duplicate appendix id ${s.id}.`);
    appendixIds.add(s.id);
  }
  return problems;
}

export function documentSlides(slides: readonly ManifestEntry[]): { core: number; closing: number; index: number; appendix: number } {
  return {
    core: slides.filter((s) => s.kind === "core").length,
    closing: slides.filter((s) => s.kind === "closing").length,
    index: slides.filter((s) => s.kind === "appendix-index").length,
    appendix: slides.filter((s) => s.kind === "appendix").length,
  };
}

/** Pages in the core PDF: every core slide plus the closing slide, which lead the play order. */
export function corePageCount(slides: readonly ManifestEntry[]): number {
  const idx = slides.findIndex((s) => s.kind !== "core" && s.kind !== "closing");
  return idx < 0 ? slides.length : idx;
}

export function kindLabel(kind: ManifestEntry["kind"]): string {
  switch (kind) {
    case "core":
      return "Core";
    case "closing":
      return "Closing";
    case "appendix-index":
      return "Appendix index";
    case "appendix":
      return "Appendix";
  }
}

// En dash and em dash, built from code points so this source file stays dash-free
export const DASH_CLASS = `[${String.fromCharCode(0x2013, 0x2014)}]`;
const NUMBER_RANGE = new RegExp(`(\\d)\\s*${DASH_CLASS}\\s*(\\d)`, "g");
const DASH_PAUSE = new RegExp(`\\s*${DASH_CLASS}\\s*`, "g");

/** Removes em and en dashes so generated notes follow the copy rules. */
export function cleanCopy(text: string): string {
  return text
    .replace(NUMBER_RANGE, "$1 to $2")
    .replace(DASH_PAUSE, ", ")
    .replace(/\r\n/g, "\n")
    .trim();
}

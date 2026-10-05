import {
  LINK_KINDS,
  SLIDE_H_PX,
  SLIDE_W_PX,
  type LinkCounts,
  type LinkKind,
  type LinkTarget,
  type ManifestEntry,
  type MeasuredAnchor,
  type ResolvedLink,
  type SlideKind,
  type SlideRect,
} from "./types";

export function parseLinkTarget(raw: string): LinkTarget | null {
  const value = raw.trim();
  if (value === "appendix-index") return { type: "appendix-index" };
  const appendix = /^appendix:(app-[A-Za-z0-9-]+)$/.exec(value);
  if (appendix?.[1]) return { type: "appendix", id: appendix[1] };
  const core = /^core:(\d+)$/.exec(value);
  if (core?.[1]) return { type: "core", coreNumber: Number(core[1]) };
  return null;
}

export function resolveTargetIndex(target: LinkTarget, slides: readonly ManifestEntry[]): number {
  switch (target.type) {
    case "appendix-index":
      return slides.findIndex((s) => s.kind === "appendix-index");
    case "appendix":
      return slides.findIndex((s) => s.kind === "appendix" && s.id === target.id);
    case "core":
      return slides.findIndex(
        (s) => (s.kind === "core" || s.kind === "closing") && s.coreNumber === target.coreNumber,
      );
  }
}

export function classifyLink(source: SlideKind, target: LinkTarget): LinkKind {
  if (target.type === "appendix") {
    if (source === "appendix-index") return "index-entry";
    if (source === "appendix") return "appendix-cross";
    return "appendix-chip";
  }
  if (target.type === "appendix-index") return "index-link";
  return source === "appendix" ? "return" : "core-link";
}

export function clipRect(rect: SlideRect): SlideRect | null {
  const x1 = Math.max(0, rect.x);
  const y1 = Math.max(0, rect.y);
  const x2 = Math.min(SLIDE_W_PX, rect.x + rect.w);
  const y2 = Math.min(SLIDE_H_PX, rect.y + rect.h);
  if (x2 - x1 < 2 || y2 - y1 < 2) return null;
  const round = (n: number) => Math.round(n * 100) / 100;
  return { x: round(x1), y: round(y1), w: round(x2 - x1), h: round(y2 - y1) };
}

export interface LinkResolution {
  links: ResolvedLink[];
  unresolved: string[];
  skippedAppendixRefs: number;
}

/**
 * Turns measured anchors into page links. `pageCount` limits targets to the pages
 * present in a given file: in the core PDF, appendix and index targets are skipped.
 */
export function resolveLinks(
  slides: readonly ManifestEntry[],
  anchors: ReadonlyArray<readonly MeasuredAnchor[]>,
  pageCount: number,
): LinkResolution {
  const links: ResolvedLink[] = [];
  const unresolved: string[] = [];
  let skippedAppendixRefs = 0;

  for (let sourceIndex = 0; sourceIndex < pageCount; sourceIndex++) {
    const source = slides[sourceIndex];
    if (!source) continue;
    for (const anchor of anchors[sourceIndex] ?? []) {
      const target = parseLinkTarget(anchor.target);
      if (!target) {
        unresolved.push(`${source.key}: unknown link target "${anchor.target}"`);
        continue;
      }
      const targetIndex = resolveTargetIndex(target, slides);
      if (targetIndex < 0) {
        unresolved.push(`${source.key}: link target "${anchor.target}" is not in the manifest`);
        continue;
      }
      if (targetIndex >= pageCount) {
        if (target.type !== "core") skippedAppendixRefs++;
        continue;
      }
      const rect = clipRect(anchor.rect);
      if (!rect) continue;
      links.push({
        sourceIndex,
        target: anchor.target,
        kind: classifyLink(source.kind, target),
        targetIndex,
        label: anchor.label,
        rect,
      });
    }
  }
  // Navigation controls go last so they sit on top if a link area overlaps them
  const navigation = (l: ResolvedLink) => (l.kind === "return" || l.kind === "index-link" || l.kind === "core-link" ? 1 : 0);
  links.sort((a, b) => a.sourceIndex - b.sourceIndex || navigation(a) - navigation(b));
  return { links, unresolved, skippedAppendixRefs };
}

export function overlappingLinks(links: readonly ResolvedLink[]): Array<[ResolvedLink, ResolvedLink]> {
  const pairs: Array<[ResolvedLink, ResolvedLink]> = [];
  links.forEach((a, i) => {
    for (const b of links.slice(i + 1)) {
      if (a.sourceIndex !== b.sourceIndex || a.target === b.target) continue;
      const w = Math.min(a.rect.x + a.rect.w, b.rect.x + b.rect.w) - Math.max(a.rect.x, b.rect.x);
      const h = Math.min(a.rect.y + a.rect.h, b.rect.y + b.rect.h) - Math.max(a.rect.y, b.rect.y);
      if (w > 2 && h > 2) pairs.push([a, b]);
    }
  });
  return pairs;
}

export function countLinks(kinds: readonly LinkKind[]): LinkCounts {
  const counts = Object.fromEntries(LINK_KINDS.map((k) => [k, 0])) as Record<LinkKind, number>;
  for (const kind of kinds) counts[kind]++;
  return { ...counts, total: kinds.length };
}

export function linkTooltip(link: ResolvedLink, slides: readonly ManifestEntry[]): string {
  const target = slides[link.targetIndex];
  const title = target?.title ?? "";
  switch (link.kind) {
    case "return":
      return `Return to slide ${link.targetIndex + 1}: ${title}`;
    case "index-link":
      return "Open the appendix index";
    default:
      return `Go to slide ${link.targetIndex + 1}: ${title}`;
  }
}

/** The name stored on each PDF annotation and PPTX shape, so the verifier can check targets. */
export function linkObjectName(target: string): string {
  return `link ${target}`;
}

export function targetFromObjectName(name: string): string | null {
  const match = /^link (\S+)$/.exec(name.trim());
  return match?.[1] ?? null;
}

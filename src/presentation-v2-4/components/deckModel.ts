import { CORE_SLIDES_V24, PRESENTATION_SLIDES_V24 } from "../data/core-story";
import { APPENDIX_SLIDES_V24 } from "../data/appendix";
import { APPENDIX_GROUP_ORDER, type AppendixSlide24, type CoreSlide24 } from "../data/types";

export const CORE_COUNT = CORE_SLIDES_V24.length;
export const PLAY_COUNT = PRESENTATION_SLIDES_V24.length;
export const AGENDA_POSITION = 2;
export const OTHER_GROUP = "Other";
export const INDEX_TITLE = "Appendix index";
export const INDEX_SECTION = "Appendix";
export const SYNTHETIC_LABEL = "Synthetic institution and data";

const DECK_PARAM = "v2.4";
const PRESERVED_PARAMS = ["export", "safe"] as const;

export type DeckView =
  | { kind: "core"; position: number }
  | { kind: "appendix"; id: string; from: number }
  | { kind: "appendix-index"; from: number };

export type IndexGroup = { name: string; slides: AppendixSlide24[] };

// ---------------------------------------------------------------------------
// Appendix order: the index groups, then slides without a group under "Other"
// ---------------------------------------------------------------------------

function buildIndexGroups(): IndexGroup[] {
  const groups: IndexGroup[] = APPENDIX_GROUP_ORDER.map((name) => ({
    name,
    slides: APPENDIX_SLIDES_V24.filter((s) => s.group === name),
  }));
  const known = new Set<string>(APPENDIX_GROUP_ORDER);
  groups.push({
    name: OTHER_GROUP,
    slides: APPENDIX_SLIDES_V24.filter((s) => s.group === undefined || !known.has(s.group)),
  });
  return groups.filter((g) => g.slides.length > 0);
}

export const APPENDIX_INDEX_GROUPS: IndexGroup[] = buildIndexGroups();
export const APPENDIX_ORDER: AppendixSlide24[] = APPENDIX_INDEX_GROUPS.flatMap((g) => g.slides);

const APPENDIX_BY_ID = new Map(APPENDIX_ORDER.map((s) => [s.id, s]));

export function findAppendix(id: string): AppendixSlide24 | undefined {
  return APPENDIX_BY_ID.get(id);
}

export function appendixGroupName(slide: AppendixSlide24): string {
  return slide.group ?? OTHER_GROUP;
}

/** "app-08" reads as "A08" on screen. */
export function appendixCode(id: string): string {
  const m = /^app-(\d+)$/.exec(id);
  return m?.[1] ? `A${m[1]}` : id.toUpperCase();
}

/** The first core slide that references an appendix slide; the agenda otherwise. */
export function canonicalOrigin(appendixId: string): number {
  const i = CORE_SLIDES_V24.findIndex((s) => s.appendixRefs.some((r) => r.appendixId === appendixId));
  return i >= 0 ? i + 1 : AGENDA_POSITION;
}

export function playSlide(position: number): CoreSlide24 | undefined {
  return PRESENTATION_SLIDES_V24[position - 1];
}

export function isFullBleed(slide: CoreSlide24): boolean {
  return slide.kind === "cover" || slide.kind === "closing";
}

/** 1 to 13 for core slides, null for the closing slide. */
export function coreNumberOf(position: number): number | null {
  return position >= 1 && position <= CORE_COUNT ? position : null;
}

// ---------------------------------------------------------------------------
// Views, keys and URLs
// ---------------------------------------------------------------------------

function clampPosition(n: number): number {
  return Math.max(1, Math.min(PLAY_COUNT, Math.floor(n)));
}

function parseFrom(raw: string | null): number | null {
  const m = /^(?:core|slide)-0*(\d+)$/.exec(raw ?? "");
  if (!m?.[1]) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= PLAY_COUNT ? n : null;
}

export function appendixView(id: string, from: number | null): DeckView {
  if (!APPENDIX_BY_ID.has(id)) return { kind: "appendix-index", from: from ?? AGENDA_POSITION };
  return { kind: "appendix", id, from: from ?? canonicalOrigin(id) };
}

export function resolveInitialView(props: {
  initialCoreSlide?: number;
  initialAppendixId?: string | null;
  initialFrom?: number | null;
  initialView?: "core" | "appendix" | "appendix-index";
}): DeckView {
  const from = props.initialFrom != null && props.initialFrom >= 1 && props.initialFrom <= PLAY_COUNT ? props.initialFrom : null;
  if (props.initialView === "appendix-index") return { kind: "appendix-index", from: from ?? AGENDA_POSITION };
  if (props.initialView === "appendix" && props.initialAppendixId) return appendixView(props.initialAppendixId, from);
  const n = props.initialCoreSlide ?? 1;
  return { kind: "core", position: Number.isFinite(n) ? clampPosition(n) : 1 };
}

export function parseViewFromSearch(search: string): DeckView {
  const params = new URLSearchParams(search);
  const from = parseFrom(params.get("from"));
  if (params.get("view") === "appendix-index") return { kind: "appendix-index", from: from ?? AGENDA_POSITION };
  const appendix = params.get("appendix");
  if (appendix) return appendixView(appendix, from);
  const n = Number(params.get("core") ?? "1");
  return { kind: "core", position: Number.isFinite(n) && n >= 1 ? clampPosition(n) : 1 };
}

export function viewKey(view: DeckView): string {
  if (view.kind === "core") return view.position === PLAY_COUNT ? "closing" : `core-${view.position}`;
  if (view.kind === "appendix-index") return "appendix-index";
  return `appendix-${view.id}`;
}

export function sameView(a: DeckView, b: DeckView): boolean {
  if (viewKey(a) !== viewKey(b)) return false;
  if (a.kind === "core" || b.kind === "core") return true;
  return a.from === b.from;
}

/** The deck URL for a view. Export URLs carry no origin; live URLs keep it for the return path. */
export function viewUrl(view: DeckView, withOrigin: boolean, preserved?: URLSearchParams): string {
  const params = new URLSearchParams();
  params.set("deck", DECK_PARAM);
  if (view.kind === "core") {
    params.set("core", String(view.position));
  } else if (view.kind === "appendix") {
    params.set("appendix", view.id);
    if (withOrigin) params.set("from", `core-${view.from}`);
  } else {
    params.set("view", "appendix-index");
    if (withOrigin) params.set("from", `core-${view.from}`);
  }
  if (preserved) {
    for (const key of PRESERVED_PARAMS) {
      const value = preserved.get(key);
      if (value !== null) params.set(key, value);
    }
  }
  return `/story?${params.toString()}`;
}

/** Title of a view, for the slide region label, the live announcement and presenter notes. */
export function viewTitle(view: DeckView): string {
  if (view.kind === "core") return playSlide(view.position)?.title ?? "";
  if (view.kind === "appendix-index") return INDEX_TITLE;
  return findAppendix(view.id)?.title ?? "";
}

// ---------------------------------------------------------------------------
// Sequential navigation within the current context
// ---------------------------------------------------------------------------

export function stepView(view: DeckView, delta: 1 | -1): DeckView | null {
  if (view.kind === "core") {
    const next = view.position + delta;
    return next >= 1 && next <= PLAY_COUNT ? { kind: "core", position: next } : null;
  }
  // Appendix context: the index, then every appendix slide in index order
  const at = view.kind === "appendix-index" ? -1 : APPENDIX_ORDER.findIndex((s) => s.id === view.id);
  const nextIndex = at + delta;
  if (nextIndex === -1) return { kind: "appendix-index", from: view.from };
  const next = APPENDIX_ORDER[nextIndex];
  return next ? { kind: "appendix", id: next.id, from: view.from } : null;
}

// ---------------------------------------------------------------------------
// Export manifest
// ---------------------------------------------------------------------------

export type ManifestEntry = {
  key: string;
  kind: "core" | "closing" | "appendix-index" | "appendix";
  position: number | null;
  coreNumber: number | null;
  id: string;
  title: string;
  section: string;
  group: string | null;
  url: string;
  speakerNotes: string;
};

export const INDEX_SPEAKER_NOTES =
  "The appendix holds the reference detail behind the core story, grouped by product, processes, controls, technology, and service and rollout. Each entry shows its implementation status. Open the slide the audience asks about, then return to the core slide you came from.";

export function buildManifest(): ManifestEntry[] {
  const play: ManifestEntry[] = PRESENTATION_SLIDES_V24.map((slide, i) => {
    const position = i + 1;
    const view: DeckView = { kind: "core", position };
    return {
      key: viewKey(view),
      kind: slide.kind === "closing" ? "closing" : "core",
      position,
      coreNumber: coreNumberOf(position),
      id: slide.id,
      title: slide.title,
      section: slide.section,
      group: null,
      url: viewUrl(view, false),
      speakerNotes: slide.speakerNotes,
    };
  });
  const indexView: DeckView = { kind: "appendix-index", from: AGENDA_POSITION };
  const index: ManifestEntry = {
    key: viewKey(indexView),
    kind: "appendix-index",
    position: null,
    coreNumber: null,
    id: "appendix-index",
    title: INDEX_TITLE,
    section: INDEX_SECTION,
    group: null,
    url: viewUrl(indexView, false),
    speakerNotes: INDEX_SPEAKER_NOTES,
  };
  const appendix: ManifestEntry[] = APPENDIX_ORDER.map((slide) => {
    const view: DeckView = { kind: "appendix", id: slide.id, from: canonicalOrigin(slide.id) };
    return {
      key: viewKey(view),
      kind: "appendix",
      position: null,
      coreNumber: null,
      id: slide.id,
      title: slide.title,
      section: slide.section,
      group: appendixGroupName(slide),
      url: viewUrl(view, false),
      speakerNotes: slide.speakerNotes,
    };
  });
  return [...play, index, ...appendix];
}

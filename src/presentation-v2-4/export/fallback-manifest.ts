import { PRESENTATION_SLIDES_V24 } from "../data/core-story";
import { APPENDIX_SLIDES_V24 } from "../data/appendix";
import { APPENDIX_GROUP_ORDER } from "../data/types";
import type { ManifestEntry } from "./types";

/**
 * Builds the slide list from the V2.4 data modules. Only used while the deck does not
 * yet publish its `data-presentation-slides` manifest; such exports are drafts.
 */
export function buildFallbackManifest(): ManifestEntry[] {
  const entries: ManifestEntry[] = [];

  PRESENTATION_SLIDES_V24.forEach((slide, i) => {
    const coreNumber = i + 1;
    entries.push({
      key: slide.kind === "closing" ? "closing" : `core-${String(coreNumber).padStart(2, "0")}`,
      kind: slide.kind === "closing" ? "closing" : "core",
      position: entries.length + 1,
      coreNumber,
      id: slide.id,
      title: slide.title,
      section: slide.section,
      group: null,
      url: `/story?deck=v2.4&core=${coreNumber}`,
      speakerNotes: slide.speakerNotes,
    });
  });

  const groupRank = (g: string | undefined) => {
    const r = g ? APPENDIX_GROUP_ORDER.indexOf(g as (typeof APPENDIX_GROUP_ORDER)[number]) : -1;
    return r < 0 ? APPENDIX_GROUP_ORDER.length : r;
  };
  const appendix = APPENDIX_SLIDES_V24.map((slide, i) => ({ slide, i })).sort(
    (a, b) => groupRank(a.slide.group) - groupRank(b.slide.group) || a.i - b.i,
  );

  entries.push({
    key: "appendix-index",
    kind: "appendix-index",
    position: entries.length + 1,
    coreNumber: null,
    id: "appendix-index",
    title: "Appendix",
    section: "Appendix",
    group: null,
    url: "/story?deck=v2.4&view=appendix-index",
    speakerNotes: "",
  });

  for (const { slide } of appendix) {
    entries.push({
      key: slide.id,
      kind: "appendix",
      position: entries.length + 1,
      coreNumber: null,
      id: slide.id,
      title: slide.title,
      section: slide.section,
      group: slide.group ?? null,
      url: `/story?deck=v2.4&appendix=${slide.id}`,
      speakerNotes: slide.speakerNotes,
    });
  }
  return entries;
}

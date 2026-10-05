/**
 * Unit tests for V2.4 core and appendix slide copy.
 *
 * Asserts:
 * - Every core slide has title and subtitle
 * - Every appendix slide has title and subtitle
 * - Title and subtitle differ
 * - Title is within length (< 120 chars)
 * - Subtitle is within length (< 220 chars)
 * - No topic-only title (single word), except structural slides (cover, agenda, closing)
 * - No em dash in title or subtitle
 * - No double-hyphen punctuation in title or subtitle
 * - Thirteen core slides; the closing Q&A slide plays after the core and is not counted in it
 * - Story order follows opening, complication, answer, proof, control, value, scale, action
 * - Supporting insights stay within 30 words and do not repeat the title or subtitle
 * - Every appendix reference resolves, and every appendix slide carries a group and a status
 */

import { describe, it, expect } from "vitest";
import { CORE_SLIDES_V24, CLOSING_SLIDE_V24, PRESENTATION_SLIDES_V24 } from "../../src/presentation-v2-4/data/core-story";
import { APPENDIX_SLIDES_V24 } from "../../src/presentation-v2-4/data/appendix";

const EM_DASH = "\u2014";
const EN_DASH = "\u2013";

function noEmDash(s: string) {
  return !s.includes(EM_DASH) && !s.includes(EN_DASH);
}

function noDoubleDashPunctuation(s: string) {
  return !/ -- /.test(s) && !s.startsWith("--") && !s.endsWith("--");
}

// Expected story sections in order
const EXPECTED_SECTIONS = [
  "Opening",
  "Opening",
  "Complication",
  "Complication",
  "Answer",
  "Proof",
  "Proof",
  "Proof",
  "Proof",
  "Control",
  "Value",
  "Scale",
  "Action",
];

const STRUCTURAL_KINDS = new Set(["cover", "agenda", "closing"]);

describe("CORE_SLIDES_V24", () => {
  it("has exactly thirteen core slides", () => {
    expect(CORE_SLIDES_V24).toHaveLength(13);
  });

  it("opens with a cover and an agenda and closes with questions", () => {
    expect(CORE_SLIDES_V24[0]!.kind).toBe("cover");
    expect(CORE_SLIDES_V24[1]!.kind).toBe("agenda");
    expect(CLOSING_SLIDE_V24.kind).toBe("closing");
    expect(PRESENTATION_SLIDES_V24[PRESENTATION_SLIDES_V24.length - 1]).toBe(CLOSING_SLIDE_V24);
    expect(PRESENTATION_SLIDES_V24).toHaveLength(CORE_SLIDES_V24.length + 1);
    const structural = CORE_SLIDES_V24.filter((s) => s.kind !== undefined && STRUCTURAL_KINDS.has(s.kind));
    expect(structural).toHaveLength(2);
  });

  it("every slide has a non-empty title", () => {
    for (const slide of CORE_SLIDES_V24) {
      expect(slide.title, `slide ${slide.id} missing title`).toBeTruthy();
      expect(slide.title.trim().length, `slide ${slide.id} title is blank`).toBeGreaterThan(0);
    }
  });

  it("every slide has a non-empty subtitle", () => {
    for (const slide of CORE_SLIDES_V24) {
      expect(slide.subtitle, `slide ${slide.id} missing subtitle`).toBeTruthy();
      expect(slide.subtitle.trim().length, `slide ${slide.id} subtitle is blank`).toBeGreaterThan(0);
    }
  });

  it("title and subtitle differ on every slide", () => {
    for (const slide of CORE_SLIDES_V24) {
      expect(slide.title.toLowerCase().trim(), `slide ${slide.id} title equals subtitle`).not.toBe(
        slide.subtitle.toLowerCase().trim()
      );
    }
  });

  it("every title is within length", () => {
    for (const slide of CORE_SLIDES_V24) {
      expect(slide.title.length, `slide ${slide.id} title too long (${slide.title.length} chars)`).toBeLessThanOrEqual(120);
    }
  });

  it("every subtitle is within length", () => {
    for (const slide of CORE_SLIDES_V24) {
      expect(slide.subtitle.length, `slide ${slide.id} subtitle too long`).toBeLessThanOrEqual(220);
    }
  });

  it("no content title is a single word", () => {
    for (const slide of CORE_SLIDES_V24) {
      if (slide.kind !== undefined && STRUCTURAL_KINDS.has(slide.kind)) continue;
      const wordCount = slide.title.trim().split(/\s+/).length;
      expect(wordCount, `slide ${slide.id} title appears to be a single-word topic label`).toBeGreaterThan(1);
    }
  });

  it("no title contains an em dash or en dash", () => {
    for (const slide of CORE_SLIDES_V24) {
      expect(noEmDash(slide.title), `slide ${slide.id} title contains an em/en dash`).toBe(true);
    }
  });

  it("no subtitle contains an em dash or en dash", () => {
    for (const slide of CORE_SLIDES_V24) {
      expect(noEmDash(slide.subtitle), `slide ${slide.id} subtitle contains an em/en dash`).toBe(true);
    }
  });

  it("no title uses double-hyphen as punctuation", () => {
    for (const slide of CORE_SLIDES_V24) {
      expect(noDoubleDashPunctuation(slide.title), `slide ${slide.id} title uses double-hyphen`).toBe(true);
    }
  });

  it("no subtitle uses double-hyphen as punctuation", () => {
    for (const slide of CORE_SLIDES_V24) {
      expect(noDoubleDashPunctuation(slide.subtitle), `slide ${slide.id} subtitle uses double-hyphen`).toBe(true);
    }
  });

  it("every slide has an exhibit with a type", () => {
    for (const slide of CORE_SLIDES_V24) {
      expect(slide.exhibit, `slide ${slide.id} missing exhibit`).toBeTruthy();
      expect(slide.exhibit.type, `slide ${slide.id} exhibit missing type`).toBeTruthy();
    }
  });

  it("every slide declares at least one evidence basis", () => {
    for (const slide of CORE_SLIDES_V24) {
      expect(slide.evidenceBasis.length, `slide ${slide.id} has no evidence basis`).toBeGreaterThan(0);
    }
  });

  it("story sections follow the agreed arc", () => {
    for (let i = 0; i < CORE_SLIDES_V24.length; i++) {
      const slide = CORE_SLIDES_V24[i]!;
      const expectedSection = EXPECTED_SECTIONS[i];
      expect(slide.section, `slide ${slide.id} (index ${i}) has section "${slide.section}", expected "${expectedSection}"`).toBe(expectedSection);
    }
  });

  it("opening section precedes complication", () => {
    const situationEnd = CORE_SLIDES_V24.filter((s) => s.section === "Opening").length;
    const firstComplication = CORE_SLIDES_V24.findIndex((s) => s.section === "Complication");
    expect(firstComplication).toBeGreaterThanOrEqual(situationEnd);
  });

  it("complication section precedes answer", () => {
    const firstComplication = CORE_SLIDES_V24.findIndex((s) => s.section === "Complication");
    const firstAnswer = CORE_SLIDES_V24.findIndex((s) => s.section === "Answer");
    expect(firstAnswer).toBeGreaterThan(firstComplication);
  });

  it("answer section precedes proof", () => {
    const firstAnswer = CORE_SLIDES_V24.findIndex((s) => s.section === "Answer");
    const firstProof = CORE_SLIDES_V24.findIndex((s) => s.section === "Proof");
    expect(firstProof).toBeGreaterThan(firstAnswer);
  });

  it("proof section precedes control", () => {
    const lastProof = [...CORE_SLIDES_V24].reverse().findIndex((s) => s.section === "Proof");
    const firstControl = CORE_SLIDES_V24.findIndex((s) => s.section === "Control");
    expect(firstControl).toBeGreaterThan(CORE_SLIDES_V24.length - 1 - lastProof);
  });

  // The authority slide asks how the boundary is enforced; trust answers it before value is discussed
  it("control (trust) precedes value", () => {
    const firstControl = CORE_SLIDES_V24.findIndex((s) => s.section === "Control");
    const firstValue = CORE_SLIDES_V24.findIndex((s) => s.section === "Value");
    expect(firstValue).toBe(firstControl + 1);
    expect(CORE_SLIDES_V24[firstControl]!.title).toBe("Trust is engineered into every material step");
  });

  it("value section precedes scale", () => {
    const firstValue = CORE_SLIDES_V24.findIndex((s) => s.section === "Value");
    const firstScale = CORE_SLIDES_V24.findIndex((s) => s.section === "Scale");
    expect(firstScale).toBeGreaterThan(firstValue);
  });

  it("slide ids follow the play order", () => {
    CORE_SLIDES_V24.forEach((slide, i) => {
      expect(slide.id).toBe(`slide-${String(i + 1).padStart(2, "0")}`);
    });
  });

  it("supporting insights are compact and do not repeat the title or subtitle", () => {
    for (const slide of PRESENTATION_SLIDES_V24) {
      if (slide.insight === undefined) continue;
      const words = slide.insight.trim().split(/\s+/).length;
      expect(words, `slide ${slide.id} insight has ${words} words`).toBeLessThanOrEqual(30);
      expect(noEmDash(slide.insight), `slide ${slide.id} insight contains a dash`).toBe(true);
      const insight = slide.insight.toLowerCase();
      expect(insight.includes(slide.title.toLowerCase()), `slide ${slide.id} insight repeats the title`).toBe(false);
      expect(insight.includes(slide.subtitle.toLowerCase()), `slide ${slide.id} insight repeats the subtitle`).toBe(false);
    }
  });

  it("every appendix reference resolves to an appendix slide", () => {
    const ids = new Set(APPENDIX_SLIDES_V24.map((s) => s.id));
    for (const slide of PRESENTATION_SLIDES_V24) {
      for (const ref of slide.appendixRefs) {
        expect(ids.has(ref.appendixId), `slide ${slide.id} references missing ${ref.appendixId}`).toBe(true);
      }
    }
  });

  it("the closing slide has copy, notes and no dashes", () => {
    expect(CLOSING_SLIDE_V24.title.trim().length).toBeGreaterThan(0);
    expect(CLOSING_SLIDE_V24.subtitle.trim().length).toBeGreaterThan(0);
    expect(CLOSING_SLIDE_V24.speakerNotes.trim().length).toBeGreaterThan(0);
    expect(noEmDash(CLOSING_SLIDE_V24.title) && noEmDash(CLOSING_SLIDE_V24.subtitle)).toBe(true);
  });

  it("scale section precedes action", () => {
    const firstScale = CORE_SLIDES_V24.findIndex((s) => s.section === "Scale");
    const firstAction = CORE_SLIDES_V24.findIndex((s) => s.section === "Action");
    expect(firstAction).toBeGreaterThan(firstScale);
  });

  it("no two adjacent slides have the same section except for multi-slide sections", () => {
    // Adjacent duplicates within sections are expected (Opening has 2, Complication has 2, Proof has 4)
    // But we should not have the same section appear in non-consecutive positions
    const sections = CORE_SLIDES_V24.map((s) => s.section);
    const seen = new Set<string>();
    let prevSection = "";
    for (const section of sections) {
      if (section !== prevSection) {
        expect(seen.has(section), `Section "${section}" appears non-consecutively`).toBe(false);
        seen.add(section);
        prevSection = section;
      }
    }
  });

  it("no speaker notes are empty", () => {
    for (const slide of CORE_SLIDES_V24) {
      expect(slide.speakerNotes.trim().length, `slide ${slide.id} has empty speaker notes`).toBeGreaterThan(0);
    }
  });
});

describe("APPENDIX_SLIDES_V24", () => {
  it("has at least ten slides", () => {
    expect(APPENDIX_SLIDES_V24.length).toBeGreaterThanOrEqual(10);
  });

  it("every appendix slide has a non-empty title", () => {
    for (const slide of APPENDIX_SLIDES_V24) {
      expect(slide.title, `appendix slide ${slide.id} missing title`).toBeTruthy();
      expect(slide.title.trim().length).toBeGreaterThan(0);
    }
  });

  it("every appendix slide has a non-empty subtitle", () => {
    for (const slide of APPENDIX_SLIDES_V24) {
      expect(slide.subtitle, `appendix slide ${slide.id} missing subtitle`).toBeTruthy();
      expect(slide.subtitle.trim().length).toBeGreaterThan(0);
    }
  });

  it("appendix title and subtitle differ", () => {
    for (const slide of APPENDIX_SLIDES_V24) {
      expect(slide.title.toLowerCase().trim()).not.toBe(slide.subtitle.toLowerCase().trim());
    }
  });

  it("no appendix title contains an em dash", () => {
    for (const slide of APPENDIX_SLIDES_V24) {
      expect(noEmDash(slide.title), `appendix ${slide.id} title contains em/en dash`).toBe(true);
    }
  });

  it("no appendix subtitle contains an em dash", () => {
    for (const slide of APPENDIX_SLIDES_V24) {
      expect(noEmDash(slide.subtitle), `appendix ${slide.id} subtitle contains em/en dash`).toBe(true);
    }
  });

  it("every appendix slide has a visual type", () => {
    for (const slide of APPENDIX_SLIDES_V24) {
      expect(slide.visual, `appendix ${slide.id} missing visual`).toBeTruthy();
      expect(slide.visual.type, `appendix ${slide.id} visual missing type`).toBeTruthy();
    }
  });

  it("every appendix slide declares at least one evidence basis", () => {
    for (const slide of APPENDIX_SLIDES_V24) {
      expect(slide.evidenceBasis.length, `appendix ${slide.id} has no evidence basis`).toBeGreaterThan(0);
    }
  });

  it("every appendix slide has an index group, an implementation status and notes", () => {
    for (const slide of APPENDIX_SLIDES_V24) {
      expect(slide.group, `appendix ${slide.id} has no group`).toBeTruthy();
      expect(slide.status, `appendix ${slide.id} has no status`).toBeTruthy();
      expect(slide.status?.note.trim().length ?? 0, `appendix ${slide.id} status has no note`).toBeGreaterThan(0);
      expect(slide.speakerNotes.trim().length, `appendix ${slide.id} has no notes`).toBeGreaterThan(0);
    }
  });

  it("appendix IDs are unique", () => {
    const ids = APPENDIX_SLIDES_V24.map((s) => s.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

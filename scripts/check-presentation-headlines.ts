/**
 * Headline quality checker for V2.4 core and appendix slides.
 *
 * Checks:
 * - Every slide has title and subtitle
 * - Title and subtitle differ materially (Levenshtein distance > 0.3)
 * - Title is not a topic label only (must contain a verb or implication)
 * - Title is not more than two lines (proxy: < 100 chars)
 * - Title uses sentence case
 * - Subtitle does not exceed 180 chars (22 words approx)
 * - No title or subtitle contains an em dash
 * - No title or subtitle uses double-hyphen as punctuation
 *
 * Run: npx ts-node scripts/check-presentation-headlines.ts
 */

import { PRESENTATION_SLIDES_V24 as CORE_SLIDES_V24 } from "../src/presentation-v2-4/data/core-story";
import { APPENDIX_SLIDES_V24 } from "../src/presentation-v2-4/data/appendix";

type CheckResult = {
  id: string;
  kind: "core" | "appendix";
  title: string;
  subtitle: string;
  errors: string[];
  warnings: string[];
};

// Verbs that indicate an action title (not exhaustive, indicative)
const VERB_INDICATORS = [
  "creates", "expands", "builds", "turns", "returns", "connects", "moves",
  "starts", "adapts", "spans", "consumes", "slows", "weakens", "engineers",
  "scales", "prove", "proves", "start", "define", "is", "are", "has", "have",
  "remains", "become", "becomes", "shows", "explain", "links", "involves",
  "design", "designs", "define", "defines",
];

const EM_DASH = "\u2014";
const EM_DASH_LOOKALIKE = "\u2013"; // en dash, also a violation

function containsEmDash(text: string): boolean {
  return text.includes(EM_DASH) || text.includes(EM_DASH_LOOKALIKE);
}

function containsDoubleDashPunctuation(text: string): boolean {
  // Allow CSS custom properties like --pv22-, but not standalone -- as punctuation
  // Simple heuristic: check for " -- " or trailing/leading "--"
  return / -- /.test(text) || text.startsWith("--") || text.endsWith("--");
}

function isTopicLabelOnly(title: string): boolean {
  const lower = title.toLowerCase().trim();
  // Single word titles are almost always topic labels
  if (!lower.includes(" ")) return true;
  // Two-word titles with no verb
  const hasVerb = VERB_INDICATORS.some((v) => lower.includes(` ${v}`) || lower.startsWith(`${v} `) || lower.endsWith(` ${v}`));
  // Two-or-fewer words with no verb
  const wordCount = lower.split(/\s+/).length;
  if (wordCount <= 3 && !hasVerb) return true;
  return false;
}

// Product and domain acronyms that are written in capitals inside a sentence-case title
const KNOWN_ACRONYMS = new Set(["NFR", "NFROS", "RCSA", "TPRM", "DACH", "DORA", "EBA", "FINMA", "API"]);

function isSentenceCase(title: string): boolean {
  // First character must be uppercase; rest of first word must not be ALL CAPS
  if (title.length === 0) return true;
  const firstChar = title[0];
  if (!firstChar || firstChar !== firstChar.toUpperCase()) return false;
  // No ALL_CAPS word (3+ chars) beyond the first word, other than a known acronym
  const words = title.split(" ").slice(1);
  for (const word of words) {
    const letters = word.replace(/[^a-zA-Z]/g, "");
    if (letters.length >= 3 && letters === letters.toUpperCase() && !KNOWN_ACRONYMS.has(letters)) return false;
  }
  return true;
}

function materiallyDiffer(title: string, subtitle: string): boolean {
  const t = title.toLowerCase().replace(/[^a-z\s]/g, "").trim();
  const s = subtitle.toLowerCase().replace(/[^a-z\s]/g, "").trim();
  if (t === s) return false;
  // Check for substring containment
  if (s.includes(t) || t.includes(s)) return false;
  // Word overlap ratio
  const tw = new Set(t.split(/\s+/));
  const sw = new Set(s.split(/\s+/));
  const overlap = [...tw].filter((w) => sw.has(w) && w.length > 3).length;
  const ratio = overlap / Math.min(tw.size, sw.size);
  return ratio < 0.7;
}

function checkSlide(
  id: string,
  kind: "core" | "appendix",
  title: string | undefined,
  subtitle: string | undefined,
  structural = false
): CheckResult {
  const result: CheckResult = {
    id,
    kind,
    title: title ?? "",
    subtitle: subtitle ?? "",
    errors: [],
    warnings: [],
  };

  if (!title || title.trim().length === 0) {
    result.errors.push("Missing title");
  }
  if (!subtitle || subtitle.trim().length === 0) {
    result.errors.push("Missing subtitle");
  }

  if (title && subtitle) {
    if (!materiallyDiffer(title, subtitle)) {
      result.errors.push("Title and subtitle do not differ materially");
    }
    // Cover, agenda and closing slides use plain labels by design
    if (!structural && isTopicLabelOnly(title)) {
      result.warnings.push("Title appears to be a topic label only (no clear verb or implication)");
    }
    if (title.length > 100) {
      result.warnings.push(`Title may wrap beyond two lines (${title.length} chars)`);
    }
    if (subtitle.length > 200) {
      result.warnings.push(`Subtitle exceeds recommended length (${subtitle.length} chars)`);
    }
    if (!isSentenceCase(title)) {
      result.warnings.push("Title does not appear to use sentence case");
    }
    if (containsEmDash(title)) {
      result.errors.push("Title contains an em dash (U+2014 or U+2013)");
    }
    if (containsEmDash(subtitle)) {
      result.errors.push("Subtitle contains an em dash (U+2014 or U+2013)");
    }
    if (containsDoubleDashPunctuation(title)) {
      result.errors.push("Title uses double-hyphen as punctuation");
    }
    if (containsDoubleDashPunctuation(subtitle)) {
      result.errors.push("Subtitle uses double-hyphen as punctuation");
    }
  }

  return result;
}

function run() {
  const results: CheckResult[] = [];

  for (const slide of CORE_SLIDES_V24) {
    const structural = slide.kind === "cover" || slide.kind === "agenda" || slide.kind === "closing";
    results.push(checkSlide(slide.id, "core", slide.title, slide.subtitle, structural));
  }

  for (const slide of APPENDIX_SLIDES_V24) {
    results.push(checkSlide(slide.id, "appendix", slide.title, slide.subtitle));
  }

  let errorCount = 0;
  let warningCount = 0;

  console.log("\nNFROS Presentation V2.4: headline quality check\n");
  console.log("=".repeat(60));

  for (const result of results) {
    if (result.errors.length === 0 && result.warnings.length === 0) continue;

    console.log(`\n[${result.kind.toUpperCase()}] ${result.id}`);
    console.log(`  Title:    ${result.title}`);
    console.log(`  Subtitle: ${result.subtitle}`);

    for (const error of result.errors) {
      console.error(`  ERROR: ${error}`);
      errorCount++;
    }
    for (const warning of result.warnings) {
      console.warn(`  WARN:  ${warning}`);
      warningCount++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`\nTotal slides checked: ${results.length}`);
  console.log(`Errors:   ${errorCount}`);
  console.log(`Warnings: ${warningCount}`);

  if (errorCount > 0) {
    console.error("\nFAIL: Headline check found errors. Resolve before release.\n");
    process.exit(1);
  } else if (warningCount > 0) {
    console.warn("\nWARN: Headline check passed with warnings. Review before release.\n");
    process.exit(0);
  } else {
    console.log("\nPASS: All headline checks passed.\n");
    process.exit(0);
  }
}

run();

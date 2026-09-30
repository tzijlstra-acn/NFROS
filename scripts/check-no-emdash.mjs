#!/usr/bin/env node
/**
 * Copy quality gate.
 *
 * Fails the build on the em dash character (U+2014) anywhere in source,
 * seeded data, documentation, presentation content or translation files.
 * Also flags mojibake, placeholder copy, unsupported percentages, empty
 * citations and fake testimonials.
 *
 * Run with: npm run check:copy
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

const ROOT = process.cwd();

/*
 * `exports` is included deliberately.
 *
 * The brief requires export content to be free of the em dash, and the
 * exported speaker script is generated markdown. Scanning only the source
 * would let a generated artefact carry the character while the gate reported
 * clean. Binary exports (the PDF and the PowerPoint) are not text scanned
 * here; `scripts/scan-secrets.mjs` covers those for credential material, and
 * the deck copy itself originates in `src/scenario/data/story.ts`, which is
 * scanned.
 */
const SCAN_DIRS = ["src", "app", "docs", "scripts", "tests", "exports"];
const SCAN_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".md", ".mdx", ".json", ".css", ".html", ".txt", ".yml", ".yaml",
]);

const SKIP_DIRS = new Set([
  "node_modules", ".next", ".git", "out", "dist", "exports",
  "test-results", "playwright-report", "coverage", "migrations",
]);

/** This file necessarily contains the characters it looks for. */
const SELF = join("scripts", "check-no-emdash.mjs");

const EM_DASH = "—";
const EN_DASH = "–";

const RULES = [
  {
    id: "em-dash",
    severity: "error",
    label: "Em dash character (U+2014). Use commas, colons, semicolons, parentheses or separate sentences.",
    test: (line) => line.includes(EM_DASH),
  },
  {
    id: "mojibake",
    severity: "error",
    label: "Mojibake sequence. The file encoding is probably wrong.",
    test: (line) => /Ã[\u0080-¿]|â€™|â€œ|â€\u009d|Â[ -¿]|ï¿½/.test(line),
  },
  {
    id: "lorem-ipsum",
    severity: "error",
    label: "Lorem ipsum placeholder text.",
    test: (line) => /lorem\s+ipsum|dolor\s+sit\s+amet/i.test(line),
  },
  {
    id: "placeholder-copy",
    severity: "error",
    label: "Placeholder copy left in place.",
    /*
     * Case sensitive on purpose. The lower case word "placeholder" appears
     * legitimately in code that detects placeholders and in prose describing
     * them; an all caps marker is what a writer leaves behind by accident.
     */
    test: (line) =>
      /\b(TBD|XXX{1,}|PLACEHOLDER|INSERT TEXT|COPY HERE|LOREM)\b/.test(line) ||
      /\b(?:TODO|FIXME)\s*:\s*(?:copy|text|write|fill)/i.test(line) ||
      /\[\[\s*fill\s*\]\]/i.test(line),
  },
  {
    id: "fake-testimonial",
    severity: "error",
    label: "Apparent testimonial or named client quotation. Synthetic content must not imitate a real endorsement.",
    test: (line) => /"[^"]{25,}"\s*(?:--|,)?\s*(?:CRO|COO|CEO|Head of)\b.*\b(?:Bank|AG|Group)\b/.test(line),
  },
  {
    id: "unsupported-percentage",
    severity: "warn",
    label: "Percentage or multiple without a label of measured, illustrative or client input required.",
    test: (line, context) => {
      if (!/\b\d{1,3}(?:[.,]\d+)?\s*(?:%|percent)\b|\b\d+(?:[.,]\d+)?x\b/i.test(line)) return false;
      // Ignore code that computes or formats numbers, and CSS values.
      if (/[{};]\s*$/.test(line.trim()) && !/["'`]/.test(line)) return false;
      if (/(?:width|height|opacity|rgb|hsl|translate|scale|flex|top|left|right|bottom|inset|--[a-z-]+):/i.test(line)) return false;
      if (/\b(?:toFixed|Math\.|\/\s*100|\*\s*100|min-|max-)/.test(line)) return false;
      return !/(measured in this simulation|illustrative|client input required|scenario figure|synthetic)/i.test(context);
    },
  },
  {
    id: "empty-citation",
    severity: "warn",
    label: "Citation array or source field that is empty where evidence is claimed.",
    /*
     * Scoped to content files. In runtime code an empty evidence array is the
     * correct value for a call that retrieved nothing, so flagging it there
     * produces noise rather than signal.
     */
    contentOnly: true,
    test: (line) =>
      /(?:sourceIds|evidenceIds|supportingEvidenceIds)\s*:\s*\[\s*\]\s*,?\s*$/.test(line),
  },
  {
    id: "en-dash-range",
    severity: "warn",
    label: "En dash character (U+2013). Prefer the word to or a hyphen for ranges.",
    test: (line) => line.includes(EN_DASH),
  },
];

function walk(dir, files = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let stats;
    try {
      stats = statSync(full);
    } catch {
      continue;
    }
    if (stats.isDirectory()) {
      walk(full, files);
    } else if (SCAN_EXTENSIONS.has(extname(entry))) {
      files.push(full);
    }
  }
  return files;
}

function main() {
  const files = [];
  for (const dir of SCAN_DIRS) files.push(...walk(join(ROOT, dir)));

  const findings = [];
  let scanned = 0;

  for (const file of files) {
    const rel = relative(ROOT, file);
    if (rel === SELF || rel.split(sep).includes("migrations")) continue;
    scanned += 1;

    let contents;
    try {
      contents = readFileSync(file, "utf8");
    } catch {
      continue;
    }

    /*
     * Content files carry seeded copy, scenario data and documentation. Some
     * rules only make sense there.
     */
    const isContentFile =
      /\.(?:md|mdx|json)$/.test(rel) ||
      rel.includes(join("scenario", "data")) ||
      rel.includes(join("db", "seed")) ||
      rel.includes("i18n");

    const lines = contents.split(/\r?\n/);
    lines.forEach((line, index) => {
      // An explicit, reviewable opt out for lines that must contain a pattern.
      if (line.includes("copy-check-ignore")) return;

      // Context window helps the percentage rule see a nearby label.
      const context = lines.slice(Math.max(0, index - 3), index + 4).join("\n");
      for (const rule of RULES) {
        if (rule.contentOnly && !isContentFile) continue;
        if (rule.test(line, context)) {
          findings.push({
            file: rel,
            line: index + 1,
            rule: rule.id,
            severity: rule.severity,
            label: rule.label,
            excerpt: line.trim().slice(0, 130),
          });
        }
      }
    });
  }

  const errors = findings.filter((f) => f.severity === "error");
  const warnings = findings.filter((f) => f.severity === "warn");

  console.log(`Copy check scanned ${scanned} files.`);

  if (warnings.length > 0) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const f of warnings.slice(0, 40)) {
      console.log(`  ${f.file}:${f.line}  [${f.rule}] ${f.excerpt}`);
    }
    if (warnings.length > 40) console.log(`  ... and ${warnings.length - 40} more`);
  }

  if (errors.length > 0) {
    console.error(`\n${errors.length} error(s):`);
    for (const f of errors.slice(0, 60)) {
      console.error(`  ${f.file}:${f.line}  [${f.rule}] ${f.label}`);
      console.error(`    ${f.excerpt}`);
    }
    if (errors.length > 60) console.error(`  ... and ${errors.length - 60} more`);
    console.error("\nCopy check failed.");
    process.exit(1);
  }

  console.log("Copy check passed. No em dash character, mojibake or placeholder copy found.");
}

main();

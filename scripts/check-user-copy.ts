#!/usr/bin/env tsx
/**
 * User-copy quality gate for NFROS Presentation V2.2.
 *
 * Scans presentation data, speaker notes, and product-visible content for
 * prohibited punctuation patterns. Distinguishes human-facing copy from
 * technical syntax (CSS custom properties, CLI flags, code comments, imports).
 *
 * Exit 0 if clean. Exit 1 if violations found.
 *
 * Run with: npm run check:user-copy
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

const ROOT = process.cwd();

// ---------------------------------------------------------------------------
// Paths to scan
// ---------------------------------------------------------------------------

const SCAN_PATHS = [
  join(ROOT, "src", "presentation-v2-2", "data"),
  join(ROOT, "src", "presentation-v2-1", "data"),
  join(ROOT, "docs", "PRESENTATION_V2_2_SCRIPT.md"),
  join(ROOT, "docs", "PRESENTATION_V2_1_SCRIPT.md"),
  join(ROOT, "src", "db", "seed"),
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function collectFiles(scanPath: string): string[] {
  if (!existsSync(scanPath)) return [];

  const stats = statSync(scanPath);
  if (stats.isFile()) return [scanPath];

  const results: string[] = [];
  for (const entry of readdirSync(scanPath)) {
    const full = join(scanPath, entry);
    let entryStats: ReturnType<typeof statSync>;
    try {
      entryStats = statSync(full);
    } catch {
      continue;
    }
    if (entryStats.isDirectory()) {
      results.push(...collectFiles(full));
    } else if ([".ts", ".tsx", ".md", ".mdx"].includes(extname(entry))) {
      results.push(full);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// String extraction
// The regex below captures content inside double-quoted, single-quoted, and
// backtick-quoted strings. It is intentionally simple: multi-line template
// literals split across lines will be checked line by line, which is
// sufficient for detecting punctuation violations.
// ---------------------------------------------------------------------------

const STRING_CONTENT_RE = /(?:"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`)/g;

// Match `--` that is NOT immediately followed by a letter or digit.
// This allows CSS custom properties (--my-var) and CLI flags (--noEmit)
// which have a letter immediately after the hyphens.
const DOUBLE_HYPHEN_RE = /--(?![a-zA-Z0-9])/g;

// Em dash U+2014
const EM_DASH = "\u2014";

// ---------------------------------------------------------------------------
// Violation type
// ---------------------------------------------------------------------------

interface Violation {
  file: string;
  line: number;
  rule: "em-dash" | "double-hyphen";
  excerpt: string;
}

// ---------------------------------------------------------------------------
// Check a single file
// ---------------------------------------------------------------------------

function checkFile(filePath: string): Violation[] {
  const violations: Violation[] = [];
  const rel = relative(ROOT, filePath);

  let contents: string;
  try {
    contents = readFileSync(filePath, "utf8");
  } catch {
    return violations;
  }

  const lines = contents.split(/\r?\n/);

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trimStart();

    // Skip TypeScript / JS comment lines
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
      return;
    }

    // Skip import statements
    if (trimmed.startsWith("import ") || trimmed.startsWith("export { ")) {
      return;
    }

    // For Markdown files, check the whole line (not just string literals)
    if (filePath.endsWith(".md") || filePath.endsWith(".mdx")) {
      // Skip markdown horizontal rules (--- or ----)
      if (/^-{3,}\s*$/.test(trimmed)) return;
      // Skip markdown code fences
      if (trimmed.startsWith("```")) return;
      // Skip indented code blocks
      if (trimmed.startsWith("    ")) return;

      // Em dash
      if (line.includes(EM_DASH)) {
        violations.push({
          file: rel,
          line: lineNum,
          rule: "em-dash",
          excerpt: line.trim().slice(0, 140),
        });
      }
      // Double hyphen in markdown prose
      if (true) {
        let mdMatch: RegExpExecArray | null;
        const mdDhRe = /--(?![a-zA-Z0-9])/g;
        // Exclude inline code spans by removing backtick content first
        const lineWithoutCode = line.replace(/`[^`]*`/g, "");
        while ((mdMatch = mdDhRe.exec(lineWithoutCode)) !== null) {
          violations.push({
            file: rel,
            line: lineNum,
            rule: "double-hyphen",
            excerpt: line.trim().slice(0, 140),
          });
          break; // one report per line is enough
        }
      }
      return;
    }

    // For TypeScript / TSX files, extract string literal content only
    let match: RegExpExecArray | null;
    const reForLine = new RegExp(STRING_CONTENT_RE.source, "g");

    while ((match = reForLine.exec(line)) !== null) {
      // The captured string content is in group 1, 2, or 3
      const stringContent = match[1] ?? match[2] ?? match[3] ?? "";

      // Em dash check
      if (stringContent.includes(EM_DASH)) {
        violations.push({
          file: rel,
          line: lineNum,
          rule: "em-dash",
          excerpt: line.trim().slice(0, 140),
        });
      }

      // Double-hyphen check
      // Skip strings that are clearly CSS variable references: var(--name)
      // Skip strings that are a CLI flag on their own: start with "--"
      const cleaned = stringContent
        // Remove CSS var() calls so --variable-name inside var() is not flagged
        .replace(/var\(--[a-zA-Z0-9-]+\)/g, "")
        // Remove CSS custom property names that appear as standalone tokens
        .replace(/--[a-zA-Z][a-zA-Z0-9-]*/g, "");

      const dhRe = new RegExp(DOUBLE_HYPHEN_RE.source, "g");
      let dhMatch: RegExpExecArray | null;
      while ((dhMatch = dhRe.exec(cleaned)) !== null) {
        // The cleaned content still has a bare '--' that is not a CSS prop or CLI flag
        violations.push({
          file: rel,
          line: lineNum,
          rule: "double-hyphen",
          excerpt: line.trim().slice(0, 140),
        });
        break; // one report per string per line is enough
      }
    }
  });

  return violations;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const allFiles: string[] = [];
  for (const scanPath of SCAN_PATHS) {
    allFiles.push(...collectFiles(scanPath));
  }

  // Deduplicate
  const uniqueFiles = [...new Set(allFiles)];

  const allViolations: Violation[] = [];
  for (const filePath of uniqueFiles) {
    allViolations.push(...checkFile(filePath));
  }

  console.log(`User-copy check scanned ${uniqueFiles.length} file(s).`);

  if (allViolations.length === 0) {
    console.log("User-copy check passed. No em dash or prohibited double-hyphen found.");
    process.exit(0);
  }

  // Group by file for readability
  const byFile = new Map<string, Violation[]>();
  for (const v of allViolations) {
    const existing = byFile.get(v.file) ?? [];
    existing.push(v);
    byFile.set(v.file, existing);
  }

  console.error(`\n${allViolations.length} violation(s) found:\n`);
  for (const [file, violations] of byFile) {
    console.error(`  ${file}`);
    for (const v of violations) {
      const rule = v.rule === "em-dash"
        ? "em-dash (U+2014): use commas, colons, semicolons, or separate sentences"
        : 'double-hyphen "--": use commas, colons, semicolons, or separate sentences';
      console.error(`    line ${v.line}  [${v.rule}] ${rule}`);
      console.error(`      ${v.excerpt}`);
    }
  }

  console.error("\nUser-copy check failed.");
  process.exit(1);
}

main();

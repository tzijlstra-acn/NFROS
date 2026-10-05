/**
 * Accenture Brand Preflight Script for NFROS Presentation V2.2
 *
 * Checks brand compliance rules and generates a report.
 * Exit 0 if no errors (warnings are non-blocking), 1 if errors.
 *
 * Run with: npm run check:accenture-brand
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CheckResult = {
  level: "PASS" | "WARN" | "FAIL";
  message: string;
};

type BrandMode =
  | "Development only"
  | "Brand preflight passed"
  | "Approval pending"
  | "Approved for external use";

// ---------------------------------------------------------------------------
// Asset resolution
// ---------------------------------------------------------------------------

const BRAND_ASSET_DIR = process.env.ACCENTURE_BRAND_ASSET_DIR ?? "";

function resolveAsset(filename: string): string | null {
  if (!BRAND_ASSET_DIR) return null;
  const path = join(BRAND_ASSET_DIR, filename);
  return existsSync(path) ? path : null;
}

const logoFull =
  resolveAsset("accenture-logo-full.svg") ??
  resolveAsset("accenture-logo.svg");

const greaterThan =
  resolveAsset("accenture-greater-than.svg") ??
  resolveAsset("greater-than.svg");

const graphikRegular =
  resolveAsset("Graphik-Regular.woff2") ??
  resolveAsset("Graphik-Regular.otf");

const graphikSemibold =
  resolveAsset("Graphik-Semibold.woff2") ??
  resolveAsset("Graphik-Semibold.otf");

const fontInUse: "Graphik" | "Arial" = graphikRegular ? "Graphik" : "Arial";

const brandMode: BrandMode =
  logoFull && greaterThan ? "Brand preflight passed" : "Development only";

// ---------------------------------------------------------------------------
// File collectors
// ---------------------------------------------------------------------------

function walkDir(dir: string, ext: string[]): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;

  function walk(current: string) {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (ext.includes(extname(full).toLowerCase())) {
        results.push(full);
      }
    }
  }

  walk(dir);
  return results;
}

const PV22_SRC = join(process.cwd(), "src", "presentation-v2-2");
const CSS_FILES = walkDir(PV22_SRC, [".css"]);
const TS_FILES = walkDir(PV22_SRC, [".ts", ".tsx"]);
const DATA_DIR = join(process.cwd(), "src", "presentation-v2-1", "data");
const DATA_FILES = walkDir(DATA_DIR, [".ts", ".tsx", ".json"]);

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

const results: CheckResult[] = [];

function pass(msg: string) {
  results.push({ level: "PASS", message: msg });
}
function warn(msg: string) {
  results.push({ level: "WARN", message: msg });
}
function fail(msg: string) {
  results.push({ level: "FAIL", message: msg });
}

// 1. Logo asset
if (logoFull) {
  pass("Accenture logo asset found: " + logoFull);
} else if (!BRAND_ASSET_DIR) {
  warn("Logo missing: ACCENTURE_BRAND_ASSET_DIR not set, development mode only");
} else {
  warn("Logo missing: expected accenture-logo-full.svg or accenture-logo.svg in " + BRAND_ASSET_DIR);
}

// 2. Greater Than symbol
if (greaterThan) {
  pass("Greater Than symbol found: " + greaterThan);
} else if (!BRAND_ASSET_DIR) {
  warn("Greater Than symbol missing: ACCENTURE_BRAND_ASSET_DIR not set, development mode only");
} else {
  warn("Greater Than symbol missing: expected accenture-greater-than.svg or greater-than.svg in " + BRAND_ASSET_DIR);
}

// 3. Font check
if (graphikRegular && graphikSemibold) {
  pass("Graphik font found (Regular + Semibold)");
} else if (graphikRegular) {
  warn("Graphik Regular found but Semibold missing: may affect headings");
} else {
  warn("Graphik font not found: using Arial fallback (acceptable for development)");
}

// 4. CSS: circular element check (border-radius: 50% or 9999px)
{
  const CIRCLE_PATTERN = /border-radius\s*:\s*(?:50%|9999px|100%)/gi;
  const LARGE_RADIUS_PATTERN = /border-radius\s*:\s*(\d+)px/gi;
  let circleFound = false;
  let largeRadiusFound = false;
  const circleFiles: string[] = [];
  const largeRadiusFiles: string[] = [];

  for (const file of CSS_FILES) {
    const content = readFileSync(file, "utf-8");
    if (CIRCLE_PATTERN.test(content)) {
      circleFound = true;
      circleFiles.push(file);
    }
    // Reset lastIndex for global regex
    LARGE_RADIUS_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = LARGE_RADIUS_PATTERN.exec(content)) !== null) {
      const value = parseInt(match[1] ?? "0", 10);
      // Allow up to 8px; flag > 8px unless it appears inside a comment or product frame class
      if (value > 8) {
        const lineStart = content.lastIndexOf("\n", match.index) + 1;
        const lineEnd = content.indexOf("\n", match.index);
        const line = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
        // Skip if it's the product radius variable itself
        if (!line.includes("--pv22-radius-product") && !line.includes("product")) {
          largeRadiusFound = true;
          largeRadiusFiles.push(file);
          break;
        }
      }
    }
  }

  if (circleFound) {
    fail("Circular image crops prohibited: border-radius: 50%/9999% found in: " + circleFiles.join(", "));
  } else {
    pass("No circular element crops in CSS");
  }

  if (largeRadiusFound) {
    warn("Large border-radius (> 8px) found on non-product elements in: " + largeRadiusFiles.join(", ") + ": verify not prohibited rounded-card layout");
  }
}

// 5. CSS: aqua colour check
{
  // Aqua hex values: #00BAFF and similar cyan/aqua variants
  const AQUA_PATTERN = /#(?:00[Bb][Aa][Ff][Ff]|00[Cc][Cc][Ff][Ff]|00[Ff][Ff][Ff][Ff]|[0-9A-Fa-f]{2}[Ee][Ff][Ff][Ff])/g;
  const AQUA_NAMED = /\baqua\b|\bcyan\b/gi;
  const aquaFiles: string[] = [];

  for (const file of CSS_FILES) {
    const content = readFileSync(file, "utf-8");
    if (AQUA_PATTERN.test(content) || AQUA_NAMED.test(content)) {
      aquaFiles.push(file);
    }
  }

  if (aquaFiles.length > 0) {
    fail("Aqua colours prohibited in light mode deck, found in: " + aquaFiles.join(", "));
  } else {
    pass("No aqua colours in light deck CSS");
  }
}

// 6. brand-tokens.css: verify --pv22-radius: 0px
{
  const tokensFile = join(PV22_SRC, "styles", "brand-tokens.css");
  if (existsSync(tokensFile)) {
    const content = readFileSync(tokensFile, "utf-8");
    if (/--pv22-radius\s*:\s*0px/.test(content)) {
      pass("brand-tokens.css: --pv22-radius is 0px (angular geometry)");
    } else {
      fail("brand-tokens.css: --pv22-radius is not 0px: Accenture uses angular geometry by default");
    }
  } else {
    warn("brand-tokens.css not found at " + tokensFile);
  }
}

// 7. Prohibited copy patterns in data files
{
  const PROHIBITED_COPY: Array<{ pattern: RegExp; label: string; blocking: boolean }> = [
    {
      pattern: /reinvented\s+with\s+accenture/i,
      label: '"Reinvented with Accenture" campaign lock-up (prohibited)',
      blocking: true,
    },
    {
      pattern: /let\s+there\s+be\s+change/i,
      label: '"Let There Be Change" (prohibited unless approved)',
      blocking: true,
    },
    {
      pattern: /\bbest[\s-]in[\s-]class\b/i,
      label: '"best in class" (prohibited unless cited)',
      blocking: false,
    },
    {
      pattern: /\bmarket[\s-]leading\b/i,
      label: '"market leading" (prohibited unless cited)',
      blocking: false,
    },
    {
      pattern: /\brevolutionary\b/i,
      label: '"revolutionary" (prohibited unless cited)',
      blocking: false,
    },
    {
      pattern: /\bgame[\s-]changing\b/i,
      label: '"game changing" (prohibited unless cited)',
      blocking: false,
    },
    {
      pattern: /\bunprecedented\b/i,
      label: '"unprecedented" (prohibited unless cited)',
      blocking: false,
    },
    {
      pattern: /\bfully[\s-]compliant\b/i,
      label: '"fully compliant" (prohibited unless cited)',
      blocking: false,
    },
    {
      pattern: /\bproduction[\s-]ready\b/i,
      label: '"production ready" (prohibited unless cited)',
      blocking: false,
    },
    {
      pattern: /(?<!"[^"]*)"[^"]*--[^"]*"/,
      label: 'Double-hyphen "--" in string values (use em-dash or reword)',
      blocking: false,
    },
  ];

  const allDataFiles = [...DATA_FILES, ...TS_FILES];

  for (const check of PROHIBITED_COPY) {
    const matchedFiles: string[] = [];
    for (const file of allDataFiles) {
      const content = readFileSync(file, "utf-8");
      if (check.pattern.test(content)) {
        matchedFiles.push(file);
      }
    }
    if (matchedFiles.length > 0) {
      const msg = check.label + ", found in: " + matchedFiles.join(", ");
      if (check.blocking) {
        fail(msg);
      } else {
        warn(msg);
      }
    }
  }

  // Report pass if no prohibited campaign copy found
  const blockingPatterns = PROHIBITED_COPY.filter((c) => c.blocking);
  const anyBlocking = blockingPatterns.some((c) => {
    return allDataFiles.some((f) => c.pattern.test(readFileSync(f, "utf-8")));
  });
  if (!anyBlocking) {
    pass("No prohibited campaign copy detected");
  }
}

// 8. Presentation V2.4 (the current deck)
{
  const PV24_SRC = join(process.cwd(), "src", "presentation-v2-4");
  const pv24Css = walkDir(PV24_SRC, [".css"]);
  const pv24Ts = walkDir(PV24_SRC, [".ts", ".tsx"]);

  // Circular crops are prohibited for imagery; geometric number badges are not imagery
  const imageRoundCrop: string[] = [];
  for (const file of pv24Css) {
    const content = readFileSync(file, "utf-8");
    for (const rule of content.split("}")) {
      const [selector = "", body = ""] = rule.split("{");
      if (/\b(img|photo|capture|proof|screenshot)\b/i.test(selector) && /border-radius\s*:\s*(?:50%|9999px|100%)/i.test(body)) {
        imageRoundCrop.push(`${file} (${selector.trim()})`);
      }
    }
  }
  for (const file of pv24Ts.filter((f) => /product-proof/i.test(f))) {
    if (/borderRadius\s*:\s*["'](?:50%|100%)["']/.test(readFileSync(file, "utf-8"))) imageRoundCrop.push(file);
  }
  if (imageRoundCrop.length > 0) fail("V2.4: circular crops on product imagery: " + imageRoundCrop.join(", "));
  else pass("V2.4: product imagery uses square frames");

  const AQUA = /#(?:00[Bb][Aa][Ff][Ff]|00[Cc][Cc][Ff][Ff]|00[Ff][Ff][Ff][Ff])\b|\baqua\b|\bcyan\b/i;
  const aqua = [...pv24Css, ...pv24Ts].filter((f) => AQUA.test(readFileSync(f, "utf-8")));
  if (aqua.length > 0) fail("V2.4: aqua colours in the light deck: " + aqua.join(", "));
  else pass("V2.4: no aqua colours");

  const tokens = join(PV24_SRC, "styles", "tokens.css");
  if (existsSync(tokens) && /--pv24-canvas\s*:\s*#F[0-9A-F]{5}/i.test(readFileSync(tokens, "utf-8"))) pass("V2.4: light canvas token");
  else fail("V2.4: --pv24-canvas is not a light colour");

  // The licensed brand font (Graphik) must never be distributed; open-licence product fonts are fine
  const fontFiles = [
    ...walkDir(join(process.cwd(), "public"), [".woff", ".woff2", ".otf", ".ttf"]),
    ...walkDir(join(process.cwd(), "src"), [".woff", ".woff2", ".otf", ".ttf"]),
  ].filter((f) => /graphik/i.test(f));
  if (fontFiles.length > 0) fail("Licensed Graphik font files must not be distributed: " + fontFiles.join(", "));
  else pass("No licensed brand font files distributed in the repository");

  // No invented NFROS logo artwork in the deck
  const logoFiles = [...walkDir(PV24_SRC, [".svg", ".png"]), ...walkDir(join(process.cwd(), "public", "presentation-assets", "v2.4-final"), [".svg"])]
    .filter((f) => /logo/i.test(f));
  if (logoFiles.length > 0) fail("V2.4: logo artwork found: " + logoFiles.join(", "));
  else pass("V2.4: no NFROS or altered Accenture logo artwork");

  const campaign = /reinvented\s+with\s+accenture|let\s+there\s+be\s+change/i;
  const campaignFiles = pv24Ts.filter((f) => campaign.test(readFileSync(f, "utf-8")));
  if (campaignFiles.length > 0) fail("V2.4: unapproved campaign copy: " + campaignFiles.join(", "));
  else pass("V2.4: no unapproved campaign copy");

  const unsupported = /\b(?:best[\s-]in[\s-]class|market[\s-]leading|revolutionary|game[\s-]changing|unprecedented|fully[\s-]compliant|production[\s-]ready|guaranteed)\b/i;
  const unsupportedFiles = pv24Ts.filter((f) => unsupported.test(readFileSync(f, "utf-8")));
  if (unsupportedFiles.length > 0) fail("V2.4: unsupported claims: " + unsupportedFiles.join(", "));
  else pass("V2.4: no unsupported superlatives or compliance claims");
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const hasErrors = results.some((r) => r.level === "FAIL");
const hasWarnings = results.some((r) => r.level === "WARN");

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const BOLD = "\x1b[1m";
const CYAN = "\x1b[36m";

function colorLevel(level: CheckResult["level"]): string {
  if (level === "PASS") return GREEN + "[PASS]" + RESET;
  if (level === "WARN") return YELLOW + "[WARN]" + RESET;
  return RED + "[FAIL]" + RESET;
}

console.log("");
console.log(BOLD + CYAN + "Accenture Brand Preflight Report" + RESET);
console.log(BOLD + "=================================" + RESET);
console.log(`Brand mode:      ${BOLD}${brandMode}${RESET}`);
console.log(`Font:            ${BOLD}${fontInUse === "Graphik" ? "Graphik (licensed)" : "Arial (fallback)"}${RESET}`);
console.log(`Logo asset:      ${logoFull ? GREEN + "Found" + RESET : YELLOW + "Missing" + RESET}`);
console.log(`Greater Than:    ${greaterThan ? GREEN + "Found" + RESET : YELLOW + "Missing" + RESET}`);
console.log(`Graphik Regular: ${graphikRegular ? GREEN + "Found" + RESET : YELLOW + "Missing" + RESET}`);
console.log(`Graphik Semibold:${graphikSemibold ? GREEN + "Found" + RESET : YELLOW + "Missing" + RESET}`);
console.log("");
console.log(BOLD + "Checks:" + RESET);
for (const result of results) {
  console.log(`  ${colorLevel(result.level)} ${result.message}`);
}
console.log("");

if (hasErrors) {
  console.log(RED + BOLD + "Brand release status: BLOCKED, errors must be resolved before external use" + RESET);
} else if (hasWarnings) {
  console.log(YELLOW + BOLD + `Brand release status: ${brandMode} (warnings present: review before external use)` + RESET);
} else {
  console.log(GREEN + BOLD + `Brand release status: ${brandMode}` + RESET);
}
console.log("");

process.exit(hasErrors ? 1 : 0);

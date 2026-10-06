/**
 * Rewrites the release section of README.md from the release registry.
 *
 * The section runs from the "## Release" heading to the generated closing
 * line, both defined in `src/product/release/readme.ts`. Everything else in
 * the README is left exactly as it is. Run after changing
 * `src/product/release/product-release.ts`, `role-release.ts` or the Role App
 * registry; `tests/unit/product-release.test.ts` fails until you do.
 *
 * Usage: npx tsx scripts/sync-release-readme.ts
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  README_RELEASE_END,
  README_RELEASE_START,
  renderReleaseMarkdown,
} from "../src/product/release/readme";

const path = join(process.cwd(), "README.md");
const readme = readFileSync(path, "utf-8").replace(/\r\n/g, "\n");

const start = readme.indexOf(`\n${README_RELEASE_START}\n`);
const end = readme.indexOf(README_RELEASE_END, start);

if (start < 0 || end < 0) {
  console.error(
    `README.md has no release section. Add a line "${README_RELEASE_START}" followed by the closing line from src/product/release/readme.ts, then run this again.`,
  );
  process.exit(1);
}

const next =
  readme.slice(0, start + 1) + renderReleaseMarkdown() + readme.slice(end + README_RELEASE_END.length);

if (next === readme) {
  console.log("README.md release section is already current.");
} else {
  writeFileSync(path, next, "utf-8");
  console.log("README.md release section rewritten from the release registry.");
}

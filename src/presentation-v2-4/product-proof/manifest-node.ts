// Node only. Reads the manifest from disk for scripts and tests.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ASSET_DIR_V24 } from "./asset-registry";
import { MANIFEST_FILE_V24, parseManifestV24 } from "./manifest-schema";
import type { PresentationManifestV24 } from "./types";

export function manifestPathV24(root: string = process.cwd()): string {
  return join(root, ASSET_DIR_V24, MANIFEST_FILE_V24);
}

export function readManifestV24(root: string = process.cwd()): PresentationManifestV24 {
  const path = manifestPathV24(root);
  if (!existsSync(path)) {
    throw new Error(`Manifest not found at ${path}. Run npm run presentation:capture-v2-4.`);
  }
  return parseManifestV24(JSON.parse(readFileSync(path, "utf8")) as unknown);
}

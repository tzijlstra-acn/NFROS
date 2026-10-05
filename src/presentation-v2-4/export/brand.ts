import { existsSync } from "node:fs";
import { join } from "node:path";

export interface BrandAssetStatus {
  configured: boolean;
  logo: boolean;
  greaterThan: boolean;
  font: boolean;
  complete: boolean;
  missing: string[];
}

/** Mirrors the asset lookup in scripts/check-accenture-brand.ts. Never returns paths. */
export function resolveBrandAssets(dir: string = process.env.ACCENTURE_BRAND_ASSET_DIR ?? ""): BrandAssetStatus {
  const has = (...names: string[]) => Boolean(dir) && names.some((n) => existsSync(join(dir, n)));
  const logo = has("accenture-logo-full.svg", "accenture-logo.svg");
  const greaterThan = has("accenture-greater-than.svg", "greater-than.svg");
  const font = has("Graphik-Regular.woff2", "Graphik-Regular.otf") && has("Graphik-Semibold.woff2", "Graphik-Semibold.otf");
  const missing = [
    ...(dir ? [] : ["ACCENTURE_BRAND_ASSET_DIR is not set"]),
    ...(logo ? [] : ["approved Accenture logo"]),
    ...(greaterThan ? [] : ["Greater Than symbol"]),
    ...(font ? [] : ["Graphik Regular and Semibold"]),
  ];
  return { configured: Boolean(dir), logo, greaterThan, font, complete: logo && greaterThan && font, missing };
}

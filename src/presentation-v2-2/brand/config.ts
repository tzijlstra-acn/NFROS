import { existsSync } from "fs";
import { join } from "path";

const BRAND_ASSET_DIR = process.env.ACCENTURE_BRAND_ASSET_DIR ?? "";

function resolveAsset(filename: string): string | null {
  if (!BRAND_ASSET_DIR) return null;
  const path = join(BRAND_ASSET_DIR, filename);
  return existsSync(path) ? path : null;
}

export const BRAND_ASSETS = {
  logoFull: resolveAsset("accenture-logo-full.svg") ?? resolveAsset("accenture-logo.svg"),
  greaterThan: resolveAsset("accenture-greater-than.svg") ?? resolveAsset("greater-than.svg"),
  graphikRegular: resolveAsset("Graphik-Regular.woff2") ?? resolveAsset("Graphik-Regular.otf"),
  graphikSemibold: resolveAsset("Graphik-Semibold.woff2") ?? resolveAsset("Graphik-Semibold.otf"),
} as const;

export const BRAND_MODE: "development" | "preflight-passed" | "approval-pending" | "approved-external" =
  BRAND_ASSETS.logoFull && BRAND_ASSETS.greaterThan
    ? "preflight-passed"
    : "development";

export const FONT_FAMILY =
  BRAND_ASSETS.graphikRegular ? "Graphik, Arial, sans-serif" : "Arial, sans-serif";

export const FONT_IN_USE: "Graphik" | "Arial" =
  BRAND_ASSETS.graphikRegular ? "Graphik" : "Arial";

// Accenture colour system (official values)
export const BRAND_COLORS = {
  corePurple:     "#A100FF",
  darkestPurple:  "#460073",
  darkPurple:     "#7500C0",
  lightPurple:    "#C2A3FF",
  lightestPurple: "#E6DCFF",
  black:          "#000000",
  white:          "#FFFFFF",
  canvas:         "#F5F6F8",
  textPrimary:    "#172033",
  textSecondary:  "#475467",
  border:         "#E4E7EC",
} as const;

import { isAssetIdV24 } from "./asset-registry";
import type {
  CapturedAssetV24,
  PresentationAssetIdV24,
  PresentationManifestV24,
  SubRegionBoxV24,
} from "./types";

export const MANIFEST_FILE_V24 = "manifest.json";

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function str(obj: Json, key: string, where: string): string {
  const value = obj[key];
  if (typeof value !== "string") throw new Error(`${where}.${key} must be a string`);
  return value;
}

function num(obj: Json, key: string, where: string): number {
  const value = obj[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${where}.${key} must be a finite number`);
  }
  return value;
}

function box(value: unknown, where: string): SubRegionBoxV24 {
  if (!isObject(value)) throw new Error(`${where} must be an object`);
  return {
    x: num(value, "x", where),
    y: num(value, "y", where),
    width: num(value, "width", where),
    height: num(value, "height", where),
  };
}

function entry(value: unknown, where: string): CapturedAssetV24 {
  if (!isObject(value)) throw new Error(`${where} must be an object`);
  const viewport = value["viewport"];
  if (!isObject(viewport)) throw new Error(`${where}.viewport must be an object`);
  const rawSub = value["subRegions"];
  if (!isObject(rawSub)) throw new Error(`${where}.subRegions must be an object`);
  const subRegions: Record<string, SubRegionBoxV24> = {};
  for (const [name, raw] of Object.entries(rawSub)) {
    subRegions[name] = box(raw, `${where}.subRegions.${name}`);
  }
  return {
    file: str(value, "file", where),
    width: num(value, "width", where),
    height: num(value, "height", where),
    deviceScaleFactor: num(value, "deviceScaleFactor", where),
    sha256: str(value, "sha256", where),
    route: str(value, "route", where),
    region: str(value, "region", where),
    bytes: num(value, "bytes", where),
    viewport: {
      width: num(viewport, "width", `${where}.viewport`),
      height: num(viewport, "height", `${where}.viewport`),
    },
    background: /^#[0-9a-f]{6}$/i.test(String(value["background"])) ? String(value["background"]) : "#ffffff",
    subRegions,
  };
}

/** Validates an unknown value as a V2.4 product-proof manifest. Throws on any mismatch. */
export function parseManifestV24(raw: unknown): PresentationManifestV24 {
  if (!isObject(raw)) throw new Error("manifest must be an object");
  const rawAssets = raw["assets"];
  if (!isObject(rawAssets)) throw new Error("manifest.assets must be an object");
  const assets: Partial<Record<PresentationAssetIdV24, CapturedAssetV24>> = {};
  for (const [id, value] of Object.entries(rawAssets)) {
    if (!isAssetIdV24(id)) throw new Error(`manifest.assets has unknown id ${id}`);
    assets[id] = entry(value, `manifest.assets.${id}`);
  }
  const notCaptured: Partial<Record<PresentationAssetIdV24, string>> = {};
  const rawNot = raw["notCaptured"];
  if (isObject(rawNot)) {
    for (const [id, reason] of Object.entries(rawNot)) {
      if (isAssetIdV24(id) && typeof reason === "string") notCaptured[id] = reason;
    }
  }
  return {
    version: str(raw, "version", "manifest"),
    capturedAt: str(raw, "capturedAt", "manifest"),
    commit: str(raw, "commit", "manifest"),
    worktreeDirty: raw["worktreeDirty"] === true,
    baseUrl: typeof raw["baseUrl"] === "string" ? raw["baseUrl"] : "",
    assets,
    notCaptured,
  };
}

// Client-safe typed access to the captured manifest. Written by the capture script.

import rawManifest from "../../../public/presentation-assets/v2.4-final/manifest.json";
import { parseManifestV24 } from "./manifest-schema";
import type {
  CapturedAssetV24,
  PresentationAssetIdV24,
  PresentationManifestV24,
  SubRegionBoxV24,
} from "./types";

function load(): { manifest: PresentationManifestV24 | null; error: string | null } {
  try {
    return { manifest: parseManifestV24(rawManifest as unknown), error: null };
  } catch (error) {
    return { manifest: null, error: error instanceof Error ? error.message : String(error) };
  }
}

const loaded = load();

export const PRODUCT_MANIFEST_V24: PresentationManifestV24 | null = loaded.manifest;
export const PRODUCT_MANIFEST_ERROR_V24: string | null = loaded.error;

export function getCaptureV24(id: PresentationAssetIdV24): CapturedAssetV24 | null {
  return PRODUCT_MANIFEST_V24?.assets[id] ?? null;
}

export function getSubRegionV24(id: PresentationAssetIdV24, name: string): SubRegionBoxV24 | null {
  return getCaptureV24(id)?.subRegions[name] ?? null;
}

export function getSubRegionNamesV24(id: PresentationAssetIdV24): string[] {
  return Object.keys(getCaptureV24(id)?.subRegions ?? {});
}

/** Why an asset has no capture, when it has none. */
export function notCapturedReasonV24(id: PresentationAssetIdV24): string | null {
  if (getCaptureV24(id)) return null;
  return PRODUCT_MANIFEST_V24?.notCaptured[id] ?? PRODUCT_MANIFEST_ERROR_V24 ?? "Not captured yet.";
}

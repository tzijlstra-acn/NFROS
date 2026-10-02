import { describe, it, expect } from "vitest";
import { CORE_SLIDES_V23 } from "@/presentation-v2-3/data/core-story";

describe("V2.3 slide renderer coverage", () => {
  const EXPECTED_VISUAL_TYPES = [
    "hero-signal",
    "agenda-map",
    "fragmentation-flow",
    "operating-system-spine",
    "role-os-focus",
    "role-mirror",
    "process-rail",
    "authority-boundary",
    "outcome-shift",
    "evidence-thread",
    "service-shelf",
    "rollout-path",
    "design-partner-canvas",
  ] as const;

  it("has 13 core slides", () => {
    expect(CORE_SLIDES_V23).toHaveLength(13);
  });

  it("every core slide has a unique visualType", () => {
    const types = CORE_SLIDES_V23.map((s) => s.visualType);
    const unique = new Set(types);
    expect(unique.size).toBe(13);
  });

  it("every expected visualType appears exactly once", () => {
    const types = new Set(CORE_SLIDES_V23.map((s) => s.visualType));
    for (const expected of EXPECTED_VISUAL_TYPES) {
      expect(types.has(expected)).toBe(true);
    }
  });

  it("every slide has a non-empty title", () => {
    for (const slide of CORE_SLIDES_V23) {
      expect(slide.title.length).toBeGreaterThan(0);
    }
  });

  it("every slide has appendixRefs array", () => {
    for (const slide of CORE_SLIDES_V23) {
      expect(Array.isArray(slide.appendixRefs)).toBe(true);
    }
  });

  it("slides with productAssets use registry IDs", async () => {
    const { ASSET_REGISTRY } = await import("@/presentation-v2-3/product-proof/asset-registry");
    const registryIds = new Set(ASSET_REGISTRY.map((a) => a.id));
    for (const slide of CORE_SLIDES_V23) {
      for (const assetId of slide.productAssets ?? []) {
        expect(registryIds.has(assetId)).toBe(true);
      }
    }
  });

  it("no slide has a screenshotAsset string (use registry IDs instead)", () => {
    for (const slide of CORE_SLIDES_V23) {
      // V2.3 uses productAssets (typed IDs), not screenshotAsset (strings)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((slide as any).screenshotAsset).toBeUndefined();
    }
  });

  it("all speaker notes avoid double-hyphen punctuation", () => {
    for (const slide of CORE_SLIDES_V23) {
      if (slide.speakerNotes) {
        // Allow CSS var() double-hyphen but flag space-surrounded --
        expect(slide.speakerNotes).not.toMatch(/ -- /);
      }
    }
  });
});

describe("V2.3 asset registry", () => {
  it("every registry entry has a canonical file name", async () => {
    const { ASSET_REGISTRY } = await import("@/presentation-v2-3/product-proof/asset-registry");
    for (const asset of ASSET_REGISTRY) {
      expect(asset.file).toMatch(/^[a-z0-9-]+\.png$/);
    }
  });

  it("core-required assets exist as placeholder files", async () => {
    const { CORE_REQUIRED_ASSETS, ASSET_DIR } = await import("@/presentation-v2-3/product-proof/asset-registry");
    const { existsSync } = await import("fs");
    const { join } = await import("path");
    for (const asset of CORE_REQUIRED_ASSETS) {
      const path = join(process.cwd(), ASSET_DIR, asset.file);
      expect(existsSync(path)).toBe(true);
    }
  });
});

import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Route matrix for /story deck versioning
//
// Default (no param) and aliases "current" and "v2.4" -> PresentationV24
// "v2.3"                                               -> PresentationV23 (comparison)
// "v2.2"                                               -> PresentationV22 (comparison)
// "v2.1"                                               -> PresentationV21
// "legacy", "v1", "v2"                                 -> original StoryDeck
// ---------------------------------------------------------------------------

const V24_COVER_TITLE = "AI can return NFR capacity to judgment";

async function expectV24(page: import("@playwright/test").Page) {
  await expect(page.locator(".pv24-slide")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".pv23-deck")).toHaveCount(0);
  await expect(page.locator("[data-story-scenes]")).toHaveCount(0);
}

test("/story opens V2.4 on the cover", async ({ page }) => {
  await page.goto("/story");
  await expect(page).not.toHaveURL(/deck=v1/);
  await expectV24(page);
  await expect(page.getByRole("heading", { name: V24_COVER_TITLE })).toBeVisible();
});

test("/story?deck=current opens V2.4", async ({ page }) => {
  await page.goto("/story?deck=current");
  await expectV24(page);
  await expect(page.getByRole("heading", { name: V24_COVER_TITLE })).toBeVisible();
});

test("/story?deck=v2.4 opens V2.4", async ({ page }) => {
  await page.goto("/story?deck=v2.4");
  await expectV24(page);
});

test("/story?deck=v2.4&core=3 opens the third core slide directly", async ({ page }) => {
  await page.goto("/story?deck=v2.4&core=3");
  await expectV24(page);
  await expect(page.getByRole("heading", { name: "Fragmented work consumes capacity before judgment begins" })).toBeVisible();
});

test("/story?deck=v2.4 with an invalid core number falls back to the cover", async ({ page }) => {
  await page.goto("/story?deck=v2.4&core=abc");
  await expectV24(page);
  await expect(page.getByRole("heading", { name: V24_COVER_TITLE })).toBeVisible();
});

test("/story?deck=v2.3 remains available for comparison", async ({ page }) => {
  await page.goto("/story?deck=v2.3");
  await expect(page.locator(".pv23-deck")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".pv24-slide")).toHaveCount(0);
});

test("/story?deck=v2.2 renders without error", async ({ page }) => {
  await page.goto("/story?deck=v2.2");
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("[data-story-scenes]")).toHaveCount(0);
  await expect(page.locator(".pv24-slide")).toHaveCount(0);
});

test("/story?deck=v2.1 renders the V2.1 presentation container", async ({ page }) => {
  await page.goto("/story?deck=v2.1");
  await expect(page.locator(".pv21-deck")).toBeVisible({ timeout: 10_000 });
});

for (const legacy of ["legacy", "v1", "v2"]) {
  test(`/story?deck=${legacy} falls back to the original StoryDeck`, async ({ page }) => {
    await page.goto(`/story?deck=${legacy}`);
    await expect(page.locator("[data-story-scenes]")).toBeAttached({ timeout: 10_000 });
  });
}

test("/story?export=1&safe=1 renders V2.4 export mode without error", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/story?deck=v2.4&export=1&safe=1");
  await expectV24(page);
  expect(errors).toEqual([]);
});

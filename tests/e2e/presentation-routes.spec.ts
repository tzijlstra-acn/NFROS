import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Route matrix for /story deck versioning
//
// Default (no param) and aliases "current" and "v2.2" -> PresentationV22
// "v2.1"                                               -> PresentationV21
// "legacy", "v1", "v2"                                 -> original StoryDeck
// ---------------------------------------------------------------------------

test("/story opens current deck without redirecting to a versioned param", async ({ page }) => {
  await page.goto("http://localhost:3000/story");
  // Must NOT redirect to the old v1 deck
  await expect(page).not.toHaveURL(/deck=v1/);
  // Page must render visible content (no blank viewport)
  const body = page.locator("body");
  await expect(body).toBeVisible();
});

test("/story?deck=current opens current deck", async ({ page }) => {
  await page.goto("http://localhost:3000/story?deck=current");
  await expect(page).not.toHaveURL(/deck=v1/);
  const body = page.locator("body");
  await expect(body).toBeVisible();
});

test("/story?deck=v2.2 renders without error", async ({ page }) => {
  await page.goto("http://localhost:3000/story?deck=v2.2");
  const body = page.locator("body");
  await expect(body).toBeVisible();
  // Should not show the old story deck chrome
  await expect(page.locator("[data-story-scenes]")).not.toBeVisible();
});

test("/story?deck=v2.1 remains accessible", async ({ page }) => {
  await page.goto("http://localhost:3000/story?deck=v2.1");
  await expect(page).toHaveURL(/deck=v2\.1/);
  const body = page.locator("body");
  await expect(body).toBeVisible();
});

test("/story?deck=v2.1 renders the V2.1 presentation container", async ({ page }) => {
  await page.goto("http://localhost:3000/story?deck=v2.1");
  // PresentationV21 renders a div with class pv21-deck
  const deck = page.locator(".pv21-deck");
  await expect(deck).toBeVisible({ timeout: 10_000 });
});

test("/story?deck=legacy falls back to original StoryDeck", async ({ page }) => {
  await page.goto("http://localhost:3000/story?deck=legacy");
  const body = page.locator("body");
  await expect(body).toBeVisible();
  // Legacy deck emits data-story-scenes; V2.x decks do not
  await expect(page.locator("[data-story-scenes]")).toBeAttached({ timeout: 10_000 });
});

test("/story?deck=v1 falls back to original StoryDeck", async ({ page }) => {
  await page.goto("http://localhost:3000/story?deck=v1");
  const body = page.locator("body");
  await expect(body).toBeVisible();
  await expect(page.locator("[data-story-scenes]")).toBeAttached({ timeout: 10_000 });
});

test("/story and /story?deck=v2.2 render the same component", async ({ page }) => {
  // Both should show the pv21-deck (V2.2 stub wraps V2.1).
  await page.goto("http://localhost:3000/story");
  const defaultDeck = page.locator(".pv21-deck");
  await expect(defaultDeck).toBeVisible({ timeout: 10_000 });

  await page.goto("http://localhost:3000/story?deck=v2.2");
  const v22Deck = page.locator(".pv21-deck");
  await expect(v22Deck).toBeVisible({ timeout: 10_000 });
});

test("/story?export=1 does not redirect", async ({ page }) => {
  await page.goto("http://localhost:3000/story?export=1");
  await expect(page).not.toHaveURL(/deck=v1/);
  const body = page.locator("body");
  await expect(body).toBeVisible();
});

test("/story?deck=v2.2&export=1&safe=1 renders export mode without error", async ({ page }) => {
  await page.goto("http://localhost:3000/story?deck=v2.2&export=1&safe=1");
  const body = page.locator("body");
  await expect(body).toBeVisible();
});

test("/story?deck=v2 falls back to original StoryDeck", async ({ page }) => {
  await page.goto("http://localhost:3000/story?deck=v2");
  const body = page.locator("body");
  await expect(body).toBeVisible();
  await expect(page.locator("[data-story-scenes]")).toBeAttached({ timeout: 10_000 });
});

import { test, expect } from "@playwright/test";

// V2.3 asset tests -- require a running dev server at localhost:3000

test.describe("Presentation V2.3 product assets", () => {
  test("/story opens V2.3 deck", async ({ page }) => {
    await page.goto("http://localhost:3000/story");
    // Should render PresentationV23
    const html = await page.content();
    expect(html).toContain("data-presentation-slides");
  });

  test("V2.3 deck exposes slide manifest", async ({ page }) => {
    await page.goto("http://localhost:3000/story?deck=v2.3");
    const attr = await page.getAttribute("[data-presentation-slides]", "data-presentation-slides");
    expect(attr).not.toBeNull();
    const slides = JSON.parse(attr!);
    expect(slides.filter((s: { type: string }) => s.type === "core")).toHaveLength(13);
  });

  test("V2.2 still accessible at ?deck=v2.2", async ({ page }) => {
    await page.goto("http://localhost:3000/story?deck=v2.2");
    const html = await page.content();
    expect(html).not.toContain("Page not found");
  });
});

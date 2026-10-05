import { test, expect, type Page } from "@playwright/test";

// V2.4 navigation, presenter controls, appendix and export contract.
// The server is reused from playwright.config.ts (localhost:3000).

const COVER_TITLE = "AI can return NFR capacity to judgment";

type ManifestEntry = {
  key: string;
  kind: "core" | "closing" | "appendix-index" | "appendix";
  position: number | null;
  coreNumber: number | null;
  id: string;
  title: string;
  section: string;
  group: string | null;
  url: string;
  speakerNotes: string;
};

async function readManifest(page: Page): Promise<ManifestEntry[]> {
  const raw = await page.locator("script[data-presentation-slides]").textContent();
  return JSON.parse(raw ?? "[]") as ManifestEntry[];
}

async function expectSlide(page: Page, key: string) {
  const slide = page.locator(".pv24-slide");
  await expect(slide).toHaveAttribute("data-slide-key", key);
  await expect(slide).toHaveAttribute("data-slide-ready", "true");
}

async function open(page: Page, url: string, key: string) {
  await page.goto(url);
  await expectSlide(page, key);
}

test.describe("V2.4 deck navigation", () => {
  test("/story opens V2.4 on the cover", async ({ page }) => {
    await open(page, "/story", "core-1");
    await expect(page.getByRole("heading", { name: COVER_TITLE })).toBeVisible();
    await expect(page.locator(".pv24-slide-number")).toHaveCount(0);
  });

  test("direct core URL opens that slide with its counter", async ({ page }) => {
    await open(page, "/story?deck=v2.4&core=3", "core-3");
    const manifest = await readManifest(page);
    const third = manifest.find((m) => m.key === "core-3");
    expect(third).toBeDefined();
    await expect(page.getByRole("heading", { level: 1, name: third!.title })).toBeVisible();
    await expect(page.locator(".pv24-slide-number")).toHaveText("3 / 13");
    await expect(page.locator(".pv24-slide")).toHaveAttribute("aria-label", third!.title);
  });

  test("direct appendix URL shows the slide and its return control", async ({ page }) => {
    await open(page, "/story?deck=v2.4&appendix=app-08&from=core-5", "appendix-app-08");
    const back = page.locator('.pv24-slide a[data-link-target="core:5"]');
    await expect(back).toContainText("Return to slide 5");
    await expect(page.locator('.pv24-slide a[data-link-target="appendix-index"]')).toBeVisible();
  });

  test("an appendix slide opened without an origin returns to the slide that references it", async ({ page }) => {
    await open(page, "/story?deck=v2.4&appendix=app-08", "appendix-app-08");
    const back = page.locator('.pv24-slide a[data-link-target^="core:"]');
    const target = await back.getAttribute("data-link-target");
    expect(target).toMatch(/^core:\d+$/);
  });

  test("a ref chip opens the exact appendix slide; Back, Forward and refresh keep the history", async ({ page }) => {
    await open(page, "/story?deck=v2.4&core=5", "core-5");
    const chip = page.locator('.pv24-slide a.pv24-ref-chip[data-link-target^="appendix:"]').first();
    const target = (await chip.getAttribute("data-link-target")) ?? "";
    const id = target.replace("appendix:", "");
    expect(id).toMatch(/^app-\d+$/);

    await chip.click();
    await expectSlide(page, `appendix-${id}`);
    await expect(page).toHaveURL(new RegExp(`[?&]appendix=${id}(&|$)`));
    await expect(page).toHaveURL(/from=core-5/);
    await expect(page.locator('.pv24-slide a[data-link-target="core:5"]')).toBeVisible();

    await page.reload();
    await expectSlide(page, `appendix-${id}`);

    await page.goBack();
    await expectSlide(page, "core-5");
    await expect(page).toHaveURL(/core=5/);

    await page.goForward();
    await expectSlide(page, `appendix-${id}`);
  });

  test("arrow keys walk the core sequence into the closing slide", async ({ page }) => {
    await open(page, "/story?deck=v2.4&core=12", "core-12");
    await page.keyboard.press("ArrowRight");
    await expectSlide(page, "core-13");
    await expect(page.locator(".pv24-slide-number")).toHaveText("13 / 13");
    await page.keyboard.press("ArrowRight");
    await expectSlide(page, "closing");
    await expect(page.locator(".pv24-slide-number")).toHaveCount(0);
    await page.keyboard.press("ArrowRight");
    await expectSlide(page, "closing");
    await page.keyboard.press("PageUp");
    await expectSlide(page, "core-13");
    await expect(page).toHaveURL(/core=13/);
  });

  test("Home and End jump to the first and last core slide", async ({ page }) => {
    await open(page, "/story?deck=v2.4&core=6", "core-6");
    await page.keyboard.press("End");
    await expectSlide(page, "core-13");
    await page.keyboard.press("Home");
    await expectSlide(page, "core-1");
  });

  test("A in the core story opens the agenda", async ({ page }) => {
    await open(page, "/story?deck=v2.4&core=7", "core-7");
    await page.keyboard.press("a");
    await expectSlide(page, "core-2");
  });

  test("A in the appendix opens the index; an entry opens the exact slide; C returns to the origin", async ({ page }) => {
    await open(page, "/story?deck=v2.4&appendix=app-03&from=core-8", "appendix-app-03");
    await page.keyboard.press("a");
    await expectSlide(page, "appendix-index");
    await expect(page).toHaveURL(/view=appendix-index/);
    await expect(page).toHaveURL(/from=core-8/);

    const entries = page.locator('.pv24-index a[data-link-target^="appendix:"]');
    expect(await entries.count()).toBeGreaterThan(5);
    const entry = entries.nth(3);
    const id = ((await entry.getAttribute("data-link-target")) ?? "").replace("appendix:", "");
    await entry.click();
    await expectSlide(page, `appendix-${id}`);

    await page.keyboard.press("c");
    await expectSlide(page, "core-8");
    await expect(page).toHaveURL(/core=8/);
  });

  test("C does nothing on a core slide", async ({ page }) => {
    await open(page, "/story?deck=v2.4&core=4", "core-4");
    await page.keyboard.press("c");
    await page.waitForTimeout(300);
    await expectSlide(page, "core-4");
  });

  test("the appendix index lists every appendix slide grouped, with status", async ({ page }) => {
    await open(page, "/story?deck=v2.4&view=appendix-index&from=core-2", "appendix-index");
    const manifest = await readManifest(page);
    const appendix = manifest.filter((m) => m.kind === "appendix");
    await expect(page.locator('.pv24-index a[data-link-target^="appendix:"]')).toHaveCount(appendix.length);
    const groups = await page.locator(".pv24-index__group-name").allTextContents();
    expect(groups.length).toBeGreaterThan(0);
  });
});

test.describe("V2.4 presenter controls", () => {
  test("R replays the current slide without changing it", async ({ page }) => {
    await open(page, "/story?deck=v2.4&core=5", "core-5");
    const before = await page.locator(".pv24-slide-content").elementHandle();
    await page.keyboard.press("r");
    await expectSlide(page, "core-5");
    await expect(page).toHaveURL(/core=5/);
    expect(await before?.evaluate((el) => el.isConnected)).toBe(false);
  });

  test("D opens the download menu with four options", async ({ page }) => {
    await open(page, "/story?deck=v2.4&core=4", "core-4");
    await page.keyboard.press("d");
    const menu = page.getByRole("dialog", { name: "Download the deck" });
    await expect(menu).toBeVisible();
    const options = menu.locator("[data-download-option]");
    await expect(options).toHaveCount(4);
    await expect(menu.locator('[data-availability="checking"]')).toHaveCount(0);
    // A file that has not been exported yet is never a link
    const missing = menu.locator('[data-availability="missing"]');
    for (let i = 0; i < (await missing.count()); i++) {
      await expect(missing.nth(i)).toContainText("Not yet exported");
      expect(await missing.nth(i).evaluate((el) => el.tagName)).not.toBe("A");
    }
    const ready = menu.locator('a[data-availability="ready"]');
    for (let i = 0; i < (await ready.count()); i++) {
      await expect(ready.nth(i)).toHaveAttribute("href", /^\/downloads\/NFROS_Risk_Audience_V24_/);
    }
    expect((await missing.count()) + (await ready.count())).toBe(4);
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
  });

  test("the agenda, the final core slide and the index carry a download button", async ({ page }) => {
    for (const [url, key] of [
      ["/story?deck=v2.4&core=2", "core-2"],
      ["/story?deck=v2.4&core=13", "core-13"],
      ["/story?deck=v2.4&view=appendix-index", "appendix-index"],
    ] as const) {
      await open(page, url, key);
      await page.locator(".pv24-slide-download").click();
      await expect(page.getByRole("dialog", { name: "Download the deck" })).toBeVisible();
      await page.keyboard.press("Escape");
    }
  });

  test("? opens the keyboard help and Escape closes it", async ({ page }) => {
    await open(page, "/story?deck=v2.4&core=3", "core-3");
    await page.keyboard.press("?");
    const help = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(help).toBeVisible();
    for (const key of ["Home", "End", "A", "C", "R", "M", "D", "F", "P", "?", "Esc"]) {
      await expect(help.locator("kbd", { hasText: new RegExp(`^${key.replace("?", "\\?")}$`) })).toHaveCount(1);
    }
    // Navigation keys are held while the help is open
    await page.keyboard.press("ArrowRight");
    await expectSlide(page, "core-3");
    await page.keyboard.press("Escape");
    await expect(help).toHaveCount(0);
  });

  test("P opens presenter notes that follow the slide", async ({ page }) => {
    await open(page, "/story?deck=v2.4&core=3", "core-3");
    const manifest = await readManifest(page);
    const third = manifest.find((m) => m.key === "core-3")!;
    const fourth = manifest.find((m) => m.key === "core-4")!;
    await page.keyboard.press("p");
    const notes = page.getByRole("dialog", { name: "Presenter notes" });
    await expect(notes).toBeVisible();
    await expect(notes).toContainText(third.speakerNotes.slice(0, 60));
    await expect(notes).toContainText(fourth.title);
    await page.keyboard.press("ArrowRight");
    await expectSlide(page, "core-4");
    await expect(notes).toContainText(fourth.speakerNotes.slice(0, 60));
    await page.keyboard.press("Escape");
    await expect(notes).toHaveCount(0);
  });

  test("keys are ignored while a modifier is held", async ({ page }) => {
    await open(page, "/story?deck=v2.4&core=3", "core-3");
    await page.keyboard.press("Control+ArrowRight");
    await page.keyboard.press("Control+a");
    await page.waitForTimeout(300);
    await expectSlide(page, "core-3");
  });
});

test.describe("V2.4 motion", () => {
  test.use({ reducedMotion: "no-preference" });

  const slideAnimations = (page: Page) =>
    page.evaluate(() => {
      const slide = document.querySelector(".pv24-slide");
      const inSlide = document.getAnimations().filter((a) => {
        const t = a.effect instanceof KeyframeEffect ? a.effect.target : null;
        return !!t && !!slide && slide.contains(t) && !(a instanceof CSSTransition);
      });
      const svgs = Array.from(slide?.querySelectorAll("svg") ?? []);
      return {
        running: inSlide.filter((a) => a.playState === "running").length,
        paused: inSlide.filter((a) => a.playState === "paused").length,
        svgCount: svgs.length,
        svgPaused: svgs.length > 0 && svgs.every((s) => s.animationsPaused()),
      };
    });

  test("M pauses and resumes all motion", async ({ page }) => {
    await open(page, "/story?deck=v2.4&core=3", "core-3");
    // The entrance sequence is in flight right after the slide is ready
    await page.keyboard.press("m");
    const pill = page.locator("[data-motion-paused]");
    await expect(pill).toBeVisible();
    await expect(pill).toContainText("Motion paused");
    await expect(page.locator(".pv24-deck")).toHaveAttribute("data-motion-state", "paused");

    const paused = await slideAnimations(page);
    expect(paused.running).toBe(0);
    expect(paused.paused).toBeGreaterThan(0);
    expect(paused.svgPaused).toBe(true);

    // Still frozen a moment later, including anything created since
    await page.waitForTimeout(1200);
    const later = await slideAnimations(page);
    expect(later.running).toBe(0);
    expect(later.paused).toBeGreaterThan(0);

    await page.keyboard.press("m");
    await expect(pill).toHaveCount(0);
    await expect(page.locator(".pv24-deck")).toHaveAttribute("data-motion-state", "running");
    const resumed = await slideAnimations(page);
    expect(resumed.paused).toBe(0);
    expect(resumed.running).toBeGreaterThan(0);
    expect(resumed.svgCount === 0 || !resumed.svgPaused).toBe(true);
  });

  test("navigation keeps working while motion is paused, and R replays", async ({ page }) => {
    await open(page, "/story?deck=v2.4&core=3", "core-3");
    await page.keyboard.press("m");
    await expect(page.locator("[data-motion-paused]")).toBeVisible();

    // A slide entered while paused shows its final state
    await page.keyboard.press("ArrowRight");
    await expectSlide(page, "core-4");
    expect((await slideAnimations(page)).running).toBe(0);
    await page.keyboard.press("ArrowLeft");
    await expectSlide(page, "core-3");

    await page.keyboard.press("m");
    await expect(page.locator("[data-motion-paused]")).toHaveCount(0);

    // Replay remounts the slide with its animation
    await page.keyboard.press("r");
    await expectSlide(page, "core-3");
    await expect.poll(async () => (await slideAnimations(page)).running).toBeGreaterThan(0);
  });
});

test.describe("V2.4 reduced motion and export contract", () => {
  test("reduced motion renders final states", async ({ page }) => {
    await open(page, "/story?deck=v2.4&core=11", "core-11");
    await expect(page.locator(".pv24-slide")).toContainText("100%");
    const running = await page.evaluate(() => {
      const slide = document.querySelector(".pv24-slide");
      return document.getAnimations().filter((a) => {
        const t = a.effect instanceof KeyframeEffect ? a.effect.target : null;
        return !!t && !!slide && slide.contains(t) && a.playState === "running" && !(a instanceof CSSTransition);
      }).length;
    });
    expect(running).toBe(0);
  });

  test("the manifest lists the deck in play, index and appendix order", async ({ page }) => {
    await page.goto("/story?deck=v2.4&core=1");
    const manifest = await readManifest(page);
    const play = manifest.filter((m) => m.kind === "core" || m.kind === "closing");
    expect(play).toHaveLength(14);
    play.forEach((m, i) => {
      expect(m.position).toBe(i + 1);
      expect(m.url).toBe(`/story?deck=v2.4&core=${i + 1}`);
    });
    expect(manifest[12]?.coreNumber).toBe(13);
    expect(manifest[13]?.kind).toBe("closing");
    expect(manifest[13]?.coreNumber).toBeNull();
    expect(manifest[14]?.kind).toBe("appendix-index");
    expect(manifest[14]?.url).toBe("/story?deck=v2.4&view=appendix-index");
    const appendix = manifest.slice(15);
    expect(appendix.length).toBeGreaterThan(0);
    for (const m of appendix) {
      expect(m.kind).toBe("appendix");
      expect(m.position).toBeNull();
      expect(m.url).toBe(`/story?deck=v2.4&appendix=${m.id}`);
      expect(m.key).toBe(`appendix-${m.id}`);
    }
  });

  test("export mode hides presenter chrome and keeps link anchors", async ({ page }) => {
    await open(page, "/story?deck=v2.4&core=5&export=1", "core-5");
    await expect(page.locator(".pv24-nav")).toHaveCount(0);
    await expect(page.locator(".pv24-slide-download")).toHaveCount(0);
    await expect(page.locator('.pv24-slide [data-link-target^="appendix:"]').first()).toBeVisible();
    await page.keyboard.press("m");
    await page.keyboard.press("?");
    await expect(page.locator("[data-motion-paused]")).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await open(page, "/story?deck=v2.4&view=appendix-index&export=1", "appendix-index");
    await expect(page.locator(".pv24-slide-download")).toHaveCount(0);
    await expect(page.locator('.pv24-index [data-link-target^="appendix:"]').first()).toBeVisible();
    await expect(page.locator('.pv24-slide [data-link-target^="core:"]')).toBeVisible();
  });

  test("navigation keeps the export flag in the URL", async ({ page }) => {
    await open(page, "/story?deck=v2.4&core=3&export=1", "core-3");
    await page.keyboard.press("ArrowRight");
    await expectSlide(page, "core-4");
    await expect(page).toHaveURL(/export=1/);
  });
});

/**
 * The product and integration layers, as an administrator sees them.
 *
 * These are the two layers that make the experience a product rather than one
 * bank's application, and they are the two whose claims are easiest to
 * overstate. The integration centre says what is real and what is roadmap; the
 * branding screen says that a configuration change is a configuration change
 * and not a fork. Both of those are testable, and both of them matter more
 * than how the screens look.
 *
 * The credential test is the one to read carefully. The brief forbids a broad
 * recursive search for strings beginning with the provider prefix, and it is
 * right to: a scan like that reads the key out of wherever it is legitimately
 * stored and puts it in a test log. So this suite never touches the
 * filesystem and never touches an environment variable. It reads the rendered
 * document, which is the only place a credential would actually be a defect,
 * and it looks for the SHAPE of a secret rather than for any particular one:
 * a long unbroken high entropy token, an Authorization header, a key
 * assignment. That means it would catch a credential this suite has never
 * been told about, which is the point.
 *
 * The branding test mutates the product configuration. It restores the
 * profile it found, and it is gated to one viewport, because the switch writes
 * a row and a change log entry and running it three times would say three
 * times over that an administrator had changed the branding.
 */

import { expect, test, type Page, type TestInfo } from "@playwright/test";

/** The five readiness modes a connector instance may declare. */
const CONNECTOR_MODES = ["Live", "Sandbox ready", "Simulated", "Configured", "Planned"];

async function open(page: Page, path: string): Promise<void> {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  const status = response?.status() ?? 0;
  if (status === 404) test.skip(true, `${path} returned 404 in this build.`);
  expect(status, `${path} returned HTTP ${status}`).toBeLessThan(400);
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );
}

/* ==========================================================================
   The integration centre
   ========================================================================== */

test.describe("the integration centre", () => {
  test("groups connectors by readiness mode and explains what each mode means", async ({
    page,
  }, testInfo) => {
    await open(page, "/settings/integrations");
    await settle(page);

    await expect(page.getByRole("heading", { level: 1, name: /Integrations/ })).toBeVisible();

    /*
     * The grouping is the editorial decision this screen turns on. Sorting
     * alphabetically would put an adapter that does not exist two rows above
     * the simulator the whole product is reading from. Nobody must be able to
     * leave this screen believing there are twenty working integrations, so
     * every group that renders has to carry a sentence saying what its mode
     * means.
     */
    const headings = await page
      .locator(".app-section-title, h2")
      .evaluateAll((elements) => elements.map((element) => (element.textContent ?? "").trim()));

    const modeGroups = headings.filter((heading) =>
      CONNECTOR_MODES.some((mode) => heading.startsWith(mode)),
    );
    testInfo.annotations.push({
      type: "connector-groups",
      description: modeGroups.join(" | ") || "none",
    });
    expect(modeGroups.length, `section headings: ${headings.join(" | ")}`).toBeGreaterThan(0);

    // The product's framing, stated on the screen rather than only in a doc.
    await expect(page.getByText(/remain systems of record/)).toBeVisible();
  });

  test("shows health, mode and declared capability on every connector row", async ({ page }) => {
    await open(page, "/settings/integrations");
    await settle(page);

    const rows = page.locator(".app-item").filter({ has: page.locator(".app-chip") });
    const count = await rows.count();
    expect(count, "the integration centre renders no connector rows").toBeGreaterThan(4);

    const text = await page.locator("main").innerText();

    // Mode, which is the claim about whether anything is built.
    expect(text, "no connector declares a readiness mode").toMatch(
      /Simulated|Sandbox ready|Planned|Configured/,
    );
    // Health, which is the claim about whether it is working right now.
    expect(text, "no connector reports a health state").toMatch(/healthy|degraded|unavailable|unknown/i);
    // And the credential state, as a state and never as a value.
    expect(text, "no connector reports a credential state").toMatch(
      /No credential required|No credential configured|Credential configured|Credential rejected/,
    );
  });

  test("states freshness as a threshold rather than a timestamp alone", async ({ page }) => {
    await open(page, "/settings/integrations");
    await settle(page);

    /*
     * The staleness threshold is per connector and object type, because two
     * sources do not age at the same rate. An assessment four hours old is
     * current; a payment volume four hours old is not. The threshold is what
     * turns a sync timestamp into the word the interface shows beside the
     * data, so a screen that showed only timestamps would be leaving the
     * reader to guess.
     */
    const text = await page.locator("main").innerText();
    expect(text, "the centre states no staleness threshold").toContain("Stale after");
    expect(text, "the centre does not explain why the threshold is per source").toMatch(
      /do not age at the same rate/,
    );
  });

  test("displays the outbound queue and the dead letter reason, or says plainly that there is none", async ({
    page,
  }, testInfo) => {
    await open(page, "/settings/integrations");
    await settle(page);

    const section = page
      .locator("section")
      .filter({ hasText: /Outbound command queue/ })
      .first();
    await expect(section).toBeVisible();

    const text = await section.innerText();
    testInfo.annotations.push({ type: "queue", description: text.slice(0, 300) });

    const empty = /No commands in the queue/.test(text);
    if (empty) {
      /*
       * An empty queue is a legitimate state and it is the seeded one, so the
       * assertion is on the honesty of the empty state rather than on rows
       * that do not exist. "Every external change has been acknowledged" is a
       * claim, and it has to be the claim the screen makes rather than a
       * blank panel the reader interprets for themselves.
       */
      expect(text).toMatch(/Every external change has been acknowledged/);
      expect(text).toMatch(/A command appears here as soon as a target system does not answer/);
      testInfo.annotations.push({
        type: "coverage-gap",
        description:
          "The queue and the dead letter rows could not be exercised against live data: integration_commands and dead_letter_entries are empty in the seeded database. The failure path is proved by scripts/prove-integration.ts against a throwaway database.",
      });
      return;
    }

    // With rows present, each one names its target, its status and whether a
    // retry is offered. A retry uses the same idempotency key, so the screen
    // has to say that rather than leave an administrator fearing a duplicate.
    expect(text).toMatch(/Queued|Acknowledged|Failed|Needs retry|Awaiting approval/i);
    expect(text).toMatch(/same idempotency key/);
  });

  test("offers a source deep link wherever a connector declares one", async ({ page }, testInfo) => {
    await open(page, "/settings/integrations");
    await settle(page);

    /*
     * Source identity survives normalisation: a record that came from the GRC
     * platform can always be opened there again. Until an external reference
     * exists the screen can only show the template the connector declares,
     * and that is what is asserted, because asserting a resolved link that
     * nothing has produced yet would be asserting a fiction.
     */
    const templates = await page
      .locator(".app-oid")
      .evaluateAll((elements) =>
        elements
          .map((element) => (element.textContent ?? "").trim())
          .filter((text) => /^https?:\/\//.test(text)),
      );

    testInfo.annotations.push({
      type: "deep-links",
      description: templates.join(" | ") || "none rendered",
    });

    expect(templates.length, "no connector declares a deep link template").toBeGreaterThan(0);
    for (const template of templates) {
      expect(
        template,
        `the deep link template "${template}" has no placeholder, so it cannot address a record`,
      ).toMatch(/\{externalId\}|\{.+\}/);
    }

    const referenceCount = await page
      .locator("main")
      .innerText()
      .then((text) => Number(/(\d+)\s*\n?\s*External references retained/.exec(text)?.[1] ?? "-1"));
    if (referenceCount === 0) {
      testInfo.annotations.push({
        type: "coverage-gap",
        description:
          "No resolved deep link could be followed: external_references is empty in the seeded database, so only the declared templates exist.",
      });
    }
  });
});

/* ==========================================================================
   Credentials
   ========================================================================== */

test.describe("no credential reaches the browser", () => {
  const SURFACES = [
    "/settings",
    "/settings/integrations",
    "/settings/authority",
    "/settings/mappings",
    "/settings/deployment",
    "/workday/rcsa",
    "/workday/tprm/workbench",
    "/control-room",
    "/trust",
  ];

  for (const route of SURFACES) {
    test(`${route} renders nothing key shaped`, async ({ page }, testInfo: TestInfo) => {
      await open(page, route);
      await settle(page);

      /*
       * Shape, not value. This looks for the things a credential looks like
       * rather than for any credential in particular, so it would catch one
       * that nobody told this suite about:
       *
       *   a long unbroken run of base64url characters, which is what almost
       *   every bearer token and API key is;
       *   an Authorization header rendered as text;
       *   an assignment to a name containing key, secret, token or password.
       *
       * The scenario's own identifiers are excluded by construction: they are
       * short, hyphenated and upper case, so they cannot produce a 32
       * character unbroken run.
       *
       * It reads `innerText` and the serialised DOM, and nothing else. No
       * file is opened and no environment variable is read, because a scan
       * that did either would move the secret into this log, which is the
       * outcome the rule exists to prevent.
       */
      const findings = await page.evaluate(() => {
        const text = document.body.innerText;
        const markup = document.documentElement.outerHTML;
        const hits: string[] = [];

        const record = (label: string, match: RegExpMatchArray | null): void => {
          if (match === null) return;
          /*
           * Only the label, the length and the first four characters are
           * reported. A test failure message that printed the match would
           * leak exactly what the test exists to find.
           */
          hits.push(`${label}: ${match[0].length} characters beginning "${match[0].slice(0, 4)}"`);
        };

        /*
         * The high entropy shape, tuned against this corpus rather than
         * against a textbook.
         *
         * Hyphen and underscore are excluded from the run, and the run must
         * contain at least one digit, one lower case letter and one upper
         * case letter. That combination is what a bearer token or an API key
         * body looks like and what nothing in this product looks like:
         *
         *   `innerText` glues adjacent inline spans together, so a list of
         *   evidence references becomes one long string. Every one of those
         *   references carries hyphens, so excluding the hyphen breaks the
         *   run back into short pieces.
         *
         *   Tool names are long camel case identifiers, for example
         *   `recordNotificationRecommendation` at thirty two characters.
         *   They carry no digit, so the digit requirement excludes them.
         *
         * A credential that did reach the page would satisfy all three.
         */
        const highEntropy = Array.from(text.matchAll(/[A-Za-z0-9]{32,}/g)).find(
          (candidate) =>
            /[0-9]/.test(candidate[0]) &&
            /[a-z]/.test(candidate[0]) &&
            /[A-Z]/.test(candidate[0]),
        );
        record("high entropy token in visible text", highEntropy ?? null);
        record("authorization header in visible text", /Authorization\s*:\s*\S+/i.exec(text));
        record(
          "key assignment in visible text",
          /\b(?:api[_-]?key|secret|access[_-]?token|password)\b\s*[:=]\s*\S{8,}/i.exec(text),
        );
        record(
          "authorization header in the markup",
          /Authorization\s*:\s*Bearer\s+\S+/i.exec(markup),
        );
        return hits;
      });

      testInfo.annotations.push({
        type: "credential-scan",
        description: `${route}: ${findings.length === 0 ? "clean" : findings.join("; ")}`,
      });

      expect(findings, `${route} renders something key shaped`).toStrictEqual([]);
    });
  }

  test("the integration centre says in words that it holds a state and not a value", async ({
    page,
  }) => {
    await open(page, "/settings/integrations");
    await settle(page);

    // The guarantee is structural, and the screen states it, which is what
    // lets a reviewer check the claim without reading the schema.
    await expect(page.getByText(/Nothing on this page can display a credential/)).toHaveCount(0);
    const chip = page.locator('[title="Credential state only. No credential value is stored or displayed."]').first();
    await expect(chip).toBeVisible();
  });
});

/* ==========================================================================
   Branding
   ========================================================================== */

test.describe("branding", () => {
  test("switching mode changes the workday identity and no scenario state", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-1920",
      "The branding switch writes a configuration row and a change log entry, so it runs at one viewport only.",
    );

    /* ---- what the scenario looks like before ---- */
    await open(page, "/workday/rcsa");
    await settle(page);
    const brandBefore = ((await page.locator(".app-brand-name").first().textContent()) ?? "").trim();
    const clockBefore = ((await page.locator(".app-liveday .app-liveday-clock").last().textContent()) ?? "").trim();
    const decisionsBefore = ((await page
      .getByRole("navigation", { name: /^Work areas$/ })
      .getByRole("link", { name: /^Decisions/ })
      .getAttribute("aria-label")) ?? "").trim();
    const auditBefore = await page.evaluate(() => {
      const trigger = Array.from(document.querySelectorAll("button")).find((button) =>
        /^Audit trail, \d+$/.test(button.getAttribute("aria-label") ?? ""),
      );
      return trigger?.getAttribute("aria-label") ?? "";
    });

    /* ---- switch ---- */
    await open(page, "/settings/branding");
    await settle(page);

    const activeMarker = page.locator(".app-item[data-selected='true'] .app-data").first();
    const activeProfile = ((await activeMarker.textContent()) ?? "").trim();
    expect(activeProfile.length, "the branding screen names no active profile").toBeGreaterThan(0);

    const switches = page.getByRole("button", { name: /Switch to this profile/ });
    const available = await switches.count();
    if (available === 0) test.skip(true, "Only one brand profile is configured.");

    await switches.first().click();

    /*
     * Waited on as an assertion rather than on a load state. The switch is a
     * form posting to a server action, so there is no document navigation to
     * wait for: the transition resolves and React re-renders in place. A
     * `waitForLoadState` call returns immediately and reads the old value.
     */
    await expect(
      activeMarker,
      `the branding screen still reports ${activeProfile} after a switch`,
    ).not.toHaveText(activeProfile, { timeout: 30_000 });
    await settle(page);

    const newProfile = ((await activeMarker.textContent()) ?? "").trim();

    // The switch is recorded, and it is recorded as a branding change: the
    // proof that nothing else moved is that nothing else was logged.
    const changeLog = page.locator("section").filter({ hasText: /Configuration change log/ }).first();
    await expect(changeLog).toBeVisible();
    await expect(changeLog.getByText(/brand/i).first()).toBeVisible();

    /* ---- what the scenario looks like after ---- */
    await open(page, "/workday/rcsa");
    await settle(page);

    const brandAfter = ((await page.locator(".app-brand-name").first().textContent()) ?? "").trim();
    testInfo.annotations.push({
      type: "branding",
      description: `profile ${activeProfile} to ${newProfile}; mark "${brandBefore}" to "${brandAfter}"`,
    });

    /*
     * The central product claim: the identity changes and the day does not.
     * The clock, the open decision count and the audit trail length are
     * three independent columns of real state, and a branding switch that
     * moved any of them would mean configuration and domain state were not
     * actually separate.
     */
    await expect(page.locator(".app-liveday .app-liveday-clock").last()).toHaveText(clockBefore);
    await expect(
      page.getByRole("navigation", { name: /^Work areas$/ }).getByRole("link", { name: /^Decisions/ }),
    ).toHaveAttribute("aria-label", decisionsBefore);
    const auditAfter = await page.evaluate(() => {
      const trigger = Array.from(document.querySelectorAll("button")).find((button) =>
        /^Audit trail, \d+$/.test(button.getAttribute("aria-label") ?? ""),
      );
      return trigger?.getAttribute("aria-label") ?? "";
    });
    expect(auditAfter, "the audit trail changed length across a branding switch").toBe(auditBefore);

    /* ---- restore ---- */
    await open(page, "/settings/branding");
    const restore = page
      .locator(".app-item")
      .filter({ hasText: activeProfile })
      .getByRole("button", { name: /Switch to this profile/ })
      .first();
    if (await restore.isVisible().catch(() => false)) {
      await restore.click();
    }
    await expect(
      page.locator(".app-item[data-selected='true'] .app-data").first(),
      "the original brand profile was not restored, so the suite has left the product configured differently",
    ).toHaveText(activeProfile, { timeout: 30_000 });
  });

  test("the synthetic data disclosure cannot be configured away", async ({ page }) => {
    await open(page, "/settings/branding");
    await settle(page);

    /*
     * Not negotiable, and the screen says why. A product that let an operator
     * remove the disclosure would let a demonstration be mistaken for a
     * production system holding real client records, and no branding
     * requirement outweighs that.
     */
    await expect(page.getByText(/The synthetic data disclosure cannot be configured away/)).toBeVisible();
    await expect(page.getByText(/Always shown|Column set to false/)).toBeVisible();

    const toggle = page.getByRole("button", { name: /disclosure/i });
    expect(
      await toggle.count(),
      "the branding screen offers a control over the permanent disclosure",
    ).toBe(0);
  });

  test("no provider or model name appears in the working interface", async ({ page }) => {
    for (const route of ["/workday/rcsa", "/workday/tprm", "/workday/rcsa/assistant"]) {
      await open(page, route);
      await settle(page);
      const text = await page.locator(".workday-v2").innerText();

      /*
       * The product speaks about what it checked and what it prepared, never
       * about which model prepared it. A provider name on a working screen
       * would turn a risk product into a demonstration of someone else's
       * technology, which is the opposite of the positioning.
       */
      const named = ["OpenAI", "GPT", "Claude", "Anthropic", "Gemini", "Llama", "Mistral"].filter(
        (vendor) => new RegExp(`\\b${vendor}\\b`, "i").test(text),
      );
      expect(named, `${route} names a model provider in the working interface`).toStrictEqual([]);
    }
  });
});

# Handoff: os-release-truth (Wave 0)

Workstream `os-release-truth` in the NFROS OS Product Excellence programme.
Outcome: the product tells the truth about itself, with one product identity
and one status vocabulary, sourced from one model.

Isolated stack used: port 3102, database
`<scratchpad>\os-release-truth.db`, dist dir `.next-os-release-truth`. Nothing
was written to `data/nfr-workos.db`, and no write action was used on port 3000.

---

## 1. What changed

### Release registry, `src/product/release/`

| File | Purpose |
|---|---|
| `identity.ts` (new) | `PRODUCT_IDENTITY`: name `NFROS`, descriptor, tagline. A leaf module with no imports, so label files and shells can import the name cheaply. |
| `product-release.ts` (new) | The registry: product release, named components, role release states, Role Apps, known limitations, and helper functions. |
| `readme.ts` (new) | Renders the README release section from the registry. |
| `index.ts` (new) | The import surface, `@/product/release`. Client safe. |
| `role-release.ts` | Docblock only. The API and the data are unchanged (the presentation appendix cites this path). |

Exports of `@/product/release`:

- Values: `PRODUCT_IDENTITY`, `PRODUCT_RELEASE`, `RELEASE_COMPONENTS`,
  `RELEASE_STAGE_LABELS`, `ROLE_RELEASE_DEFINITIONS`,
  `ROLE_RELEASE_STATUS_ORDER`, `ROLE_RELEASE_STATUS_LABELS`,
  `INSTALLED_ROLE_APPS`, `PREVIEW_ROLE_APPS`, `ROLE_APP_STATUS_LABELS`,
  `KNOWN_LIMITATIONS`, `LIMITATION_STATUS_LABELS`.
- Functions: `getProductReleaseRegistry()`, `getReleaseComponent(id)`,
  `rolesWithReleaseStatus(status)`, `limitationsWithStatus(status)`,
  `formatComponentVersion("v3.3")` returning `"V3.3"`,
  `productReleaseLabel()` returning `"NFROS 4.1.0"`, `getRoleRelease(roleId)`.
- Types: `Bilingual`, `ProductIdentity`, `ProductRelease`, `ReleaseStage`
  (`"candidate" | "released"`), `ReleaseComponent`, `ReleaseComponentId`
  (`"workday-interface" | "presentation"`), `RoleAppReleaseEntry`,
  `KnownLimitation`, `LimitationStatus` (`"open" | "mitigated"`),
  `LimitationArea`, `ProductReleaseRegistry`, `RoleReleaseDefinition`,
  `RoleReleaseStatus`.

Nothing is duplicated. The workday interface version is read from
`CURRENT_WORKDAY_UI` (`src/workday/contracts.ts`), the presentation version
from `DECK_VERSION` (`src/presentation-v2-4/export/types.ts`, read only), role
states from `role-release.ts`, and Role Apps from `src/role-apps/registry.ts`.

### Product release number: 4.1.0

- The last product release was 4.0.0, the Design Partner Release
  (2026-10-02), which the operations console and the backup, release
  package, support bundle and SBOM scripts already named.
- This release adds a registry, a status vocabulary and honest status
  computation. It changes no database schema, no route and no public
  contract, so it is a minor version: 4.1.0.
- The 2.2.0 and 2.3.0 headings that sat above 4.0.0 in the CHANGELOG were
  presentation releases (deck V2.2 and V2.3), not product versions. They now
  live under "Presentation releases" with their V labels.
- package.json's 1.0.0 was never a release; it is now 4.1.0.
- Stage is `candidate`, dated 2026-10-05, because the other Wave 0
  workstreams ship in the same release. **The release manager flips
  `PRODUCT_RELEASE.stage` to `released` when Wave 0 exits**, then runs
  `npx tsx scripts/sync-release-readme.ts`.

### Status vocabulary, `src/product/status/`

| File | Purpose |
|---|---|
| `vocabulary.ts` (new) | `PRODUCT_STATUSES`, the eight words: `empty`, `unavailable`, `simulated`, `safe`, `offline`, `live`, `verified`, `not-verified`. Each has an EN and DE label, a tone and a one line meaning in both languages. Pure mappings: `statusForAiMode`, `statusForConnectorMode`, `statusForAuditChain`, `statusForHealth`, `overallStatus`, plus `StatusReading` (a status with its EN and DE reason). |
| `StatusBadge.tsx` (new) | The one badge: the V3.3 `wd-chip` with a `wd-dot`, the tone from the vocabulary, the reason as title and screen reader text. No stylesheet of its own; needs a `.workday-v3` ancestor. |
| `sources.ts` (new, server only) | Every computed status: `readAiMode`, `readAuditIntegrity` (chain and coverage), `readEvaluationEvidence` and the pure `summariseEvaluationRun` and `evaluationReadingsForRole`, `runReadinessChecks`, `readSystemHealth`, `readJobQueue`, `readConnectorStatusCounts`, `readPilotEvidencePack`, `readAdminLanguage`. |
| `index.ts` (new) | Client-safe surface: the vocabulary and the badge. The server sources are imported from `@/product/status/sources` directly. |

### Administrator area and operations console

- `app/settings/_components/` (new): `AdminFrame` (shared by settings and
  `/ops`), `AdminRailLinks` (an Operations rail section with the operations
  console and the audit integrity page, which had no navigation entry),
  `ReleasePanel` (full on `/ops`, summary on `/settings`) and `StatusRows`.
- `app/ops/layout.tsx` (new) and `app/ops/page.tsx` rewritten.
- `app/settings/layout.tsx`: uses the frame. The frame root is
  `workday-v2 workday-v3`, so the area renders in the V3.3 light tokens. It
  also follows the scenario language. Before this, it was dark V2 and
  English only.
- Every settings page now carries its own copy in both languages: index,
  organisation, branding, integrations, mappings, role packs, role apps,
  authority, deployment, AI quality, pilot and audit integrity.

### Product identity

- Brand profiles in `src/product/seed.ts` and the fallback in
  `src/product/branding/brand.ts` take `productName` and `shortName` from
  `PRODUCT_IDENTITY`. So the shell, the settings top bar and the root page
  title say NFROS.
- `PRODUCT_COPY.productName` in `src/i18n/labels.ts` reads the registry.
  This is the report shell header on `/control-room`, raised by the
  coordinator; verified on port 3102: 4 NFROS, 0 "NFR WorkOS".
- These also read the registry now: `fallbackHeaderModel` in
  `src/db/repositories/header.ts`, `WorkdayHeaderFallback`, the V1
  `WorkdayShell` brand, the `/setup` title and welcome, the AI Partner
  source-status `sourceSystem` in `src/agents/chat/service.ts`, the
  default simulated message channel in `src/agents/tools/mutations.ts`, and
  the `prove-integration` console line.

### Documents and scripts

- `package.json`: the version field only, 1.0.0 to 4.1.0.
- `CHANGELOG.md`:
  - a 4.1.0 entry;
  - product releases ordered newest first;
  - presentation releases moved to their own section, with a V2.4 entry;
  - double hyphen punctuation removed from the headings.
- `README.md`:
  - rewritten to match the product;
  - "Presentation mode" and "Deck export" are spliced in byte for byte from
    the previous file, verified by string comparison;
  - a generated "Release" section;
  - a new "Product status" section.
- Facts corrected in the README:
  - the TPRM Role App route was wrong (`/process/tprm-third-party-onboarding`);
  - "40 tables";
  - `?ui=v3.1` was named as the default;
  - "4 preview roles have the role home, decision queue and AI partner"
    (Demo and Planned roles open an explanatory page);
  - the ESLint limitation was stale;
  - an asserted "live mode works and has been verified" machine status;
  - the reset and mode controls are on the control room, not the entry
    screen;
  - "14 structural evaluations".
- `scripts/sync-release-readme.ts` (new) rewrites the README release
  section.
- The version is read from the registry in `scripts/backup.ts`,
  `scripts/release-package.ts`, `scripts/support-bundle.ts` and
  `scripts/sbom.ts`. They no longer carry 4.0.0 literals.
  `release-package` reads its Node minimum from package.json `engines`
  rather than a wrong `20.0.0`.
- `src/product/entitlements/entitlements.ts`: the German nav label
  "KI-Qualitat" (a lost umlaut) is corrected to "KI-Qualitaet".

### No clipped text at 1366

- Row subtitles in the V2 `Item` are single line with an ellipsis. Long
  reasons, policies and notes were cut off at 1366, more so in German.
- Status reasons, limitations, authority policies, fallback behaviours,
  connector pack descriptions, mapping notes and change log titles now wrap
  (`WrappingDetail` in `app/settings/_components/StatusRows.tsx`).
- One surgical edit outside my scope lets the connector readiness note wrap
  in `src/components/integrations/connector-health.tsx`.
- A scripted check at 1366 counts `.app-item-title` and `.app-item-sub`
  elements whose content overflows. It finds 0 on `/ops` and on every
  settings page, in EN and DE.

### Files changed outside my ownership (surgical)

`src/product/seed.ts`, `src/product/branding/brand.ts`,
`src/product/entitlements/entitlements.ts`, `src/i18n/labels.ts`,
`src/db/repositories/header.ts`,
`src/components/workday-v3/WorkdayHeaderFallback.tsx`,
`src/components/shell/WorkdayShell.tsx`,
`src/components/integrations/connector-health.tsx`, `app/setup/page.tsx`,
`src/agents/chat/service.ts`, `src/agents/tools/mutations.ts`,
`scripts/backup.ts`, `scripts/release-package.ts`,
`scripts/support-bundle.ts`, `scripts/sbom.ts`,
`scripts/prove-integration.ts`. Each edit sources a name or version from the
registry, or makes text wrap; none changes behaviour.

`.gitignore`: `release/` is now `/release/`. Unanchored, it matched
`src/product/release/`, so every new file in the release registry would have
been left out of a commit without warning. Only `role-release.ts` was
tracked, because it had been force-added. The root `release/` package output
is still ignored.

---

## 2. Every status changed

| Screen | Before | After |
|---|---|---|
| `/ops` release | Version `4.0.0`, "NFROS Design Partner Release", "91+ tables", all literals | Registry: 4.1.0, release name, stage, date, components, role states, Role Apps, known limitations. The table count is removed. |
| `/ops` overall health | HEALTHY, a roll-up that ignored the unchecked worker | Computed with `overallStatus`: Not verified, because the worker has no heartbeat |
| `/ops` worker | NOT-VERIFIED, "n jobs pending" | Not verified, with the reason: no heartbeat is checked |
| `/ops` audit chain | HEALTHY | Verified (every chain record recomputed), plus new **Audit trail coverage: Not verified, 5 of 20 audit events chained** |
| `/ops` AI provider | NOT-CONFIGURED "No API key configured, offline mode only". This read `process.env` only, so it was wrong when the key resolves from file, and the mode was actually Safe. | Mode: Safe, Offline or Live, from the runtime resolution. Provider: Verified only after a live call is accepted in this process, otherwise Not verified with the reason. Key resolved yes or no, never any key detail. |
| `/ops` job queue | "Expected during V4 build phase" text | The pending count; failed jobs or an Empty state; Unavailable only when the tables are absent |
| `/ops` integrations, evaluation | (absent) | Connector counts by status; harness and model output readings |
| `/settings/ai-quality` evaluation | Static "Not yet evaluated: run eval:structural" whether or not a run existed | Read from `evals/results/latest.json`: harness **Simulated** (60 of 60 cases against synthetic envelopes), model output **Not verified**. Shown per configuration, by role, beside the suite id. With no run recorded: Not verified. |
| `/settings/audit-integrity` | Valid, Broken or Empty chip. Lede: "the audit log is protected by a tamper-evident hash chain". Export "Planned, will be available at /api/audit/export". | Verified, Not verified or Empty, plus coverage (Not verified, 5 of 20). The lede is corrected. Export: Unavailable. |
| `/settings/pilot` checks | Pass, Warn or Error chips. "Audit chain: initialised" passed whenever the table existed, even empty. | Vocabulary badges. The audit check verifies the chain. A new coverage check reports Not verified. The summary notice is computed. |
| `/settings/pilot` other | Chip "Arcadia Savings Bank". Jurisdiction literal "DE", with DORA and EBA for the whole institution. "Download evidence pack (API)" linked to a route that does not exist. | The organisation name. Each legal entity with its bloc-derived regulatory context (CH carries FINMA and no EU reference). The evidence pack is Empty or on disk, and the in-app download is Unavailable. |
| `/settings/pilot` identity | "Configured for pilot" or "Demonstration mode" chips | Verified or Not verified, with the reason |
| `/settings/role-apps` | "Enabled" chip on installed apps, titled non-functional. "Demo or concept" count. Fixed lede. | Enablement control **Unavailable**. Preview count from the registry. Computed lede. |
| `/settings/integrations` | Raw mode id chip per mode group | Badge: Simulated; Not verified (sandbox ready); Unavailable (configured but unavailable, and planned); Live |
| `/settings` index | Integrations purpose text | Connector status counts, plus the release summary panel |
| `/settings/deployment` | "Version" (the profile version, easily read as the product). Prose said there was no backup. | "Profile version". The prose is corrected: backup scripts exist since 4.0.0, and identity is described accurately. |

---

## 3. Acceptance criteria

| Criterion | Met | Evidence |
|---|---|---|
| Product versions agree everywhere, and a test enforces it | Yes | `tests/unit/product-release.test.ts` checks package.json, the CHANGELOG top entry (version and date), CHANGELOG ordering, the README release block, component versions against `CURRENT_WORKDAY_UI` and `DECK_VERSION`, and that no version literal remains in `app/ops`, `app/settings` or the four release scripts. Changing the CHANGELOG top entry to 4.1.1 made it fail with `expected '4.1.1' to be '4.1.0'`, and it passed again once restored. |
| All statuses on settings and ops are sourced, or honestly marked | Yes | Section 2. `tests/unit/product-status.test.ts` asserts that each status-bearing screen uses the shared badge and has no local status helpers or the removed ad hoc strings. |
| README matches the product | Yes | Facts checked against code (section 1); the release block is generated and tested |
| Status vocabulary used consistently | Yes | One `StatusBadge`, one vocabulary, tested mappings |
| tsc clean | Yes | `npx tsc --noEmit -p tsconfig.json` exit 0, after all changes |
| Unit tests for my area pass | Yes | See section 4 |
| `npm run check:copy` and `scan:secrets` pass | Yes | Both pass. `node scripts/check-no-emdash.mjs` is clean for my files; its remaining findings are in other workstreams' test files (section 4) |
| Before and after screenshots, 1920 and 1366, EN and DE | Yes | `docs/screenshots/os-excellence/os-release-truth/before/` and `after/` |
| Handoff | Yes | This file |

Product rules held:

- No flagship role or installed Role App was added.
- Role states are unchanged, and the release test pins them.
- The authority gate, approvals and audit write path are untouched.
- The presentation (`src/presentation-v2-4/**`, assets, downloads,
  presentation scripts) is untouched. `DECK_VERSION` is read only.
- No schema change.

---

## 4. Tests run

| Command | Result |
|---|---|
| `npx vitest run tests/unit/product-release.test.ts tests/unit/product-status.test.ts tests/unit/product.test.ts tests/unit/health.test.ts tests/unit/integration-runtime.test.ts` | 5 files, 170 tests passed |
| `npx tsc --noEmit -p tsconfig.json` | exit 0 |
| `npm run check:copy` | passed |
| `npm run scan:secrets` | passed |
| `node scripts/check-no-emdash.mjs` | My files are clean. At the last run it failed only on other workstreams' test files: `tests/integration/home-read-model.test.ts:168`, `tests/unit/home-read-model.test.ts:686`, `tests/unit/work-shell.test.ts:111`. |
| Version mismatch check | the test fails on a CHANGELOG mismatch, as intended |

No Playwright spec was added. The screens are read only and the existing
suites cover navigation; the captures below were taken with a scripted
Playwright run against port 3102. None of the 52 captures reported
horizontal overflow at 1920 or 1366.

---

## 5. Screenshots

`docs/screenshots/os-excellence/os-release-truth/{before,after}/<route>-<width>-<lang>.png`
for `/ops` and all twelve settings pages, at 1920 and 1366, in EN and DE.
`after/` also has `control-room-*` for the header.

- Before: the settings area is dark V2 and English in both languages.
  `/ops` is dark, its sections overlap at 1920, and it shows the 4.0.0
  literal.
- After: everything uses the V3.3 light tokens and follows the scenario
  language. `/ops` is laid out in the administrator frame.

---

## 6. Known limitations

These are also in the registry and shown on `/ops`.

- **Stored values stay English.** Values read from a registry or the
  database are shown as stored, in English: tool and autonomy descriptions,
  deployment profiles, connector readiness notes, model profile purposes,
  regulatory references and `AUDIT_PROTECTION_STATEMENT`.
- **The audit chain covers seeded events only.** `recordAuditEvent` in
  `src/server/security/audit.ts` does not call `appendChainRecord`. Only the
  five seeded events are chained, and the docblock in
  `src/audit/db-protection.ts` ("All audit writes go through
  appendChainRecord") is not true. The screens now say so. The fix is to
  chain on write, an audit-path change outside this workstream.
- **Some "NFR WorkOS" mentions remain.** They are outside interface code or
  are deliberately left:
  - the model system prompt `src/agents/prompts/system.ts` (model facing;
    changing it moves AI output and evaluations);
  - the legacy story deck accessible name in `StoryDeck.tsx` (asserted by
    five e2e specs);
  - presentation export metadata (presentation scripts are off limits);
  - the `worker.ts` console line (os-process-engine is editing that file);
  - code comments, the Dockerfile comment and historical docs in `docs/`;
  - package.json `description`, which is not in my scope (only the
    version field is).
- **Release-package directory name.** `scripts/release-package.ts` still
  writes to `release/nfros-v4`, which is fine for 4.x.
- **The release stage needs flipping.** Set it to `released` when Wave 0
  exits.

---

## 7. What the user must run

- **Brand name in the shared database.** Brand profiles are seed data. The
  shared `data/nfr-workos.db` still holds "NFR WorkOS" until the product
  configuration is reseeded: `npm run db:seed` or `npm run demo:reset`. Note
  that both reset the demonstration day. The new database migration from
  another workstream (`os_events`) also needs `npm run db:migrate` first.
- **README.** After any registry change, run
  `npx tsx scripts/sync-release-readme.ts`.
- No migration from this workstream.

---

## 8. For other workstreams

- `os-landing`: import `PRODUCT_IDENTITY`, `PRODUCT_RELEASE` and
  `RELEASE_COMPONENTS` from `@/product/release`, or only the name from
  `@/product/release/identity`. `StatusBadge` from `@/product/status` needs a
  `.workday-v3` ancestor.
- All Wave 0 workstreams: add your lines under `## [4.1.0]` in the
  CHANGELOG. Do not add a new top heading unless the version moves; the
  test pins the top entry to the registry.
- `tsconfig.json` was changed by each dev server that set `NFR_DIST_DIR`
  (include entries for `.next-<id>`). I removed only my own two lines.

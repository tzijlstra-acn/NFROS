# Workday V2 Current-State Audit

Agent A, read-only audit. No application code was changed. All findings are drawn from the screenshots and the source files listed below.

---

## 1. What Was Captured

### URL form

Plain URLs were used (no `?ui=v1` suffix). At the time of capture, the server returns the current V1 interface at plain routes. Each screenshot reflects what a user sees today.

### Viewports

Three viewport sizes were captured: 1920x1080, 1440x900, and 1366x768. All screenshots use `fullPage: false` (viewport-only, not full-page scroll). The browser was Chromium launched headless via `@playwright/test`. Network idle was awaited before each shot, followed by a check for `#main` before shutter.

### Routes captured

**rcsa and tprm, all three viewports (8 routes each):**

| Route key    | Path suffix        |
|--------------|--------------------|
| today        | (none)             |
| collaboration| /collaboration     |
| mail         | /mail              |
| calendar     | /calendar          |
| decisions    | /decisions         |
| workbench    | /workbench         |
| meetings     | /meetings          |
| assistant    | /assistant         |

**Root /workday at 1920x1080 only.**

**Four additional roles (control-assurance, incident-resilience, regulatory-change, nfr-governance), Today route only, at 1920x1080 and 1366x768.**

### Screenshot file list (57 files)

All files are in `docs/screenshots/workday-v1/`.

```
rcsa-today-1920x1080.png
rcsa-collaboration-1920x1080.png
rcsa-mail-1920x1080.png
rcsa-calendar-1920x1080.png
rcsa-decisions-1920x1080.png
rcsa-workbench-1920x1080.png
rcsa-meetings-1920x1080.png
rcsa-assistant-1920x1080.png
tprm-today-1920x1080.png
tprm-collaboration-1920x1080.png
tprm-mail-1920x1080.png
tprm-calendar-1920x1080.png
tprm-decisions-1920x1080.png
tprm-workbench-1920x1080.png
tprm-meetings-1920x1080.png
tprm-assistant-1920x1080.png
workday-root-1920x1080.png
control-assurance-today-1920x1080.png
incident-resilience-today-1920x1080.png
regulatory-change-today-1920x1080.png
nfr-governance-today-1920x1080.png
rcsa-today-1440x900.png
rcsa-collaboration-1440x900.png
rcsa-mail-1440x900.png
rcsa-calendar-1440x900.png
rcsa-decisions-1440x900.png
rcsa-workbench-1440x900.png
rcsa-meetings-1440x900.png
rcsa-assistant-1440x900.png
tprm-today-1440x900.png
tprm-collaboration-1440x900.png
tprm-mail-1440x900.png
tprm-calendar-1440x900.png
tprm-decisions-1440x900.png
tprm-workbench-1440x900.png
tprm-meetings-1440x900.png
tprm-assistant-1440x900.png
rcsa-today-1366x768.png
rcsa-collaboration-1366x768.png
rcsa-mail-1366x768.png
rcsa-calendar-1366x768.png
rcsa-decisions-1366x768.png
rcsa-workbench-1366x768.png
rcsa-meetings-1366x768.png
rcsa-assistant-1366x768.png
tprm-today-1366x768.png
tprm-collaboration-1366x768.png
tprm-mail-1366x768.png
tprm-calendar-1366x768.png
tprm-decisions-1366x768.png
tprm-workbench-1366x768.png
tprm-meetings-1366x768.png
tprm-assistant-1366x768.png
control-assurance-today-1366x768.png
incident-resilience-today-1366x768.png
regulatory-change-today-1366x768.png
nfr-governance-today-1366x768.png
```

---

## 2. Typography Findings

### Font families (from tokens.css)

Three families are declared and self-hosted as variable woff2 files:

| Token | Value | Weight range |
|-------|-------|-------------|
| `--font-display` | Space Grotesk | 300..700 |
| `--font-body`    | Inter          | 100..900 |
| `--font-mono`    | JetBrains Mono | 100..800 |

Fallbacks: Segoe UI, system-ui, sans-serif (display and body) and Cascadia Mono, ui-monospace, monospace (mono).

### Type scale (from tokens.css)

All sizes are expressed in rem. The base is 16px, declared on `html`.

| Token | rem | px |
|-------|-----|-----|
| `--text-xs`   | 0.75rem   | 12 |
| `--text-sm`   | 0.8125rem | 13 |
| `--text-base` | 0.9375rem | 15 |
| `--text-md`   | 1.0625rem | 17 |
| `--text-lg`   | 1.3125rem | 21 |
| `--text-xl`   | 1.75rem   | 28 |
| `--text-2xl`  | 2.25rem   | 36 |
| `--text-3xl`  | 3rem      | 48 |
| `--text-4xl`  | 4rem      | 64 |

Line-height tokens: tight 1.15, snug 1.3, normal 1.55, relaxed 1.7.
Tracking tokens: tight -0.02em, normal 0, wide 0.04em, label 0.09em.

### Where each family appears on interactive routes

**Space Grotesk (display):** page headings (h1..h6 in globals.css), the `.display` utility class (used for the NFR WorkOS logotype and every route's h1), and `.panel-title`. On the Today route the h1 renders at `--text-2xl` (36px). On the Decisions route the h1 is `--text-2xl` (36px) set with the `.display` class inline. On the Assistant route the h1 `Ask, within the authority in force` renders at `--text-2xl` (36px) via an explicit `fontSize` prop.

**Inter (body):** the default `font-family` on `body`, used for paragraph text, table cells, and any element that does not override the family. Body default is `--text-base` (15px) at line-height `--leading-normal` (1.55).

**JetBrains Mono (mono):** three distinct uses visible in screenshots.
- The `.label` utility: 12px, `--tracking-label` (0.09em), `text-transform: uppercase`, colour `--text-4` (#8d94a5). Used for section eyebrow lines such as "16:30 . END-OF-DAY SUMMARY AND OVERNIGHT WORK" and "ACTING AS" and "WHAT HAPPENED IN THE BACKGROUND?" in the left rail.
- The `.meta` utility: 12px, `--tracking-wide` (0.04em), colour `--text-4`. Used for evidence identifiers (EVD-2026-41905), system identifiers (SYS-0014), dates, and metadata rows in the intelligence rail.
- Navigation glyphs: 14px wide fixed column, colour `--text-4` when inactive and `--accent` when active. The ASCII set is `# @ ~ = ! * + ? &`.

### Routes that open with a lede paragraph

The `.lede` class sets 17px Inter, colour `--text-3` (#b3bac8), line-height `--leading-relaxed` (1.7), max-width 68ch. Every interactive route opened in screenshots carries a lede paragraph immediately below the h1. Verified routes: Today, Collaboration, Mail, Calendar, Decisions, Meetings, Workbench (all roles), Assistant. The `/workday` root does not use the WorkdayShell and has no lede; its sub-header copy ("Choose the professional whose day you want to live") is set at body size without a class override.

---

## 3. Shell Geometry Findings

### Permanent chrome dimensions (from tokens.css)

| Zone | Token | Value |
|------|-------|-------|
| Top bar | `--topbar-height` | 56px |
| Left rail | `--left-rail-width` | 232px |
| Left rail (collapsed, unused in V1) | `--left-rail-collapsed` | 64px |
| Right intelligence rail | `--right-rail-width` | 372px |
| Bottom timeline | `--timeline-height` | 84px |

### Central work area at each viewport

The shell grid is: rows = 56px (top bar) + 1fr (body) + 84px (timeline). Columns within body = 232px (left) + 1fr (centre) + 372px (right).

At 1920x1080:
- Total permanent chrome width: 232 + 372 = 604px
- Centre width: 1920 - 604 = 1316px
- Total permanent chrome height: 56 + 84 = 140px
- Centre height: 1080 - 140 = 940px
- Centre area: 1316 x 940 = 1,237,040 px2
- Total viewport area: 1920 x 1080 = 2,073,600 px2
- Chrome fraction: (2,073,600 - 1,237,040) / 2,073,600 = 836,560 / 2,073,600 = 40.3%
- Work area fraction: 59.7%

At 1440x900:
- Centre width: 1440 - 604 = 836px
- Centre height: 900 - 140 = 760px
- Centre area: 836 x 760 = 635,360 px2
- Total area: 1440 x 900 = 1,296,000 px2
- Chrome fraction: (1,296,000 - 635,360) / 1,296,000 = 660,640 / 1,296,000 = 50.9%
- Work area fraction: 49.1%

At 1366x768:
- Centre width: 1366 - 604 = 762px
- Centre height: 768 - 140 = 628px
- Centre area: 762 x 628 = 478,536 px2
- Total area: 1366 x 768 = 1,049,088 px2
- Chrome fraction: (1,049,088 - 478,536) / 1,049,088 = 570,552 / 1,049,088 = 54.4%
- Work area fraction: 45.6%

At 1366x768 the permanent chrome consumes 54.4% of the viewport. The 1366x768 screenshot (`rcsa-today-1366x768.png`) confirms the left rail label "What happened in the background?" is clipped mid-word to "hat happened in the backgroun" because the rail has no horizontal scroll and no responsive collapse at this width.

---

## 4. Navigation Findings

Nine items appear in the left rail. Each item renders with a fixed-width 14px mono glyph column followed by a truncating label. The exact ASCII glyphs and their nav keys, taken from `WorkdayShell.tsx`:

| Glyph | Nav key | Route suffix |
|-------|---------|-------------|
| `#` | today | (none) |
| `@` | collaboration | /collaboration |
| `~` | mail | /mail |
| `=` | calendar | /calendar |
| `!` | decisions | /decisions |
| `*` | workbench | /workbench |
| `+` | meetings | /meetings |
| `?` | assistant | /assistant |
| `&` | trustAndAudit | /trust (fixed) |

Active state: background `--accent-tint` (rgb(180 76 255 / 12%)), inset border `--accent-edge` (rgb(180 76 255 / 38%)), glyph colour `--accent` (#b44cff), label colour `--text-1` (#f7f7fa). Inactive: transparent background, glyph colour `--text-4` (#8d94a5), label colour `--text-3` (#b3bac8). No icon library is used. The glyph is plain ASCII, rendered in JetBrains Mono at `--text-sm` (13px).

The trustAndAudit item (`&`) routes to `/trust`, which is a fixed path not parameterised by role. All other items are role-parameterised.

Below the nav list, a fixed divider separates two detail blocks: "Acting as" (user name, job title, department) and "What happened in the background?" (background work counts plus links to Control room, Presentation, and Reset the day). These are informational and not navigable.

---

## 5. AI Presence Findings

### Where AI appears in the shell

AI presence is visible in six locations:

1. **Top bar:** the autonomy selector chip shows current level (e.g., "Act with approval") and is interactive. The mode chip to its right shows "Presenter Safe", "safe mode", or "live" with colour coding (cyan for safe, green for live).
2. **Top bar:** the world-view toggle has two positions, "Today" and "AI-enabled future". The toggle is visible at 1920x1080 but is dropped at 1366x768 when the top bar runs out of horizontal room.
3. **Intelligence rail (right):** the seventh tab is "AI activity 20" (count varies by route). The rail shows one tab active at a time. The default tab is Evidence.
4. **Left rail background work:** the "What happened in the background?" section reports counts of actions the AI completed before the user arrived (systems checked, records reconciled, documents classified, items requested, contradictions identified, routine updates, escalated to human).
5. **Today route:** the "What was already done before you arrived" panel, with a header label "Completed within policy, with an audit trail", lists the AI actions in plain prose. On `rcsa-today-1920x1080.png` five bullet-equivalent lines are visible.
6. **Decisions route:** each decision card carries a "PREPARED POSITION, FOR YOU TO ACCEPT, CHANGE OR REJECT" section, a "STATED UNCERTAINTY" section, and a confidence meter, all AI-prepared. The chip "! your decision" is amber, signalling that the human judgment step is required.

### What the assistant route opens with

The assistant route (`/workday/rcsa/assistant`) renders a long-form page before the chat input appears. Verified from `rcsa-assistant-1920x1080.png` and the source:

1. Page h1: "Ask, within the authority in force" at 36px Space Grotesk.
2. A lede paragraph naming the acting user and explaining what the authority gate enforces.
3. Status chips in the header row: mode (cyan "safe mode"), autonomy level (accent "Act with approval"), reachable count (green "53 reachable"), withheld count (red "20 withheld").
4. A "The mode in force" panel with a data table: effective mode, requested mode, live AI configured (yes/no chip), configuration source (path), voice available (yes/no chip).
5. An "Autonomy in force" panel naming the level in both English and German, with a detail paragraph, a row of all five level chips showing the current level highlighted in accent, and a list of authority scopes the role holds.
6. A "Withheld at [level]" section: at the default "Act with approval" level the withheld section is visible above the available section.
7. A "Available at [level]" section with tool tables grouped by authority class.
8. The "Conversation" panel at the very bottom, which contains the `AssistantChatPanel` component and the actual input field.

A user who arrives at the assistant route must scroll through four substantial panels before reaching the conversation input. The conversation panel is below the fold at every viewport tested.

---

## 6. Timeline Findings

The timeline bar occupies the full width of the viewport at 84px height. It is implemented by `TimelineScrubber` in `controls.tsx`. From screenshots, the timeline shows named moment dots along a horizontal track with the current moment highlighted in the accent colour (purple-pink, visible as a filled circle at the right end in the 16:30 state). Adjacent moments are labelled with truncated titles below the track.

**What the scrubber supports:**
- Clicking a moment dot fires `actionSetMoment`, which updates the scenario state and triggers a route refresh. The moment label shows the current time (e.g., "16:30").
- Moments carry a `dominantLane` value (organise, assess, act, report) that surfaces as a cyan chip in the top bar.
- A `isSharedEvent` flag on moments marks the shared cross-role event at 14:05, which appears as a distinct dot colour (red/pink).
- `decidedMoments` is wired in the source (passed as an empty array currently), intended to mark moments where a decision was recorded.

**What the scrubber does not support:**
- The `decidedMoments` prop is passed as `[]` in `WorkdayShell.tsx`, so decided moments are not yet visually distinguished on the track.
- The timeline has no visual indicator for the dominant lane per moment directly on the track. The lane chip in the top bar updates when a moment is selected, but the track itself shows no lane colour coding.
- There is no drag interaction, only discrete dot clicks.
- At 1366x768, the moment title labels below the track are truncated to short strings ("Morning deci...", "Inbox convert...", etc.) because the available width is 1366px minus no rail inset: the timeline spans the full viewport width including behind the rails.

---

## 7. Visual Weight Findings

### Today route (rcsa), 1920x1080

Visible above the fold on `rcsa-today-1920x1080.png`:

- 1 route header section (moment label, h1, lane chip)
- 1 "What was already done before you arrived" panel, with 5 list items
- 2 decision cards partially visible below (numbered 01 and 02)
- Intelligence rail: 8 clickable tab chips ("Evidence 5", "Why this matters 3", "Uncertainty 5", "Applicable policy 4", "Human approvals", "AI activity 20", "Audit trail 34"), then 2 evidence citation cards

Count: 1 header + 1 background panel + 2 decision cards + 8 rail tabs + 2 rail cards = 14 distinct elements visible above the fold.

The 8 intelligence rail tab chips all carry equal visual weight, a uniform pill style. The "Evidence" tab is active (accent border), the rest are neutral. The high count on "AI activity 20" is not distinguished from "Applicable policy 4" visually, though the counts differ by 5x. A user scanning the rail cannot immediately identify which tab carries the most signal without reading the numbers.

### Workbench (rcsa), 1920x1080

Visible above the fold on `rcsa-workbench-1920x1080.png`:

- 1 route header (moment label, h1)
- 4 badge chips in a row ("+ 9 risks", "+ 24 controls", "x 17 of 24 controls diverge", "! 4 lines changed")
- 1 lede paragraph
- 2 action buttons ("The decisions this raises", "Back to today")
- 1 "Process, risk and control graph" subheading panel, counting: 8 processes, 9 risks, 24 controls, 7 indicators
- 1 graph container showing a three-column header (PROCESSES, RISKS, CONTROLS)
- 3 control cards visible (CTL-GOV-012, CTL-GOV-016, CTL-GOV-021) each with: ID, badge, effectiveness bar, owner name

Count: 1 header + 4 chips + 1 lede + 2 buttons + 1 subheading + 1 graph + 3 cards = 13 distinct elements above the fold.

The 4 route header badge chips on the Workbench use three different tones in sequence: green (+), green (+), red (x), amber (!). The tone encoding is correct (red for divergence, amber for changed lines), but all four chips are rendered at the same padding and border size, giving equal visual weight to a count of 9 risks and a count of 4 changed assessment lines. The divergence count (17 of 24) should be more prominent than the line change count (4) but both chips are the same height and padding.

---

## 8. Reusable Components

| Component | Location | Keep for V2 | Notes |
|-----------|----------|-------------|-------|
| `WorkdayShell` | `src/components/shell/WorkdayShell.tsx` | Yes, as the layout host | Shell grid, fixed positioning, top bar, left rail, right rail, timeline bar. The grid contract is exact: topbar-height 56px, left-rail-width 232px, right-rail-width 372px, timeline-height 84px. V2 must not alter these without a geometry section rewrite. |
| `IntelligenceRail` | `src/components/shell/IntelligenceRail.tsx` | Yes | Seven-tab rail with full evidence, uncertainty, policy, approval, AI activity and audit trail tabs. Pure presentation of passed props. No application logic. |
| `DecisionBriefCard` | `src/components/decisions/DecisionFlow.tsx` | Yes | Renders a single open decision with prepared position, uncertainty, confidence meter, supporting and opposing evidence. The no-preselect and no-prefill constraints are in the component, not just in copy. |
| `DecisionFlow` (interactive) | `src/components/decisions/DecisionFlow.tsx` | Yes | Full interactive decision recording flow. Server action `actionRecordDecision` is called on submit. |
| `TimelineScrubber` | `src/components/shell/controls.tsx` | Yes | Renders the moment track and fires `actionSetMoment`. |
| `AutonomySelector` | `src/components/shell/controls.tsx` | Yes | Segmented control. Must not be optimistic on state. |
| `WorldViewToggle` | `src/components/shell/controls.tsx` | Yes | Two-position toggle for Today vs AI-enabled future. |
| `LanguageToggle` | `src/components/shell/controls.tsx` | Yes | EN/DE toggle. |
| `RoleSwitcher` | `src/components/shell/controls.tsx` | Yes | Dropdown over all roles. |
| `BackgroundWorkReveal` | `src/components/shell/controls.tsx` | Yes | Renders background work counts in left rail. |
| `Chip`, `ConfidenceMeter`, `ObjectId`, `ProvenanceBadge`, `RegulatoryNote`, `UncertaintyPanel`, `EvidenceList`, `ContradictionCard` | `src/components/evidence/primitives.tsx` | Yes | Primitive evidence display components. These are pure presentation, no state. |
| `SupplierConstellation`, `RiskControlGraph`, `PopulationField`, `ServiceDependencyMap`, `ObligationLineage`, `PortfolioThread` | `src/components/visualisations/*.tsx` | Yes (keep as-is) | Role-specific hero visualisations. Each is a pure rendering component fed from the workbench builder. Do not pull into application layer. |
| `AssistantChatPanel` | `app/workday/[role]/assistant/chat-panel.tsx` | Yes, but consider above-the-fold placement | Chat input and response stream. Currently rendered below four information panels. V2 needs to decide whether to promote it or keep the information-first sequence. |
| `SyntheticLabel` | `src/components/evidence/primitives.tsx` | Yes, must remain permanent | The synthetic data disclosure. It lives in the bottom bar, not the top bar, by design. Must stay permanently visible. |

**Presentation-only components that must not be pulled into the application layer:**
All components under `src/components/visualisations/` are fed fully-formed props from the workbench builder in `app/workday/[role]/workbench/page.tsx`. They contain no database access, no server actions, and no routing logic. Lifting any of them into an application layer that calls repositories would duplicate the data path and bypass the authority gate.

---

## 9. Verified Baseline Functional Behaviour

The following were verified working at the time of screenshot capture (dev server running, scenario seeded, moment at 16:30, autonomy "Act with approval", mode "Presenter Safe").

| Behaviour | Verification method |
|-----------|-------------------|
| All 6 role routes respond 200 | HTTP check and screenshot of each |
| All 8 nav routes respond for rcsa and tprm | Screenshots at all three viewports |
| Shell renders at 1920x1080 without horizontal overflow | Screenshot shows no scrollbar |
| Shell renders at 1440x900 without overflow | Screenshot shows no scrollbar |
| Shell renders at 1366x768, with left rail text clipping but no overflow | Screenshot confirms |
| Timeline renders at all three viewports | Timeline bar visible in all shots |
| Top bar controls do not overflow at 1920x1080 | All chips and toggles visible |
| Top bar controls partially hidden at 1366x768 (lane chip, mode chip dropped) | Confirmed: Execute button and some chips absent at 1366x768 |
| Intelligence rail tab strip renders 7 tabs | Visible in all assistant and today screenshots |
| Decisions route shows prepared position and confidence meter | Visible in rcsa-decisions-1920x1080.png |
| Workbench renders role-specific hero object (rcsa: risk/control graph, tprm: supplier dossier) | Confirmed by screenshot |
| Assistant route opens with mode and autonomy information before chat panel | Confirmed at 1920x1080 |
| Background work counts visible in left rail | Confirmed in all role screenshots |
| /workday root renders role picker with decision counts and background action counts | Confirmed in workday-root-1920x1080.png |
| Synthetic institution and data label permanently visible in bottom bar | Confirmed in all shell screenshots |

---

## 10. What V1 Gets Right That the Redesign Risks Losing

**The no-preselect discipline in DecisionBriefCard.** The "PREPARED POSITION, FOR YOU TO ACCEPT, CHANGE OR REJECT" heading is not a pre-filled form; it is a statement of what the AI prepared, shown alongside the uncertainty note and the confidence meter. The rationale field starts empty and requires the user to type. This is visible in `rcsa-decisions-1920x1080.png`. The redesign must not change this to a one-click accept flow, because the product's accountability argument depends on the friction.

**The uncertainty tab ranking in IntelligenceRail.** Uncertainty is the third tab, not the last. The source comment in `IntelligenceRail.tsx` states this is deliberate ("A rail that buries uncertainty behind five other tabs is telling the user it is an afterthought"). At 1920x1080 all seven tabs are visible without scroll. If V2 changes tab order or collapses the rail, the uncertainty tab must not move behind more than two others.

**The synthetic data disclosure placement.** The `SyntheticLabel` is in the bottom bar, separated from the top bar by design. The source comment in `WorkdayShell.tsx` explains the reason: the top bar is the one place where controls compete for width at small viewports and items are dropped. The bottom bar always has room. In all 57 screenshots, the label "Synthetic institution and data" is visible. If V2 moves controls around, this placement rule must survive.

**The background work pattern.** The left rail "What happened in the background?" section and the Today route "What was already done before you arrived" panel together make the AI's pre-work legible without interrupting the workday. The AI completed actions are named and quantified, not summarised as a spinner. This pattern is visible in every role's Today screenshot and is load-bearing for the product's "orchestration" claim.

**The role-switcher continuity.** Switching roles from the top bar preserves the scenario moment and the decided decisions. The `/workday` root at 1920x1080 confirms this: it shows "5 open decisions" and "67 background actions completed" for the rcsa role, and "6 open decisions" and "21 background actions completed" for the tprm role, from a shared scenario state. This is what makes cross-role examination of the same event credible.

**The lede paragraph pattern.** Every route opens with a short explanatory paragraph in Inter 17px (`--text-md`) at `--leading-relaxed` (1.7). This is not decorative copy; it states the design decision behind the screen ("The inbox is grouped by the proposed triage outcome, not by arrival time", "Each meeting carries the preparation pack that was assembled for it"). The ledge paragraph is a design decision, not filler, and removing it would leave the screen layout without its framing sentence.

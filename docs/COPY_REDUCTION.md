# V3.1 copy reduction

A deletion pass, not a rewrite. Proposals only: nothing in this document has been
applied to a source file.

**Test applied to every string:** would a first-week analyst, with no training,
understand this on the default screen, and does it say something no other string
on the same screen already says?

## Notation

This codebase forbids the em dash, code point U+2014. This document never
reproduces the character. Where an existing occurrence has to be cited, the
surrounding words are quoted and the code point is named.

German proposals use the ASCII transliterations `ae oe ue ss` only.

## Snapshot

Measured against the six V3.1 default screens fetched live from
`http://localhost:3000/workday/<role>?ui=v3.1` for `rcsa`, `tprm`,
`control-assurance`, `incident-resilience`, `regulatory-change` and
`nfr-governance`.

The source moved during the audit. `src/components/workday-v3/RoleHome.tsx` was
modified at 22:31 and `src/components/workday-v3/WorkdayPartnerDock.tsx` was
added while the pages were being read, so the first fetch and the final fetch
differed. All line numbers, quotations and counts below are against the state at
22:39, with `RoleHome.tsx` md5 `8d8209b743229cf23215336f65eaabeb` and
`app/workday/[role]/v3.tsx` md5 `b1ee837a973c41211ab3193e49475341`. Re-check the
line numbers before applying.

Two partial fixes had already landed by that snapshot and are not re-proposed:
the Now lead-in no longer renders `humanAction`, and the `Next` rows no longer
render `humanAction`. Row 1 below is the defect that the second of those fixes
moved rather than removed.

---

## 1. The deletion table

Ranked by value. Value is words removed multiplied by how much confusion the
string causes a reader who has had no training.

| # | File and line | Current text, verbatim | Verdict | Replacement EN | Replacement DE | Why |
|---|---|---|---|---|---|---|
| 1 | `src/components/workday-v3/RoleHome.tsx:251` | `<span className="wd-item-sub">{item.reason \|\| item.humanAction}</span>` renders, for example on `control-assurance`, `an escalation is waiting on your authority` on two of three rows | delete | (no second line) | (keine zweite Zeile) | `reason` is a class of 11 phrases shared by judgment kind, so two rows of three read identically; the title already distinguishes the rows |
| 2 | `src/components/workday-v3/RoleHome.tsx:114-125` (fed by `app/workday/[role]/v3.tsx:108`) | `Operational risk` `/` `Arcadia Bank AG` | delete | (delete the whole `wd-location` block) | (gesamten Block entfernen) | The entity is already in the header verbatim and the area restates the role title directly below it; three identity strings for one fact |
| 3 | `src/db/repositories/focus.ts:436` (DE `:432`) | `4 need your judgment, 2 prepared for review, 5 handled without you.` | shorten | `4 need your judgment.` | `4 benoetigen Ihr Urteil.` | Clause two counts a section the home does not render, and clause three repeats the `Handled automatically 5` chip further down |
| 4 | `src/components/workday-v3/RoleHome.tsx:127`, value from `app/workday/[role]/v3.tsx:109` | `<h1 className="wd-page-title">{pageTitle}</h1>` renders `Operational Risk Partner` | replace | `Today` | `Heute` | An h1 that states the reader's own job title says nothing about the screen, and the header already carries it |
| 5 | `src/scenario/data/decisions.ts:1081-1082`, first sentence only | `The consequence of getting this wrong is a category error with supervisory implications in either direction: applying an EU framework to the Swiss entity, or failing to apply a Swiss requirement because a group view absorbed it.` | replace | `Getting this wrong is a category error in either direction.` | `Ein Fehler hier ist in beide Richtungen eine Kategorienverwechslung.` | 32 rendered words, cut mid-clause by the 200 character fallback, and the cut strips the regulatory disclosure the source string carries (see defect D4-1) |
| 6 | `src/db/repositories/focus.ts:121` | `completed within policy` / `innerhalb der Richtlinie abgeschlossen` | delete | (no second line on handled rows) | (keine zweite Zeile) | Identical on all five `Handled automatically` rows on all six roles, and it asserts a policy determination the product has not made (see defect D4-2) |
| 7 | `src/components/workday-v3/RoleHome.tsx:56-57` | `decision: { en: "Decision", de: "Entscheidung" }`, rendered as the `wd-now-verb` lead-in | delete | (remove the `decision` key; render no lead-in when the kind is unmapped) | (Schluessel entfernen) | `Decision` sits above a decision heading above a `Record the decision` button: the same word three times in one card |
| 8 | `app/workday/[role]/v3.tsx:100` | `firstClause(suggestionLead)` renders, on `tprm`, `Read the disaster recovery test report of 22` | replace | Cut on a sentence boundary, not on any of `. , ; :`; for `tprm` the readable line is `Read the supplier's own disaster recovery test report` | `Lieferanteneigenen Wiederherstellungstestbericht gelesen` | `firstClause` cuts at the first period, so the date `22.05.2026` truncates to `22`; four of six roles render a broken or ellipsed line |
| 9 | `src/scenario/data/decisions.ts:405-406`, first sentence only | `Three explanation requests produce three documents that each explain one symptom and none of them explains the cause, and the process owner will reasonably write the same paragraph three times.` | shorten | `Three explanation requests produce three documents that explain one symptom each and none the cause.` | `Drei Erklaerungsanfragen ergeben drei Dokumente, die je ein Symptom erklaeren und keines die Ursache.` | 30 words where the card has room for one line; the second half of the sentence restates the first |
| 10 | `src/scenario/data/decisions.ts:792-793`, first sentence only | `My own entity has the weakest position in the group and I know it at 07:45.` | replace | `This entity has the weakest position in the group.` | `Diese Einheit hat die schwaechste Position in der Gruppe.` | First person from an unnamed `I` on a system screen; the reader cannot tell who is speaking |
| 11 | `src/scenario/data/decisions.ts:1240-1241`, first sentence only | `Aggregation is interpretation, and deciding that four Red indicators are one issue is the single most valuable judgment in this role.` | shorten | `Deciding whether four Red indicators are one issue is this role's core judgment.` | `Die Entscheidung, ob vier rote Indikatoren eine Frage sind, ist die Kernbeurteilung dieser Rolle.` | `the single most valuable judgment` is the product grading the work; the reader needs the question, not the grade |
| 12 | `src/components/workday-v3/RoleHome.tsx:37` | `review: { en: "Review preparation", de: "Vorbereitung ansehen" }` | shorten | `Review` | `Pruefen` | The link sits inside a block already labelled `AI prepared`, so `preparation` repeats the block's own subject and is the product's noun |
| 13 | `src/components/workday-v3/RoleHome.tsx:31` | `done: { en: "Done today", de: "Heute erledigt" }` | delete | (dead constant) | (toter Konstant) | Unreferenced since the `Watching` and `Done` sections merged into `wd-disclosure-row`; it was also a second name for `Handled automatically` |
| 14 | `src/components/workday-v3/WorkdayUpdatesBar.tsx:51` | `` `${updatesCount} updates` `` / `` `${updatesCount} Aktualisierungen` `` | delete | (keep the dot and the `aria-label` only) | (nur Punkt und `aria-label`) | The same count already shows on the `My work` rail badge and on the header bell; three renderings of one number |
| 15 | `src/components/workday-v3/WorkdayNavigation.tsx:207` | `<span className="wd-nav-label">{label("collapse")}</span>` renders `Collapse` | delete | (keep the `aria-label` at line 198 only) | (nur `aria-label`) | A chrome control listed among the work areas; a reader scanning the rail has to decide which rows are places and which are buttons |
| 16 | `src/components/workday-v3/WorkdayHeaderClientActions.tsx:195-200` | `Presentation` / `Praesentation` and `Previous interface` / `Vorherige Oberflaeche` | delete | (move both behind demo mode) | (beides nur im Demo-Modus) | An analyst has no reason to know the product has a presentation or a previous interface |
| 17 | `app/workday/[role]/error.tsx:46-49` | `The rest of the application is working. Retrying usually resolves it, and the navigation above still takes you anywhere else.` | shorten | `The rest of the application is working.` | `Der uebrige Teil der Anwendung funktioniert.` | 20 words restating the two buttons directly beneath them |
| 18 | `src/components/workday-v3/WorkdayPanels.tsx:89-93` | `Select a row in the list to see the evidence and details behind it.` | shorten | `Select a row.` | `Waehlen Sie eine Zeile.` | The panel is already titled `Nothing selected`; naming its own tabs back to the reader adds no instruction |
| 19 | `src/components/workday-v3/WorkdayPartnerDock.tsx:70-71` | `The rest of the workspace is unaffected. Close this and carry on, or try again.` | shorten | `Close this and carry on, or try again.` | `Schliessen Sie dies und arbeiten Sie weiter, oder versuchen Sie es erneut.` | Sentence one is product reassurance; sentence two is the only instruction |
| 20 | `src/components/workday-v3/WorkdayPartnerDock.tsx:67` | `loading: { en: "Opening the partner", de: "Partner wird geoeffnet" }` | replace | `Opening` | `Wird geoeffnet` | `the partner` is the product's name for itself (see D1-3) |
| 21 | `src/db/repositories/focus.ts:135` | `noAction: { en: "No action is needed from you", de: "Von Ihnen ist nichts erforderlich" }` | shorten | `Nothing to do` | `Nichts zu tun` | Six words to say two |
| 22 | `src/components/workday-v3/WorkdayHeaderFallback.tsx:34` | `{language === "de" ? "Arbeitstag" : "Workday"}` | delete | (render nothing where the role is unknown) | (nichts anzeigen) | `Workday` names the route, not the reader's place; an empty slot is more honest than a word that means nothing to an analyst |
| 23 | `src/i18n/labels.ts:33,39,45,51,57` | `fullEn: "Personal Work Orchestration"`, `"Evidence and Risk Intelligence"`, `"Core Risk Practice"`, `"Human Judgment and Challenge"`, `"Controlled Execution and Assurance"` and their `fullDe` pairs | delete | (remove from any analyst-facing surface) | (aus Analystenoberflaechen entfernen) | Pure product taxonomy; none of the five phrases is a thing an analyst does or asks for |
| 24 | `src/i18n/labels.ts:166` | `experienceName: { en: "Live the NFR Day", de: "Den NFR-Tag erleben" }` | delete | (remove) | (entfernen) | Marketing copy inside the interface label dictionary |
| 25 | `src/i18n/labels.ts:172-180` | `One work environment for NFR.` / `Specialist intelligence for every function.` / `Human accountability at every material decision.` | delete | (keep in the deck only) | (nur im Deck) | Three product propositions in the shared label dictionary; none is work language |
| 26 | `src/i18n/labels.ts:182` | `futureView: { en: "AI-enabled future", de: "KI-gestuetzte Zukunft" }` | delete | (remove) | (entfernen) | Names the product roadmap, not a state of the work |
| 27 | `src/i18n/labels.ts:203` | `safe: { en: "Presenter Safe", de: "Praesentationssicher" }` | replace | `Offline answers` | `Offline-Antworten` | `Presenter Safe` describes the demonstration, not what the system will do |
| 28 | `src/i18n/labels.ts:82` | `whyThisMatters: { en: "Why this matters", de: "Warum das wichtig ist" }` | shorten | `Rationale` | `Begruendung` | Three words of product voice where the professional noun is one word |

### Not proposed for deletion, and why

- `Synthetic institution and data` (`WorkdayUpdatesBar.tsx:83`). Mandatory
  disclosure. Present on all six screens. Keep exactly as is.
- `AI prepared` (`RoleHome.tsx:36`). Attribution of machine work is a governance
  requirement, not helper text.
- `Skip to main content`, `, collapsed`, `, expanded`, `Loading`
  (`loading.tsx:106`). Assistive-technology strings, not screen copy.
- `Record the decision` as the primary **button** label
  (`focus.ts:109` via `focus.ts:1247`). An action class is the correct thing for
  a button to say. It is only wrong as a heading or a row subtitle.
- The decision titles in `src/scenario/data/decisions.ts`. These are the best
  copy on the screen: specific, in the work's own language, and they distinguish
  every row from every other row. Do not touch them.

---

## 2. Product language where work language belongs

| Ref | File and line | Product term | Professional term EN | Professional term DE |
|---|---|---|---|---|
| D1-1 | `src/components/workday-v3/WorkdayNavigation.tsx:57` and `WorkdayHeaderClientActions.tsx:231` | `Trust` | `AI governance` | `KI-Governance` |
| D1-2 | `src/components/workday-v3/WorkdayHeaderClientActions.tsx:235` | `Control room` / `Kontrollraum` | delete from the analyst account menu; it is an operator surface | aus dem Konto-Menue entfernen |
| D1-3 | `WorkdayPanels.tsx:102,108`, `WorkdayPartnerDock.tsx:65`, `WorkdayHeaderClientActions.tsx:117` | `AI Partner` / `KI Partner`, and `the partner` in body copy | `Assistant` | `Assistent` |
| D1-4 | `src/components/workday-v3/RoleHome.tsx:37` | `Review preparation` | `Review` | `Pruefen` |
| D1-5 | `src/components/workday-v3/WorkdayNavigation.tsx:51` | `Workbench` / `Arbeitsbereich` | `Assessments` | `Beurteilungen` |
| D1-6 | `WorkdayUpdatesBar.tsx:51,61`, `WorkdayHeaderClientActions.tsx:100-104` | `updates` / `Aktualisierungen` | `What changed` | `Aenderungen` |
| D1-7 | `src/components/workday-v3/WorkdayHeaderClientActions.tsx:146,152` | `Display and demo` / `Darstellung und Demo` | `Display` | `Darstellung` |
| D1-8 | `src/components/workday-v3/WorkdayHeaderFallback.tsx:34` and `src/db/repositories/header.ts:64` | `Workday` / `Arbeitstag` | render nothing | nichts anzeigen |
| D1-9 | `src/i18n/labels.ts:33-58` | the five lane names and their long forms | the function name the analyst already uses | die Funktionsbezeichnung der Rolle |
| D1-10 | `src/components/workday-v3/RoleHome.tsx:32` | `Handled automatically` / `Automatisch bearbeitet` | acceptable; keep, because the machine attribution is a governance point, but note it is the product describing itself | beibehalten |

`Trust` is the weakest of these. The destination is titled
`Trust and accountability` (`app/trust/page.tsx:136`) and contains an authority
matrix, credential handling, output evaluation and a limitations statement. That
is AI governance. A first-week analyst reading `Trust` in a navigation rail
cannot predict any of it.

---

## 3. Text that repeats itself

| Ref | The one fact | Where it is stated | Proposal |
|---|---|---|---|
| D2-1 | the reader's role | header `WorkdayHeader.tsx:56`; page title `RoleHome.tsx:127`; location line part one `v3.tsx:108` | Keep the header. Delete the location line (table row 2). Replace the page title with `Today` (table row 4). |
| D2-2 | the entity | header `WorkdayHeader.tsx:58`; location line part two `v3.tsx:108` | Keep the header. Covered by table row 2. |
| D2-3 | the number of waiting updates | rail badge `WorkdayNavigation.tsx:130`; header bell `WorkdayHeaderClientActions.tsx:98-105`; bottom bar `WorkdayUpdatesBar.tsx:51` | Keep the rail badge. Delete the bottom-bar text (table row 14). |
| D2-4 | that five items were handled for you | context line clause three `focus.ts:436`; the `Handled automatically 5` disclosure `RoleHome.tsx:305` | Keep the disclosure. Covered by table row 3. |
| D2-5 | that this item is a decision | lead-in `Decision` `RoleHome.tsx:156-162`; the heading, which is a decision question; the button `Record the decision` | Delete the lead-in (table row 7). |
| D2-6 | that the AI prepared something | header `AI Partner, 1 suggestion`; context line clause two `N prepared for review`; the `AI prepared` block label | Keep the block label. Covered by table row 3. |
| D2-7 | `Evidence` / `Nachweise` is defined three times | `src/i18n/labels.ts:81`; `WorkdayPanels.tsx:26`; `WorkdayEvidenceTrigger.tsx:26` | One definition. The V3.1 components import `src/i18n/labels.ts` for the `Language` **type only** and then redeclare their own strings, so `Decisions`, `Settings`, `Trust`, `Calendar`, `Mail` and `Collaboration` are each defined twice and `Evidence` three times. |
| D2-8 | the error paragraph restates the buttons | `app/workday/[role]/error.tsx:46-49` against the buttons at `:54` and `:57` | Covered by table row 17. |

---

## 4. Generic labels that fail to distinguish items

The original defect, four queue items all headed `Record the decision`, has been
addressed. It was not removed: the second line of each `Next` row now renders
`item.reason`, which has exactly the same property one level down.

| Ref | String set | File and line | Evidence on screen | What should be shown instead |
|---|---|---|---|---|
| D3-1 | `DECISION_REASON`, 11 phrases keyed on `judgmentKind` | `src/db/repositories/focus.ts:94-104`, rendered at `RoleHome.tsx:251` | On `control-assurance`, rows 1 and 2 both read `an escalation is waiting on your authority`. Across the six screens, `the agenda position is yours to set` renders on four, `an escalation is waiting on your authority` on four, `a materiality call only you can make` on three | Delete the line. If a second line is kept it must be item specific: the decision's `relatedObjectKind:relatedObjectId`, which is already on the row object and is work language, for example `CTL-PAY-014` or `TST-2026-0318` |
| D3-2 | `handledInPolicy` | `src/db/repositories/focus.ts:121`, rendered at `RoleHome.tsx:320` | All five `Handled automatically` rows on all six roles read `completed within policy` | Delete. The title already carries the count and the kind, for example `38 records reconciled` |
| D3-3 | `recordDecision`, `reviewSuggestion`, `reviewEscalation`, `resolveContradiction`, `openEvent`, `confirmReach` | `src/db/repositories/focus.ts:109-120` | Currently reach the screen only as the primary button label | Acceptable on a button. Must never be reinstated as a heading or a row subtitle. Add a test asserting that no two visible rows on one screen share a heading or a subtitle |
| D3-4 | `watchKriRed`, `watchKriAmber` | `src/db/repositories/focus.ts:123-124` | On `rcsa`, two of three `Watching` rows read `outside the red threshold` | Show the breached value against its threshold, which is the fact the analyst needs and is per item |
| D3-5 | `handledExecuted` | `src/db/repositories/focus.ts:122` | `executed after your approval` on every executed decision row | Show the time of execution, which is already on the row, and delete the phrase |
| D3-6 | `KIND_LABEL` | `src/components/workday-v3/RoleHome.tsx:56-68` | The replacement lead-in has the same property as the string it replaced: `Decision` renders on all six roles because every Now item is a decision | Delete for `decision` (table row 7) and keep only for kinds the heading and button do not already name, such as `incident` and `kri` |

---

## 5. Hard errors: copy that overclaims

These are defects, not style notes.

### D4-1. A regulatory assertion renders with its disclosure stripped

- **Where:** rendered at `src/components/workday-v3/RoleHome.tsx:165` from
  `src/scenario/data/decisions.ts:1081-1082`, truncated by
  `src/db/repositories/focus.ts:217` (`firstSentence`, called from
  `focus.ts:1200` with `whyStyle: "sentence"` set at
  `app/workday/[role]/v3.tsx:80`).
- **What renders on `/workday/regulatory-change?ui=v3.1`:**
  `The consequence of getting this wrong is a category error with supervisory
  implications in either direction: applying an EU framework to the Swiss entity,
  or failing to apply a Swiss requirement ...`
- **The defect:** the source string ends with
  `Illustrative regulatory context, not legal advice.` The truncation removes it.
  Verified across all six screens: zero occurrences of `Illustrative regulatory`,
  `not legal advice` or `scenario figure` in the delivered HTML, while
  `regulatory-change` renders a statement about which supervisory framework
  applies to which entity. `PRODUCT_COPY.regulatoryNote`
  (`src/i18n/labels.ts:168-171`) exists and is not rendered on any V3.1 surface.
- **Fix:** either carry the disclosure with any truncated string that makes a
  regulatory statement, or replace the sentence with one that makes no
  regulatory assertion (table row 5). The truncation helpers must not be allowed
  to drop a qualifier: `firstSentence` and `firstClause` should refuse to cut a
  string whose tail contains `not legal advice` or `scenario figure`.

### D4-2. `completed within policy` asserts a compliance determination

- **Where:** `src/db/repositories/focus.ts:121`, rendered at
  `src/components/workday-v3/RoleHome.tsx:320`.
- **Text:** `completed within policy` /
  `innerhalb der Richtlinie abgeschlossen`.
- **The defect:** this is attached to every automated background item on every
  role, 30 renderings across the six screens, and it states that machine work
  complied with policy. No policy evaluation is recorded for these items; the
  rows are counts of `system-checked`, `record-reconciled`,
  `document-classified`, `item-requested` and `routine-update`. Internal rather
  than regulatory, but it is still a compliance claim the product cannot
  substantiate, and it is the kind of claim that becomes a regulatory claim the
  moment a reader repeats it.
- **Fix:** delete (table row 6). Also D3-2.

### D4-3. A synthetic institution presented under a real service agreement

- **Where:** `src/product/seed.ts:90` and `src/product/seed.ts:107`.
- **Text:** `Synthetic institution and data. Operated for Arcadia Banking Group
  under an intragroup service agreement.` and `Synthetic institution and data.
  Operated jointly by Arcadia Banking Group and Accenture under the managed
  service agreement.`
- **The defect:** sentence two asserts a contractual relationship with a named
  client and a named operator. The synthetic disclosure in sentence one covers
  the institution and the data; it does not cover a claim about an agreement.
  Severity is reduced because the string reaches only
  `app/settings/branding/page.tsx:87` and no V3.1 analyst surface.
- **Fix:** delete sentence two from both strings. The disclosure is the whole
  legal notice.

### D4-4. Not found

Searched and clean, with the reasons they are clean:

- **Client savings.** No savings, hours-saved, headcount, efficiency-multiple or
  cost-reduction claim reaches any V3.1 surface. The prohibition is enforced in
  three places: `src/agents/suggestions/validate.ts:152` and `:377`
  (`savings-claim`), `src/agents/suggestions/prompt.ts:72` and
  `src/agents/chat/prompt.ts:56`. `app/value/page.tsx:619-624` and
  `app/roadmap/page.tsx:391` state the absence explicitly.
- **DORA applied to the Swiss entity.** No string asserts it. The guards are
  `src/product/organisation/profile.ts:109-111` (`EU_ONLY_MARKERS`),
  `src/agents/suggestions/validate.ts:170,197`,
  `src/components/ai-partner/AISuggestionCard.tsx:87-93` and
  `src/agents/evaluations/suite.ts:740`
  (`/DORA (?:applies|requires|mandates)[^.]{0,40}(?:Schweiz|Swiss)/i`). The only
  Swiss framework statements found, `src/agents/chat/seeded.ts:173` and
  `src/agents/suggestions/seeded.ts:2047`, say the EU instrument does **not**
  apply. The `regulatory-change` screen warns against the error rather than
  committing it; its defect is the missing disclosure, D4-1.
- **Synthetic institution presented as real on an analyst surface.**
  `Synthetic institution and data` renders in the bottom bar of all six screens,
  in the same viewport as the entity name.

---

## 6. Forbidden characters

### Em dash, U+2014

Scanned the whole repository with the directory exclusions in the brief
(`node_modules`, `.next`, `.next-verify`, `out`, `dist`, `.git`), skipping
`package-lock.json`, `tsconfig.tsbuildinfo` and binary extensions.

**6 occurrences, 0 of them authored copy that needs changing.**

| File and line | Nature | Action |
|---|---|---|
| `AGENTS.md:5` | Generated. The file's own line 7 says the block `is written and re-added by next dev`, and the file is gitignored. The quoted sentence is `This version has breaking changes`, then U+2014, then `APIs, conventions, and file structure may all differ ...` | No edit possible: `next dev` recreates it. Outside the copy gate already, because `scripts/check-no-emdash.mjs:29` scans only `src app docs scripts tests exports` |
| `AGENTS.md:7` | Generated, same block. `This block is written and re-added by`, then backtick `next dev` backtick, then U+2014, then `verify at ...` | As above |
| `scripts/check-no-emdash.mjs:43` | The guard's own needle, `const EM_DASH = "` then U+2014 then `";`. Self-excluded at `:41` | Keep. It is the gate |
| `playwright-report/index.html:41` | Playwright's bundled reporter. Generated, gitignored | Keep |
| `playwright-report/trace/uiMode.CU5KtEkS.js:4` | Playwright vendor bundle | Keep |
| `playwright-report/trace/uiMode.CU5KtEkS.js:5` | Playwright vendor bundle | Keep |

### Umlaut and eszett

**5 occurrences, 0 of them display copy.**

| File and line | Nature | Action |
|---|---|---|
| `scripts/verify-ai-partner.ts:239` | The detector's own character class, `const umlauts = strings.filter((value) => /[AOUaouss-class]/.test(value));` | Keep |
| `tests/unit/loading-states.test.ts:606` | The test's own character class, `const umlauts = /[...]/;` | Keep |
| `tests/unit/suggestions.test.ts:607` | The test's own character class | Keep |
| `playwright-report/index.html:10` | Playwright vendor bundle | Keep |
| `playwright-report/trace/sw.bundle.js:2` | Playwright vendor bundle | Keep |

All authored German display strings are correctly transliterated. Spot-checked
`RoleHome.tsx:29-39` (`Benoetigt Sie jetzt`, `Faellig`),
`WorkdayNavigation.tsx:48-60`, `focus.ts:94-140` and `src/i18n/labels.ts:29-205`.
The rationale is recorded at `src/i18n/labels.ts:8-14`.

### Gate gaps worth closing

Not copy, but they are why the above could regress silently.

1. `scripts/check-no-emdash.mjs` has **no umlaut or eszett rule**. The only
   enforcement is in two unit tests and one verification script, each scoped to
   its own data set. A new German string anywhere outside those scopes is
   unchecked.
2. `SCAN_DIRS` at `scripts/check-no-emdash.mjs:29` excludes the repository root,
   so `README.md` and `AGENTS.md` are never scanned. That is what keeps the two
   `AGENTS.md` occurrences from failing the build, and it would equally hide an
   authored occurrence in `README.md`.

---

## 7. Word counts, before and after

Measured from the delivered HTML of the six live pages. Visible text only:
script, style and SVG content removed, `aria-label`, `title` and `placeholder`
excluded. Screen-reader-only strings (`Skip to main content`, `Loading`,
`, collapsed`) are included because they are in the document.

`Chrome` is the persistent frame from `layout.tsx`: header, rail, bottom bar.
`Main` is the region from `v3.tsx`.

| Surface | Chrome before | Main before | **Total before** | Chrome after | Main after | **Total after** | Removed | Reduction |
|---|---|---|---|---|---|---|---|---|
| `/workday/rcsa?ui=v3.1` | 31 | 141 | **172** | 28 | 89 | **117** | 55 | 32% |
| `/workday/tprm?ui=v3.1` | 31 | 128 | **159** | 28 | 90 | **118** | 41 | 26% |
| `/workday/control-assurance?ui=v3.1` | 31 | 128 | **159** | 28 | 86 | **114** | 45 | 28% |
| `/workday/incident-resilience?ui=v3.1` | 32 | 137 | **169** | 29 | 91 | **120** | 49 | 29% |
| `/workday/regulatory-change?ui=v3.1` | 31 | 150 | **181** | 28 | 87 | **115** | 66 | 36% |
| `/workday/nfr-governance?ui=v3.1` | 31 | 143 | **174** | 28 | 95 | **123** | 51 | 29% |
| **All six** | | | **1014** | | | **707** | **307** | **30%** |

Chrome loses 3 words on every surface: the bottom-bar `N updates` (2, table row
14) and the rail's visible `Collapse` (1, table row 15).

Main is where the work is. The three largest single contributions, per surface:

| Deletion | Words removed per surface |
|---|---|
| The three `Next` row subtitles (table row 1) | 19 to 21 |
| Context line clauses two and three (table row 3) | 8 |
| The location line (table row 2) | 5 to 6 |

The `Now` reason sentence varies most by role: 22 words removed on
`regulatory-change`, 15 on `rcsa`, 7 on `incident-resilience`, 6 on
`nfr-governance`, 0 on `tprm` and `control-assurance`, which are already inside
a one-line budget.

Every surviving line on the default screen after this pass is one of: a place
name, a count, a decision question written in the work's own language, a time, a
button, or the synthetic data disclosure.

---

## 8. Two things that are not copy, recorded so they are not lost

1. **`Loading` persists in the delivered document.** `app/workday/[role]/loading.tsx:106`
   renders a `role="status"` string that is still present in the final HTML of
   all six pages, positioned between the rail and the bottom bar. It is visually
   clipped, so this is a screen-reader-only defect: the live region may announce
   `Loading` on a page that has finished loading.
2. **`app/workday/[role]/error.tsx` is English only.** Lines 43, 47-48, 54, 57
   and 63 carry no German pair, while every other V3.1 surface is bilingual. The
   boundary is shared across interface versions and does not receive `language`,
   which is the cause rather than an oversight in the copy.

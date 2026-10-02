# Workday V2: the focus queue and the role workspaces

Handoff from the focus queue and role workspace work to the shell. It covers
the queue derivation, the Now panel, the selection contract, the six role
workspaces, the changed-object rule and the backward-compatible props added to
the visualisations.

Nothing outside the list below was created, and the only files modified outside
it are the six visualisations, each with one additive optional prop pair.

## Files

| File | What it is |
| --- | --- |
| `src/db/repositories/focus.ts` | Builds `FocusItemView[]` for a role at a moment, plus the Now detail, the one-line context and the drawer trigger counts. Read side only. |
| `src/db/repositories/workspace.ts` | Per-role workspace view models, the role scope, and changed-object detection. Read side only. |
| `src/components/focus/FocusQueue.tsx` | The four sections. Server safe except the disclosure it renders. |
| `src/components/focus/FocusItem.tsx` | One queue row, eight facts. Server safe. |
| `src/components/focus/WatchingItem.tsx` | One watched subject, deliberately thinner. Server safe. |
| `src/components/focus/NowPanel.tsx` | Now, Next, Watching. The one card on the screen. Server safe. |
| `src/components/workday-v2/SelectionProvider.tsx` | The selection context, the pure reducer, the query parameter form, and the ask-the-partner context. |
| `src/components/workday-v2/role-workspaces/RcsaWorkspace.tsx` | Process, risk and control graph plus the live work around it. |
| `src/components/workday-v2/role-workspaces/TprmWorkspace.tsx` | Supplier and fourth party constellation plus monitoring, evidence and conditions. |
| `src/components/workday-v2/role-workspaces/ControlAssuranceWorkspace.tsx` | Full population field plus selection reasons and classification progress. |
| `src/components/workday-v2/role-workspaces/IncidentResilienceWorkspace.tsx` | Service dependency map plus propagation, chronology, tolerance and options. |
| `src/components/workday-v2/role-workspaces/RegulatoryChangeWorkspace.tsx` | Obligation lineage plus the extraction and interpretation split. |
| `src/components/workday-v2/role-workspaces/NfrGovernanceWorkspace.tsx` | Portfolio thread plus the cross-function changes and the owners. |
| `src/components/workday-v2/role-workspaces/index.ts` | `ROLE_WORKSPACES`, `RoleWorkspaceProps`, `WorkspaceScenario`. |
| `src/components/workday-v2/role-workspaces/labels.ts` | The bilingual dictionary and `narrowView`. No React, which is what makes the copy testable. |
| `tests/unit/focus-queue.test.ts` | 33 tests over the pure rules. |
| `tests/integration/focus-queue-flows.test.ts` | 25 tests against the seeded day. |

## 1. Queue derivation

Every row comes from a table. There is no per-role list of queue items in the
codebase, because a written list drifts from the seed the first time a subject
identifier changes and nothing fails loudly when it does.

| Section | Source | Rule | `sourceCount` is |
| --- | --- | --- | --- |
| needs-you | `decisions` | Visible at the moment and `status = 'open'` | distinct supporting plus opposing evidence identifiers |
| needs-you | `ai_suggestions` | `status = 'needs-user'`, not dismissed | distinct evidence identifiers plus source connectors |
| needs-you | `workday_live_events` | `requires_decision` and no `decision_id`, so the event itself is the ask | distinct evidence identifiers plus source connectors |
| prepared | `ai_suggestions` | `status` is `ready` or `needs-user` | as above |
| prepared | `background_actions` | `kind` is `escalated-to-human` or `contradiction-identified`, one row each | attached evidence identifiers |
| prepared | `incidents` where `is_shared_event` | At or after 14:05, when the event reaches the role's scope | affected services plus suppliers |
| handled | `background_actions` | The five routine kinds, grouped to one row per kind with its count | distinct target identifiers in the group |
| handled | `ai_suggestions` | `status = 'completed'` | as above |
| handled | `decisions` | `status = 'decided'` **and** at least one `execution_receipt_lines` row | distinct evidence identifiers |
| watching | `kris` | `current_status` is red or amber, and the indicator is in the role's scope | number of `kri_readings` behind it |
| watching | `evidence_documents` | `status` is `requested` or `missing`, and the document is in the role's evidence scope | 1 |
| watching | `monitoring_activations` | `active`, subject in the role's scope | 1 |
| watching | `suppliers` | `status` is `under-reassessment` or `exit-planned`, supplier in scope | 1 |
| watching | `services` | `operational_status` is not `normal`, service in scope | number of suppliers behind the service |
| watching | `actions` | Raised by the role, `status` is open, in-progress or overdue | 1 |
| watching | `obligations` | `is_unowned_gap`, regulatory change role only | 1 |
| watching | `committee_items` | Not `on_agenda`, governance role only | 1 |
| watching | `incidents` where `is_shared_event` | At or after 14:05, when the event does **not** reach the role's scope | affected services plus suppliers |

Nothing dated after the moment being viewed is returned. The day is the day as
far as it has been lived.

### Why some things are not handled automatically

`escalated-to-human` and `contradiction-identified` are excluded from the
handled section by name, asserted in `HANDLED_BACKGROUND_KINDS`. Both end at a
person, so filing them as handled without one would be the single dishonest
thing this section could do.

A decided decision with no receipt line behind it is filed nowhere. It
executed nothing, and claiming otherwise would assert a change the database
does not contain.

### Why the routine kinds are grouped

Thirty-eight reconciliation rows under a collapsed heading is a scroll, not
information. One row reading "38 records reconciled" is the same fact in a form
a reader can use, and the individual rows stay in the database for anyone who
opens them. Grouped rows use `objectType: "background-work"` and the kind as
`objectId`, so they can never collide with a real work object under the
deduplication.

## 2. Section precedence

`dedupeFocusItems` in `src/workday/contracts.ts` owns the precedence and is
used rather than reimplemented: needs-you, then prepared, then handled, then
watching, keyed on `objectType:objectId`.

Two rules sit around it.

**Keying.** A decision item is keyed to the decision. A suggestion that names a
decision is keyed to that decision as well, which is what collapses the
"control assessment appears under both Needs you and Prepared for review" case
the contract's comment describes. A suggestion with no decision keeps its own
object. The practical consequence to know about: two open decisions on the same
underlying control both survive, because they are two judgments and the user
owes an answer to each.

**Watching suppression.** `assembleFocusQueue` drops a watching candidate whose
subject, or whose related object, is already the object of a needs-you or
prepared item. A subject the user is being asked to decide is not also
something they are merely watching. This is a relevance filter, not a second
deduplication: the related object key is carried beside the item in
`FocusCandidate` and never inside `FocusItemView`.

### Ordering within a section

`orderFocusItems`, in this order: severity rank, then anything with a due time
ahead of anything without one, then the oldest arrival, then the identifier.
The identifier tie break makes the order stable between renders, which is what
lets a test assert it.

### Now and Next

Now is the first item of needs-you, or the first prepared item when nothing
needs the user. Next is the following `NEXT_LIMIT` (3). Watching is capped at
`WATCHING_LIMIT` (6). The Now card's own caps are `NOW_CHANGED_LIMIT` (2) and
`NOW_COMPLETED_LIMIT` (3), so the panel is a fixed small number of lines by
construction rather than by convention.

## 3. The shell's entry points

```ts
// src/db/repositories/focus.ts

export function buildFocusQueue(
  roleId: RoleId,
  atMoment: string,
  language: Language,
  runId?: string,
): FocusItemView[];

export function buildFocusContext(
  roleId: RoleId,
  atMoment: string,
  language: Language,
  runId?: string,
): string;

export function triggerCountsForRole(
  roleId: RoleId,
  atMoment: string,
  runId?: string,
): Record<"evidence" | "uncertainty" | "policy" | "approvals" | "activity" | "audit", number>;

/** The same queue with sections, Now, Next and Watching already resolved. */
export function buildFocusQueueView(options: FocusQueueOptions): FocusQueue;

/** The Now card's view model. Capped arrays, fixed shape. */
export function buildNowDetail(
  item: FocusItemView,
  options: FocusQueueOptions & { sources?: SourceAttribution[] },
): NowDetail;

/** Evidence for the role at the moment, from the moment and the open decisions. */
export function focusEvidenceIds(roleId: RoleId, atMoment: string, runId?: string): string[];
```

`buildFocusQueue` returns the flat list already deduplicated and ordered.
Passing it through `dedupeFocusItems` again is safe: the function is idempotent
because it keys on the object and keeps the most demanding section, and that is
asserted in the unit tests.

`buildFocusContext` returns one sentence of counted fact, for example
"3 need your judgment, 2 prepared for review, 5 handled without you." Every
number in it is the length of a list the same screen shows.

`triggerCountsForRole` computes from the same `buildIntelligenceRail` assembly
the drawer renders, so "Evidence 7" on the trigger and seven citations in the
panel cannot disagree. It is equivalent to `triggerCounts(rail)` in
`ContextDrawer.tsx`; use whichever is cheaper at the call site, but not a third
derivation.

## 4. The selection contract

```ts
// src/components/workday-v2/SelectionProvider.tsx

export interface SelectionState {
  selection: WorkdaySelection | null;
  setSelection: (next: WorkdaySelection | null) => void;
  select: (
    objectType: WorkdaySelection["objectType"],
    objectId: string,
    label: string,
  ) => void;
  clear: () => void;
  isSelected: (objectId: string) => boolean;
}

export function useSelection(): SelectionState;

export function SelectionProvider(props: {
  roleId: RoleId;
  /** Every object identifier the current route exposes. */
  validObjectIds: readonly string[];
  initialSelection?: WorkdaySelection | null;
  children: ReactNode;
}): JSX.Element;

/** Pure, exported for testing and for a server side reconciliation. */
export function selectionReducer(
  state: SelectionSnapshot,
  action: SelectionAction,
): SelectionSnapshot;

export const SELECTION_PARAM = "select";
export function parseSelectionParam(
  value: string | null | undefined,
  resolveLabel?: (objectId: string) => string | undefined,
): WorkdaySelection | null;
export function formatSelectionParam(selection: WorkdaySelection): string;

export type AskAi = (prompt: string, selection: WorkdaySelection | null) => void;
export function AskAiProvider(props: { onAsk: AskAi; children: ReactNode }): JSX.Element;
export function useAskAi(): AskAi;
```

### What the shell must do

1. Wrap the workday routes in `SelectionProvider`, passing `roleId` and
   `validObjectIds`. The identifiers come from the workspace view model:
   `selectableIdsOf(view)`.
2. Resolve `?select=<type>:<id>` on the server with `parseSelectionParam` and
   pass the result as `initialSelection`. Every queue row that points at an
   object rather than a decision already links in that form, so a click in the
   queue lands with the object selected.
3. Wrap in `AskAiProvider` with a callback that routes into the partner. A
   function cannot cross a server to client boundary, so this is a context
   rather than a prop; the workspaces call `useAskAi()` and know nothing about
   the partner.
4. Read `useSelection().selection` in the contextual drawer and in the partner
   context assembly. The drawer and the partner then follow the workspace
   without either knowing where the click happened.

### The reconciliation rule

`useSelection` returns an inert shape rather than throwing when no provider is
mounted, mirroring `useShell`, so a workspace rendered in the administrator
area or in a test renders without a selection instead of crashing.

On a role change or a route change the provider dispatches `restore` with the
candidate selection and the route's identifiers:

- the same role and the object is in `validObjectIds`: kept;
- the same role and the object is not: cleared;
- `validObjectIds` is empty: cleared, because a route that exposes no objects
  is a route on which the previous object is not present. Treating empty as
  "unknown, keep it" is how a transaction reference survives onto a calendar
  and the drawer then describes something the reader cannot see;
- a different role: cleared, even if the identifier happens to exist there.

The selection is persisted per role in `sessionStorage` so it survives client
navigation inside a role. Storage is read after mount, never during the first
render, because the server cannot know what the tab holds and reading it during
render would be a hydration mismatch.

## 5. Role workspace props

```ts
// src/components/workday-v2/role-workspaces/index.ts

export interface RoleWorkspaceProps {
  roleId: RoleId;
  language: Language;
  currentMoment: string;
  /** True when rendered inside Today rather than on the workbench. */
  compact?: boolean;
  selection?: WorkdaySelection | null;
  /** Overrides `view.changedIds` when the shell has computed its own answer. */
  changedObjectIds?: string[];
  sources?: SourceAttribution[];
  /** Built on the server by `buildRoleWorkspace`. Optional in the type only. */
  view?: RoleWorkspaceView;
  events?: WorkdayLiveEvent[];
  suggestion?: AISuggestionView | null;
  scenario?: WorkspaceScenario;
  onSelect?: (selection: WorkdaySelection | null) => void;
  onAskAi?: (prompt: string, selection: WorkdaySelection | null) => void;
}

export const ROLE_WORKSPACES: Record<RoleId, ComponentType<RoleWorkspaceProps>>;

export interface WorkspaceScenario {
  currentMoment: string;
  viewedMoment: string;
  worldView: "today" | "future";
  autonomyLevel: AutonomyLevel;
  eventTriggered: boolean;
  scenarioDate: string;
}
```

### The one wiring change the shell needs

`view` is the only addition to the prop list the shell already declares, and it
is the one that matters. The workspaces are client components, because a graph
node click has to change the selection without a round trip, and a client
component cannot query the database. So `RoleWorkObject` needs one line:

```tsx
import { buildRoleWorkspace } from "@/db/repositories/workspace";

export function RoleWorkObject(props: RoleWorkspaceProps) {
  const Workspace = WORKSPACES[props.roleId];
  const view =
    props.view ??
    buildRoleWorkspace({
      roleId: props.roleId,
      atMoment: props.currentMoment,
      language: props.language,
    });
  return <Workspace {...props} view={view} />;
}
```

`view` is typed optional so the existing map assignment keeps compiling and a
half wired shell degrades to a named empty state rather than crashing. It is
required in practice: without it every workspace renders
"This work object is not available in this run".

`onSelect` and `onAskAi` are optional for the same structural reason. A
workspace reached from a server component gets both from context. The props
exist for a client parent that already holds the callbacks.

`compact` drops the secondary sections (context rows, the full chronology, the
long lists) and keeps the hero, the changes, the selection and the suggestion.
That is the Today layout. The workbench layout is `compact` unset.

### What each workspace composes

| Role | Hero | Live work around it |
| --- | --- | --- |
| `rcsa` | `RiskControlGraph` | changed nodes as rows carrying the same 2px edge; upstream and downstream consequences of the selection, derived from the same edges the graph draws; the prepared suggestion when it concerns the selection; control effectiveness divergences ranked by bands apart, two positions never averaged; lines that moved since the previous assessment version |
| `tprm` | `SupplierConstellation` | monitoring changes with the ones switched on this session marked; the nodes the event reaches; contractual obligations by recorded evidence status; open approval conditions with owner and date; contractual and operational context with the standing disclosure |
| `control-assurance` | `PopulationField` | cases new in the population; why a selected case was selected; classification progress as a track; sample membership and missing review evidence counted separately; a link that carries the control into the RCSA view with it already selected |
| `incident-resilience` | `ServiceDependencyMap` | the material decision exposed as a card; the propagation order from the recorded event-carrying edges; remaining tolerance per measure with the entity named; prepared recovery options with their trade-off; the chronology with provenance per entry and conflicts marked rather than resolved |
| `regulatory-change` | `ObligationLineage` | extraction and interpretation as two separate cards, never one field; newly extracted obligations; obligations with no owner named; the suggestion tied to the selected obligation; the standing disclosure on every regulatory block |
| `nfr-governance` | `PortfolioThread` | the consolidation stated as counted arithmetic; changes across the functions with the function named beside each; decisions and owners; the six lenses as rows for a keyboard reader, where opening a lens selects rather than navigates |

## 6. The changed-object rule

```ts
// src/db/repositories/workspace.ts
export function detectChangedObjects(options: ChangedObjectOptions): ChangedObject[];
export function rankChangedObjects(candidates: ChangedObject[], cap: number): ChangedObject[];
export function changedIdsOf(changed: ChangedObject[]): string[];
export const CHANGED_WINDOW_MINUTES = 150;
export const CHANGED_CAP = 6;
```

Four evidence sources, in precedence order:

1. `workday_live_events` for the role, inside the window;
2. `audit_events` with category `mutation` or `decision`, not pre-existing, not
   blocked, inside the window;
3. `background_actions` for the role, inside the window, excluding
   `system-checked`;
4. records whose field owned by a person is now set where the seed left it
   null: a control effectiveness set by someone other than the seed, an
   assessment created in this session, a classified test case, an incident with
   a severity, an interpreted obligation, an active monitoring activation.

Then: collapse duplicates keeping the most recent, or the stronger source at an
equal moment; rank objects in the role's recorded scope ahead of objects
outside it; take the first `cap`.

Three decisions worth knowing:

**Approvals are excluded.** An approval is the authority under which a change
was permitted, not a change to a work object, and the change itself already has
a mutation row. Including them put a marker on six approval records for every
one control that moved, and the control then lost its place under the cap. The
integration test that caught this is still in the suite.

**In-scope first.** Executing one decision writes a mutation row per
consequence: a remediation action, a committee item, a monitoring activation, a
message, all at the same moment. Ranked by recency alone they tie with the
control the decision was about, and an alphabetical tie break then decides what
the graph marks. An object in the role's scope is one the workspace can
actually mark, so those are taken first.

**Source 4 has no clock.** Those record fields carry no scenario moment, so a
change found that way is dated at the moment being viewed. That is why it sits
last in the precedence order: when the audit log reports the same object the
audit moment wins and the timestamp shown is the real one.

### The role scope

`buildRoleScope` assembles the objects a role demonstrably works on from four
real links: the objects its decisions name (`related_object_kind`,
`related_object_id`), the objects its timeline moments put on screen
(`work_object_id`, `evidence_ids`), the objects its background work touched
(`target_kind`, `target_id`), and the objects its actions point at. Then it
expands along recorded relationships: a control brings its risks and processes,
a control test brings its control, a service brings its suppliers and the
reverse. `groupScope` is true for the portfolio role, whose scope is the group
rather than a subject.

This is what makes watching relevance data-driven. The manual override rate
indicator reaches the operational risk partner because it indicates a risk in
that partner's scope, not because a file says so.

## 7. Visualisation props added

Each is optional, defaults to the previous behaviour exactly, and adds a 2px
edge marker plus a `data-changed` attribute and an accessible name suffix. The
2px edge is the same device `.app-item[data-changed]` uses on a list row, so
"this is what moved" means one thing in both places. The marker colour is
`var(--accent)`, which the V2 token scope remaps to the AI violet and the V1
scope leaves as the V1 accent, so one declaration is correct in both
interfaces.

| File | Props | Why |
| --- | --- | --- |
| `RiskControlGraph.tsx` | `changedNodeIds?`, `changedLabel?` | A new signal reaches specific processes, risks, controls and indicators. Added once on the shared `GraphNode` shell, so all four node kinds carry it. |
| `SupplierConstellation.tsx` | `changedNodeIds?`, `changedLabel?` | A monitoring change reaches a specific service or subprocessor. Drawn beside the node rather than on it, because the split halves already carry the appendix divergence and the pulse already carries the event. |
| `PopulationField.tsx` | `changedCaseIds?`, `changedLabel?` | New cases entering the population. Kept separate from the corner notch that marks a fallback route case: arrival and route are different facts and a tester has to read both off one cell. |
| `ServiceDependencyMap.tsx` | `changedNodeIds?`, `changedLabel?` | Recency, given a still mark because the pulse already belongs to the event path. |
| `ObligationLineage.tsx` | `changedObligationIds?`, `changedLabel?` | A new extraction is a different claim from the terminal state the ribbon carries. A newly extracted obligation can be fully evidenced, and a long standing one can be unowned. |
| `PortfolioThread.tsx` | `changedLensRoleIds?`, `changedLabel?` | The portfolio lead needs to see which of the six functions have actually moved. |

`changedLabel` exists so the accessible name can be German. The marker is
geometry, and geometry is invisible to a screen reader, so a changed node
announces that it changed.

No other change was made to those files. The V1 workbench renders all six and
was checked: all six role routes return 200 with `?ui=v1` and the graph markup
is present, and `/story` returns 200.

## 8. Lazy-loading boundaries

Two boundaries, nested.

**Per role.** `RoleWorkObject` dynamic-imports each workspace file separately,
so rendering one role's workspace loads one chunk. Importing
`role-workspaces/index.ts` pulls all six and with them all six visualisations;
that is the right trade for a test walking every role and the wrong one for a
route, which is why the index carries a comment saying so.

**Per visualisation.** Each workspace dynamic-imports its own visualisation
with `ssr: false` and a `SkeletonRows` placeholder. `ssr: false` is deliberate:
these components run a measuring layout pass, and running it on the server only
to run it again on hydration buys nothing when the shell, the Now panel and the
queue are all server rendered and readable first.

The focus components are server safe. `FocusItem`, `WatchingItem` and
`NowPanel` have no hooks and no handlers; every row navigates through an
anchor. `FocusQueue` is server safe and renders one client primitive, the
`Disclosure` behind "Handled automatically", which is the only interactive
element in the queue.

## 9. Visual discipline

Cards used, and why each is permitted:

- the Now card, which is the primary decision;
- the prepared suggestion in the RCSA, TPRM and regulatory workspaces, which
  is a new AI suggestion;
- the material decision in the incident workspace, which is a critical event;
- the extraction and interpretation pair in the regulatory workspace, which is
  the one grouped object in this feature whose meaning depends on the two
  halves being visibly separate. That is a fifth case and this is the written
  reason for it: the distinction between machine reading and a named person's
  position is the product's central claim in that role, and two rows under one
  heading would read as one statement with two parts.

Everything else repeating is a row. One primary button per focus area: the Now
card's action, and the open-the-decision action on the incident card. No
heading above 20px; the workspace titles use `.app-object-title` at
`--app-text-xl` and the section heads use `.app-section-title` at
`--app-text-lg`. No lede paragraph: the context line is one sentence of counted
fact. Chips carry status, source type, severity, authority and count only.

## 10. Copy and jurisdiction

Every user-visible string in `labels.ts` has an English and a German form, and
the German is ASCII transliteration. The unit tests assert both, plus no em
dash, no umlaut character, no model or provider name, and no regulatory
framework name in the shared label file.

No framework is named in this feature's own copy. A framework label is
jurisdiction bound, the entities in this scenario are not in one jurisdiction,
and a file shared by six roles is exactly the wrong place for a string that is
true for some entities and false for others. Framework wording comes from the
record, through the view model, and the regulatory workspace attaches
`RegulatoryNote` to the lineage, the extraction and interpretation pair, the
suggestion, the unowned list and the context block. The TPRM workspace attaches
it to the context block, which carries the regulated outsourcing
characterisation. Nothing in this feature claims compliance, and no figure
anywhere is a saving.

## Acceptance criteria

The brief numbers these; the wording below is the behaviour delivered, so the
shell owner should confirm the mapping against the numbered list.

| Numbers | Delivered |
| --- | --- |
| 6 | The Today screen opens on Now, then Next, then Watching, then the role work object. No title above 20px, no lede paragraph, and the one context line is a sentence of counted fact rather than a narrative. |
| 10 | Four sections with "Needs you" open, "Prepared for review" present and quieter, "Handled automatically" collapsed behind a disclosure carrying its count, and "Watching" compact. |
| 11 | Section membership is read from the row, so recording a decision moves its item without anything in the queue being told. Proved by the integration test that records `DEC-2026-0772` and finds the item has left needs-you and arrived under handled. |
| 12 | One item in one active section, enforced through `dedupeFocusItems` plus the watching suppression rule, asserted per role against the seeded day. |
| 17 | Now carries exactly one item showing why it appeared, what changed, what the partner completed, what it needs from the user and the next action, within fixed caps of two changes and three completed lines. |
| 33 | Selecting a risk, control, supplier, service, test case, incident, obligation or decision updates one context that the drawer and the partner both read, through `useSelection`. |
| 34 | Selection survives navigation inside a role while the object is still on the route and clears when it is not, including on a role switch and on a route exposing no objects. Five cases asserted against the pure reducer. |
| Section 14 | Each role's existing hero visualisation is composed with live events, selection and the changed-object marker, with the per-role requirements in the table in part 5. The visualisations were not rewritten; each took one additive optional prop pair. |
| Section 15 | Changed objects are detected from four evidence sources and capped at six, ranked most recent first and in-scope first, with the single 2px edge device used identically on a list row, a graph node and a focus item. |

## Limitations and open seams

1. **No live events or suggestions are seeded yet.** `workday_live_events` and
   `ai_suggestions` are read by both repositories and both derivations degrade
   to nothing when the tables are empty, which is their current state. The
   queue is still non-empty for all six roles because decisions, background
   work and monitored subjects carry it. Once events land, the needs-you
   section gains event-driven items and the changed-object detector gains its
   highest-precedence source; nothing needs to change here for that.

2. **The shared event item is derived from the incident, not from an event
   row.** Until the 14:05 event is projected into `workday_live_events`, the
   queue derives it from the shared-event incident. It is section-assigned by
   whether the incident's services, suppliers or processes are in the role's
   scope, and suppressed for the role that already holds a decision on the
   incident. When the event row exists it will take precedence through the
   normal event derivation and this fallback becomes redundant rather than
   wrong.

3. **`view` must be passed.** See part 5. One line in `RoleWorkObject`.

4. **The `?select=` parameter is a proposal, not an existing route contract.**
   Queue rows that point at an object link in that form and
   `parseSelectionParam` reads it, but nothing in `app/` resolves it yet. If
   the shell prefers a different parameter name, change `SELECTION_PARAM` and
   the hrefs in `focus.ts` follow.

5. **`FocusWorkspace.tsx` and the components in `src/components/focus/`
   overlap.** Both render the queue. `FocusWorkspace` is the shell's
   composition and does its own section split; `NowPanel`, `FocusQueue`,
   `FocusItem` and `WatchingItem` are the row-level implementations with the
   caps and the Now detail shape, and they are what the tests exercise.
   `FocusWorkspace` can delegate to them without losing anything.

6. **Monitoring activations are empty until a decision activates one.** The
   watching derivation reads `monitoring_activations` and the seed writes none,
   so enhanced monitoring appears in Watching only after the TPRM decision that
   switches it on. That is correct behaviour rather than a gap, but it means a
   reviewer looking at the opening moment will not see that row.

7. **Tolerance consumption is only computed for elapsed-time measures.** A
   count or share measure shows its starting position and says so in its own
   note. That limitation is inherited from `calculateToleranceRemaining` and is
   stated on the row rather than hidden.

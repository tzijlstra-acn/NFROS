# Workday V2: the AI Partner dock

Handoff from the AI Partner work to the shell, the live day player and the
server side of the partner. Everything in `src/components/ai-partner/` is
covered here. Nothing outside that folder was created or modified.

The dock is not mounted anywhere yet. It compiles standalone, every prop
except `context` has a default, and the shell wires it.

## Files

| File | What it is |
| --- | --- |
| `src/components/ai-partner/AIPartnerDock.tsx` | The dock. Owns the tabs, the chat state and the stream overlay. The only component the shell needs to mount. |
| `src/components/ai-partner/AIPartnerHeader.tsx` | State, autonomy level, demo mode, collapse control, optional trace disclosure. |
| `src/components/ai-partner/AIStatus.tsx` | The abstract status mark and the text state. Server safe. |
| `src/components/ai-partner/AISuggestionCard.tsx` | One suggestion, six questions, two separate completion lists, one primary action plus an overflow menu. |
| `src/components/ai-partner/AIActivityStream.tsx` | Chronological record grouped by moment, technical detail behind `ExpandRow`. |
| `src/components/ai-partner/AIGenerationView.tsx` | The stage list shown before content exists, and the failure state. |
| `src/components/ai-partner/AIComposer.tsx` | The composer and at most three contextual prompts. |
| `src/components/ai-partner/AIChatPanel.tsx` | The transcript, the context row, and `useWorkdayChat`, which owns the conversation. |
| `src/components/ai-partner/AIResponseParts.tsx` | The eleven typed parts, plus the connected system phase chip. |
| `src/components/ai-partner/AIExecutionReceipt.tsx` | One line per change, with the outstanding lines visibly different. |
| `src/components/ai-partner/labels.ts` | Bilingual dictionary and every pure rule. No React, which is what makes the rules testable. |
| `tests/unit/ai-partner.test.ts` | 36 tests. |

## Component tree

```
AIPartnerDock                           client, holds all state
  collapsed rendering
    .app-partner-presence
      expand button
      AIPartnerMark                     state, motion only when really running
      .app-partner-presence-label       the state, in words
      needs-you count chip
  expanded rendering
    AIPartnerHeader
      AIStatus > AIPartnerMark
      autonomy chip, demo mode dot, needs-you count
      Disclosure "View details"         rendered only when `details` is passed
    Tabs                                Suggestions | Activity | Chat
    .app-partner-body
      TabPanel suggestions
        AIGenerationView                holds the slot until validation passes
        AISuggestionCard[]              gated by canRevealSuggestion
      TabPanel activity
        AIExecutionReceipt              when receipt lines exist
        AIActivityStream
      TabPanel chat
        AIChatPanel > AIResponseParts > AIExecutionReceipt (plain variant)
    .app-partner-foot
      AIComposer                        rendered only while the Chat tab is active
```

## Prop contracts

### AIPartnerDock

```ts
interface AIPartnerDockProps {
  context: WorkdayContext;                       // REQUIRED, the only one
  suggestions?: AISuggestionView[];              // default [], newest first
  activity?: AIActivityEntryView[];              // default []
  generation?: AIGenerationProgress;             // default IDLE_GENERATION
  generationSources?: SourceAttribution[];       // default []
  receiptLines?: ExecutionReceiptLineView[];     // default []
  loadState?: DataLoadState;                     // default "ready", drives aria-busy
  running?: boolean;                             // omit to derive from the stream
  executing?: boolean;                           // default false
  collapsed?: boolean;                           // controlled collapse
  defaultCollapsed?: boolean;                    // default false, uncontrolled
  onCollapsedChange?: (collapsed: boolean) => void;
  initialTab?: "suggestions" | "activity" | "chat";   // default "suggestions"
  initialThreadId?: string | null;               // restores a thread on mount
  subscribe?: WorkdaySubscribe;                  // see below
  onSuggestionAction?: (action: SuggestionActionId, suggestion: AISuggestionView) => void;
  onOpenEvidence?: (evidenceId: string) => void;
  onOpenAudit?: (auditEventId: string) => void;
  onApprovalRequest?: (input: { decisionId: string | null; text: string }) => void;
  onRetryGeneration?: () => void;
  details?: ReactNode;                           // trace metadata, disclosure only
}
```

`context` is the `WorkdayContext` from `src/workday/contracts.ts`, assembled
server side. The dock reads `roleId`, `language`, `demoMode`, `autonomyLevel`,
`selection`, `currentMoment` and `openDecisionIds` from it, and asserts
nothing the client is not allowed to assert.

What the shell must pass, minimally:

```tsx
<AIPartnerDock context={context} />
```

What the shell should pass in the real wiring:

```tsx
<AIPartnerDock
  context={context}
  suggestions={suggestions}
  activity={activity}
  generation={generation}
  receiptLines={receiptLines}
  collapsed={partnerCollapsed}            // from the 1366 breakpoint
  onCollapsedChange={setPartnerCollapsed}
  subscribe={subscribeToWorkdayStream}
  onSuggestionAction={handleSuggestionAction}
  onOpenEvidence={openEvidenceDrawer}
  onOpenAudit={openAuditDrawer}
  onApprovalRequest={openDecisionDrawer}
  onRetryGeneration={requestSuggestion}
/>
```

Collapse works either way. With `collapsed` given the shell owns it and the
grid attribute `data-partner="collapsed"` stays in step; with only
`defaultCollapsed` the dock manages it and reports changes through
`onCollapsedChange`.

### AIPartnerHeader

```ts
interface AIPartnerHeaderProps {
  state: AIPartnerState;            // required
  language: Language;               // required
  autonomyLevel: AutonomyLevel;     // required
  demoMode: "live" | "safe" | "offline";  // required
  running?: boolean;                // default false
  detail?: string;                  // overrides the standard state line
  needsYouCount?: number;           // default 0, hidden when zero
  onCollapse?: () => void;          // omit to hide the collapse control
  details?: ReactNode;              // omit to hide the disclosure entirely
}
```

### AIStatus

```ts
function AIStatus(props: {
  state: AIPartnerState;
  language: Language;
  running?: boolean;                // default false
  detail?: string;
  compact?: boolean;                // default false, drops the detail line
}): JSX.Element;

function AIPartnerMark(props: {
  state: AIPartnerState;
  running?: boolean;
  label?: string;                   // accessible name, defaults to the state
}): JSX.Element;

function partnerMotionAllowed(state: AIPartnerState, running: boolean): boolean;
```

### AISuggestionCard

```ts
interface AISuggestionCardProps {
  suggestion: AISuggestionView;     // required
  language: Language;               // required
  currentMoment?: string;           // omit to hide the age
  progressive?: boolean;            // default false, enables the staged reveal
  onAction?: (action: SuggestionActionId, suggestion: AISuggestionView) => void;
  onOpenEvidence?: (evidenceId: string) => void;
}
```

With no `onAction` the primary button renders disabled rather than silently
doing nothing.

### AIActivityStream

```ts
interface AIActivityStreamProps {
  entries: AIActivityEntryView[];   // required
  language: Language;               // required
  autoScroll?: boolean;             // default true, ignored under reduced motion
  onOpenEvidence?: (evidenceId: string) => void;
  onOpenAudit?: (auditEventId: string) => void;
}
```

### AIGenerationView

```ts
interface AIGenerationProgress {
  state: AIGenerationState;
  completedStages?: AIGenerationState[];
  label?: string;                   // server stage label, preferred over the local one
  suggestionId?: string | null;
  error?: string | null;
  retryable?: boolean;
}

interface AIGenerationViewProps {
  generation: AIGenerationProgress; // required
  language: Language;               // required
  sources?: SourceAttribution[];    // default [], kept visible through a failure
  onRetry?: () => void;
  running?: boolean;                // default true
}

const IDLE_GENERATION: AIGenerationProgress;
function generationStageIndex(generation: AIGenerationProgress): number;
```

### AIComposer

```ts
interface AIComposerProps {
  value: string;                    // required, controlled
  onChange: (value: string) => void;        // required
  onSubmit: (value: string) => void;        // required
  language: Language;               // required
  busy?: boolean;                   // default false
  disabled?: boolean;               // default false
  promptIds?: PromptId[];           // default [], capped at three on render
  onPromptSelect?: (text: string, id: PromptId) => void;  // falls back to onSubmit
}
```

### AIChatPanel and useWorkdayChat

```ts
function useWorkdayChat(options: {
  roleId: RoleId;                   // required
  selection: WorkdaySelection | null;       // required, may be null
  language: Language;               // required
  initialThreadId?: string | null;  // default null
  disabled?: boolean;               // default false
  routes?: { post?: string; get?: string };  // defaults to the real routes
}): WorkdayChatState;

interface WorkdayChatState {
  threadId: string | null;
  turns: ChatTurnView[];
  draft: string;
  busy: boolean;
  error: string | null;
  blocked: string | null;
  announcement: string;
  effectiveSelection: WorkdaySelection | null;
  pinnedSelection: WorkdaySelection | null;
  setDraft: (value: string) => void;
  send: (input: string) => void;
  newThread: () => void;
  pinSelection: (selection: WorkdaySelection | null) => void;
}

interface AIChatPanelProps {
  chat: WorkdayChatState;           // required, from useWorkdayChat
  language: Language;               // required
  selection: WorkdaySelection | null;       // required, the live selection
  demoMode: "live" | "safe" | "offline";    // required
  onOpenEvidence?: (evidenceId: string) => void;
  onApprove?: (input: { decisionId: string | null; text: string }) => void;
  onOpenAudit?: (auditEventId: string) => void;
  receiptLines?: ExecutionReceiptLineView[];
}
```

The dock calls the hook, so the shell does not need to. The hook is exported
for the case where another surface wants the same conversation.

### AIResponseParts

```ts
interface AIResponsePartView {
  kind: AIPartKind;
  text: string;
  refs?: string[];
  meta?: Record<string, unknown>;
}

interface AIResponsePartsProps {
  parts: AIResponsePartView[];      // required
  language: Language;               // required
  onOpenEvidence?: (evidenceId: string) => void;
  onApprove?: (input: { decisionId: string | null; text: string }) => void;
  onAskFollowUp?: (question: string) => void;
  onOpenAudit?: (auditEventId: string) => void;
  receiptLines?: ExecutionReceiptLineView[];
}

function toResponsePart(value: unknown): AIResponsePartView | null;
```

### AIExecutionReceipt

```ts
interface AIExecutionReceiptProps {
  lines: ExecutionReceiptLineView[];        // required
  language: Language;                       // required
  onOpenAudit?: (auditEventId: string) => void;
  variant?: "card" | "plain";               // default "card"
  title?: string;
}

function isOutstandingReceiptLine(line: ExecutionReceiptLineView): boolean;
```

## The subscribe contract

```ts
type WorkdayStreamListener = (event: WorkdayStreamEvent) => void;
type WorkdaySubscribe = (listener: WorkdayStreamListener) => () => void;
```

A callback, not a hook import, so the dock has no dependency on the live day
hook. Requirements on the implementation:

1. Call the listener for every `WorkdayStreamEvent`. The dock filters by kind
   and by `roleId` itself.
2. Return an unsubscribe function. It is called on unmount and whenever
   `subscribe` or `context.roleId` changes.
3. Keep the identity of `subscribe` stable, with `useCallback` or a module
   level function. A new function identity on every render resubscribes on
   every render.

Events consumed:

| Kind | Effect in the dock |
| --- | --- |
| `agent.run.started` | running true, generation set to `queued` |
| `agent.stage.changed` | generation state, completed stages and server label; running false on `ready` or `error` |
| `agent.tool.completed` | appends the entry to the activity stream, deduped by id |
| `agent.suggestion.ready` | prepends the suggestion, enables its staged reveal, moves to the Suggestions tab unless the user is in Chat |
| `agent.suggestion.failed` | generation state `error` with the reason and the retryable flag |
| `mutation.completed` | appends receipt lines, deduped by id |

Everything else is ignored, deliberately. `integration.command.changed` and
`data.load.changed` are not mirrored here, because the dock would then hold a
second account of connector state that could disagree with the one Trust and
Control Room show.

With no `subscribe` the dock renders from props alone and nothing degrades
except liveness.

## The states and what drives each

Nine states, from `AI_PARTNER_STATES`. The dock never sets one directly: it
calls `partnerStateFromGeneration(generationState, { decisionRequired,
executing, offline })` from the contracts module.

| State | What puts it there |
| --- | --- |
| `monitoring` | generation `idle`, and also `error`, because a failed run is back at rest |
| `checking-evidence` | generation `queued` or `retrieving` |
| `preparing` | generation `reconciling`, `analysing`, `drafting` or `validating` |
| `ready` | generation `ready` with nothing waiting on the user |
| `needs-you` | generation `blocked`, or `ready` with a suggestion needing the user |
| `executing` | the `executing` prop |
| `completed` | not produced by the derivation; pass it through `partnerStateFromGeneration` upstream or set `executing` false after a receipt arrives |
| `paused` | not produced by the derivation; reserved for the live player pausing the day |
| `offline` | `context.demoMode === "offline"`, which outranks everything |

`needsYouCount` is the number of revealable suggestions with status
`needs-user` or `decisionRequired` set.

Motion. `.app-sheen[data-running]` and `.app-dot[data-live]` are the only
animated things, and both require two conditions: a real `running` flag, and a
state in `{checking-evidence, preparing, executing}`. `partnerMotionAllowed`
is the single place that decides. With `running` omitted the dock derives it
from the stream, so a dock with no stream and no prop never animates.

## The card action rule

Implemented in `selectSuggestionActions` in `labels.ts`, tested exhaustively
over every status, authority class, constraint and decision flag.

| Condition | Effect |
| --- | --- |
| open (`ready` or `needs-user`), has a recommendation, not constrained, authority `APPROVAL_REQUIRED` or `PROPOSE` | primary is Approve |
| authority `POLICY_BOUND_AUTONOMOUS` | no Approve. The partner may act inside policy, so an approval control would invent a gate the authority model does not have |
| authority `READ`, `DRAFT` or `PROHIBITED` | no Approve, ever |
| `constrained` true | Approve withdrawn, primary becomes Review, the card says which required source was missing |
| no recommendation | Approve withdrawn, primary becomes Review |
| `decisionRequired` true | Snooze and Dismiss removed. Deferring a required decision is itself a decision with an owner and a record |
| status `monitoring` or `checking` | primary is Open object. No Approve, no Modify |
| status `executing` or `completed` | primary is Review. No Approve, no Snooze, no Dismiss |
| status `dismissed` | primary is Open object and the overflow is empty |

Modify appears where Approve does, plus on a `DRAFT` suggestion. Ask why
appears on everything except a dismissed suggestion, and the dock answers it
itself by switching to Chat with the question prefilled, then calling
`onSuggestionAction` so the caller can record that it was asked.

Approve is a callback. The card executes nothing and makes no request. Pair
`onSuggestionAction("approve", ...)` with the decision surface, which is where
the authority gate lives.

## The chat context contract

* The thread lives in the dock, so it survives a tab change, a collapse to the
  presence rail and navigation between work objects. Nothing is remounted.
* Every turn records the object it was asked about. A user turn created in
  this session carries the full `WorkdaySelection`, so its chip can pin that
  object as the context for the next question. A turn restored from the server
  carries only the object id, so it renders as text rather than offering a pin
  with a guessed object type.
* `effectiveSelection` is `pinnedSelection ?? context.selection` and is what
  goes to the route. "Return to current context" clears the pin and appears
  only when the pinned object differs from the live selection.
* `newThread` bumps an internal generation counter, so an answer that was in
  flight when the thread was reset is dropped rather than landing in the new
  thread.
* Arrival is announced once, through `Announcer`, as a short status plus the
  scenario moment. The response text never enters a live region, which is what
  stops a screen reader rereading the whole answer on every update.
* Source is shown per turn, live, saved or prepared, and the demo mode is shown
  once in the context row. Neither names a provider or an engine.
* At most three prompts, selected by `selectPromptIds` from the eight
  contextual questions. The cap is applied in the selector and again in the
  composer, because it is a rule about the surface rather than a detail of one
  function.

## What is consumed from the routes

### `POST /api/workday/suggestion`

Not called by these components. The dock takes `suggestions`, `generation` and
`generationSources` as props and exposes `onRetryGeneration` for the retry
control, so the owner of the route decides when to call it and whether to pass
`refresh`. The response maps onto props as follows:

| Response field | Prop |
| --- | --- |
| `suggestion` | appended to `suggestions` |
| `generation.state`, `generation.completedStages`, `generation.label` | `generation` |
| `error`, `retryable` | `generation.error`, `generation.retryable`, with `generation.state` set to `"error"` |
| `cached` | not rendered directly. The card shows `suggestion.source`, which already distinguishes live, cache and seeded |

### `POST /api/workday/chat`

Called by `useWorkdayChat` with `{ roleId, threadId?, input, selection? }`.
`selection` is the effective selection and is omitted when there is none.
Read from the response: `threadId`, `turn.id`, `turn.author`, `turn.parts`,
`turn.atMoment`, `turn.source` and `blocked`. Parts are validated one by one;
an unknown `kind` is dropped rather than rendered as prose. A non-OK response
or a malformed body marks the user turn as failed and shows "The answer did
not arrive. Nothing was changed." It never throws, because the chat sits on
every workday route.

Two fields are read if present and tolerated if absent: `turn.contextObjectId`
and `turn.contextLabel`.

### `GET /api/workday/chat/thread`

Called once on mount when `initialThreadId` is set, with `roleId` and
`threadId`. Reads `turns[]` using the same per turn parsing. A failed restore
leaves an empty thread rather than an error state.

### Part `meta` keys the renderer understands

| Key | Used for |
| --- | --- |
| `meta.phase` | one of the six connected system phases, shown as a chip. Overrides the kind based inference |
| `meta.authorityClass` | renders `AuthorityChip` on the part |
| `meta.decisionId` | passed back through `onApprove` |
| `meta.lines` | receipt lines for an `execution-receipt` part. Every field is defaulted, so a partial payload renders as a line with missing detail rather than a confident claim |

An `execution-receipt` part with no stated phase is labelled queued, not
executed. That is deliberate: an unqualified receipt must not read as though an
external platform confirmed the write.

## Acceptance criteria

The brief numbers these; the wording below is the behaviour delivered, so the
shell owner should confirm the mapping against the numbered list.

| Numbers | Delivered |
| --- | --- |
| 14 to 16 | The partner is present on every workday route as one dock, 336px at 1920 and 1440, a 48px presence rail at 1366 that still states its state, and three tabs with the third labelled Chat |
| 17 | Nine states derived from real application activity, with motion gated on an actual running flag and permitted in three states only |
| 18 | The autonomy level and the demo mode sit in the partner header, not the top bar |
| 19 to 20 | Every suggestion answers the six questions in order, with `checksCompleted` and `actionsCompleted` as two distinct lists, plus confidence, uncertainty, source count and authority class |
| 21 | A constrained suggestion names the missing required source, is held below a high confidence band and loses the Approve action |
| 22 | One primary action plus an overflow menu, chosen by status and authority class, with approval routed to the decision surface through a callback |
| 41 to 43 | The generation view holds the slot with the real stages, content is revealed progressively once validation passes, and nothing is revealed before it |
| 44 | Failure shows "Suggestion unavailable", keeps loaded evidence visible and offers retry when the server says it is retryable |
| 45 to 46 | The activity stream is chronological, grouped by moment, compact to time and label, with object, evidence, step, duration, outcome, authority and audit reference behind an expand; no auto scroll under reduced motion |
| 47 to 48 | The execution receipt is one line per change with target system, external reference, status, completion time, retry state and audit link, and an outstanding line is visibly and verbally different from an acknowledged one |
| 52 to 53 | Persistent contextual chat on every route, placeholder "Ask about the current work", at most three contextual prompts, a new thread control and a return to current context control |
| 54 | Typed parts rendered distinctly across all eleven kinds, with the connected system phase visible as a compact part rather than a tool log |
| 55 | Cited evidence opens in place through `onOpenEvidence`, and an AI answer is distinguishable from an executed system action by part kind and by the receipt |
| 56 | Arrival is announced once, the response text never enters a live region, and content provenance is shown as live, saved or prepared |

Section 28, the collapse behaviour: the dock stays mounted across collapse and
expand, so the tab, the thread, the draft and the stream overlay survive, and
the centre workspace is untouched because nothing above it changes identity.

## Limitations and open seams

1. **`completed` and `paused` are not derivable.** `partnerStateFromGeneration`
   has no path to either. Pass `executing` and let a receipt arrival move the
   state, or extend the contract. Both states have labels and detail lines
   ready.
2. **No suggestion fetch.** The dock never calls
   `POST /api/workday/suggestion`. Someone has to, and pass the result in. The
   same is true of `refresh`, which `onRetryGeneration` should trigger.
3. **The dock does not know the breakpoint.** It renders the rail when told to.
   The 1366 media query and the `data-partner` attribute on `.app-body` belong
   to the shell.
4. **Receipt status is a snapshot.** `integration.command.changed` is not
   folded into receipt lines, so a queued line does not become acknowledged
   without a new `mutation.completed` or a fresh server render. Mirroring it
   here would create a second account of connector state.
5. **Regulatory disclosure is matched on terms.** The card attaches
   `RegulatoryNote` when the generated copy mentions a named framework. It does
   not decide jurisdiction: the generator remains responsible for never
   attaching DORA or EBA to the Swiss entity.
6. **No rendering tests.** The unit suite covers the pure rules. Interaction
   coverage belongs in the Playwright suite, which another agent owns.

## Verification

* `npx tsc --noEmit` restricted to `src/components/ai-partner/**` plus the test
  file: clean. The repository wide run currently fails in files owned by other
  agents, listed below, and in none of mine.
* `npm run check:copy`: no finding of any severity in these files. The one
  error in the run is `scripts/verify-live-day.ts`, which contains a literal em
  dash in a detector expression and needs a `copy-check-ignore` marker from its
  owner.
* `npx vitest run tests/unit`: 211 tests pass, 36 of them in
  `tests/unit/ai-partner.test.ts`.

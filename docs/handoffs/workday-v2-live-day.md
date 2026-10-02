# Workday V2: the live day player

Agent C handoff. Everything the shell needs in order to wire the bottom bar in,
plus the derivation rules that keep `workday_live_events` a projection rather
than a second scenario.

## 1. The event model

`workday_live_events` is a projection. Every row is derived at seed time from a
row that already exists, and records where it came from in `derivedFrom` and
`derivedFromId`. The integration test resolves all of them against the table
each row names; a row whose source does not exist fails the suite.

### Source to event type

| Source table | `derivedFrom` | `derivedFromId` | Event type | Selection rule | Rows |
|---|---|---|---|---|---|
| `timeline_events` | `timeline` | `M01` to `M10` | `signal` | All ten moments, visible to every role (`roleIds: []`) | 9 |
| `timeline_events` (14:05) | `timeline` | `M08` | `shared-event` | The one row with `is_shared_event`, severity `critical`, `roleIds: []` | 1 |
| `timeline_role_moments` | `timeline` | `TRM-M0n-<role>` | `evidence` | Per role, the two moments with the most evidence in play, with a work object and a stated uncertainty. Ties break on the timeline identifier | 12 |
| `background_actions` | `background-action` | `ACT-...` | `agent-action` | Per role, the `escalated-to-human` action. There is exactly one per role | 6 |
| `inbox_messages` | `inbox` | `IMSG-...` | `message` | Per role, the two highest priority messages revealed after the opening moment | 12 |
| `meetings` | `meeting` | `MTG-...` | `meeting` | Per role, the first and the last of the day by `scheduled_for` | 12 |
| `decisions` | `decision` | `DEC-...` | `decision-required` | Per role, every open decision presented after the opening moment, plus the top ranked morning brief item | 26 |
| `integration_events` | `integration` | the event id | any | **Not written here.** The integration runtime writes these; this module tolerates them and never deletes rows it did not write | 0 |

Total: **78 events**, which is inside the briefed range of roughly 40 to 80.
Per role that is 21 to 24 visible events across ten moments, which is enough
for the track to look like a day rather than a scatter of dots.

### Why the density is capped

Projecting all 165 background actions and all 78 inbox messages would produce a
track of indistinguishable markers and a catch-up walk nobody would finish. The
caps above are deterministic, are asserted in `scripts/verify-live-day.ts`, and
mean two seeds of the same build produce byte-identical rows. All 165 background
actions sit at 07:45 in the seed, so projecting them would also have clustered a
fifth of the day's events on the opening moment.

### Ordering

`sortOrder` is `group * 100 + index within the moment`, assigned in a pass over
the assembled rows:

| Group | Types |
|---|---|
| 0 | `signal`, `shared-event` |
| 1 | `agent-action` |
| 2 | `message` |
| 3 | `meeting` |
| 4 | `evidence` |
| 5 | `execution` |
| 6 | `decision-required` |

The moment's own signal lands first so the track marker has a frame; the
decision lands last so the auto-pause happens after its context has arrived.
Pausing before the message that explains the decision would stop the day on a
question with nothing behind it.

### Language

Every row carries `title`, `titleDe`, `summary` and `summaryDe`, all non-empty,
asserted in both the integration test and the verification script. The German
frame is always German. Scenario content uses its German form where the seed
has one: `decisions.titleDe`, `meetings.titleDe` and `timeline_events.titleDe`
are fully populated. `inbox_messages.subject_de` is populated for 11 of 78 rows,
so those titles read `Nachricht: <seeded subject>`, and
`timeline_role_moments` has no German headline, so those read
`<German moment title>: <seeded headline>`. That matches the scope recorded in
`src/i18n/labels.ts`: the primary interface language is English and German
covers navigation, status and high value copy. ASCII only, `ae`, `oe`, `ue`,
`ss`.

## 2. Transport

**Server sent events, verified streaming.** No fallback was needed.

`GET /api/workday/events?roleId=<role>&lang=<en|de>&runId=<run>` publishes
`WorkdayStreamEvent` from `src/workday/contracts.ts`, unchanged. Headers are
`text/event-stream`, `no-store, no-transform`, `keep-alive` and
`x-accel-buffering: no`. A comment frame goes out immediately so nothing
buffers the connection into looking broken. Heartbeat every 15s. Hard lifetime
ceiling of 30 minutes so a forgotten tab cannot hold a connection open all day.
Teardown is registered on `request.signal` and is idempotent.

Verified with a stream opened over `fetch` against the handler, writing the run
row from another process between reads:

```
[write] 13:30   [time] 13:30
[write] 14:05   [time] 14:05
                [arrival] 14:05 shared-event WLE-TL-M08
                [arrival] 14:05 message WLE-IN-IMSG-2026-0012
                [arrival] 14:05 message WLE-IN-IMSG-2026-0013
[write] 15:00   [time] 15:00
                [arrival] 15:00 signal WLE-TL-M09
                [arrival] 15:00 meeting WLE-MT-MTG-2026-0004
                [arrival] 15:00 decision-required WLE-DE-DEC-2026-0779
STREAM OK
```

Chunked transfer, incremental frames, heartbeats, clean close on abort.

**Why the route polls the database rather than using an emitter.** Server
actions and route handlers are separate bundles here, so a module level
`EventEmitter` is not reliably the same object in both: the player would advance
the day in one instance and the channel would listen to another. The database is
the one thing both halves genuinely share. The poll is 1200ms, comfortably
inside the shortest scenario step of 1700ms, against a local SQLite file, and it
reads a cursor rather than the whole day. No real-time infrastructure dependency
was introduced.

**The cursor** is `minutes-sortOrder`, not a row count, because the integration
runtime may insert an event at a moment the day has already passed and a count
based cursor would skip it. It is sent as the SSE `id:`, so the browser's
automatic `Last-Event-ID` resume works and a laptop that sleeps mid
presentation resumes the day rather than silently stopping. Reconnection can
replay a frame, so `useScenarioEventStream` deduplicates by event id.

**Presenter safe and offline use the same client contract.** Every server action
returns a `stream: WorkdayStreamEvent[]` array. With `transport="local"` the bar
feeds that array into `publishAll`, which is the identical reducer the channel
feeds. Only the origin of the payload differs, which is acceptance criterion 57.

### One caveat on verification

The server on port 3000 is `next start` against a production build, not
`next dev`, so the new route returns 404 there until the build is refreshed
(`x-nextjs-cache: HIT`, `x-nextjs-prerender: 1`). The handler itself was
verified end to end as above, through a standalone Node server that adapts
`req`/`res` to `Request`/`Response` and pipes the body. Rebuilding or restarting
in dev mode would have clobbered the build the running servers serve, so it was
left alone. **Please re-run `curl -N http://localhost:3000/api/workday/events`
after your next `next dev` start or `next build`.**

## 3. The player state machine

Pure, in `src/scenario/engine/live-player.ts`. No database, no React. The server
actions read state, run the reducer, apply the result.

```
reducePlayer(snapshot, action, stops) -> {
  next: PlayerSnapshot,
  advanceLiveTo: string | null,
  arrivedEventIds: string[],
  pausedAtEventId: string | null,
  changed: boolean,
}
```

| Action | Effect |
|---|---|
| `play` | `playing = true`, clears `pausedByDecisionId` and `pausedReason` |
| `pause` | `playing = false`, records the reason |
| `previous` | viewed moment back one stop, `playing = false`. **Never** reports a live advance |
| `next` | viewed moment forward one stop. Does not auto-pause: a person pressing Next has asked to move on |
| `advance` | the timer step. The only action that can stop itself |
| `jump-to-live` | viewed equals live, clears the pause and any catch-up walk |
| `scrub` | to a given moment. Refused, not clamped, if that moment is after live time |
| `set-speed` | 1 or 2 only. Any other value is a no-op, not a clamp |
| `catch-up-start` | pauses the day and opens the walk at index 0 |
| `catch-up-next` | index plus one, closing itself on the last item |
| `catch-up-end` | closes the walk |

At the end of the day `advance` stops playback rather than leaving a timer
spinning against a list it cannot move through.

### Stops

`buildMomentStops(events, roleId, extraMoments)` groups the role's visible
events by moment and adds the ten seeded timeline moments as stops even where
the role has no event at one, so the Right arrow walks the structure of the day.
`stopIndexFor` resolves a moment that is not itself a stop to the last stop at
or before it, so an integration event at 14:12 does not push the player off the
end of the list.

## 4. The auto-pause rule

`autoPause` is true on exactly two kinds of row:

- every `decision-required` event whose `judgment_kind` is not `agenda`.
  An agenda choice is "which of these do I look at first", which is not a beat
  the day has to halt for.
- the single `shared-event` at 14:05.

It is false on `message`, `meeting`, `evidence`, `signal` and `agent-action`,
which is the "do not pause on routine arrivals" half of the rule. The
`escalated-to-human` background action is deliberately not a pause: it is
performed at the opening moment before the professional arrives, so pausing on
it would stop the player before anyone pressed play. The decision it points at
gets its own event, and that one does pause.

When `advance` reaches a moment carrying an auto-pause event the player moves to
that moment, sets `playing = false`, records `pausedByDecisionId` and
`pausedReason`, and reports `pausedAtEventId`. It does not roll past. `play`
clears the pause, and because the following step examines the **next** moment it
cannot re-pause in place, so resuming always moves the day. Played from 07:45
with the seeded tprm day, the player stops at 11:45, 14:05, 15:00 and 16:30 and
nowhere else. The opening moment is excluded because the player starts already
sitting on it.

## 5. Viewed time versus live time

Two columns, two facts.

- `scenario_runs.current_moment` is **live** time. Only `setMoment` changes it.
- `live_player_state.viewed_moment` is what the user is looking at.

`advanceLiveTo` is non-null only when a forward step crosses past live time.
A backwards step, and a forward step while behind, return null, so scrubbing
back never rewinds the day and catching up never pushes it forward.

`arrivedEventIds` is populated only on the same condition. Stepping forward
through moments the day has already passed is replay: nothing arrives, nothing
raises a heads-up card, nothing becomes unread. Without that split, catching up
would re-announce every event the user had just read.

Live time always moves through `setMoment` from `src/scenario/engine/state.ts`,
never through a direct write to `scenario_runs`, because `setMoment` is what
records the `sharedEventReached` audit event and sets `eventTriggered`.

`getPlayerSnapshot` clamps a viewed moment that is ahead of live time, so a row
left behind by an earlier run cannot make the interface show a moment the day has
not reached.

The bar shows one number and the word `Live` when they agree, and two numbers
with `data-behind="true"` on `.app-liveday-clock` when they do not:
`Viewing 10:30` leading, `Live at 14:05` following.

## 6. Read state

Keyed `(event_id, role_id)`, which is a unique constraint. The seed creates a
row for every applicable role of every event, so a `roleIds: []` event gets six.
A missing row counts as unread, which is how an integration event written after
the seed is not silently hidden.

**An event is unread only when it has arrived**: `at_moment` at or before live
time and no `read_at`. Counting events the day has not reached would open the
morning with a backlog of things that have not happened. The seed marks every
event at or before the run's current moment read, so the day opens at zero
unread for all six roles, asserted in both suites.

A **role switch does not touch the read table**, structurally: it changes a
column on the run row. Asserted directly (`rowCount` before and after) and
through unread counts surviving four switches.

Server functions in `src/scenario/engine/live-events.ts`:

```ts
getUnreadCount(roleId, liveMoment, runId?): number
getUnreadEvents(roleId, liveMoment, options?): WorkdayLiveEvent[]   // catch-up order
getUnreadCountsByRole(liveMoment, runId?): Record<RoleId, number>
markEventRead(eventId, roleId, runId?): void
markEventAcknowledged(eventId, roleId, runId?): void
markReviewedInCatchUp(eventId, roleId, runId?): void
markAllEventsRead(roleId, liveMoment, runId?): number               // arrived events only
getLiveEventsForRole(roleId, { language?, runId?, throughMoment? }): WorkdayLiveEvent[]
getLiveEvent(eventId, roleId, options?): WorkdayLiveEvent | null
getLiveEventMoments(runId?): string[]
getPlayerSnapshot(liveMoment, runId?): PlayerSnapshot
savePlayerSnapshot(snapshot, runId?): void
```

Pure helpers in the same module, usable without a database:
`compareLiveEvents`, `sortLiveEvents`, `arrivedBy`, `unreadEvents`,
`countUnread`, `orderForCatchUp`, `firstBlockingIndex`.

The catch-up order is chronological, never by severity: the 15:00 decision only
makes sense after the 14:05 event that caused it.

## 7. The keyboard map

| Key | Action |
|---|---|
| Space | play and pause |
| Left | previous event |
| Right | next event |
| C | catch up |
| L | jump to live |

Bound on `document` in `LiveDayBar`, guarded by `isTypingTarget` from
`src/components/workday-v2/interactive.tsx`. The guard is the point: Space is
bound to play, and a presenter typing a question into the chat composer must not
pause the day with every word. Modified keys (Ctrl, Meta, Alt) are left to the
browser. The map is also available pure as
`resolveLiveDayShortcut({ key, typing, ctrlKey?, metaKey?, altKey? })`, which is
what the unit test exercises with a typing target.

**Shell: do not bind Space, Left, Right, C or L.** If you need one of them, tell
me and I will move.

## 8. Wiring the bar in

### The seed line you need to add

In `src/db/seed/run.ts`, add the import beside the other seed imports:

```ts
import { seedLiveEvents } from "@/scenario/live-event-seed";
```

and the call immediately after `writeEverything();` on line 337, before the
`return`:

```ts
  seedLiveEvents(runId);
```

It must be after `writeEverything()` because it opens its own transaction and
reads the rows that transaction writes. Putting it inside `seedScenario` covers
the reset path too: `resetScenarioDay` in `src/scenario/engine/reset.ts` calls
`seedScenario`.

Until that line exists, seed the live day with:

```
npx tsx scripts/verify-live-day.ts --seed-current
```

which is idempotent, clears and rewrites only `workday_live_events`,
`workday_live_event_reads` and `live_player_state` for the run, and touches
nothing else. It has already been run against `data/nfr-workos.db`, so the
developer database is populated.

### The server component

```tsx
import { actionLiveDaySnapshot } from "@/scenario/live-actions";
import { LiveDayBar } from "@/components/live-day/LiveDayBar";

const live = await actionLiveDaySnapshot();

// Third row of the .workday-v2 grid, which already reserves --app-liveday-h.
<LiveDayBar
  roleId={live.roleId}
  language={live.language}
  player={live.player}
  events={live.events}
  dayMoments={live.dayMoments}
  unreadCount={live.unreadCount}
  transport={demoMode === "live" ? "stream" : "local"}
  onOpenEvent={(event) => { /* navigate to event.objectType / event.objectId */ }}
  onStreamEvent={(payload) => { /* forward to the partner and focus queue */ }}
/>
```

`LiveDayBar` renders `.app-liveday` plus two fixed position siblings, the
heads-up stack and the catch-up drawer, so it returns a fragment. Put it in the
third grid row; the extra siblings position themselves.

`actionLiveDaySnapshot()` returns:

```ts
interface LiveDaySnapshot {
  roleId: RoleId;
  language: "en" | "de";
  player: LivePlayerView;
  events: WorkdayLiveEvent[];
  dayMoments: string[];
  unreadCount: number;
}
```

Re-read it and pass the new object whenever the acting role or the language
changes. The bar keys its internal reset on `roleId` and adopts the new player
view; it does not reset read state, which lives in the database.

### Props

```ts
interface LiveDayBarProps {
  roleId: RoleId;
  language: "en" | "de";
  player: LivePlayerView;        // from actionLiveDaySnapshot
  events: WorkdayLiveEvent[];    // from actionLiveDaySnapshot
  dayMoments: string[];          // from actionLiveDaySnapshot
  unreadCount: number;           // from actionLiveDaySnapshot
  transport?: "stream" | "local";                     // default "stream"
  onOpenEvent?: (event: WorkdayLiveEvent) => void;    // you own navigation
  onStreamEvent?: (payload: WorkdayStreamEvent) => void;
}
```

`onStreamEvent` fires for every payload on the channel, including the partner,
approval, mutation and integration kinds the live day does not consume. That is
the hook for the other agents: one connection, one contract.

The four sub-components are exported individually if you need them elsewhere:
`PlayPauseButton`, `EventTrack`, `CatchUpButton`, `NewEventToast`,
`GuidedCatchUp`. They are all presentational plus callbacks.

### Server action signatures

All from `src/scenario/live-actions.ts`, all `async`, none taking a role: the
acting role comes from the run row, so a client cannot read another function's
unread events or move the day on its behalf.

```ts
// Player. Each returns the new view, the new unread count and the payloads
// the channel would have published.
actionReadPlayer(): Promise<LiveDayActionResult>
actionPlay(): Promise<LiveDayActionResult>
actionPause(reason?: string): Promise<LiveDayActionResult>
actionStepPrevious(): Promise<LiveDayActionResult>
actionStepNext(): Promise<LiveDayActionResult>
actionAdvance(): Promise<LiveDayActionResult>          // the timer step
actionJumpToLive(): Promise<LiveDayActionResult>
actionScrubToMoment(moment: string): Promise<LiveDayActionResult>
actionSetSpeed(speed: number): Promise<LiveDayActionResult>   // 1 or 2

// Catch up.
actionStartCatchUp(): Promise<CatchUpState>
actionCatchUpNext(reviewedEventId?: string): Promise<CatchUpState>
actionEndCatchUp(): Promise<CatchUpState>

// Read state.
actionMarkEventRead(eventId: string): Promise<LiveDayActionResult>
actionAcknowledgeEvent(eventId: string): Promise<LiveDayActionResult>
actionMarkAllEventsRead(): Promise<LiveDayActionResult>

// Initial payload.
actionLiveDaySnapshot(): Promise<LiveDaySnapshot>

interface LiveDayActionResult {
  player: LivePlayerView;
  unreadCount: number;
  stream: WorkdayStreamEvent[];
  pausedAtEventId: string | null;
}

interface CatchUpState {
  active: boolean;
  index: number;
  total: number;
  queue: WorkdayLiveEvent[];
  blocked: boolean;              // the walk has reached a material decision
  player: LivePlayerView;
}

interface LivePlayerView {
  playing: boolean;
  speed: 1 | 2;
  viewedMoment: string;
  liveMoment: string;
  pausedByDecisionId: string | null;
  pausedReason: string;
  catchUpActive: boolean;
  catchUpIndex: number;
  behind: boolean;
  atDayEnd: boolean;
  progress: number;              // zero to one
}
```

`revalidatePath("/workday", "layout")` and `revalidatePath("/control-room")` are
called **only** when live time actually moved, which is about ten times across a
whole played day. Viewed time and read state are rendered from the action result
on the client, so stepping back or marking read does not re-render your server
tree.

## 9. Accessibility

- Arrivals are announced through one polite `Announcer` live region in the bar.
  Assertive is used only for a critical arrival that requires a decision, which
  in this day is the 14:05 event and the decisions that follow it.
- **Focus is never moved for an arrival**, critical or not.
- `PlayPauseButton` carries `aria-pressed` and an accessible label that changes
  between Play and Pause. The icon is `aria-hidden`.
- Every track marker is a `<button>` with a name that reads the moment, the
  count, the unread count and the leading event: `14:05, 4 events, 3 unread.
  Shared event: Shared supplier and payments event.` Markers after live time are
  present but `disabled`.
- Exactly one marker state attribute is set per marker. The stylesheet orders
  its rules unread, decision, shared, current, past, so later rules win; setting
  several attributes would let `data-past` override `data-current`.
- `GuidedCatchUp` uses the `Drawer` primitive, which traps Tab, closes on
  Escape and returns focus to the trigger, so the walk is completable with the
  keyboard alone. It is the one live day surface allowed to be modal: the user
  asked to be walked through a backlog. The heads-up cards, which arrive
  uninvited, are never modal.
- `CatchUpButton` is keyed on the unread count so React remounts it and the
  single `app-attention-once` animation plays once per change. No loop, no
  stylesheet edit.
- Reduced motion is handled in the stylesheet already; the player still
  advances, because advancing is the scenario moving and not an animation.

## 10. Acceptance criteria

| Criterion | What satisfies it |
|---|---|
| 23 Normalised event model over the seeded day | `workday_live_events` projected from five seeded sources with `derivedFrom` and `derivedFromId` on every row, resolved in the integration test. 78 events, no second scenario |
| 24 Event stream over one contract | `GET /api/workday/events` publishing `WorkdayStreamEvent` unchanged, verified streaming with heartbeat, cursor resume and clean teardown |
| 25 Play and pause | `PlayPauseButton`, Space, `actionPlay` and `actionPause`, state persisted in `live_player_state` |
| 26 Event track with marker states | `EventTrack`, one button per moment, the five styled states, keyboard reachable, `.app-track-progress` driven by the viewed moment |
| 27 Unread state per role | `workday_live_event_reads` keyed `(event, role)`, unread only once arrived, count in the bar, zero at open for all six roles |
| 28 Automatic pause at human decisions | Section 4 above. `autoPause` on material decisions and 14:05 only. Verified in unit, integration and the script: stops at 11:45, 14:05, 15:00, 16:30 and nowhere else |
| 29 Guided catch-up and the announced toggle | `GuidedCatchUp` with chronological order, automatic actions shown, a stop at material decisions, "You are caught up" on completion. `aria-pressed` plus a changing label on the play control |
| 30 Jump to live | `actionJumpToLive`, the `L` shortcut, the button shown only when behind, viewed realigned to live and the pause cleared |
| 31 The shared event propagates across roles | One `shared-event` row with `roleIds: []`, severity `critical`, `autoPause` true. Served to all six roles, with a read row per role so it is unread per function, and a stop for every role |
| 32 A role switch preserves unread state | Structural: the switch changes a column on the run row and does not touch `workday_live_event_reads`. Asserted by row count and by unread counts surviving four switches, with the shared event still present for all six |
| 57 One client contract across the three modes | Every action returns `stream: WorkdayStreamEvent[]`; `transport="local"` feeds it into the same reducer the channel feeds |

The numbering for 23 to 27 and 30 is matched to the live day section of the
brief. 28, 29, 31, 32 and 57 are the ones the brief states by number, and the
evidence for those is listed above.

## 11. Verification

```
npx tsc --noEmit                            clean
npm run check:copy                          passes
npx vitest run tests/unit/live-day.test.ts            48 passed
npx vitest run tests/integration/live-day-flows.test.ts  34 passed
npx tsx scripts/verify-live-day.ts           62 checks, 0 failed, exit 0
```

`scripts/verify-live-day.ts` builds a throwaway database in the system temporary
directory, with a guard that refuses any path inside the repository, so it never
opens the developer database. `--seed-current` is the standalone seed runner for
the configured database.

## 12. Known limitations

1. The event channel polls the database every 1200ms rather than being pushed
   to. Within one process and one presenter this is not observable; it would be
   the wrong design for many clients.
2. Inbox titles and role moment titles carry the seeded English content inside a
   German frame, because `inbox_messages.subject_de` is populated for 11 of 78
   rows and `timeline_role_moments` has no German headline. Decision, meeting
   and timeline titles are fully German.
3. The projection is a capped sample, not every candidate row. The caps are in
   the table in section 1 and are asserted, so the sample is reproducible, but
   a reviewer looking for a specific inbox message on the track may not find it.
4. `app/api/workday/events/route.ts` was verified through a standalone Node
   server, not through the Next router, because port 3000 is serving a
   production build. See the caveat in section 2.
5. `src/db/seed/run.ts` is not wired yet. Section 8 has the two lines.

## 13. There are currently two live day bars

`src/components/workday-v2/LiveDayBar.tsx` and
`src/components/workday-v2/LiveDaySlot.tsx` are a second, simpler
implementation that grew up in parallel. It reads my projection tables
directly and drives the clock with `actionSetMoment` from `app/actions.ts`.
Shell owns those two files, so they have been left alone, but they should not
both ship: `.app-liveday` would render twice in the same grid row.

What the shell version does not have, and what the brief asks for:

- the event channel, so nothing arrives unless the server tree re-renders
- heads-up cards on arrival (`NewEventToast`)
- the guided catch-up walk (`GuidedCatchUp`), so Catch up has nowhere to go
- per-event read marking, so the unread count only ever goes down by a reseed
- `live_player_state`, so viewed time is not persisted and a reload loses the
  user's position
- auto-pause driven by the projection's `auto_pause` column. It infers a
  decision moment from `requires_decision`, which marks the 07:45 morning brief
  and would stop the player before it started, and does not stop at 14:05
  unless a decision happens to sit there
- `actionSetMoment` moves **live** time for every backwards step, so scrubbing
  back to show the morning rewinds the day for the whole scenario. That is the
  distinction section 5 exists to hold

Suggested migration, which is small: keep `LiveDaySlot` as the seam and replace
its body with

```tsx
import { actionLiveDaySnapshot } from "@/scenario/live-actions";
import { LiveDayBar } from "@/components/live-day/LiveDayBar";

export async function LiveDaySlot() {
  const live = await actionLiveDaySnapshot();
  return (
    <LiveDayBar
      roleId={live.roleId}
      language={live.language}
      player={live.player}
      events={live.events}
      dayMoments={live.dayMoments}
      unreadCount={live.unreadCount}
    />
  );
}
```

then delete `src/components/workday-v2/LiveDayBar.tsx`. The `roleId`,
`language` and `state` props become unnecessary because the snapshot reads the
run row itself, which is also what stops a client asserting a role it is not.
`src/components/workday-v2/viewed-moment.ts` is superseded by
`live_player_state.viewed_moment`.

If you would rather keep the shell version, say so and I will fold the channel,
the cards, the walk and the read marking into it instead. What must not happen
is both, or the brief's auto-pause and viewed-time criteria going unmet because
the simpler bar is the one that renders.

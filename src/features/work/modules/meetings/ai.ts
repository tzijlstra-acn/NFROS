/**
 * The AI layer of the meeting lifecycle: which mode prepared an output, and
 * whether it may be shown.
 *
 * Server only. The same branch the process engine runs for a stage
 * preparation (`src/features/process/preparation.ts`), narrowed to what a
 * meeting needs:
 *
 *   safe     serves the validated output captured before the day, from
 *            `cached_ai_outputs`, but only while the records it was captured
 *            from are unchanged (a digest over them); otherwise it composes
 *            and says why.
 *   offline  composes from the records as they are now (`compose.ts`).
 *   live     is not connected for meetings. No model is ever called from
 *            here; a live configuration is served as safe, and the note says
 *            so rather than letting the label claim a live output.
 *
 * Every output, whichever branch produced it, passes the validator in
 * `ai-schema.ts`. An output that does not validate is never shown: the
 * branch falls through to composition, and a composition that does not
 * validate is reported as unavailable.
 */

import { createHash } from "node:crypto";
import { getDb } from "@/db/client";
import type { RoleId } from "@/db/schema/core";
import { cachedAiOutputs } from "@/db/schema/decisions";
import { getCachedOutput, type MeetingTurnRow } from "@/db/repositories/meetings";
import { getResolvedDemoMode } from "@/server/config/runtime";
import type { Language } from "@/i18n/labels";
import type { Pair } from "../../copy";
import type { MeetingRow } from "../../shared";
import {
  validateMeetingPreparation,
  validateMinutesDraft,
  type MeetingPreparationOutput,
  type MinutesDraft,
  type MinutesValidationContext,
} from "./ai-schema";
import { composeMeetingPreparation, composeMinutesDraft, type MinutesComposeInput, type PreparationInput } from "./compose";
import { LIFECYCLE_COPY as L } from "./copy";
import type { PreparationResult } from "./lifecycle";

export type MeetingAiMode = "safe" | "offline";

/** sha256 over a canonical JSON form, truncated, the same width as the process engine's digests. */
export function digestOf(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex").slice(0, 32);
}

function canonical(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, child]) => child !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([name, child]) => `${JSON.stringify(name)}:${canonical(child)}`).join(",")}}`;
}

/** The mode the lifecycle runs in. Live is served as safe: no model is called for meetings. */
export function meetingAiMode(): { mode: MeetingAiMode; live: boolean } {
  const resolved = getResolvedDemoMode().mode;
  return { mode: resolved === "offline" ? "offline" : "safe", live: resolved === "live" };
}

/* ==========================================================================
   Before the meeting
   ========================================================================== */

export function preparationBeatKey(meetingId: string): string {
  return `meeting-preparation:${meetingId}`;
}

/** What the preparation was composed from. A change in any of it invalidates the safe cache. */
export function preparationDigest(input: PreparationInput): string {
  return digestOf({
    meeting: [input.meeting.id, input.meeting.objective, input.meeting.preparationSummary, input.meeting.preparedQuestions, input.meeting.evidenceDocumentIds],
    pack: [...input.pack.values()].map((doc) => [doc.id, doc.status, doc.isStale]).sort(),
    decisions: input.openDecisions.map((decision) => [decision.id, decision.status]).sort(),
    criteria: input.stageCriteria.map((criterion) => criterion.en),
    contradictions: input.contradictions.map((item) => item.id).sort(),
    dueBefore: input.dueBefore.map((action) => [action.id, action.status, action.dueOn]).sort(),
  });
}

export function prepareMeeting(input: PreparationInput, knownEvidenceIds: ReadonlySet<string>, runId?: string): PreparationResult {
  const { mode, live } = meetingAiMode();
  const notes: Pair[] = [];
  if (live) notes.push(L.prepLive);

  if (mode === "safe") {
    const cached = getCachedOutput(preparationBeatKey(input.meeting.id), runId);
    const payload = cached?.payload as { output?: unknown; sourceDigest?: unknown } | undefined;
    if (payload && payload.sourceDigest === preparationDigest(input)) {
      const validation = validateMeetingPreparation(payload.output, { knownEvidenceIds });
      if (validation.ok) return { output: validation.output, mode: "safe", note: notes[0] ?? L.prepSafeNote };
      notes.push(L.prepChanged);
    } else {
      notes.push(cached ? L.prepChanged : L.prepNoCache);
    }
  }

  const validation = validateMeetingPreparation(composeMeetingPreparation(input), { knownEvidenceIds });
  if (validation.ok) {
    return { output: validation.output, mode: "offline", note: notes.length > 0 ? (notes[notes.length - 1] ?? L.prepOfflineNote) : L.prepOfflineNote };
  }
  return { output: null, mode: "unavailable", note: L.prepFailed };
}

/**
 * Captures the validated preparation of the seeded day into the safe cache.
 * Called by the seed only. Refuses to cache what does not validate, so safe
 * mode can never serve something offline mode would reject.
 */
export function captureMeetingPreparation(
  input: PreparationInput,
  knownEvidenceIds: ReadonlySet<string>,
  context: { runId: string; roleId: RoleId; capturedAt: string },
): void {
  const validation = validateMeetingPreparation(composeMeetingPreparation(input), { knownEvidenceIds });
  if (!validation.ok) {
    throw new Error(
      `The seeded preparation of ${input.meeting.id} does not validate: ${validation.failures.map((failure) => `${failure.path} ${failure.message.en}`).join("; ")}`,
    );
  }
  writeCache(preparationBeatKey(input.meeting.id), "meeting-preparation-v1", { output: validation.output, sourceDigest: preparationDigest(input) }, context);
}

/* ==========================================================================
   After the meeting
   ========================================================================== */

export function minutesBeatKey(meetingId: string): string {
  return `meeting-minutes:${meetingId}`;
}

/** What a minutes draft was composed from: the turns heard, as recorded. */
export function transcriptDigest(meetingId: string, turns: readonly MeetingTurnRow[]): string {
  return digestOf({ meetingId, turns: turns.map((turn) => [turn.id, turn.content, turn.contradictsEvidenceId]) });
}

export interface DraftResult {
  draft: MinutesDraft | null;
  mode: MeetingAiMode;
  note: Pair;
}

/**
 * The AI's minutes draft for the turns heard so far.
 *
 * In safe mode the captured draft is served when it was captured from
 * exactly these turns and still validates against what the role can see
 * now (a decision presented later in the day is not citable before it is
 * presented); otherwise the draft is composed from the turns.
 */
export function draftMinutes(
  input: MinutesComposeInput,
  validation: MinutesValidationContext,
  runId?: string,
): DraftResult {
  const { mode, live } = meetingAiMode();
  const notes: Pair[] = live ? [L.prepLive] : [];

  if (mode === "safe") {
    const cached = getCachedOutput(minutesBeatKey(input.meeting.id), runId);
    const payload = cached?.payload as { output?: Partial<Record<Language, unknown>>; sourceDigest?: unknown } | undefined;
    if (payload && payload.sourceDigest === transcriptDigest(input.meeting.id, input.turns)) {
      const candidate = payload.output?.[input.language];
      const checked = validateMinutesDraft(candidate, { ...validation, author: "ai" });
      if (checked.ok) return { draft: checked.output, mode: "safe", note: notes[0] ?? L.prepSafeNote };
      notes.push(L.prepChanged);
    } else {
      notes.push(cached ? L.prepChanged : L.prepNoCache);
    }
  }

  const checked = validateMinutesDraft(composeMinutesDraft(input), { ...validation, author: "ai" });
  if (checked.ok) return { draft: checked.output, mode: "offline", note: notes[notes.length - 1] ?? L.prepOfflineNote };
  return { draft: null, mode: "offline", note: L.prepFailed };
}

/**
 * Captures an authored, validated minutes draft for a seeded meeting into
 * the safe cache, in both languages, keyed to the meeting's full recorded
 * conversation. Called by the seed only, with the same refusal as above.
 */
export function captureMinutesDraft(
  meeting: Pick<MeetingRow, "id">,
  turns: readonly MeetingTurnRow[],
  drafts: Record<Language, MinutesDraft>,
  validation: MinutesValidationContext,
  context: { runId: string; roleId: RoleId; capturedAt: string },
): void {
  for (const language of ["en", "de"] as const) {
    const checked = validateMinutesDraft(drafts[language], { ...validation, author: "ai" });
    if (!checked.ok) {
      throw new Error(
        `The seeded ${language} minutes draft of ${meeting.id} does not validate: ${checked.failures.map((failure) => `${failure.path} ${failure.message.en}`).join("; ")}`,
      );
    }
  }
  writeCache(minutesBeatKey(meeting.id), "meeting-minutes-draft-v1", { output: drafts, sourceDigest: transcriptDigest(meeting.id, turns) }, context);
}

function writeCache(
  beatKey: string,
  schemaName: string,
  payload: Record<string, unknown>,
  context: { runId: string; roleId: RoleId; capturedAt: string },
): void {
  getDb()
    .insert(cachedAiOutputs)
    .values({
      id: `CACHE-${beatKey}`,
      runId: context.runId,
      beatKey,
      roleId: context.roleId,
      schemaName,
      payload,
      capturedFromModel: null,
      capturedAt: context.capturedAt,
      seeded: true,
      simulatedLatencyMs: 0,
    })
    .run();
}

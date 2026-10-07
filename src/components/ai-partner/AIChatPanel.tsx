"use client";

/**
 * The persistent contextual chat.
 *
 * Available on every workday route without navigating away, which is the
 * point: the previous layer put the conversation on its own page, so asking
 * "why does this matter" meant leaving the thing it was about.
 *
 * Three properties are load bearing and each one is here because losing it
 * breaks a specific promise.
 *
 * The thread survives navigation. State lives in the dock through
 * `useWorkdayChat`, so moving between a supplier and a control keeps the
 * conversation and the half typed draft. Each turn records the object it was
 * asked about, and the user can pin an earlier object or return to the
 * current one.
 *
 * An answer is never an action. A partner turn is a list of typed parts, and
 * an approval request inside one renders an Approve control that calls back
 * to the decision surface. Nothing in this file executes anything.
 *
 * Arrival is announced once. The live region carries a short status and the
 * moment, never the response text, because a region holding the answer
 * re-announces the whole thing on every update and makes the panel unusable
 * with a screen reader.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { IconMessagePlus, IconArrowBackUp } from "@tabler/icons-react";
import type { RoleId } from "@/db/schema/core";
import type { Language } from "@/i18n/labels";
import type {
  ExecutionReceiptLineView,
  WorkdaySelection,
} from "@/workday/contracts";
import { Announcer } from "@/components/workday-v2/interactive";
import { Chip, Data, Empty, Notice } from "@/components/workday-v2/primitives";
import {
  AIResponseParts,
  toResponsePart,
  type AIResponsePartView,
} from "./AIResponseParts";
import { partnerLabel } from "./labels";
import type { DemoMode } from "./AIPartnerHeader";
import { AIFeedbackControl, type FeedbackHandler } from "./AIFeedbackControl";
import type { PartnerContextView } from "@/features/partner/context";

/* ==========================================================================
   The view model
   ========================================================================== */

export interface ChatTurnView {
  id: string;
  author: "user" | "partner";
  parts: AIResponsePartView[];
  /** Plain text, used for the user side where parts would be overkill. */
  text: string;
  atMoment: string;
  contextObjectId: string;
  contextLabel: string;
  /**
   * The full selection this turn was asked about, when it is known.
   *
   * Null for a turn restored from the server, which carries the object id but
   * not its canonical type. Pinning needs the type to be real, so the pin
   * control appears only where this is set rather than guessing a type and
   * sending the wrong selection back to the route.
   */
  contextSelection: WorkdaySelection | null;
  source: "live" | "cache" | "seeded" | null;
  /** True while this user turn is waiting for its answer. */
  pending: boolean;
  /** True when the request did not produce an answer. */
  failed: boolean;
}

export interface WorkdayChatState {
  threadId: string | null;
  turns: ChatTurnView[];
  draft: string;
  busy: boolean;
  error: string | null;
  blocked: string | null;
  announcement: string;
  /** The object the next question will be asked about. */
  effectiveSelection: WorkdaySelection | null;
  pinnedSelection: WorkdaySelection | null;
  setDraft: (value: string) => void;
  send: (input: string) => void;
  newThread: () => void;
  pinSelection: (selection: WorkdaySelection | null) => void;
}

interface ChatRoute {
  /** Overridable so a test or a preview can point at a stub. */
  post?: string;
  get?: string;
}

export interface UseWorkdayChatOptions {
  roleId: RoleId;
  selection: WorkdaySelection | null;
  language: Language;
  /** Restored on mount when the shell knows which thread was open. */
  initialThreadId?: string | null;
  /** Blocks sending, for example in offline mode. */
  disabled?: boolean;
  routes?: ChatRoute;
}

function partsFromUnknown(value: unknown): AIResponsePartView[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((part) => toResponsePart(part))
    .filter((part): part is AIResponsePartView => part !== null);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asSource(value: unknown): "live" | "cache" | "seeded" | null {
  return value === "live" || value === "cache" || value === "seeded" ? value : null;
}

/**
 * Turns an unvalidated route payload into a turn.
 *
 * The chat route is owned by another agent, so this parses defensively rather
 * than casting. A malformed payload becomes a failed turn with a plain
 * message, never a crashed panel: the chat sits on every workday route, and a
 * thrown error here would take the whole day down with it.
 */
function turnFromPayload(value: unknown, fallbackId: string): ChatTurnView | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  const parts = partsFromUnknown(row["parts"]);
  const text = parts.find((part) => part.kind === "answer")?.text ?? "";
  return {
    id: asString(row["id"], fallbackId),
    author: row["author"] === "user" ? "user" : "partner",
    parts,
    text,
    atMoment: asString(row["atMoment"]),
    contextObjectId: asString(row["contextObjectId"]),
    contextLabel: asString(row["contextLabel"]),
    contextSelection: null,
    source: asSource(row["source"]),
    pending: false,
    failed: false,
  };
}

/* ==========================================================================
   The hook
   ========================================================================== */

/**
 * Owns the conversation.
 *
 * Called by the dock rather than by the panel, so the state outlives a tab
 * change and a collapse to the presence rail. The panel is a rendering of
 * this state and holds nothing of its own.
 */
export function useWorkdayChat(options: UseWorkdayChatOptions): WorkdayChatState {
  const { roleId, selection, language, initialThreadId = null, disabled = false } = options;
  const postUrl = options.routes?.post ?? "/api/workday/chat";
  const getUrl = options.routes?.get ?? "/api/workday/chat/thread";

  const [threadId, setThreadId] = useState<string | null>(initialThreadId);
  const [turns, setTurns] = useState<ChatTurnView[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [pinnedSelection, setPinnedSelection] = useState<WorkdaySelection | null>(null);

  const localId = useRef(0);
  /*
   * Generation counter.
   *
   * Starting a new thread while an answer is in flight must not let the old
   * answer land in the new thread. Each reset bumps this, and a response from
   * an earlier generation is dropped.
   */
  const generation = useRef(0);
  /*
   * The latest selection, read at send time rather than captured.
   *
   * Written in an effect rather than during render, so a double render in
   * strict mode cannot observe a half updated ref. `send` reads these rather
   * than closing over the props, which is what lets a question typed before
   * a navigation still be asked about the object the user is now looking at.
   */
  const selectionRef = useRef<WorkdaySelection | null>(selection);
  const pinnedRef = useRef<WorkdaySelection | null>(pinnedSelection);

  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  useEffect(() => {
    pinnedRef.current = pinnedSelection;
  }, [pinnedSelection]);

  const effectiveSelection = pinnedSelection ?? selection;

  /* ---- restore an existing thread ---- */
  useEffect(() => {
    if (!initialThreadId) return;
    const current = generation.current;
    const query = new URLSearchParams({ roleId, threadId: initialThreadId });

    void (async () => {
      try {
        const response = await fetch(`${getUrl}?${query.toString()}`, {
          headers: { accept: "application/json" },
        });
        if (!response.ok) return;
        const body: unknown = await response.json();
        if (generation.current !== current) return;
        if (typeof body !== "object" || body === null) return;
        const rows = (body as Record<string, unknown>)["turns"];
        if (!Array.isArray(rows)) return;
        const restored = rows
          .map((row, index) => turnFromPayload(row, `restored-${index}`))
          .filter((turn): turn is ChatTurnView => turn !== null);
        /*
         * Restoring is for a transcript that is empty, after a reload. When
         * the thread identifier arrives while a conversation is already on
         * screen (the dock re-reads its data after the first answer created
         * the thread), replacing or appending would show the question and
         * the answer twice (audit J26), so the screen is kept.
         */
        setTurns((existing) => (existing.length > 0 ? existing : restored));
      } catch {
        // A failed restore leaves an empty thread, which is honest and usable.
      }
    })();
  }, [initialThreadId, roleId, getUrl]);

  const send = useCallback(
    (input: string) => {
      const trimmed = input.trim();
      if (trimmed.length === 0 || busy || disabled) return;

      const current = generation.current;
      localId.current += 1;
      const userTurnId = `local-${localId.current}`;
      const askedAbout = pinnedRef.current ?? selectionRef.current;

      setTurns((existing) => [
        ...existing,
        {
          id: userTurnId,
          author: "user",
          parts: [],
          text: trimmed,
          atMoment: "",
          contextObjectId: askedAbout?.objectId ?? "",
          contextLabel: askedAbout?.label ?? "",
          contextSelection: askedAbout,
          source: null,
          pending: true,
          failed: false,
        },
      ]);
      setDraft("");
      setBusy(true);
      setError(null);
      setBlocked(null);

      void (async () => {
        try {
          const response = await fetch(postUrl, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              roleId,
              ...(threadId ? { threadId } : {}),
              input: trimmed,
              ...(askedAbout ? { selection: askedAbout } : {}),
            }),
          });

          const body: unknown = response.ok ? await response.json() : null;
          if (generation.current !== current) return;

          const row = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
          const partnerTurn = row ? turnFromPayload(row["turn"], `answer-${localId.current}`) : null;

          if (!partnerTurn) {
            setTurns((existing) =>
              existing.map((turn) =>
                turn.id === userTurnId ? { ...turn, pending: false, failed: true } : turn,
              ),
            );
            setError(partnerLabel("chatFailed", language));
            return;
          }

          const nextThreadId = asString(row?.["threadId"], threadId ?? "");
          if (nextThreadId) setThreadId(nextThreadId);

          setTurns((existing) => [
            ...existing.map((turn) =>
              turn.id === userTurnId ? { ...turn, pending: false } : turn,
            ),
            // Never twice: a restore that raced this answer may already hold it.
            ...(existing.some((turn) => turn.id === partnerTurn.id) ? [] : [partnerTurn]),
          ]);

          const blockedReason = row?.["blocked"];
          if (typeof blockedReason === "string" && blockedReason.length > 0) {
            setBlocked(blockedReason);
          }

          /*
           * One short announcement carrying the moment.
           *
           * The moment makes consecutive answers distinguishable to a screen
           * reader without putting the response text in a live region, which
           * is what causes the whole answer to be read again on every change.
           */
          setAnnouncement(
            `${partnerLabel("chatAnswerReady", language)} ${partnerTurn.atMoment}`.trim(),
          );
        } catch {
          if (generation.current !== current) return;
          setTurns((existing) =>
            existing.map((turn) =>
              turn.id === userTurnId ? { ...turn, pending: false, failed: true } : turn,
            ),
          );
          setError(partnerLabel("chatFailed", language));
        } finally {
          if (generation.current === current) setBusy(false);
        }
      })();
    },
    [busy, disabled, language, postUrl, roleId, threadId],
  );

  const newThread = useCallback(() => {
    generation.current += 1;
    setThreadId(null);
    setTurns([]);
    setDraft("");
    setBusy(false);
    setError(null);
    setBlocked(null);
    setAnnouncement("");
    setPinnedSelection(null);
  }, []);

  return {
    threadId,
    turns,
    draft,
    busy,
    error,
    blocked,
    announcement,
    effectiveSelection,
    pinnedSelection,
    setDraft,
    send,
    newThread,
    pinSelection: setPinnedSelection,
  };
}

/* ==========================================================================
   The panel
   ========================================================================== */

const SOURCE_KEYS: Record<"live" | "cache" | "seeded", string> = {
  live: "sourceLive",
  cache: "sourceCache",
  seeded: "sourceSeeded",
};

const MODE_KEYS: Record<DemoMode, string> = {
  live: "modeLive",
  safe: "modeSafe",
  offline: "modeOffline",
};

export interface AIChatPanelProps {
  chat: WorkdayChatState;
  language: Language;
  /** What the centre workspace has selected right now. */
  selection: WorkdaySelection | null;
  demoMode: DemoMode;
  onOpenEvidence?: (evidenceId: string) => void;
  onApprove?: (input: { decisionId: string | null; text: string }) => void;
  onOpenAudit?: (auditEventId: string) => void;
  /** Receipt lines for a receipt part that arrived without them inline. */
  receiptLines?: ExecutionReceiptLineView[];
  /** The durable working context the Partner keeps outside the transcript. */
  workingContext?: PartnerContextView | null;
  feedback?: Readonly<Record<string, readonly string[]>>;
  onFeedback?: FeedbackHandler;
}

export function AIChatPanel({
  chat,
  language,
  selection,
  demoMode,
  onOpenEvidence,
  onApprove,
  onOpenAudit,
  receiptLines = [],
  workingContext = null,
  feedback = {},
  onFeedback,
}: AIChatPanelProps) {
  const pinnedElsewhere =
    chat.pinnedSelection !== null && chat.pinnedSelection.objectId !== (selection?.objectId ?? "");

  /*
   * What the next question is about. The live selection first; with none on
   * screen, the object the durable context holds, so a question asked after
   * navigating away is still about the work the person left.
   */
  const contextLabel = chat.effectiveSelection
    ? `${partnerLabel("chatAskingAbout", language)} ${chat.effectiveSelection.label}`
    : workingContext?.selected
      ? `${partnerLabel("chatAskingAbout", language)} ${workingContext.selected.label}`
      : partnerLabel("chatNoSelection", language);

  const contextFacts = workingContext
    ? [
        workingContext.entityLabel,
        workingContext.stage ? `${partnerLabel("contextStage", language)}: ${workingContext.stage.label}` : null,
        workingContext.meetingId,
        workingContext.actionId,
        workingContext.inboxMessageId,
        workingContext.decisionId,
        workingContext.sources.current + workingContext.sources.stale + workingContext.sources.unavailable > 0
          ? `${partnerLabel("contextSources", language)}: ${partnerLabel("contextSourcesValue", language)
              .replace("{current}", String(workingContext.sources.current))
              .replace("{stale}", String(workingContext.sources.stale))
              .replace("{unavailable}", String(workingContext.sources.unavailable))}`
          : null,
        workingContext.priorDecisionIds.length > 0
          ? `${partnerLabel("contextPrior", language)}: ${workingContext.priorDecisionIds.join(", ")}`
          : null,
        workingContext.userEditCount > 0 ? `${partnerLabel("contextEdits", language)}: ${workingContext.userEditCount}` : null,
      ].filter((fact): fact is string => typeof fact === "string" && fact.length > 0)
    : [];

  return (
    <div className="app-chat">
      {/* ---- what the next question is about, and the mode it runs in ---- */}
      <div className="app-row app-row-wrap app-between">
        <span className="app-meta app-truncate">{contextLabel}</span>
        <span className="app-row" style={{ gap: "var(--app-1)" }}>
          <span className="app-faint" style={{ fontSize: "var(--app-text-2xs)" }}>
            {partnerLabel(MODE_KEYS[demoMode], language)}
          </span>
          {pinnedElsewhere ? (
            <button
              type="button"
              className="app-btn app-btn-quiet app-btn-sm"
              onClick={() => chat.pinSelection(null)}
            >
              <IconArrowBackUp size={12} stroke={2} aria-hidden="true" />
              {partnerLabel("chatReturnToContext", language)}
            </button>
          ) : null}
          {chat.turns.length > 0 ? (
            <button
              type="button"
              className="app-btn app-btn-quiet app-btn-sm"
              onClick={chat.newThread}
            >
              <IconMessagePlus size={12} stroke={2} aria-hidden="true" />
              {partnerLabel("chatNewThread", language)}
            </button>
          ) : null}
        </span>
      </div>

      {contextFacts.length > 0 ? (
        <span
          className="app-faint"
          data-partner-context-version={workingContext?.version ?? 0}
          title={partnerLabel("contextTitle", language)}
          style={{ fontSize: "var(--app-text-2xs)", overflowWrap: "anywhere" }}
        >
          {partnerLabel("contextTitle", language)}: {contextFacts.join(", ")}
        </span>
      ) : null}

      {chat.turns.length === 0 ? (
        <Empty
          title={partnerLabel("chatEmptyTitle", language)}
          detail={partnerLabel("chatEmptyDetail", language)}
        />
      ) : null}

      {chat.turns.map((turn) =>
        turn.author === "user" ? (
          <div className="app-chat-turn" data-author="user" key={turn.id}>
            <span className="app-chat-user-bubble">{turn.text}</span>
            <span className="app-row" style={{ gap: "var(--app-1)" }}>
              {turn.contextSelection ? (
                <button
                  type="button"
                  className="app-prompt-chip"
                  title={partnerLabel("chatAskingAbout", language)}
                  onClick={() => chat.pinSelection(turn.contextSelection)}
                >
                  <Data>{turn.contextObjectId}</Data>
                </button>
              ) : turn.contextObjectId ? (
                <Data>{turn.contextObjectId}</Data>
              ) : null}
              {turn.pending ? (
                <span className="app-faint" style={{ fontSize: "var(--app-text-2xs)" }}>
                  {partnerLabel("chatPreparing", language)}
                </span>
              ) : null}
              {turn.failed ? (
                <span className="app-meta app-tone-warning">
                  {partnerLabel("chatFailed", language)}
                </span>
              ) : null}
            </span>
          </div>
        ) : (
          <div className="app-chat-turn" data-author="partner" key={turn.id}>
            <div className="app-chat-partner">
              <AIResponseParts
                parts={turn.parts}
                language={language}
                receiptLines={receiptLines}
                {...(onOpenEvidence ? { onOpenEvidence } : {})}
                {...(onApprove ? { onApprove } : {})}
                {...(onOpenAudit ? { onOpenAudit } : {})}
                onAskFollowUp={(question) => chat.setDraft(question)}
              />
              <span className="app-row" style={{ gap: "var(--app-2)" }}>
                {turn.source ? (
                  <Chip tone={turn.source === "live" ? "success" : "neutral"}>
                    {partnerLabel(SOURCE_KEYS[turn.source], language)}
                  </Chip>
                ) : null}
                {turn.atMoment ? <Data>{turn.atMoment}</Data> : null}
              </span>
              {/^CHT-/.test(turn.id) ? (
                <AIFeedbackControl
                  target={{ kind: "chat-turn", id: turn.id }}
                  given={feedback[`chat-turn:${turn.id}`] ?? []}
                  language={language}
                  {...(onFeedback ? { onFeedback } : {})}
                />
              ) : null}
            </div>
          </div>
        ),
      )}

      {chat.blocked ? <Notice tone="warning">{chat.blocked}</Notice> : null}
      {chat.error && !chat.blocked ? <Notice tone="warning">{chat.error}</Notice> : null}

      <Announcer message={chat.announcement} />
    </div>
  );
}

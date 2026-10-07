"use client";

/**
 * The AI Partner dock.
 *
 * Present on every workday route. 336px at 1920 and 1440, and a 48px presence
 * rail at 1366. The grid columns and the breakpoint belong to the shell; what
 * this component owns is the two renderings and, more importantly, the state
 * that has to survive moving between them.
 *
 * That survival is the reason the dock holds the chat, the tab and the stream
 * overlay itself rather than delegating them to the panels. Collapsing to the
 * rail swaps the inner rendering of a component that stays mounted, so the
 * thread, the half typed draft and the open activity rows are all still there
 * when it opens again, and the centre workspace is never remounted because
 * nothing above it changes identity.
 *
 * The dock degrades to props alone. `subscribe` is optional and is a callback
 * rather than a hook import, so this component has no dependency on the live
 * day stream implementation. With no stream the dock renders exactly what the
 * server gave it; with a stream it layers arrivals on top.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { IconChevronLeft } from "@tabler/icons-react";
import type { Language } from "@/i18n/labels";
import {
  AI_PARTNER_STATE_LABELS,
  isBusyState,
  partnerStateFromGeneration,
  pick,
  type AIActivityEntryView,
  type AISuggestionView,
  type DataLoadState,
  type ExecutionReceiptLineView,
  type SourceAttribution,
  type WorkdayContext,
  type WorkdayStreamEvent,
} from "@/workday/contracts";
import { Chip, Empty, SectionHead } from "@/components/workday-v2/primitives";
import { TabPanel, Tabs, type TabDefinition } from "@/components/workday-v2/interactive";
import { AIActivityStream } from "./AIActivityStream";
import { AIChatPanel, useWorkdayChat } from "./AIChatPanel";
import { AIComposer } from "./AIComposer";
import { AIExecutionReceipt } from "./AIExecutionReceipt";
import { AIGenerationView, IDLE_GENERATION, type AIGenerationProgress } from "./AIGenerationView";
import { AIPartnerHeader } from "./AIPartnerHeader";
import { AIPartnerMark } from "./AIStatus";
import { AISuggestionCard, type AnswerHandler } from "./AISuggestionCard";
import type { FeedbackHandler } from "./AIFeedbackControl";
import { AIRoutineRuns } from "./AIRoutineRuns";
import {
  canRevealSuggestion,
  partnerLabel,
  selectPromptIds,
  type SuggestionActionId,
} from "./labels";
import { countNeedingYou, isOpenDisposition } from "@/features/partner/rules";
import type { PartnerExtras } from "@/features/partner/view";

export type AIPartnerTabId = "suggestions" | "activity" | "chat";

/* ==========================================================================
   The stream seam
   ========================================================================== */

export type WorkdayStreamListener = (event: WorkdayStreamEvent) => void;

/**
 * Subscribe to the event channel.
 *
 * Passed in rather than imported so the dock is not coupled to the live day
 * hook. Returns its own unsubscribe, which the dock calls on unmount and on a
 * role change. A caller with no channel simply omits it.
 */
export type WorkdaySubscribe = (listener: WorkdayStreamListener) => () => void;

/* ==========================================================================
   Props
   ========================================================================== */

export interface AIPartnerDockProps {
  /** The server assembled context. The dock asserts nothing the client owns. */
  context: WorkdayContext;
  /** Suggestions the server already validated, newest first. */
  suggestions?: AISuggestionView[];
  activity?: AIActivityEntryView[];
  /** Progress of the current run. Defaults to idle, which shows no card. */
  generation?: AIGenerationProgress;
  /** Sources loaded for the current run, kept visible through a failure. */
  generationSources?: SourceAttribution[];
  receiptLines?: ExecutionReceiptLineView[];
  /** Readiness of the region. Drives `aria-busy` only. */
  loadState?: DataLoadState;
  /**
   * True only while an operation is genuinely in flight. When omitted the
   * dock derives it from the stream, and with neither it stays still.
   */
  running?: boolean;
  /** True while an approved change is being carried out. */
  executing?: boolean;
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  initialTab?: AIPartnerTabId;
  initialThreadId?: string | null;
  /**
   * Whether the autonomy level and the AI mode appear on the face of the dock.
   *
   * Forwarded to the header. V3.1 passes false, because its brief moves the
   * mode and authority explanations to the Trust surface.
   */
  showPosture?: boolean;
  subscribe?: WorkdaySubscribe;
  /** Every suggestion action. The dock executes nothing itself. */
  onSuggestionAction?: (action: SuggestionActionId, suggestion: AISuggestionView) => void;
  onOpenEvidence?: (evidenceId: string) => void;
  onOpenAudit?: (auditEventId: string) => void;
  onApprovalRequest?: (input: { decisionId: string | null; text: string }) => void;
  /** Asks the server for a fresh suggestion after a failure. */
  onRetryGeneration?: () => void;
  /** Trace metadata, rendered only inside the header disclosure. */
  details?: ReactNode;
  /**
   * The lifecycle, feedback, routine lineage and durable context
   * (`src/features/partner/view.ts`). Absent means none of them render, so
   * an older caller keeps the dock it had.
   */
  extras?: PartnerExtras | null;
  /** Records a modification or a rejection with the person's reason. */
  onAnswer?: AnswerHandler;
  /** Gives or takes back one kind of feedback on an output. */
  onFeedback?: FeedbackHandler;
}

/* ==========================================================================
   The dock
   ========================================================================== */

export function AIPartnerDock({
  context,
  suggestions = [],
  activity = [],
  generation,
  generationSources = [],
  receiptLines = [],
  loadState = "ready",
  running,
  executing = false,
  collapsed,
  defaultCollapsed = false,
  onCollapsedChange,
  initialTab = "suggestions",
  showPosture = true,
  initialThreadId = null,
  subscribe,
  onSuggestionAction,
  onOpenEvidence,
  onOpenAudit,
  onApprovalRequest,
  onRetryGeneration,
  details,
  extras = null,
  onAnswer,
  onFeedback,
}: AIPartnerDockProps) {
  const language: Language = context.language;
  const offline = context.demoMode === "offline";

  const [tab, setTab] = useState<AIPartnerTabId>(initialTab);
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const isCollapsed = collapsed ?? internalCollapsed;

  /* ---- stream overlay ---- */
  const [streamGeneration, setStreamGeneration] = useState<AIGenerationProgress | null>(null);
  const [streamSuggestions, setStreamSuggestions] = useState<AISuggestionView[]>([]);
  const [streamActivity, setStreamActivity] = useState<AIActivityEntryView[]>([]);
  const [streamReceipts, setStreamReceipts] = useState<ExecutionReceiptLineView[]>([]);
  const [streamRunning, setStreamRunning] = useState(false);
  /** Ids that arrived while the dock was open, which is what enables reveal. */
  const arrivedLive = useRef<Set<string>>(new Set());
  const tabRef = useRef<AIPartnerTabId>(tab);
  tabRef.current = tab;

  const chat = useWorkdayChat({
    roleId: context.roleId,
    selection: context.selection,
    language,
    initialThreadId,
    disabled: offline,
  });

  const setCollapsed = useCallback(
    (next: boolean) => {
      setInternalCollapsed(next);
      onCollapsedChange?.(next);
    },
    [onCollapsedChange],
  );

  /* ---- the event channel ---- */
  useEffect(() => {
    if (!subscribe) return;

    return subscribe((event) => {
      switch (event.kind) {
        case "agent.run.started": {
          if (event.roleId !== context.roleId) return;
          setStreamRunning(true);
          setStreamGeneration({
            state: "queued",
            completedStages: [],
            suggestionId: event.suggestionId,
          });
          return;
        }
        case "agent.stage.changed": {
          if (event.roleId !== context.roleId) return;
          setStreamRunning(event.state !== "ready" && event.state !== "error");
          setStreamGeneration({
            state: event.state,
            completedStages: event.completedStages,
            label: event.label,
            suggestionId: event.suggestionId,
          });
          return;
        }
        case "agent.tool.completed": {
          if (event.roleId !== context.roleId) return;
          setStreamActivity((existing) =>
            existing.some((entry) => entry.id === event.entry.id)
              ? existing
              : [...existing, event.entry],
          );
          return;
        }
        case "agent.suggestion.ready": {
          if (event.roleId !== context.roleId) return;
          arrivedLive.current.add(event.suggestion.id);
          setStreamRunning(false);
          setStreamGeneration({
            state: "ready",
            completedStages: [],
            suggestionId: event.suggestion.id,
          });
          setStreamSuggestions((existing) => [
            event.suggestion,
            ...existing.filter((item) => item.id !== event.suggestion.id),
          ]);
          /*
           * Move the user to Suggestions, but never away from Chat.
           *
           * Pulling someone off a half typed question to show them a card is
           * the kind of helpfulness that loses work.
           */
          if (tabRef.current !== "chat") setTab("suggestions");
          return;
        }
        case "agent.suggestion.failed": {
          if (event.roleId !== context.roleId) return;
          setStreamRunning(false);
          setStreamGeneration({
            state: "error",
            completedStages: [],
            error: event.reason,
            retryable: event.retryable,
          });
          return;
        }
        case "mutation.completed": {
          if (event.roleId !== context.roleId) return;
          setStreamReceipts((existing) => {
            const seen = new Set(existing.map((line) => line.id));
            return [...existing, ...event.receiptLines.filter((line) => !seen.has(line.id))];
          });
          return;
        }
        default:
          /*
           * Everything else on the channel belongs to another region. The
           * integration command and data load events are deliberately not
           * mirrored here: the dock would be inventing a second, possibly
           * disagreeing account of connector state.
           */
          return;
      }
    });
  }, [subscribe, context.roleId]);

  /* ---- merge props with the overlay ---- */
  const activeGeneration: AIGenerationProgress = streamGeneration ?? generation ?? IDLE_GENERATION;
  const isRunning = running ?? streamRunning;

  const mergedSuggestions = useMemo(() => {
    const seen = new Set<string>();
    const merged: AISuggestionView[] = [];
    for (const suggestion of [...streamSuggestions, ...suggestions]) {
      if (seen.has(suggestion.id)) continue;
      seen.add(suggestion.id);
      merged.push(suggestion);
    }
    return merged;
  }, [streamSuggestions, suggestions]);

  /*
   * The reveal gate.
   *
   * A suggestion is filtered out until validation has succeeded for it. This
   * is the rule that stops a half drafted recommendation reaching the screen,
   * and it is applied here rather than inside the card so that the generation
   * view can hold the slot in the meantime.
   */
  /*
   * Only suggestions still waiting for an answer are in the open list. An
   * answered one moves to Handled below, with its disposition, which is the
   * same rule the header count applies (`suggestionNeedsYou`).
   */
  const visibleSuggestions = useMemo(
    () =>
      mergedSuggestions.filter(
        (suggestion) =>
          suggestion.status !== "dismissed" &&
          isOpenDisposition(suggestion.disposition) &&
          canRevealSuggestion(suggestion, activeGeneration),
      ),
    [mergedSuggestions, activeGeneration],
  );

  const handledSuggestions = useMemo(() => {
    const seen = new Set(visibleSuggestions.map((suggestion) => suggestion.id));
    const answered = [
      ...mergedSuggestions.filter((suggestion) => !isOpenDisposition(suggestion.disposition)),
      ...(extras?.answered ?? []),
    ];
    const out: AISuggestionView[] = [];
    for (const suggestion of answered) {
      if (seen.has(suggestion.id)) continue;
      seen.add(suggestion.id);
      out.push(suggestion);
    }
    return out;
  }, [mergedSuggestions, visibleSuggestions, extras]);

  const mergedActivity = useMemo(() => {
    const seen = new Set<string>();
    const merged: AIActivityEntryView[] = [];
    for (const entry of [...activity, ...streamActivity]) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      merged.push(entry);
    }
    return merged.sort((a, b) => a.sequence - b.sequence);
  }, [activity, streamActivity]);

  const mergedReceipts = useMemo(() => {
    const seen = new Set<string>();
    return [...receiptLines, ...streamReceipts].filter((line) => {
      if (seen.has(line.id)) return false;
      seen.add(line.id);
      return true;
    });
  }, [receiptLines, streamReceipts]);

  /* ---- derived state ---- */
  // The header's rule, over the same rows: the two counts cannot disagree.
  const needsYou = countNeedingYou(visibleSuggestions);

  const partnerState = partnerStateFromGeneration(activeGeneration.state, {
    decisionRequired: needsYou > 0,
    executing,
    offline,
  });

  /*
   * Whether to hold the slot with the generation view.
   *
   * Shown while the pipeline is mid run and on failure. Not shown when idle,
   * because an idle partner showing a stage list would be advertising work it
   * is not doing, and not shown once a suggestion is revealable, because the
   * content replaces the progress rather than sitting under it.
   */
  const showGeneration =
    activeGeneration.state === "error" ||
    (activeGeneration.state !== "idle" &&
      activeGeneration.state !== "ready" &&
      activeGeneration.state !== "blocked");

  const promptIds = useMemo(
    () =>
      selectPromptIds({
        hasSelection: Boolean(context.selection),
        hasOpenDecision: context.openDecisionIds.length > 0,
        hasConflictingEvidence: visibleSuggestions.some((suggestion) =>
          suggestion.sources.some((source) => source.conflicted),
        ),
        hasCompletedActions: visibleSuggestions.some(
          (suggestion) => suggestion.actionsCompleted.length > 0,
        ),
        hasSuggestion: visibleSuggestions.length > 0,
        turnCount: chat.turns.length,
      }),
    [context.selection, context.openDecisionIds, visibleSuggestions, chat.turns.length],
  );

  /**
   * Ask why is answered here rather than passed up.
   *
   * The question belongs in the conversation that is already on screen, so
   * the dock opens Chat with it prefilled. The caller is still told, because
   * it may want to record that the user asked.
   */
  const handleSuggestionAction = useCallback(
    (action: SuggestionActionId, suggestion: AISuggestionView) => {
      if (action === "ask-why") {
        setTab("chat");
        chat.setDraft(
          `${pick({ en: "Why does this matter for", de: "Warum ist das wichtig fuer" }, language)} ${suggestion.headline}`,
        );
      }
      onSuggestionAction?.(action, suggestion);
    },
    [chat, language, onSuggestionAction, setTab],
  );

  /*
   * Ask AI from somewhere else in the workday.
   *
   * A role workspace asking about the selected object cannot be handed a
   * callback: the dock is a server rendered slot and a function cannot cross
   * that boundary. The shell therefore dispatches a DOM event, which this
   * listens for, opens Chat and prefills. The alternative was remounting the
   * dock with a different initial tab, which would discard the conversation
   * the user already had.
   */
  useEffect(() => {
    const onAsk = (event: Event) => {
      const detail = (event as CustomEvent<{ prompt?: string }>).detail;
      if (!detail || typeof detail.prompt !== "string" || detail.prompt.length === 0) return;
      setTab("chat");
      chat.setDraft(detail.prompt);
    };
    window.addEventListener("nfr:ask-partner", onAsk);
    return () => window.removeEventListener("nfr:ask-partner", onAsk);
  }, [chat, setTab]);

  /* ---- the collapsed presence rail ---- */
  if (isCollapsed) {
    return (
      <aside className="app-partner-presence" aria-label={partnerLabel("dockLabel", language)}>
        <button
          type="button"
          className="app-icon-btn"
          onClick={() => setCollapsed(false)}
          aria-label={partnerLabel("openPartner", language)}
          title={partnerLabel("openPartner", language)}
        >
          <IconChevronLeft size={15} stroke={2} aria-hidden="true" />
        </button>

        {/*
         * The rail still states the state.
         *
         * A collapsed partner that shows nothing reads as a partner that is
         * off. The mark and the vertical label are what make it legible that
         * it is still monitoring without taking a column of the screen.
         */}
        <AIPartnerMark
          state={partnerState}
          running={isRunning}
          label={pick(AI_PARTNER_STATE_LABELS[partnerState], language)}
        />
        <span className="app-partner-presence-label">
          {pick(AI_PARTNER_STATE_LABELS[partnerState], language)}
        </span>
        {needsYou > 0 ? (
          <Chip tone="warning" count title={partnerLabel("needsYouCount", language)}>
            {needsYou}
          </Chip>
        ) : null}
      </aside>
    );
  }

  /* ---- the full dock ---- */
  const tabs: TabDefinition[] = [
    {
      id: "suggestions",
      label: partnerLabel("tabSuggestions", language),
      ...(visibleSuggestions.length > 0
        ? { badge: <span className="app-faint"> {visibleSuggestions.length}</span> }
        : {}),
    },
    { id: "activity", label: partnerLabel("tabActivity", language) },
    { id: "chat", label: partnerLabel("tabChat", language) },
  ];

  return (
    <aside className="app-partner" aria-label={partnerLabel("dockLabel", language)} data-needs-you={needsYou}>
      <AIPartnerHeader
        state={partnerState}
        language={language}
        autonomyLevel={context.autonomyLevel}
        demoMode={context.demoMode}
        running={isRunning}
        needsYouCount={needsYou}
        showPosture={showPosture}
        onCollapse={() => setCollapsed(true)}
        {...(activeGeneration.label ? { detail: activeGeneration.label } : {})}
        {...(details ? { details } : {})}
      />

      <Tabs
        tabs={tabs}
        active={tab}
        onChange={(id) => setTab(id as AIPartnerTabId)}
        label={partnerLabel("dockLabel", language)}
      />

      <div className="app-partner-body" {...(isBusyState(loadState) ? { "aria-busy": true } : {})}>
        <TabPanel id="suggestions" active={tab === "suggestions"}>
          <div className="app-stack-3" style={{ padding: "var(--app-3)" }}>
            {showGeneration ? (
              <AIGenerationView
                generation={activeGeneration}
                language={language}
                sources={generationSources}
                running={isRunning}
                {...(onRetryGeneration ? { onRetry: onRetryGeneration } : {})}
              />
            ) : null}

            {visibleSuggestions.map((suggestion) => (
              <AISuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                language={language}
                currentMoment={context.currentMoment}
                progressive={arrivedLive.current.has(suggestion.id)}
                onAction={handleSuggestionAction}
                history={extras?.history[suggestion.id] ?? []}
                preparedBy={extras?.preparedBy[suggestion.id] ?? null}
                feedbackKinds={extras?.feedback[`suggestion:${suggestion.id}`] ?? []}
                {...(onAnswer ? { onAnswer } : {})}
                {...(onFeedback ? { onFeedback } : {})}
                {...(onOpenEvidence ? { onOpenEvidence } : {})}
              />
            ))}

            {!showGeneration && visibleSuggestions.length === 0 ? (
              <Empty
                title={partnerLabel("suggestionsEmptyTitle", language)}
                detail={partnerLabel("suggestionsEmptyDetail", language)}
              />
            ) : null}

            {/* ---- answered suggestions keep their lifecycle, one click away ---- */}
            {handledSuggestions.length > 0 ? (
              <details className="app-stack-2" data-partner-region="handled-suggestions">
                <summary className="app-part-label" style={{ cursor: "pointer" }}>
                  {partnerLabel("handledTitle", language)} ({handledSuggestions.length})
                </summary>
                <div className="app-stack-3" style={{ marginTop: "var(--app-2)" }}>
                  {handledSuggestions.map((suggestion) => (
                    <AISuggestionCard
                      key={suggestion.id}
                      suggestion={suggestion}
                      language={language}
                      currentMoment={context.currentMoment}
                      onAction={handleSuggestionAction}
                      history={extras?.history[suggestion.id] ?? []}
                      preparedBy={extras?.preparedBy[suggestion.id] ?? null}
                      feedbackKinds={extras?.feedback[`suggestion:${suggestion.id}`] ?? []}
                      {...(onFeedback ? { onFeedback } : {})}
                      {...(onOpenEvidence ? { onOpenEvidence } : {})}
                    />
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        </TabPanel>

        <TabPanel id="activity" active={tab === "activity"}>
          {extras ? (
            <div style={{ padding: "var(--app-3) var(--app-3) 0" }}>
              <AIRoutineRuns
                runs={extras.routineRuns}
                language={language}
                feedback={extras.feedback}
                {...(onFeedback ? { onFeedback } : {})}
              />
            </div>
          ) : null}
          {mergedReceipts.length > 0 ? (
            <div style={{ padding: "var(--app-3) var(--app-3) 0" }}>
              <AIExecutionReceipt
                lines={mergedReceipts}
                language={language}
                {...(onOpenAudit ? { onOpenAudit } : {})}
              />
            </div>
          ) : null}
          <AIActivityStream
            entries={mergedActivity}
            language={language}
            {...(onOpenEvidence ? { onOpenEvidence } : {})}
            {...(onOpenAudit ? { onOpenAudit } : {})}
          />
        </TabPanel>

        <TabPanel id="chat" active={tab === "chat"}>
          <AIChatPanel
            chat={chat}
            language={language}
            selection={context.selection}
            demoMode={context.demoMode}
            receiptLines={mergedReceipts}
            workingContext={extras?.context ?? null}
            feedback={extras?.feedback ?? {}}
            {...(onFeedback ? { onFeedback } : {})}
            {...(onOpenEvidence ? { onOpenEvidence } : {})}
            {...(onApprovalRequest ? { onApprove: onApprovalRequest } : {})}
            {...(onOpenAudit ? { onOpenAudit } : {})}
          />
        </TabPanel>
      </div>

      {/*
       * The composer sits in the foot, outside the scrolling body, so it does
       * not travel up the transcript as the conversation grows.
       */}
      {tab === "chat" ? (
        <div className="app-partner-foot">
          <AIComposer
            value={chat.draft}
            onChange={chat.setDraft}
            onSubmit={chat.send}
            language={language}
            busy={chat.busy}
            disabled={offline}
            promptIds={promptIds}
            onPromptSelect={(text) => chat.send(text)}
          />
        </div>
      ) : null}
    </aside>
  );
}

/**
 * The section head the shell can put above a dock embedded somewhere else.
 *
 * Exported separately because the dock itself deliberately has no heading in
 * its body: the header already names it, and a second title inside the panel
 * is the kind of duplication that made the previous rail feel heavy.
 */
export function AIPartnerSectionHead({ language }: { language: Language }) {
  return <SectionHead title={partnerLabel("partnerTitle", language)} />;
}

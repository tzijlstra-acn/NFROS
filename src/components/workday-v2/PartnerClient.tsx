"use client";

/**
 * The client bridge for the AI Partner dock.
 *
 * The dock is deliberately inert: it executes nothing, approves nothing and
 * fetches nothing. Every action is a callback. That is the right shape for it,
 * because the thing on the other end of "Approve" has to be the authority
 * gate and not a component, but it means something has to supply the wiring.
 * This is that something, and it is the only file where the dock meets the
 * rest of the application.
 *
 * Three responsibilities:
 *
 *   The stream. It subscribes to the event channel and hands the dock a
 *   `subscribe` function, so the dock stays decoupled from the transport. If
 *   the channel is unavailable the dock still renders from its server props,
 *   which is why the subscription failing is not an error state here.
 *
 *   Navigation into context. Opening cited evidence opens the context drawer
 *   rather than leaving the workday, which is a stated requirement: evidence
 *   must remain one click away and must not cost the user their place.
 *
 *   Suggestion actions. Review, open, ask why, approve, modify, snooze and
 *   dismiss are routed to the right place. Approve does NOT execute here: it
 *   navigates to the decision flow, where the rationale and the confirmation
 *   that the rationale is the user's own are captured, and where the gate
 *   refuses without them. A one click Approve on a suggestion card would
 *   bypass the single most important control in the product.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AIPartnerDock,
  type AIPartnerTabId,
  type WorkdaySubscribe,
} from "@/components/ai-partner/AIPartnerDock";
import type { AIGenerationProgress } from "@/components/ai-partner/AIGenerationView";
import type { SuggestionActionId } from "@/components/ai-partner/labels";
import type { FeedbackHandler } from "@/components/ai-partner/AIFeedbackControl";
import { isFeedbackKind } from "@/features/partner/rules";
import type { PartnerExtras } from "@/features/partner/view";
import {
  AI_STAGE_LABELS,
  AI_STAGE_ORDER,
  pick,
  type AIActivityEntryView,
  type AIGenerationState,
  type AISuggestionView,
  type ExecutionReceiptLineView,
  type SourceAttribution,
  type WorkdayContext,
  type WorkdayStreamEvent,
} from "@/workday/contracts";
import { useShell } from "./ShellContext";

export interface PartnerClientProps {
  context: WorkdayContext;
  suggestions: AISuggestionView[];
  activity: AIActivityEntryView[];
  receiptLines: ExecutionReceiptLineView[];
  generationSources: SourceAttribution[];
  /** True at the narrowest width, where the dock renders as a presence rail. */
  presence?: boolean;
  initialTab?: AIPartnerTabId;
  /** Forwarded to the dock header. V3.1 passes false. */
  showPosture?: boolean;
  /**
   * The role's open chat thread, read on the server.
   *
   * Navigating to another route replaces the page subtree, so the dock is
   * remounted and its in memory transcript is gone. The turns are durable in
   * `chat_threads` and `chat_turns`, and the dock has a prop for restoring
   * them; nothing was passing it, so a conversation vanished the moment the
   * user opened the work object it was about.
   */
  initialThreadId?: string | null;
  /** The lifecycle, feedback, routine lineage and durable context (AI Partner, Wave 3). */
  extras?: PartnerExtras | null;
  /** Called after an answer or feedback was recorded, so the host can re-read the dock's data. */
  onPartnerChanged?: () => void;
}

/** POSTs one Partner write and returns the parsed body, or null when it did not succeed. */
async function postPartner(path: string, body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Subscribes to the workday event channel.
 *
 * One connection per mounted dock, torn down on unmount. Server sent events
 * are tried first; a failure is silent because the dock degrades to its server
 * rendered props and a console full of connection errors during a
 * demonstration is worse than a dock that simply does not update live.
 */
function useWorkdaySubscribe(roleId: string): WorkdaySubscribe {
  const listeners = useRef(new Set<(event: WorkdayStreamEvent) => void>());

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;

    let source: EventSource | null = null;
    try {
      source = new EventSource(`/api/workday/events?roleId=${encodeURIComponent(roleId)}`);
    } catch {
      return;
    }

    const onMessage = (message: MessageEvent<string>) => {
      let parsed: WorkdayStreamEvent;
      try {
        parsed = JSON.parse(message.data) as WorkdayStreamEvent;
      } catch {
        return;
      }
      for (const listener of listeners.current) listener(parsed);
    };

    /*
     * A listener per kind, as well as the default.
     *
     * The channel frames every payload as `event: <kind>` followed by its
     * data, and a server sent event that names its type is dispatched under
     * that name and NEVER as `message`. This component registered only
     * `message`, so the dock held an open socket it could not hear: every
     * agent frame arrived and none reached a listener. The live day hook gets
     * this right and says so in a comment; this did not.
     *
     * The default `message` listener is kept for any frame the channel sends
     * without naming a type.
     */
    const kinds = [
      "scenario.event.arrived",
      "scenario.time.changed",
      "agent.run.started",
      "agent.stage.changed",
      "agent.tool.completed",
      "agent.suggestion.ready",
      "agent.suggestion.failed",
      "approval.required",
      "mutation.completed",
      "integration.command.changed",
      "data.load.changed",
    ] as const;

    source.addEventListener("message", onMessage);
    for (const kind of kinds) source.addEventListener(kind, onMessage as EventListener);

    /*
     * A dropped connection is left dropped rather than retried in a loop. The
     * browser already reconnects an EventSource on its own, and an additional
     * retry loop on top of that produced two connections per dock.
     */
    source.addEventListener("error", () => {});

    return () => {
      source?.removeEventListener("message", onMessage);
      for (const kind of kinds) source?.removeEventListener(kind, onMessage as EventListener);
      source?.close();
    };
  }, [roleId]);

  return useCallback((listener: (event: WorkdayStreamEvent) => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);
}

export function PartnerClient({
  context,
  suggestions,
  activity,
  receiptLines,
  generationSources,
  presence = false,
  initialTab = "suggestions",
  showPosture = true,
  initialThreadId = null,
  extras = null,
  onPartnerChanged,
}: PartnerClientProps) {
  const shell = useShell();
  const router = useRouter();
  const [, start] = useTransition();
  const subscribe = useWorkdaySubscribe(context.roleId);

  /*
   * The suggestion lifecycle (plan 4.11). Every answer is recorded by
   * `/api/workday/partner/suggestion` before anything else happens, and none
   * of them executes anything: Accept on a material suggestion records the
   * acceptance and opens the decision record, where the rationale, the
   * confirmation and the payload bound approval are captured and the gate
   * decides. Approve is not a shortcut past that, and never was.
   */
  const fallbackHref = useCallback(
    (suggestion: AISuggestionView) =>
      extras?.hrefs[suggestion.id] ??
      (suggestion.decisionId
        ? `/workday/${context.roleId}/decisions#${suggestion.decisionId}`
        : `/workday/${context.roleId}/decisions`),
    [context.roleId, extras],
  );

  const answer = useCallback(
    async (
      kind: "review" | "accept" | "modify" | "reject" | "snooze",
      suggestion: AISuggestionView,
      extra: { recommendation?: string; reason?: string } = {},
    ) => {
      const body = await postPartner("/api/workday/partner/suggestion", {
        roleId: context.roleId,
        suggestionId: suggestion.id,
        answer: kind,
        ...extra,
      });
      const ok = body?.["ok"] === true;
      if (ok) {
        onPartnerChanged?.();
        start(() => router.refresh());
      }
      const next = body?.["next"] as { href?: unknown } | null | undefined;
      return { ok, href: typeof next?.href === "string" ? next.href : null };
    },
    [context.roleId, onPartnerChanged, router, start],
  );

  const onSuggestionAction = useCallback(
    (action: SuggestionActionId, suggestion: AISuggestionView) => {
      switch (action) {
        case "approve":
        case "accept":
          void answer("accept", suggestion).then((result) => router.push(result.href ?? fallbackHref(suggestion)));
          break;

        case "review":
          void answer("review", suggestion).then((result) => router.push(result.href ?? fallbackHref(suggestion)));
          break;

        case "open-object":
          router.push(fallbackHref(suggestion));
          break;

        case "ask-why":
          // The dock switches to the chat tab and seeds the composer; reading why is a review.
          void answer("review", suggestion);
          break;

        case "modify":
          // The card asks for the person's version and reason; without the form, open the work.
          router.push(fallbackHref(suggestion));
          break;

        case "snooze":
          void answer("snooze", suggestion);
          break;

        case "dismiss":
          // A rejection needs the person's reason, which the card's form collects.
          break;
      }
    },
    [answer, fallbackHref, router],
  );

  const onAnswer = useCallback(
    async (kind: "modify" | "reject", suggestion: AISuggestionView, extra: { recommendation?: string; reason: string }) => {
      const result = await answer(kind, suggestion, extra);
      if (result.ok && kind === "modify") router.push(result.href ?? fallbackHref(suggestion));
      return result.ok;
    },
    [answer, fallbackHref, router],
  );

  const onFeedback = useCallback<FeedbackHandler>(
    async (target, kind) => {
      const body = await postPartner("/api/workday/partner/feedback", {
        roleId: context.roleId,
        targetKind: target.kind,
        targetId: target.id,
        kind,
      });
      if (!body || body["ok"] !== true || !Array.isArray(body["kinds"])) return null;
      return (body["kinds"] as unknown[]).filter(isFeedbackKind);
    },
    [context.roleId],
  );

  const onOpenEvidence = useCallback(() => {
    // Evidence opens in the context drawer, so the user keeps their place.
    shell.openDrawer("evidence");
  }, [shell]);

  const onOpenAudit = useCallback(() => {
    shell.openDrawer("audit");
  }, [shell]);

  const onApprovalRequest = useCallback(
    (input: { decisionId: string | null; text: string }) => {
      router.push(
        input.decisionId
          ? `/workday/${context.roleId}/decisions#${input.decisionId}`
          : `/workday/${context.roleId}/decisions`,
      );
    },
    [context.roleId, router],
  );

  const onRetryGeneration = useCallback(() => {
    void fetch("/api/workday/suggestion", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        roleId: context.roleId,
        objectType: context.selection?.objectType ?? "role",
        objectId: context.selection?.objectId ?? context.roleId,
        refresh: true,
      }),
    }).then(() => router.refresh());
  }, [context.roleId, context.selection, router]);

  /*
   * Automatic generation, and the stage sequence that precedes its result.
   *
   * This was the largest hole in the experience. The dock's liveness contract
   * is the event channel, and three things meant nothing ever reached it: the
   * channel published no `agent.` frames, this component could not hear a
   * named frame (fixed above), and nothing started a run at all. The three
   * exported entry points for role opened, focus item selected and decision
   * opened were never called from anywhere, so the generation view never held
   * the slot, the progressive reveal never ran, and the cards in the dock were
   * rows read from the database on the server that had always been there.
   *
   * A run is now started from here, for the current role and selection, and
   * the stages are walked while the request is in flight. The walk is not
   * decoration: the request genuinely is in flight, and the server returns the
   * stages it actually recorded, so the sequence ends on the real outcome
   * rather than on an animation that resolves regardless.
   *
   * Deduplication is the server's job and it does it on a digest of the whole
   * input state, so a navigation that does not change the context returns the
   * cached card without a second model call. The guard here is only against
   * issuing a duplicate REQUEST for a context this component has already
   * asked about.
   */
  const [generation, setGeneration] = useState<AIGenerationProgress>({ state: "idle" });
  const [livesuggestion, setLiveSuggestion] = useState<AISuggestionView | null>(null);
  const askedFor = useRef<string | null>(null);
  const knownIds = useRef<Set<string>>(new Set());
  knownIds.current = new Set([...suggestions, ...(extras?.answered ?? [])].map((entry) => entry.id));

  const target = useMemo(
    () => ({
      objectType: context.selection?.objectType ?? "role",
      objectId: context.selection?.objectId ?? context.roleId,
    }),
    [context.selection, context.roleId],
  );

  const contextKey = `${context.roleId}|${target.objectType}|${target.objectId}|${context.viewedMoment}|${context.autonomyLevel}`;

  useEffect(() => {
    if (askedFor.current === contextKey) return;
    askedFor.current = contextKey;

    let cancelled = false;
    const timers: number[] = [];

    /*
     * Walk the observable stages. These describe processing steps and nothing
     * else: they are not a window onto the model's reasoning and must never be
     * written as though they were.
     */
    const walk = AI_STAGE_ORDER.slice(0, AI_STAGE_ORDER.indexOf("ready"));
    walk.forEach((state, index) => {
      timers.push(
        window.setTimeout(() => {
          if (cancelled) return;
          setGeneration({
            state,
            completedStages: walk.slice(0, index),
            label: pick(AI_STAGE_LABELS[state], context.language),
          });
        }, index * 260),
      );
    });

    void fetch("/api/workday/suggestion", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        roleId: context.roleId,
        objectType: target.objectType,
        objectId: target.objectId,
        viewedMoment: context.viewedMoment,
      }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: unknown) => {
        if (cancelled || payload === null) return;
        const body = payload as {
          suggestion?: AISuggestionView | null;
          generation?: { state?: AIGenerationState; completedStages?: AIGenerationState[]; label?: string };
          error?: string;
          retryable?: boolean;
        };

        /*
         * A suggestion is revealed only when the server says it is ready,
         * which it says only after structured validation has succeeded. A
         * failure keeps the loaded evidence visible and offers a retry rather
         * than publishing an unvalidated draft as final.
         */
        if (body.suggestion && body.generation?.state === "ready") {
          setLiveSuggestion(body.suggestion);
          setGeneration({ state: "ready", completedStages: walk, label: undefined });
          /*
           * A suggestion the server list did not hold was just prepared. The
           * header counts the server's rows, so the route is refreshed for
           * the header to count it too: the two counts stay equal.
           */
          if (!knownIds.current.has(body.suggestion.id)) router.refresh();
          return;
        }

        setGeneration({
          state: body.generation?.state ?? "error",
          completedStages: body.generation?.completedStages ?? walk,
          ...(body.generation?.label ? { label: body.generation.label } : {}),
          ...(body.error ? { error: body.error } : {}),
          ...(body.retryable === undefined ? {} : { retryable: body.retryable }),
        });
      })
      .catch(() => {
        if (cancelled) return;
        setGeneration({ state: "error", completedStages: walk, retryable: true });
      });

    return () => {
      cancelled = true;
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [contextKey, context.roleId, context.language, context.viewedMoment, target, router]);

  /*
   * The server rendered cards, with any newly prepared one at the front and
   * no duplicate of it. The server list is the durable record; this one is
   * the card the user just watched being prepared.
   */
  const shownSuggestions = useMemo(() => {
    if (livesuggestion === null) return suggestions;
    return [livesuggestion, ...suggestions.filter((entry) => entry.id !== livesuggestion.id)];
  }, [livesuggestion, suggestions]);

  return (
    <AIPartnerDock
      context={context}
      suggestions={shownSuggestions}
      activity={activity}
      receiptLines={receiptLines}
      generationSources={generationSources}
      generation={generation}
      running={generation.state !== "idle" && generation.state !== "ready" && generation.state !== "error"}
      initialThreadId={initialThreadId}
      collapsed={presence}
      onCollapsedChange={(collapsed) => shell.setPartnerOpen(!collapsed)}
      initialTab={initialTab}
      showPosture={showPosture}
      subscribe={subscribe}
      onSuggestionAction={onSuggestionAction}
      onOpenEvidence={onOpenEvidence}
      onOpenAudit={onOpenAudit}
      onApprovalRequest={onApprovalRequest}
      onRetryGeneration={onRetryGeneration}
      extras={extras}
      onAnswer={onAnswer}
      onFeedback={onFeedback}
    />
  );
}

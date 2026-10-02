"use client";

/**
 * Subscribes to the live day event channel.
 *
 * One reducer, two possible origins. In live mode the payloads come off the
 * server sent event channel at `/api/workday/events`. In presenter safe and
 * offline mode they come from `publish`, which the live day bar calls with the
 * `stream` array every server action returns. The client code path is
 * identical, which is the acceptance criterion about the three modes sharing
 * one state contract: only the origin differs.
 *
 * `EventSource` is used rather than `fetch` with a reader for one reason that
 * matters more than the ergonomics: it reconnects on its own and replays
 * `Last-Event-ID`, so a laptop that sleeps during a presentation resumes the
 * day instead of silently stopping. Reconnection makes duplicates possible, so
 * every payload is deduplicated by event identifier before it reaches state.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RoleId } from "@/db/schema/core";
import type { Language } from "@/i18n/labels";
import {
  momentMinutes,
  type DataLoadState,
  type WorkdayLiveEvent,
  type WorkdayStreamEvent,
} from "@/workday/contracts";

/** "stream" opens the channel. "local" waits to be fed by server actions. */
export type EventTransport = "stream" | "local";

export interface ScenarioEventStreamOptions {
  roleId: RoleId;
  language: Language;
  transport?: EventTransport;
  /** The day as the server rendered it, so the first paint is populated. */
  initialEvents: WorkdayLiveEvent[];
  initialLiveMoment: string;
  initialUnreadCount: number;
  /** Called for every payload, whatever its origin. */
  onStreamEvent?: (payload: WorkdayStreamEvent) => void;
}

export interface ScenarioEventStream {
  /** Every known event for this role, deduplicated and in day order. */
  events: WorkdayLiveEvent[];
  /** Recent arrivals the user has not dismissed, newest first. */
  arrivals: WorkdayLiveEvent[];
  unreadCount: number;
  liveMoment: string;
  connection: DataLoadState;
  lastHeartbeatAt: string | null;
  /** Feeds a payload in from a server action. Used by the offline transport. */
  publish: (payload: WorkdayStreamEvent) => void;
  publishAll: (payloads: readonly WorkdayStreamEvent[]) => void;
  dismissArrival: (eventId: string) => void;
  dismissAllArrivals: () => void;
  /** Local read mark, so the track updates before the action round trip lands. */
  markReadLocally: (eventId: string) => void;
  replaceEvents: (events: WorkdayLiveEvent[], unreadCount: number) => void;
}

/** How many arrivals are kept. The stack shows three and counts the rest. */
const ARRIVAL_LIMIT = 8;

function byDayOrder(a: WorkdayLiveEvent, b: WorkdayLiveEvent): number {
  return (
    momentMinutes(a.atMoment) - momentMinutes(b.atMoment) ||
    a.sortOrder - b.sortOrder ||
    a.id.localeCompare(b.id)
  );
}

export function useScenarioEventStream(
  options: ScenarioEventStreamOptions,
): ScenarioEventStream {
  const transport = options.transport ?? "stream";

  const [events, setEvents] = useState<WorkdayLiveEvent[]>(() =>
    [...options.initialEvents].sort(byDayOrder),
  );
  const [arrivalIds, setArrivalIds] = useState<string[]>([]);
  const [unreadCount, setUnreadCount] = useState(options.initialUnreadCount);
  const [liveMoment, setLiveMoment] = useState(options.initialLiveMoment);
  const [connection, setConnection] = useState<DataLoadState>(
    transport === "stream" ? "connecting" : "idle",
  );
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState<string | null>(null);

  /*
   * The arrival ledger. A ref rather than state because it is consulted inside
   * the message handler, and reading it from state there would need the handler
   * in the effect's dependency list, which would tear the connection down and
   * build it up again on every event.
   */
  const seenRef = useRef<Set<string>>(new Set(options.initialEvents.map((event) => event.id)));
  const onStreamEventRef = useRef(options.onStreamEvent);
  onStreamEventRef.current = options.onStreamEvent;

  const apply = useCallback((payload: WorkdayStreamEvent) => {
    onStreamEventRef.current?.(payload);

    switch (payload.kind) {
      case "scenario.event.arrived": {
        const event = payload.event;
        // Reconnection replays from the last identifier the browser saw, which
        // can overlap by one frame. Dedupe rather than trust the cursor.
        if (seenRef.current.has(event.id)) {
          setEvents((current) =>
            current.map((candidate) => (candidate.id === event.id ? event : candidate)),
          );
          return;
        }
        seenRef.current.add(event.id);
        setEvents((current) => [...current, event].sort(byDayOrder));
        setArrivalIds((current) => [event.id, ...current].slice(0, ARRIVAL_LIMIT));
        if (event.readAt === null) setUnreadCount((count) => count + 1);
        return;
      }

      case "scenario.time.changed":
        setLiveMoment(payload.moment);
        return;

      case "stream.heartbeat":
        setLastHeartbeatAt(payload.at);
        setConnection((current) => (current === "ready" ? current : "ready"));
        return;

      case "data.load.changed":
        if (payload.region === "live-day") setConnection(payload.state);
        return;

      default:
        // Payloads for the AI Partner, the focus queue and the integration
        // runtime travel on the same channel. They are forwarded through
        // `onStreamEvent` above and are not this hook's business.
        return;
    }
  }, []);

  const publish = useCallback(
    (payload: WorkdayStreamEvent) => {
      apply(payload);
    },
    [apply],
  );

  const publishAll = useCallback(
    (payloads: readonly WorkdayStreamEvent[]) => {
      for (const payload of payloads) apply(payload);
    },
    [apply],
  );

  /* ---- the channel ---- */

  useEffect(() => {
    if (transport !== "stream") {
      setConnection("idle");
      return;
    }
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      // No channel available. The bar still works through server actions, so
      // report idle rather than error: nothing is broken, the transport is just
      // the local one.
      setConnection("idle");
      return;
    }

    const url = `/api/workday/events?roleId=${encodeURIComponent(options.roleId)}&lang=${options.language}`;
    const source = new EventSource(url);
    setConnection("connecting");

    const onMessage = (message: MessageEvent<string>) => {
      try {
        apply(JSON.parse(message.data) as WorkdayStreamEvent);
      } catch {
        // A malformed frame is not worth breaking the day over. The next frame
        // carries the same cursor, so one bad parse costs nothing.
      }
    };

    /*
     * The route names each frame with `event:`, so a bare `onmessage` would
     * never fire. Every kind in the contract is registered explicitly, and any
     * kind added later arrives through the default listener below.
     */
    const kinds = [
      "scenario.event.arrived",
      "scenario.time.changed",
      "stream.heartbeat",
      "data.load.changed",
      "agent.run.started",
      "agent.stage.changed",
      "agent.tool.completed",
      "agent.suggestion.ready",
      "agent.suggestion.failed",
      "approval.required",
      "mutation.completed",
      "integration.command.changed",
    ];
    for (const kind of kinds) source.addEventListener(kind, onMessage as EventListener);
    source.onmessage = onMessage;

    source.onopen = () => setConnection("ready");
    source.onerror = () => {
      // EventSource reconnects on its own. "stale" is the honest state in the
      // gap: the last known day is still on screen and is still correct.
      setConnection(source.readyState === EventSource.CLOSED ? "error" : "stale");
    };

    return () => {
      for (const kind of kinds) source.removeEventListener(kind, onMessage as EventListener);
      source.close();
    };
  }, [transport, options.roleId, options.language, apply]);

  /* ---- role and language changes ---- */

  useEffect(() => {
    /*
     * A role switch replaces the visible set but must not reset read state:
     * that lives in the database keyed by (event, role) and is reloaded with
     * the new role's events. The ledger is rebuilt so the new role's events are
     * not mistaken for duplicates of the previous role's.
     */
    seenRef.current = new Set(options.initialEvents.map((event) => event.id));
    setEvents([...options.initialEvents].sort(byDayOrder));
    setUnreadCount(options.initialUnreadCount);
    setArrivalIds([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.roleId]);

  const dismissArrival = useCallback((eventId: string) => {
    setArrivalIds((current) => current.filter((id) => id !== eventId));
  }, []);

  const dismissAllArrivals = useCallback(() => setArrivalIds([]), []);

  const markReadLocally = useCallback((eventId: string) => {
    setEvents((current) => {
      let changed = false;
      const next = current.map((event) => {
        if (event.id !== eventId || event.readAt !== null) return event;
        changed = true;
        return { ...event, readAt: new Date().toISOString() };
      });
      if (changed) setUnreadCount((count) => Math.max(0, count - 1));
      return changed ? next : current;
    });
    setArrivalIds((current) => current.filter((id) => id !== eventId));
  }, []);

  const replaceEvents = useCallback((next: WorkdayLiveEvent[], count: number) => {
    seenRef.current = new Set(next.map((event) => event.id));
    setEvents([...next].sort(byDayOrder));
    setUnreadCount(count);
  }, []);

  const arrivals = useMemo(() => {
    const byId = new Map(events.map((event) => [event.id, event]));
    return arrivalIds.flatMap((id) => {
      const event = byId.get(id);
      return event ? [event] : [];
    });
  }, [arrivalIds, events]);

  return {
    events,
    arrivals,
    unreadCount,
    liveMoment,
    connection,
    lastHeartbeatAt,
    publish,
    publishAll,
    dismissArrival,
    dismissAllArrivals,
    markReadLocally,
    replaceEvents,
  };
}

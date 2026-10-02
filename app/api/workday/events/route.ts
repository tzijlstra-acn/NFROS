/**
 * GET /api/workday/events
 *
 * The event channel. Server sent events, carrying `WorkdayStreamEvent` from
 * `src/workday/contracts.ts` unchanged, because the AI Partner, the focus queue
 * and the integration runtime publish into the same contract and a second
 * envelope would make them disagree about what an event is.
 *
 * Why polling the database rather than an in-process emitter. Server actions
 * and route handlers are separate bundles in this Next.js setup, so a module
 * level `EventEmitter` is not reliably the same object in both: the player
 * would advance the day in one instance and the channel would listen to
 * another. The database is the one thing both halves genuinely share. The poll
 * is 1200ms, comfortably inside one scenario step even at double speed and
 * cheap against a local SQLite file, and it reads a cursor rather than the
 * whole day.
 *
 * Why no real-time infrastructure. The brief rules it out, and nothing here
 * needs it: one presenter, one process, one day.
 *
 * The transport degrades on purpose. Every payload this route sends can also be
 * produced by `src/scenario/live-actions.ts` and handed to the client reducer
 * directly, which is what presenter safe and offline mode do. The client code
 * path is identical either way.
 */

import { DEFAULT_RUN_ID, ROLE_IDS, type RoleId } from "@/db/schema/core";
import { isDatabaseReady } from "@/db/client";
import { getLiveEventsForRole } from "@/scenario/engine/live-events";
import { getScenarioState } from "@/scenario/engine/state";
import { momentToMinutes } from "@/domain/nfr/calculators";
import type { Language } from "@/i18n/labels";
import type { WorkdayStreamEvent } from "@/workday/contracts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** How often the day is re-read. The shortest scenario step is 1700ms. */
const POLL_MS = 1200;

/**
 * How often a comment frame goes out.
 *
 * Idle proxies and some browsers close a stream that has said nothing for a
 * while, and a silent close looks exactly like a working connection until the
 * first event fails to arrive. Fifteen seconds is comfortably inside the
 * shortest idle timeout this has to survive.
 */
const HEARTBEAT_MS = 15_000;

/** A hard ceiling so a forgotten tab cannot hold a connection open all day. */
const MAX_LIFETIME_MS = 30 * 60 * 1000;

function isRoleId(value: string | null): value is RoleId {
  return value !== null && (ROLE_IDS as readonly string[]).includes(value);
}

/**
 * The cursor.
 *
 * Scenario time plus sort order, not a row count: the integration runtime may
 * insert an event at a moment the day has already passed, and a count based
 * cursor would skip it. Formatted so string comparison is ordering.
 */
function cursorFor(moment: string, sortOrder: number): string {
  return `${String(momentToMinutes(moment)).padStart(4, "0")}-${String(sortOrder).padStart(5, "0")}`;
}

export function GET(request: Request): Response {
  const url = new URL(request.url);
  const requestedRole = url.searchParams.get("roleId");
  const runId = url.searchParams.get("runId") ?? DEFAULT_RUN_ID;

  if (!isDatabaseReady()) {
    return new Response(
      JSON.stringify({ error: "The scenario has not been seeded." }),
      { status: 503, headers: { "content-type": "application/json", "cache-control": "no-store" } },
    );
  }

  const state = getScenarioState(runId);
  if (!state) {
    return new Response(JSON.stringify({ error: `No scenario run ${runId}.` }), {
      status: 404,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  /*
   * The acting role comes from the run row unless the caller names a valid
   * one. A caller naming a role it is not is harmless here because this route
   * is read only and the scenario is synthetic, but the default still follows
   * the server so a stale tab does not stream another function's events after
   * a role switch.
   */
  const roleId: RoleId = isRoleId(requestedRole) ? requestedRole : state.activeRoleId;
  const language: Language = url.searchParams.get("lang") === "de" ? "de" : state.language;

  /*
   * Resume point. `last-event-id` is set by the browser automatically on an
   * EventSource reconnect, so a dropped connection resumes where it stopped
   * instead of replaying the day. The query parameter is the manual equivalent
   * for the first connection and for curl.
   */
  const startCursor =
    request.headers.get("last-event-id") ?? url.searchParams.get("cursor") ?? "";

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let cursor = startCursor;
      let lastMoment = "";
      let sinceHeartbeat = 0;
      let elapsed = 0;
      let timer: ReturnType<typeof setInterval> | null = null;

      const write = (text: string): void => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          // The consumer has gone. Teardown is idempotent, so just stop.
          teardown();
        }
      };

      const send = (payload: WorkdayStreamEvent, id?: string): void => {
        const lines = id === undefined ? "" : `id: ${id}\n`;
        write(`${lines}event: ${payload.kind}\ndata: ${JSON.stringify(payload)}\n\n`);
      };

      function teardown(): void {
        if (closed) return;
        closed = true;
        if (timer !== null) clearInterval(timer);
        timer = null;
        request.signal.removeEventListener("abort", teardown);
        try {
          controller.close();
        } catch {
          // Already closed by the runtime. Nothing to do and nothing to log:
          // a client navigating away is the normal end of a stream.
        }
      }

      const tick = (): void => {
        if (closed) return;
        elapsed += POLL_MS;
        sinceHeartbeat += POLL_MS;

        try {
          const current = getScenarioState(runId);
          if (!current) {
            teardown();
            return;
          }

          if (current.currentMoment !== lastMoment) {
            lastMoment = current.currentMoment;
            send({ kind: "scenario.time.changed", moment: current.currentMoment, live: true });
          }

          const events = getLiveEventsForRole(roleId, { runId, language });
          const arrived = events.filter(
            (event) =>
              momentToMinutes(event.atMoment) <= momentToMinutes(current.currentMoment) &&
              cursorFor(event.atMoment, event.sortOrder) > cursor,
          );

          for (const event of arrived) {
            const id = cursorFor(event.atMoment, event.sortOrder);
            send({ kind: "scenario.event.arrived", event }, id);
            if (id > cursor) cursor = id;
          }
        } catch (error) {
          // A locked database during a reseed is transient. Report it once as a
          // load state change and keep the connection, rather than dropping the
          // client into a reconnect loop against a database that is mid-write.
          send({
            kind: "data.load.changed",
            region: "live-day",
            state: "stale",
            detail: error instanceof Error ? error.message : "The day could not be read.",
          });
        }

        if (sinceHeartbeat >= HEARTBEAT_MS) {
          sinceHeartbeat = 0;
          send({ kind: "stream.heartbeat", at: new Date().toISOString() });
        }

        if (elapsed >= MAX_LIFETIME_MS) teardown();
      };

      request.signal.addEventListener("abort", teardown);
      if (request.signal.aborted) {
        teardown();
        return;
      }

      /*
       * A comment frame first. Browsers and intermediaries buffer until they
       * have seen some bytes, and without this the connection reads as pending
       * for a full poll interval, which looks like a broken channel.
       */
      write(": live day channel open\n\n");
      send({ kind: "data.load.changed", region: "live-day", state: "ready", detail: "Connected." });

      // Prime the client with the day as it stands, so a reload does not wait
      // for the next arrival to find out what time it is.
      lastMoment = state.currentMoment;
      send({ kind: "scenario.time.changed", moment: state.currentMoment, live: true });

      if (startCursor === "") {
        // First connection: the cursor starts at the live moment so the client
        // is not flooded with the whole morning as though it had just arrived.
        const events = getLiveEventsForRole(roleId, { runId, language });
        const latest = events
          .filter(
            (event) =>
              momentToMinutes(event.atMoment) <= momentToMinutes(state.currentMoment),
          )
          .map((event) => cursorFor(event.atMoment, event.sortOrder))
          .sort();
        cursor = latest[latest.length - 1] ?? "";
      }

      send({ kind: "stream.heartbeat", at: new Date().toISOString() });

      timer = setInterval(tick, POLL_MS);
    },

    cancel() {
      // `start` registers teardown on the abort signal, which fires for every
      // normal cancellation, so there is nothing left to release here.
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
      // Stops a reverse proxy buffering the stream into uselessness.
      "x-accel-buffering": "no",
    },
  });
}

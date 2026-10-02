/**
 * The seam between the shell and the live day player.
 *
 * The shell mounts this once per route, which is what makes the player state
 * shared across the eight workday routes rather than per screen, and therefore
 * what makes "jump to live" mean the same thing everywhere.
 *
 * All this does is read the snapshot on the server and hand it to the bar, so
 * the bar arrives populated rather than empty with a skeleton over it. The
 * event channel takes over from there.
 *
 * There was briefly a second implementation of this bar inside the shell
 * directory, written while the player was still being built so the geometry
 * could be reviewed. It is deleted, and the reason is worth recording because
 * it was not a matter of taste: it drove the clock with `actionSetMoment`, so
 * stepping backwards rewound LIVE time for the whole scenario rather than
 * moving the viewed moment. That breaks the rule the whole live day rests on.
 * Time is a view; decisions are facts.
 */

import { getResolvedDemoMode } from "@/server/config/runtime";
import { actionLiveDaySnapshot } from "@/scenario/live-actions";
import { LiveDayBar } from "@/components/live-day/LiveDayBar";

export async function LiveDaySlot() {
  const snapshot = await actionLiveDaySnapshot();
  const mode = getResolvedDemoMode().mode;

  return (
    <LiveDayBar
      roleId={snapshot.roleId}
      language={snapshot.language}
      player={snapshot.player}
      events={snapshot.events}
      dayMoments={snapshot.dayMoments}
      unreadCount={snapshot.unreadCount}
      /*
       * Presenter safe and offline drive the same client contract from server
       * action results rather than from the channel. That is the acceptance
       * criterion about the three modes sharing one state machine: only the
       * origin of the payload differs, never the shape.
       */
      transport={mode === "live" ? "stream" : "local"}
    />
  );
}

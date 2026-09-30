"use client";

/**
 * Demonstration mode selector.
 *
 * Live mode is offered only when a key was actually resolved. Offering a
 * choice that will silently downgrade would undermine the one thing a
 * presenter needs from this control, which is certainty about what will happen
 * when they click.
 */

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionSetDemoMode } from "@app/mode-actions";
import { DEMO_MODES, type DemoMode } from "@/server/config/demo-mode";

const DESCRIPTIONS: Record<DemoMode, string> = {
  live: "Real calls, streaming, specialist delegation.",
  safe: "Cached beats, deterministic timing.",
  offline: "No calls at all, seeded responses only.",
};

export function ModeSelector({
  current,
  liveAvailable,
}: {
  current: DemoMode;
  liveAvailable: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  const set = (mode: DemoMode) => {
    if (mode === current) return;
    start(async () => {
      await actionSetDemoMode(mode);
      router.refresh();
    });
  };

  return (
    <div className="stack stack-2" data-pending={pending}>
      <div className="segmented" role="group" aria-label="Demonstration mode">
        {DEMO_MODES.map((mode) => {
          const disabled = mode === "live" && !liveAvailable;
          return (
            <button
              key={mode}
              type="button"
              className="segmented-option"
              aria-pressed={mode === current}
              disabled={disabled || pending}
              title={disabled ? "No usable OpenAI key was resolved, so live mode is unavailable." : DESCRIPTIONS[mode]}
              onClick={() => set(mode)}
            >
              {mode}
            </button>
          );
        })}
      </div>
      <span className="meta">{DESCRIPTIONS[current]}</span>
    </div>
  );
}

/**
 * The partner status mark and its text state.
 *
 * Server safe: no hooks and no handlers, so the header can render this from a
 * server component when the shell has the state already.
 *
 * What this component is not, and the rule behind each refusal.
 *
 * It is not a face, a robot, an orb or a sparkle. The product is a neutral
 * work tool, and an anthropomorphic mark makes a claim about the nature of
 * the thing that the authority model spends the rest of the interface
 * carefully qualifying. What it renders instead is `.app-partner-mark`, a
 * 22px abstract square carrying a state dot, written in the stylesheet for
 * exactly this purpose.
 *
 * It does not animate on its own. The sheen and the live dot are the only
 * permitted motion and both are driven from a real running flag passed by the
 * caller. An interface that pulses while nothing is happening is lying about
 * work, and it is the single easiest lie for an AI product to tell.
 */

import {
  AI_PARTNER_STATE_LABELS,
  AI_PARTNER_STATE_TONE,
  pick,
  type AIPartnerState,
} from "@/workday/contracts";
import type { Language } from "@/i18n/labels";
import { PARTNER_STATE_DETAIL, partnerLabel } from "./labels";

/**
 * The three states where motion is permitted at all.
 *
 * Even with `running` true, a `ready` or `monitoring` partner stays still:
 * the flag says an operation is in flight somewhere, the state says whether
 * this surface is the one doing it.
 */
const MOTION_STATES: AIPartnerState[] = ["checking-evidence", "preparing", "executing"];

/** True when the sheen and the pulsing dot may run. */
export function partnerMotionAllowed(state: AIPartnerState, running: boolean): boolean {
  return running && MOTION_STATES.includes(state);
}

export function AIPartnerMark({
  state,
  running = false,
  label,
}: {
  state: AIPartnerState;
  running?: boolean;
  /** Accessible name. Defaults to the state label. */
  label?: string;
}) {
  const motion = partnerMotionAllowed(state, running);
  const tone = AI_PARTNER_STATE_TONE[state];

  return (
    <span
      className="app-partner-mark app-sheen"
      data-state={state}
      data-running={motion}
      role="img"
      aria-label={label ?? ""}
    >
      <span className="app-dot" data-tone={tone} data-live={motion} aria-hidden="true" />
    </span>
  );
}

/**
 * The mark, the state name and one line of detail.
 *
 * `compact` drops the detail line, which is what the collapsed presence rail
 * and the chat header use. The state name is never dropped: colour alone has
 * to carry no meaning anywhere in this product.
 */
export function AIStatus({
  state,
  language,
  running = false,
  detail,
  compact = false,
}: {
  state: AIPartnerState;
  language: Language;
  running?: boolean;
  /** Overrides the standard line, for example a server supplied stage label. */
  detail?: string;
  compact?: boolean;
}) {
  const stateLabel = pick(AI_PARTNER_STATE_LABELS[state], language);
  const pair = PARTNER_STATE_DETAIL[state];
  const line = detail ?? (pair ? pick(pair, language) : "");

  return (
    <div className="app-row">
      <AIPartnerMark state={state} running={running} label={stateLabel} />
      <div className="app-stack-1 app-grow">
        <span className="app-strong" style={{ fontSize: "var(--app-text-sm)" }}>
          {partnerLabel("partnerTitle", language)}
        </span>
        {compact ? null : <span className="app-meta">{line || stateLabel}</span>}
      </div>
      <span className="app-meta app-shrink-0">{stateLabel}</span>
    </div>
  );
}

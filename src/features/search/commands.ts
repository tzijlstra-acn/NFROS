/**
 * The eight palette commands, built from what the day actually holds.
 *
 * Pure. The read model gathers the facts (the next meeting, the running
 * process, the open decision count) and this turns them into commands. A
 * command whose target does not exist is still listed, so the palette has the
 * same shape every day, but it is marked unavailable with the reason in words:
 * "No further meeting today" is an answer, and a command that silently does
 * nothing is not.
 *
 * Nothing here executes anything. Every command either navigates, narrows the
 * search, or opens a panel through the chrome; none of them writes, approves
 * or records, so the palette cannot become a path around the authority gate.
 */

import type { Language } from "@/i18n/labels";
import {
  COMMAND_DETAIL,
  COMMAND_KEYWORDS,
  COMMAND_LABELS,
  COMMAND_UNAVAILABLE,
  fill,
  say,
} from "./copy";
import type { PaletteCommand, PaletteCommandId } from "./types";

/** A target the read model found, or the reason there is none. */
export type CommandTarget =
  | { found: true; href: string; detail: string }
  | { found: false; reason: "none-scheduled" | "none-remaining" | "none-active" };

export interface CommandFacts {
  roleId: string;
  language: Language;
  nextMeeting: CommandTarget;
  currentProcess: CommandTarget;
  /** Open decisions, counted exactly as the Decisions page and the rail badge count them. */
  openDecisions: number;
}

function base(id: PaletteCommandId, language: Language): Pick<PaletteCommand, "id" | "label" | "keywords"> {
  return { id, label: say(COMMAND_LABELS[id], language), keywords: COMMAND_KEYWORDS[id] };
}

/**
 * A navigation command from a target the read model found or did not find.
 *
 * An unavailable command keeps a navigate action to the role's own Home so the
 * type stays simple, and the palette never runs it: `available` is false and
 * the row is rendered disabled with its reason.
 */
function fromTarget(
  id: PaletteCommandId,
  target: CommandTarget,
  roleId: string,
  language: Language,
): PaletteCommand {
  if (target.found) {
    return {
      ...base(id, language),
      detail: target.detail,
      action: { kind: "navigate", href: target.href },
      available: true,
      unavailableReason: null,
    };
  }
  const reason =
    target.reason === "none-scheduled"
      ? COMMAND_UNAVAILABLE.noMeeting
      : target.reason === "none-remaining"
        ? COMMAND_UNAVAILABLE.noFurtherMeeting
        : COMMAND_UNAVAILABLE.noProcess;
  return {
    ...base(id, language),
    detail: null,
    action: { kind: "navigate", href: `/workday/${roleId}` },
    available: false,
    unavailableReason: say(reason, language),
  };
}

export function buildPaletteCommands(facts: CommandFacts): PaletteCommand[] {
  const { roleId, language } = facts;
  const workday = `/workday/${roleId}`;

  return [
    {
      ...base("open-current-work", language),
      detail: say(COMMAND_DETAIL.work, language),
      action: { kind: "navigate", href: `${workday}/work` },
      available: true,
      unavailableReason: null,
    },
    fromTarget("open-next-meeting", facts.nextMeeting, roleId, language),
    {
      ...base("find-supplier", language),
      detail: say(COMMAND_DETAIL.findSupplier, language),
      action: { kind: "search", searchKind: "supplier" },
      available: true,
      unavailableReason: null,
    },
    {
      ...base("find-control", language),
      detail: say(COMMAND_DETAIL.findControl, language),
      action: { kind: "search", searchKind: "control" },
      available: true,
      unavailableReason: null,
    },
    fromTarget("open-current-process", facts.currentProcess, roleId, language),
    {
      ...base("review-decisions", language),
      detail:
        facts.openDecisions > 0
          ? fill(say(COMMAND_DETAIL.decisionsOpen, language), { count: facts.openDecisions })
          : say(COMMAND_DETAIL.decisionsNone, language),
      action: { kind: "navigate", href: `${workday}/decisions` },
      available: true,
      unavailableReason: null,
    },
    {
      ...base("ask-ai", language),
      detail: say(COMMAND_DETAIL.ask, language),
      action: { kind: "ask-ai" },
      available: true,
      unavailableReason: null,
    },
    {
      ...base("open-evidence", language),
      detail: say(COMMAND_DETAIL.evidence, language),
      action: { kind: "evidence" },
      available: true,
      unavailableReason: null,
    },
  ];
}

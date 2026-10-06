/**
 * The shape of Updates.
 *
 * Updates is the shell's list of what materially changed for the role and
 * needs the person to know. It is read from the OS event backbone
 * (`src/features/events/backbone.ts`), and only six kinds of event are
 * material enough to appear in it. Everything else the backbone records (a
 * stage opened, a preparation started, a tool ran as expected) stays in the
 * activity and audit history where it belongs, because a list that announces
 * every fact is a list nobody reads.
 *
 * Client safe: nothing here reads the database.
 */

import type { Language } from "@/i18n/labels";

/**
 * The six material categories, in priority order.
 *
 * The order is the budget's order: when more is material than the budget
 * allows, a failed execution is raised before a blocked process, and both
 * before a routine's new work.
 */
export const UPDATE_CATEGORIES = [
  "execution-failed",
  "process-blocked",
  "human-input-required",
  "deadline-approaching",
  "material-change",
  "routine-created-work",
] as const;

export type UpdateCategory = (typeof UPDATE_CATEGORIES)[number];

/** Where an update was read from. */
export type UpdateOrigin =
  /** An event published on the backbone. */
  | "backbone"
  /** A seeded arrival, read through the backbone's `includeArrivals`. */
  | "live-event"
  /** The action register, for due dates: the backbone has no deadline event. */
  | "action-register";

export interface UpdateItem {
  /**
   * The identity of the thing the update is about. Two events about the same
   * decision, task or stage preparation share a key and raise one update.
   */
  key: string;
  category: UpdateCategory;
  /** What needs the person, in one line. */
  title: string;
  /** Which object or stage, as recorded. */
  detail: string | null;
  /** Scenario moment of the latest event behind the update, when it has one. */
  atMoment: string | null;
  /**
   * When it happened, as the panel prints it: the scenario clock for today,
   * the date for an earlier day. A task created on 01.10 and still open is
   * shown as 01.10.2026, not as "10:00" beside a 07:45 clock.
   */
  when: string | null;
  /** Where it opens. Always a workday route of the same role. */
  href: string;
  origin: UpdateOrigin;
  /** The backbone event, arrival or action the update was raised from. */
  sourceId: string;
  /**
   * Set for an arrival, which the person can mark as read. Every other update
   * is a state, not a message: it clears when the work it names is done, and
   * marking it read would hide work that still needs the person.
   */
  readableEventId: string | null;
  /** Recency within a category: higher is newer. */
  rank: number;
}

export interface NotificationBudget {
  /** The most updates raised at once. */
  total: number;
  /** The most updates of one category raised at once. */
  perCategory: number;
}

export interface UpdatesView {
  roleId: string;
  language: Language;
  atMoment: string;
  /** `unavailable` when the backbone could not be read; never a guessed list. */
  state: "present" | "empty" | "unavailable";
  /** Raised within the budget. The header and the bottom bar count exactly these. */
  raised: UpdateItem[];
  /** Material, but beyond the budget. Shown behind a disclosure, never counted. */
  heldBack: UpdateItem[];
  budget: NotificationBudget;
}

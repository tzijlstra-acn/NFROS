/**
 * The shape of the role Home.
 *
 * Home answers five questions, one per region, and every answer is read from
 * rows that exist at the moment of the request:
 *
 *   Now          the one item that needs the person, with what changed, why it
 *                matters, what to do and by when, as far as the data says;
 *   Next         up to three items in the attention order;
 *   Your day     the next meeting, the open actions and the inbox items that
 *                need attention, as counts of real rows;
 *   Partner      what the AI Partner actually did today, one statement per
 *                piece of work, each linked to what it created or touched;
 *   Done         what was completed today, split into work handled without
 *                the person and work the person completed.
 *
 * There is no fallback anywhere in this shape. A region with nothing to say
 * says so with `state: "empty"`, and a region whose source the database
 * cannot answer says so with `state: "unavailable"`. The status words follow
 * the product vocabulary (plan section 9.2): Empty and Unavailable, never a
 * plausible number in place of a missing row.
 */

import type { RoleId } from "@/db/schema/core";
import type { NowDetail } from "@/db/repositories/focus";
import type { Language } from "@/i18n/labels";
import type { FocusItemView, FocusSection } from "@/workday/contracts";

export type HomeState = "present" | "empty" | "unavailable";

/* ==========================================================================
   Lineage
   ========================================================================== */

/**
 * What a statement points at.
 *
 * `work` kinds are the objects a professional opens (a decision, an action, a
 * message, a meeting, a process stage, a domain object). `record` kinds are
 * the rows that prove the statement (an activity entry, a background action,
 * a receipt line, a backbone event). Every statement carries at least one of
 * either, and the interface links the first one that has somewhere to go.
 */
export type LineageKind =
  | "decision"
  | "action"
  | "message"
  | "meeting"
  | "stage"
  | "object"
  | "suggestion"
  | "activity"
  | "background-action"
  | "receipt"
  | "event";

export interface LineageRef {
  kind: LineageKind;
  /** The identifier of the row the statement came from or created. */
  id: string;
  /** What the interface shows for it: an identifier or a recorded title. */
  label: string;
  /** Where it opens. Always a workday route for the same role. */
  href: string;
}

/* ==========================================================================
   Now
   ========================================================================== */

export interface HomeNow {
  detail: NowDetail;
  /**
   * What changed, for this item specifically, or null when no row records it.
   *
   * Read from the suggestion that prepared the item, the live event that
   * brought it, or the background action that escalated it. Never the
   * role-wide change list, which is about the day and not about this item.
   */
  whatChanged: string | null;
  /** The record the change line was read from, so the line has lineage too. */
  whatChangedSource: LineageRef | null;
}

/* ==========================================================================
   Your day
   ========================================================================== */

export interface YourDayMeeting {
  /** `present` with a meeting; `empty` with the reason there is none. */
  state: HomeState;
  /** "none-scheduled" and "none-remaining" are different facts. */
  reason: "next" | "none-scheduled" | "none-remaining" | "unavailable";
  time: string | null;
  title: string | null;
  href: string;
  lineage: LineageRef | null;
  /** What the cell says: the meeting, or the empty or unavailable sentence. */
  value: string;
}

export interface YourDayActions {
  state: HomeState;
  /** Every open action on the desk, overdue and blocked ones included. */
  open: number;
  /** Open and past due, as the Work Hub classifies it. */
  overdue: number;
  /** Open and blocked by its latest history entry, as the Work Hub classifies it. */
  blocked: number;
  href: string;
  /** "6 open, 1 overdue, 1 blocked", or "No open actions". */
  value: string;
}

export interface YourDayInbox {
  state: HomeState;
  /** Revealed, unread, triaged to a decision or an action, and not yet converted. */
  needsAttention: number;
  href: string;
  /** "2 need attention", or "Nothing needs attention". */
  value: string;
}

export interface YourDay {
  meeting: YourDayMeeting;
  actions: YourDayActions;
  inbox: YourDayInbox;
}

/* ==========================================================================
   Partner update
   ========================================================================== */

/**
 * Where a statement came from. Each value names one table or one backbone
 * event type, so a statement can always be traced to the rows behind it.
 */
export type PartnerSource =
  | "prepared"
  | "preparation"
  | "routine"
  | "executed"
  | "conversion"
  | "follow-up"
  | "escalation"
  | "contradiction"
  | "activity";

export interface PartnerStatement {
  /** Stable, so a list can key on it and a test can find it. */
  id: string;
  source: PartnerSource;
  text: string;
  /** Scenario moment the work happened, when the row records one. */
  atMoment: string | null;
  /** Never empty. A statement without lineage is not emitted. */
  lineage: LineageRef[];
}

export interface PartnerSourceStatus {
  source: PartnerSource;
  /** `present` contributed, `empty` was read and had nothing, `unavailable` could not be read. */
  state: HomeState;
}

export interface PartnerUpdate {
  state: HomeState;
  /** At most `PARTNER_STATEMENT_LIMIT`, most useful first. */
  statements: PartnerStatement[];
  /** Statements beyond the cap, available behind a disclosure. */
  more: PartnerStatement[];
  /** Every source consulted and what it returned, so a gap is visible. */
  sources: PartnerSourceStatus[];
}

/* ==========================================================================
   Done
   ========================================================================== */

export interface DoneRow {
  id: string;
  /** "decision", "stage", "action", "meeting" for work by the person. */
  kind: "decision" | "stage" | "action" | "meeting" | "stage-decision";
  title: string;
  /** Scenario moment or recorded time, as the row holds it. */
  at: string | null;
  lineage: LineageRef;
}

export interface DoneSummary {
  state: HomeState;
  total: number;
  /** Units of work completed without the person: background rows and completed suggestions. */
  automatic: number;
  /** Decisions recorded, stages completed, actions completed and meetings concluded today. */
  byYou: number;
  /** The grouped rows the focus queue already renders for automatic work. */
  automaticRows: FocusItemView[];
  byYouRows: DoneRow[];
}

/* ==========================================================================
   The whole Home
   ========================================================================== */

export interface HomeView {
  roleId: RoleId;
  language: Language;
  atMoment: string;
  /** One sentence of counted fact under the page title. */
  contextLine: string;
  now: HomeNow | null;
  /** At most three, in the attention order. */
  next: FocusItemView[];
  watching: FocusItemView[];
  /** The one inline AI line, or null. */
  suggestion: { id: string; body: string; href: string } | null;
  queueHref: string;
  yourDay: YourDay;
  partner: PartnerUpdate;
  done: DoneSummary;
  /** Section counts from the queue, for the context line and tests. */
  counts: Record<FocusSection, number>;
}

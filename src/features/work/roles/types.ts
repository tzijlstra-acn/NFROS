/**
 * The shape of a role's Work Hub configuration.
 *
 * The shared modules know how to show an agenda, a meeting, an action and a
 * message. They do not know what an Operational Risk Partner calls a
 * workshop, which action kinds a Third-Party Risk Manager may not close
 * without evidence, or what a reminder to a supplier contact should say. That
 * knowledge is configuration, and it lives in one file per role so that
 * adding professional depth to one role cannot change the other.
 *
 * Six groups, matching the plan's list for both roles: meeting types, agenda
 * labels, action kinds, inbox classifications, related object types and
 * professional actions. Each value is bilingual.
 */

import type { Pair } from "../copy";
import type { Tone } from "../model";

export interface ActionKindConfig {
  label: Pair;
  /**
   * Whether closing an action of this kind requires cited evidence.
   *
   * The completion operation refuses without evidence when this is true, and
   * the tool handler refuses again on its own, so the rule does not depend on
   * the interface having been used.
   */
  evidenceRequired: boolean;
  /**
   * A measurable completion condition the AI may propose for this kind.
   * Placeholders: `{object}`, `{due}`.
   */
  completionTemplate: Pair;
}

export interface MeetingTypeConfig {
  label: Pair;
  /**
   * The stage of the role's installed process this kind of meeting feeds,
   * when there is one. Used to say which stage a meeting serves; the link is
   * only shown when the meeting is also in the scope of a running process.
   */
  processStageId: string | null;
}

export interface InboxClassificationConfig {
  label: Pair;
  tone: Tone;
  /** The one primary action the classification implies, in the role's words. */
  primaryAction: Pair;
}

export interface EscalationRoute {
  committeeRef: string;
  committeeName: string;
  /** ISO date of the next sitting the escalation is tabled for. */
  meetingDate: string;
  label: Pair;
}

export interface ProfessionalActions {
  /** The verb for opening a prepared meeting. */
  prepareMeeting: Pair;
  /** Who a reminder goes to, in the role's words. */
  reminderRecipient: Pair;
  /** Reminder template. Placeholders: `{owner}`, `{title}`, `{reference}`, `{due}`, `{condition}`. */
  reminderTemplate: Pair;
  /** Subject line of a reminder. Placeholders as above. */
  reminderSubject: Pair;
  /** What the role asks for when it requests evidence. */
  requestEvidenceHint: Pair;
  /** Where an escalated action goes. */
  escalation: EscalationRoute;
  /** The focus time the AI proposes protecting before a meeting, in the role's words. */
  reserveFocus: Pair;
}

export interface WorkRoleConfig {
  roleId: "rcsa" | "tprm";
  /** Agenda entry kinds, as the role names them. */
  agendaLabels: Record<string, Pair>;
  meetingTypes: Record<string, MeetingTypeConfig>;
  actionKinds: Record<string, ActionKindConfig>;
  /**
   * Action kinds that are material whatever their priority.
   *
   * A high priority action, or one raised against an issue, is material as
   * well. Material means closure and due date changes need a confirmed human
   * approval, and the interface says so before the person acts.
   */
  materialActionKinds: readonly string[];
  inboxClassifications: Record<string, InboxClassificationConfig>;
  /** Object kinds as the role calls them: a control, a supplier, an indicator. */
  relatedObjectTypes: Record<string, Pair>;
  professionalActions: ProfessionalActions;
}

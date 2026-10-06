/**
 * The data every Work Hub module shares.
 *
 * The hub loads this once per request and hands it to each module, so four
 * tabs do not each query the calendar, the meetings and the actions for
 * themselves. Each module then loads only what is specific to it (an
 * action's progress history, a meeting's evidence pack) as its "extras".
 *
 * Types only, plus pure lookups over them. The row types are the schema's own
 * inferred types, imported as types, so a module read model that depends on
 * this file still has no runtime dependency on the database and can be unit
 * tested with plain objects.
 */

import type { AutonomyLevel, RoleId } from "@/db/schema/core";
import type { AuthorityClass } from "@/db/schema/decisions";
import type { calendarEvents, inboxMessages, meetings } from "@/db/schema/work";
import type {
  WorkActionRow,
  WorkDecisionRef,
  WorkMinutesRow,
  WorkPerson,
  WorkProcessScope,
} from "@/db/repositories/work-hub";
import type { Language } from "@/i18n/labels";
import type { WorkRoleConfig } from "./roles/types";
import { say } from "./copy";

export type CalendarRow = typeof calendarEvents.$inferSelect;
export type MeetingRow = typeof meetings.$inferSelect;
export type InboxRow = typeof inboxMessages.$inferSelect;

/**
 * The authority gate's verdict on one tool, for this role at this autonomy.
 *
 * Computed by the hub with `evaluateAuthority` and no approval, which is the
 * gate's own way of asking "could this run, and would it need a person". The
 * modules never decide authority; they read this.
 */
export interface GateVerdict {
  toolName: string;
  authorityClass: AuthorityClass;
  /** True when the tool can run at this level, with or without an approval. */
  reachable: boolean;
  /** True when running it needs a human approval bound to the payload. */
  needsApproval: boolean;
  material: boolean;
  /** The gate's own wording when the tool is not reachable. Empty otherwise. */
  reason: string;
}

export type GateView = Readonly<Record<string, GateVerdict>>;

export interface WorkSharedData {
  roleId: RoleId;
  /** The person the roles table names as holding the role. */
  holderUserId: string | null;
  holderName: string;
  /** ISO date of the scenario day, for example "2026-10-06". */
  scenarioDate: string;
  /** Scenario clock, for example "10:30". */
  currentMoment: string;
  language: Language;
  autonomyLevel: AutonomyLevel;
  config: WorkRoleConfig;
  /** Everyone, including external contacts, for naming owners and speakers. */
  people: ReadonlyMap<string, WorkPerson>;
  /** Internal people an action may be assigned to. */
  assignable: readonly WorkPerson[];
  objectLabels: ReadonlyMap<string, { en: string; de: string }>;
  processScopes: readonly WorkProcessScope[];
  decisions: readonly WorkDecisionRef[];
  calendar: readonly CalendarRow[];
  meetings: readonly MeetingRow[];
  actions: readonly WorkActionRow[];
  minutes: readonly WorkMinutesRow[];
  /** Inbox messages visible at the current moment. */
  messages: readonly InboxRow[];
  gate: GateView;
}

/* ==========================================================================
   Lookups every module uses
   ========================================================================== */

export function personName(shared: Pick<WorkSharedData, "people">, userId: string | null | undefined): string | null {
  if (!userId) return null;
  return shared.people.get(userId)?.name ?? userId;
}

/** An object's display name, or its identifier when the scenario does not name it. */
export function objectName(
  shared: Pick<WorkSharedData, "objectLabels" | "language">,
  objectId: string | null | undefined,
): string {
  if (!objectId) return "";
  const label = shared.objectLabels.get(objectId);
  return label ? say(label, shared.language) : objectId;
}

/** The role's word for an object kind, or the kind itself. */
export function objectKindLabel(
  shared: Pick<WorkSharedData, "config" | "language">,
  kind: string | null | undefined,
): string {
  if (!kind) return "";
  const label = shared.config.relatedObjectTypes[kind];
  return label ? say(label, shared.language) : kind;
}

export function meetingTitle(meeting: Pick<MeetingRow, "title" | "titleDe">, language: Language): string {
  return language === "de" && meeting.titleDe.length > 0 ? meeting.titleDe : meeting.title;
}

export function actionTitle(action: Pick<WorkActionRow, "title" | "titleDe">, language: Language): string {
  return language === "de" && action.titleDe.length > 0 ? action.titleDe : action.title;
}

export function messageSubject(message: Pick<InboxRow, "subject" | "subjectDe">, language: Language): string {
  return language === "de" && message.subjectDe.length > 0 ? message.subjectDe : message.subject;
}

export function decisionTitle(decision: Pick<WorkDecisionRef, "title" | "titleDe">, language: Language): string {
  return language === "de" && decision.titleDe.length > 0 ? decision.titleDe : decision.title;
}

/**
 * Whether an item matches the object filter.
 *
 * An item matches when it IS the object or is linked to it, so following the
 * link from a control lands on every piece of work about that control.
 */
export function matchesObject(object: string | null, ...ids: ReadonlyArray<string | null | undefined>): boolean {
  if (object === null) return true;
  return ids.some((id) => id === object);
}

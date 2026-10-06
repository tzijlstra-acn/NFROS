/**
 * The Work Hub model.
 *
 * Types and pure functions only. No database access, no React, no server
 * imports, for the same reason `src/features/decisions/model.ts` holds that
 * line: the shapes here are read by the server components that build the hub,
 * by the client components that drive selection and operations, and by tests,
 * and none of them should drag a SQLite handle along.
 *
 * The hub is a shell plus four modules. The shell knows only what every
 * module shares: a queue on the left with its saved views and filters, one
 * selected item on the right, and the links from that item to the rest of
 * the work. Everything a module knows about its own kind of work lives in its
 * own read model under `modules/`, and everything a role calls things lives
 * in its configuration under `roles/`. That split is the point of the
 * refactor: a module can grow professional depth without the shell, or the
 * other three modules, learning anything about it.
 */

import type { WorkdaySelection } from "@/workday/contracts";

/* ==========================================================================
   Tabs and items
   ========================================================================== */

/** The four tabs, in the order they are shown. */
export const WORK_TABS = ["agenda", "meetings", "actions", "inbox"] as const;
export type WorkTab = (typeof WORK_TABS)[number];

export function isWorkTab(value: unknown): value is WorkTab {
  return typeof value === "string" && (WORK_TABS as readonly string[]).includes(value);
}

/**
 * The kinds of item a module can select.
 *
 * An agenda entry is an `event`, not a meeting: a focus block or a standing
 * huddle is on the agenda and has no meeting record behind it, and the ones
 * that do have one link to it rather than being it.
 */
export type WorkItemKind = "event" | "meeting" | "action" | "message";

/** The tab an item of each kind belongs to. */
export const HOME_TAB: Record<WorkItemKind, WorkTab> = {
  event: "agenda",
  meeting: "meetings",
  action: "actions",
  message: "inbox",
};

/** The tones the V3 chip and dot styles already define. */
export type Tone = "neutral" | "accent" | "info" | "success" | "warning" | "danger";

export interface WorkChip {
  label: string;
  tone: Tone;
  /** Longer explanation, for the hover title and assistive technology. */
  title?: string;
}

/* ==========================================================================
   The left side: queue, saved views, filters
   ========================================================================== */

/**
 * One row of a queue.
 *
 * Deliberately generic. Every module's row is a lead cell (a time, a date, a
 * channel), a title, one quiet line under it, a few chips and a trailing
 * cell. The module decides what goes in each slot; the shell decides how a
 * row looks. That is what lets one queue component render all four tabs
 * without a branch per tab.
 */
export interface QueueRowView {
  id: string;
  kind: WorkItemKind;
  lead: string;
  title: string;
  sub: string;
  chips: WorkChip[];
  trailing: string;
  trailingTone: Tone;
  /** Selects this row. Carries the rest of the query so nothing else resets. */
  href: string;
  selected: boolean;
  /** An edge colour for a row that needs attention: a conflict, an overdue date. */
  flag: Tone | null;
}

/** A group of rows under one label: a day of the week, upcoming or archived. */
export interface QueueGroup {
  id: string;
  label: string;
  rows: QueueRowView[];
  /** What to say when the group has no rows. Null hides an empty group. */
  emptyText: string | null;
  /** Secondary rows under the group, such as deadlines falling on that day. */
  notes?: QueueNote[];
}

/** A non-selectable line inside a group: a deadline, a marker. */
export interface QueueNote {
  id: string;
  text: string;
  tone: Tone;
  href: string | null;
}

/**
 * A saved view: a named, linkable combination of the module's own filters.
 *
 * Saved in the URL rather than in storage, so a view is a link a reader can
 * keep, share or come back to, and the server renders it on the first byte.
 */
export interface SavedViewLink {
  id: string;
  label: string;
  /** Null when a count would mislead, for example a calendar scope. */
  count: number | null;
  href: string;
  active: boolean;
}

export interface FilterLink {
  id: string;
  label: string;
  count: number;
  href: string;
  active: boolean;
}

/**
 * An AI proposal shown with the queue.
 *
 * Proposals change nothing. The authority class is the gate's classification
 * of the tool that would carry the proposal out, and `available` is the
 * gate's verdict at the current autonomy level, so a proposal the gate would
 * refuse says so in the gate's words rather than being offered and refused.
 */
export interface ProposalView {
  id: string;
  title: string;
  body: string;
  authorityLabel: string;
  available: boolean;
  unavailableReason: string;
  /** What the person decides, in one line. */
  decide: string;
  /** Where the proposal can be acted on, or null when nothing is connected. */
  href: string | null;
  hrefLabel: string;
}

/** The left pane of one module. */
export interface ModuleQueueView {
  tab: WorkTab;
  savedViews: SavedViewLink[];
  filters: FilterLink[];
  /** The object filter in force, when the reader followed an object link. */
  objectFilter: { id: string; label: string; clearHref: string } | null;
  groups: QueueGroup[];
  /** Shown instead of the groups when the module has nothing at all. */
  empty: { title: string; body: string } | null;
  proposals: ProposalView[];
  /** One line of counted fact for the module, never a paragraph. */
  summary: string;
}

/* ==========================================================================
   The right side: the selected item
   ========================================================================== */

export type RelatedKind =
  | "process"
  | "decision"
  | "meeting"
  | "action"
  | "message"
  | "evidence"
  | "audit"
  | "object";

/**
 * One link from the selected item to other work.
 *
 * Only links that exist are ever built: an action with no source decision has
 * no decision link, rather than a link that says "none". `drawerTab` marks a
 * link that opens the context drawer instead of navigating, which is how
 * evidence and audit stay one click away without leaving the page.
 */
export interface RelatedLink {
  kind: RelatedKind;
  id: string;
  label: string;
  href: string | null;
  drawerTab?: "evidence" | "audit";
  note?: string;
}

export interface DetailFact {
  label: string;
  value: string;
  tone?: Tone;
  mono?: boolean;
}

/** One entry of an item's history. Append only, newest last. */
export interface ActivityEntry {
  id: string;
  at: string;
  actor: string;
  text: string;
  tone: Tone;
  evidenceIds: string[];
  /** A short label for the kind of entry: Update, Reminder, Completed. */
  label: string;
}

export interface EvidenceRef {
  id: string;
  title: string;
  status: string;
  statusTone: Tone;
  stale: boolean;
  sourceSystem: string;
  /** Why this document is listed against the item. */
  relation: string;
}

export interface AuditRef {
  id: string;
  at: string;
  summary: string;
  actor: string;
  blocked: boolean;
}

/**
 * Where the item's data came from and how current it is.
 *
 * The vocabulary is the product's status vocabulary: Simulated for the
 * synthetic source systems, with the stale count named when there is one.
 */
export interface SourceFreshnessView {
  label: string;
  tone: Tone;
  detail: string;
}

/** What the AI Partner is told the reader is looking at. */
export interface AiContextView {
  selection: WorkdaySelection | null;
  /** One line saying what the partner will read, or why it reads the role instead. */
  note: string;
}

/**
 * Everything every detail pane has.
 *
 * The module specific details extend this. The shell renders the shared part
 * (title, status, facts, related work, freshness) and hands the rest to the
 * module's own detail component.
 */
export interface DetailBase {
  kind: WorkItemKind;
  id: string;
  reference: string;
  title: string;
  kindLabel: string;
  homeTab: WorkTab;
  /** Opens the item in its own tab, for when it is selected from another. */
  homeHref: string;
  status: WorkChip;
  facts: DetailFact[];
  /** The item's own text: an objective, an agenda, a body, a description. */
  context: string;
  evidence: EvidenceRef[];
  related: RelatedLink[];
  activity: ActivityEntry[];
  audit: AuditRef[];
  freshness: SourceFreshnessView | null;
  ai: AiContextView;
}

/* ==========================================================================
   The bound context, for the drawer and the partner
   ========================================================================== */

/**
 * What the Work Hub publishes for the shell when an item is selected.
 *
 * Plain serialisable data, because it crosses from a server component into the
 * client store that the context drawer and the AI Partner host read. It is a
 * projection of the detail, not a second derivation of it: `toBoundContext`
 * below is the only function that builds one.
 */
export interface BoundWorkContext {
  roleId: string;
  itemId: string;
  kind: WorkItemKind;
  kindLabel: string;
  title: string;
  reference: string;
  href: string;
  status: WorkChip;
  facts: DetailFact[];
  evidence: EvidenceRef[];
  related: RelatedLink[];
  activity: ActivityEntry[];
  audit: AuditRef[];
  ai: AiContextView;
}

export function toBoundContext(roleId: string, detail: DetailBase): BoundWorkContext {
  return {
    roleId,
    itemId: detail.id,
    kind: detail.kind,
    kindLabel: detail.kindLabel,
    title: detail.title,
    reference: detail.reference,
    href: detail.homeHref,
    status: detail.status,
    facts: detail.facts,
    evidence: detail.evidence,
    related: detail.related,
    activity: detail.activity,
    audit: detail.audit,
    ai: detail.ai,
  };
}

/* ==========================================================================
   Small pure helpers shared by the modules
   ========================================================================== */

/** "2026-10-06T10:30:00.000Z" to "10:30". Returns the input when it is not an ISO time. */
export function timeOf(iso: string): string {
  return iso.length >= 16 && iso[10] === "T" ? iso.slice(11, 16) : iso;
}

/** "2026-10-06T10:30:00.000Z" or "2026-10-06" to "2026-10-06". */
export function dateOf(iso: string): string {
  return iso.slice(0, 10);
}

/** "10:30" to minutes after midnight. */
export function minutesOf(hhmm: string): number {
  const [h = "0", m = "0"] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
}

/**
 * "2026-10-06" to "06.10.2026".
 *
 * The product displays dates in the day-first form the scenario uses in its
 * own text, so a date in a row reads the same as a date inside a document.
 */
export function displayDate(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}.${m}.${y}`;
}

/** Whole days from one ISO date to another. Positive when `to` is later. */
export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)));
  const b = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
  return Math.round((b - a) / 86_400_000);
}

/** Adds whole days to an ISO date. */
export function addDays(isoDate: string, days: number): string {
  const t = Date.UTC(
    Number(isoDate.slice(0, 4)),
    Number(isoDate.slice(5, 7)) - 1,
    Number(isoDate.slice(8, 10)) + days,
  );
  return new Date(t).toISOString().slice(0, 10);
}

/** The Monday of the ISO week that contains the date. */
export function weekStart(isoDate: string): string {
  const t = new Date(`${isoDate.slice(0, 10)}T00:00:00.000Z`);
  const weekday = (t.getUTCDay() + 6) % 7;
  return addDays(isoDate.slice(0, 10), -weekday);
}

/** The first clause of a text, for a one line row. */
export function firstLine(text: string, limit = 120): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= limit) return trimmed;
  const cut = trimmed.slice(0, limit);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(", "), cut.lastIndexOf("; "));
  return `${(stop > limit / 2 ? cut.slice(0, stop) : cut.slice(0, cut.lastIndexOf(" "))).trim()}...`;
}

/**
 * The shared contracts of the interactive workday.
 *
 * This module is the seam between the parts of the V2 experience that are
 * built independently: the shell, the live day player, the AI Partner, the
 * focus queue, the role workspaces and the integration runtime. Everything
 * crossing those boundaries is typed here so the boundaries stay honest.
 *
 * It holds types, label maps and pure functions only. No database access, no
 * React, no server imports. That keeps it importable from a client component,
 * a server component, a route handler and a test without pulling a runtime
 * along behind it.
 */

import { z } from "zod";
import type { RoleId, AutonomyLevel } from "@/db/schema/core";
import type { AuthorityClass } from "@/db/schema/decisions";
import type {
  LiveEventSeverity,
  LiveEventType,
  SuggestionStatus,
  AIGenerationStateName,
} from "@/db/schema/live";
import type { ConnectorMode, FreshnessState } from "@/db/schema/integration";

/* ==========================================================================
   Feature flag
   ========================================================================== */

export const WORKDAY_UI_VERSIONS = ["v1", "v2", "v3.1"] as const;

/**
 * The route segments that have a V3.1 implementation of their own.
 *
 * This list exists because the migration is per route, not all at once, and
 * because getting that wrong produced a visible defect rather than a cosmetic
 * one. The layout applied the V3.1 frame whenever the version resolved to
 * V3.1, and the page fell back to V2 whenever no V3 component was registered
 * for the route. On every route except the role home that meant a V3.1 frame
 * wrapped around a complete V2 shell: measured on `/workday/rcsa/decisions`,
 * three `header` elements and two `main` elements in one document, which is
 * precisely what the layout's own comment claimed to rule out.
 *
 * So the version is downgraded for a route that cannot honour it. One frame,
 * one header, and the fallback is an honest V2 page rather than a hybrid.
 *
 * The empty string is the role home. Add a segment here in the same change
 * that adds its `v3.tsx`, and the two can never disagree.
 */
export const V3_NATIVE_SEGMENTS: readonly string[] = [
  "",
  "work",
  "decisions",
  "processes",
];

/** Whether a workday pathname can be rendered by V3.1. */
export function isV3NativePath(pathname: string): boolean {
  /*
   * `/workday/<role>` has three parts once the leading empty one is dropped,
   * and anything longer carries a segment. The role itself is not checked
   * here: an unknown role is the layout's business and it calls `notFound`.
   */
  const parts = pathname.split("/").filter((part) => part.length > 0);
  if (parts[0] !== "workday") return false;
  const segment = parts[2] ?? "";
  return V3_NATIVE_SEGMENTS.includes(segment);
}
export type WorkdayUiVersion = (typeof WORKDAY_UI_VERSIONS)[number];

/**
 * Which interface is served when nothing asks for one.
 *
 * V3.1 becomes the default only after its own visual review and QA pass, so
 * this constant is the single switch for that decision rather than a change
 * spread across the route files.
 */
export const DEFAULT_WORKDAY_UI: WorkdayUiVersion = "v3.1";

/**
 * The version a reviewer means by "the current one".
 *
 * `?ui=current` is an alias rather than a fourth version. During a migration
 * the word "current" moves, and an alias moves with it; a literal would have
 * to be found and changed everywhere it was written down.
 */
export const CURRENT_WORKDAY_UI: WorkdayUiVersion = "v3.1";

/** Aliases accepted in the query string, resolved before validation. */
const UI_ALIASES: Record<string, WorkdayUiVersion> = {
  current: CURRENT_WORKDAY_UI,
  v3: "v3.1",
  "v3.1": "v3.1",
  latest: "v3.1",
};

export function isWorkdayUiVersion(value: unknown): value is WorkdayUiVersion {
  return typeof value === "string" && (WORKDAY_UI_VERSIONS as readonly string[]).includes(value);
}

/** Resolves an alias or a literal to a version, or null when neither. */
export function normaliseWorkdayUi(value: unknown): WorkdayUiVersion | null {
  if (typeof value !== "string") return null;
  const lowered = value.trim().toLowerCase();
  const aliased = UI_ALIASES[lowered];
  if (aliased) return aliased;
  return isWorkdayUiVersion(lowered) ? lowered : null;
}

/**
 * Resolves which interface to render.
 *
 * A query parameter wins over the environment so a reviewer can put the two
 * versions side by side in two tabs without restarting anything. Both read
 * the same database, the same scenario run and the same authority gate, so
 * the comparison is of presentation only.
 */
export function resolveWorkdayUi(
  queryValue: unknown,
  envValue: unknown,
): { version: WorkdayUiVersion; source: "query" | "environment" | "default" } {
  const fromQuery = normaliseWorkdayUi(queryValue);
  if (fromQuery) return { version: fromQuery, source: "query" };
  const fromEnv = normaliseWorkdayUi(envValue);
  if (fromEnv) return { version: fromEnv, source: "environment" };
  return { version: DEFAULT_WORKDAY_UI, source: "default" };
}

/* ==========================================================================
   Data loading
   ========================================================================== */

/**
 * The lifecycle of deterministic data in a region of the interface.
 *
 * `partial` is the state that makes progressive population honest: some rows
 * are present and more are coming, which is different from everything being
 * present and different from nothing being present.
 */
export type DataLoadState =
  | "idle"
  | "connecting"
  | "loading"
  | "partial"
  | "ready"
  | "stale"
  | "error";

export const DATA_LOAD_LABELS: Record<DataLoadState, { en: string; de: string }> = {
  idle: { en: "Not loaded", de: "Nicht geladen" },
  connecting: { en: "Connecting to sources", de: "Verbindung zu Quellen" },
  loading: { en: "Loading", de: "Laedt" },
  partial: { en: "Loading more", de: "Laedt weiter" },
  ready: { en: "Current", de: "Aktuell" },
  stale: { en: "Last known", de: "Letzter Stand" },
  error: { en: "Source unavailable", de: "Quelle nicht verfuegbar" },
};

/** True when a region should expose `aria-busy`. */
export function isBusyState(state: DataLoadState): boolean {
  return state === "connecting" || state === "loading" || state === "partial";
}

/* ==========================================================================
   AI generation
   ========================================================================== */

export type AIGenerationState = AIGenerationStateName;

/**
 * Human readable stage labels.
 *
 * These describe observable processing steps and nothing else. They are not a
 * window onto the model's reasoning, and they must never be written as though
 * they were: the product shows that it checked four sources, never what it
 * privately thought about them.
 */
export const AI_STAGE_LABELS: Record<AIGenerationState, { en: string; de: string }> = {
  idle: { en: "Monitoring", de: "Beobachtet" },
  queued: { en: "Checking current context", de: "Prueft aktuellen Kontext" },
  retrieving: { en: "Loading evidence", de: "Laedt Nachweise" },
  reconciling: { en: "Comparing records", de: "Vergleicht Datensaetze" },
  analysing: { en: "Analysing changes", de: "Analysiert Aenderungen" },
  drafting: { en: "Preparing a suggestion", de: "Bereitet Vorschlag vor" },
  validating: { en: "Validating sources", de: "Validiert Quellen" },
  ready: { en: "Suggestion ready", de: "Vorschlag bereit" },
  blocked: { en: "Waiting for approval", de: "Wartet auf Genehmigung" },
  error: { en: "Suggestion unavailable", de: "Vorschlag nicht verfuegbar" },
};

/** The order stages progress through. Used by the stage list and by replay. */
export const AI_STAGE_ORDER: AIGenerationState[] = [
  "queued",
  "retrieving",
  "reconciling",
  "analysing",
  "drafting",
  "validating",
  "ready",
];

/** True once a suggestion may be shown. Nothing renders before validation. */
export function isPublishableState(state: AIGenerationState): boolean {
  return state === "ready";
}

/* ==========================================================================
   AI Partner state
   ========================================================================== */

/**
 * The state shown in the partner header.
 *
 * It is derived from what the application is actually doing, never set to
 * make the interface look busier than it is. `monitoring` is the honest
 * resting state and it is the one shown most of the time.
 */
export const AI_PARTNER_STATES = [
  "monitoring",
  "checking-evidence",
  "preparing",
  "ready",
  "needs-you",
  "executing",
  "completed",
  "paused",
  "offline",
] as const;
export type AIPartnerState = (typeof AI_PARTNER_STATES)[number];

export const AI_PARTNER_STATE_LABELS: Record<AIPartnerState, { en: string; de: string }> = {
  monitoring: { en: "Monitoring", de: "Beobachtet" },
  "checking-evidence": { en: "Checking evidence", de: "Prueft Nachweise" },
  preparing: { en: "Preparing", de: "Bereitet vor" },
  ready: { en: "Ready", de: "Bereit" },
  "needs-you": { en: "Needs you", de: "Benoetigt Sie" },
  executing: { en: "Executing", de: "Fuehrt aus" },
  completed: { en: "Completed", de: "Abgeschlossen" },
  paused: { en: "Paused", de: "Angehalten" },
  offline: { en: "Offline", de: "Offline" },
};

/** Which tone each partner state carries. Never colour alone: text as well. */
export const AI_PARTNER_STATE_TONE: Record<AIPartnerState, "ai" | "info" | "success" | "warning" | "neutral"> = {
  monitoring: "neutral",
  "checking-evidence": "info",
  preparing: "ai",
  ready: "ai",
  "needs-you": "warning",
  executing: "ai",
  completed: "success",
  paused: "neutral",
  offline: "neutral",
};

/** Maps a generation state onto the coarser partner state in the header. */
export function partnerStateFromGeneration(
  generation: AIGenerationState,
  options: { decisionRequired?: boolean; executing?: boolean; offline?: boolean } = {},
): AIPartnerState {
  if (options.offline) return "offline";
  if (options.executing) return "executing";
  switch (generation) {
    case "idle":
      return "monitoring";
    case "queued":
    case "retrieving":
      return "checking-evidence";
    case "reconciling":
    case "analysing":
    case "drafting":
    case "validating":
      return "preparing";
    case "ready":
      return options.decisionRequired ? "needs-you" : "ready";
    case "blocked":
      return "needs-you";
    case "error":
      return "monitoring";
  }
}

/* ==========================================================================
   Live events
   ========================================================================== */

/**
 * The normalised event the client receives.
 *
 * Deliberately flat and serialisable. The server resolves language, read
 * state and decision linkage before this crosses the boundary, so the client
 * never has to query to render a row.
 */
export interface WorkdayLiveEvent {
  id: string;
  atMoment: string;
  sortOrder: number;
  type: LiveEventType;
  roleIds: RoleId[];
  severity: LiveEventSeverity;
  title: string;
  summary: string;
  objectType: string;
  objectId: string;
  evidenceIds: string[];
  requiresDecision: boolean;
  autoPause: boolean;
  decisionId: string | null;
  derivedFrom: string;
  sourceConnectorIds: string[];
  createdAt: string;
  readAt: string | null;
  acknowledgedAt: string | null;
}

export const LIVE_EVENT_TYPE_LABELS: Record<LiveEventType, { en: string; de: string }> = {
  signal: { en: "Signal", de: "Signal" },
  message: { en: "Message", de: "Nachricht" },
  meeting: { en: "Meeting", de: "Besprechung" },
  evidence: { en: "Evidence", de: "Nachweis" },
  "agent-action": { en: "AI action", de: "KI Aktion" },
  "decision-required": { en: "Decision", de: "Entscheidung" },
  execution: { en: "Execution", de: "Ausfuehrung" },
  "shared-event": { en: "Shared event", de: "Gemeinsames Ereignis" },
};

export const SEVERITY_TONE: Record<LiveEventSeverity, "danger" | "warning" | "info" | "neutral"> = {
  critical: "danger",
  high: "warning",
  medium: "info",
  low: "neutral",
  informational: "neutral",
};

/** True when this event is visible to the given role. Empty means all roles. */
export function eventVisibleToRole(event: { roleIds: RoleId[] }, roleId: RoleId): boolean {
  return event.roleIds.length === 0 || event.roleIds.includes(roleId);
}

/* ==========================================================================
   The stream contract
   ========================================================================== */

/**
 * What the event channel publishes.
 *
 * Live, presenter safe and offline modes all publish exactly these, which is
 * the acceptance criterion about the three modes sharing one state contract.
 * Only the origin of the payload differs.
 */
export type WorkdayStreamEvent =
  | { kind: "scenario.event.arrived"; event: WorkdayLiveEvent }
  | { kind: "scenario.time.changed"; moment: string; live: boolean }
  | { kind: "agent.run.started"; roleId: RoleId; objectId: string; suggestionId: string | null }
  | {
      kind: "agent.stage.changed";
      roleId: RoleId;
      suggestionId: string | null;
      state: AIGenerationState;
      label: string;
      completedStages: AIGenerationState[];
    }
  | { kind: "agent.tool.completed"; roleId: RoleId; entry: AIActivityEntryView }
  | { kind: "agent.suggestion.ready"; roleId: RoleId; suggestion: AISuggestionView }
  | {
      kind: "agent.suggestion.failed";
      roleId: RoleId;
      objectId: string;
      reason: string;
      retryable: boolean;
    }
  | { kind: "approval.required"; roleId: RoleId; decisionId: string; suggestionId: string | null }
  | {
      kind: "mutation.completed";
      roleId: RoleId;
      decisionId: string;
      receiptLines: ExecutionReceiptLineView[];
    }
  | {
      kind: "integration.command.changed";
      commandId: string;
      status: string;
      targetSystem: string;
      attempts: number;
    }
  | { kind: "data.load.changed"; region: string; state: DataLoadState; detail: string }
  | { kind: "stream.heartbeat"; at: string };

/* ==========================================================================
   Suggestions
   ========================================================================== */

/**
 * The structured suggestion schema.
 *
 * `strict: true` is required by the Agents SDK for a Zod schema used as a
 * structured output, which is why every field is present and nullable rather
 * than optional. The five grounding arrays elsewhere in this product keep
 * fact, record, statement, inference and conflict apart; here the equivalent
 * discipline is `checksCompleted` and `actionsCompleted` being separate from
 * `recommendedAction`, so what the partner did is never blurred into what it
 * thinks should happen next.
 */
export const aiSuggestionSchema = z.object({
  headline: z.string().min(4).max(140),
  changeSummary: z.string().min(4).max(400),
  whyItMatters: z.string().min(4).max(500),
  /*
   * The per entry limits are 320 rather than 200, and that is a correction
   * rather than a preference.
   *
   * A live run against gpt-5.1 failed validation twice on "Too big: expected
   * string to have <=200 characters" for exactly these two arrays. The entries
   * were good: a check reading "Compared the first line self assessment for
   * CTL-PAY-014 against the second line control test result and found the two
   * lines disagree on effectiveness" is 150 characters, and a check naming two
   * objects and the reason reaches 260. The old limit was set by eye against
   * seeded copy that happened to be terser, and it rejected correct output.
   *
   * 320 is still a real limit. The card is read in about ten seconds, so an
   * entry that needs more than two lines is a sign the check should have been
   * two checks. The prompt states the number so the model aims below it rather
   * than discovering it through a rejection.
   */
  checksCompleted: z.array(z.string().max(320)).max(12),
  actionsCompleted: z.array(z.string().max(320)).max(12),
  recommendedAction: z.string().max(400).nullable(),
  alternatives: z.array(z.string().max(320)).max(4),
  evidenceIds: z.array(z.string().max(60)).max(12),
  confidence: z.number().min(0).max(100),
  uncertainty: z.array(z.string().max(320)).max(6),
  decisionRequired: z.boolean(),
});

export type AISuggestionContent = z.infer<typeof aiSuggestionSchema>;

/** The suggestion as the interface receives it. */
export interface AISuggestionView extends AISuggestionContent {
  id: string;
  roleId: RoleId;
  eventId: string | null;
  objectType: string;
  objectId: string;
  atMoment: string;
  status: SuggestionStatus;
  priority: "critical" | "high" | "medium" | "low";
  authorityClass: AuthorityClass;
  decisionId: string | null;
  source: "live" | "cache" | "seeded";
  constrained: boolean;
  missingRequiredSources: string[];
  sources: SourceAttribution[];
  createdAt: string;
}

export const SUGGESTION_STATUS_LABELS: Record<SuggestionStatus, { en: string; de: string }> = {
  monitoring: { en: "Monitoring", de: "Beobachtet" },
  checking: { en: "Checking", de: "Prueft" },
  ready: { en: "Ready for review", de: "Bereit zur Pruefung" },
  "needs-user": { en: "Needs you", de: "Benoetigt Sie" },
  executing: { en: "Executing", de: "Fuehrt aus" },
  completed: { en: "Completed", de: "Abgeschlossen" },
  dismissed: { en: "Dismissed", de: "Verworfen" },
};

/* ==========================================================================
   Activity
   ========================================================================== */

export interface AIActivityEntryView {
  id: string;
  atMoment: string;
  sequence: number;
  kind:
    | "observed"
    | "retrieved"
    | "reconciled"
    | "analysed"
    | "drafted"
    | "completed"
    | "escalated"
    | "blocked"
    | "executed"
    | "waiting";
  label: string;
  detail: string;
  objectType: string;
  objectId: string;
  toolName: string;
  durationMs: number;
  outcome: string;
  authorityClass: AuthorityClass | "";
  auditEventId: string | null;
  evidenceIds: string[];
  connectorLabel: string | null;
}

/* ==========================================================================
   Source attribution and freshness
   ========================================================================== */

/**
 * Where a piece of work got its data.
 *
 * Shown as a quiet row under the object. Carries freshness and conflict
 * state, and a deep link when the connector supports one. It never carries a
 * credential, an endpoint with a token, or a raw payload.
 */
export interface SourceAttribution {
  connectorInstanceId: string;
  sourceSystem: string;
  mode: ConnectorMode;
  freshness: FreshnessState;
  lastUpdated: string | null;
  recordCount: number;
  conflicted: boolean;
  necessity: "required" | "helpful" | "optional";
  /** Null when the connector cannot deep link, so the interface omits it. */
  deepLink: string | null;
  loadState: DataLoadState;
}

export const FRESHNESS_LABELS: Record<FreshnessState, { en: string; de: string }> = {
  live: { en: "Live", de: "Live" },
  fresh: { en: "Current", de: "Aktuell" },
  stale: { en: "Stale", de: "Veraltet" },
  unknown: { en: "Unknown", de: "Unbekannt" },
};

export const CONNECTOR_MODE_LABELS: Record<ConnectorMode, { en: string; de: string }> = {
  live: { en: "Live", de: "Live" },
  "sandbox-ready": { en: "Sandbox ready", de: "Sandbox bereit" },
  simulated: { en: "Simulated", de: "Simuliert" },
  "configured-unavailable": {
    en: "Configured but unavailable",
    de: "Konfiguriert, nicht verfuegbar",
  },
  planned: { en: "Planned", de: "Geplant" },
};

/* ==========================================================================
   Execution receipts
   ========================================================================== */

/**
 * One line of a receipt.
 *
 * `targetSystem` null means the change was local. An external line always
 * names its system and carries the external reference the system returned,
 * so the line "Assessment updated in GRC" can be checked.
 */
export interface ExecutionReceiptLineView {
  id: string;
  statement: string;
  targetSystem: string | null;
  externalType: string | null;
  externalId: string | null;
  externalUrl: string | null;
  status: "acknowledged" | "partial" | "queued" | "failed" | "dead-letter" | "local";
  statusDetail: string;
  retryState: string;
  attempts: number;
  completedAt: string | null;
  auditEventId: string | null;
  sequence: number;
}

export const RECEIPT_STATUS_LABELS: Record<
  ExecutionReceiptLineView["status"],
  { en: string; de: string; tone: "success" | "warning" | "danger" | "info" }
> = {
  acknowledged: { en: "Acknowledged", de: "Bestaetigt", tone: "success" },
  local: { en: "Recorded", de: "Erfasst", tone: "success" },
  partial: { en: "Partly complete", de: "Teilweise abgeschlossen", tone: "warning" },
  queued: { en: "Queued", de: "In Warteschlange", tone: "warning" },
  failed: { en: "Failed", de: "Fehlgeschlagen", tone: "danger" },
  "dead-letter": { en: "Needs retry", de: "Wiederholung erforderlich", tone: "danger" },
};

/* ==========================================================================
   Focus queue
   ========================================================================== */

export const FOCUS_SECTIONS = ["needs-you", "prepared", "handled", "watching"] as const;
export type FocusSection = (typeof FOCUS_SECTIONS)[number];

export const FOCUS_SECTION_LABELS: Record<FocusSection, { en: string; de: string }> = {
  "needs-you": { en: "Needs you", de: "Benoetigt Sie" },
  prepared: { en: "Prepared for review", de: "Zur Pruefung vorbereitet" },
  handled: { en: "Handled automatically", de: "Automatisch bearbeitet" },
  watching: { en: "Watching", de: "Beobachtung" },
};

export interface FocusItemView {
  id: string;
  section: FocusSection;
  title: string;
  objectType: string;
  objectId: string;
  /** Why this appeared. One short clause, never a paragraph. */
  reason: string;
  /** Scenario moment it arrived at, used to show age. */
  arrivedAtMoment: string;
  sourceCount: number;
  aiStatus: SuggestionStatus | "none";
  /** What the human is being asked to do, or null when nothing. */
  humanAction: string | null;
  dueMoment: string | null;
  decisionId: string | null;
  suggestionId: string | null;
  eventId: string | null;
  severity: LiveEventSeverity;
  authorityClass: AuthorityClass | null;
  href: string;
  /**
   * The work object the item is ABOUT, as opposed to the item's own kind.
   *
   * `objectType` says what sort of queue entry this is, and for a decision it
   * is always the string `decision`, which is true and nearly useless to a
   * reader: six professions saw the same word. The subject is what
   * distinguishes them. A control tester is looking at `test-case
   * OVR-DE-20260714-0112`, a resilience lead at `impact-tolerance
   * ITOL-0004-03`, a third party manager at `supplier TP-0042`, and the
   * database has held all of it the whole time in
   * `decisions.related_object_kind` and `related_object_id`.
   *
   * It was already being read, to suppress an item from `Watching` when the
   * user is being asked to decide about the same subject, and then thrown
   * away before it reached the interface. Optional because not every queue
   * entry is about a separate object: a background work row IS its own
   * subject.
   */
  relatedObjectKind?: string | null;
  relatedObjectId?: string | null;
}

/**
 * Enforces the rule that one item appears in one active section.
 *
 * The sections are ordered by how much they demand of the user, and an item
 * lands in the most demanding section it qualifies for. Without this the
 * same control assessment shows up under both "Needs you" and "Prepared for
 * review", and the count at the top of the day stops meaning anything.
 */
export function dedupeFocusItems(items: FocusItemView[]): FocusItemView[] {
  const priority: Record<FocusSection, number> = {
    "needs-you": 0,
    prepared: 1,
    handled: 2,
    watching: 3,
  };
  const best = new Map<string, FocusItemView>();
  for (const item of items) {
    const key = `${item.objectType}:${item.objectId}`;
    const existing = best.get(key);
    if (!existing || priority[item.section] < priority[existing.section]) {
      best.set(key, item);
    }
  }
  return [...best.values()].sort(
    (a, b) => priority[a.section] - priority[b.section] || a.arrivedAtMoment.localeCompare(b.arrivedAtMoment),
  );
}

/* ==========================================================================
   The partner's view of the current work
   ========================================================================== */

/**
 * Everything the chat and the suggestion generator need to know about what
 * the user is looking at.
 *
 * Assembled server side. The browser never asserts the autonomy level, the
 * acting user or the scenario clock, because a client that claimed a higher
 * autonomy level must change nothing. That rule already holds for the agent
 * route and it holds here for the same reason.
 */
export interface WorkdayContext {
  runId: string;
  roleId: RoleId;
  roleTitle: string;
  holderName: string;
  entityId: string;
  entityName: string;
  entityCountry: string;
  regulatorContext: string[];
  /** Live scenario time. */
  currentMoment: string;
  /** The moment the user is looking at, which may be earlier. */
  viewedMoment: string;
  autonomyLevel: AutonomyLevel;
  language: "en" | "de";
  demoMode: "live" | "safe" | "offline";
  worldView: "today" | "future";
  selection: WorkdaySelection | null;
  openDecisionIds: string[];
  unreadEventIds: string[];
  evidenceIds: string[];
  recentDecisionIds: string[];
  activeSuggestionId: string | null;
}

/** What the user has selected in the centre workspace. */
export interface WorkdaySelection {
  objectType:
    | "risk"
    | "control"
    | "supplier"
    | "service"
    | "test-case"
    | "incident"
    | "obligation"
    | "decision"
    | "process"
    | "theme"
    | "assessment"
    | "action";
  objectId: string;
  label: string;
}

/** Canonical object types the integration layer maps onto. */
export const CANONICAL_TYPES = [
  "Person",
  "Role",
  "Team",
  "LegalEntity",
  "Process",
  "Service",
  "Risk",
  "Control",
  "Assessment",
  "Indicator",
  "Incident",
  "Loss",
  "Supplier",
  "Contract",
  "Evidence",
  "Test",
  "Exception",
  "Finding",
  "Action",
  "Decision",
  "Approval",
  "Obligation",
  "Policy",
  "Meeting",
  "Message",
  "ExternalRecord",
] as const;
export type CanonicalType = (typeof CANONICAL_TYPES)[number];

/* ==========================================================================
   Small shared helpers
   ========================================================================== */

/** Picks the right side of a bilingual label pair. */
export function pick(
  pair: { en: string; de: string },
  language: "en" | "de",
): string {
  return language === "de" ? pair.de : pair.en;
}

/** "07:45" to minutes since midnight. Mirrors the domain calculator. */
export function momentMinutes(moment: string): number {
  const [h = "0", m = "0"] = moment.split(":");
  return Number(h) * 60 + Number(m);
}

/**
 * How long ago something arrived, in the compact form a row needs.
 *
 * Scenario time, not wall clock, because the day is the scenario's.
 */
export function momentAge(arrived: string, now: string, language: "en" | "de"): string {
  const diff = momentMinutes(now) - momentMinutes(arrived);
  if (diff < 1) return language === "de" ? "jetzt" : "now";
  if (diff < 60) return `${diff}m`;
  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

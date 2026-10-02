/**
 * AI Partner copy and the pure rules the partner components share.
 *
 * Two things live here and the pairing is deliberate.
 *
 * The bilingual dictionary. Every user visible string in the dock has an
 * English and a German form, written in ASCII so an encoding problem cannot
 * corrupt seeded or exported content. The tone is the one the brief sets:
 * short, calm, factual, no celebration and no sales claim. Nothing here names
 * a provider, a vendor or an engine, because the normal workday is a neutral
 * product; that metadata belongs in Control Room and Trust, and in the
 * workday it appears only behind an explicit "View details" disclosure.
 *
 * The pure rules. This is the only module in the folder with no React in it,
 * which is what lets the unit suite run the action selection rule, the prompt
 * cap and the reveal gate in a node environment without a DOM. Keeping them
 * here rather than inside the components is what makes them testable at all.
 */

import type { AuthorityClass } from "@/db/schema/decisions";
import type { SuggestionStatus } from "@/db/schema/live";
import type { Language } from "@/i18n/labels";
import { isPublishableState, type AIGenerationState } from "@/workday/contracts";

export interface LabelPair {
  en: string;
  de: string;
}

/* ==========================================================================
   The dictionary
   ========================================================================== */

export const PARTNER_LABELS: Record<string, LabelPair> = {
  /* ---- shell of the dock ---- */
  partnerTitle: { en: "AI partner", de: "KI Partner" },
  tabSuggestions: { en: "Suggestions", de: "Vorschlaege" },
  tabActivity: { en: "Activity", de: "Aktivitaet" },
  /*
   * "Chat" and not "Ask".
   *
   * The brief is explicit that the main conversational capability must not be
   * hidden behind a label that reads like a help affordance. Renaming this
   * tab is a product decision, not a copy preference.
   */
  tabChat: { en: "Chat", de: "Chat" },
  openPartner: { en: "Open AI partner", de: "KI Partner oeffnen" },
  collapsePartner: { en: "Collapse AI partner", de: "KI Partner einklappen" },
  dockLabel: { en: "AI partner panel", de: "KI Partner Bereich" },
  viewDetails: { en: "View details", de: "Details anzeigen" },

  /* ---- header ---- */
  autonomyLabel: { en: "Autonomy", de: "Autonomie" },
  modeLabel: { en: "Mode", de: "Modus" },
  modeLive: { en: "Live", de: "Live" },
  modeSafe: { en: "Presenter safe", de: "Praesentationssicher" },
  modeOffline: { en: "Offline", de: "Offline" },
  needsYouCount: { en: "Waiting for you", de: "Wartet auf Sie" },

  /* ---- the six questions, in order ---- */
  whatChanged: { en: "What changed", de: "Was sich geaendert hat" },
  whyItMatters: { en: "Why it matters", de: "Warum das wichtig ist" },
  whatIChecked: { en: "What I checked", de: "Was ich geprueft habe" },
  whatIDid: { en: "What I already did", de: "Was ich bereits getan habe" },
  whatIRecommend: { en: "What I recommend", de: "Was ich empfehle" },
  whatINeed: { en: "What I need from you", de: "Was ich von Ihnen brauche" },
  nothingNeeded: {
    en: "Nothing for now. This is for your awareness.",
    de: "Derzeit nichts. Nur zu Ihrer Information.",
  },
  decisionNeeded: {
    en: "A decision from you, before anything changes.",
    de: "Eine Entscheidung von Ihnen, bevor sich etwas aendert.",
  },
  nothingChecked: { en: "No checks recorded.", de: "Keine Pruefungen erfasst." },
  nothingDone: { en: "No changes made.", de: "Keine Aenderungen vorgenommen." },

  /* ---- confidence, uncertainty, constraint ---- */
  confidenceLabel: { en: "Confidence", de: "Konfidenz" },
  confidenceHigh: { en: "High confidence", de: "Hohe Konfidenz" },
  confidenceModerate: { en: "Moderate confidence", de: "Mittlere Konfidenz" },
  confidenceLow: { en: "Low confidence", de: "Geringe Konfidenz" },
  uncertaintyLabel: { en: "Uncertainty", de: "Unsicherheit" },
  alternativesLabel: { en: "Alternatives", de: "Alternativen" },
  constrainedTitle: {
    en: "Limited by a source that was unavailable",
    de: "Durch eine nicht verfuegbare Quelle eingeschraenkt",
  },
  constrainedSourcePrefix: {
    en: "Required source unavailable",
    de: "Erforderliche Quelle nicht verfuegbar",
  },
  constrainedRecommendation: { en: "Provisional only", de: "Nur vorlaeufig" },
  constrainedNote: {
    en: "A required source was unavailable, so this is not presented as a confident recommendation.",
    de: "Eine erforderliche Quelle war nicht verfuegbar, daher wird dies nicht als belastbare Empfehlung dargestellt.",
  },

  /* ---- card actions ---- */
  actionReview: { en: "Review", de: "Pruefen" },
  actionOpenObject: { en: "Open object", de: "Objekt oeffnen" },
  actionAskWhy: { en: "Ask why", de: "Warum fragen" },
  actionApprove: { en: "Approve", de: "Genehmigen" },
  actionModify: { en: "Modify", de: "Anpassen" },
  actionSnooze: { en: "Snooze", de: "Zurueckstellen" },
  actionDismiss: { en: "Dismiss", de: "Verwerfen" },
  moreActions: { en: "More actions", de: "Weitere Aktionen" },
  approvalRoutingNote: {
    en: "Approving opens the decision record. Nothing is sent before you confirm there.",
    de: "Genehmigen oeffnet den Entscheidungsdatensatz. Vorher wird nichts gesendet.",
  },

  /* ---- suggestions tab ---- */
  suggestionsEmptyTitle: { en: "Nothing prepared right now", de: "Derzeit nichts vorbereitet" },
  suggestionsEmptyDetail: {
    en: "The partner is watching the work of this role. A suggestion appears when something changes.",
    de: "Der Partner beobachtet die Arbeit dieser Rolle. Ein Vorschlag erscheint, wenn sich etwas aendert.",
  },

  /* ---- generation ---- */
  generationTitle: { en: "Preparing a suggestion", de: "Bereitet einen Vorschlag vor" },
  generationStages: { en: "Processing steps", de: "Verarbeitungsschritte" },
  generationUnavailable: { en: "Suggestion unavailable", de: "Vorschlag nicht verfuegbar" },
  generationRetry: { en: "Try again", de: "Erneut versuchen" },
  generationEvidenceKept: {
    en: "Evidence that was already loaded stays available.",
    de: "Bereits geladene Nachweise bleiben verfuegbar.",
  },
  generationNotRetryable: {
    en: "This cannot be retried from here.",
    de: "Dies kann hier nicht wiederholt werden.",
  },

  /* ---- activity ---- */
  activityEmptyTitle: { en: "No activity yet", de: "Noch keine Aktivitaet" },
  activityEmptyDetail: {
    en: "Every check, read and change the partner makes is recorded here in order.",
    de: "Jede Pruefung, jeder Lesezugriff und jede Aenderung wird hier in Reihenfolge erfasst.",
  },
  activityLabel: { en: "Partner activity", de: "Partner Aktivitaet" },
  detailObject: { en: "Object", de: "Objekt" },
  detailEvidence: { en: "Evidence", de: "Nachweise" },
  detailStep: { en: "Step", de: "Schritt" },
  detailDuration: { en: "Duration", de: "Dauer" },
  detailOutcome: { en: "Outcome", de: "Ergebnis" },
  detailAuthority: { en: "Authority", de: "Befugnis" },
  detailAudit: { en: "Audit reference", de: "Audit Referenz" },
  detailSource: { en: "Source system", de: "Quellsystem" },
  expandRow: { en: "Show detail", de: "Detail anzeigen" },

  /* ---- chat ---- */
  chatPlaceholder: { en: "Ask about the current work", de: "Fragen Sie zur aktuellen Arbeit" },
  chatSend: { en: "Send", de: "Senden" },
  chatNewThread: { en: "New thread", de: "Neuer Verlauf" },
  chatThreadLabel: { en: "Conversation", de: "Unterhaltung" },
  chatAskingAbout: { en: "Asking about", de: "Frage zu" },
  chatNoSelection: { en: "Asking about the day of this role", de: "Frage zum Tag dieser Rolle" },
  chatReturnToContext: { en: "Return to current context", de: "Zurueck zum aktuellen Kontext" },
  chatEmptyTitle: { en: "Ask about the current work", de: "Fragen Sie zur aktuellen Arbeit" },
  chatEmptyDetail: {
    en: "Answers cite the records they came from, and an action is never carried out from an answer.",
    de: "Antworten nennen die Datensaetze, aus denen sie stammen. Aus einer Antwort wird keine Aktion ausgefuehrt.",
  },
  chatPreparing: { en: "Preparing an answer", de: "Bereitet eine Antwort vor" },
  chatAnswerReady: { en: "Answer ready", de: "Antwort bereit" },
  chatFailed: {
    en: "The answer did not arrive. Nothing was changed.",
    de: "Die Antwort ist nicht angekommen. Es wurde nichts geaendert.",
  },
  chatBlocked: {
    en: "This request was not carried out.",
    de: "Diese Anfrage wurde nicht ausgefuehrt.",
  },
  chatSuggestedPrompts: { en: "Suggested questions", de: "Vorgeschlagene Fragen" },
  chatYou: { en: "You", de: "Sie" },

  /* ---- provenance of an answer ---- */
  sourceLive: { en: "Live", de: "Live" },
  sourceCache: { en: "Saved answer", de: "Gespeicherte Antwort" },
  sourceSeeded: { en: "Prepared answer", de: "Vorbereitete Antwort" },

  /* ---- receipt ---- */
  receiptTitle: { en: "Execution receipt", de: "Ausfuehrungsnachweis" },
  receiptLabel: { en: "Changes made", de: "Vorgenommene Aenderungen" },
  receiptEmpty: {
    en: "No changes have been made.",
    de: "Es wurden keine Aenderungen vorgenommen.",
  },
  receiptTarget: { en: "Target system", de: "Zielsystem" },
  receiptExternalRef: { en: "External reference", de: "Externe Referenz" },
  receiptCompleted: { en: "Completed", de: "Abgeschlossen" },
  receiptAttempts: { en: "Attempts", de: "Versuche" },
  receiptRetry: { en: "Retry", de: "Wiederholung" },
  receiptLocal: { en: "Recorded in this workspace", de: "In dieser Umgebung erfasst" },
  receiptNotConfirmed: {
    en: "Not confirmed in the target system. Treat it as outstanding.",
    de: "Im Zielsystem nicht bestaetigt. Als offen behandeln.",
  },
  receiptOpenAudit: { en: "Open audit entry", de: "Audit Eintrag oeffnen" },
  receiptOpenExternal: { en: "Open in target system", de: "Im Zielsystem oeffnen" },
  /*
   * One sentence per outstanding status.
   *
   * Each one says plainly that the change has not landed. The status chip is
   * read as decoration at a glance, and the difference between a change that
   * happened and one that is still queued is too important to leave to colour.
   */
  receiptQueuedNote: {
    en: "Queued. The target system has not applied it yet.",
    de: "In Warteschlange. Das Zielsystem hat sie noch nicht angewendet.",
  },
  receiptFailedNote: {
    en: "Failed. Nothing was changed in the target system.",
    de: "Fehlgeschlagen. Im Zielsystem wurde nichts geaendert.",
  },
  receiptDeadLetterNote: {
    en: "Needs a retry. The change is still outstanding.",
    de: "Wiederholung erforderlich. Die Aenderung ist weiterhin offen.",
  },
  receiptPartialNote: {
    en: "Partly applied. Some changes are still outstanding.",
    de: "Teilweise angewendet. Einige Aenderungen sind weiterhin offen.",
  },
};

/** The sentence an unconfirmed receipt line carries. Null when confirmed. */
export const RECEIPT_OUTSTANDING_NOTE_KEYS: Record<string, string> = {
  queued: "receiptQueuedNote",
  failed: "receiptFailedNote",
  "dead-letter": "receiptDeadLetterNote",
  partial: "receiptPartialNote",
};

/** Resolves one dictionary key. Falls back to the key so a gap is visible. */
export function partnerLabel(key: string, language: Language): string {
  const pair = PARTNER_LABELS[key];
  if (!pair) return key;
  return language === "de" ? pair.de : pair.en;
}

/* ==========================================================================
   Partner state detail
   ========================================================================== */

/**
 * One short line per partner state.
 *
 * The header shows the state and this line. Both describe observable
 * application activity. None of them claims insight the product does not
 * have, and none of them says the partner is working when it is resting.
 */
export const PARTNER_STATE_DETAIL: Record<string, LabelPair> = {
  monitoring: {
    en: "Watching the work of this role.",
    de: "Beobachtet die Arbeit dieser Rolle.",
  },
  "checking-evidence": {
    en: "Reading the records it needs.",
    de: "Liest die benoetigten Datensaetze.",
  },
  preparing: {
    en: "Comparing records and drafting.",
    de: "Vergleicht Datensaetze und entwirft.",
  },
  ready: { en: "A suggestion is ready to read.", de: "Ein Vorschlag ist bereit." },
  "needs-you": {
    en: "Waiting on a decision from you.",
    de: "Wartet auf eine Entscheidung von Ihnen.",
  },
  executing: {
    en: "Carrying out an approved change.",
    de: "Fuehrt eine genehmigte Aenderung aus.",
  },
  completed: {
    en: "The approved change is recorded.",
    de: "Die genehmigte Aenderung ist erfasst.",
  },
  paused: { en: "Paused. It will not act.", de: "Angehalten. Es wird nicht handeln." },
  offline: {
    en: "No connection. Showing the last known state.",
    de: "Keine Verbindung. Zeigt den letzten Stand.",
  },
};

/* ==========================================================================
   Typed response parts
   ========================================================================== */

/**
 * The part kinds, mirroring the `parts` discriminator on `chat_turns`.
 *
 * Repeated here as a value rather than imported as a type because the
 * renderer needs to iterate it and the unit suite needs to assert that every
 * kind has a label. A kind added to the schema without a label here fails
 * that test rather than silently rendering as unlabelled prose.
 */
export const AI_PART_KINDS = [
  "answer",
  "evidence",
  "uncertainty",
  "recommendation",
  "alternative",
  "proposed-action",
  "approval-request",
  "execution-receipt",
  "blocked",
  "follow-up",
  "source-status",
] as const;

export type AIPartKind = (typeof AI_PART_KINDS)[number];

export const AI_PART_LABELS: Record<AIPartKind, LabelPair> = {
  answer: { en: "Answer", de: "Antwort" },
  evidence: { en: "Cited evidence", de: "Angegebene Nachweise" },
  uncertainty: { en: "Uncertainty", de: "Unsicherheit" },
  recommendation: { en: "Recommendation", de: "Empfehlung" },
  alternative: { en: "Alternative", de: "Alternative" },
  "proposed-action": { en: "Proposed, not carried out", de: "Vorgeschlagen, nicht ausgefuehrt" },
  "approval-request": { en: "Approval required", de: "Genehmigung erforderlich" },
  "execution-receipt": { en: "Executed", de: "Ausgefuehrt" },
  blocked: { en: "Not permitted", de: "Nicht zulaessig" },
  "follow-up": { en: "Question for you", de: "Frage an Sie" },
  "source-status": { en: "Source status", de: "Quellenstatus" },
};

export function isAIPartKind(value: unknown): value is AIPartKind {
  return typeof value === "string" && (AI_PART_KINDS as readonly string[]).includes(value);
}

/* ==========================================================================
   Connected system phases
   ========================================================================== */

/**
 * Where a piece of work sits relative to the systems outside this product.
 *
 * This is the distinction the brief asks to be visible through compact typed
 * parts rather than raw tool logs. The failure mode it prevents is the one
 * the receipt also guards: an interface that reads as though an external
 * platform was updated when the command is still sitting in a queue.
 */
export const AI_CONNECTION_PHASES = [
  "read-from-source",
  "prepared-locally",
  "waiting-approval",
  "queued-external",
  "executed-external",
  "failed-external",
] as const;

export type AIConnectionPhase = (typeof AI_CONNECTION_PHASES)[number];

export const AI_CONNECTION_PHASE_LABELS: Record<
  AIConnectionPhase,
  LabelPair & { tone: "info" | "neutral" | "warning" | "success" | "danger" }
> = {
  "read-from-source": { en: "Read from source", de: "Aus Quelle gelesen", tone: "info" },
  "prepared-locally": { en: "Prepared locally", de: "Lokal vorbereitet", tone: "neutral" },
  "waiting-approval": {
    en: "Waiting for approval",
    de: "Wartet auf Genehmigung",
    tone: "warning",
  },
  "queued-external": {
    en: "Queued for external execution",
    de: "Zur externen Ausfuehrung eingereiht",
    tone: "warning",
  },
  "executed-external": { en: "Executed externally", de: "Extern ausgefuehrt", tone: "success" },
  "failed-external": { en: "Failed externally", de: "Extern fehlgeschlagen", tone: "danger" },
};

function isConnectionPhase(value: unknown): value is AIConnectionPhase {
  return typeof value === "string" && (AI_CONNECTION_PHASES as readonly string[]).includes(value);
}

/**
 * Resolves the phase of one response part.
 *
 * The server may state the phase in `meta.phase`. When it does not, the kind
 * implies it, and the implication is deliberately pessimistic: an execution
 * receipt part with no stated phase is treated as queued rather than as done,
 * because claiming an external write landed when nobody said so is the exact
 * dishonesty this product exists to avoid.
 */
export function connectionPhaseFromPart(part: {
  kind: AIPartKind;
  meta?: Record<string, unknown> | undefined;
}): AIConnectionPhase | null {
  const stated = part.meta?.["phase"];
  if (isConnectionPhase(stated)) return stated;

  switch (part.kind) {
    case "evidence":
    case "source-status":
      return "read-from-source";
    case "recommendation":
    case "alternative":
      return "prepared-locally";
    case "proposed-action":
    case "approval-request":
      return "waiting-approval";
    case "execution-receipt":
      return "queued-external";
    case "blocked":
      return "failed-external";
    default:
      return null;
  }
}

/* ==========================================================================
   Suggested prompts
   ========================================================================== */

export const PROMPT_IDS = [
  "what-changed",
  "why-matters",
  "conflicting-evidence",
  "already-done",
  "needs-decision",
  "if-deferred",
  "draft-challenge",
  "compare-previous",
] as const;

export type PromptId = (typeof PROMPT_IDS)[number];

export const PROMPT_LABELS: Record<PromptId, LabelPair> = {
  "what-changed": { en: "What changed", de: "Was hat sich geaendert" },
  "why-matters": { en: "Why does this matter", de: "Warum ist das wichtig" },
  "conflicting-evidence": {
    en: "Show the conflicting evidence",
    de: "Widersprechende Nachweise zeigen",
  },
  "already-done": {
    en: "What has already been completed",
    de: "Was ist bereits abgeschlossen",
  },
  "needs-decision": {
    en: "What requires my decision",
    de: "Was erfordert meine Entscheidung",
  },
  "if-deferred": {
    en: "What happens if I defer this",
    de: "Was passiert, wenn ich das aufschiebe",
  },
  "draft-challenge": { en: "Draft my challenge", de: "Meine Rueckfrage entwerfen" },
  "compare-previous": {
    en: "Compare this with the previous assessment",
    de: "Mit der vorherigen Beurteilung vergleichen",
  },
};

/**
 * Three chips, never more.
 *
 * The cap is a product rule, not a layout convenience. Eight prompts above a
 * composer reads as a menu of the things the product would rather you asked,
 * and the composer stops looking like somewhere you can type your own
 * question.
 */
export const MAX_PROMPT_CHIPS = 3;

export interface PromptContext {
  hasSelection?: boolean;
  hasOpenDecision?: boolean;
  hasConflictingEvidence?: boolean;
  hasCompletedActions?: boolean;
  hasSuggestion?: boolean;
  turnCount?: number;
}

/**
 * Picks at most three prompts for the current context.
 *
 * Ordered by what the user most plausibly wants next given what is on screen,
 * so the chips change as the day moves rather than sitting as a fixed trio.
 * An open decision outranks everything, because that is the thing the day is
 * blocked on.
 */
export function selectPromptIds(context: PromptContext = {}): PromptId[] {
  const candidates: PromptId[] = [];

  if (context.hasOpenDecision) candidates.push("needs-decision", "if-deferred");
  if (context.hasConflictingEvidence) candidates.push("conflicting-evidence");
  if (context.hasSuggestion) candidates.push("why-matters");
  if (context.hasSelection) candidates.push("what-changed");
  if (context.hasCompletedActions) candidates.push("already-done");

  // A conversation already in progress needs follow on moves, not openers.
  if ((context.turnCount ?? 0) > 0) candidates.push("draft-challenge", "compare-previous");

  // The resting set, used when nothing is selected and nothing is prepared.
  candidates.push("what-changed", "needs-decision", "already-done");

  const seen = new Set<PromptId>();
  const chosen: PromptId[] = [];
  for (const id of candidates) {
    if (seen.has(id)) continue;
    seen.add(id);
    chosen.push(id);
    if (chosen.length === MAX_PROMPT_CHIPS) break;
  }
  return chosen;
}

/* ==========================================================================
   Suggestion card actions
   ========================================================================== */

export const SUGGESTION_ACTION_IDS = [
  "review",
  "open-object",
  "ask-why",
  "approve",
  "modify",
  "snooze",
  "dismiss",
] as const;

export type SuggestionActionId = (typeof SUGGESTION_ACTION_IDS)[number];

export const SUGGESTION_ACTION_LABEL_KEYS: Record<SuggestionActionId, string> = {
  review: "actionReview",
  "open-object": "actionOpenObject",
  "ask-why": "actionAskWhy",
  approve: "actionApprove",
  modify: "actionModify",
  snooze: "actionSnooze",
  dismiss: "actionDismiss",
};

export interface SuggestionActionInput {
  status: SuggestionStatus;
  authorityClass: AuthorityClass;
  constrained: boolean;
  decisionRequired: boolean;
  hasRecommendation: boolean;
}

export interface SuggestionActionPlan {
  /** The one action on the face of the card. Null when there is nothing to do. */
  primary: SuggestionActionId | null;
  /** Everything else, behind the overflow menu, in a fixed order. */
  overflow: SuggestionActionId[];
}

/**
 * Chooses which actions a card offers.
 *
 * Not every action on every card. Seven controls on a monitoring row trains
 * the user to ignore all of them, and it offers Approve on things there is
 * nothing to approve, which is worse than clutter: it implies the partner is
 * waiting for a go ahead it never asked for.
 *
 * The rules, and the failure each one prevents:
 *
 * Approve appears only when the suggestion is open, carries a recommendation,
 * is not constrained, and the authority class is one a human actually gates.
 * APPROVAL_REQUIRED and PROPOSE are gated. POLICY_BOUND_AUTONOMOUS is not:
 * the partner may act inside policy, so asking for approval there would
 * invent a gate the authority model does not have. READ and DRAFT have
 * nothing to approve. PROHIBITED must never show an approval path at all.
 *
 * A constrained suggestion loses Approve entirely. A required source was
 * unavailable, so a one click approval would be approving a gap.
 *
 * Snooze and Dismiss disappear once `decisionRequired` is set. Deferring a
 * required decision is itself a decision with an owner and a record, so it
 * happens in the decision surface, not as a quiet control on a side panel.
 *
 * A completed or dismissed suggestion keeps only the read paths. Re-approving
 * something already executed is how a double write happens.
 */
export function selectSuggestionActions(input: SuggestionActionInput): SuggestionActionPlan {
  const { status, authorityClass, constrained, decisionRequired, hasRecommendation } = input;

  const open = status === "ready" || status === "needs-user";
  const watching = status === "monitoring" || status === "checking";
  const closed = status === "completed" || status === "dismissed";

  const gatedAuthority = authorityClass === "APPROVAL_REQUIRED" || authorityClass === "PROPOSE";
  const approvable = open && hasRecommendation && !constrained && gatedAuthority;
  const modifiable = open && hasRecommendation && (gatedAuthority || authorityClass === "DRAFT");

  let primary: SuggestionActionId | null;
  if (status === "dismissed") primary = "open-object";
  else if (status === "completed" || status === "executing") primary = "review";
  else if (approvable) primary = "approve";
  else if (open) primary = "review";
  else if (watching) primary = "open-object";
  else primary = null;

  const overflow: SuggestionActionId[] = [];
  const add = (id: SuggestionActionId, when: boolean) => {
    if (when && id !== primary && !overflow.includes(id)) overflow.push(id);
  };

  add("review", !closed);
  add("modify", modifiable);
  add("ask-why", status !== "dismissed");
  add("open-object", true);
  add("snooze", (open || watching) && !decisionRequired);
  add("dismiss", (open || watching) && !decisionRequired);

  return { primary, overflow };
}

/* ==========================================================================
   Confidence
   ========================================================================== */

/**
 * The ceiling a constrained suggestion is held under.
 *
 * A suggestion built without a required source may not be presented as a
 * confident one whatever the generator scored it, so the displayed value is
 * clamped and the band can never read as high. The raw score stays in the
 * record for Trust; what changes is the claim the card makes.
 */
export const CONSTRAINED_CONFIDENCE_CEILING = 55;

export type ConfidenceBand = "high" | "moderate" | "low";

export function confidenceBand(
  confidence: number,
  constrained = false,
): { band: ConfidenceBand; value: number } {
  const value = constrained ? Math.min(confidence, CONSTRAINED_CONFIDENCE_CEILING) : confidence;
  const band: ConfidenceBand = value >= 75 ? "high" : value >= 50 ? "moderate" : "low";
  return { band, value };
}

export const CONFIDENCE_LABEL_KEYS: Record<ConfidenceBand, string> = {
  high: "confidenceHigh",
  moderate: "confidenceModerate",
  low: "confidenceLow",
};

export const CONFIDENCE_TONE: Record<ConfidenceBand, "success" | "info" | "warning"> = {
  high: "success",
  moderate: "info",
  low: "warning",
};

/* ==========================================================================
   The reveal gate
   ========================================================================== */

/**
 * Whether a suggestion may be shown yet.
 *
 * Nothing renders before validation succeeds. Two cases are gated: a
 * suggestion whose own status says it is still being worked on, and a
 * suggestion the live generation is still mid pipeline on.
 *
 * `blocked` is treated as revealable on purpose. It is not a pre validation
 * state: it means a validated suggestion is now waiting for an approval, and
 * hiding the card at that point would remove the very thing the user has to
 * read before approving. `error` is not revealable, because there is no
 * validated content behind it.
 */
export function canRevealSuggestion(
  suggestion: { id: string; status: SuggestionStatus } | null | undefined,
  generation?: { state: AIGenerationState; suggestionId?: string | null } | null,
): boolean {
  if (!suggestion) return false;
  if (suggestion.status === "monitoring" || suggestion.status === "checking") return false;

  if (generation && generation.suggestionId === suggestion.id) {
    return isPublishableState(generation.state) || generation.state === "blocked";
  }
  return true;
}

/* ==========================================================================
   Grouping
   ========================================================================== */

/**
 * Groups anything carrying a scenario moment, preserving the input order.
 *
 * The activity stream groups by moment so a reader can see that six reads and
 * one write all belong to 14:05. Insertion ordered rather than sorted, so a
 * late arriving entry for an earlier moment joins its own group instead of
 * starting a second one further down the list.
 */
export function groupByMoment<T extends { atMoment: string }>(
  entries: T[],
): Array<{ moment: string; entries: T[] }> {
  const groups: Array<{ moment: string; entries: T[] }> = [];
  const index = new Map<string, { moment: string; entries: T[] }>();
  for (const entry of entries) {
    const existing = index.get(entry.atMoment);
    if (existing) {
      existing.entries.push(entry);
      continue;
    }
    const group = { moment: entry.atMoment, entries: [entry] };
    index.set(entry.atMoment, group);
    groups.push(group);
  }
  return groups;
}

/**
 * The questions NFR Workspace answers with a structured analysis.
 *
 * Each intent names its builder, the question a person would ask, and the
 * signals in a sentence that point to it, in English and German. Routing is
 * deterministic: the same sentence always reaches the same analysis, in Safe,
 * Offline and Live mode alike, which is what makes a demonstrated answer
 * reproducible. A sentence that reaches no intent is not guessed at; the
 * caller says so and offers the questions that are answered.
 */

import type { RoleId } from "@/db/schema/core";
import { buildExpiringAcceptances } from "./build/acceptances";
import { buildFailingControls } from "./build/controls";
import { buildOverdueIssues } from "./build/issues";
import { buildPolicyImpact } from "./build/regulatory";
import { buildResilienceGaps } from "./build/resilience";
import { buildCaseNextAction, buildPaymentReviewChange } from "./build/review";
import { buildManagementSummary } from "./build/summary";
import { buildConcentration, buildDeterioration } from "./build/third-parties";
import type { Builder } from "./build/common";

export const INTENT_IDS = [
  "third-party-deterioration",
  "provider-concentration",
  "payment-review-change",
  "failing-controls",
  "overdue-issues",
  "expiring-acceptances",
  "resilience-gaps",
  "policy-change-impact",
  "management-summary",
  "case-next-action",
] as const;
export type IntentId = (typeof INTENT_IDS)[number];

interface Signal {
  /** Lower case fragments, matched against the normalised sentence. */
  terms: readonly string[];
  weight: number;
}

export interface IntentDefinition {
  id: IntentId;
  build: Builder;
  /** The canonical question, in both languages. */
  question: { en: string; de: string };
  /** A short label for chips and lists. */
  label: { en: string; de: string };
  signals: readonly Signal[];
  /** Roles this question is suggested to first. Every role may ask every question. */
  roles: readonly RoleId[];
}

export const INTENTS: readonly IntentDefinition[] = [
  {
    id: "third-party-deterioration",
    build: buildDeterioration,
    question: { en: "Which critical third-party services are deteriorating, and why?", de: "Welche kritischen Drittparteien-Services verschlechtern sich, und warum?" },
    label: { en: "Deteriorating third parties", de: "Drittparteien mit Verschlechterung" },
    signals: [
      { terms: ["deteriorat", "worsen", "getting worse", "decline", "declining", "verschlecht", "schlechter", "trending up", "risk trend"], weight: 3 },
      { terms: ["third part", "third-part", "supplier", "vendor", "outsourc", "drittpart", "dienstleist", "lieferant"], weight: 1 },
      { terms: ["critical", "kritisch"], weight: 0.5 },
    ],
    roles: ["tprm", "nfr-governance"],
  },
  {
    id: "provider-concentration",
    build: buildConcentration,
    question: { en: "Where do we have provider concentration across critical services?", de: "Wo bestehen Anbieterkonzentrationen bei kritischen Services?" },
    label: { en: "Provider concentration", de: "Anbieterkonzentration" },
    signals: [
      { terms: ["concentrat", "konzentrat", "same provider", "same underlying", "shared provider", "single provider", "fourth part", "fourth-part", "viertpart", "depend on the same", "klumpen"], weight: 3 },
      { terms: ["provider", "cloud", "anbieter", "dependency", "dependencies", "abhaengig"], weight: 1 },
    ],
    roles: ["tprm", "nfr-governance", "incident-resilience"],
  },
  {
    id: "payment-review-change",
    build: buildPaymentReviewChange,
    question: { en: "What changed in the payment service review since last quarter?", de: "Was hat sich im Review des Zahlungsservices seit dem letzten Quartal geaendert?" },
    label: { en: "What changed since Q2", de: "Aenderungen seit Q2" },
    signals: [
      { terms: ["what changed", "what has changed", "changes since", "changed since", "since last quarter", "last quarter", "previous review", "compare", "compared", "was hat sich", "veraendert", "geaendert", "seit dem letzten quartal", "vorquartal"], weight: 2.5 },
      { terms: ["payment", "novalink", "zahlung", "review", "this case", "the case", "diesem fall"], weight: 1 },
    ],
    roles: ["tprm", "rcsa"],
  },
  {
    id: "failing-controls",
    build: buildFailingControls,
    question: { en: "Which controls are repeatedly failing?", de: "Welche Kontrollen versagen wiederholt?" },
    label: { en: "Failing controls", de: "Versagende Kontrollen" },
    signals: [
      { terms: ["control", "kontroll"], weight: 1.5 },
      { terms: ["fail", "repeated", "repeatedly", "weak", "weakness", "exception", "not effective", "ineffective", "test result", "versag", "wiederholt", "schwach", "unwirksam", "ausnahme"], weight: 2 },
    ],
    roles: ["rcsa", "control-assurance"],
  },
  {
    id: "overdue-issues",
    build: buildOverdueIssues,
    question: { en: "Which high-severity issues are overdue?", de: "Welche Feststellungen mit hohem Schweregrad sind ueberfaellig?" },
    label: { en: "Overdue issues", de: "Ueberfaellige Feststellungen" },
    signals: [
      { terms: ["overdue", "past due", " late ", "aging", "ageing", "missed deadline", "ueberfaellig", "verspaet", "verzug"], weight: 3 },
      { terms: ["issue", "action", "remediation", "finding", "feststellung", "massnahme", "behebung"], weight: 1 },
    ],
    roles: ["rcsa", "nfr-governance", "control-assurance"],
  },
  {
    id: "expiring-acceptances",
    build: buildExpiringAcceptances,
    question: { en: "Which risk acceptances expire in the next 90 days?", de: "Welche Risikoakzeptanzen laufen in den naechsten 90 Tagen ab?" },
    label: { en: "Expiring acceptances", de: "Ablaufende Akzeptanzen" },
    signals: [
      { terms: ["acceptance", "accepted risk", "risk accept", "waiver", "akzeptanz", "risikoakzeptanz", "risikoannahme"], weight: 3 },
      { terms: ["expir", "lapse", "renew", "90 days", "next 90", "ablauf", "laeuft ab", "laufen ab", "verlaenger"], weight: 1 },
    ],
    roles: ["nfr-governance", "tprm", "rcsa"],
  },
  {
    id: "resilience-gaps",
    build: buildResilienceGaps,
    question: { en: "Show operational resilience gaps by service.", de: "Zeige Luecken der operationellen Resilienz je Service." },
    label: { en: "Resilience gaps", de: "Resilienzluecken" },
    signals: [
      { terms: ["resilien", "impact tolerance", "tolerance", "recovery time", "recovery", "rto", "outage", "disruption", "toleranz", "wiederherstell", "ausfall", "stoerung"], weight: 3 },
      { terms: ["gap", "service", "exceed", "luecke", "ueberschreit"], weight: 1 },
    ],
    roles: ["incident-resilience", "tprm"],
  },
  {
    id: "policy-change-impact",
    build: buildPolicyImpact,
    question: { en: "Which areas are affected by the latest policy change?", de: "Welche Bereiche sind von der neuesten Richtlinienaenderung betroffen?" },
    label: { en: "Policy change impact", de: "Auswirkung Richtlinienaenderung" },
    signals: [
      { terms: ["policy", "regulat", "obligation", "circular", "regulation", "guideline", "richtlinie", "regulator", "pflicht", "rundschreiben", "vorgabe", "aufsicht"], weight: 2 },
      { terms: ["change", "affected", "impact", "latest", "new", "aender", "betroffen", "auswirk", "neu"], weight: 1 },
    ],
    roles: ["regulatory-change", "rcsa"],
  },
  {
    id: "management-summary",
    build: buildManagementSummary,
    question: { en: "Create a one-page management summary of the top NFR concerns.", de: "Erstelle eine einseitige Management-Zusammenfassung der wichtigsten NFR-Themen." },
    label: { en: "Management summary", de: "Management-Zusammenfassung" },
    signals: [
      { terms: ["summary", "summarise", "summarize", "one-page", "one page", "briefing", "top concerns", "top nfr", "overview", "executive", "board", "zusammenfass", "ueberblick", "uebersicht", "management"], weight: 3 },
    ],
    roles: ["nfr-governance", "tprm", "rcsa"],
  },
  {
    id: "case-next-action",
    build: buildCaseNextAction,
    question: { en: "What action should I take on the current case?", de: "Welchen Schritt sollte ich im aktuellen Fall gehen?" },
    label: { en: "Next action on this case", de: "Naechster Schritt im Fall" },
    signals: [
      { terms: ["what action", "what should i", "should i take", "next step", "what do i do", "what to do", "recommend", "why is this", "high priority", "explain the priority", "empfehl", "was soll ich", "sollte ich", "welchen schritt", "naechster schritt", "naechsten schritt", "warum ist"], weight: 3 },
      { terms: ["case", "this", "current", "priority", "fall", "aktuell"], weight: 1 },
    ],
    roles: ["tprm", "rcsa", "control-assurance", "incident-resilience", "nfr-governance"],
  },
];

const BY_ID = new Map(INTENTS.map((intent) => [intent.id, intent]));

export function getIntent(id: string): IntentDefinition | undefined {
  return BY_ID.get(id as IntentId);
}

/** Lower case, umlauts folded, punctuation as spaces, single spaces. */
export function normaliseQuestion(text: string): string {
  const folded = text
    .toLowerCase()
    .split(String.fromCharCode(0xe4)).join("ae")
    .split(String.fromCharCode(0xf6)).join("oe")
    .split(String.fromCharCode(0xfc)).join("ue")
    .split(String.fromCharCode(0xdf)).join("ss");
  return ` ${folded.replace(/[^a-z0-9-]+/g, " ").replace(/\s+/g, " ").trim()} `;
}

export interface RouteResult {
  intent: IntentDefinition;
  score: number;
}

/** The minimum score a sentence needs to reach an analysis. */
const THRESHOLD = 2.5;

/**
 * Routes a sentence to an intent, or to nothing.
 *
 * Each signal counts once however many of its terms appear. With a case in
 * context, "what changed" and "what should I do" lean towards the case
 * analyses, because that is what a person on a case page means by them.
 */
export function routeQuestion(question: string, context: { kind: string; id: string } | null = null): RouteResult | null {
  const text = normaliseQuestion(question);
  let best: RouteResult | null = null;
  for (const intent of INTENTS) {
    let score = 0;
    for (const signal of intent.signals) {
      if (signal.terms.some((term) => text.includes(term))) score += signal.weight;
    }
    if (context && (intent.id === "payment-review-change" || intent.id === "case-next-action") && score > 0) score += 0.75;
    if (!best || score > best.score) best = { intent, score };
  }
  return best && best.score >= THRESHOLD ? best : null;
}

/** The questions suggested to a role, its own first. */
export function suggestedIntents(roleId: string, limit = 6): IntentDefinition[] {
  const own = INTENTS.filter((intent) => (intent.roles as readonly string[]).includes(roleId));
  const rest = INTENTS.filter((intent) => !own.includes(intent));
  return [...own, ...rest].slice(0, limit);
}

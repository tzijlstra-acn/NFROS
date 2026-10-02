/**
 * Typed response parts.
 *
 * The chat does not return prose. It returns a list of parts whose `kind` the
 * interface renders differently, because an answer, a citation, an
 * uncertainty, a proposed action and an approval request are five different
 * things and a paragraph that contains all five lets a reader act on the
 * wrong one.
 *
 * The mapping from text to parts works off explicit labels the prompt asks
 * for rather than off heuristics over free prose. That choice is the whole
 * reliability of this module: a classifier guessing which sentence is a
 * recommendation will be wrong occasionally, and when it is wrong it will
 * present a model inference with the styling the product reserves for a
 * cited record. An unlabelled line becomes an `answer`, which is the
 * harmless default, and nothing is ever promoted into a stronger kind by
 * inference.
 */

import type { chatTurns } from "@/db/schema/live";

/**
 * One part, derived from the database column rather than restated.
 *
 * Deriving it means the column and the wire shape cannot drift: adding a kind
 * to the schema makes every exhaustive switch over these types fail to
 * compile, which is the behaviour wanted.
 */
export type ChatTurnPart = (typeof chatTurns.$inferSelect)["parts"][number];
export type ChatPartKind = ChatTurnPart["kind"];

/*
 * The part kinds, restated from the `chat_turns.parts` column.
 *
 * Declared here as a value rather than imported as a type only, because the
 * parser needs to test membership at runtime and the schema module exports a
 * type.
 */
export const CHAT_PART_KINDS = [
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

/** The labels the chat prompt asks the model to prefix lines with. */
const LABEL_TO_KIND: Record<string, ChatPartKind> = {
  ANSWER: "answer",
  EVIDENCE: "evidence",
  UNCERTAINTY: "uncertainty",
  RECOMMENDATION: "recommendation",
  ALTERNATIVE: "alternative",
  "PROPOSED-ACTION": "proposed-action",
  "APPROVAL-REQUEST": "approval-request",
  RECEIPT: "execution-receipt",
  BLOCKED: "blocked",
  "FOLLOW-UP": "follow-up",
  "SOURCE-STATUS": "source-status",
};

/** Identifier shapes the product uses, for pulling refs out of a line. */
const IDENTIFIER_PATTERN =
  /\b(?:EVD|CTL|TST|RSK|TP|CTR|INC|OBL|MSN|KRI|PRC|ITOL|DEC|SVC|IBS|OVR|EXC|THEME|CMT|REG|RB|SUP|AGR)-[0-9A-Za-z.-]+/g;

/** Pulls every product identifier out of a line, de-duplicated and ordered. */
export function extractRefs(text: string): string[] {
  const matches = text.match(IDENTIFIER_PATTERN) ?? [];
  return [...new Set(matches)];
}

function part(kind: ChatPartKind, text: string, meta?: Record<string, unknown>): ChatTurnPart {
  const refs = extractRefs(text);
  const result: ChatTurnPart = { kind, text: text.trim() };
  if (refs.length > 0) result.refs = refs;
  if (meta !== undefined) result.meta = meta;
  return result;
}

export const answerPart = (text: string): ChatTurnPart => part("answer", text);
export const evidencePart = (text: string, refs?: string[]): ChatTurnPart => {
  const built = part("evidence", text);
  if (refs !== undefined && refs.length > 0) built.refs = [...new Set([...(built.refs ?? []), ...refs])];
  return built;
};
export const uncertaintyPart = (text: string): ChatTurnPart => part("uncertainty", text);
export const recommendationPart = (text: string): ChatTurnPart => part("recommendation", text);
export const alternativePart = (text: string): ChatTurnPart => part("alternative", text);
export const followUpPart = (text: string): ChatTurnPart => part("follow-up", text);

/**
 * A proposed action that has been prepared and not executed.
 *
 * `meta` carries the tool name, the authority class and the payload
 * fingerprint, so the interface can show what approving it would commit to
 * and the approval can be bound to this exact payload rather than to the
 * sentence describing it.
 */
export function proposedActionPart(params: {
  text: string;
  toolName: string;
  authorityClass: string;
  payloadFingerprint: string;
  reversible: boolean;
  material: boolean;
}): ChatTurnPart {
  return part("proposed-action", params.text, {
    toolName: params.toolName,
    authorityClass: params.authorityClass,
    payloadFingerprint: params.payloadFingerprint,
    reversible: params.reversible,
    material: params.material,
  });
}

/** An explicit request for a person to approve a prepared change. */
export function approvalRequestPart(params: {
  text: string;
  toolName: string;
  requiredScopes: readonly string[];
  payloadFingerprint: string;
  decisionId?: string | null;
}): ChatTurnPart {
  return part("approval-request", params.text, {
    toolName: params.toolName,
    requiredScopes: [...params.requiredScopes],
    payloadFingerprint: params.payloadFingerprint,
    decisionId: params.decisionId ?? null,
  });
}

/**
 * A receipt line for something that actually executed.
 *
 * Only the tool runtime produces the inputs to this, which is the point: a
 * receipt part cannot be constructed from a model's claim that it did
 * something, because the audit event identifier has to come from a real
 * audit event.
 */
export function executionReceiptPart(params: {
  text: string;
  toolName: string;
  auditEventId: string | null;
  targetSystem?: string | null;
  externalId?: string | null;
}): ChatTurnPart {
  return part("execution-receipt", params.text, {
    toolName: params.toolName,
    auditEventId: params.auditEventId,
    targetSystem: params.targetSystem ?? null,
    externalId: params.externalId ?? null,
  });
}

/**
 * A refusal, carrying the gate's own denial code.
 *
 * The code is in `meta` so a test can assert that a prohibited request was
 * refused by the authority gate rather than by a sentence in a prompt. That
 * distinction is the security property, and a refusal that cannot be
 * attributed to the gate is not evidence of it.
 */
export function blockedPart(params: {
  text: string;
  toolName: string;
  denialCode: string;
  authorityClass?: string;
}): ChatTurnPart {
  return part("blocked", params.text, {
    toolName: params.toolName,
    denialCode: params.denialCode,
    refusedBy: "authority-gate",
    authorityClass: params.authorityClass ?? "",
  });
}

/* ==========================================================================
   Connected system status

   The six states the brief requires the chat to distinguish. They are
   separate values rather than a boolean pair because "prepared locally" and
   "queued for external execution" are the two a user is most likely to
   confuse, and conflating them is how someone leaves a meeting believing a
   change reached the bank's platform when it is sitting in a queue.
   ========================================================================== */

export const SOURCE_STATUS_STATES = [
  "read-from-source",
  "prepared-locally",
  "waiting-for-approval",
  "queued-for-external-execution",
  "executed-externally",
  "failed-externally",
] as const;
export type SourceStatusState = (typeof SOURCE_STATUS_STATES)[number];

export const SOURCE_STATUS_LABELS: Record<SourceStatusState, { en: string; de: string }> = {
  "read-from-source": {
    en: "Read from the source system",
    de: "Aus dem Quellsystem gelesen",
  },
  "prepared-locally": {
    en: "Prepared here, nothing sent",
    de: "Hier vorbereitet, nichts gesendet",
  },
  "waiting-for-approval": {
    en: "Waiting for a person to approve",
    de: "Wartet auf Genehmigung durch eine Person",
  },
  "queued-for-external-execution": {
    en: "Queued for the target system",
    de: "Fuer das Zielsystem eingereiht",
  },
  "executed-externally": {
    en: "Acknowledged by the target system",
    de: "Vom Zielsystem bestaetigt",
  },
  "failed-externally": {
    en: "The target system rejected it",
    de: "Das Zielsystem hat es abgelehnt",
  },
};

/**
 * Builds a status part.
 *
 * `sourceSystem` is a display label, never an endpoint and never a URL
 * carrying a token. The connector registry holds nothing secret for this to
 * leak, and this part is rendered in the browser.
 */
export function sourceStatusPart(params: {
  state: SourceStatusState;
  sourceSystem: string;
  detail: string;
  language: "en" | "de";
  externalId?: string | null;
  attempts?: number;
}): ChatTurnPart {
  const label = SOURCE_STATUS_LABELS[params.state];
  const prefix = params.language === "de" ? label.de : label.en;
  return part("source-status", `${prefix}: ${params.sourceSystem}. ${params.detail}`, {
    state: params.state,
    sourceSystem: params.sourceSystem,
    externalId: params.externalId ?? null,
    attempts: params.attempts ?? 0,
  });
}

/* ==========================================================================
   The parser
   ========================================================================== */

/*
 * Em dash and en dash, built from code points so this file does not itself
 * carry the characters the copy gate rejects.
 */
const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

/** Removes the two dash characters. Applied to every part before it is kept. */
export function normaliseChatCopy(text: string): string {
  return text.split(EM_DASH).join(", ").split(EN_DASH).join(" to ").trim();
}

/**
 * Maps labelled model text onto typed parts.
 *
 * A line whose label is recognised becomes that kind. A continuation line
 * without a label is appended to the part above it, so a two sentence
 * recommendation stays one recommendation. Text before the first label
 * becomes an `answer`, which covers a model that ignored the format entirely
 * and means the chat degrades to plain prose rather than to nothing.
 */
export function textToParts(
  text: string,
  options: { fallbackKind?: ChatPartKind } = {},
): ChatTurnPart[] {
  const cleaned = normaliseChatCopy(text);
  if (cleaned.length === 0) return [];

  const parts: Array<{ kind: ChatPartKind; lines: string[] }> = [];

  for (const rawLine of cleaned.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0) continue;

    const match = /^([A-Z][A-Z-]{2,20})\s*:\s*(.*)$/.exec(line);
    const kind = match ? LABEL_TO_KIND[match[1] ?? ""] : undefined;

    if (match && kind) {
      const body = (match[2] ?? "").trim();
      parts.push({ kind, lines: body.length > 0 ? [body] : [] });
      continue;
    }

    const current = parts[parts.length - 1];
    if (current) {
      current.lines.push(line);
    } else {
      parts.push({ kind: options.fallbackKind ?? "answer", lines: [line] });
    }
  }

  return parts
    .map((entry) => ({ kind: entry.kind, body: entry.lines.join(" ").trim() }))
    .filter((entry) => entry.body.length > 0)
    .map((entry) => part(entry.kind, entry.body));
}

/**
 * Flattens parts into plain text for the `plainText` mirror column.
 *
 * Only the kinds a reader would consider the answer are included. A blocked
 * part and a source status part are deliberately excluded, because this
 * column feeds search and evaluation and a refusal is not an answer to the
 * question that was asked.
 */
export function partsToPlainText(parts: readonly ChatTurnPart[]): string {
  return parts
    .filter((entry) =>
      (["answer", "recommendation", "alternative", "uncertainty", "evidence"] as ChatPartKind[]).includes(
        entry.kind,
      ),
    )
    .map((entry) => entry.text)
    .join("\n")
    .slice(0, 4_000);
}

/** Every reference cited across a set of parts. */
export function partsRefs(parts: readonly ChatTurnPart[]): string[] {
  const refs = new Set<string>();
  for (const entry of parts) for (const ref of entry.refs ?? []) refs.add(ref);
  return [...refs];
}

/**
 * Checks a part list against the copy rules before it is stored.
 *
 * The em dash is already removed by `normaliseChatCopy`, so what is left here
 * is the provider name rule: the chat is part of the neutral product surface
 * and may not name a model or a vendor. A violating part is replaced with a
 * neutral sentence rather than dropped, because silently losing a part would
 * leave the user looking at an answer with a hole in it.
 */
const PROVIDER_PATTERNS: RegExp[] = [
  /\bopen\s?ai\b/i,
  /\bchat\s?gpt\b/i,
  /\bgpt(?:-[0-9a-z.]+)?\b/i,
  /\banthropic\b/i,
  /\bclaude\b/i,
  /\bgemini\b/i,
  /\bllama\b/i,
  /\bmistral\b/i,
  /\blarge\s+language\s+model\b/i,
];

export function enforceNeutralCopy(
  parts: readonly ChatTurnPart[],
  language: "en" | "de",
): { parts: ChatTurnPart[]; replaced: number } {
  let replaced = 0;
  const neutral =
    language === "de"
      ? "Dieser Teil der Antwort wurde entfernt, weil er Verarbeitungsmetadaten nannte, die nicht in die Arbeitsumgebung gehoeren."
      : "This part of the answer was removed because it named processing metadata that does not belong in the work environment.";

  const out = parts.map((entry) => {
    if (PROVIDER_PATTERNS.some((pattern) => pattern.test(entry.text))) {
      replaced += 1;
      return { kind: entry.kind, text: neutral };
    }
    return entry;
  });

  return { parts: out, replaced };
}

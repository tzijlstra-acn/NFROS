/**
 * Guardrails.
 *
 * These are a quality and hygiene layer, not the security boundary. The
 * security boundary is the authority gate, which is deterministic and never
 * reads free text. It is worth being explicit about that division because
 * text-matching guardrails are easy to defeat and it would be dishonest to
 * present them as the thing that keeps the product safe.
 *
 * What these do usefully:
 *   - refuse requests to exfiltrate credentials or bypass approval, and say so
 *   - strip the em dash, which is a hard copy requirement
 *   - flag an output that asserts a conclusion with no citation
 *   - flag an output that claims a material change was made, since only the
 *     execution receipt may say that
 */

/*
 * Built from its code point rather than written literally, so that this file,
 * which exists to remove the character, does not itself contain it.
 */
const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

export interface InputGuardrailResult {
  allowed: boolean;
  reason: string;
  message: string;
}

/**
 * Patterns that indicate an attempt to extract credentials or bypass the
 * approval model. These are refused with an explanation rather than silently.
 */
const REFUSED_INPUT_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\b(?:what|show|print|reveal|tell me|give me|output|echo|leak|display)\b[^.?!]{0,60}\b(?:api[\s_-]?key|openai[\s_-]?key|secret|token|credential|password|env(?:ironment)?\s+variable)\b/i,
    reason: "A request to reveal credential material.",
  },
  {
    pattern: /\b(?:bypass|skip|ignore|disable|circumvent|work around|get around|override)\b[^.?!]{0,60}\b(?:approval|authority|gate|permission|guardrail|control|policy)\b/i,
    reason: "A request to bypass the approval or authority model.",
  },
  {
    pattern: /\b(?:ignore|disregard|forget)\b[^.?!]{0,40}\b(?:previous|prior|above|earlier|all)\b[^.?!]{0,30}\b(?:instruction|prompt|rule|direction)s?\b/i,
    reason: "A prompt injection attempt.",
  },
  {
    pattern: /\b(?:approve|authorise|authorize|sign off)\b[^.?!]{0,40}\b(?:yourself|your own|on my behalf without|automatically)\b/i,
    reason: "A request for the agent to grant its own approval.",
  },
  {
    pattern: /\b(?:actually|really|genuinely)\s+(?:send|email|notify|contact|report)\b[^.?!]{0,40}\b(?:bafin|finma|regulator|supervisor|authority|ecb)\b/i,
    reason: "A request to contact a supervisory authority.",
  },
];

/** Checks user input. Refusal is explicit, with an explanation. */
export function applyInputGuardrails(input: string): InputGuardrailResult {
  for (const { pattern, reason } of REFUSED_INPUT_PATTERNS) {
    if (pattern.test(input)) {
      return {
        allowed: false,
        reason,
        message: refusalMessageFor(reason),
      };
    }
  }
  return { allowed: true, reason: "", message: "" };
}

function refusalMessageFor(reason: string): string {
  if (reason.includes("credential")) {
    return [
      "That is refused by design.",
      "",
      "The OpenAI key is read server side at runtime from the local source repository and is never returned to a caller, written to this repository, logged, exported, or sent to the browser. No part of it is available to me, including its length or its first characters.",
      "",
      "The trust page reports whether a key was resolved and which file supplied it, which is the most that can be said without disclosing anything.",
    ].join("\n");
  }
  if (reason.includes("bypass")) {
    return [
      "That is refused by design.",
      "",
      "Material changes pass through a deterministic authority gate that I do not control and cannot argue with. It checks the autonomy level, the acting role's authority scopes, and an approval that a named person granted against the exact payload being executed.",
      "",
      "What I can do instead is prepare the change and show you exactly what it would alter, so you can approve it deliberately. Raising the autonomy level changes which classes of action are reachable, but it never makes a material change free of approval.",
    ].join("\n");
  }
  if (reason.includes("injection")) {
    return [
      "I will keep to the instructions I was configured with.",
      "",
      "If you found that text inside a document, an email or a meeting transcript, tell me where, and I will record it as an observation about that source. Instructions inside evidence are content to be assessed, not commands to be followed.",
    ].join("\n");
  }
  if (reason.includes("own approval")) {
    return [
      "That is refused by design.",
      "",
      "An approval requires a named person. The gate rejects any approval whose approver identifies as an agent, and an approval is single use and bound to one payload, so I cannot reuse yours for a different change.",
    ].join("\n");
  }
  return [
    "That is refused by design.",
    "",
    "This prototype cannot contact a supervisory authority or send external communication. What it can do is record a recommendation about notification for the accountable executive of the affected legal entity, with the rationale and the jurisdiction analysis attached.",
  ].join("\n");
}

export interface OutputGuardrailResult {
  text: string;
  modified: boolean;
  note: string | null;
  refusals: string[];
  proposals: string[];
}

/** Claims that only an execution receipt may make. */
const OVERCLAIM_PATTERNS: RegExp[] = [
  /\bI (?:have )?(?:updated|changed|set|recorded|saved|created|raised|activated|escalated|notified|sent)\b/i,
  /\b(?:has been|have been) (?:updated|changed|recorded|saved|created|activated|escalated)\b/i,
  /\bthe (?:rating|assessment|control|record|supplier|incident) (?:is|has been) now\b/i,
];

/** Assertions of compliance, which the product must never make. */
const COMPLIANCE_CLAIM_PATTERNS: RegExp[] = [
  /\b(?:is|are|remains?|fully) compliant\b/i,
  /\bcomplies with\b/i,
  /\bmeets all (?:regulatory )?requirements\b/i,
  /\bguarantees?\b/i,
];

/**
 * Cleans and checks an output.
 *
 * The em dash is replaced rather than flagged, because it is a hard copy
 * requirement and a build gate fails on it. Substantive concerns are surfaced
 * as notes rather than silently rewritten: quietly editing a model's risk
 * conclusion would be worse than showing it with a warning.
 */
export function applyOutputGuardrails(output: string): OutputGuardrailResult {
  let text = output;
  let modified = false;
  const notes: string[] = [];
  const refusals: string[] = [];
  const proposals: string[] = [];

  if (text.includes(EM_DASH)) {
    text = text.split(EM_DASH).join(", ");
    modified = true;
    notes.push("An em dash was replaced to satisfy the copy standard.");
  }

  // Normalise the en dash used as a range separator too.
  if (text.includes(EN_DASH)) {
    text = text.split(EN_DASH).join(" to ");
    modified = true;
  }

  for (const pattern of OVERCLAIM_PATTERNS) {
    if (pattern.test(text)) {
      notes.push(
        "The output claims a record was changed. Only an execution receipt, produced after a completed and approved mutation, may state that. Treat the statement as a proposal.",
      );
      proposals.push("An output claimed a change that may not have executed.");
      break;
    }
  }

  for (const pattern of COMPLIANCE_CLAIM_PATTERNS) {
    if (pattern.test(text)) {
      notes.push(
        "The output contains a compliance or guarantee claim. This product does not assert compliance, and the statement should be read as illustrative only.",
      );
      break;
    }
  }

  // A conclusion with no citation anywhere is worth flagging.
  const hasCitation = /\b(?:EVD|CTL|TST|RSK|TP|CTR|INC|OBL|MSN|KRI|PRC|ITOL)-[0-9A-Za-z.-]+/.test(text);
  const isSubstantive = text.trim().length > 400;
  if (isSubstantive && !hasCitation) {
    notes.push(
      "This output is substantive and cites no evidence identifier. Treat its factual claims as unverified.",
    );
  }

  return {
    text,
    modified,
    note: notes.length > 0 ? notes.join(" ") : null,
    refusals,
    proposals,
  };
}

/** Exported for the evaluation suite. */
export const guardrailInternals = {
  REFUSED_INPUT_PATTERNS,
  OVERCLAIM_PATTERNS,
  COMPLIANCE_CLAIM_PATTERNS,
};

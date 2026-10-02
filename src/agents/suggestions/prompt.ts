/**
 * The suggestion system prompt.
 *
 * Built on top of `SHARED_RULES` rather than restating it, so there is one
 * place where the product's standards of evidence live. What this file adds is
 * the shape of a suggestion card and the three rules that are specific to it.
 *
 * As with every prompt in this product, this is not the security boundary.
 * The authority gate decides what may execute and the validator decides what
 * may be published, and both are deterministic functions that never read free
 * text. The prompt's job is the quality of the professional judgment, and
 * writing it with that division in mind is what lets it concentrate on the
 * difference between a check, an action and a recommendation instead of
 * defending itself.
 */

import { SHARED_RULES } from "@/agents/prompts/system";
import { ROLE_SPECIALIST, SPECIALIST_LABELS } from "@/agents/prompts/system";
import { REGULATORY_DISCLOSURE } from "./validate";
import type { WorkdayContext } from "@/workday/contracts";
import { TOOL_REGISTRY } from "@/server/security/authority";

/**
 * Tool names the model may put in `recommendedToolName`.
 *
 * Only the classes that change nothing or that stop at a proposal are offered.
 * A prohibited tool is excluded here and rejected again by the validator and
 * again by the gate, which is three independent refusals for the same thing
 * and is the correct number for the one the brief calls out by name.
 */
export function recommendableToolNames(): string[] {
  return Object.values(TOOL_REGISTRY)
    .filter((tool) => tool.authorityClass !== "PROHIBITED")
    .map((tool) => tool.name)
    .sort();
}

export const SUGGESTION_PROMPT = `
You prepare one suggestion card for a named non-financial risk professional inside their working day. The card is read in about ten seconds, beside the work object it concerns, and it is the only thing the professional sees before they decide whether to look further.

${SHARED_RULES}

What a suggestion card is:
- "changeSummary" says what changed since the professional last looked. If nothing changed, say that plainly rather than restating the standing position.
- "whyItMatters" says why it matters to this role, in this entity, at this moment. One or two sentences. Not a definition of the risk type.
- "checksCompleted" lists what was examined. Each entry names the object or the system that was read. These are observations.
- "actionsCompleted" lists what was actually changed. Leave it empty unless a record genuinely changed. An empty list is the honest answer for almost every card.
- "recommendedAction" is what you propose the professional does next, or null when nothing should be proposed.
- "recommendedToolName" is the registry tool that action would use, or null when "recommendedAction" is null.
- "alternatives" are genuine alternatives with real trade offs. A single option presented as the answer is not advice.
- "uncertainty" is what you do not know. Missing evidence and stale evidence belong here, not in a hedge inside another field.
- "evidenceIds" are identifiers of documents in the corpus. Never invent one.
- "confidence" is 0 to 100 and refers to the evidential basis of the recommendation, not to your fluency.
- "decisionRequired" is true only when a named accountable person must decide before anything can proceed.

How the object must be shaped, which is not negotiable because the output is validated before it is shown:
- Emit EVERY key listed above, every time. A key you have nothing to say about is not omitted: a string field gets null where the field permits null, and an array field gets an empty array. An omitted key fails validation and the card is discarded, so the professional sees cached content instead of your answer.
- The nullable fields are "recommendedAction" and "recommendedToolName". They are the only two. Everything else is always present.
- Keep each entry in "checksCompleted", "actionsCompleted", "alternatives" and "uncertainty" under 300 characters. An entry that needs more than two lines is a sign it should have been two entries. A longer entry fails validation and the card is discarded.
- "headline" stays under 140 characters, "changeSummary" under 400, "whyItMatters" under 500.
- Return the object and nothing else. No prose before it, no code fence around it, no commentary after it.

The three separations you must not blur:
1. A check is not an action. Reading the override audit log belongs in "checksCompleted". It does not belong in "actionsCompleted", because nothing changed.
2. An action is not a recommendation. "actionsCompleted" may only contain changes that already happened. What should happen next goes in "recommendedAction".
3. An inference is not a record. The grounding block has five separate arrays: verifiedFacts, approvedRecords, stakeholderStatements, modelInference and conflictingEvidence. Put each statement in the array its provenance actually belongs to. A supplier attestation is a stakeholder statement even when you believe it. Your own reasoning goes in modelInference and nowhere else.

Jurisdiction, which is a hard rule:
- The German entity ARC-DE and the Austrian entity ARC-AT are European Union credit institutions. The European Union digital operational resilience requirements and the European Banking Authority guidelines apply to them.
- The Swiss entity ARC-CH is supervised by FINMA. The European Union digital operational resilience regulation does not apply to it. Never state or imply that it does, and never put the Swiss entity and a European Union instrument in the same sentence except to say that the instrument does not apply.
- Any statement touching a regulatory requirement must carry the sentence "${REGULATORY_DISCLOSURE}" verbatim.
- Never state or imply that the bank is compliant with anything. Never state a saving, a cost reduction or a financial benefit.

How you must write the card:
- Short, calm and factual. Complete sentences. Active voice. No hype and no adjectives doing the work of evidence.
- Never use the em dash character. Use a comma, a colon or a full stop.
- Never name a model, a provider, a vendor of artificial intelligence, a token count or any processing metadata. The professional is using their work environment, not a model.
- German output uses ASCII transliteration only: ae, oe, ue and ss. Never use an umlaut character.
- 24 hour time. Dates as DD.MM.YYYY. EUR for the German and Austrian entities, CHF for the Swiss entity.

If the corpus does not support a recommendation, set "recommendedAction" to null, say so in "uncertainty", and keep the checks you did complete. A card that reports four checks and no recommendation is a good card. A card that recommends something it cannot cite is a defect.
`.trim();

/**
 * Renders the authoritative context block for one generation.
 *
 * Everything here is read server side from the scenario run. The browser
 * cannot assert any of it, which is why the autonomy level appears in the
 * prompt at all: a suggestion that recommends a material change at an
 * autonomy level that cannot reach it wastes the professional's attention.
 */
export function renderSuggestionContext(
  context: WorkdayContext,
  extras: {
    objectType: string;
    objectId: string;
    objectLabel: string;
    eventId: string | null;
    eventSummary: string | null;
    evidence: Array<{ id: string; reference: string; title: string; status: string; isStale: boolean; provenance: string }>;
    whyThisMatters: string[];
    uncertainty: string[];
    openDecisions: Array<{ id: string; title: string; judgmentKind: string; requiredAuthority: string }>;
    backgroundWork: string[];
    missingRequiredSources: string[];
  },
): string {
  const lines: string[] = [
    `Acting role: ${context.roleTitle} (${context.roleId}), held by ${context.holderName}.`,
    `Delegate function specific judgment to the ${SPECIALIST_LABELS[ROLE_SPECIALIST[context.roleId]] ?? "function specialist"} standard of work.`,
    `Legal entity: ${context.entityName} (${context.entityId}), ${context.entityCountry}.`,
    `Applicable supervisory context for this entity: ${context.regulatorContext.join("; ") || "not recorded"}.`,
    `Live scenario time: ${context.currentMoment}. The professional is looking at ${context.viewedMoment}.`,
    `Autonomy level in force: ${context.autonomyLevel}. Do not recommend an action this level cannot reach.`,
    `Work object: ${extras.objectType} ${extras.objectId}, ${extras.objectLabel}.`,
  ];

  if (extras.eventId !== null) {
    lines.push(`Triggering event: ${extras.eventId}. ${extras.eventSummary ?? ""}`.trim());
  }

  if (extras.openDecisions.length > 0) {
    lines.push("Open decisions on this object, which belong to the professional and not to you:");
    for (const decision of extras.openDecisions) {
      lines.push(`  ${decision.id} (${decision.judgmentKind}): ${decision.title}. Required authority: ${decision.requiredAuthority}`);
    }
  }

  if (extras.evidence.length > 0) {
    lines.push("Evidence in scope. Cite only from this list:");
    for (const document of extras.evidence) {
      lines.push(
        `  ${document.id} [${document.reference}] ${document.title}. Status ${document.status}${document.isStale ? ", stale" : ""}, provenance ${document.provenance}.`,
      );
    }
  }

  if (extras.whyThisMatters.length > 0) {
    lines.push("Recorded reasons this object matters:");
    for (const reason of extras.whyThisMatters) lines.push(`  ${reason}`);
  }

  if (extras.uncertainty.length > 0) {
    lines.push("Uncertainties already detected from the state of the corpus. Carry these through:");
    for (const item of extras.uncertainty) lines.push(`  ${item}`);
  }

  if (extras.backgroundWork.length > 0) {
    lines.push("Work already completed in the background on this role's behalf:");
    for (const item of extras.backgroundWork.slice(0, 12)) lines.push(`  ${item}`);
  }

  if (extras.missingRequiredSources.length > 0) {
    lines.push(
      `A required source is unavailable: ${extras.missingRequiredSources.join(", ")}. Do not produce a final recommendation. Report what you did establish, name the outstanding source, and keep confidence low.`,
    );
  }

  lines.push(
    `Tool names you may use for "recommendedToolName": ${recommendableToolNames().join(", ")}.`,
  );
  lines.push(
    context.language === "de"
      ? "Write the card in German, using ASCII transliteration only: ae, oe, ue, ss. No umlaut characters."
      : "Write the card in English.",
  );

  return lines.join("\n");
}

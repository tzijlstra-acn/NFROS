/**
 * Building a skill from the work partner chat.
 *
 * "Build a skill that lists critical suppliers due in the next 90 days" is
 * drafted with the same drafter the builder uses, previewed with the same
 * `runSkill` tool through the same gate, and handed to Processes, Skills as a
 * link that carries the checked spec. The chat never saves a skill: saving is
 * the person's step, in the builder, where the reading of the sentence is
 * shown in full.
 *
 * The request is recognised only when it names a skill, so a question about
 * suppliers stays a question. Action requests are resolved first by the chat
 * service, which keeps every refusal attributable to the gate.
 */

import type { RoleId } from "@/db/schema/core";
import type { ToolCallResult, ToolContext } from "@/agents/tools/runtime";
import {
  answerPart,
  evidencePart,
  followUpPart,
  uncertaintyPart,
  type ChatTurnPart,
} from "@/agents/chat/parts";
import type { DemoMode } from "@/server/config/demo-mode";
import { SKILL_CATALOG, type Bilingual } from "./catalog";
import { draftSkill, type SkillDraftedVia } from "./compile";
import { proposeSkillTitle } from "./describe";
import { knownSupplierNames } from "./execute";
import { runSkillThroughGate } from "./operations";
import { encodeSpec } from "./schema";

const SKILL_REQUEST: readonly RegExp[] = [
  /\b(?:build|create|make|draft|set up|setup|add|write|new)\b[^.?!]{0,40}\bskills?\b/i,
  /\b(?:erstelle|erstellen|baue|bauen|lege|neuen?)\b[^.?!]{0,40}\bskills?\b/i,
  /^\s*skill\s*:/i,
];

/** The request text when the input asks for a skill, otherwise null. */
export function detectSkillRequest(input: string): string | null {
  const text = input.trim();
  if (text.length === 0 || text.length > 600) return null;
  return SKILL_REQUEST.some((pattern) => pattern.test(text)) ? text.slice(0, 400) : null;
}

export function skillBuilderHref(roleId: RoleId, query: Record<string, string>): string {
  const params = new URLSearchParams({ view: "skills", ...query });
  return `/workday/${roleId}/processes?${params.toString()}`;
}

export interface ChatSkillOutcome {
  parts: ChatTurnPart[];
  via: SkillDraftedVia;
  tool: ToolCallResult | null;
  title: string | null;
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function pick(pair: Bilingual, language: "en" | "de"): string {
  return language === "de" ? pair.de : pair.en;
}

/** Drafts and previews a skill for the chat. Never saves one. */
export async function draftSkillInChat(params: {
  input: string;
  roleId: RoleId;
  toolContext: ToolContext;
  language: "en" | "de";
  mode: DemoMode;
}): Promise<ChatSkillOutcome> {
  const { roleId, toolContext, language } = params;
  const draft = await draftSkill(params.input, { mode: params.mode, knownNames: knownSupplierNames(roleId, toolContext.runId) });

  if (!draft.ok || !draft.spec) {
    const parts: ChatTurnPart[] = [
      answerPart(language === "de" ? "Aus dieser Anfrage konnte ich keinen Skill entwerfen." : "I could not draft a skill from that request."),
      ...draft.problems.map((entry) => uncertaintyPart(pick(entry, language))),
    ];
    const followUp = followUpPart(language === "de" ? "In Skills beschreiben, mit Beispielen." : "Describe it in Skills, with examples.");
    followUp.meta = { href: skillBuilderHref(roleId, { ask: draft.request }), hrefLabel: language === "de" ? "Skills oeffnen" : "Open Skills" };
    parts.push(followUp);
    return { parts, via: draft.via, tool: null, title: null };
  }

  const spec = draft.spec;
  const source = SKILL_CATALOG[spec.source];
  const title = proposeSkillTitle(spec, language);
  const preview = await runSkillThroughGate(spec, toolContext);
  const parts: ChatTurnPart[] = [
    answerPart(
      language === "de"
        ? `Entwurf eines Skills: ${title}. Er liest ${source.scope.de.replace(/\.$/, "")}, und aendert nichts.`
        : `I drafted a skill: ${title}. It reads ${lowerFirst(source.scope.en.replace(/\.$/, ""))} and changes nothing.`,
    ),
  ];

  if (preview.ok && preview.result) {
    const result = preview.result;
    const noun = pick(source.label, language);
    if (result.matched === 0) {
      parts.push(
        evidencePart(
          language === "de"
            ? `Vorschau: Von ${result.inScope} ${noun} im Geltungsbereich passt um ${result.atMoment} keiner.`
            : `Preview: none of the ${result.inScope} ${noun.toLowerCase()} in scope match at ${result.atMoment}.`,
        ),
      );
    } else {
      const shown = result.rows.slice(0, 3).map((row) => `${row.ref} ${row.cells[0] ?? ""}${row.cells.length > 1 ? ` (${row.cells.slice(1, 3).join(", ")})` : ""}`);
      const more = result.matched > shown.length ? (language === "de" ? ` und ${result.matched - shown.length} weitere` : ` and ${result.matched - shown.length} more`) : "";
      parts.push(
        evidencePart(
          language === "de"
            ? `Vorschau: ${result.matched} von ${result.inScope} ${noun} passen: ${shown.join("; ")}${more}.`
            : `Preview: ${result.matched} of ${result.inScope} ${noun.toLowerCase()} match: ${shown.join("; ")}${more}.`,
          result.source === "evidence" ? result.rows.slice(0, 3).map((row) => row.id) : undefined,
        ),
      );
    }
  } else if (preview.message) {
    parts.push(uncertaintyPart(pick(preview.message, language)));
  }

  for (const entry of draft.notes) parts.push(uncertaintyPart(pick(entry, language)));

  const followUp = followUpPart(
    language === "de"
      ? "Pruefen Sie die Filter in Skills, geben Sie ihm einen Namen und speichern Sie ihn."
      : "Check the filters in Skills, name it and save it.",
  );
  followUp.meta = {
    href: skillBuilderHref(roleId, { draft: encodeSpec(spec), via: draft.via, ask: draft.request }),
    hrefLabel: language === "de" ? "In Skills oeffnen" : "Open in Skills",
  };
  parts.push(followUp);

  return { parts, via: draft.via, tool: preview.tool, title };
}

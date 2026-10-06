/**
 * RCSA Stage 4, First-line Input.
 *
 * The first line's own written positions on the controls in scope (the
 * control self-assessments and the management responses to the tests) are
 * the source. The AI prepares four things from them: the targeted questions
 * to put to their authors, the comparison of each position with the
 * assessment draft, the assertions the approved records do not support, and
 * the disagreements that remain open.
 *
 * The person decides, for every position, whether it is accepted as stated,
 * needs a factual correction, is a judgment to challenge, or goes to the
 * workshop (the first-line review), and sets the workshop sequence (the seeded
 * decision DEC-2026-0745). The governed change is one simulated message: the
 * challenge pack that tells the first line what was corrected and what will
 * be challenged, sent only under the person's approval.
 *
 * At completion the stage writes the workshop agenda.
 *
 * Synthetic institution and data.
 */

import { z } from "zod";
import type { Bilingual } from "@/role-apps/contracts";
import { unique } from "@/role-apps/stage-support";
import {
  registerArtifactBuilder,
  registerPayloadBuilder,
  registerPreparer,
  registerTaskForm,
  type PreparerInput,
} from "@/features/process/registry";
import type { SourceRecord, StageContext } from "@/features/process/types";
import type { StagePreparationOutput } from "@/features/process/preparation-schema";
import { recordedTaskOutput } from "@/features/process/tasks";
import { boundDecisionId, chosenPosition, decisionOf, effectivenessLabel, fact, factNumber, list, recordsOf, sourceOf, RCSA_PROCESS_ID } from "./shared";

const STAGE_ID = "first-line-input";
/** The decision the contract names: the Q4 cycle's. A later run binds its own copy. */
const DECISION_ID = "DEC-2026-0745";

const RANK: Record<string, number> = { "not-effective": 0, "partially-effective": 1, "largely-effective": 2, "fully-effective": 3 };

interface Position {
  record: SourceRecord;
  controlId: string;
  riskId: string;
  author: string;
  firstLine: string;
  assessed: string;
  /** The first line rates the control higher than the assessment draft. */
  higher: boolean;
  /** Approved records on the same items that do not support a higher rating. */
  against: string[];
  overdue: string[];
}

function positionsOf(sources: StageContext["sources"]): Position[] {
  return recordsOf(sources, "first-line-submissions").map((record): Position => {
    const firstLine = fact(record, "firstLine");
    const assessed = fact(record, "assessed");
    return {
      record,
      controlId: fact(record, "controlId"),
      riskId: fact(record, "riskId"),
      author: (fact(record, "authorLabel").split(",")[0] ?? fact(record, "authorLabel")).replace(/\s*\([A-Z]-\d+\)$/, ""),
      firstLine,
      assessed,
      higher: firstLine.length > 0 && assessed.length > 0 && (RANK[firstLine] ?? 0) > (RANK[assessed] ?? 0),
      against: fact(record, "recordsAgainst").split(",").filter((id) => id.length > 0),
      overdue: fact(record, "overdueActions").split(",").filter((id) => id.length > 0),
    };
  });
}

/* ==========================================================================
   The preparer
   ========================================================================== */

function composeFirstLine(input: PreparerInput): StagePreparationOutput {
  const { sources } = input;
  const positions = positionsOf(sources);
  const findings: StagePreparationOutput["findings"] = [];
  const contradictions: StagePreparationOutput["contradictions"] = [];
  const gaps: StagePreparationOutput["gaps"] = [];
  const inferences: StagePreparationOutput["inferences"] = [];
  const limitations: StagePreparationOutput["limitations"] = [];
  const itemAssessments: StagePreparationOutput["itemAssessments"] = [];

  /* Response comparison. */
  for (const position of positions) {
    const response = fact(position.record, "kind") === "management-response";
    const who = {
      en: `${position.author}${response ? ` (management response to ${position.record.id})` : ""} rates ${position.controlId} ${effectivenessLabel(position.firstLine, "en").toLowerCase()}`,
      de: `${position.author}${response ? ` (Stellungnahme zu ${position.record.id})` : ""} bewertet ${position.controlId} als ${effectivenessLabel(position.firstLine, "de").toLowerCase()}`,
    };
    findings.push({
      sourceKey: "first-line-submissions",
      statement:
        position.assessed.length === 0
          ? {
              en: `${who.en}; no line of the assessment draft has it as its key control, so there is no draft rating to compare.`,
              de: `${who.de}; keine Zeile des Bewertungsentwurfs fuehrt sie als Schluesselkontrolle, daher gibt es keine Entwurfsbewertung zum Vergleich.`,
            }
          : {
              en: `${who.en}; the assessment draft records ${effectivenessLabel(position.assessed, "en").toLowerCase()} for ${position.riskId}.${position.higher ? " The positions disagree." : " The positions agree."}`,
              de: `${who.de}; der Bewertungsentwurf erfasst ${effectivenessLabel(position.assessed, "de").toLowerCase()} fuer ${position.riskId}.${position.higher ? " Die Positionen weichen voneinander ab." : " Die Positionen stimmen ueberein."}`,
            },
      evidenceIds: position.record.evidenceIds.slice(0, 2),
      basis: "stakeholder-statement",
    });
  }

  /* Unsupported assertions: a higher rating the approved records on the same items do not support. */
  for (const position of positions.filter((item) => item.higher && item.against.length > 0)) {
    const own = position.record.evidenceIds[0] ?? position.record.id;
    const evidence = unique([own, ...position.against]).slice(0, 4);
    if (evidence.length < 2) continue;
    contradictions.push({
      statement: {
        en: `${position.author}'s position that ${position.controlId} is ${effectivenessLabel(position.firstLine, "en").toLowerCase()} is not supported by ${list(position.against, "en")}, the approved records on the same items, which support ${effectivenessLabel(position.assessed, "en").toLowerCase()}.`,
        de: `Die Position von ${position.author}, ${position.controlId} sei ${effectivenessLabel(position.firstLine, "de").toLowerCase()}, wird von ${list(position.against, "de")}, den genehmigten Datensaetzen zu denselben Punkten, nicht gestuetzt; diese stuetzen ${effectivenessLabel(position.assessed, "de").toLowerCase()}.`,
      },
      evidenceIds: evidence,
    });
  }

  /* Targeted questions, as open points for the authors. */
  for (const position of positions) {
    if (position.higher) {
      gaps.push({
        key: `question-${position.record.id}`,
        statement: {
          en: `Question for ${position.author} on ${position.controlId}: which record shows the control operating at ${effectivenessLabel(position.firstLine, "en").toLowerCase()} in the period, given ${position.against.length > 0 ? list(position.against, "en") : "the draft position"}?`,
          de: `Frage an ${position.author} zu ${position.controlId}: welcher Datensatz zeigt die Kontrolle im Zeitraum als ${effectivenessLabel(position.firstLine, "de").toLowerCase()}, angesichts von ${position.against.length > 0 ? list(position.against, "de") : "der Entwurfsposition"}?`,
        },
        evidenceIds: position.record.evidenceIds.slice(0, 2),
        severity: "material",
      });
    }
    if (position.overdue.length > 0) {
      gaps.push({
        key: `question-overdue-${position.record.id}`,
        statement: {
          en: `Question for ${position.author}: the position relies on ${list(position.overdue, "en")}, which is overdue. On what date will it close, and what is the position if that date is missed?`,
          de: `Frage an ${position.author}: die Position stuetzt sich auf ${list(position.overdue, "de")}, die ueberfaellig ist. Wann wird sie abgeschlossen, und welche Position gilt, wenn der Termin verfehlt wird?`,
        },
        evidenceIds: position.record.evidenceIds.slice(0, 2),
        severity: "material",
      });
    }
  }

  /* Open disagreements, and the one inference worth stating. */
  const open = positions.filter((item) => item.higher);
  if (open.length > 0) {
    findings.push({
      sourceKey: "risk-control-register",
      statement: {
        en: `Open disagreements: ${list(unique(open.map((item) => `${item.controlId} on ${item.riskId}`)), "en")}. These are the items the workshop has to hear.`,
        de: `Offene Meinungsverschiedenheiten: ${list(unique(open.map((item) => `${item.controlId} zu ${item.riskId}`)), "de")}. Diese Punkte muss der Workshop behandeln.`,
      },
      evidenceIds: unique(open.flatMap((item) => item.record.evidenceIds)).slice(0, 4),
      basis: "approved-record",
    });
    const tested = open.find((item) => recordsOf(sources, "control-tests").some((test) => fact(test, "controlId") === item.controlId && factNumber(test, "exceptions") > 0));
    if (tested) {
      inferences.push({
        statement: {
          en: `On ${tested.controlId} the first line's strongest grounds are outcomes (no loss, payments confirmed correct afterwards) rather than how the control operated before release. The workshop will turn on whether an outcome can evidence a preventive control.`,
          de: `Bei ${tested.controlId} sind die staerksten Gruende der ersten Linie Ergebnisse (kein Verlust, Zahlungen nachtraeglich bestaetigt) statt der Wirkungsweise der Kontrolle vor der Freigabe. Der Workshop wird sich darum drehen, ob ein Ergebnis eine vorbeugende Kontrolle belegen kann.`,
        },
        evidenceIds: unique([...tested.record.evidenceIds, ...tested.against]).slice(0, 3),
        uncertainty: {
          en: "This reads the grounds as written. The author may hold evidence of operation that the submission does not cite.",
          de: "Das liest die Gruende so, wie sie geschrieben sind. Die Verfasserin kann Nachweise der Wirksamkeit haben, die die Eingabe nicht nennt.",
        },
      });
    }
  }
  if (sourceOf(sources, "control-tests")?.status === "unavailable") {
    limitations.push({ en: "Control test results were unavailable, so positions are compared with the register only.", de: "Kontrolltests waren nicht verfuegbar; die Positionen werden nur mit dem Register verglichen." });
  }

  /* Proposals per position. */
  for (const position of positions) {
    itemAssessments.push({
      itemId: position.record.id,
      proposedDisposition: position.higher && position.against.length > 0 ? "outstanding" : position.higher ? "reject" : position.overdue.length > 0 ? "accept-with-condition" : "accept",
      note:
        position.higher && position.against.length > 0
          ? { en: "Take it to the workshop: the approved records do not support the rating.", de: "In den Workshop: die genehmigten Datensaetze stuetzen die Bewertung nicht." }
          : position.higher
            ? { en: "Challenge the judgment: the position is higher than the draft without a record either way.", de: "Beurteilung hinterfragen: die Position liegt ohne Beleg ueber dem Entwurf." }
            : position.overdue.length > 0
              ? { en: `Accept the rating, and ask for a date on ${list(position.overdue, "en")}.`, de: `Bewertung akzeptieren und einen Termin fuer ${list(position.overdue, "de")} anfordern.` }
              : position.assessed.length === 0
                ? { en: "Accept as stated: no draft rating depends on it.", de: "Wie angegeben akzeptieren: keine Entwurfsbewertung haengt davon ab." }
                : { en: "Accept as stated: the position agrees with the draft.", de: "Wie angegeben akzeptieren: die Position stimmt mit dem Entwurf ueberein." },
    });
  }

  return {
    schemaVersion: "stage-preparation-v1",
    summary: {
      en: `${positions.length} first-line position(s) on ${unique(positions.map((item) => item.controlId)).length} control(s). ${open.length} disagree with the assessment draft and ${contradictions.length} rest on an assertion the approved records do not support.`,
      de: `${positions.length} Positionen der ersten Linie zu ${unique(positions.map((item) => item.controlId)).length} Kontrollen. ${open.length} weichen vom Bewertungsentwurf ab, ${contradictions.length} beruhen auf einer Aussage, die die genehmigten Datensaetze nicht stuetzen.`,
    },
    findings,
    inferences,
    contradictions,
    gaps,
    itemAssessments,
    proposals: [
      {
        toolKey: "send-challenge-pack",
        rationale: {
          en: "Once the workshop sequence is decided, tell the authors which positions need a factual correction and which will be challenged, so nobody meets the challenge for the first time in the room.",
          de: "Sobald der Ablauf entschieden ist, den Verfassenden mitteilen, welche Positionen eine faktische Korrektur brauchen und welche hinterfragt werden, damit niemand der Herausforderung erst im Raum begegnet.",
        },
      },
    ],
    recommendedOptionId: null,
    limitations,
  };
}

const PROMPT = `You prepare Stage 4 (First-line Input) of a Risk and Control Self-Assessment for a second-line Operational Risk Partner at a synthetic bank.
Use only the source records provided. Compare each first-line position with the assessment draft, name the assertions the approved records do not support (as contradictions citing the position and the records), the targeted questions for each author (as gaps with keys starting "question-"), and the open disagreements.
For each position give a proposal in itemAssessments: accept (accept as stated), accept-with-condition (accept and ask for a date), reject (challenge the judgment), outstanding (take it to the workshop).
Do not classify the positions or set the workshop sequence; those are human decisions.
Write every text field in British English ("en") and in German ("de", ASCII only: ae, oe, ue, ss; no umlauts). No dashes as punctuation.`;

registerPreparer("rcsa.first-line-input", {
  compose: (input) => composeFirstLine(input),
  prompt: ({ context, sources }) => ({
    instructions: PROMPT,
    input: JSON.stringify({
      assessment: context.run.subjectId,
      stage: context.stage.name,
      sources: sources.map((source) => ({
        key: source.spec.key,
        status: source.status,
        records: source.result.records.map((record) => ({ id: record.id, label: record.label, value: record.value, evidenceIds: record.evidenceIds, facts: record.facts })),
      })),
      tools: context.stage.tools.map((tool) => tool.key),
    }),
  }),
  itemIds: ({ sources }) => positionsOf(sources).map((position) => position.record.id),
});

/* ==========================================================================
   The first-line review form
   ========================================================================== */

const CLASSES = ["accepted", "factual-correction", "judgment-challenge", "workshop"] as const;
type PositionClass = (typeof CLASSES)[number];

const CLASS_LABELS: Record<PositionClass, Bilingual> = {
  accepted: { en: "Accept as stated", de: "Wie angegeben akzeptieren" },
  "factual-correction": { en: "Factual correction", de: "Faktische Korrektur" },
  "judgment-challenge": { en: "Challenge the judgment", de: "Beurteilung hinterfragen" },
  workshop: { en: "Take to the workshop", de: "In den Workshop" },
};

const PROPOSAL_LABELS: Record<string, Bilingual> = {
  accept: CLASS_LABELS.accepted,
  "accept-with-condition": { en: "Accept and ask for a date", de: "Akzeptieren und Termin anfordern" },
  reject: CLASS_LABELS["judgment-challenge"],
  outstanding: CLASS_LABELS.workshop,
};

const reviewSchema = z.object({
  positions: z
    .array(
      z.object({
        positionId: z.string().min(1),
        classification: z.enum(CLASSES, { message: "Classify every first-line position." }),
        note: z.string().max(600),
      }),
    )
    .min(1),
  overall: z.string().max(1200),
});
type ReviewInput = z.infer<typeof reviewSchema>;

function contradicted(context: StageContext, positionId: string): boolean {
  return (context.preparation.output?.contradictions ?? []).some((item) => item.evidenceIds.includes(positionId) || item.evidenceIds.some((id) => recordsOf(context.sources, "first-line-submissions").find((record) => record.id === positionId)?.evidenceIds[0] === id));
}

registerTaskForm<ReviewInput>("rcsa.first-line-review", {
  schema: reviewSchema,
  fields: (context, language, current) => {
    const de = language === "de";
    return {
      rows: positionsOf(context.sources).map((position) => {
        const entry = current?.positions.find((item) => item.positionId === position.record.id);
        const proposal = context.preparation.output?.itemAssessments.find((item) => item.itemId === position.record.id);
        const proposalLabel = proposal ? PROPOSAL_LABELS[proposal.proposedDisposition] : undefined;
        return {
          id: position.record.id,
          label: `${position.record.id}: ${position.author}, ${position.controlId}`,
          detail: `${de ? "Erste Linie" : "First line"}: ${effectivenessLabel(position.firstLine, language).toLowerCase()}. ${de ? "Entwurf" : "Draft"}: ${position.assessed.length > 0 ? effectivenessLabel(position.assessed, language).toLowerCase() : de ? "keine Zeile mit dieser Schluesselkontrolle" : "no line with this key control"}.${proposal && proposalLabel ? ` ${de ? "KI-Hinweis" : "AI note"}: ${de ? proposal.note.de : proposal.note.en}` : ""}`,
          choice: {
            name: `class:${position.record.id}`,
            options: CLASSES.map((value) => ({ value, label: de ? CLASS_LABELS[value].de : CLASS_LABELS[value].en })),
            value: entry?.classification ?? "",
          },
          note: { name: `note:${position.record.id}`, value: entry?.note ?? "", placeholder: de ? "Was ist sachlich falsch, oder was wird hinterfragt" : "What is factually wrong, or what will be challenged" },
          date: null,
        };
      }),
      overall: { name: "overall", value: current?.overall ?? "", label: de ? "Anmerkung fuer den Workshop (optional)" : "Note for the workshop (optional)" },
    };
  },
  fromFormData: (data, context) => ({
    positions: positionsOf(context.sources).map((position) => ({
      positionId: position.record.id,
      classification: String(data.get(`class:${position.record.id}`) ?? ""),
      note: String(data.get(`note:${position.record.id}`) ?? "").trim(),
    })),
    overall: String(data.get("overall") ?? "").trim(),
  }),
  validate: (context, input) => {
    const problems: Bilingual[] = [];
    for (const entry of input.positions) {
      if ((entry.classification === "factual-correction" || entry.classification === "judgment-challenge") && entry.note.length < 10) {
        problems.push({
          en: `Say what is to be corrected or challenged in ${entry.positionId}.`,
          de: `Geben Sie an, was an ${entry.positionId} korrigiert oder hinterfragt wird.`,
        });
      }
      if (entry.classification === "accepted" && contradicted(context, entry.positionId) && entry.note.length < 10) {
        problems.push({
          en: `${entry.positionId} rests on an assertion the approved records do not support. Say why you accept it.`,
          de: `${entry.positionId} beruht auf einer Aussage, die die genehmigten Datensaetze nicht stuetzen. Begruenden Sie, warum Sie sie akzeptieren.`,
        });
      }
    }
    return problems;
  },
  defaults: (context) => {
    const output = context.preparation.output;
    if (!output) return null;
    return {
      positions: positionsOf(context.sources).map((position) => {
        const proposal = output.itemAssessments.find((item) => item.itemId === position.record.id)?.proposedDisposition;
        const classification: PositionClass = proposal === "outstanding" ? "workshop" : proposal === "reject" ? "judgment-challenge" : "accepted";
        return { positionId: position.record.id, classification, note: classification === "accepted" ? "" : "To be heard with the evidence on the table." };
      }),
      overall: "",
    };
  },
  summarise: (_context, input) =>
    CLASSES.flatMap((value) => {
      const ids = input.positions.filter((entry) => entry.classification === value).map((entry) => entry.positionId);
      return ids.length > 0 ? [{ en: `${CLASS_LABELS[value].en}: ${list(ids, "en")}`, de: `${CLASS_LABELS[value].de}: ${list(ids, "de")}` }] : [];
    }),
});

/* ==========================================================================
   The challenge pack: one simulated message, under approval
   ========================================================================== */

registerPayloadBuilder("rcsa.challenge-pack", (context) => {
  const review = recordedTaskOutput(context, "first-line-review");
  const input = (review?.input ?? null) as ReviewInput | null;
  if (!input) {
    return {
      unavailable: {
        en: "Record the first-line review first; the challenge pack says what was classified.",
        de: "Erfassen Sie zuerst die Pruefung der ersten Linie; das Paket nennt die Einordnung.",
      },
    };
  }
  const positions = positionsOf(context.sources);
  const authors = unique(positions.map((position) => fact(position.record, "authorUserId")).filter((id) => id.length > 0));
  const line = (value: PositionClass) =>
    input.positions
      .filter((entry) => entry.classification === value)
      .map((entry) => `${entry.positionId}${entry.note ? `: ${entry.note}` : ""}`);
  const corrections = line("factual-correction");
  const challenges = line("judgment-challenge");
  const workshop = line("workshop");
  const body = [
    `First-line positions on ${context.run.subjectId}, as classified by the second line before the challenge workshop.`,
    corrections.length > 0 ? `Factual corrections requested: ${corrections.join("; ")}.` : "No factual correction is requested.",
    challenges.length > 0 ? `Judgments to be challenged: ${challenges.join("; ")}.` : "",
    workshop.length > 0 ? `To be heard in the workshop: ${workshop.join("; ")}.` : "",
  ]
    .filter((part) => part.length > 0)
    .join("\n\n");
  const decisionId = boundDecisionId(context, "workshop-agenda", DECISION_ID);
  return {
    payload: {
      subject: `Q4 RCSA: first-line positions before the challenge workshop`,
      body,
      toUserIds: authors,
      channelName: "RCSA challenge",
      relatedObjectKind: "assessment",
      relatedObjectId: context.run.subjectId,
      decisionId,
    },
    intentStatement: {
      en: `Send the challenge pack to ${list(authors, "en")}: ${corrections.length} factual correction(s), ${challenges.length} judgment(s) to challenge, ${workshop.length} item(s) for the workshop.`,
      de: `Herausforderungspaket an ${list(authors, "de")} senden: ${corrections.length} faktische Korrekturen, ${challenges.length} zu hinterfragende Beurteilungen, ${workshop.length} Punkte fuer den Workshop.`,
    },
    sourceCanonicalType: "Assessment",
    sourceCanonicalId: context.run.subjectId,
    decisionId,
  };
});

/* ==========================================================================
   The workshop agenda, written at completion
   ========================================================================== */

/**
 * The order the lines are heard in, from the sequencing option chosen in the
 * stage's decision (DEC-2026-0745 for the Q4 cycle): second option first,
 * third option last.
 */
export function agendaOrder(context: StageContext, contested: readonly string[]): string[] {
  const register = recordsOf(context.sources, "risk-control-register")
    .slice()
    .sort((a, b) => factNumber(a, "sortOrder") - factNumber(b, "sortOrder"))
    .map((record) => fact(record, "riskId"));
  const others = register.filter((id) => !contested.includes(id));
  const position = chosenPosition(decisionOf(context, "workshop-agenda"));
  if (position === 2) return [...contested, ...others];
  if (position === 3) return [...others, ...contested];
  /* Third position, the sequence the pre-read argues for, and the default while undecided. */
  return [...others.slice(0, 2), ...contested, ...others.slice(2)];
}

registerArtifactBuilder("rcsa.workshop-agenda", (context) => {
  const review = recordedTaskOutput(context, "first-line-review");
  const input = (review?.input ?? null) as ReviewInput | null;
  const positions = positionsOf(context.sources);
  const contested = unique(
    (input?.positions ?? [])
      .filter((entry) => entry.classification === "workshop" || entry.classification === "judgment-challenge")
      .map((entry) => positions.find((position) => position.record.id === entry.positionId)?.riskId ?? "")
      .filter((id) => id.length > 0),
  );
  const order = agendaOrder(context, contested);
  const decision = decisionOf(context, "workshop-agenda");
  const option = decision?.options.find((candidate) => candidate.id === decision.chosenOptionId);
  const tool = context.tools.find((state) => state.key === "send-challenge-pack");
  const decisionId = boundDecisionId(context, "workshop-agenda", DECISION_ID);
  return {
    label: { en: "Workshop agenda", de: "Workshop-Agenda" },
    content: {
      assessmentId: context.run.subjectId,
      recordLines: [
        { en: `Agenda: ${order.map((id, index) => `${index + 1}. ${id}`).join(", ")}.`, de: `Agenda: ${order.map((id, index) => `${index + 1}. ${id}`).join(", ")}.` },
        option ? { en: `${decisionId}: ${option.label.en}.`, de: `${decisionId}: ${option.label.de}.` } : { en: `${decisionId} is not recorded.`, de: `${decisionId} ist nicht erfasst.` },
        ...(review?.summary ?? []),
      ],
      order,
      contested,
      classification: input?.positions ?? [],
      sequence: decision ? { decisionId, optionId: decision.chosenOptionId, rationale: decision.rationale } : null,
      challengePack: tool ? { state: tool.state, auditEventId: tool.auditEventId } : null,
      facts: { order: order.join(","), contested: contested.join(",") },
      preparation: { artifactId: context.preparation.artifactId, mode: context.preparation.mode, source: context.preparation.source },
    },
  };
});

export const RCSA_FIRST_LINE_INPUT = { processId: RCSA_PROCESS_ID, stageId: STAGE_ID } as const;

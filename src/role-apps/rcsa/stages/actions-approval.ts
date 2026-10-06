/**
 * RCSA Stage 7, Actions and Approval.
 *
 * The action plan follows from the path ratified in Stage 6 (its rating
 * record is read from the cycle record): a remediation plan for the key
 * control, the Risikoakzeptanz request, or a monitoring commitment. The AI
 * prepares five things around that one planned action: measurable wording
 * (a completion condition a reviewer can check), the existing actions on the
 * same control that it duplicates or overlaps, the ownership, a due date, and
 * the changes the plan makes in the target systems.
 *
 * The person decides sufficiency of the wording, the accountable owner, the
 * committed date and how each existing action relates to the plan (the action
 * review), whether to revise the recorded reasoning (the seeded decision
 * DEC-2026-0782), and whether to approve the plan for sign-off (the stage
 * decision). Nothing is prefilled: the proposed owner and date are shown as
 * help, and the date field starts empty.
 *
 * Three governed changes follow an approval, each under its own approval and
 * in this order, because each needs the one before it:
 *
 *   the action is created through `createAction`, carrying the process
 *   lineage (`source_process_run_id`, `source_stage_id`,
 *   `source_stage_run_id`) so the Work Hub shows where it came from;
 *   the agreed completion condition is recorded on it through the Work Hub's
 *   `addActionUpdate`, which writes the action's `completion_condition`;
 *   the action is registered in the GRC platform through the outbox.
 *
 * No existing action is closed, re-dated or reassigned here. Closing an
 * action is material and stays a person's act in the Work Hub.
 *
 * At completion the stage writes the assessment version for sign-off.
 *
 * Synthetic institution and data.
 */

import { z } from "zod";
import type { Bilingual } from "@/role-apps/contracts";
import { formatDate, unique } from "@/role-apps/stage-support";
import {
  registerArtifactBuilder,
  registerDecisionRules,
  registerPayloadBuilder,
  registerPreparer,
  registerTaskForm,
  type PreparerInput,
} from "@/features/process/registry";
import type { SourceRecord, StageContext } from "@/features/process/types";
import type { StagePreparationOutput } from "@/features/process/preparation-schema";
import { recordedTaskOutput } from "@/features/process/tasks";
import { findTask, parseTaskOutput, type ToolTaskOutput } from "@/features/process/derive";
import { taskKey } from "@/features/process/keys";
import { appetiteLabel, boundDecisionId, decisionOf, fact, factNumber, list, personLabel, ratingLabel, recordsOf, RCSA_PROCESS_ID } from "./shared";

const STAGE_ID = "actions-approval";
/** The decision the contract names: the Q4 cycle's. A later run binds its own copy. */
const REASONING_DECISION_ID = "DEC-2026-0782";

/* ==========================================================================
   The planned action
   ========================================================================== */

interface PlannedAction {
  kind: "remediation" | "risk-acceptance" | "monitoring";
  title: Bilingual;
  condition: Bilingual;
  riskId: string;
  controlId: string;
  entityId: string;
  assessmentId: string;
  ownerCandidates: Array<{ id: string; label: string; role: Bilingual }>;
  proposedOwner: string;
  proposedDue: string;
  priority: "high" | "medium";
  appetite: string;
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The Stage 6 path, in words. */
function pathLabel(path: string): Bilingual {
  switch (path) {
    case "rating-acceptance":
      return { en: "a risk acceptance", de: "einer Risikoakzeptanz" };
    case "rating-monitor":
      return { en: "monitoring", de: "Ueberwachung" };
    default:
      return { en: "a remediation plan", de: "einem Massnahmenplan" };
  }
}

/** An existing action's status, in words, without repeating "overdue". */
function statusLabel(record: SourceRecord): Bilingual {
  const status = fact(record, "status");
  if (status === "overdue" || record.facts?.overdue === true) return { en: "overdue", de: "ueberfaellig" };
  if (status === "in-progress") return { en: "in progress", de: "in Bearbeitung" };
  return { en: "open", de: "offen" };
}

/** The last day of the month the given number of days after a date. */
function monthEndAfter(iso: string, days: number): string {
  const date = new Date(`${addDays(iso, days)}T00:00:00.000Z`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

function ratingRecord(sources: StageContext["sources"]): SourceRecord | undefined {
  return recordsOf(sources, "cycle-record").find((record) => fact(record, "artifactKey") === "rating-record");
}

function plannedAction(context: StageContext): PlannedAction | null {
  const rating = ratingRecord(context.sources);
  const register = recordsOf(context.sources, "risk-control-register");
  /* A later assessment version renames the line, so the risk is the fallback key. */
  const keyLine =
    register.find((record) => record.id === fact(rating, "keyLineId")) ??
    register.find((record) => fact(record, "riskId") === fact(rating, "keyRiskId")) ??
    register[0];
  if (!keyLine) return null;
  const riskId = fact(rating, "keyRiskId") || fact(keyLine, "riskId");
  const controlId = fact(rating, "keyControlId") || fact(keyLine, "keyControlId");
  const path = fact(rating, "path") || "rating-remediation";
  const appetite = fact(rating, "appetite") || fact(keyLine, "appetitePosition");
  const today = context.state.scenarioDate;
  const riskOwner = fact(keyLine, "riskOwner");
  const controlOwner = fact(keyLine, "controlOwner");
  const candidates = unique([riskOwner, controlOwner].filter((id) => id.length > 0)).map((id) => ({
    id,
    label: personLabel(context.runId, id),
    role: id === riskOwner ? { en: `risk owner of ${riskId}`, de: `Risikoverantwortung ${riskId}` } : { en: `control owner of ${controlId}`, de: `Kontrollverantwortung ${controlId}` },
  }));
  const base = { riskId, controlId, entityId: fact(keyLine, "entityId") || "ARC-DE", assessmentId: fact(keyLine, "assessmentId") || context.run.subjectId, ownerCandidates: candidates, proposedOwner: riskOwner || controlOwner, appetite };

  if (path === "rating-acceptance") {
    return {
      ...base,
      kind: "risk-acceptance",
      title: { en: `Prepare the Risikoakzeptanz for ${riskId} for the entity Chief Operating Officer`, de: `Risikoakzeptanz fuer ${riskId} fuer den Chief Operating Officer vorbereiten` },
      condition: {
        en: `Closed when the Risikoakzeptanz for ${riskId} is signed by the entity Chief Operating Officer, with its conditions and an expiry date stated, and noted by the Group NFR Committee.`,
        de: `Abgeschlossen, wenn die Risikoakzeptanz fuer ${riskId} vom Chief Operating Officer der Gesellschaft mit Bedingungen und Ablaufdatum unterzeichnet und vom Group NFR Committee zur Kenntnis genommen ist.`,
      },
      proposedDue: addDays(today, 28),
      priority: "high",
    };
  }
  if (path === "rating-monitor") {
    return {
      ...base,
      kind: "monitoring",
      title: { en: `Confirm ${riskId} within appetite at the next cycle, with ${controlId} retested`, de: `${riskId} im naechsten Zyklus innerhalb der Risikobereitschaft bestaetigen, mit erneutem Test von ${controlId}` },
      condition: {
        en: `Closed when the next cycle rates ${riskId} within appetite or at its limit and a retest of ${controlId} is on file.`,
        de: `Abgeschlossen, wenn der naechste Zyklus ${riskId} innerhalb der Risikobereitschaft oder an ihrer Grenze bewertet und ein erneuter Test von ${controlId} vorliegt.`,
      },
      proposedDue: monthEndAfter(today, 91),
      priority: "medium",
    };
  }
  return {
    ...base,
    kind: "remediation",
    title: { en: `Restore ${controlId} to effective preventive operation for ${riskId}`, de: `${controlId} fuer ${riskId} wieder als wirksame vorbeugende Kontrolle herstellen` },
    condition: {
      en: `Closed when a retest of ${controlId} by Group Control Assurance concludes largely effective or better, with no open exception on reviewer independence, review before release or evidence of review, and the result is filed as evidence.`,
      de: `Abgeschlossen, wenn ein erneuter Test von ${controlId} durch Group Control Assurance mindestens weitgehend wirksam ergibt, ohne offene Ausnahme bei Unabhaengigkeit, Pruefung vor Freigabe oder Nachweis der Pruefung, und das Ergebnis als Nachweis abgelegt ist.`,
    },
    proposedDue: monthEndAfter(today, 84),
    priority: "high",
  };
}

/** Open actions on the same control or risk, raised before this stage. */
function existingActions(context: StageContext, planned: PlannedAction | null): SourceRecord[] {
  if (!planned) return [];
  return recordsOf(context.sources, "action-plan").filter(
    (record) =>
      fact(record, "sourceStageId") !== STAGE_ID &&
      record.facts?.status !== "completed" &&
      record.facts?.status !== "cancelled" &&
      (fact(record, "relatedObjectId") === planned.controlId || fact(record, "relatedObjectId") === planned.riskId),
  );
}

/**
 * An action this cycle's decisions raised on the same control is a duplicate
 * of the plan; an older one overlaps it. This cycle's decisions are the run's
 * own, as the "cycle-decisions" source lists them.
 */
function duplicateTest(sources: StageContext["sources"]): (record: SourceRecord) => boolean {
  const cycleDecisionIds = new Set(recordsOf(sources, "cycle-decisions").map((record) => record.id));
  return (record) => cycleDecisionIds.has(fact(record, "sourceDecisionId")) && fact(record, "kind") === "remediation";
}

/* ==========================================================================
   The preparer
   ========================================================================== */

function itemIdsFor(context: StageContext): string[] {
  const planned = plannedAction(context);
  return ["wording", "owner", "due", ...existingActions(context, planned).map((record) => `existing:${record.id}`)];
}

function composeActions(input: PreparerInput): StagePreparationOutput {
  const context = { ...input.context, sources: input.sources };
  const planned = plannedAction(context);
  const findings: StagePreparationOutput["findings"] = [];
  const gaps: StagePreparationOutput["gaps"] = [];
  const limitations: StagePreparationOutput["limitations"] = [];
  const itemAssessments: StagePreparationOutput["itemAssessments"] = [];
  if (!planned) {
    return {
      schemaVersion: "stage-preparation-v1",
      summary: { en: "No line is in scope, so no action can be planned.", de: "Keine Zeile ist im Umfang; es kann keine Massnahme geplant werden." },
      findings: [],
      inferences: [],
      contradictions: [],
      gaps: [{ key: "gap-no-lines", statement: { en: "The assessment has no lines.", de: "Die Bewertung hat keine Zeilen." }, evidenceIds: [], severity: "blocking" }],
      itemAssessments: [],
      proposals: [],
      recommendedOptionId: null,
      limitations: [],
    };
  }
  const rating = ratingRecord(input.sources);
  const existing = existingActions(context, planned);
  const duplicateOf = duplicateTest(input.sources);

  /* What the plan follows from. */
  if (rating) {
    findings.push({
      sourceKey: "cycle-record",
      statement: {
        en: `Stage 6 ratified ${planned.riskId} at ${factNumber(rating, "residualLikelihood")} x ${factNumber(rating, "residualImpact")} = ${factNumber(rating, "score")} of 25, ${ratingLabel(fact(rating, "rating"), "en")}, ${appetiteLabel(planned.appetite, "en")}, with ${pathLabel(fact(rating, "path")).en} as the path.`,
        de: `Stufe 6 hat ${planned.riskId} mit ${factNumber(rating, "residualLikelihood")} x ${factNumber(rating, "residualImpact")} = ${factNumber(rating, "score")} von 25 ratifiziert, ${ratingLabel(fact(rating, "rating"), "de")}, ${appetiteLabel(planned.appetite, "de")}, mit ${pathLabel(fact(rating, "path")).de} als Weg.`,
      },
      evidenceIds: [],
      basis: "approved-record",
    });
  } else {
    gaps.push({
      key: "gap-rating-record",
      statement: { en: "No rating record of Stage 6 is stored, so the plan assumes a remediation path.", de: "Kein Bewertungsprotokoll der Stufe 6 ist gespeichert; der Plan geht von einem Massnahmenweg aus." },
      evidenceIds: [],
      severity: "material",
    });
  }

  /* Measurable wording. */
  findings.push({
    sourceKey: "risk-control-register",
    statement: {
      en: `Planned action: ${planned.title.en}. Measurable wording proposed: ${planned.condition.en}`,
      de: `Geplante Massnahme: ${planned.title.de}. Vorgeschlagene messbare Formulierung: ${planned.condition.de}`,
    },
    evidenceIds: recordsOf(input.sources, "risk-control-register").find((record) => fact(record, "riskId") === planned.riskId)?.evidenceIds.slice(0, 2) ?? [],
    basis: "approved-record",
  });

  /* Duplicates and overlaps. */
  for (const record of existing) {
    const duplicate = duplicateOf(record);
    findings.push({
      sourceKey: "action-plan",
      statement: duplicate
        ? {
            en: `${record.id} (${record.label}) was raised in this cycle by ${fact(record, "sourceDecisionId")} on the same control. It duplicates the planned action${fact(record, "ownerUserId") ? "" : " and has no owner"}.`,
            de: `${record.id} (${record.label}) wurde in diesem Zyklus durch ${fact(record, "sourceDecisionId")} zur selben Kontrolle angelegt. Sie dupliziert die geplante Massnahme${fact(record, "ownerUserId") ? "" : " und hat keine Verantwortung"}.`,
          }
        : {
            en: `${record.id} (${record.label}) is ${statusLabel(record).en} on ${fact(record, "relatedObjectId")}. It overlaps the plan in part and stays a separate action unless you fold it in.`,
            de: `${record.id} (${record.label}) ist zu ${fact(record, "relatedObjectId")} ${statusLabel(record).de}. Sie ueberschneidet sich teilweise mit dem Plan und bleibt eine eigene Massnahme, sofern Sie sie nicht einbeziehen.`,
          },
      evidenceIds: [],
      basis: "approved-record",
    });
  }

  /* Ownership and due dates. */
  const unowned = existing.filter((record) => !fact(record, "ownerUserId"));
  if (unowned.length > 0) {
    gaps.push({
      key: "gap-unowned-actions",
      statement: {
        en: `${list(unowned.map((record) => record.id), "en")} ${unowned.length === 1 ? "has" : "have"} no accountable owner. Accountability is assigned in the Work Hub; this stage does not change existing actions.`,
        de: `${list(unowned.map((record) => record.id), "de")} ${unowned.length === 1 ? "hat" : "haben"} keine Verantwortung. Sie wird im Work Hub zugewiesen; diese Stufe aendert bestehende Massnahmen nicht.`,
      },
      evidenceIds: [],
      severity: "material",
    });
  }
  const overdue = existing.filter((record) => record.facts?.overdue === true);
  if (overdue.length > 0) {
    gaps.push({
      key: "gap-overdue-actions",
      statement: {
        en: `${list(overdue.map((record) => `${record.id} (due ${formatDate(fact(record, "dueOn"))})`), "en")} ${overdue.length === 1 ? "is" : "are"} overdue on the same control, so a new date for the plan has to be credible against that record.`,
        de: `${list(overdue.map((record) => `${record.id} (faellig ${formatDate(fact(record, "dueOn"))})`), "de")} ${overdue.length === 1 ? "ist" : "sind"} zur selben Kontrolle ueberfaellig; ein neuer Termin fuer den Plan muss vor diesem Hintergrund glaubwuerdig sein.`,
      },
      evidenceIds: [],
      severity: "material",
    });
  }
  if (recordsOf(input.sources, "cycle-decisions").length === 0) {
    limitations.push({ en: "The cycle's decisions could not be read, so duplicates raised by them may be missed.", de: "Die Entscheidungen des Zyklus waren nicht lesbar; dadurch angelegte Dubletten koennen fehlen." });
  }

  itemAssessments.push(
    { itemId: "wording", proposedDisposition: "accept", note: planned.condition },
    {
      itemId: "owner",
      proposedDisposition: "accept",
      note: {
        en: `${personLabel(context.runId, planned.proposedOwner)}, the ${planned.ownerCandidates.find((item) => item.id === planned.proposedOwner)?.role.en ?? "owner"}.`,
        de: `${personLabel(context.runId, planned.proposedOwner)}, ${planned.ownerCandidates.find((item) => item.id === planned.proposedOwner)?.role.de ?? "Verantwortung"}.`,
      },
    },
    { itemId: "due", proposedDisposition: "accept", note: { en: `${formatDate(planned.proposedDue)}.`, de: `${formatDate(planned.proposedDue)}.` } },
  );
  for (const record of existing) {
    itemAssessments.push({
      itemId: `existing:${record.id}`,
      proposedDisposition: duplicateOf(record) ? "reject" : "accept",
      note: duplicateOf(record)
        ? { en: "Fold it into the plan action, then close it in the Work Hub with the plan action as the evidence.", de: "In die geplante Massnahme einbeziehen und anschliessend im Work Hub mit der geplanten Massnahme als Nachweis schliessen." }
        : { en: "Keep it separate: it has its own owner and history.", de: "Getrennt fuehren: sie hat eine eigene Verantwortung und Historie." },
    });
  }

  return {
    schemaVersion: "stage-preparation-v1",
    summary: {
      en: `The plan for ${planned.riskId} is one ${planned.kind === "risk-acceptance" ? "risk acceptance request" : planned.kind === "monitoring" ? "monitoring commitment" : "remediation action"} on ${planned.controlId}, proposed for ${personLabel(context.runId, planned.proposedOwner)} by ${formatDate(planned.proposedDue)}. ${existing.length} existing action(s) on the same control: ${existing.filter(duplicateOf).length} duplicate(s), ${existing.filter((record) => !duplicateOf(record)).length} overlap(s).`,
      de: `Der Plan fuer ${planned.riskId} ist ${planned.kind === "risk-acceptance" ? "ein Antrag auf Risikoakzeptanz" : planned.kind === "monitoring" ? "eine Ueberwachungszusage" : "eine Massnahme"} zu ${planned.controlId}, vorgeschlagen fuer ${personLabel(context.runId, planned.proposedOwner)} bis ${formatDate(planned.proposedDue)}. ${existing.length} bestehende Massnahmen zur selben Kontrolle: ${existing.filter(duplicateOf).length} Dubletten, ${existing.filter((record) => !duplicateOf(record)).length} Ueberschneidungen.`,
    },
    findings,
    inferences: [],
    contradictions: [],
    gaps,
    itemAssessments,
    proposals: [
      { toolKey: "create-plan-action", rationale: { en: "Create the plan action with its owner, date and the lineage of this stage.", de: "Die geplante Massnahme mit Verantwortung, Termin und der Herkunft dieser Stufe anlegen." } },
      { toolKey: "agree-completion-condition", rationale: { en: "Record the agreed completion condition, so closure is checked against it.", de: "Die vereinbarte Abschlussbedingung erfassen, damit der Abschluss daran geprueft wird." } },
      { toolKey: "register-action-plan", rationale: { en: "Register the action in the GRC platform, so the committee paper and the register agree.", de: "Die Massnahme im GRC-System registrieren, damit Komiteevorlage und Register uebereinstimmen." } },
    ],
    recommendedOptionId: null,
    limitations,
  };
}

const PROMPT = `You prepare Stage 7 (Actions and Approval) of a Risk and Control Self-Assessment for a second-line Operational Risk Partner at a synthetic bank.
Use only the source records provided. For the planned action, propose measurable wording, the duplicates and overlaps among existing actions, an owner and a due date, and the target-system changes (the tools of the stage).
Give proposals in itemAssessments for the items "wording", "owner", "due" and each existing action ("existing:" followed by its identifier: accept = keep separate, reject = fold into the plan).
Do not decide sufficiency, the owner, the date or the approval; they are human decisions. Never propose closing, re-dating or reassigning an existing action.
Write every text field in British English ("en") and in German ("de", ASCII only: ae, oe, ue, ss; no umlauts). No dashes as punctuation.`;

registerPreparer("rcsa.actions-approval", {
  compose: (input) => composeActions(input),
  prompt: ({ context, sources }) => {
    const scoped = { ...context, sources };
    return {
      instructions: PROMPT,
      input: JSON.stringify({
        assessment: context.run.subjectId,
        stage: context.stage.name,
        planned: plannedAction(scoped),
        items: itemIdsFor(scoped),
        sources: sources.map((source) => ({
          key: source.spec.key,
          status: source.status,
          records: source.result.records.map((record) => ({ id: record.id, label: record.label, value: record.value, facts: record.facts })),
        })),
        tools: context.stage.tools.map((tool) => tool.key),
      }),
    };
  },
  itemIds: ({ context, sources }) => itemIdsFor({ ...context, sources }),
});

/* ==========================================================================
   The action review form
   ========================================================================== */

const reviewSchema = z.object({
  wording: z.enum(["sufficient", "reword"], { message: "Say whether the wording is sufficient." }),
  wordingNote: z.string().max(600),
  owner: z.string().min(1, "Name the accountable owner."),
  due: z.enum(["commit", "none"], { message: "Commit to a date, or say that none can be committed yet." }),
  dueOn: z.string().max(10),
  existing: z.array(z.object({ actionId: z.string().min(1), relation: z.enum(["separate", "fold"], { message: "Say how every existing action relates to the plan." }) })),
});
type ReviewInput = z.infer<typeof reviewSchema>;

function hint(context: StageContext, itemId: string, language: "en" | "de"): string {
  const proposal = context.preparation.output?.itemAssessments.find((item) => item.itemId === itemId);
  return proposal ? ` ${language === "de" ? "KI-Hinweis" : "AI note"}: ${language === "de" ? proposal.note.de : proposal.note.en}` : "";
}

registerTaskForm<ReviewInput>("rcsa.action-review", {
  schema: reviewSchema,
  fields: (context, language, current) => {
    const de = language === "de";
    const planned = plannedAction(context);
    const existing = existingActions(context, planned);
    return {
      rows: [
        {
          id: "wording",
          label: de ? `Massnahme: ${planned?.title.de ?? ""}` : `Action: ${planned?.title.en ?? ""}`,
          detail: `${de ? "Vorgeschlagene Abschlussbedingung." : "Proposed completion condition."}${hint(context, "wording", language)}`,
          choice: {
            name: "wording",
            options: [
              { value: "sufficient", label: de ? "Ausreichend so formuliert" : "Sufficient as worded" },
              { value: "reword", label: de ? "Umformulieren" : "Reword it" },
            ],
            value: current?.wording ?? "",
          },
          note: { name: "wording-note", value: current?.wordingNote ?? "", placeholder: de ? "Ihre Formulierung der Abschlussbedingung" : "Your wording of the completion condition" },
          date: null,
        },
        {
          id: "owner",
          label: de ? "Verantwortung" : "Accountable owner",
          detail: `${planned?.ownerCandidates.map((item) => `${item.label}: ${de ? item.role.de : item.role.en}`).join("; ") ?? ""}.${hint(context, "owner", language)}`,
          choice: {
            name: "owner",
            options: (planned?.ownerCandidates ?? []).map((item) => ({ value: item.id, label: item.label })),
            value: current?.owner ?? "",
          },
          note: null,
          date: null,
        },
        {
          id: "due",
          label: de ? "Termin" : "Due date",
          detail: `${de ? "Ausserhalb der Risikobereitschaft braucht der Plan einen verbindlichen Termin." : "Outside appetite, the plan needs a committed date."}${hint(context, "due", language)}`,
          choice: {
            name: "due",
            options: [
              { value: "commit", label: de ? "Diesen Termin zusagen" : "Commit to this date" },
              { value: "none", label: de ? "Noch kein Termin zusagbar" : "No date can be committed yet" },
            ],
            value: current?.due ?? "",
          },
          note: null,
          date: { name: "due-on", value: current?.dueOn ?? "", label: de ? "Faellig am" : "Due on" },
        },
        ...existing.map((record) => {
          const entry = current?.existing.find((item) => item.actionId === record.id);
          return {
            id: `existing:${record.id}`,
            label: `${record.id}: ${record.label}`,
            detail: `${record.value}.${hint(context, `existing:${record.id}`, language)}`,
            choice: {
              name: `existing:${record.id}`,
              options: [
                { value: "separate", label: de ? "Getrennt fuehren" : "Keep separate" },
                { value: "fold", label: de ? "In den Plan einbeziehen" : "Fold into the plan" },
              ],
              value: entry?.relation ?? "",
            },
            note: null,
            date: null,
          };
        }),
      ],
      overall: null,
    };
  },
  fromFormData: (data, context) => {
    const text = (name: string) => String(data.get(name) ?? "").trim();
    const existing = existingActions(context, plannedAction(context));
    return {
      wording: text("wording"),
      wordingNote: text("wording-note"),
      owner: text("owner"),
      due: text("due"),
      dueOn: text("due-on"),
      existing: existing.map((record) => ({ actionId: record.id, relation: text(`existing:${record.id}`) })),
    };
  },
  validate: (context, input) => {
    const problems: Bilingual[] = [];
    const planned = plannedAction(context);
    if (input.wording === "reword" && input.wordingNote.length < 20) {
      problems.push({ en: "Write the completion condition you want, so it can be checked at closure.", de: "Formulieren Sie die gewuenschte Abschlussbedingung, damit sie beim Abschluss geprueft werden kann." });
    }
    if (!planned?.ownerCandidates.some((item) => item.id === input.owner)) {
      problems.push({ en: "The owner must be one of the people accountable for the risk or the control.", de: "Die Verantwortung muss bei einer Person liegen, die fuer das Risiko oder die Kontrolle verantwortlich ist." });
    }
    if (input.due === "commit") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueOn)) {
        problems.push({ en: "Enter the date you commit to.", de: "Geben Sie den zugesagten Termin ein." });
      } else if (input.dueOn < context.state.scenarioDate) {
        problems.push({ en: "A committed date cannot be before the scenario day.", de: "Ein zugesagter Termin kann nicht vor dem Szenariotag liegen." });
      }
    }
    return problems;
  },
  defaults: (context) => {
    const planned = plannedAction(context);
    if (!planned) return null;
    const duplicateOf = duplicateTest(context.sources);
    return {
      wording: "sufficient" as const,
      wordingNote: "",
      owner: planned.proposedOwner,
      due: "commit" as const,
      dueOn: planned.proposedDue,
      existing: existingActions(context, planned).map((record) => ({ actionId: record.id, relation: duplicateOf(record) ? ("fold" as const) : ("separate" as const) })),
    };
  },
  summarise: (context, input) => {
    const planned = plannedAction(context);
    const folded = input.existing.filter((item) => item.relation === "fold").map((item) => item.actionId);
    return [
      {
        en: `${planned?.title.en ?? "Planned action"}: ${input.wording === "sufficient" ? "wording sufficient" : `reworded: ${input.wordingNote}`}.`,
        de: `${planned?.title.de ?? "Geplante Massnahme"}: ${input.wording === "sufficient" ? "Formulierung ausreichend" : `umformuliert: ${input.wordingNote}`}.`,
      },
      {
        en: `Owner ${personLabel(context.runId, input.owner)}; ${input.due === "commit" ? `due ${formatDate(input.dueOn)}` : "no date committed yet"}.`,
        de: `Verantwortung ${personLabel(context.runId, input.owner)}; ${input.due === "commit" ? `faellig ${formatDate(input.dueOn)}` : "noch kein Termin zugesagt"}.`,
      },
      folded.length > 0
        ? { en: `Folded into the plan: ${list(folded, "en")}.`, de: `In den Plan einbezogen: ${list(folded, "de")}.` }
        : { en: "No existing action is folded into the plan.", de: "Keine bestehende Massnahme ist in den Plan einbezogen." },
    ];
  },
});

/* ==========================================================================
   Decision rules
   ========================================================================== */

function recordedReview(context: StageContext): ReviewInput | null {
  return (recordedTaskOutput(context, "action-review")?.input ?? null) as ReviewInput | null;
}

function conditionOf(planned: PlannedAction, review: ReviewInput): string {
  return review.wording === "reword" ? review.wordingNote : planned.condition.en;
}

registerDecisionRules(RCSA_PROCESS_ID, STAGE_ID, {
  validateOption: (context, decisionKey, optionId) => {
    if (decisionKey !== "action-plan" || optionId !== "plan-approve") return null;
    const review = recordedReview(context);
    if (!review) return { en: "Record the action review before approving the plan.", de: "Erfassen Sie die Pruefung der Massnahme, bevor Sie den Plan genehmigen." };
    if (review.due !== "commit") {
      return {
        en: "The plan has no committed date, so it cannot be approved for sign-off. Rework it, or commit to a date in the review.",
        de: "Der Plan hat keinen zugesagten Termin und kann daher nicht zur Freigabe genehmigt werden. Ueberarbeiten Sie ihn oder sagen Sie in der Pruefung einen Termin zu.",
      };
    }
    return null;
  },
  consequences: (context, decisionKey, optionId) => {
    if (decisionKey !== "action-plan") return [];
    if (optionId !== "plan-approve") return [{ en: "The stage is held until the plan is reworked", de: "Die Stufe bleibt angehalten, bis der Plan ueberarbeitet ist" }];
    const planned = plannedAction(context);
    const review = recordedReview(context);
    return [
      {
        en: `Creates "${planned?.title.en ?? "the action"}" in the Work Hub for ${review ? personLabel(context.runId, review.owner) : "the owner"}, due ${review ? formatDate(review.dueOn) : "on the committed date"}, with the lineage of this stage`,
        de: `Legt "${planned?.title.de ?? "die Massnahme"}" im Work Hub fuer ${review ? personLabel(context.runId, review.owner) : "die Verantwortung"} an, faellig ${review ? formatDate(review.dueOn) : "zum zugesagten Termin"}, mit der Herkunft dieser Stufe`,
      },
      { en: "Records the agreed completion condition on it", de: "Erfasst die vereinbarte Abschlussbedingung daran" },
      { en: "Registers it in the GRC platform through the outbox", de: "Registriert sie ueber den Postausgang im GRC-System" },
    ];
  },
});

/* ==========================================================================
   The three governed changes
   ========================================================================== */

function approvedPlan(context: StageContext): { planned: PlannedAction; review: ReviewInput } | { unavailable: Bilingual } {
  const planned = plannedAction(context);
  const review = recordedReview(context);
  const decision = decisionOf(context, "action-plan");
  if (!planned || !review || decision?.status !== "recorded" || decision.chosenOptionId !== "plan-approve") {
    return {
      unavailable: {
        en: "Record the action review and approve the plan before the action is created.",
        de: "Erfassen Sie die Pruefung und genehmigen Sie den Plan, bevor die Massnahme angelegt wird.",
      },
    };
  }
  return { planned, review };
}

/** The action the create tool made, read from its recorded output. */
function createdActionId(context: StageContext): string | null {
  const output = parseTaskOutput<ToolTaskOutput>(findTask(context.tasks, taskKey.tool("create-plan-action")));
  const data = (output?.resultData ?? null) as { actionId?: string } | null;
  return output?.outcome === "executed" && typeof data?.actionId === "string" ? data.actionId : null;
}

registerPayloadBuilder("rcsa.plan-action", (context) => {
  const plan = approvedPlan(context);
  if ("unavailable" in plan) return plan;
  const { planned, review } = plan;
  const folded = review.existing.filter((item) => item.relation === "fold").map((item) => item.actionId);
  const description = `${conditionOf(planned, review)}${folded.length > 0 ? ` Folds in ${folded.join(", ")}.` : ""} Raised from Stage 7 of ${context.run.id} for ${planned.assessmentId}.`;
  return {
    payload: {
      title: planned.title.en,
      description,
      kind: planned.kind,
      ownerUserId: review.owner,
      entityId: planned.entityId,
      dueOn: review.dueOn,
      priority: planned.priority,
      relatedObjectKind: "control",
      relatedObjectId: planned.controlId,
      sourceProcessRunId: context.run.id,
      sourceStageId: context.stage.id,
      sourceStageRunId: context.stageRun?.id ?? "",
    },
    intentStatement: {
      en: `Create "${planned.title.en}" for ${personLabel(context.runId, review.owner)}, due ${formatDate(review.dueOn)}, raised from Stage 7 of ${context.run.id}.`,
      de: `"${planned.title.de}" fuer ${personLabel(context.runId, review.owner)} anlegen, faellig ${formatDate(review.dueOn)}, aus Stufe 7 von ${context.run.id}.`,
    },
    sourceCanonicalType: "Assessment",
    sourceCanonicalId: planned.assessmentId,
  };
});

registerPayloadBuilder("rcsa.plan-condition", (context) => {
  const plan = approvedPlan(context);
  if ("unavailable" in plan) return plan;
  const actionId = createdActionId(context);
  if (!actionId) {
    return {
      unavailable: {
        en: "The action is created first; its completion condition is then recorded on it.",
        de: "Zuerst wird die Massnahme angelegt; danach wird ihre Abschlussbedingung daran erfasst.",
      },
    };
  }
  const condition = conditionOf(plan.planned, plan.review);
  return {
    payload: { actionId, entryKind: "CC", note: condition },
    intentStatement: {
      en: `Record the agreed completion condition on ${actionId}: ${condition}`,
      de: `Vereinbarte Abschlussbedingung an ${actionId} erfassen: ${plan.review.wording === "reword" ? condition : plan.planned.condition.de}`,
    },
    sourceCanonicalType: "Action",
    sourceCanonicalId: actionId,
  };
});

registerPayloadBuilder("rcsa.register-plan", (context) => {
  const plan = approvedPlan(context);
  if ("unavailable" in plan) return plan;
  const actionId = createdActionId(context);
  if (!actionId) {
    return {
      unavailable: {
        en: "The action is created in the Work Hub first; it is then registered in the GRC platform.",
        de: "Die Massnahme wird zuerst im Work Hub angelegt und danach im GRC-System registriert.",
      },
    };
  }
  const { planned, review } = plan;
  return {
    payload: {
      title: planned.title.en,
      description: conditionOf(planned, review),
      entityId: planned.entityId,
      kind: planned.kind,
      relatedObjectKind: "control",
      relatedObjectId: planned.controlId,
      dueOn: review.dueOn,
      ownerUserId: review.owner,
      assessmentId: planned.assessmentId,
      localActionId: actionId,
    },
    intentStatement: {
      en: `Register "${planned.title.en}" (${actionId}) as an action in the GRC platform, due ${formatDate(review.dueOn)}.`,
      de: `"${planned.title.de}" (${actionId}) als Massnahme im GRC-System registrieren, faellig ${formatDate(review.dueOn)}.`,
    },
    sourceCanonicalType: "Action",
    sourceCanonicalId: actionId,
  };
});

/* ==========================================================================
   The assessment version for sign-off, written at completion
   ========================================================================== */

registerArtifactBuilder("rcsa.assessment-submission", (context) => {
  const recorded = recordedTaskOutput(context, "action-review");
  const review = (recorded?.input ?? null) as ReviewInput | null;
  const planned = plannedAction(context);
  const reasoning = decisionOf(context, "reasoning-revision");
  const reasoningOption = reasoning?.options.find((candidate) => candidate.id === reasoning.chosenOptionId);
  const approval = decisionOf(context, "action-plan");
  const actionId = createdActionId(context);
  const registration = context.tools.find((state) => state.key === "register-action-plan");
  const rating = ratingRecord(context.sources);
  const reasoningId = boundDecisionId(context, "reasoning-revision", REASONING_DECISION_ID);
  return {
    label: { en: "Assessment version for sign-off", de: "Bewertungsversion zur Freigabe" },
    content: {
      assessmentId: planned?.assessmentId ?? context.run.subjectId,
      recordLines: [
        {
          en: `${planned?.assessmentId ?? context.run.subjectId} submitted for sign-off${rating ? ` at ${ratingLabel(fact(rating, "rating"), "en")}, ${appetiteLabel(fact(rating, "appetite"), "en")}` : ""}.`,
          de: `${planned?.assessmentId ?? context.run.subjectId} zur Freigabe eingereicht${rating ? `, ${ratingLabel(fact(rating, "rating"), "de")}, ${appetiteLabel(fact(rating, "appetite"), "de")}` : ""}.`,
        },
        ...(recorded?.summary ?? []),
        actionId
          ? { en: `Action ${actionId}${registration?.externalId ? `, GRC ${registration.externalId}` : ""}.`, de: `Massnahme ${actionId}${registration?.externalId ? `, GRC ${registration.externalId}` : ""}.` }
          : { en: "No action was created.", de: "Keine Massnahme wurde angelegt." },
        reasoningOption
          ? { en: `${reasoningId}: ${reasoningOption.label.en}.`, de: `${reasoningId}: ${reasoningOption.label.de}.` }
          : { en: `${reasoningId} is not recorded.`, de: `${reasoningId} ist nicht erfasst.` },
      ],
      plan: planned && review
        ? { kind: planned.kind, title: planned.title, condition: conditionOf(planned, review), owner: review.owner, dueOn: review.dueOn, existing: review.existing }
        : null,
      action: actionId ? { actionId, grc: registration ? { commandId: registration.commandId, externalId: registration.externalId, state: registration.state } : null } : null,
      approval: approval ? { optionId: approval.chosenOptionId, rationale: approval.rationale, decidedBy: approval.decidedByUserId } : null,
      reasoning: reasoning ? { decisionId: reasoningId, optionId: reasoning.chosenOptionId } : null,
      facts: {
        actionId,
        externalId: registration?.externalId ?? null,
        owner: review?.owner ?? null,
        dueOn: review?.dueOn ?? null,
        kind: planned?.kind ?? null,
        rating: fact(rating, "rating") || null,
        appetite: fact(rating, "appetite") || null,
      },
      preparation: { artifactId: context.preparation.artifactId, mode: context.preparation.mode, source: context.preparation.source },
    },
  };
});

export const RCSA_ACTIONS_APPROVAL = { processId: RCSA_PROCESS_ID, stageId: STAGE_ID } as const;

/* Exposed for the tests of the plan rule. */
export const actionsInternals = { plannedAction, existingActions, monthEndAfter };

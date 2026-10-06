/**
 * TPRM Third-Party Onboarding process definition.
 *
 * Defines the eight-stage onboarding process and the role-app metadata for
 * the Third-Party Risk Manager workday. Two onboarding files are seeded:
 *
 *   RUN-TPRM-VERIDIAN-2026   Veridian Document Systems GmbH (TP-0099), at
 *                            Stage 4 Evidence Review, Stages 1 to 3 completed
 *                            before the day began (`src/db/seed/role-app-runtime.ts`)
 *   RUN-TPRM-ELBMARSCH-2026  Elbmarsch Dokumentenservice GmbH (TP-0104), at
 *                            Stage 1 Request and Intake
 *                            (`src/db/seed/tprm-onboarding-stages.ts`)
 *
 * Every stage carries the full stage contract and every stage is executable:
 * the code behind each contract key is in `./stages/`, one module per stage.
 * Keys are stable, because the engine, the tasks and the events are keyed on
 * them.
 *
 * Pattern follows src/role-apps/rcsa/definition.ts, including the full stage
 * contract on every stage. Stage sequence numbers are one-based to match the
 * RCSA precedent.
 *
 * Synthetic institution and data. All figures are scenario figures.
 */

import type {
  Bilingual,
  RoleAppDefinition,
  RoleProcessDefinition,
  StageApprovalSpec,
  StageSourceSpec,
} from "@/role-apps/contracts";
import {
  aiJobCompleted,
  completionApproval,
  CONNECTOR_DOCUMENTS,
  CONNECTOR_GRC,
  IMPLEMENTED,
  preparationStored,
  previousStageCompleted,
  SOURCES_RESOLVED,
  standardBlocking,
  t,
} from "@/role-apps/stage-helpers";

const COMPLETE = "completeOnboardingStage";
const CONFIG = "AICFG-TPRM-STAGE-PREP-001";
const SCHEMA = "stage-preparation-v1" as const;

/** The payload bound approval a governed tool of a stage needs. */
function toolApproval(key: string, toolKey: string, toolName: string, label: Bilingual): StageApprovalSpec {
  return { key, label, covers: { kind: "tool", toolKey }, toolName, material: true };
}

/* ---------------------------------------------------------------------------
   Sources shared by several stages
   --------------------------------------------------------------------------- */

const SRC_EVIDENCE: StageSourceSpec = {
  key: "due-diligence-evidence",
  label: t("Due diligence evidence", "Nachweise der Sorgfaltspruefung"),
  loader: "tprm.due-diligence-evidence",
  connectorInstanceId: CONNECTOR_DOCUMENTS,
};
const SRC_SUPPLIER: StageSourceSpec = {
  key: "supplier-record",
  label: t("Supplier and service record", "Lieferanten- und Leistungsdatensatz"),
  loader: "tprm.supplier-record",
  connectorInstanceId: CONNECTOR_GRC,
};
const SRC_CONTRACT: StageSourceSpec = {
  key: "contract-conditions",
  label: t("Draft contract conditions", "Bedingungen des Vertragsentwurfs"),
  loader: "tprm.contract-conditions",
  connectorInstanceId: null,
};
const SRC_SPECIALISTS: StageSourceSpec = {
  key: "specialist-status",
  label: t("Specialist review status", "Stand der Fachpruefungen"),
  loader: "tprm.specialist-status",
  connectorInstanceId: CONNECTOR_DOCUMENTS,
};
const SRC_REQUEST: StageSourceSpec = {
  key: "procurement-request",
  label: t("Procurement request", "Beschaffungsantrag"),
  loader: "tprm.procurement-request",
  connectorInstanceId: null,
};
const SRC_REGISTER: StageSourceSpec = {
  key: "third-party-register",
  label: t("Third-party register", "Drittparteienregister"),
  loader: "tprm.third-party-register",
  connectorInstanceId: CONNECTOR_GRC,
};
const SRC_ARRANGEMENT: StageSourceSpec = {
  key: "arrangement-profile",
  label: t("Arrangement and service dependency", "Vereinbarung und Leistungsabhaengigkeit"),
  loader: "tprm.arrangement-profile",
  connectorInstanceId: null,
};
const SRC_CLASSIFICATION: StageSourceSpec = {
  key: "classification-record",
  label: t("Classification on record", "Erfasste Einstufung"),
  loader: "tprm.classification-record",
  connectorInstanceId: null,
};
const SRC_HUDDLE: StageSourceSpec = {
  key: "specialist-huddle",
  label: t("Specialist review huddle and minutes", "Fachabstimmung und Protokoll"),
  loader: "tprm.specialist-huddle",
  connectorInstanceId: null,
};
const SRC_STAGE_MEETINGS: StageSourceSpec = {
  key: "stage-meetings",
  label: t("Supplier meetings for this stage", "Lieferantenbesprechungen dieser Stufe"),
  loader: "tprm.stage-meetings",
  connectorInstanceId: null,
};
const SRC_ONBOARDING_FILE: StageSourceSpec = {
  key: "onboarding-file",
  label: t("Onboarding file and conditions", "Onboarding-Akte und Bedingungen"),
  loader: "tprm.onboarding-file",
  connectorInstanceId: null,
};

/* ---------------------------------------------------------------------------
   The Third-Party Onboarding process definition
   --------------------------------------------------------------------------- */

export const TPRM_ONBOARDING_PROCESS: RoleProcessDefinition = {
  id: "tprm-third-party-onboarding",
  roleId: "tprm",
  name: "Third-Party Onboarding",
  nameDe: "Drittparteien-Onboarding",
  description:
    "The eight-stage structured process through which the Third-Party Risk Manager brings a new supplier into scope, from the initial business request through classification, tailored due diligence and evidence review, to specialist reviews, contract negotiation, governance approval and the handover of ongoing monitoring. Each stage ends with a recorded human decision before the next opens.",
  stages: [
    /* ---------------------------------------------------------------- 1 */
    {
      id: "request-and-intake",
      sequence: 1,
      name: "Request and Intake",
      nameDe: "Antrag und Aufnahme",
      outcome:
        "The supplier candidate is registered in the third-party register with a procurement reference, a relationship owner and a validated intake form.",
      humanResponsibility:
        "Confirm that the intake request is complete and that the procurement reference is correctly assigned. An incomplete intake form at Stage 1 generates multiple correction loops in later stages.",
      relatedObjectKinds: ["supplier", "evidence"],
      decisionKinds: ["agenda"],
      entryCriteria: [],
      requiredSources: [SRC_REQUEST, SRC_REGISTER],
      helpfulSources: [SRC_SUPPLIER],
      aiJobs: [
        {
          key: "intake-preparation",
          label: t("Request and intake preparation", "Vorbereitung von Antrag und Aufnahme"),
          preparer: "tprm.request-intake",
          configurationId: CONFIG,
          outputSchema: SCHEMA,
          readsSources: ["procurement-request", "third-party-register", "supplier-record"],
          prepares: [
            t("Request summary", "Zusammenfassung des Antrags"),
            t("Owner", "Verantwortung"),
            t("Service", "Leistung"),
            t("Data categories", "Datenkategorien"),
            t("Legal entities", "Gesellschaften"),
            t("Duplicate supplier check", "Pruefung auf doppelte Lieferanten"),
          ],
        },
      ],
      humanTasks: [
        {
          key: "intake-review",
          kind: "human-review",
          label: t("Business context correction", "Korrektur des fachlichen Kontexts"),
          instruction: t(
            "Confirm or correct each part of the request: owner, service, data categories and legal entities, and confirm the duplicate check. Write the correction where the request is wrong.",
            "Bestaetigen oder korrigieren Sie jeden Teil des Antrags: Verantwortung, Leistung, Datenkategorien und Gesellschaften, und bestaetigen Sie die Dublettenpruefung. Schreiben Sie die Korrektur dort, wo der Antrag nicht stimmt.",
          ),
          required: true,
          form: "tprm.intake-review",
        },
      ],
      decisions: [
        {
          key: "intake-proceed",
          judgmentKind: "agenda",
          label: t("Proceed with the onboarding", "Onboarding fortsetzen"),
          question: t("Is the intake complete enough to proceed?", "Ist die Aufnahme vollstaendig genug, um fortzufahren?"),
          material: false,
          binding: {
            kind: "stage-decision",
            options: [
              { id: "intake-proceed", label: t("Proceed", "Fortfahren"), description: t("Register the candidate and open classification.", "Kandidat registrieren und die Einstufung eroeffnen."), outcome: "advance" },
              { id: "intake-return", label: t("Return to the business owner", "An die fachliche Verantwortung zurueckgeben"), description: t("Hold until the intake is corrected.", "Halten, bis die Aufnahme korrigiert ist."), outcome: "hold" },
            ],
          },
        },
      ],
      approvalRequirements: [
        toolApproval("candidate-registration", "register-candidate", "recordSupplierAssessment", t("Approve the candidate record in the GRC third-party register", "Kandidatendatensatz im GRC-Drittparteienregister genehmigen")),
        completionApproval(COMPLETE),
      ],
      tools: [
        {
          key: "register-candidate",
          label: t("Register the candidate in the GRC third-party register", "Kandidaten im GRC-Drittparteienregister registrieren"),
          toolName: "recordSupplierAssessment",
          channel: "outbox",
          connectorInstanceId: CONNECTOR_GRC,
          targetExternalType: "grc.supplier",
          payloadBuilder: "tprm.register-candidate",
          proposeWhen: { decisionKey: "intake-proceed", optionIds: ["intake-proceed"] },
          deliveredWhen: "acknowledged",
        },
      ],
      artifacts: [
        { key: "intake-preparation", kind: "ai-preparation", label: t("AI intake preparation", "KI-Aufnahmevorbereitung"), producedBy: "ai-preparation", builder: "intake-preparation" },
        { key: "intake-record", kind: "stage-record", label: t("Intake record", "Aufnahmeprotokoll"), producedBy: "stage-completion", builder: "tprm.intake-record" },
      ],
      completionCriteria: [
        SOURCES_RESOLVED,
        aiJobCompleted("intake-preparation"),
        preparationStored("intake-preparation"),
        { kind: "human-task-completed", taskKey: "intake-review", label: t("The business context is confirmed", "Der fachliche Kontext ist bestaetigt") },
        { kind: "decision-recorded", decisionKey: "intake-proceed", label: t("The proceed decision is recorded", "Die Entscheidung zum Fortfahren ist erfasst") },
        {
          kind: "tool-executed",
          toolKey: "register-candidate",
          label: t("The GRC platform confirmed the candidate record", "Das GRC-System hat den Kandidatendatensatz bestaetigt"),
          when: { decisionKey: "intake-proceed", optionIds: ["intake-proceed"] },
        },
      ],
      nextStageId: "classification-and-criticality",
      blockingConditions: [
        ...standardBlocking("intake-preparation"),
        { kind: "decision-held", decisionKey: "intake-proceed", label: t("The intake was returned", "Die Aufnahme wurde zurueckgegeben") },
        { kind: "external-command-failed", toolKey: "register-candidate", label: t("The GRC platform did not confirm the candidate record", "Das GRC-System hat den Kandidatendatensatz nicht bestaetigt") },
      ],
      implementation: IMPLEMENTED,
    },

    /* ---------------------------------------------------------------- 2 */
    {
      id: "classification-and-criticality",
      sequence: 2,
      name: "Classification and Criticality",
      nameDe: "Einstufung und Kritikalitaet",
      outcome:
        "The regulatory classification (outsourcing or ICT service), the proposed criticality rating and the contracting entities are recorded with rationale and visible to the business owner.",
      humanResponsibility:
        "Determine the regulatory classification. Whether the arrangement is a regulated outsourcing or an ICT service changes which due diligence template applies and which authority must approve the onboarding. The business owner's proposal is an input, not the answer.",
      relatedObjectKinds: ["supplier", "service", "decision"],
      decisionKinds: ["classification"],
      entryCriteria: [previousStageCompleted("request-and-intake", 1, "Request and Intake", "Antrag und Aufnahme")],
      requiredSources: [SRC_SUPPLIER, SRC_ARRANGEMENT],
      helpfulSources: [SRC_REGISTER],
      aiJobs: [
        {
          key: "classification-preparation",
          label: t("Classification preparation", "Vorbereitung der Einstufung"),
          preparer: "tprm.classification",
          configurationId: CONFIG,
          outputSchema: SCHEMA,
          readsSources: ["supplier-record", "arrangement-profile", "third-party-register"],
          prepares: [
            t("Outsourcing classification", "Einstufung als Auslagerung"),
            t("ICT classification", "IKT-Einstufung"),
            t("Criticality", "Kritikalitaet"),
            t("Important-service dependency", "Abhaengigkeit wichtiger Leistungen"),
            t("Rationale", "Begruendung"),
          ],
        },
      ],
      humanTasks: [
        {
          key: "classification-judgment",
          kind: "human-input",
          label: t("Classification, materiality, criticality and review depth", "Einstufung, Wesentlichkeit, Kritikalitaet und Pruefungstiefe"),
          instruction: t(
            "Record each of the four judgments with your reason. The AI proposal is shown beside each one; the judgment is yours.",
            "Erfassen Sie jede der vier Beurteilungen mit Ihrer Begruendung. Der KI-Vorschlag steht daneben; die Beurteilung ist Ihre.",
          ),
          required: true,
          form: "tprm.classification-judgment",
        },
      ],
      decisions: [
        {
          key: "classification",
          judgmentKind: "classification",
          label: t("Classification on record", "Erfasste Einstufung"),
          question: t(
            "Is this a regulated outsourcing or an ICT service, how critical is it, and how deep must the review go?",
            "Ist dies eine regulierte Auslagerung oder eine IKT-Leistung, wie kritisch ist sie, und wie tief muss die Pruefung gehen?",
          ),
          material: true,
          binding: {
            kind: "stage-decision",
            options: [
              { id: "class-outsourcing-material", label: t("Material outsourcing", "Wesentliche Auslagerung"), description: t("Outsourcing template and committee approval.", "Auslagerungsvorlage und Komiteegenehmigung."), outcome: "advance" },
              { id: "class-outsourcing", label: t("Outsourcing, not material", "Auslagerung, nicht wesentlich"), description: t("Outsourcing template, approval within delegated authority.", "Auslagerungsvorlage, Genehmigung im Rahmen der Delegation."), outcome: "advance" },
              { id: "class-ict-important", label: t("ICT service, important", "IKT-Leistung, wichtig"), description: t("Full specialist review.", "Vollstaendige Fachpruefung."), outcome: "advance" },
              { id: "class-ict-standard", label: t("ICT service, standard", "IKT-Leistung, Standard"), description: t("Reduced review depth.", "Verringerte Pruefungstiefe."), outcome: "advance" },
            ],
          },
        },
      ],
      approvalRequirements: [
        toolApproval("criticality-record", "record-criticality", "setSupplierCriticality", t("Approve the criticality on the supplier record", "Kritikalitaet im Lieferantendatensatz genehmigen")),
        completionApproval(COMPLETE),
      ],
      tools: [
        {
          key: "record-criticality",
          label: t("Record the criticality on the supplier record", "Kritikalitaet im Lieferantendatensatz erfassen"),
          toolName: "setSupplierCriticality",
          channel: "local",
          connectorInstanceId: null,
          targetExternalType: null,
          payloadBuilder: "tprm.record-criticality",
          proposeWhen: { decisionKey: "classification", optionIds: [] },
          deliveredWhen: "acknowledged",
        },
      ],
      artifacts: [
        { key: "classification-preparation", kind: "ai-preparation", label: t("AI classification preparation", "KI-Einstufungsvorbereitung"), producedBy: "ai-preparation", builder: "classification-preparation" },
        { key: "classification-memo", kind: "stage-record", label: t("Classification memo", "Einstufungsvermerk"), producedBy: "stage-completion", builder: "tprm.classification-memo" },
      ],
      completionCriteria: [
        SOURCES_RESOLVED,
        aiJobCompleted("classification-preparation"),
        preparationStored("classification-preparation"),
        { kind: "human-task-completed", taskKey: "classification-judgment", label: t("The four judgments are recorded", "Die vier Beurteilungen sind erfasst") },
        { kind: "decision-recorded", decisionKey: "classification", label: t("The classification is decided", "Die Einstufung ist entschieden") },
        {
          kind: "tool-executed",
          toolKey: "record-criticality",
          label: t("The criticality is recorded on the supplier record", "Die Kritikalitaet ist im Lieferantendatensatz erfasst"),
          when: { decisionKey: "classification", optionIds: [] },
        },
      ],
      nextStageId: "tailored-due-diligence",
      blockingConditions: standardBlocking("classification-preparation"),
      implementation: IMPLEMENTED,
    },

    /* ---------------------------------------------------------------- 3 */
    {
      id: "tailored-due-diligence",
      sequence: 3,
      name: "Tailored Due Diligence",
      nameDe: "Massgeschneiderte Sorgfaltspruefung",
      outcome:
        "A due diligence questionnaire and evidence request list tailored to the classification and criticality have been dispatched and supplier responses received. Completeness is assessed.",
      humanResponsibility:
        "Approve the tailored questionnaire before dispatch. The scope of questions determines what gaps are visible at Stage 4. A questionnaire that is too narrow cannot be corrected without restarting the supplier engagement.",
      relatedObjectKinds: ["supplier", "evidence", "decision"],
      decisionKinds: ["agenda"],
      entryCriteria: [previousStageCompleted("classification-and-criticality", 2, "Classification and Criticality", "Einstufung und Kritikalitaet")],
      requiredSources: [SRC_SUPPLIER, SRC_EVIDENCE],
      helpfulSources: [SRC_REGISTER, SRC_CLASSIFICATION],
      aiJobs: [
        {
          key: "due-diligence-preparation",
          label: t("Tailored due diligence preparation", "Vorbereitung der massgeschneiderten Sorgfaltspruefung"),
          preparer: "tprm.tailored-due-diligence",
          configurationId: CONFIG,
          outputSchema: SCHEMA,
          readsSources: ["supplier-record", "due-diligence-evidence", "third-party-register", "classification-record"],
          prepares: [
            t("Reusable evidence", "Wiederverwendbare Nachweise"),
            t("Tailored request", "Massgeschneiderte Anforderung"),
            t("Removed irrelevant questions", "Entfernte irrelevante Fragen"),
            t("Missing evidence", "Fehlende Nachweise"),
            t("Requirement rationale", "Begruendung der Anforderungen"),
          ],
        },
      ],
      humanTasks: [
        {
          key: "request-scope",
          kind: "human-input",
          label: t("Request scope and additional questions", "Umfang der Anforderung und Zusatzfragen"),
          instruction: t(
            "For every part of the due diligence template: request it from the supplier with a due date, reuse the evidence already held, or remove it as not relevant with a reason. Add questions and name any blocker to dispatch.",
            "Fuer jeden Teil der Pruefvorlage: beim Lieferanten mit Termin anfordern, vorhandene Nachweise wiederverwenden oder mit Begruendung als nicht relevant entfernen. Ergaenzen Sie Fragen und benennen Sie Hindernisse fuer den Versand.",
          ),
          required: true,
          form: "tprm.request-scope",
        },
      ],
      decisions: [
        {
          key: "questionnaire-dispatch",
          judgmentKind: "agenda",
          label: t("Questionnaire dispatch", "Versand des Fragebogens"),
          question: t("Is the tailored questionnaire ready to dispatch?", "Ist der massgeschneiderte Fragebogen versandbereit?"),
          material: false,
          binding: {
            kind: "stage-decision",
            options: [
              { id: "dispatch-approve", label: t("Approve and dispatch", "Genehmigen und versenden"), description: t("Send the tailored request to the supplier.", "Die massgeschneiderte Anforderung an den Lieferanten senden."), outcome: "advance" },
              { id: "dispatch-revise", label: t("Revise first", "Zuerst ueberarbeiten"), description: t("Hold until the scope is corrected.", "Halten, bis der Umfang korrigiert ist."), outcome: "hold" },
            ],
          },
        },
      ],
      approvalRequirements: [
        toolApproval("request-action", "record-request", "createAction", t("Approve the due diligence request action", "Massnahme zur Nachweisanforderung genehmigen")),
        toolApproval("request-dispatch", "dispatch-request", "createAction", t("Approve the request record in the GRC platform", "Anforderungsdatensatz im GRC-System genehmigen")),
        completionApproval(COMPLETE),
      ],
      tools: [
        {
          key: "record-request",
          label: t("Record the tailored request as an action", "Massgeschneiderte Anforderung als Massnahme erfassen"),
          toolName: "createAction",
          channel: "local",
          connectorInstanceId: null,
          targetExternalType: null,
          payloadBuilder: "tprm.record-request",
          proposeWhen: { decisionKey: "questionnaire-dispatch", optionIds: ["dispatch-approve"] },
          deliveredWhen: "acknowledged",
        },
        {
          key: "dispatch-request",
          label: t("Dispatch the tailored request through the GRC platform", "Massgeschneiderte Anforderung ueber das GRC-System versenden"),
          toolName: "createAction",
          channel: "outbox",
          connectorInstanceId: CONNECTOR_GRC,
          targetExternalType: "grc.action",
          payloadBuilder: "tprm.dispatch-request",
          proposeWhen: { decisionKey: "questionnaire-dispatch", optionIds: ["dispatch-approve"] },
          deliveredWhen: "acknowledged",
        },
      ],
      artifacts: [
        { key: "due-diligence-preparation", kind: "ai-preparation", label: t("AI due diligence preparation", "KI-Vorbereitung der Sorgfaltspruefung"), producedBy: "ai-preparation", builder: "due-diligence-preparation" },
        { key: "evidence-request-list", kind: "stage-record", label: t("Evidence request list", "Liste der Nachweisanforderungen"), producedBy: "stage-completion", builder: "tprm.evidence-request-list" },
      ],
      completionCriteria: [
        SOURCES_RESOLVED,
        aiJobCompleted("due-diligence-preparation"),
        preparationStored("due-diligence-preparation"),
        { kind: "human-task-completed", taskKey: "request-scope", label: t("The request scope is approved", "Der Anforderungsumfang ist genehmigt") },
        { kind: "decision-recorded", decisionKey: "questionnaire-dispatch", label: t("The dispatch decision is recorded", "Die Versandentscheidung ist erfasst") },
        {
          kind: "tool-executed",
          toolKey: "record-request",
          label: t("The tailored request is recorded as an action", "Die massgeschneiderte Anforderung ist als Massnahme erfasst"),
          when: { decisionKey: "questionnaire-dispatch", optionIds: ["dispatch-approve"] },
        },
        {
          kind: "tool-executed",
          toolKey: "dispatch-request",
          label: t("The GRC platform confirmed the request", "Das GRC-System hat die Anforderung bestaetigt"),
          when: { decisionKey: "questionnaire-dispatch", optionIds: ["dispatch-approve"] },
        },
      ],
      nextStageId: "evidence-review",
      blockingConditions: [
        ...standardBlocking("due-diligence-preparation"),
        { kind: "decision-held", decisionKey: "questionnaire-dispatch", label: t("The questionnaire is being revised", "Der Fragebogen wird ueberarbeitet") },
        { kind: "external-command-failed", toolKey: "dispatch-request", label: t("The GRC platform did not confirm the request", "Das GRC-System hat die Anforderung nicht bestaetigt") },
      ],
      implementation: IMPLEMENTED,
    },

    /* ---------------------------------------------------------------- 4 */
    {
      id: "evidence-review",
      sequence: 4,
      name: "Evidence Review",
      nameDe: "Nachweispruefung",
      outcome:
        "Every requested evidence item is either accepted, rejected with a documented reason, or recorded as outstanding with a chase date. No unreviewed item remains.",
      humanResponsibility:
        "Decide whether to pass the stage gate with outstanding items or hold the file. A conditional gate pass records the condition and the expected receipt date. The risk of an incorrect conditional pass is that the item, when it arrives, contradicts the specialist review already underway.",
      relatedObjectKinds: ["supplier", "evidence", "decision"],
      decisionKinds: ["evidence-adequacy"],
      entryCriteria: [previousStageCompleted("tailored-due-diligence", 3, "Tailored Due Diligence", "Massgeschneiderte Sorgfaltspruefung")],
      requiredSources: [SRC_EVIDENCE, SRC_SUPPLIER, SRC_CONTRACT],
      helpfulSources: [SRC_SPECIALISTS, SRC_STAGE_MEETINGS],
      aiJobs: [
        {
          key: "evidence-assessment",
          label: t("Evidence review preparation", "Vorbereitung der Nachweispruefung"),
          preparer: "tprm.evidence-review",
          configurationId: CONFIG,
          outputSchema: SCHEMA,
          readsSources: ["due-diligence-evidence", "supplier-record", "contract-conditions", "specialist-status", "stage-meetings"],
          prepares: [
            t("Ingestion and extraction", "Erfassung und Auswertung"),
            t("Comparison across documents", "Vergleich zwischen Dokumenten"),
            t("Stale evidence", "Veraltete Nachweise"),
            t("Contradictions", "Widersprueche"),
            t("Requirement mapping", "Zuordnung zu Anforderungen"),
            t("Gap statements", "Beschreibung der Luecken"),
          ],
        },
      ],
      humanTasks: [
        {
          key: "evidence-dispositions",
          kind: "human-review",
          label: t("Evidence dispositions", "Bewertung der Nachweise"),
          instruction: t(
            "For every requested item: accept it, accept it with a condition, record it as outstanding with a chase date, or reject it with a reason. No item may remain unreviewed.",
            "Fuer jeden angeforderten Nachweis: akzeptieren, mit Bedingung akzeptieren, als ausstehend mit Nachfasstermin erfassen oder mit Begruendung ablehnen. Kein Nachweis darf ungeprueft bleiben.",
          ),
          required: true,
          form: "tprm.evidence-dispositions",
        },
      ],
      decisions: [
        {
          key: "stage-gate",
          judgmentKind: "evidence-adequacy",
          label: t("Stage 4 gate", "Stufentor 4"),
          question: t(
            "Is the evidence sufficient to pass the gate, sufficient with conditions, or must the file be held?",
            "Reichen die Nachweise, um das Tor zu passieren, reichen sie mit Bedingungen, oder muss die Akte gehalten werden?",
          ),
          material: true,
          binding: {
            kind: "stage-decision",
            options: [
              {
                id: "gate-pass",
                label: t("Pass the stage gate", "Stufentor passieren"),
                description: t(
                  "Every requested item is accepted. The file moves to specialist reviews without conditions.",
                  "Jeder angeforderte Nachweis ist akzeptiert. Die Akte geht ohne Bedingungen in die Fachpruefungen.",
                ),
                outcome: "advance",
              },
              {
                id: "gate-conditional",
                label: t("Pass with conditions", "Mit Bedingungen passieren"),
                description: t(
                  "The file moves to specialist reviews. The outstanding items become a dated condition with an owner, recorded locally and in the GRC platform.",
                  "Die Akte geht in die Fachpruefungen. Die ausstehenden Nachweise werden zu einer datierten Bedingung mit Verantwortung, erfasst lokal und im GRC-System.",
                ),
                outcome: "advance",
              },
              {
                id: "gate-hold",
                label: t("Hold the file at Stage 4", "Akte in Stufe 4 halten"),
                description: t(
                  "The file stays at evidence review until the outstanding items arrive. The decision can be revised then.",
                  "Die Akte bleibt in der Nachweispruefung, bis die ausstehenden Nachweise eintreffen. Die Entscheidung kann dann ueberarbeitet werden.",
                ),
                outcome: "hold",
              },
            ],
          },
        },
      ],
      approvalRequirements: [
        {
          key: "conditions-action",
          label: t("Approve the condition action", "Bedingungsmassnahme genehmigen"),
          covers: { kind: "tool", toolKey: "record-conditions" },
          toolName: "createAction",
          material: true,
        },
        {
          key: "conditions-registration",
          label: t("Approve the condition record in the GRC platform", "Bedingungsdatensatz im GRC-System genehmigen"),
          covers: { kind: "tool", toolKey: "register-conditions" },
          toolName: "createAction",
          material: true,
        },
        completionApproval(COMPLETE),
      ],
      tools: [
        {
          key: "record-conditions",
          label: t("Record the gate conditions as an action", "Torbedingungen als Massnahme erfassen"),
          toolName: "createAction",
          channel: "local",
          connectorInstanceId: null,
          targetExternalType: null,
          payloadBuilder: "tprm.record-conditions",
          proposeWhen: { decisionKey: "stage-gate", optionIds: ["gate-conditional"] },
          deliveredWhen: "acknowledged",
        },
        {
          key: "register-conditions",
          label: t("Register the gate conditions in the GRC platform", "Torbedingungen im GRC-System registrieren"),
          toolName: "createAction",
          channel: "outbox",
          connectorInstanceId: CONNECTOR_GRC,
          targetExternalType: "grc.action",
          payloadBuilder: "tprm.register-conditions",
          proposeWhen: { decisionKey: "stage-gate", optionIds: ["gate-conditional"] },
          deliveredWhen: "acknowledged",
        },
      ],
      artifacts: [
        { key: "evidence-assessment", kind: "ai-preparation", label: t("AI evidence assessment", "KI-Nachweisbewertung"), producedBy: "ai-preparation", builder: "evidence-assessment" },
        { key: "evidence-review-record", kind: "stage-record", label: t("Stage 4 evidence review record", "Protokoll der Nachweispruefung Stufe 4"), producedBy: "stage-completion", builder: "tprm.evidence-review-record" },
      ],
      completionCriteria: [
        SOURCES_RESOLVED,
        aiJobCompleted("evidence-assessment"),
        preparationStored("evidence-assessment"),
        { kind: "human-task-completed", taskKey: "evidence-dispositions", label: t("Every evidence item is dispositioned", "Jeder Nachweis ist bewertet") },
        { kind: "decision-recorded", decisionKey: "stage-gate", label: t("The stage gate decision is recorded", "Die Entscheidung zum Stufentor ist erfasst") },
        {
          kind: "tool-executed",
          toolKey: "record-conditions",
          label: t("The gate conditions are recorded as an action", "Die Torbedingungen sind als Massnahme erfasst"),
          when: { decisionKey: "stage-gate", optionIds: ["gate-conditional"] },
        },
        {
          kind: "tool-executed",
          toolKey: "register-conditions",
          label: t("The GRC platform confirmed the conditions", "Das GRC-System hat die Bedingungen bestaetigt"),
          when: { decisionKey: "stage-gate", optionIds: ["gate-conditional"] },
        },
      ],
      nextStageId: "specialist-reviews",
      blockingConditions: [
        ...standardBlocking("evidence-assessment"),
        { kind: "decision-held", decisionKey: "stage-gate", label: t("The file is held at Stage 4", "Die Akte wird in Stufe 4 gehalten") },
        { kind: "external-command-failed", toolKey: "register-conditions", label: t("The GRC platform did not confirm the conditions", "Das GRC-System hat die Bedingungen nicht bestaetigt") },
      ],
      implementation: IMPLEMENTED,
    },

    /* ---------------------------------------------------------------- 5 */
    {
      id: "specialist-reviews",
      sequence: 5,
      name: "Specialist Reviews",
      nameDe: "Fachpruefungen",
      outcome:
        "IT Security, Privacy and Legal have each returned a signed opinion or a formally recorded set of conditions. No review is in an unknown state.",
      humanResponsibility:
        "Agree or challenge the conditions each specialist function has set. A condition that cannot be met in the contract negotiation must be escalated now rather than discovered at the contract stage.",
      relatedObjectKinds: ["supplier", "evidence", "decision", "meeting"],
      decisionKinds: ["specialist-opinion"],
      entryCriteria: [previousStageCompleted("evidence-review", 4, "Evidence Review", "Nachweispruefung")],
      requiredSources: [SRC_SPECIALISTS, SRC_EVIDENCE],
      helpfulSources: [SRC_CONTRACT, SRC_HUDDLE],
      aiJobs: [
        {
          key: "specialist-preparation",
          label: t("Specialist review preparation", "Vorbereitung der Fachpruefungen"),
          preparer: "tprm.specialist-reviews",
          configurationId: CONFIG,
          outputSchema: SCHEMA,
          readsSources: ["specialist-status", "due-diligence-evidence", "contract-conditions", "specialist-huddle"],
          prepares: [
            t("Routing", "Weiterleitung"),
            t("Consolidation", "Zusammenfuehrung"),
            t("Disagreement", "Abweichende Positionen"),
            t("Due dates", "Termine"),
          ],
        },
      ],
      humanTasks: [
        {
          key: "specialist-conditions",
          kind: "human-review",
          label: t("Specialist conditions", "Bedingungen der Fachbereiche"),
          instruction: t(
            "Agree or challenge each specialist condition with a due date, resolve each conflict between specialist positions, give each pending review a date, and state what the huddle record is.",
            "Stimmen Sie jeder Bedingung der Fachbereiche mit Termin zu oder widersprechen Sie, loesen Sie jeden Konflikt zwischen Positionen, geben Sie jeder offenen Pruefung einen Termin, und halten Sie fest, worauf die Abstimmung beruht.",
          ),
          required: true,
          form: "tprm.specialist-conditions",
        },
      ],
      decisions: [
        {
          key: "specialist-escalation",
          judgmentKind: "specialist-opinion",
          label: t("Challenge, conflict resolution or escalation", "Einwand, Konfliktloesung oder Eskalation"),
          question: t("Can every specialist condition be met in the contract, or must one be escalated now?", "Laesst sich jede Bedingung im Vertrag erfuellen, oder muss eine jetzt eskaliert werden?"),
          material: true,
          binding: {
            kind: "stage-decision",
            options: [
              { id: "specialist-agree", label: t("Agree the conditions", "Bedingungen vereinbaren"), description: t("Carry every condition into the contract stage.", "Alle Bedingungen in die Vertragsstufe uebernehmen."), outcome: "advance" },
              { id: "specialist-escalate", label: t("Escalate a condition", "Eine Bedingung eskalieren"), description: t("Hold until the escalation is answered.", "Halten, bis die Eskalation beantwortet ist."), outcome: "hold" },
            ],
          },
        },
      ],
      approvalRequirements: [
        toolApproval("specialist-escalation", "escalate-condition", "addCommitteeAgendaItem", t("Approve the escalation to the committee agenda", "Eskalation auf die Komitee-Agenda genehmigen")),
        completionApproval(COMPLETE),
      ],
      tools: [
        {
          key: "escalate-condition",
          label: t("Escalate the challenged condition to the NFR committee agenda", "Die bestrittene Bedingung auf die Agenda des NFR-Komitees setzen"),
          toolName: "addCommitteeAgendaItem",
          channel: "local",
          connectorInstanceId: null,
          targetExternalType: null,
          payloadBuilder: "tprm.escalate-condition",
          proposeWhen: { decisionKey: "specialist-escalation", optionIds: ["specialist-escalate"] },
          deliveredWhen: "acknowledged",
        },
      ],
      artifacts: [
        { key: "specialist-preparation", kind: "ai-preparation", label: t("AI specialist preparation", "KI-Vorbereitung der Fachpruefungen"), producedBy: "ai-preparation", builder: "specialist-preparation" },
        { key: "specialist-opinions", kind: "stage-record", label: t("Consolidated specialist opinions", "Zusammengefuehrte Fachstellungnahmen"), producedBy: "stage-completion", builder: "tprm.specialist-opinions" },
      ],
      completionCriteria: [
        SOURCES_RESOLVED,
        aiJobCompleted("specialist-preparation"),
        preparationStored("specialist-preparation"),
        { kind: "human-task-completed", taskKey: "specialist-conditions", label: t("Specialist conditions are agreed", "Bedingungen der Fachbereiche sind vereinbart") },
        { kind: "decision-recorded", decisionKey: "specialist-escalation", label: t("The specialist decision is recorded", "Die Entscheidung zu den Fachpruefungen ist erfasst") },
      ],
      nextStageId: "contract-and-conditions",
      blockingConditions: [
        ...standardBlocking("specialist-preparation"),
        { kind: "decision-held", decisionKey: "specialist-escalation", label: t("A specialist condition is escalated", "Eine Bedingung der Fachbereiche ist eskaliert") },
      ],
      implementation: IMPLEMENTED,
    },

    /* ---------------------------------------------------------------- 6 */
    {
      id: "contract-and-conditions",
      sequence: 6,
      name: "Contract and Conditions",
      nameDe: "Vertrag und Bedingungen",
      outcome:
        "A final contract draft reviewed by Group Legal, with all specialist conditions either reflected as obligations or formally waived, is approved by the business owner and procurement.",
      humanResponsibility:
        "Confirm that every open specialist condition is reflected in the contract or formally waived with a documented rationale. A condition that is left unresolved at this stage becomes an untested obligation from the first day of the arrangement.",
      relatedObjectKinds: ["supplier", "contract", "decision", "action"],
      decisionKinds: ["contract-approval"],
      entryCriteria: [previousStageCompleted("specialist-reviews", 5, "Specialist Reviews", "Fachpruefungen")],
      requiredSources: [SRC_CONTRACT, SRC_SPECIALISTS],
      helpfulSources: [SRC_EVIDENCE, SRC_ONBOARDING_FILE],
      aiJobs: [
        {
          key: "contract-preparation",
          label: t("Contract and conditions preparation", "Vorbereitung von Vertrag und Bedingungen"),
          preparer: "tprm.contract-conditions",
          configurationId: CONFIG,
          outputSchema: SCHEMA,
          readsSources: ["contract-conditions", "specialist-status", "due-diligence-evidence", "onboarding-file"],
          prepares: [
            t("Clause comparison", "Klauselvergleich"),
            t("Missing rights", "Fehlende Rechte"),
            t("Subprocessor requirements", "Anforderungen an Unterauftragnehmer"),
            t("Conditions", "Bedingungen"),
            t("Negotiation points", "Verhandlungspunkte"),
          ],
        },
      ],
      humanTasks: [
        {
          key: "contract-review",
          kind: "human-review",
          label: t("Conditions against the contract", "Bedingungen gegen den Vertrag"),
          instruction: t(
            "For every condition and every missing right: confirm it is reflected in a clause, waive it with a documented rationale, or keep it open for negotiation with a due date.",
            "Fuer jede Bedingung und jedes fehlende Recht: bestaetigen, dass eine Klausel sie abbildet, mit dokumentierter Begruendung verzichten oder mit Termin zur Verhandlung offen halten.",
          ),
          required: true,
          form: "tprm.contract-review",
        },
      ],
      decisions: [
        {
          key: "contract-sufficiency",
          judgmentKind: "contract-approval",
          label: t("Contract sufficiency and residual exposure", "Vertragliche Angemessenheit und Restexposition"),
          question: t("Is the contract sufficient, and is the residual exposure acceptable?", "Ist der Vertrag angemessen, und ist die Restexposition tragbar?"),
          material: true,
          binding: {
            kind: "stage-decision",
            options: [
              { id: "contract-sufficient", label: t("Sufficient", "Angemessen"), description: t("Every condition is an obligation or waived with a rationale.", "Jede Bedingung ist Verpflichtung oder mit Begruendung verzichtet."), outcome: "advance" },
              { id: "contract-trade-off", label: t("Accept a documented trade-off", "Dokumentierten Kompromiss akzeptieren"), description: t("A residual exposure is accepted with rationale; open points become dated conditions.", "Eine Restexposition wird mit Begruendung akzeptiert; offene Punkte werden datierte Bedingungen."), outcome: "advance" },
              { id: "contract-renegotiate", label: t("Renegotiate", "Nachverhandeln"), description: t("Hold until the open clauses are resolved.", "Halten, bis die offenen Klauseln geloest sind."), outcome: "hold" },
            ],
          },
        },
      ],
      approvalRequirements: [
        toolApproval("contract-conditions-action", "record-contract-conditions", "createAction", t("Approve the contract condition action", "Massnahme zu den Vertragsbedingungen genehmigen")),
        toolApproval("contract-conditions-registration", "register-contract-conditions", "createAction", t("Approve the contract condition record in the GRC platform", "Datensatz der Vertragsbedingungen im GRC-System genehmigen")),
        completionApproval(COMPLETE),
      ],
      tools: [
        {
          key: "record-contract-conditions",
          label: t("Record the contract conditions as an action", "Vertragsbedingungen als Massnahme erfassen"),
          toolName: "createAction",
          channel: "local",
          connectorInstanceId: null,
          targetExternalType: null,
          payloadBuilder: "tprm.record-contract-conditions",
          proposeWhen: { decisionKey: "contract-sufficiency", optionIds: ["contract-trade-off"] },
          deliveredWhen: "acknowledged",
        },
        {
          key: "register-contract-conditions",
          label: t("Register the contract conditions in the GRC platform", "Vertragsbedingungen im GRC-System registrieren"),
          toolName: "createAction",
          channel: "outbox",
          connectorInstanceId: CONNECTOR_GRC,
          targetExternalType: "grc.action",
          payloadBuilder: "tprm.register-contract-conditions",
          proposeWhen: { decisionKey: "contract-sufficiency", optionIds: ["contract-trade-off"] },
          deliveredWhen: "acknowledged",
        },
      ],
      artifacts: [
        { key: "contract-preparation", kind: "ai-preparation", label: t("AI contract preparation", "KI-Vertragsvorbereitung"), producedBy: "ai-preparation", builder: "contract-preparation" },
        { key: "contract-record", kind: "stage-record", label: t("Contract conditions record", "Protokoll der Vertragsbedingungen"), producedBy: "stage-completion", builder: "tprm.contract-record" },
      ],
      completionCriteria: [
        SOURCES_RESOLVED,
        aiJobCompleted("contract-preparation"),
        preparationStored("contract-preparation"),
        { kind: "human-task-completed", taskKey: "contract-review", label: t("Every condition is placed against the contract", "Jede Bedingung ist dem Vertrag zugeordnet") },
        { kind: "decision-recorded", decisionKey: "contract-sufficiency", label: t("The contract decision is recorded", "Die Vertragsentscheidung ist erfasst") },
        {
          kind: "tool-executed",
          toolKey: "record-contract-conditions",
          label: t("The contract conditions are recorded as an action", "Die Vertragsbedingungen sind als Massnahme erfasst"),
          when: { decisionKey: "contract-sufficiency", optionIds: ["contract-trade-off"] },
        },
        {
          kind: "tool-executed",
          toolKey: "register-contract-conditions",
          label: t("The GRC platform confirmed the contract conditions", "Das GRC-System hat die Vertragsbedingungen bestaetigt"),
          when: { decisionKey: "contract-sufficiency", optionIds: ["contract-trade-off"] },
        },
      ],
      nextStageId: "decision-and-onboarding",
      blockingConditions: [
        ...standardBlocking("contract-preparation"),
        { kind: "decision-held", decisionKey: "contract-sufficiency", label: t("The contract is being renegotiated", "Der Vertrag wird nachverhandelt") },
        { kind: "external-command-failed", toolKey: "register-contract-conditions", label: t("The GRC platform did not confirm the contract conditions", "Das GRC-System hat die Vertragsbedingungen nicht bestaetigt") },
      ],
      implementation: IMPLEMENTED,
    },

    /* ---------------------------------------------------------------- 7 */
    {
      id: "decision-and-onboarding",
      sequence: 7,
      name: "Decision and Onboarding",
      nameDe: "Entscheidung und Onboarding",
      outcome:
        "Governance approval is recorded, the contract is signed and the supplier status is changed to active in the register.",
      humanResponsibility:
        "Present the onboarding file to the appropriate committee and record the approval decision with rationale. For an important supplier the Non-Financial Risk Committee must approve; no other approval body satisfies the policy.",
      relatedObjectKinds: ["supplier", "service", "decision", "action"],
      decisionKinds: ["approval"],
      entryCriteria: [previousStageCompleted("contract-and-conditions", 6, "Contract and Conditions", "Vertrag und Bedingungen")],
      requiredSources: [SRC_ONBOARDING_FILE, SRC_SUPPLIER],
      helpfulSources: [SRC_EVIDENCE, SRC_CONTRACT],
      aiJobs: [
        {
          key: "onboarding-preparation",
          label: t("Onboarding decision preparation", "Vorbereitung der Onboarding-Entscheidung"),
          preparer: "tprm.decision-onboarding",
          configurationId: CONFIG,
          outputSchema: SCHEMA,
          readsSources: ["onboarding-file", "supplier-record", "due-diligence-evidence", "contract-conditions"],
          prepares: [
            t("Options", "Optionen"),
            t("Evidence", "Nachweise"),
            t("Uncertainty", "Unsicherheit"),
            t("Rationale", "Begruendung"),
            t("Target-system list", "Liste der Zielsysteme"),
          ],
        },
      ],
      humanTasks: [],
      decisions: [
        {
          key: "onboarding-approval",
          judgmentKind: "approval",
          label: t("Onboarding approval", "Onboarding-Genehmigung"),
          question: t("Approve, conditionally approve, reject or escalate the onboarding?", "Onboarding genehmigen, bedingt genehmigen, ablehnen oder eskalieren?"),
          material: true,
          binding: {
            kind: "stage-decision",
            options: [
              { id: "onboarding-approve", label: t("Approve", "Genehmigen"), description: t("Activate the supplier, service and monitoring records.", "Lieferanten-, Leistungs- und Ueberwachungsdatensaetze aktivieren."), outcome: "advance" },
              { id: "onboarding-conditional", label: t("Approve with conditions", "Mit Bedingungen genehmigen"), description: t("Activate with open conditions tracked as actions.", "Mit offenen Bedingungen als Massnahmen aktivieren."), outcome: "advance" },
              { id: "onboarding-reject", label: t("Reject", "Ablehnen"), description: t("Close the file without onboarding.", "Die Akte ohne Onboarding schliessen."), outcome: "advance" },
              { id: "onboarding-escalate", label: t("Escalate", "Eskalieren"), description: t("Hold until the committee decides.", "Halten, bis das Komitee entscheidet."), outcome: "hold" },
            ],
          },
        },
      ],
      approvalRequirements: [
        toolApproval("onboarding-assessment", "record-onboarding-assessment", "recordSupplierAssessment", t("Approve the supplier assessment and its activation", "Lieferantenbewertung und Aktivierung genehmigen")),
        toolApproval("supplier-registration", "register-supplier", "recordSupplierAssessment", t("Approve the supplier record in the GRC platform", "Lieferantendatensatz im GRC-System genehmigen")),
        toolApproval("service-registration", "register-service", "recordSupplierAssessment", t("Approve the service record in the GRC platform", "Leistungsdatensatz im GRC-System genehmigen")),
        toolApproval("monitoring-start", "start-monitoring", "activateMonitoring", t("Approve the monitoring record", "Ueberwachungsdatensatz genehmigen")),
        toolApproval("onboarding-escalation", "escalate-onboarding", "addCommitteeAgendaItem", t("Approve the committee agenda item", "Punkt auf der Komitee-Agenda genehmigen")),
        toolApproval("rejection-notice", "notify-rejection", "sendSimulatedCollaborationMessage", t("Approve the rejection notice", "Mitteilung der Ablehnung genehmigen")),
        completionApproval(COMPLETE),
      ],
      tools: [
        {
          key: "record-onboarding-assessment",
          label: t("Record the onboarding assessment and activate the supplier", "Onboarding-Bewertung erfassen und den Lieferanten aktivieren"),
          toolName: "recordSupplierAssessment",
          channel: "local",
          connectorInstanceId: null,
          targetExternalType: null,
          payloadBuilder: "tprm.record-onboarding-assessment",
          proposeWhen: { decisionKey: "onboarding-approval", optionIds: ["onboarding-approve", "onboarding-conditional"] },
          deliveredWhen: "acknowledged",
        },
        {
          key: "register-supplier",
          label: t("Write the active supplier record to the GRC third-party register", "Aktiven Lieferantendatensatz in das GRC-Drittparteienregister schreiben"),
          toolName: "recordSupplierAssessment",
          channel: "outbox",
          connectorInstanceId: CONNECTOR_GRC,
          targetExternalType: "grc.supplier",
          payloadBuilder: "tprm.register-supplier",
          proposeWhen: { decisionKey: "onboarding-approval", optionIds: ["onboarding-approve", "onboarding-conditional"] },
          deliveredWhen: "acknowledged",
        },
        {
          key: "register-service",
          label: t("Write the service record to the GRC platform", "Leistungsdatensatz in das GRC-System schreiben"),
          toolName: "recordSupplierAssessment",
          channel: "outbox",
          connectorInstanceId: CONNECTOR_GRC,
          targetExternalType: "grc.service",
          payloadBuilder: "tprm.register-service",
          proposeWhen: { decisionKey: "onboarding-approval", optionIds: ["onboarding-approve", "onboarding-conditional"] },
          deliveredWhen: "acknowledged",
        },
        {
          key: "start-monitoring",
          label: t("Open the monitoring record from activation", "Ueberwachungsdatensatz ab Aktivierung eroeffnen"),
          toolName: "activateMonitoring",
          channel: "local",
          connectorInstanceId: null,
          targetExternalType: null,
          payloadBuilder: "tprm.start-monitoring",
          proposeWhen: { decisionKey: "onboarding-approval", optionIds: ["onboarding-approve", "onboarding-conditional"] },
          deliveredWhen: "acknowledged",
        },
        {
          key: "escalate-onboarding",
          label: t("Put the onboarding on the NFR committee agenda", "Das Onboarding auf die Agenda des NFR-Komitees setzen"),
          toolName: "addCommitteeAgendaItem",
          channel: "local",
          connectorInstanceId: null,
          targetExternalType: null,
          payloadBuilder: "tprm.escalate-onboarding",
          proposeWhen: { decisionKey: "onboarding-approval", optionIds: ["onboarding-escalate"] },
          deliveredWhen: "acknowledged",
        },
        {
          key: "notify-rejection",
          label: t("Tell the business owner and procurement that the onboarding is rejected", "Fachverantwortung und Einkauf ueber die Ablehnung informieren"),
          toolName: "sendSimulatedCollaborationMessage",
          channel: "local",
          connectorInstanceId: null,
          targetExternalType: null,
          payloadBuilder: "tprm.notify-rejection",
          proposeWhen: { decisionKey: "onboarding-approval", optionIds: ["onboarding-reject"] },
          deliveredWhen: "acknowledged",
        },
      ],
      artifacts: [
        { key: "onboarding-preparation", kind: "ai-preparation", label: t("AI onboarding preparation", "KI-Onboardingvorbereitung"), producedBy: "ai-preparation", builder: "onboarding-preparation" },
        { key: "approval-record", kind: "stage-record", label: t("Onboarding approval record", "Protokoll der Onboarding-Genehmigung"), producedBy: "stage-completion", builder: "tprm.approval-record" },
      ],
      completionCriteria: [
        SOURCES_RESOLVED,
        aiJobCompleted("onboarding-preparation"),
        preparationStored("onboarding-preparation"),
        { kind: "decision-recorded", decisionKey: "onboarding-approval", label: t("The onboarding decision is recorded", "Die Onboarding-Entscheidung ist erfasst") },
        {
          kind: "tool-executed",
          toolKey: "record-onboarding-assessment",
          label: t("The supplier assessment is recorded and the supplier is active", "Die Lieferantenbewertung ist erfasst und der Lieferant aktiv"),
          when: { decisionKey: "onboarding-approval", optionIds: ["onboarding-approve", "onboarding-conditional"] },
        },
        {
          kind: "tool-executed",
          toolKey: "register-supplier",
          label: t("The GRC platform confirmed the supplier record", "Das GRC-System hat den Lieferantendatensatz bestaetigt"),
          when: { decisionKey: "onboarding-approval", optionIds: ["onboarding-approve", "onboarding-conditional"] },
        },
        {
          kind: "tool-executed",
          toolKey: "register-service",
          label: t("The GRC platform confirmed the service record", "Das GRC-System hat den Leistungsdatensatz bestaetigt"),
          when: { decisionKey: "onboarding-approval", optionIds: ["onboarding-approve", "onboarding-conditional"] },
        },
        {
          kind: "tool-executed",
          toolKey: "start-monitoring",
          label: t("The monitoring record is open", "Der Ueberwachungsdatensatz ist eroeffnet"),
          when: { decisionKey: "onboarding-approval", optionIds: ["onboarding-approve", "onboarding-conditional"] },
        },
        {
          kind: "tool-executed",
          toolKey: "notify-rejection",
          label: t("The rejection is communicated", "Die Ablehnung ist mitgeteilt"),
          when: { decisionKey: "onboarding-approval", optionIds: ["onboarding-reject"] },
        },
      ],
      nextStageId: "handover-to-monitoring",
      blockingConditions: [
        ...standardBlocking("onboarding-preparation"),
        { kind: "decision-held", decisionKey: "onboarding-approval", label: t("The onboarding is escalated", "Das Onboarding ist eskaliert") },
        { kind: "external-command-failed", toolKey: "register-supplier", label: t("The GRC platform did not confirm the supplier record", "Das GRC-System hat den Lieferantendatensatz nicht bestaetigt") },
        { kind: "external-command-failed", toolKey: "register-service", label: t("The GRC platform did not confirm the service record", "Das GRC-System hat den Leistungsdatensatz nicht bestaetigt") },
      ],
      implementation: IMPLEMENTED,
    },

    /* ---------------------------------------------------------------- 8 */
    {
      id: "handover-to-monitoring",
      sequence: 8,
      name: "Handover to Monitoring",
      nameDe: "Uebergabe an Monitoring",
      outcome:
        "The monitoring plan is created with the correct frequency for the supplier's criticality, the next assessment date is set and the onboarding case is closed.",
      humanResponsibility:
        "Set the monitoring frequency and confirm the next assessment date. An important supplier under annual monitoring with a twelve-month gap before the first check is effectively unmonitored for that period. The date is a professional judgment, not a default.",
      relatedObjectKinds: ["supplier", "action", "monitoring"],
      decisionKinds: ["monitoring-plan"],
      entryCriteria: [previousStageCompleted("decision-and-onboarding", 7, "Decision and Onboarding", "Entscheidung und Onboarding")],
      requiredSources: [SRC_ONBOARDING_FILE, SRC_SUPPLIER],
      helpfulSources: [SRC_CONTRACT],
      aiJobs: [
        {
          key: "handover-preparation",
          label: t("Monitoring handoff preparation", "Vorbereitung der Uebergabe an das Monitoring"),
          preparer: "tprm.monitoring-handover",
          configurationId: CONFIG,
          outputSchema: SCHEMA,
          readsSources: ["onboarding-file", "supplier-record", "contract-conditions"],
          prepares: [
            t("Conditions", "Bedingungen"),
            t("Monitoring", "Ueberwachung"),
            t("Reassessment", "Neubewertung"),
            t("Communications", "Kommunikation"),
            t("Register update", "Aktualisierung des Registers"),
          ],
        },
      ],
      humanTasks: [
        {
          key: "handover-plan",
          kind: "human-input",
          label: t("Monitoring owner, dates and remaining conditions", "Ueberwachungsverantwortung, Termine und offene Bedingungen"),
          instruction: t(
            "Name the monitoring owner, set the first check and the next reassessment date, and decide for each open condition whether it is carried into monitoring or must close before the handover.",
            "Benennen Sie die Verantwortung fuer die Ueberwachung, setzen Sie die erste Pruefung und die naechste Neubewertung, und entscheiden Sie fuer jede offene Bedingung, ob sie in die Ueberwachung uebergeht oder vor der Uebergabe geschlossen sein muss.",
          ),
          required: true,
          form: "tprm.handover-plan",
        },
      ],
      decisions: [
        {
          key: "monitoring-intensity",
          judgmentKind: "monitoring-plan",
          label: t("Monitoring intensity, owner and remaining conditions", "Ueberwachungsintensitaet, Verantwortung und offene Bedingungen"),
          question: t("How intense is the monitoring, who owns it, and which conditions remain?", "Wie intensiv ist die Ueberwachung, wer verantwortet sie, und welche Bedingungen bleiben offen?"),
          material: true,
          binding: {
            kind: "stage-decision",
            options: [
              { id: "monitoring-quarterly", label: t("Quarterly monitoring", "Quartalsweise Ueberwachung"), description: t("First check within three months.", "Erste Pruefung innerhalb von drei Monaten."), outcome: "advance" },
              { id: "monitoring-semiannual", label: t("Semi-annual monitoring", "Halbjaehrliche Ueberwachung"), description: t("First check within six months.", "Erste Pruefung innerhalb von sechs Monaten."), outcome: "advance" },
              { id: "monitoring-close", label: t("Close the file without monitoring", "Akte ohne Ueberwachung schliessen"), description: t("Only when the onboarding was rejected.", "Nur wenn das Onboarding abgelehnt wurde."), outcome: "advance" },
            ],
          },
        },
      ],
      approvalRequirements: [
        toolApproval("monitoring-plan", "activate-monitoring-plan", "activateMonitoring", t("Approve the monitoring plan", "Ueberwachungsplan genehmigen")),
        toolApproval("register-update", "update-register", "recordSupplierAssessment", t("Approve the register update in the GRC platform", "Aktualisierung des Registers im GRC-System genehmigen")),
        toolApproval("handover-note", "send-handover-note", "sendSimulatedCollaborationMessage", t("Approve the handover message", "Uebergabenachricht genehmigen")),
        toolApproval("closure-note", "send-closure-note", "sendSimulatedCollaborationMessage", t("Approve the closure message", "Abschlussnachricht genehmigen")),
        completionApproval(COMPLETE),
      ],
      tools: [
        {
          key: "activate-monitoring-plan",
          label: t("Activate the monitoring plan", "Ueberwachungsplan aktivieren"),
          toolName: "activateMonitoring",
          channel: "local",
          connectorInstanceId: null,
          targetExternalType: null,
          payloadBuilder: "tprm.activate-monitoring-plan",
          proposeWhen: { decisionKey: "monitoring-intensity", optionIds: ["monitoring-quarterly", "monitoring-semiannual"] },
          deliveredWhen: "acknowledged",
        },
        {
          key: "update-register",
          label: t("Update the supplier record in the GRC third-party register", "Lieferantendatensatz im GRC-Drittparteienregister aktualisieren"),
          toolName: "recordSupplierAssessment",
          channel: "outbox",
          connectorInstanceId: CONNECTOR_GRC,
          targetExternalType: "grc.supplier",
          payloadBuilder: "tprm.update-register",
          proposeWhen: { decisionKey: "monitoring-intensity", optionIds: ["monitoring-quarterly", "monitoring-semiannual"] },
          deliveredWhen: "acknowledged",
        },
        {
          key: "send-handover-note",
          label: t("Send the handover message to the monitoring owner and procurement", "Uebergabenachricht an die Ueberwachungsverantwortung und den Einkauf senden"),
          toolName: "sendSimulatedCollaborationMessage",
          channel: "local",
          connectorInstanceId: null,
          targetExternalType: null,
          payloadBuilder: "tprm.send-handover-note",
          proposeWhen: { decisionKey: "monitoring-intensity", optionIds: ["monitoring-quarterly", "monitoring-semiannual"] },
          deliveredWhen: "acknowledged",
        },
        {
          key: "send-closure-note",
          label: t("Send the closure message", "Abschlussnachricht senden"),
          toolName: "sendSimulatedCollaborationMessage",
          channel: "local",
          connectorInstanceId: null,
          targetExternalType: null,
          payloadBuilder: "tprm.send-closure-note",
          proposeWhen: { decisionKey: "monitoring-intensity", optionIds: ["monitoring-close"] },
          deliveredWhen: "acknowledged",
        },
      ],
      artifacts: [
        { key: "handover-preparation", kind: "ai-preparation", label: t("AI handover preparation", "KI-Uebergabevorbereitung"), producedBy: "ai-preparation", builder: "handover-preparation" },
        { key: "monitoring-plan", kind: "stage-record", label: t("Monitoring plan", "Ueberwachungsplan"), producedBy: "stage-completion", builder: "tprm.monitoring-plan" },
      ],
      completionCriteria: [
        SOURCES_RESOLVED,
        aiJobCompleted("handover-preparation"),
        preparationStored("handover-preparation"),
        { kind: "human-task-completed", taskKey: "handover-plan", label: t("The owner, dates and remaining conditions are recorded", "Verantwortung, Termine und offene Bedingungen sind erfasst") },
        { kind: "decision-recorded", decisionKey: "monitoring-intensity", label: t("The monitoring decision is recorded", "Die Ueberwachungsentscheidung ist erfasst") },
        {
          kind: "tool-executed",
          toolKey: "activate-monitoring-plan",
          label: t("The monitoring plan is active", "Der Ueberwachungsplan ist aktiv"),
          when: { decisionKey: "monitoring-intensity", optionIds: ["monitoring-quarterly", "monitoring-semiannual"] },
        },
        {
          kind: "tool-executed",
          toolKey: "update-register",
          label: t("The GRC platform confirmed the register update", "Das GRC-System hat die Aktualisierung des Registers bestaetigt"),
          when: { decisionKey: "monitoring-intensity", optionIds: ["monitoring-quarterly", "monitoring-semiannual"] },
        },
        {
          kind: "tool-executed",
          toolKey: "send-handover-note",
          label: t("The handover is communicated", "Die Uebergabe ist mitgeteilt"),
          when: { decisionKey: "monitoring-intensity", optionIds: ["monitoring-quarterly", "monitoring-semiannual"] },
        },
        {
          kind: "tool-executed",
          toolKey: "send-closure-note",
          label: t("The closure is communicated", "Der Abschluss ist mitgeteilt"),
          when: { decisionKey: "monitoring-intensity", optionIds: ["monitoring-close"] },
        },
      ],
      nextStageId: null,
      blockingConditions: [
        ...standardBlocking("handover-preparation"),
        { kind: "external-command-failed", toolKey: "update-register", label: t("The GRC platform did not confirm the register update", "Das GRC-System hat die Aktualisierung des Registers nicht bestaetigt") },
      ],
      implementation: IMPLEMENTED,
    },
  ],
};

/* ---------------------------------------------------------------------------
   The Third-Party Onboarding role-app
   --------------------------------------------------------------------------- */

export const THIRD_PARTY_ONBOARDING_APP: RoleAppDefinition = {
  id: "tprm-third-party-onboarding",
  roleId: "tprm",
  functionPackId: "nfr-third-party-risk",
  name: "Third-Party Onboarding",
  nameDe: "Drittparteien-Onboarding",
  summary:
    "Guides the Third-Party Risk Manager through the eight-stage process of bringing a new supplier into scope, from intake to active monitoring.",
  summaryDe:
    "Begleitet den Third-Party Risk Manager durch den achtstufigen Prozess zur Aufnahme eines neuen Lieferanten, von der Antragstellung bis zur aktiven Ueberwachung.",
  status: "installed",
  maturity: "production-shaped",
  version: "1.0.0",
  entryRoute: "/workday/tprm/processes/third-party-onboarding",
  processId: "tprm-third-party-onboarding",
  coveredStageIds: [
    "request-and-intake",
    "classification-and-criticality",
    "tailored-due-diligence",
    "evidence-review",
    "specialist-reviews",
    "contract-and-conditions",
    "decision-and-onboarding",
    "handover-to-monitoring",
  ],
  requiredConnectorPackIds: ["third-party-register", "procurement-portal", "evidence-vault"],
  humanDecisionKinds: [
    "classification",
    "evidence-adequacy",
    "specialist-opinion",
    "contract-approval",
    "approval",
    "monitoring-plan",
  ],
  stageCompletionToolName: COMPLETE,
  workspaceRegion: "tprm-stage-workspace",
};

/*
 * The static run constant that used to live here
 * (`TPRM_VERIDIAN_ONBOARDING_RUN`) was a fallback the process page rendered
 * when the database had no run. It was removed with the process engine: the
 * seeded runs in the database are the only account of where the onboarding
 * stands.
 */

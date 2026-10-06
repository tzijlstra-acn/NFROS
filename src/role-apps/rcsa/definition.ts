/**
 * RCSA Cycle Assistant process definition.
 *
 * Defines the eight-stage Risk and Control Self-Assessment lifecycle and the
 * role-app metadata for the Operational Risk Partner workday. The seeded run
 * (`RUN-RCSA-PAYOPS-Q4-2026` in `src/db/seed/role-app-runtime.ts`) is at
 * Stage 2 (Evidence Refresh) for the Payments Execution Q4 assessment
 * (RCSA-ARC-DE-PAYOPS-2026-Q4).
 *
 * Every stage carries its full stage contract (see `StageContract` in
 * `../contracts.ts`). The contract is the engine's source of truth for what a
 * stage needs and when it may complete; the route renders it and defines no
 * rule of its own. All eight stages are executable on the process engine;
 * their code is registered by `./stages/*.ts` under the keys named here.
 *
 * Data references trace back to the seeded scenario objects:
 *
 *   Assessment: RCSA-ARC-DE-PAYOPS-2026-Q4 (v4 draft; Q3 v3 is the prior version)
 *   Process:    PRC-0041 (Payment repair and manual override, PAY.03.02)
 *   Key risk:   RSK-0211 (Erroneous or unauthorised payment release)
 *   Key control: CTL-PAY-014 (Four-eyes independent review)
 *   KRI in breach: KRI-PAY-007 (Override rate)
 *   Control test: TST-2026-0318
 *   Workshop:   MTG-2026-0005 (06.10.2026, 10:30)
 *
 * Seeded decisions bound to stages: DEC-2026-0771 (Stage 2), DEC-2026-0744
 * (Stage 3), DEC-2026-0745 (Stage 4), DEC-2026-0772 (Stage 5) and
 * DEC-2026-0782 (Stage 7). They are the Q4 cycle's judgments, linked to its
 * run (`decisions.process_run_id`). A later run of the app (an event-driven
 * reassessment) does not inherit them: each of those stages presents the
 * run's own decision, made from the seeded one, when it opens
 * (`./stages/run-decisions.ts`), and the engine binds the stage to it.
 * Stages 1, 6, 7 and 8 also carry stage decisions of their own, with options
 * declared here.
 *
 * Synthetic institution and data. All figures are scenario figures.
 */

import type { RoleAppDefinition, RoleProcessDefinition, StageSourceSpec } from "@/role-apps/contracts";
import {
  aiJobCompleted,
  completionApproval,
  CONNECTOR_DOCUMENTS,
  CONNECTOR_GRC,
  CONNECTOR_PROCESS_INTELLIGENCE,
  IMPLEMENTED,
  preparationStored,
  previousStageCompleted,
  SOURCES_RESOLVED,
  standardBlocking,
  t,
} from "@/role-apps/stage-helpers";

const COMPLETE = "completeRcsaStage";
const CONFIG = "AICFG-RCSA-STAGE-PREP-001";
const SCHEMA = "stage-preparation-v1" as const;

/* ---------------------------------------------------------------------------
   Sources shared by several stages
   --------------------------------------------------------------------------- */

const SRC_KRI: StageSourceSpec = {
  key: "kri-readings",
  label: t("Key risk indicator readings", "Messwerte der Risikoindikatoren"),
  loader: "rcsa.kri-readings",
  connectorInstanceId: null,
};
const SRC_INCIDENTS: StageSourceSpec = {
  key: "incidents",
  label: t("Incidents on the process", "Vorfaelle im Prozess"),
  loader: "rcsa.incidents",
  connectorInstanceId: null,
};
const SRC_LOSSES: StageSourceSpec = {
  key: "losses",
  label: t("Recorded operational losses", "Erfasste operationelle Verluste"),
  loader: "rcsa.losses",
  connectorInstanceId: null,
};
const SRC_TESTS: StageSourceSpec = {
  key: "control-tests",
  label: t("Control test results", "Ergebnisse der Kontrolltests"),
  loader: "rcsa.control-tests",
  connectorInstanceId: null,
};
const SRC_ACTIONS: StageSourceSpec = {
  key: "open-actions",
  label: t("Open actions and issues", "Offene Massnahmen und Themen"),
  loader: "rcsa.actions",
  connectorInstanceId: CONNECTOR_GRC,
};
const SRC_PRIOR: StageSourceSpec = {
  key: "prior-assessment",
  label: t("Prior assessment version", "Vorherige Bewertungsversion"),
  loader: "rcsa.prior-assessment",
  connectorInstanceId: CONNECTOR_GRC,
};
const SRC_TELEMETRY: StageSourceSpec = {
  key: "process-telemetry",
  label: t("Process telemetry", "Prozesstelemetrie"),
  loader: "rcsa.process-telemetry",
  connectorInstanceId: CONNECTOR_PROCESS_INTELLIGENCE,
};
const SRC_CONTROL_EVIDENCE: StageSourceSpec = {
  key: "control-evidence",
  label: t("Control evidence freshness", "Aktualitaet der Kontrollnachweise"),
  loader: "rcsa.control-evidence",
  connectorInstanceId: CONNECTOR_DOCUMENTS,
};
const SRC_RISK_REGISTER: StageSourceSpec = {
  key: "risk-control-register",
  label: t("Risks and controls in scope", "Risiken und Kontrollen im Umfang"),
  loader: "rcsa.risk-control-register",
  connectorInstanceId: CONNECTOR_GRC,
};
const SRC_FIRST_LINE: StageSourceSpec = {
  key: "first-line-submissions",
  label: t("First-line submissions", "Eingaben der ersten Linie"),
  loader: "rcsa.first-line-submissions",
  connectorInstanceId: null,
};
const SRC_WORKSHOP: StageSourceSpec = {
  key: "workshop-record",
  label: t("Workshop meeting and transcript", "Workshop-Sitzung und Protokoll"),
  loader: "rcsa.workshop-record",
  connectorInstanceId: null,
};
const SRC_APPETITE: StageSourceSpec = {
  key: "appetite-statements",
  label: t("Risk appetite statements", "Aussagen zur Risikobereitschaft"),
  loader: "rcsa.appetite-statements",
  connectorInstanceId: null,
};
const SRC_PARTICIPANTS: StageSourceSpec = {
  key: "scope-participants",
  label: t("Owners and participants", "Verantwortliche und Teilnehmende"),
  loader: "rcsa.scope-participants",
  connectorInstanceId: null,
};
const SRC_TRIGGER: StageSourceSpec = {
  key: "reassessment-trigger",
  label: t("Trigger and schedule", "Ausloeser und Zeitplan"),
  loader: "rcsa.reassessment-trigger",
  connectorInstanceId: null,
};
const SRC_DECISIONS: StageSourceSpec = {
  key: "cycle-decisions",
  label: t("Decisions recorded in this cycle", "In diesem Zyklus erfasste Entscheidungen"),
  loader: "rcsa.cycle-decisions",
  connectorInstanceId: null,
};
const SRC_ACTION_PLAN: StageSourceSpec = {
  key: "action-plan",
  label: t("Actions on the scope, with owners and lineage", "Massnahmen im Umfang mit Verantwortung und Herkunft"),
  loader: "rcsa.action-plan",
  connectorInstanceId: CONNECTOR_GRC,
};
const SRC_CYCLE_RECORD: StageSourceSpec = {
  key: "cycle-record",
  label: t("Records of the earlier stages", "Protokolle der frueheren Stufen"),
  loader: "rcsa.cycle-record",
  connectorInstanceId: null,
};
const SRC_MONITORING: StageSourceSpec = {
  key: "monitoring-activations",
  label: t("Enhanced monitoring in force", "Aktive verstaerkte Ueberwachung"),
  loader: "rcsa.monitoring-activations",
  connectorInstanceId: null,
};

/* ---------------------------------------------------------------------------
   The RCSA Cycle process definition
   --------------------------------------------------------------------------- */

export const RCSA_CYCLE_PROCESS: RoleProcessDefinition = {
  id: "rcsa-cycle",
  roleId: "rcsa",
  name: "RCSA Cycle",
  nameDe: "RCSA-Zyklus",
  description:
    "The eight-stage structured process through which the Operational Risk Partner conducts, challenges and closes a Risk and Control Self-Assessment for one process scope. The process runs from the initial scope confirmation through evidence gathering, first-line input, the second-line challenge workshop, residual rating, action approval and the ongoing monitoring plan. Each stage ends with a recorded human decision before the next opens.",
  stages: [
    /* ---------------------------------------------------------------- 1 */
    {
      id: "scope-trigger",
      sequence: 1,
      name: "Scope and Trigger",
      nameDe: "Umfang und Ausloesungsgrund",
      outcome:
        "The assessment scope is confirmed: one or more processes, the legal entities in scope, the cycle quarter and the trigger reason are recorded and visible to all participants.",
      outcomeDe:
        "Der Bewertungsumfang ist bestaetigt: ein oder mehrere Prozesse, die Gesellschaften im Umfang, das Zyklusquartal und der Ausloeser sind erfasst und fuer alle Beteiligten sichtbar.",
      humanResponsibility:
        "Confirm the scope and trigger. A scope that is too narrow misses a risk; a scope that is too wide produces a report nobody reads.",
      humanResponsibilityDe:
        "Bestaetigen Sie Umfang und Ausloeser. Ein zu enger Umfang uebersieht ein Risiko; ein zu weiter Umfang erzeugt einen Bericht, den niemand liest.",
      relatedObjectKinds: ["assessment", "process", "risk", "decision"],
      decisionKinds: ["agenda"],
      entryCriteria: [],
      requiredSources: [SRC_RISK_REGISTER, SRC_PRIOR, SRC_KRI, SRC_PARTICIPANTS],
      helpfulSources: [SRC_TELEMETRY, SRC_TRIGGER],
      aiJobs: [
        {
          key: "scope-preparation",
          label: t("Scope and trigger preparation", "Vorbereitung von Umfang und Ausloesungsgrund"),
          preparer: "rcsa.scope-trigger",
          configurationId: CONFIG,
          outputSchema: SCHEMA,
          readsSources: ["risk-control-register", "prior-assessment", "kri-readings", "scope-participants", "process-telemetry", "reassessment-trigger"],
          prepares: [
            t("Prior scope comparison", "Vergleich mit dem vorherigen Umfang"),
            t("Process changes", "Prozessaenderungen"),
            t("Trigger summary", "Zusammenfassung des Ausloesers"),
            t("Owners and participants", "Verantwortliche und Teilnehmende"),
          ],
        },
      ],
      humanTasks: [
        {
          key: "scope-confirmation",
          kind: "human-review",
          label: t("Scope confirmation", "Bestaetigung des Umfangs"),
          instruction: t(
            "Put each process and entity in or out of scope, confirm the assessment period, and say who must take part.",
            "Ordnen Sie jeden Prozess und jede Gesellschaft dem Umfang zu, bestaetigen Sie den Bewertungszeitraum und legen Sie fest, wer teilnehmen muss.",
          ),
          required: true,
          form: "rcsa.scope-confirmation",
        },
      ],
      decisions: [
        {
          key: "scope-and-trigger",
          judgmentKind: "agenda",
          label: t("Scope, trigger and off-cycle requirement", "Umfang, Ausloeser und ausserplanmaessiger Bedarf"),
          question: t(
            "Is the scope right, what triggers this cycle, and does it need to run off cycle?",
            "Ist der Umfang richtig, was loest diesen Zyklus aus, und muss er ausserplanmaessig laufen?",
          ),
          material: true,
          binding: {
            kind: "stage-decision",
            options: [
              { id: "scope-scheduled", label: t("Confirm the scheduled scope", "Geplanten Umfang bestaetigen"), description: t("Run the cycle on the scheduled scope and trigger.", "Den Zyklus mit geplantem Umfang und Ausloeser durchfuehren."), outcome: "advance" },
              { id: "scope-off-cycle", label: t("Confirm an off-cycle scope", "Ausserplanmaessigen Umfang bestaetigen"), description: t("Run the cycle off cycle because a trigger event requires it.", "Den Zyklus ausserplanmaessig durchfuehren, weil ein Ereignis es erfordert."), outcome: "advance" },
              { id: "scope-revise", label: t("Revise the scope first", "Umfang zuerst ueberarbeiten"), description: t("Hold the stage until the scope is corrected.", "Die Stufe halten, bis der Umfang korrigiert ist."), outcome: "hold" },
            ],
          },
        },
      ],
      approvalRequirements: [completionApproval(COMPLETE)],
      tools: [],
      artifacts: [
        { key: "scope-preparation", kind: "ai-preparation", label: t("AI scope preparation", "KI-Vorbereitung des Umfangs"), producedBy: "ai-preparation", builder: "scope-preparation" },
        { key: "scope-record", kind: "stage-record", label: t("Scope and trigger record", "Protokoll zu Umfang und Ausloeser"), producedBy: "stage-completion", builder: "rcsa.scope-record" },
      ],
      completionCriteria: [
        SOURCES_RESOLVED,
        aiJobCompleted("scope-preparation"),
        preparationStored("scope-preparation"),
        { kind: "human-task-completed", taskKey: "scope-confirmation", label: t("The scope is confirmed", "Der Umfang ist bestaetigt") },
        { kind: "decision-recorded", decisionKey: "scope-and-trigger", label: t("The scope decision is recorded", "Die Umfangsentscheidung ist erfasst") },
      ],
      nextStageId: "evidence-refresh",
      blockingConditions: [
        ...standardBlocking("scope-preparation"),
        { kind: "decision-held", decisionKey: "scope-and-trigger", label: t("The scope is being revised", "Der Umfang wird ueberarbeitet") },
      ],
      implementation: IMPLEMENTED,
    },

    /* ---------------------------------------------------------------- 2 */
    {
      id: "evidence-refresh",
      sequence: 2,
      name: "Evidence Refresh",
      nameDe: "Nachweisauffrischung",
      outcome:
        "All KRI readings, control test results, incident records and audit findings from the period are retrieved, classified and loaded into the assessment evidence corpus. Gaps are formally requested.",
      outcomeDe:
        "Alle KRI-Werte, Kontrolltestergebnisse, Vorfaelle und Pruefungsfeststellungen des Zeitraums sind abgerufen, eingeordnet und in den Nachweisbestand der Bewertung geladen. Luecken sind formal angefordert.",
      humanResponsibility:
        "Decide the investigation strategy: three separate indicator explanations following the escalation rule, or one causal investigation that names the mechanism. The choice determines whether the committee sees one problem or three.",
      humanResponsibilityDe:
        "Entscheiden Sie die Untersuchungsstrategie: drei getrennte Indikatorerklaerungen nach der Eskalationsregel oder eine kausale Untersuchung, die den Mechanismus benennt. Die Wahl bestimmt, ob das Komitee ein Problem sieht oder drei.",
      relatedObjectKinds: ["kri", "evidence", "control", "assessment", "decision"],
      decisionKinds: ["escalation"],
      entryCriteria: [previousStageCompleted("scope-trigger", 1, "Scope and Trigger", "Umfang und Ausloesungsgrund")],
      requiredSources: [SRC_KRI, SRC_INCIDENTS, SRC_LOSSES, SRC_TESTS, SRC_ACTIONS, SRC_PRIOR],
      helpfulSources: [SRC_TELEMETRY, SRC_CONTROL_EVIDENCE],
      aiJobs: [
        {
          key: "evidence-preparation",
          label: t("Evidence refresh preparation", "Vorbereitung der Nachweisauffrischung"),
          preparer: "rcsa.evidence-refresh",
          configurationId: CONFIG,
          outputSchema: SCHEMA,
          readsSources: [
            "kri-readings",
            "incidents",
            "losses",
            "control-tests",
            "open-actions",
            "prior-assessment",
            "process-telemetry",
            "control-evidence",
          ],
          prepares: [
            t("Indicator readings and breaches", "Indikatorwerte und Schwellenverletzungen"),
            t("Incidents", "Vorfaelle"),
            t("Losses", "Verluste"),
            t("Control tests", "Kontrolltests"),
            t("Open actions", "Offene Massnahmen"),
            t("Prior assessment", "Vorherige Bewertung"),
            t("Process telemetry", "Prozesstelemetrie"),
            t("Evidence gaps", "Nachweisluecken"),
          ],
        },
      ],
      humanTasks: [
        {
          key: "evidence-sufficiency",
          kind: "human-review",
          label: t("Evidence sufficiency review", "Pruefung der Nachweislage"),
          instruction: t(
            "For each required source, record whether the evidence is sufficient for this assessment, and say what is limited and why.",
            "Halten Sie fuer jede erforderliche Quelle fest, ob die Nachweise fuer diese Bewertung ausreichen, und begruenden Sie jede Einschraenkung.",
          ),
          required: true,
          form: "rcsa.evidence-sufficiency",
        },
      ],
      decisions: [
        {
          key: "investigation-strategy",
          judgmentKind: "escalation",
          label: t("Investigation strategy", "Untersuchungsstrategie"),
          question: t(
            "Three separate indicator explanations, as the escalation rule provides, or one causal investigation, as the data suggests?",
            "Drei getrennte Indikatorerklaerungen gemaess Eskalationsregel oder eine Ursachenuntersuchung, wie es die Daten nahelegen?",
          ),
          material: true,
          binding: { kind: "seeded-decision", decisionId: "DEC-2026-0771" },
        },
      ],
      approvalRequirements: [
        {
          key: "investigation-registration",
          label: t("Approve the investigation record in the GRC platform", "Untersuchungsdatensatz im GRC-System genehmigen"),
          covers: { kind: "tool", toolKey: "register-investigation" },
          toolName: "createAction",
          material: true,
        },
        completionApproval(COMPLETE),
      ],
      tools: [
        {
          key: "register-investigation",
          label: t("Register the investigation in the GRC platform", "Untersuchung im GRC-System registrieren"),
          toolName: "createAction",
          channel: "outbox",
          connectorInstanceId: CONNECTOR_GRC,
          targetExternalType: "grc.action",
          payloadBuilder: "rcsa.register-investigation",
          proposeWhen: { decisionKey: "investigation-strategy", optionIds: [] },
          deliveredWhen: "acknowledged",
        },
      ],
      artifacts: [
        { key: "evidence-preparation", kind: "ai-preparation", label: t("AI evidence preparation", "KI-Nachweisvorbereitung"), producedBy: "ai-preparation", builder: "evidence-preparation" },
        { key: "evidence-pack", kind: "evidence-pack", label: t("Evidence pack", "Nachweispaket"), producedBy: "stage-completion", builder: "rcsa.evidence-pack" },
      ],
      completionCriteria: [
        SOURCES_RESOLVED,
        aiJobCompleted("evidence-preparation"),
        preparationStored("evidence-preparation"),
        { kind: "human-task-completed", taskKey: "evidence-sufficiency", label: t("Evidence sufficiency is recorded", "Die Nachweislage ist erfasst") },
        { kind: "decision-recorded", decisionKey: "investigation-strategy", label: t("The investigation strategy is decided", "Die Untersuchungsstrategie ist entschieden") },
        { kind: "tool-executed", toolKey: "register-investigation", label: t("The investigation is confirmed by the GRC platform", "Die Untersuchung ist vom GRC-System bestaetigt") },
      ],
      nextStageId: "risk-control-change",
      blockingConditions: [
        ...standardBlocking("evidence-preparation"),
        { kind: "external-command-failed", toolKey: "register-investigation", label: t("The GRC platform did not confirm the investigation", "Das GRC-System hat die Untersuchung nicht bestaetigt") },
      ],
      implementation: IMPLEMENTED,
    },

    /* ---------------------------------------------------------------- 3 */
    {
      id: "risk-control-change",
      sequence: 3,
      name: "Risk and Control Change",
      nameDe: "Risiko- und Kontrollaenderung",
      outcome:
        "Every risk and control in scope has been compared against the prior assessment version. Changes to inherent position, control effectiveness and appetite position are recorded with a source reference for each change.",
      outcomeDe:
        "Jedes Risiko und jede Kontrolle im Umfang ist mit der vorherigen Bewertungsversion verglichen. Aenderungen der inhaerenten Position, der Kontrollwirksamkeit und der Position zur Risikobereitschaft sind mit einer Quellenangabe je Aenderung erfasst.",
      humanResponsibility:
        "Determine what the evidence says about risk likelihood. Zero recorded losses and no detected errors produce different conclusions about likelihood depending on whether the detection controls can actually see the outcome. The inference step is a human judgment.",
      humanResponsibilityDe:
        "Bestimmen Sie, was die Nachweise ueber die Eintrittswahrscheinlichkeit aussagen. Null erfasste Verluste und keine entdeckten Fehler fuehren zu unterschiedlichen Schluessen, je nachdem, ob die Erkennungskontrollen das Ergebnis ueberhaupt sehen koennen. Dieser Schluss ist ein menschliches Urteil.",
      relatedObjectKinds: ["risk", "control", "assessment", "kri", "evidence", "decision"],
      decisionKinds: ["residual-risk"],
      entryCriteria: [previousStageCompleted("evidence-refresh", 2, "Evidence Refresh", "Nachweisauffrischung")],
      requiredSources: [SRC_RISK_REGISTER, SRC_PRIOR, SRC_KRI],
      helpfulSources: [SRC_TESTS, SRC_LOSSES],
      aiJobs: [
        {
          key: "change-preparation",
          label: t("Risk and control change preparation", "Vorbereitung der Risiko- und Kontrollaenderung"),
          preparer: "rcsa.risk-control-change",
          configurationId: CONFIG,
          outputSchema: SCHEMA,
          readsSources: ["risk-control-register", "prior-assessment", "kri-readings", "control-tests", "losses"],
          prepares: [
            t("Prior-cycle comparison", "Vergleich mit dem Vorzyklus"),
            t("Conflict analysis", "Konfliktanalyse"),
            t("Change candidates", "Aenderungskandidaten"),
            t("Challenge questions", "Fragen fuer die Herausforderung"),
          ],
        },
      ],
      humanTasks: [
        {
          key: "change-review",
          kind: "human-review",
          label: t("Change relevance and materiality", "Relevanz und Wesentlichkeit der Aenderungen"),
          instruction: t(
            "For each change candidate, record whether it is relevant and whether it is material, and say why where you depart from the record.",
            "Halten Sie fuer jeden Aenderungskandidaten fest, ob er relevant und ob er wesentlich ist, und begruenden Sie jede Abweichung vom Datensatz.",
          ),
          required: true,
          form: "rcsa.change-review",
        },
      ],
      decisions: [
        {
          key: "likelihood-inference",
          judgmentKind: "residual-risk",
          label: t("Causal interpretation of the loss record", "Kausale Deutung der Verlusthistorie"),
          question: t(
            "Is zero recorded loss evidence about likelihood, or evidence about detection?",
            "Sind null erfasste Verluste ein Beleg fuer die Eintrittswahrscheinlichkeit oder fuer die Erkennung?",
          ),
          material: true,
          binding: { kind: "seeded-decision", decisionId: "DEC-2026-0744" },
        },
      ],
      approvalRequirements: [completionApproval(COMPLETE)],
      tools: [],
      artifacts: [
        { key: "change-preparation", kind: "ai-preparation", label: t("AI change preparation", "KI-Aenderungsvorbereitung"), producedBy: "ai-preparation", builder: "change-preparation" },
        { key: "change-log", kind: "stage-record", label: t("Risk and control change log", "Aenderungsprotokoll Risiken und Kontrollen"), producedBy: "stage-completion", builder: "rcsa.change-log" },
      ],
      completionCriteria: [
        SOURCES_RESOLVED,
        aiJobCompleted("change-preparation"),
        preparationStored("change-preparation"),
        { kind: "human-task-completed", taskKey: "change-review", label: t("Change relevance is recorded", "Die Relevanz der Aenderungen ist erfasst") },
        { kind: "decision-recorded", decisionKey: "likelihood-inference", label: t("The causal interpretation is decided", "Die kausale Deutung ist entschieden") },
      ],
      nextStageId: "first-line-input",
      blockingConditions: standardBlocking("change-preparation"),
      implementation: IMPLEMENTED,
    },

    /* ---------------------------------------------------------------- 4 */
    {
      id: "first-line-input",
      sequence: 4,
      name: "First-line Input",
      nameDe: "Erstlinien-Eingabe",
      outcome:
        "First-line control owners have submitted their effectiveness positions. Gaps between first-line and second-line positions are surfaced with source citations. The challenge workshop agenda is set.",
      outcomeDe:
        "Die Kontrollverantwortlichen der ersten Linie haben ihre Wirksamkeitspositionen eingereicht. Abweichungen zwischen erster und zweiter Linie sind mit Quellenangaben sichtbar. Die Agenda des Herausforderungs-Workshops steht.",
      humanResponsibility:
        "Set the workshop agenda. The order in which contested items are heard determines whether the room arrives at a disputed rating with momentum or with fatigue. Facilitation sequence is a professional instrument, not an administrative choice.",
      humanResponsibilityDe:
        "Legen Sie die Workshop-Agenda fest. Die Reihenfolge, in der strittige Punkte behandelt werden, entscheidet, ob der Raum eine strittige Bewertung mit Schwung oder ermuedet erreicht. Die Moderationsfolge ist ein fachliches Instrument, keine Verwaltungsfrage.",
      relatedObjectKinds: ["assessment", "control", "risk", "decision"],
      decisionKinds: ["agenda"],
      entryCriteria: [previousStageCompleted("risk-control-change", 3, "Risk and Control Change", "Risiko- und Kontrollaenderung")],
      requiredSources: [SRC_FIRST_LINE, SRC_RISK_REGISTER],
      helpfulSources: [SRC_TESTS],
      aiJobs: [
        {
          key: "first-line-preparation",
          label: t("First-line input preparation", "Vorbereitung der Erstlinien-Eingabe"),
          preparer: "rcsa.first-line-input",
          configurationId: CONFIG,
          outputSchema: SCHEMA,
          readsSources: ["first-line-submissions", "risk-control-register", "control-tests"],
          prepares: [
            t("Targeted questions", "Gezielte Fragen"),
            t("Response comparison", "Vergleich der Antworten"),
            t("Unsupported assertions", "Nicht belegte Aussagen"),
            t("Open disagreements", "Offene Meinungsverschiedenheiten"),
          ],
        },
      ],
      humanTasks: [
        {
          key: "first-line-review",
          kind: "human-review",
          label: t("Factual corrections and challenges", "Faktische Korrekturen und Einwaende"),
          instruction: t(
            "Mark each first-line position as accepted, a factual correction, a judgment to challenge or an item for the workshop.",
            "Ordnen Sie jede Position der ersten Linie ein: akzeptiert, faktische Korrektur, zu hinterfragende Beurteilung oder Punkt fuer den Workshop.",
          ),
          required: true,
          form: "rcsa.first-line-review",
        },
      ],
      decisions: [
        {
          key: "workshop-agenda",
          judgmentKind: "agenda",
          label: t("Workshop sequencing", "Ablauf des Workshops"),
          question: t(
            "Open with the contested rating, place it third, or close with it?",
            "Mit der umstrittenen Bewertung beginnen, sie an dritter Stelle behandeln oder damit schliessen?",
          ),
          material: false,
          binding: { kind: "seeded-decision", decisionId: "DEC-2026-0745" },
        },
      ],
      approvalRequirements: [
        {
          key: "challenge-pack",
          label: t("Approve the message to the first line", "Nachricht an die erste Linie genehmigen"),
          covers: { kind: "tool", toolKey: "send-challenge-pack" },
          toolName: "sendSimulatedCollaborationMessage",
          material: false,
        },
        completionApproval(COMPLETE),
      ],
      tools: [
        {
          key: "send-challenge-pack",
          label: t("Send the challenge pack to the first line", "Herausforderungspaket an die erste Linie senden"),
          toolName: "sendSimulatedCollaborationMessage",
          channel: "local",
          connectorInstanceId: null,
          targetExternalType: null,
          payloadBuilder: "rcsa.challenge-pack",
          proposeWhen: { decisionKey: "workshop-agenda", optionIds: [] },
          deliveredWhen: "queued",
        },
      ],
      artifacts: [
        { key: "first-line-preparation", kind: "ai-preparation", label: t("AI first-line preparation", "KI-Vorbereitung der Erstlinien-Eingabe"), producedBy: "ai-preparation", builder: "first-line-preparation" },
        { key: "workshop-agenda", kind: "stage-record", label: t("Workshop agenda", "Workshop-Agenda"), producedBy: "stage-completion", builder: "rcsa.workshop-agenda" },
      ],
      completionCriteria: [
        SOURCES_RESOLVED,
        aiJobCompleted("first-line-preparation"),
        preparationStored("first-line-preparation"),
        { kind: "human-task-completed", taskKey: "first-line-review", label: t("First-line positions are classified", "Die Positionen der ersten Linie sind eingeordnet") },
        { kind: "decision-recorded", decisionKey: "workshop-agenda", label: t("The workshop agenda is decided", "Die Workshop-Agenda ist entschieden") },
        { kind: "tool-executed", toolKey: "send-challenge-pack", label: t("The challenge pack is sent to the first line", "Das Herausforderungspaket ist an die erste Linie gesendet") },
      ],
      nextStageId: "challenge-workshop",
      blockingConditions: standardBlocking("first-line-preparation"),
      implementation: IMPLEMENTED,
    },

    /* ---------------------------------------------------------------- 5 */
    {
      id: "challenge-workshop",
      sequence: 5,
      name: "Challenge Workshop",
      nameDe: "Herausforderungs-Workshop",
      outcome:
        "Every risk and control rating has been discussed. Agreed positions are recorded in the assessment. Disputed positions carry a recorded second-line dissent with the rationale and the evidence cited.",
      outcomeDe:
        "Jede Risiko- und Kontrollbewertung ist besprochen. Vereinbarte Positionen sind in der Bewertung erfasst. Strittige Positionen tragen einen erfassten Widerspruch der zweiten Linie mit Begruendung und zitierten Nachweisen.",
      humanResponsibility:
        "Challenge the first-line position on the contested control and record the second-line conclusion. The authority gate requires a confirmed rationale that is the professional's own, not a summary of what the AI prepared.",
      humanResponsibilityDe:
        "Hinterfragen Sie die Position der ersten Linie zur strittigen Kontrolle und erfassen Sie das Ergebnis der zweiten Linie. Die Freigabeschranke verlangt eine bestaetigte Begruendung, die die eigene der Fachperson ist, keine Zusammenfassung dessen, was die KI vorbereitet hat.",
      relatedObjectKinds: ["control", "risk", "assessment", "decision", "meeting"],
      decisionKinds: ["control-effectiveness"],
      entryCriteria: [previousStageCompleted("first-line-input", 4, "First-line Input", "Erstlinien-Eingabe")],
      requiredSources: [SRC_WORKSHOP, SRC_RISK_REGISTER],
      helpfulSources: [SRC_TESTS, SRC_FIRST_LINE, SRC_CYCLE_RECORD],
      aiJobs: [
        {
          key: "workshop-preparation",
          label: t("Challenge workshop preparation", "Vorbereitung des Herausforderungs-Workshops"),
          preparer: "rcsa.challenge-workshop",
          configurationId: CONFIG,
          outputSchema: SCHEMA,
          readsSources: ["workshop-record", "risk-control-register", "control-tests", "first-line-submissions", "cycle-record"],
          prepares: [
            t("Agenda", "Agenda"),
            t("Evidence pack", "Nachweispaket"),
            t("Contradictions", "Widersprueche"),
            t("Action capture", "Erfassung von Massnahmen"),
            t("Minutes draft", "Protokollentwurf"),
          ],
        },
      ],
      humanTasks: [
        {
          key: "workshop-outcome",
          kind: "human-review",
          label: t("Actions and unresolved issues", "Massnahmen und offene Punkte"),
          instruction: t(
            "Decide what happens to each action captured in the workshop and to each unresolved issue. The minutes themselves are confirmed in Meetings.",
            "Entscheiden Sie, was mit jeder im Workshop erfassten Massnahme und jedem offenen Punkt geschieht. Das Protokoll selbst wird in Sitzungen bestaetigt.",
          ),
          required: true,
          form: "rcsa.workshop-outcome",
        },
      ],
      decisions: [
        {
          key: "challenge-conclusion",
          judgmentKind: "control-effectiveness",
          label: t("Challenge conclusion on CTL-PAY-014", "Ergebnis der Herausforderung zu CTL-PAY-014"),
          question: t(
            "What control environment rating and residual position do you record?",
            "Welche Bewertung des Kontrollumfelds und welche Restrisikoposition erfassen Sie?",
          ),
          material: true,
          binding: { kind: "seeded-decision", decisionId: "DEC-2026-0772" },
        },
      ],
      approvalRequirements: [completionApproval(COMPLETE)],
      tools: [],
      artifacts: [
        { key: "workshop-preparation", kind: "ai-preparation", label: t("AI workshop preparation", "KI-Workshopvorbereitung"), producedBy: "ai-preparation", builder: "workshop-preparation" },
        { key: "workshop-minutes", kind: "minutes", label: t("Workshop outcome record", "Ergebnisprotokoll des Workshops"), producedBy: "stage-completion", builder: "rcsa.workshop-minutes" },
      ],
      completionCriteria: [
        SOURCES_RESOLVED,
        aiJobCompleted("workshop-preparation"),
        preparationStored("workshop-preparation"),
        { kind: "check", checkKey: "rcsa.workshop-minutes-confirmed", label: t("The workshop minutes are confirmed in Meetings", "Das Workshop-Protokoll ist in Sitzungen bestaetigt") },
        { kind: "human-task-completed", taskKey: "workshop-outcome", label: t("Actions and unresolved issues are decided", "Massnahmen und offene Punkte sind entschieden") },
        { kind: "decision-recorded", decisionKey: "challenge-conclusion", label: t("The challenge conclusion is recorded", "Das Ergebnis der Herausforderung ist erfasst") },
      ],
      nextStageId: "rating-appetite",
      blockingConditions: standardBlocking("workshop-preparation"),
      implementation: IMPLEMENTED,
    },

    /* ---------------------------------------------------------------- 6 */
    {
      id: "rating-appetite",
      sequence: 6,
      name: "Rating and Appetite",
      nameDe: "Bewertung und Risikobereitschaft",
      outcome:
        "Every residual position is computed from the agreed control effectiveness using the group methodology. Each risk is classified as within appetite, at limit or outside appetite. Risks outside appetite have an active remediation plan or a documented Risikoakzeptanz.",
      outcomeDe:
        "Jede Restrisikoposition ist aus der vereinbarten Kontrollwirksamkeit nach der Konzernmethodik berechnet. Jedes Risiko ist als innerhalb, an der Grenze oder ausserhalb der Risikobereitschaft eingeordnet. Risiken ausserhalb der Risikobereitschaft haben einen aktiven Massnahmenplan oder eine dokumentierte Risikoakzeptanz.",
      humanResponsibility:
        "Ratify the residual rating for RSK-0211. The score of 12 is outside appetite and triggers either a committed remediation plan or a Risikoakzeptanz signed by the entity Chief Operating Officer. Which path applies is a judgment about the control environment and the timeline.",
      humanResponsibilityDe:
        "Ratifizieren Sie die Restrisikobewertung fuer RSK-0211. Der Wert 12 liegt ausserhalb der Risikobereitschaft und verlangt entweder einen verbindlichen Massnahmenplan oder eine vom Chief Operating Officer der Gesellschaft unterzeichnete Risikoakzeptanz. Welcher Weg gilt, ist ein Urteil ueber das Kontrollumfeld und den Zeitplan.",
      relatedObjectKinds: ["risk", "assessment", "control", "action", "decision"],
      decisionKinds: ["residual-risk"],
      entryCriteria: [previousStageCompleted("challenge-workshop", 5, "Challenge Workshop", "Herausforderungs-Workshop")],
      requiredSources: [SRC_RISK_REGISTER, SRC_APPETITE],
      helpfulSources: [SRC_PRIOR, SRC_DECISIONS, SRC_CYCLE_RECORD],
      aiJobs: [
        {
          key: "rating-preparation",
          label: t("Rating and appetite preparation", "Vorbereitung von Bewertung und Risikobereitschaft"),
          preparer: "rcsa.rating-appetite",
          configurationId: CONFIG,
          outputSchema: SCHEMA,
          readsSources: ["risk-control-register", "appetite-statements", "prior-assessment", "cycle-decisions", "cycle-record"],
          prepares: [
            t("Deterministic risk-matrix consequences", "Deterministische Folgen der Risikomatrix"),
            t("Alternative positions", "Alternative Positionen"),
            t("Rationale draft", "Begruendungsentwurf"),
            t("Governance effect", "Auswirkung auf die Governance"),
          ],
        },
      ],
      humanTasks: [
        {
          key: "rating-judgment",
          kind: "human-input",
          label: t("Control effectiveness, residual position and appetite", "Kontrollwirksamkeit, Restrisiko und Risikobereitschaft"),
          instruction: t(
            "For the key risk, record the control effectiveness, the residual likelihood and impact, and the residual rating and appetite position they give on the group matrix. For every other line, say whether its draft position stands.",
            "Erfassen Sie fuer das Schluesselrisiko die Kontrollwirksamkeit, die Rest-Eintrittswahrscheinlichkeit und -Auswirkung sowie die Restbewertung und Position zur Risikobereitschaft, die sich daraus in der Konzernmatrix ergeben. Halten Sie fuer jede andere Zeile fest, ob ihre Entwurfsposition bestehen bleibt.",
          ),
          required: true,
          form: "rcsa.rating-judgment",
        },
      ],
      decisions: [
        {
          key: "residual-and-appetite",
          judgmentKind: "residual-risk",
          label: t("Residual rating and appetite path", "Restrisiko und Weg bei Risikobereitschaft"),
          question: t(
            "Do you ratify the residual position, and is the path a remediation plan, a risk acceptance or monitoring?",
            "Ratifizieren Sie die Restrisikoposition, und fuehrt der Weg ueber einen Massnahmenplan, eine Risikoakzeptanz oder die Ueberwachung?",
          ),
          material: true,
          binding: {
            kind: "stage-decision",
            options: [
              { id: "rating-remediation", label: t("Ratify and commit a remediation plan", "Ratifizieren und Massnahmenplan festlegen"), description: t("The residual stands and remediation brings it back within appetite.", "Das Restrisiko bleibt bestehen, Massnahmen fuehren es in die Risikobereitschaft zurueck."), outcome: "advance" },
              { id: "rating-acceptance", label: t("Ratify and seek a risk acceptance", "Ratifizieren und Risikoakzeptanz einholen"), description: t("The residual stands and a Risikoakzeptanz is prepared for the entity Chief Operating Officer.", "Das Restrisiko bleibt bestehen; eine Risikoakzeptanz wird fuer den Chief Operating Officer vorbereitet."), outcome: "advance" },
              { id: "rating-monitor", label: t("Ratify within appetite and monitor", "Innerhalb der Risikobereitschaft ratifizieren und ueberwachen"), description: t("The residual is within appetite or at its limit; no plan or acceptance is required.", "Das Restrisiko liegt innerhalb der Risikobereitschaft oder an ihrer Grenze; weder Plan noch Akzeptanz sind erforderlich."), outcome: "advance" },
              { id: "rating-return", label: t("Return to the workshop", "Zurueck in den Workshop"), description: t("Hold the stage; the agreed effectiveness does not support a rating.", "Die Stufe halten; die vereinbarte Wirksamkeit traegt keine Bewertung."), outcome: "hold" },
            ],
          },
        },
      ],
      approvalRequirements: [
        {
          key: "residual-record",
          label: t("Approve the residual position on the assessment line", "Restrisikoposition in der Bewertungszeile genehmigen"),
          covers: { kind: "tool", toolKey: "record-residual" },
          toolName: "proposeAndRecordResidualRisk",
          material: true,
        },
        completionApproval(COMPLETE),
      ],
      tools: [
        {
          key: "record-residual",
          label: t("Record the ratified residual position on the assessment line", "Ratifizierte Restrisikoposition in der Bewertungszeile erfassen"),
          toolName: "proposeAndRecordResidualRisk",
          channel: "local",
          connectorInstanceId: null,
          targetExternalType: null,
          payloadBuilder: "rcsa.record-residual",
          proposeWhen: { decisionKey: "residual-and-appetite", optionIds: ["rating-remediation", "rating-acceptance", "rating-monitor"] },
          deliveredWhen: "queued",
        },
      ],
      artifacts: [
        { key: "rating-preparation", kind: "ai-preparation", label: t("AI rating preparation", "KI-Bewertungsvorbereitung"), producedBy: "ai-preparation", builder: "rating-preparation" },
        { key: "rating-record", kind: "stage-record", label: t("Rating and appetite record", "Protokoll zu Bewertung und Risikobereitschaft"), producedBy: "stage-completion", builder: "rcsa.rating-record" },
      ],
      completionCriteria: [
        SOURCES_RESOLVED,
        aiJobCompleted("rating-preparation"),
        preparationStored("rating-preparation"),
        { kind: "human-task-completed", taskKey: "rating-judgment", label: t("The rating judgment is recorded", "Die Bewertung ist erfasst") },
        { kind: "decision-recorded", decisionKey: "residual-and-appetite", label: t("The residual and appetite path are decided", "Restrisiko und Weg sind entschieden") },
        {
          kind: "tool-executed",
          toolKey: "record-residual",
          label: t("The residual position is recorded on the assessment line", "Die Restrisikoposition ist in der Bewertungszeile erfasst"),
          when: { decisionKey: "residual-and-appetite", optionIds: ["rating-remediation", "rating-acceptance", "rating-monitor"] },
        },
      ],
      nextStageId: "actions-approval",
      blockingConditions: [
        ...standardBlocking("rating-preparation"),
        { kind: "decision-held", decisionKey: "residual-and-appetite", label: t("The rating went back to the workshop", "Die Bewertung ging zurueck in den Workshop") },
      ],
      implementation: IMPLEMENTED,
    },

    /* ---------------------------------------------------------------- 7 */
    {
      id: "actions-approval",
      sequence: 7,
      name: "Actions and Approval",
      nameDe: "Massnahmen und Genehmigung",
      outcome:
        "All remediation actions from the assessment are recorded with an owner, a due date and a success criterion. The assessment is versioned and submitted for sign-off. The committee paper is drafted.",
      outcomeDe:
        "Alle Massnahmen aus der Bewertung sind mit Verantwortung, Termin und Erfolgskriterium erfasst. Die Bewertung ist versioniert und zur Zeichnung eingereicht. Die Komiteevorlage ist entworfen.",
      humanResponsibility:
        "Approve the assessment version and confirm the recorded rationale is your own. An assessment that changes a rating outside appetite cannot be submitted without the named professional's confirmation. Also decide whether to revise the recorded reasoning when the mechanism is now known to differ from the stated argument.",
      humanResponsibilityDe:
        "Genehmigen Sie die Bewertungsversion und bestaetigen Sie, dass die erfasste Begruendung Ihre eigene ist. Eine Bewertung, die eine Einstufung ausserhalb der Risikobereitschaft aendert, kann ohne die Bestaetigung der benannten Fachperson nicht eingereicht werden. Entscheiden Sie ausserdem, ob die erfasste Begruendung zu ueberarbeiten ist, wenn der Mechanismus jetzt als ein anderer bekannt ist als das angegebene Argument.",
      relatedObjectKinds: ["assessment", "action", "decision", "evidence"],
      decisionKinds: ["residual-risk", "assurance-conclusion"],
      entryCriteria: [previousStageCompleted("rating-appetite", 6, "Rating and Appetite", "Bewertung und Risikobereitschaft")],
      requiredSources: [SRC_ACTION_PLAN, SRC_RISK_REGISTER, SRC_CYCLE_RECORD],
      helpfulSources: [SRC_PRIOR, SRC_DECISIONS],
      aiJobs: [
        {
          key: "actions-preparation",
          label: t("Actions and approval preparation", "Vorbereitung von Massnahmen und Genehmigung"),
          preparer: "rcsa.actions-approval",
          configurationId: CONFIG,
          outputSchema: SCHEMA,
          readsSources: ["action-plan", "risk-control-register", "cycle-record", "prior-assessment", "cycle-decisions"],
          prepares: [
            t("Measurable wording", "Messbare Formulierung"),
            t("Duplicates", "Dubletten"),
            t("Ownership", "Verantwortung"),
            t("Due dates", "Termine"),
            t("Target-system changes", "Aenderungen im Zielsystem"),
          ],
        },
      ],
      humanTasks: [
        {
          key: "action-review",
          kind: "human-review",
          label: t("Action sufficiency, owner and date", "Ausreichende Massnahme, Verantwortung und Termin"),
          instruction: t(
            "Decide whether the planned action is sufficient as worded, who is accountable for it and by when, and how each existing action on the control relates to it.",
            "Entscheiden Sie, ob die geplante Massnahme in dieser Formulierung ausreicht, wer sie bis wann verantwortet und wie sich jede bestehende Massnahme zur Kontrolle dazu verhaelt.",
          ),
          required: true,
          form: "rcsa.action-review",
        },
      ],
      decisions: [
        {
          key: "reasoning-revision",
          judgmentKind: "residual-risk",
          label: t("Revision of the recorded reasoning", "Ueberarbeitung der erfassten Begruendung"),
          question: t(
            "Do you revise the recorded reasoning before the committee paper?",
            "Ueberarbeiten Sie die erfasste Begruendung vor der Komiteevorlage?",
          ),
          material: true,
          binding: { kind: "seeded-decision", decisionId: "DEC-2026-0782" },
        },
        {
          key: "action-plan",
          judgmentKind: "assurance-conclusion",
          label: t("Approval of the action plan", "Genehmigung des Massnahmenplans"),
          question: t(
            "Is the action plan sufficient to submit the assessment for sign-off?",
            "Reicht der Massnahmenplan aus, um die Bewertung zur Freigabe einzureichen?",
          ),
          material: true,
          binding: {
            kind: "stage-decision",
            options: [
              { id: "plan-approve", label: t("Approve the plan and submit for sign-off", "Plan genehmigen und zur Freigabe einreichen"), description: t("Create the action with its owner, date and completion condition, and register it in the GRC platform.", "Die Massnahme mit Verantwortung, Termin und Abschlussbedingung anlegen und im GRC-System registrieren."), outcome: "advance" },
              { id: "plan-rework", label: t("Rework the plan first", "Plan zuerst ueberarbeiten"), description: t("Hold the stage; the action is not sufficient yet.", "Die Stufe halten; die Massnahme reicht noch nicht aus."), outcome: "hold" },
            ],
          },
        },
      ],
      approvalRequirements: [
        {
          key: "plan-action",
          label: t("Approve the action in the Work Hub", "Massnahme im Work Hub genehmigen"),
          covers: { kind: "tool", toolKey: "create-plan-action" },
          toolName: "createAction",
          material: true,
        },
        {
          key: "plan-condition",
          label: t("Approve the agreed completion condition", "Vereinbarte Abschlussbedingung genehmigen"),
          covers: { kind: "tool", toolKey: "agree-completion-condition" },
          toolName: "addActionUpdate",
          material: false,
        },
        {
          key: "plan-registration",
          label: t("Approve the action record in the GRC platform", "Massnahmendatensatz im GRC-System genehmigen"),
          covers: { kind: "tool", toolKey: "register-action-plan" },
          toolName: "createAction",
          material: true,
        },
        completionApproval(COMPLETE),
      ],
      tools: [
        {
          key: "create-plan-action",
          label: t("Create the action in the Work Hub, with owner, date and lineage", "Massnahme im Work Hub mit Verantwortung, Termin und Herkunft anlegen"),
          toolName: "createAction",
          channel: "local",
          connectorInstanceId: null,
          targetExternalType: null,
          payloadBuilder: "rcsa.plan-action",
          proposeWhen: { decisionKey: "action-plan", optionIds: ["plan-approve"] },
          deliveredWhen: "queued",
        },
        {
          key: "agree-completion-condition",
          label: t("Record the agreed completion condition on the action", "Vereinbarte Abschlussbedingung an der Massnahme erfassen"),
          toolName: "addActionUpdate",
          channel: "local",
          connectorInstanceId: null,
          targetExternalType: null,
          payloadBuilder: "rcsa.plan-condition",
          proposeWhen: { decisionKey: "action-plan", optionIds: ["plan-approve"] },
          deliveredWhen: "queued",
        },
        {
          key: "register-action-plan",
          label: t("Register the action in the GRC platform", "Massnahme im GRC-System registrieren"),
          toolName: "createAction",
          channel: "outbox",
          connectorInstanceId: CONNECTOR_GRC,
          targetExternalType: "grc.action",
          payloadBuilder: "rcsa.register-plan",
          proposeWhen: { decisionKey: "action-plan", optionIds: ["plan-approve"] },
          deliveredWhen: "acknowledged",
        },
      ],
      artifacts: [
        { key: "actions-preparation", kind: "ai-preparation", label: t("AI actions preparation", "KI-Massnahmenvorbereitung"), producedBy: "ai-preparation", builder: "actions-preparation" },
        { key: "assessment-submission", kind: "stage-record", label: t("Assessment version for sign-off", "Bewertungsversion zur Freigabe"), producedBy: "stage-completion", builder: "rcsa.assessment-submission" },
      ],
      completionCriteria: [
        SOURCES_RESOLVED,
        aiJobCompleted("actions-preparation"),
        preparationStored("actions-preparation"),
        { kind: "human-task-completed", taskKey: "action-review", label: t("The action plan is reviewed", "Der Massnahmenplan ist geprueft") },
        { kind: "decision-recorded", decisionKey: "reasoning-revision", label: t("The reasoning decision is recorded", "Die Entscheidung zur Begruendung ist erfasst") },
        { kind: "decision-recorded", decisionKey: "action-plan", label: t("The action plan is approved", "Der Massnahmenplan ist genehmigt") },
        { kind: "tool-executed", toolKey: "create-plan-action", label: t("The action is in the Work Hub", "Die Massnahme ist im Work Hub"), when: { decisionKey: "action-plan", optionIds: ["plan-approve"] } },
        { kind: "tool-executed", toolKey: "agree-completion-condition", label: t("The completion condition is agreed", "Die Abschlussbedingung ist vereinbart"), when: { decisionKey: "action-plan", optionIds: ["plan-approve"] } },
        { kind: "tool-executed", toolKey: "register-action-plan", label: t("The GRC platform confirmed the action", "Das GRC-System hat die Massnahme bestaetigt"), when: { decisionKey: "action-plan", optionIds: ["plan-approve"] } },
      ],
      nextStageId: "monitoring-reassessment",
      blockingConditions: [
        ...standardBlocking("actions-preparation"),
        { kind: "decision-held", decisionKey: "action-plan", label: t("The action plan is being reworked", "Der Massnahmenplan wird ueberarbeitet") },
        { kind: "external-command-failed", toolKey: "register-action-plan", label: t("The GRC platform did not confirm the action", "Das GRC-System hat die Massnahme nicht bestaetigt") },
      ],
      implementation: IMPLEMENTED,
    },

    /* ---------------------------------------------------------------- 8 */
    {
      id: "monitoring-reassessment",
      sequence: 8,
      name: "Monitoring and Reassessment",
      nameDe: "Ueberwachung und Neubewertung",
      outcome:
        "KRI alert thresholds are confirmed for the post-cycle monitoring period. The next cycle trigger date is set. The assessment is closed and the process returns to continuous monitoring, or an off-cycle reassessment opens as a new run.",
      outcomeDe:
        "Die KRI-Schwellen fuer den Ueberwachungszeitraum nach dem Zyklus sind bestaetigt. Der naechste Zyklustermin ist gesetzt. Die Bewertung ist geschlossen und der Prozess kehrt in die laufende Ueberwachung zurueck, oder eine ausserplanmaessige Neubewertung beginnt als neuer Durchlauf.",
      humanResponsibility:
        "Confirm the monitoring plan. Enhanced monitoring of KRI-PAY-007 (override rate) applies until the remediation actions close. The professional signs off the frequency and the escalation threshold, and decides whether a material change needs an off-cycle reassessment.",
      humanResponsibilityDe:
        "Bestaetigen Sie den Ueberwachungsplan. Die verstaerkte Ueberwachung von KRI-PAY-007 (Override-Quote) gilt, bis die Massnahmen abgeschlossen sind. Die Fachperson zeichnet Frequenz und Eskalationsschwelle ab und entscheidet, ob eine wesentliche Aenderung eine ausserplanmaessige Neubewertung braucht.",
      relatedObjectKinds: ["kri", "action", "assessment", "process"],
      decisionKinds: ["risk-acceptance"],
      entryCriteria: [previousStageCompleted("actions-approval", 7, "Actions and Approval", "Massnahmen und Genehmigung")],
      requiredSources: [SRC_KRI, SRC_ACTION_PLAN],
      helpfulSources: [SRC_INCIDENTS, SRC_DECISIONS, SRC_MONITORING, SRC_CYCLE_RECORD, SRC_RISK_REGISTER],
      aiJobs: [
        {
          key: "monitoring-preparation",
          label: t("Monitoring and reassessment preparation", "Vorbereitung von Ueberwachung und Neubewertung"),
          preparer: "rcsa.monitoring-reassessment",
          configurationId: CONFIG,
          outputSchema: SCHEMA,
          readsSources: ["kri-readings", "action-plan", "incidents", "cycle-decisions", "monitoring-activations", "cycle-record", "risk-control-register"],
          prepares: [
            t("Monitoring routines", "Ueberwachungsroutinen"),
            t("Event links", "Verknuepfte Ereignisse"),
            t("Committee delta", "Aenderungen fuer das Komitee"),
            t("Reassessment proposal", "Vorschlag zur Neubewertung"),
          ],
        },
      ],
      humanTasks: [
        {
          key: "monitoring-review",
          kind: "human-input",
          label: t("Monitoring routine, material change and escalation", "Ueberwachungsroutine, wesentliche Aenderung und Eskalation"),
          instruction: t(
            "Set the review frequency of the indicator in breach, and record whether there is a material change and whether it needs escalation.",
            "Legen Sie die Pruefhaeufigkeit des verletzten Indikators fest und halten Sie fest, ob eine wesentliche Aenderung vorliegt und ob sie eskaliert werden muss.",
          ),
          required: true,
          form: "rcsa.monitoring-review",
        },
      ],
      decisions: [
        {
          key: "monitoring-plan",
          judgmentKind: "risk-acceptance",
          label: t("Monitoring plan and reassessment", "Ueberwachungsplan und Neubewertung"),
          question: t(
            "Is there a material change, does it need an off-cycle reassessment, and does it need escalation?",
            "Gibt es eine wesentliche Aenderung, braucht es eine ausserplanmaessige Neubewertung und eine Eskalation?",
          ),
          material: true,
          binding: {
            kind: "stage-decision",
            options: [
              { id: "monitoring-standard", label: t("Confirm enhanced monitoring", "Verstaerkte Ueberwachung bestaetigen"), description: t("Close the cycle with the enhanced monitoring plan.", "Den Zyklus mit dem verstaerkten Ueberwachungsplan abschliessen."), outcome: "advance" },
              { id: "monitoring-off-cycle", label: t("Open an off-cycle reassessment", "Ausserplanmaessige Neubewertung eroeffnen"), description: t("A material change requires a new run.", "Eine wesentliche Aenderung erfordert einen neuen Durchlauf."), outcome: "advance" },
              { id: "monitoring-escalate", label: t("Escalate before closing", "Vor dem Abschluss eskalieren"), description: t("Hold the stage until the escalation is answered.", "Die Stufe halten, bis die Eskalation beantwortet ist."), outcome: "hold" },
            ],
          },
        },
      ],
      approvalRequirements: [
        {
          key: "indicator-monitoring",
          label: t("Approve enhanced monitoring of the indicator", "Verstaerkte Ueberwachung des Indikators genehmigen"),
          covers: { kind: "tool", toolKey: "activate-indicator-monitoring" },
          toolName: "activateMonitoring",
          material: true,
        },
        {
          key: "reassessment",
          label: t("Approve the off-cycle reassessment", "Ausserplanmaessige Neubewertung genehmigen"),
          covers: { kind: "tool", toolKey: "open-reassessment" },
          toolName: "initiateReassessment",
          material: true,
        },
        completionApproval(COMPLETE),
      ],
      tools: [
        {
          key: "activate-indicator-monitoring",
          label: t("Activate enhanced monitoring of the indicator", "Verstaerkte Ueberwachung des Indikators aktivieren"),
          toolName: "activateMonitoring",
          channel: "local",
          connectorInstanceId: null,
          targetExternalType: null,
          payloadBuilder: "rcsa.indicator-monitoring",
          proposeWhen: { decisionKey: "monitoring-plan", optionIds: ["monitoring-standard", "monitoring-off-cycle"] },
          deliveredWhen: "queued",
        },
        {
          key: "open-reassessment",
          label: t("Create the off-cycle reassessment", "Ausserplanmaessige Neubewertung anlegen"),
          toolName: "initiateReassessment",
          channel: "local",
          connectorInstanceId: null,
          targetExternalType: null,
          payloadBuilder: "rcsa.open-reassessment",
          proposeWhen: { decisionKey: "monitoring-plan", optionIds: ["monitoring-off-cycle"] },
          deliveredWhen: "queued",
        },
      ],
      artifacts: [
        { key: "monitoring-preparation", kind: "ai-preparation", label: t("AI monitoring preparation", "KI-Ueberwachungsvorbereitung"), producedBy: "ai-preparation", builder: "monitoring-preparation" },
        { key: "monitoring-plan", kind: "stage-record", label: t("Monitoring plan", "Ueberwachungsplan"), producedBy: "stage-completion", builder: "rcsa.monitoring-plan" },
      ],
      completionCriteria: [
        SOURCES_RESOLVED,
        aiJobCompleted("monitoring-preparation"),
        preparationStored("monitoring-preparation"),
        { kind: "human-task-completed", taskKey: "monitoring-review", label: t("The monitoring review is recorded", "Die Ueberwachungspruefung ist erfasst") },
        { kind: "decision-recorded", decisionKey: "monitoring-plan", label: t("The monitoring decision is recorded", "Die Ueberwachungsentscheidung ist erfasst") },
        {
          kind: "tool-executed",
          toolKey: "activate-indicator-monitoring",
          label: t("Enhanced monitoring of the indicator is active", "Die verstaerkte Ueberwachung des Indikators ist aktiv"),
          when: { decisionKey: "monitoring-plan", optionIds: ["monitoring-standard", "monitoring-off-cycle"] },
        },
        {
          kind: "tool-executed",
          toolKey: "open-reassessment",
          label: t("The off-cycle reassessment is created", "Die ausserplanmaessige Neubewertung ist angelegt"),
          when: { decisionKey: "monitoring-plan", optionIds: ["monitoring-off-cycle"] },
        },
      ],
      nextStageId: null,
      blockingConditions: [
        ...standardBlocking("monitoring-preparation"),
        { kind: "decision-held", decisionKey: "monitoring-plan", label: t("An escalation is open", "Eine Eskalation ist offen") },
      ],
      implementation: IMPLEMENTED,
    },
  ],
};

/* ---------------------------------------------------------------------------
   The RCSA Cycle Assistant role-app
   --------------------------------------------------------------------------- */

export const RCSA_CYCLE_ASSISTANT: RoleAppDefinition = {
  id: "rcsa-cycle-assistant",
  roleId: "rcsa",
  functionPackId: "nfr-operational-risk",
  name: "RCSA Cycle Assistant",
  nameDe: "RCSA-Zyklus-Assistent",
  summary:
    "Guides the Operational Risk Partner through the eight-stage RCSA lifecycle from evidence refresh to monitoring plan, surfacing contested positions and preparing the challenge workshop.",
  summaryDe:
    "Begleitet den Operational Risk Partner durch den achtphasigen RCSA-Zyklus von der Nachweisauffrischung bis zum Ueberwachungsplan und bereitet den Herausforderungs-Workshop vor.",
  status: "installed",
  maturity: "production-shaped",
  version: "1.0.0",
  entryRoute: "/workday/rcsa/processes/rcsa-cycle",
  processId: "rcsa-cycle",
  coveredStageIds: [
    "scope-trigger",
    "evidence-refresh",
    "risk-control-change",
    "first-line-input",
    "challenge-workshop",
    "rating-appetite",
    "actions-approval",
    "monitoring-reassessment",
  ],
  requiredConnectorPackIds: ["risk-register", "control-register", "kri-platform"],
  humanDecisionKinds: [
    "escalation",
    "residual-risk",
    "control-effectiveness",
    "agenda",
    "assurance-conclusion",
    "risk-acceptance",
  ],
  stageCompletionToolName: COMPLETE,
  workspaceRegion: "rcsa-stage-workspace",
};

/*
 * The static run constant that used to live here (`RCSA_PAYMENTS_Q4_RUN`) was
 * a fallback the process page rendered when the database had no run. It was
 * removed with the process engine: the seeded run in the database is the only
 * account of where the cycle stands, and a page without it says so.
 */

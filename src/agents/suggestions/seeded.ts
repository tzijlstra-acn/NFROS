/**
 * Seeded suggestion content.
 *
 * This is the content the product shows when no live call is possible, which
 * in practice is most of the time. It is written to the same standard as the
 * live path is asked to meet rather than as a placeholder, because a seeded
 * card that reads like filler undoes the claim the whole product makes.
 *
 * Every identifier here is a row in the seeded scenario: real control
 * references, real supplier and subprocessor identifiers, real test case
 * references, real obligation identifiers, real indicator references and real
 * evidence document identifiers. The validator checks the evidence
 * identifiers against the corpus at seed time, so an invented citation fails
 * the seed rather than the demonstration.
 *
 * Three beats per role, which are the three moments the day turns on:
 *   morning        07:45, opening the role
 *   decision       11:45, the role's material human decision
 *   shared-event   14:05, the supplier and payments event every role sees
 *
 * The evidence sets are taken from the authored timeline role moments and the
 * decision records rather than chosen here, so a card cites what the scenario
 * says was in front of that professional at that moment and nothing that had
 * not yet arrived.
 */

import type { RoleId } from "@/db/schema/core";
import type { GroundedStatement } from "@/agents/schemas";
import type { SuggestionDraft } from "./validate";
import { copyStrings, REGULATORY_DISCLOSURE } from "./validate";
import { momentMinutes } from "@/workday/contracts";

export const SUGGESTION_BEATS = ["morning", "decision", "shared-event"] as const;
export type SuggestionBeat = (typeof SUGGESTION_BEATS)[number];

export const BEAT_MOMENTS: Record<SuggestionBeat, string> = {
  morning: "07:45",
  decision: "11:45",
  "shared-event": "14:05",
};

export interface SeededSuggestion {
  roleId: RoleId;
  beat: SuggestionBeat;
  objectType: string;
  objectId: string;
  objectLabel: string;
  atMoment: string;
  decisionId: string | null;
  priority: "critical" | "high" | "medium" | "low";
  /**
   * Recorded latency for the cached beat.
   *
   * These are the figures the presenter safe path paces to. They are in the
   * range a real structured generation of this size takes, so safe mode feels
   * like the live mode it stands in for rather than like a stub.
   */
  simulatedLatencyMs: number;
  en: SuggestionDraft;
  de: SuggestionDraft;
}

/* ==========================================================================
   Grounding constructors

   Five arrays, five constructors. There is deliberately no generic one that
   takes a provenance argument: the point of the separation is that a writer
   has to choose the category by choosing the function, and a single
   constructor with a parameter is how a stakeholder statement ends up filed
   as a verified fact.
   ========================================================================== */

function fact(statement: string, sourceIds: string[]): GroundedStatement {
  return { statement, provenance: "verified-fact", sourceIds, confidence: null };
}

function record(statement: string, sourceIds: string[]): GroundedStatement {
  return { statement, provenance: "approved-record", sourceIds, confidence: null };
}

function stated(statement: string, sourceIds: string[]): GroundedStatement {
  return { statement, provenance: "stakeholder-statement", sourceIds, confidence: null };
}

function inferred(statement: string, sourceIds: string[], confidence: number): GroundedStatement {
  return { statement, provenance: "model-inference", sourceIds, confidence };
}

function conflict(statement: string, sourceIds: string[]): GroundedStatement {
  return { statement, provenance: "conflicting-evidence", sourceIds, confidence: null };
}

function grounding(parts: {
  facts?: GroundedStatement[];
  records?: GroundedStatement[];
  statements?: GroundedStatement[];
  inference?: GroundedStatement[];
  conflicts?: GroundedStatement[];
}): SuggestionDraft["grounding"] {
  return {
    verifiedFacts: parts.facts ?? [],
    approvedRecords: parts.records ?? [],
    stakeholderStatements: parts.statements ?? [],
    modelInference: parts.inference ?? [],
    conflictingEvidence: parts.conflicts ?? [],
  };
}

/* ==========================================================================
   Evidence sets, named so a reader can check them against the scenario
   ========================================================================== */

const EV = {
  tprmMorning: [
    "EVD-2026-41410",
    "EVD-2026-41405",
    "EVD-2026-40118",
    "EVD-2026-41445",
    "EVD-2026-41240",
    "EVD-2026-41435",
  ],
  tprmDecision: [
    "EVD-2026-41235",
    "EVD-2026-41410",
    "EVD-2026-41405",
    "EVD-2026-41402",
    "EVD-2026-41415",
  ],
  tprmEvent: [
    "EVD-2026-41871",
    "EVD-2026-41420",
    "EVD-2026-41410",
    "EVD-2026-41405",
    "EVD-2026-41872",
  ],
  rcsaMorning: [
    "EVD-2026-41820",
    "EVD-2026-41821",
    "EVD-2026-41810",
    "EVD-2026-41850",
    "EVD-2026-41855",
    "EVD-2026-41200",
  ],
  rcsaDecision: [
    "EVD-2026-41850",
    "EVD-2026-41852",
    "EVD-2026-41250",
    "EVD-2026-41822",
    "EVD-2026-41855",
    "EVD-2026-41202",
  ],
  rcsaEvent: [
    "EVD-2026-41874",
    "EVD-2026-41875",
    "EVD-2026-41878",
    "EVD-2026-41821",
    "EVD-2026-41810",
  ],
  caMorning: [
    "EVD-2026-41852",
    "EVD-2026-41850",
    "EVD-2026-41105",
    "EVD-2026-41102",
    "EVD-2026-41855",
    "EVD-2026-41908",
  ],
  caDecision: [
    "EVD-2026-41852",
    "EVD-2026-41805",
    "EVD-2026-41908",
    "EVD-2026-41850",
    "EVD-2026-41855",
    "EVD-2026-41250",
  ],
  caEvent: [
    "EVD-2026-41874",
    "EVD-2026-41878",
    "EVD-2026-41805",
    "EVD-2026-41876",
    "EVD-2026-41852",
  ],
  irMorning: [
    "EVD-2026-41705",
    "EVD-2026-41710",
    "EVD-2026-41500",
    "EVD-2026-40118",
    "EVD-2026-41700",
    "EVD-2026-41505",
  ],
  irDecision: [
    "EVD-2026-41705",
    "EVD-2026-41700",
    "EVD-2026-41805",
    "EVD-2026-41855",
    "EVD-2026-41908",
  ],
  irEvent: [
    "EVD-2026-41871",
    "EVD-2026-41874",
    "EVD-2026-41875",
    "EVD-2026-41878",
    "EVD-2026-41500",
    "EVD-2026-41710",
  ],
  regMorning: [
    "EVD-2026-41300",
    "EVD-2026-41305",
    "EVD-2026-41405",
    "EVD-2026-41402",
    "EVD-2026-41310",
  ],
  regDecision: [
    "EVD-2026-41305",
    "EVD-2026-41405",
    "EVD-2026-41300",
    "EVD-2026-41410",
    "EVD-2026-41402",
  ],
  regEvent: ["EVD-2026-41871", "EVD-2026-41420", "EVD-2026-41405", "EVD-2026-41410"],
  govMorning: [
    "EVD-2026-41821",
    "EVD-2026-41820",
    "EVD-2026-41280",
    "EVD-2026-41204",
    "EVD-2026-41105",
    "EVD-2026-41440",
  ],
  govDecision: [
    "EVD-2026-41280",
    "EVD-2026-41102",
    "EVD-2026-41205",
    "EVD-2026-41105",
    "EVD-2026-41270",
  ],
  govEvent: [
    "EVD-2026-41878",
    "EVD-2026-41876",
    "EVD-2026-41874",
    "EVD-2026-41204",
    "EVD-2026-41821",
  ],
} as const;

/* ==========================================================================
   Third-Party Risk Manager, Stefan Brunner, Arcadia Bank AG
   ========================================================================== */

const TPRM_MORNING: SeededSuggestion = {
  roleId: "tprm",
  beat: "morning",
  objectType: "supplier",
  objectId: "TP-0042",
  objectLabel: "Novalink Payment Services GmbH",
  atMoment: "07:45",
  decisionId: "DEC-2026-0741",
  priority: "high",
  simulatedLatencyMs: 2_640,
  en: {
    headline: "The RepairDesk recovery time gap has been open 137 days with no escalation on record",
    changeSummary:
      "Three things moved on TP-0042 overnight. The 2026 reassessment is at interim status. The binding subprocessor appendix A3 version 4.2 and the supplier register version 6.1 now diverge on four nodes. The September service report was requested and has not arrived.",
    whyItMatters:
      "The recovery time gap sits on the payment repair workbench, which all three entities use, and the exit plan that would answer it is itself older than the policy freshness requirement. Nothing in the record shows the gap was escalated, so the 137 days are not a decision to accept it. They are the absence of one.",
    checksCompleted: [
      "Read the disaster recovery test report of 22.05.2026 against the recovery time stated in service level appendix A1 version 3.0.",
      "Reconciled binding appendix A3 version 4.2 against the supplier register version 6.1 node by node, returning four divergences.",
      "Searched the contract repository for a subprocessor notice covering the service desk provider, returning nil, and recorded the search scope.",
      "Checked the interim reassessment status note of 05.10.2026 and the supplier portal publication history.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Raise an issue against TP-0042 recording the recovery time gap, its age of 137 days and the absence of any escalation record, with the out of date exit plan attached as a second gap.",
    recommendedToolName: "createIssue",
    alternatives: [
      "Hold the issue until the September service report arrives, accepting that the age keeps growing while you wait.",
      "Take the gap to the next quarterly service review instead of raising it, which keeps it inside the supplier relationship.",
      "Treat the out of date exit plan as the primary gap and the recovery time as a symptom of it.",
    ],
    evidenceIds: [...EV.tprmMorning],
    confidence: 66,
    uncertainty: [
      "The availability figure is calculated from Arcadia side submission telemetry, not from a supplier service report. A different maintenance exclusion changes it.",
      "The disaster recovery test report covers the shared instance. It says nothing about the instance serving Arcadia Bank Schweiz AG.",
      "A nil return from the contract repository is evidence of absence in Arcadia's records. It is not proof that no notice was given.",
    ],
    decisionRequired: true,
    grounding: grounding({
      records: [
        record(
          "Service level appendix A1 version 3.0 states the recovery time objective for the payment repair workbench.",
          ["EVD-2026-41425"],
        ),
        record(
          "Exit and transition plan appendix A6 version 2.0 is older than the policy freshness requirement.",
          ["EVD-2026-41435"],
        ),
      ],
      statements: [
        stated(
          "The supplier's disaster recovery test report of 22.05.2026 asserts a recovery position the service level appendix does not support.",
          ["EVD-2026-40118"],
        ),
        stated("The interim reassessment note of 05.10.2026 records the cycle as still open.", [
          "EVD-2026-41445",
        ]),
      ],
      conflicts: [
        conflict(
          "The binding subprocessor appendix and the supplier register disagree on four nodes, including a service desk provider the appendix does not name.",
          ["EVD-2026-41410", "EVD-2026-41405"],
        ),
      ],
      inference: [
        inferred(
          "The absence of an escalation record across 137 days is more readily explained by a monitoring gap than by a recorded acceptance.",
          ["EVD-2026-41445"],
          0.6,
        ),
      ],
    }),
  },
  de: {
    headline: "Die Luecke bei der Wiederherstellungszeit von RepairDesk ist seit 137 Tagen offen",
    changeSummary:
      "Bei TP-0042 hat sich ueber Nacht dreierlei bewegt. Die Neubewertung 2026 steht auf Zwischenstand. Der verbindliche Anhang A3 Version 4.2 und das Lieferantenregister Version 6.1 weichen nun in vier Knoten voneinander ab. Der Servicebericht fuer September wurde angefordert und ist nicht eingegangen.",
    whyItMatters:
      "Die Luecke betrifft die Reparaturplattform fuer Zahlungen, die alle drei Einheiten nutzen, und der Ausstiegsplan, der sie beantworten wuerde, ist selbst veraltet. Im Datensatz findet sich keine Eskalation. Die 137 Tage sind also keine Entscheidung zur Annahme des Risikos, sondern deren Fehlen.",
    checksCompleted: [
      "Den Wiederherstellungstestbericht vom 22.05.2026 gegen die im Anhang A1 Version 3.0 genannte Wiederherstellungszeit gelesen.",
      "Den verbindlichen Anhang A3 Version 4.2 Knoten fuer Knoten gegen das Lieferantenregister Version 6.1 abgeglichen, mit vier Abweichungen.",
      "Das Vertragsarchiv nach einer Unterauftragsmitteilung zum Service-Desk-Anbieter durchsucht, ohne Treffer, und den Suchumfang erfasst.",
      "Die Zwischenstandsnotiz der Neubewertung vom 05.10.2026 und die Veroeffentlichungshistorie des Lieferantenportals geprueft.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Einen Sachverhalt zu TP-0042 eroeffnen, der die Luecke bei der Wiederherstellungszeit, ihr Alter von 137 Tagen und das Fehlen einer Eskalation erfasst, mit dem veralteten Ausstiegsplan als zweiter Luecke.",
    recommendedToolName: "createIssue",
    alternatives: [
      "Den Sachverhalt bis zum Eingang des Septemberberichts zurueckhalten und akzeptieren, dass das Alter weiter waechst.",
      "Die Luecke in die naechste Quartalsbesprechung geben statt sie zu eroeffnen, womit sie in der Lieferantenbeziehung bleibt.",
      "Den veralteten Ausstiegsplan als Hauptluecke behandeln und die Wiederherstellungszeit als deren Symptom.",
    ],
    evidenceIds: [...EV.tprmMorning],
    confidence: 66,
    uncertainty: [
      "Die Verfuegbarkeitszahl stammt aus Arcadia-seitiger Telemetrie, nicht aus einem Lieferantenbericht. Eine andere Wartungsabgrenzung veraendert sie.",
      "Der Wiederherstellungstestbericht betrifft die gemeinsame Instanz. Zur Instanz der Arcadia Bank Schweiz AG sagt er nichts.",
      "Ein Nulltreffer im Vertragsarchiv belegt die Abwesenheit in den Unterlagen von Arcadia. Er belegt nicht, dass keine Mitteilung erfolgte.",
    ],
    decisionRequired: true,
    grounding: grounding({
      records: [
        record(
          "Anhang A1 Version 3.0 nennt das Wiederherstellungsziel fuer die Reparaturplattform fuer Zahlungen.",
          ["EVD-2026-41425"],
        ),
        record("Der Ausstiegsplan Anhang A6 Version 2.0 ist aelter als die Richtlinienvorgabe.", [
          "EVD-2026-41435",
        ]),
      ],
      statements: [
        stated(
          "Der Wiederherstellungstestbericht des Lieferanten vom 22.05.2026 behauptet eine Position, die der Anhang nicht stuetzt.",
          ["EVD-2026-40118"],
        ),
        stated("Die Zwischenstandsnotiz vom 05.10.2026 fuehrt den Zyklus als weiterhin offen.", [
          "EVD-2026-41445",
        ]),
      ],
      conflicts: [
        conflict(
          "Verbindlicher Anhang und Lieferantenregister widersprechen sich in vier Knoten, darunter ein im Anhang nicht genannter Service-Desk-Anbieter.",
          ["EVD-2026-41410", "EVD-2026-41405"],
        ),
      ],
      inference: [
        inferred(
          "Das Fehlen einer Eskalation ueber 137 Tage erklaert sich eher durch eine Ueberwachungsluecke als durch eine erfasste Risikoannahme.",
          ["EVD-2026-41445"],
          0.6,
        ),
      ],
    }),
  },
};

const TPRM_DECISION: SeededSuggestion = {
  roleId: "tprm",
  beat: "decision",
  objectType: "contract",
  objectId: "CTR-2023-0117-A3",
  objectLabel: "Master Services Agreement appendix A3, subprocessor list and notice provisions",
  atMoment: "11:45",
  decisionId: "DEC-2026-0759",
  priority: "high",
  simulatedLatencyMs: 2_980,
  en: {
    headline: "The appendix divergence is three different findings, and only one of them is a breach",
    changeSummary:
      "The reconciliation is complete. Four nodes differ between binding appendix A3 version 4.2 and supplier register version 6.1. The service desk provider TP-0042.4 in Pune appears in the register and in the questionnaire response, and in neither the appendix nor any notice held in the contract repository.",
    whyItMatters:
      "Breach, material change and drafting gap carry different consequences and different owners. Calling this a breach before Group Legal has established which document binds would commit the bank to a position it may not be able to hold, and calling it a drafting gap would discard a transparency failure that is real either way.",
    checksCompleted: [
      "Compared appendix A3 version 4.2 against supplier register version 6.1 and the domain 4 questionnaire response, node by node.",
      "Checked the data processing appendix, which names Switzerland, Germany, the Czech Republic and Ireland, and does not name India.",
      "Searched the contract repository for a notice under appendix A3 clause 3.4, returning nil, with the search scope recorded.",
      "Read the reconciliation working sheet TPR-REC-2026-0042, which records the four divergences and the evidence behind each row.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Create an action for Group Legal to establish which document binds on subprocessor notice, with the four divergences and the nil repository return attached, due before the committee on 13.10.2026.",
    recommendedToolName: "createAction",
    alternatives: [
      "Record the transparency gap now and leave the characterisation open until Legal reports, which preserves the finding without asserting a breach.",
      "Treat the portal publication as constructive notice, which is the supplier's position and which the contract text does not clearly support.",
      "Raise one issue per divergent node, which is more precise and splits a single question into four.",
    ],
    evidenceIds: [...EV.tprmDecision],
    confidence: 58,
    uncertainty: [
      "Whether portal publication satisfies the notice provision is a contractual interpretation that this system cannot make and has not made.",
      "The subprocessor's data access scope is stated by the supplier in its own register and has not been verified by Arcadia.",
      "The register version history shows one publication in August 2026 and the previous one in September 2025, so the notice window cannot be dated precisely.",
    ],
    decisionRequired: true,
    grounding: grounding({
      records: [
        record(
          "Appendix A3 version 4.2 of 14.02.2025 is the subprocessor list currently recorded as binding, and clause 3.4 sets the notice provision.",
          ["EVD-2026-41410"],
        ),
        record(
          "The data processing appendix names four transfer destinations and does not name India.",
          ["EVD-2026-41402"],
        ),
      ],
      statements: [
        stated(
          "The supplier register version 6.1 lists the service desk provider TP-0042.4 in Pune as an active subprocessor.",
          ["EVD-2026-41405"],
        ),
      ],
      facts: [
        fact(
          "No subprocessor notice for TP-0042.4 is held in the contract repository, searched across the full repository scope.",
          ["EVD-2026-41235"],
        ),
      ],
      conflicts: [
        conflict(
          "The binding appendix and the supplier register state different subprocessor sets for the same arrangement.",
          ["EVD-2026-41415", "EVD-2026-41410", "EVD-2026-41405"],
        ),
      ],
      inference: [
        inferred(
          "The divergence pattern, four nodes added and none removed, is more consistent with a notice process failure than with a disputed contract version.",
          ["EVD-2026-41415"],
          0.55,
        ),
      ],
    }),
  },
  de: {
    headline: "Die Abweichung im Anhang sind drei Feststellungen, und nur eine davon ist ein Verstoss",
    changeSummary:
      "Der Abgleich ist abgeschlossen. Vier Knoten unterscheiden sich zwischen dem verbindlichen Anhang A3 Version 4.2 und dem Lieferantenregister Version 6.1. Der Service-Desk-Anbieter TP-0042.4 in Pune erscheint im Register und in der Fragebogenantwort, und weder im Anhang noch in einer Mitteilung im Vertragsarchiv.",
    whyItMatters:
      "Verstoss, wesentliche Aenderung und Formulierungsluecke haben unterschiedliche Folgen und unterschiedliche Eigentuemer. Dies einen Verstoss zu nennen, bevor Group Legal geklaert hat, welches Dokument bindet, wuerde die Bank auf eine Position festlegen, die sie moeglicherweise nicht halten kann.",
    checksCompleted: [
      "Anhang A3 Version 4.2 gegen das Lieferantenregister Version 6.1 und die Fragebogenantwort zu Domaene 4 Knoten fuer Knoten verglichen.",
      "Den Datenverarbeitungsanhang geprueft, der die Schweiz, Deutschland, Tschechien und Irland nennt und Indien nicht nennt.",
      "Das Vertragsarchiv nach einer Mitteilung gemaess Anhang A3 Ziffer 3.4 durchsucht, ohne Treffer, mit erfasstem Suchumfang.",
      "Das Abgleichsblatt TPR-REC-2026-0042 gelesen, das die vier Abweichungen und die Nachweise je Zeile erfasst.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Eine Massnahme fuer Group Legal anlegen, um zu klaeren, welches Dokument bei der Unterauftragsmitteilung bindet, mit den vier Abweichungen und dem Nulltreffer als Anlage, faellig vor dem Ausschuss am 13.10.2026.",
    recommendedToolName: "createAction",
    alternatives: [
      "Die Transparenzluecke jetzt erfassen und die Einordnung offen lassen, bis Legal berichtet. Das erhaelt die Feststellung ohne Verstossbehauptung.",
      "Die Portalveroeffentlichung als Mitteilung behandeln, was die Position des Lieferanten ist und was der Vertragstext nicht klar stuetzt.",
      "Je abweichendem Knoten einen Sachverhalt eroeffnen, was praeziser ist und eine Frage in vier teilt.",
    ],
    evidenceIds: [...EV.tprmDecision],
    confidence: 58,
    uncertainty: [
      "Ob die Portalveroeffentlichung die Mitteilungspflicht erfuellt, ist eine Vertragsauslegung, die dieses System nicht treffen kann und nicht getroffen hat.",
      "Der Datenzugriffsumfang des Unterauftragnehmers wird vom Lieferanten im eigenen Register behauptet und wurde von Arcadia nicht verifiziert.",
      "Die Versionshistorie zeigt eine Veroeffentlichung im August 2026 und die vorige im September 2025, das Mitteilungsfenster ist daher nicht genau datierbar.",
    ],
    decisionRequired: true,
    grounding: grounding({
      records: [
        record(
          "Anhang A3 Version 4.2 vom 14.02.2025 ist die derzeit als verbindlich erfasste Unterauftragsliste, Ziffer 3.4 regelt die Mitteilung.",
          ["EVD-2026-41410"],
        ),
        record("Der Datenverarbeitungsanhang nennt vier Zielorte und nennt Indien nicht.", [
          "EVD-2026-41402",
        ]),
      ],
      statements: [
        stated(
          "Das Lieferantenregister Version 6.1 fuehrt den Service-Desk-Anbieter TP-0042.4 in Pune als aktiven Unterauftragnehmer.",
          ["EVD-2026-41405"],
        ),
      ],
      facts: [
        fact(
          "Im Vertragsarchiv liegt keine Unterauftragsmitteilung zu TP-0042.4, gesucht ueber den vollstaendigen Archivumfang.",
          ["EVD-2026-41235"],
        ),
      ],
      conflicts: [
        conflict(
          "Verbindlicher Anhang und Lieferantenregister nennen unterschiedliche Unterauftragsmengen fuer dieselbe Vereinbarung.",
          ["EVD-2026-41415", "EVD-2026-41410", "EVD-2026-41405"],
        ),
      ],
      inference: [
        inferred(
          "Das Abweichungsmuster, vier Knoten hinzugefuegt und keiner entfernt, passt eher zu einem Mitteilungsprozessfehler als zu einer Versionsstreitigkeit.",
          ["EVD-2026-41415"],
          0.55,
        ),
      ],
    }),
  },
};

const TPRM_EVENT: SeededSuggestion = {
  roleId: "tprm",
  beat: "shared-event",
  objectType: "supplier",
  objectId: "TP-0042",
  objectLabel: "Novalink Payment Services GmbH, live service degradation",
  atMoment: "14:05",
  decisionId: "DEC-2026-0779",
  priority: "critical",
  simulatedLatencyMs: 2_210,
  en: {
    headline: "Five of six mandatory notification fields are absent from the supplier's 14:05 notice",
    changeSummary:
      "Novalink service notification NSN-2026-0887 arrived at 14:05:12. Checked against appendix A5 version 2.0, it supplies the affected service and omits the five other mandatory fields: cause, scope by entity, expected duration, workaround and the named incident contact.",
    whyItMatters:
      "You are about to spend the afternoon reconstructing facts the contract already obliges the supplier to provide. That is a contractual performance failure that is independent of how the outage itself turns out, and it is best captured now, while the notice and the clause can be read side by side.",
    checksCompleted: [
      "Checked notification NSN-2026-0887 field by field against the mandatory content in appendix A5 version 2.0.",
      "Correlated the notice timestamp of 14:05:12 against the Arcadia monitoring alert ALRT-2026-77412 to establish which arrived first.",
      "Re-read the subprocessor register version 6.1 for any Frankfurt region dependency that would explain the scope.",
      "Confirmed that the binding appendix A3 version 4.2 names no Frankfurt hosting region beyond the one already recorded.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Activate enhanced monitoring on TP-0042 for the duration of the event, recording the notification content failure against appendix A5 as the trigger.",
    recommendedToolName: "activateMonitoring",
    alternatives: [
      "Wait for the supplier's first update before recording a notification failure, which is fairer to the supplier and loses the contemporaneous comparison.",
      "Record the notification failure as an observation on the existing reassessment rather than activating monitoring.",
      "Raise the content failure directly with the client service director on the incident bridge, which is faster and leaves no record.",
    ],
    evidenceIds: [...EV.tprmEvent],
    confidence: 74,
    uncertainty: [
      "Whether a fuller notice was sent to a different Arcadia mailbox has not been established. Only the supplier mailbox has been read.",
      "The cause stated later by the supplier may change the scope assessment, so the field comparison is of the 14:05 notice only.",
    ],
    decisionRequired: false,
    grounding: grounding({
      records: [
        record(
          "Appendix A5 version 2.0 sets six mandatory fields for a supplier incident notification.",
          ["EVD-2026-41420"],
        ),
        record(
          "Binding appendix A3 version 4.2 records the hosting subprocessor and its region as contractually notified.",
          ["EVD-2026-41410"],
        ),
      ],
      statements: [
        stated(
          "Notification NSN-2026-0887, received 14:05:12, names the affected service and states no cause, scope, duration, workaround or contact.",
          ["EVD-2026-41871"],
        ),
        stated("The supplier register version 6.1 lists the hosting regions the supplier claims.", [
          "EVD-2026-41405",
        ]),
      ],
      facts: [
        fact(
          "Arcadia monitoring raised alert ALRT-2026-77412 on acknowledgement latency independently of the supplier notice.",
          ["EVD-2026-41872"],
        ),
      ],
      inference: [
        inferred(
          "A notice this sparse is more consistent with a template dispatched on detection than with an assessment the supplier had completed.",
          ["EVD-2026-41871"],
          0.6,
        ),
      ],
    }),
  },
  de: {
    headline: "Fuenf von sechs Pflichtfeldern fehlen in der Lieferantenmeldung von 14:05",
    changeSummary:
      "Die Novalink-Servicemeldung NSN-2026-0887 ging um 14:05:12 ein. Gegen Anhang A5 Version 2.0 geprueft nennt sie den betroffenen Dienst und laesst die fuenf uebrigen Pflichtfelder offen: Ursache, Umfang je Einheit, erwartete Dauer, Behelfsloesung und benannter Vorfallkontakt.",
    whyItMatters:
      "Sie werden den Nachmittag damit verbringen, Fakten zu rekonstruieren, zu deren Lieferung der Vertrag den Lieferanten verpflichtet. Das ist ein vertragliches Leistungsdefizit unabhaengig vom Ausgang der Stoerung, und es laesst sich jetzt am besten erfassen, solange Meldung und Klausel nebeneinander lesbar sind.",
    checksCompleted: [
      "Die Meldung NSN-2026-0887 Feld fuer Feld gegen die Pflichtinhalte in Anhang A5 Version 2.0 geprueft.",
      "Den Meldungszeitstempel 14:05:12 gegen die Arcadia-Ueberwachungsmeldung ALRT-2026-77412 korreliert, um die Reihenfolge zu klaeren.",
      "Das Lieferantenregister Version 6.1 auf eine Abhaengigkeit in der Region Frankfurt geprueft, die den Umfang erklaeren wuerde.",
      "Bestaetigt, dass der verbindliche Anhang A3 Version 4.2 keine weitere Frankfurter Hosting-Region nennt.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Fuer die Dauer des Ereignisses eine verstaerkte Ueberwachung von TP-0042 aktivieren und das Inhaltsdefizit der Meldung gegen Anhang A5 als Ausloeser erfassen.",
    recommendedToolName: "activateMonitoring",
    alternatives: [
      "Die erste Aktualisierung des Lieferanten abwarten, bevor ein Meldedefizit erfasst wird. Das ist fairer und verliert den zeitnahen Vergleich.",
      "Das Meldedefizit als Beobachtung in der laufenden Neubewertung erfassen statt die Ueberwachung zu aktivieren.",
      "Das Inhaltsdefizit direkt in der Vorfallbruecke ansprechen, was schneller ist und keinen Datensatz hinterlaesst.",
    ],
    evidenceIds: [...EV.tprmEvent],
    confidence: 74,
    uncertainty: [
      "Ob eine vollstaendigere Meldung an ein anderes Postfach von Arcadia ging, ist nicht geklaert. Gelesen wurde nur das Lieferantenpostfach.",
      "Eine spaeter genannte Ursache kann die Umfangsbewertung aendern. Der Feldvergleich betrifft nur die Meldung von 14:05.",
    ],
    decisionRequired: false,
    grounding: grounding({
      records: [
        record("Anhang A5 Version 2.0 legt sechs Pflichtfelder fuer eine Vorfallmeldung fest.", [
          "EVD-2026-41420",
        ]),
        record(
          "Der verbindliche Anhang A3 Version 4.2 erfasst den Hosting-Unterauftragnehmer und seine Region als vertraglich mitgeteilt.",
          ["EVD-2026-41410"],
        ),
      ],
      statements: [
        stated(
          "Die Meldung NSN-2026-0887 von 14:05:12 nennt den betroffenen Dienst und keine Ursache, keinen Umfang, keine Dauer, keine Behelfsloesung und keinen Kontakt.",
          ["EVD-2026-41871"],
        ),
        stated("Das Lieferantenregister Version 6.1 nennt die vom Lieferanten behaupteten Regionen.", [
          "EVD-2026-41405",
        ]),
      ],
      facts: [
        fact(
          "Die Arcadia-Ueberwachung loeste die Meldung ALRT-2026-77412 zur Bestaetigungslatenz unabhaengig von der Lieferantenmeldung aus.",
          ["EVD-2026-41872"],
        ),
      ],
      inference: [
        inferred(
          "Eine so knappe Meldung passt eher zu einer bei Erkennung versendeten Vorlage als zu einer abgeschlossenen Bewertung des Lieferanten.",
          ["EVD-2026-41871"],
          0.6,
        ),
      ],
    }),
  },
};

/* ==========================================================================
   Operational Risk Partner, Marlene Aigner, Arcadia Bank AG
   ========================================================================== */

const RCSA_MORNING: SeededSuggestion = {
  roleId: "rcsa",
  beat: "morning",
  objectType: "risk",
  objectId: "RSK-0211",
  objectLabel: "Erroneous or unauthorised payment release, Payment Operations ARC-DE",
  atMoment: "07:45",
  decisionId: "DEC-2026-0771",
  priority: "high",
  simulatedLatencyMs: 2_870,
  en: {
    headline: "Three Red indicators on one process look like one causal chain, not three problems",
    changeSummary:
      "The September reporting run moved KRI-PAY-007 to Red at 3.84 overrides per ten thousand instructions released, with KRI-PAY-003 and KRI-PAY-011 also Red. Two pressure components moved. Three error components did not. The breach annex attributes most of the growth to route substitution.",
    whyItMatters:
      "Three indicators owned by three people will arrive at the workshop as three explanations, and each one will be locally reasonable. If the growth is route substitution driven by gateway availability, then the control question and the capacity question are downstream of one cause, and sequencing them separately will produce three partial answers.",
    checksCompleted: [
      "Read the September indicator pack and the KRI-PAY-007 breach annex, and separated the override population into its reason code components.",
      "Queried the payment hub for released instruction counts, to establish the denominator independently of the reported figure.",
      "Checked fallback clearing route usage for September, confirming five separate windows totalling 8 hours 40 minutes.",
      "Queried the loss and event register for entries mapped to this risk across 24 months, returning nil, and captured the query scope.",
      "Read the second line pre-read for the Q4 cycle and the first line control self-assessment on CTL-PAY-014.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Create one causal investigation action covering the three indicators together, owned by Payment Operations with the second line as reviewer, rather than three separate explanations.",
    recommendedToolName: "createAction",
    alternatives: [
      "Ask each indicator owner for a separate explanation, which is the standing process and will not test the common cause.",
      "Take the causal hypothesis to the workshop as an open question, which keeps ownership of the explanation with the first line.",
      "Investigate the reviewer capacity indicator first on its own, since it is the one with a recorded establishment figure.",
    ],
    evidenceIds: [...EV.rcsaMorning],
    confidence: 71,
    uncertainty: [
      "The attribution of override growth to fallback activation rests on temporal correlation across five September windows. The override records carry no linking field.",
      "A nil return from the loss register is a fact about the register, not about the risk. Zero recorded losses over 24 months is not evidence of control effectiveness.",
      "The gateway availability figure is measured at the Arcadia edge, not by the supplier, and the supplier has not published September.",
    ],
    decisionRequired: true,
    grounding: grounding({
      records: [
        record(
          "The September indicator pack records KRI-PAY-007, KRI-PAY-003 and KRI-PAY-011 as Red for Arcadia Bank AG.",
          ["EVD-2026-41820"],
        ),
        record(
          "The Q4 second line pre-read states the proposed rating for RSK-0211 and the evidence relied on.",
          ["EVD-2026-41200"],
        ),
      ],
      facts: [
        fact(
          "The KRI-PAY-007 breach annex decomposes the September override population by reason code and isolates route substitution as the largest moving component.",
          ["EVD-2026-41821"],
        ),
      ],
      statements: [
        stated(
          "The first line control self-assessment records CTL-PAY-014 as fully effective for the Q4 cycle.",
          ["EVD-2026-41855"],
        ),
      ],
      conflicts: [
        conflict(
          "Independent testing of CTL-PAY-014 recorded four exceptions and two items that could not be concluded, against a first line self-assessment of fully effective.",
          ["EVD-2026-41850", "EVD-2026-41855"],
        ),
      ],
      inference: [
        inferred(
          "The three indicators are more readily explained by one chain running from gateway availability through route substitution to override volume than by three independent causes.",
          ["EVD-2026-41821", "EVD-2026-41810"],
          0.65,
        ),
      ],
    }),
  },
  de: {
    headline: "Drei rote Indikatoren auf einem Prozess sehen nach einer Ursachenkette aus",
    changeSummary:
      "Der Septemberlauf setzte KRI-PAY-007 auf Rot bei 3,84 Ueberschreibungen je zehntausend freigegebener Auftraege, mit KRI-PAY-003 und KRI-PAY-011 ebenfalls auf Rot. Zwei Druckkomponenten haben sich bewegt. Drei Fehlerkomponenten nicht. Der Anhang weist den Zuwachs ueberwiegend der Routenumlenkung zu.",
    whyItMatters:
      "Drei Indikatoren mit drei Eigentuemern kommen als drei Erklaerungen in den Workshop, und jede wird lokal plausibel sein. Liegt der Zuwachs an der Routenumlenkung infolge der Gateway-Verfuegbarkeit, dann sind Kontrollfrage und Kapazitaetsfrage einer Ursache nachgelagert.",
    checksCompleted: [
      "Den Septemberindikatorbericht und den Anhang zur Ueberschreitung von KRI-PAY-007 gelesen und die Population nach Grundcodes getrennt.",
      "Den Zahlungs-Hub nach freigegebenen Auftragszahlen abgefragt, um den Nenner unabhaengig von der berichteten Zahl zu bestimmen.",
      "Die Nutzung der Ausweichroute im September geprueft, mit fuenf Fenstern von zusammen 8 Stunden 40 Minuten.",
      "Das Schaden- und Ereignisregister ueber 24 Monate nach Eintraegen zu diesem Risiko abgefragt, ohne Treffer, mit erfasstem Abfrageumfang.",
      "Die Vorlage der zweiten Linie fuer den Q4-Zyklus und die Selbstbewertung der ersten Linie zu CTL-PAY-014 gelesen.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Eine gemeinsame Ursachenuntersuchung fuer alle drei Indikatoren anlegen, verantwortet durch Payment Operations mit der zweiten Linie als Pruefer, statt dreier getrennter Erklaerungen.",
    recommendedToolName: "createAction",
    alternatives: [
      "Von jedem Indikatoreigentuemer eine eigene Erklaerung anfordern, was dem Standardprozess entspricht und die gemeinsame Ursache nicht prueft.",
      "Die Ursachenhypothese als offene Frage in den Workshop geben, womit die Erklaerung bei der ersten Linie bleibt.",
      "Zuerst den Kapazitaetsindikator allein untersuchen, da nur fuer ihn eine erfasste Sollbesetzung vorliegt.",
    ],
    evidenceIds: [...EV.rcsaMorning],
    confidence: 71,
    uncertainty: [
      "Die Zuordnung des Zuwachses zur Ausweichroute stuetzt sich auf zeitliche Korrelation ueber fuenf Fenster. Die Datensaetze tragen kein Verknuepfungsfeld.",
      "Ein Nulltreffer im Schadenregister ist eine Tatsache ueber das Register, nicht ueber das Risiko. Null Schaeden ueber 24 Monate belegen keine Kontrollwirksamkeit.",
      "Die Verfuegbarkeitszahl wird am Arcadia-Rand gemessen, nicht vom Lieferanten, und der Lieferant hat September nicht veroeffentlicht.",
    ],
    decisionRequired: true,
    grounding: grounding({
      records: [
        record(
          "Der Septemberindikatorbericht fuehrt KRI-PAY-007, KRI-PAY-003 und KRI-PAY-011 fuer die Arcadia Bank AG als rot.",
          ["EVD-2026-41820"],
        ),
        record(
          "Die Q4-Vorlage der zweiten Linie nennt die vorgeschlagene Bewertung fuer RSK-0211 und die herangezogenen Nachweise.",
          ["EVD-2026-41200"],
        ),
      ],
      facts: [
        fact(
          "Der Anhang zu KRI-PAY-007 zerlegt die Septemberpopulation nach Grundcodes und isoliert die Routenumlenkung als groesste bewegte Komponente.",
          ["EVD-2026-41821"],
        ),
      ],
      statements: [
        stated(
          "Die Selbstbewertung der ersten Linie fuehrt CTL-PAY-014 fuer den Q4-Zyklus als voll wirksam.",
          ["EVD-2026-41855"],
        ),
      ],
      conflicts: [
        conflict(
          "Die unabhaengige Pruefung von CTL-PAY-014 erfasste vier Ausnahmen und zwei nicht abschliessbare Positionen, gegen eine Selbstbewertung von voll wirksam.",
          ["EVD-2026-41850", "EVD-2026-41855"],
        ),
      ],
      inference: [
        inferred(
          "Die drei Indikatoren erklaeren sich eher durch eine Kette von Gateway-Verfuegbarkeit ueber Routenumlenkung zum Ueberschreibungsvolumen als durch drei unabhaengige Ursachen.",
          ["EVD-2026-41821", "EVD-2026-41810"],
          0.65,
        ),
      ],
    }),
  },
};

const RCSA_DECISION: SeededSuggestion = {
  roleId: "rcsa",
  beat: "decision",
  objectType: "control",
  objectId: "CTL-PAY-014",
  objectLabel: "Independent secondary review of manual payment overrides",
  atMoment: "11:45",
  decisionId: "DEC-2026-0772",
  priority: "high",
  simulatedLatencyMs: 3_120,
  en: {
    headline: "The deviation rate on CTL-PAY-014 is unknown rather than four in sixty",
    changeSummary:
      "The working paper schedule separates the six flagged items into four exceptions and two that could not be concluded. An item where evidence of operation cannot be obtained is not a conforming item, so the rate is four in fifty-eight at best and unknown at worst. The capacity report puts secondary reviewer establishment below plan.",
    whyItMatters:
      "The control environment rating feeds the residual position on RSK-0211, and the first line position rests on the four exception payments being confirmed correct afterwards. That is an outcome argument about a preventive control. A preventive control that did not operate has failed whether or not the payment was right.",
    checksCompleted: [
      "Reconstructed the attribute matrix from the working papers and recomputed both deviation rates against the tolerable rate.",
      "Separated the two items where evidence of operation could not be obtained from the four evidenced exceptions.",
      "Read the reviewer capacity report, which records the secondary reviewer establishment position as at 30.09.2026.",
      "Compared the Q3 signed assessment extract for RSK-0211 against the Q4 proposal, to isolate what actually changed.",
      "Queried the loss register for the same risk across 24 months, returning nil, and recorded that this is a fact about the register.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Propose a control effectiveness rating of partially effective for CTL-PAY-014, with the design deficiency and the operating deficiency stated separately and the two unconcludable items on the face of the proposal.",
    recommendedToolName: "proposeControlRating",
    alternatives: [
      "Hold the rating until the control assurance conclusion is recorded, which avoids two functions rating the same control differently on the same day.",
      "Rate the design deficiency only and leave operating effectiveness open pending the extended population.",
      "Accept the first line position for this cycle and record the second line challenge as a workshop item.",
    ],
    evidenceIds: [...EV.rcsaDecision],
    confidence: 55,
    uncertainty: [
      "The sample was random but not stratified by value or reason code, so a value stratified sample would produce a different exception profile.",
      "Whether the two unconcludable items are a retention failure or a review that never happened cannot be established from the records available.",
      "The capacity figure is a point in time establishment position and does not evidence what cover was in place on each exception date.",
    ],
    decisionRequired: true,
    grounding: grounding({
      records: [
        record(
          "Control test report TST-2026-0318 records four exceptions and two items that could not be concluded in a sample of sixty.",
          ["EVD-2026-41850"],
        ),
        record(
          "The Q3 2026 signed assessment extract records the prior rating and the evidence it rested on.",
          ["EVD-2026-41202"],
        ),
        record(
          "The secondary reviewer capacity report records the establishment position for the payment repair team.",
          ["EVD-2026-41822"],
        ),
      ],
      facts: [
        fact(
          "Working paper WP-07 lists the six flagged items by attribute, separating evidenced exceptions from unconcludable items.",
          ["EVD-2026-41852"],
        ),
        fact(
          "The loss and event register holds no entry mapped to RSK-0211 across the 24 month lookback.",
          ["EVD-2026-41250"],
        ),
      ],
      statements: [
        stated(
          "The control owner asserts that the four exception payments were subsequently confirmed correct by the client.",
          ["EVD-2026-41855"],
        ),
      ],
      inference: [
        inferred(
          "A control whose operation depends on reviewer availability, with establishment below plan, is more likely to carry a design weakness than an isolated lapse.",
          ["EVD-2026-41822", "EVD-2026-41852"],
          0.6,
        ),
      ],
    }),
  },
  de: {
    headline: "Die Abweichungsrate bei CTL-PAY-014 ist unbekannt, nicht vier von sechzig",
    changeSummary:
      "Das Arbeitspapier trennt die sechs markierten Positionen in vier Ausnahmen und zwei nicht abschliessbare. Eine Position ohne Nachweis der Durchfuehrung ist keine konforme Position. Die Rate ist damit bestenfalls vier von achtundfuenfzig und im schlechteren Fall unbekannt. Die Sollbesetzung der Zweitpruefer liegt unter Plan.",
    whyItMatters:
      "Die Bewertung des Kontrollumfelds geht in die Restrisikoposition zu RSK-0211 ein, und die Position der ersten Linie stuetzt sich darauf, dass die vier Zahlungen nachtraeglich als korrekt bestaetigt wurden. Das ist ein Ergebnisargument fuer eine praeventive Kontrolle. Eine praeventive Kontrolle, die nicht wirkte, ist gescheitert.",
    checksCompleted: [
      "Die Attributmatrix aus den Arbeitspapieren rekonstruiert und beide Abweichungsraten gegen die zulaessige Rate neu berechnet.",
      "Die zwei Positionen ohne Nachweis der Durchfuehrung von den vier belegten Ausnahmen getrennt.",
      "Den Kapazitaetsbericht zur Sollbesetzung der Zweitpruefer mit Stand 30.09.2026 gelesen.",
      "Den gezeichneten Q3-Auszug zu RSK-0211 gegen den Q4-Vorschlag verglichen, um die tatsaechliche Aenderung zu isolieren.",
      "Das Schadenregister ueber 24 Monate zum selben Risiko abgefragt, ohne Treffer, und erfasst, dass dies eine Tatsache ueber das Register ist.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Fuer CTL-PAY-014 eine Kontrollwirksamkeit von teilweise wirksam vorschlagen, mit getrennt genannter Konstruktions- und Durchfuehrungsschwaeche und den zwei nicht abschliessbaren Positionen im Vorschlag.",
    recommendedToolName: "proposeControlRating",
    alternatives: [
      "Die Bewertung zurueckhalten, bis die Pruefungsaussage erfasst ist. Das verhindert zwei abweichende Bewertungen derselben Kontrolle am selben Tag.",
      "Nur die Konstruktionsschwaeche bewerten und die Durchfuehrungswirksamkeit bis zur erweiterten Population offen lassen.",
      "Die Position der ersten Linie fuer diesen Zyklus uebernehmen und die Einwendung der zweiten Linie als Workshop-Punkt erfassen.",
    ],
    evidenceIds: [...EV.rcsaDecision],
    confidence: 55,
    uncertainty: [
      "Die Stichprobe war zufaellig, aber nicht nach Wert oder Grundcode geschichtet. Eine wertgeschichtete Stichprobe ergaebe ein anderes Ausnahmeprofil.",
      "Ob die zwei nicht abschliessbaren Positionen ein Aufbewahrungsproblem oder eine nie erfolgte Pruefung sind, laesst sich aus den Unterlagen nicht klaeren.",
      "Die Kapazitaetszahl ist eine Momentaufnahme und belegt nicht, welche Vertretung an den jeweiligen Ausnahmetagen bestand.",
    ],
    decisionRequired: true,
    grounding: grounding({
      records: [
        record(
          "Der Pruefbericht TST-2026-0318 erfasst vier Ausnahmen und zwei nicht abschliessbare Positionen in einer Stichprobe von sechzig.",
          ["EVD-2026-41850"],
        ),
        record(
          "Der gezeichnete Q3-Auszug 2026 erfasst die vorige Bewertung und die dafuer herangezogenen Nachweise.",
          ["EVD-2026-41202"],
        ),
        record(
          "Der Kapazitaetsbericht erfasst die Sollbesetzung der Zweitpruefer im Reparaturteam fuer Zahlungen.",
          ["EVD-2026-41822"],
        ),
      ],
      facts: [
        fact(
          "Arbeitspapier WP-07 fuehrt die sechs markierten Positionen nach Attribut und trennt belegte Ausnahmen von nicht abschliessbaren.",
          ["EVD-2026-41852"],
        ),
        fact(
          "Das Schaden- und Ereignisregister enthaelt im 24-Monats-Rueckblick keinen Eintrag zu RSK-0211.",
          ["EVD-2026-41250"],
        ),
      ],
      statements: [
        stated(
          "Der Kontrolleigentuemer behauptet, die vier Ausnahmezahlungen seien vom Kunden nachtraeglich als korrekt bestaetigt worden.",
          ["EVD-2026-41855"],
        ),
      ],
      inference: [
        inferred(
          "Eine Kontrolle, deren Durchfuehrung von der Prueferverfuegbarkeit abhaengt, bei unterbesetztem Soll, traegt eher eine Konstruktionsschwaeche als einen Einzelfall.",
          ["EVD-2026-41822", "EVD-2026-41852"],
          0.6,
        ),
      ],
    }),
  },
};

const RCSA_EVENT: SeededSuggestion = {
  roleId: "rcsa",
  beat: "shared-event",
  objectType: "risk",
  objectId: "RSK-0211",
  objectLabel: "Erroneous or unauthorised payment release, live event exposure",
  atMoment: "14:05",
  decisionId: "DEC-2026-0782",
  priority: "critical",
  simulatedLatencyMs: 2_340,
  en: {
    headline: "One afternoon has produced as many route substitution overrides as all of September",
    changeSummary:
      "The fallback clearing route activated at 14:12:41 under emergency change CHG-2026-7741. The override audit log query for 14:12 to 14:26 returns 138 route substitution overrides in fourteen minutes. The September total for the same reason code was of comparable size across the whole month.",
    whyItMatters:
      "The causal hypothesis you recorded this morning is being tested in front of you, and it is holding. That strengthens the control environment argument, and it also means the residual position you were preparing rests on a monthly rate that a single afternoon can now exceed.",
    checksCompleted: [
      "Read the configuration audit log entry recording the fallback route activation at 14:12:41 and the matching emergency change record.",
      "Queried the override audit log for the window 14:12 to 14:26 and counted the route substitution reason code.",
      "Compared the afternoon count against the September component analysis in the KRI-PAY-007 breach annex.",
      "Re-checked the gateway availability analysis to confirm that this activation follows the pattern of the five September windows.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Propose a revised residual risk position for RSK-0211 that states the rate exposure under fallback operation separately from the steady state rate, using the group matrix calculator for the arithmetic.",
    recommendedToolName: "proposeResidualRisk",
    alternatives: [
      "Keep the morning proposal unchanged and record the afternoon as corroborating evidence for the workshop, which avoids revising a position mid event.",
      "Initiate an off cycle reassessment of the Payment Operations assessment rather than revising one risk line.",
      "Hold until the event closes, so the override count is final rather than partial.",
    ],
    evidenceIds: [...EV.rcsaEvent],
    confidence: 68,
    uncertainty: [
      "The count covers 14:12 to 14:26 only. The event has not closed and the population is still growing.",
      "Whether these overrides received a secondary review cannot be established yet. The review timestamps are not populated for all of them.",
      "The comparison with September sets a fourteen minute window against a calendar month, so it indicates rate rather than volume.",
    ],
    decisionRequired: true,
    grounding: grounding({
      facts: [
        fact(
          "The configuration audit log records the fallback clearing route entering active mode at 14:12:41.",
          ["EVD-2026-41874"],
        ),
        fact(
          "Query QRY-2026-88104 returns 138 route substitution overrides raised between 14:12 and 14:26.",
          ["EVD-2026-41878"],
        ),
        fact(
          "The KRI-PAY-007 breach annex records the September route substitution component against which this afternoon is compared.",
          ["EVD-2026-41821"],
        ),
      ],
      records: [
        record(
          "Emergency change record CHG-2026-7741 authorises the fallback clearing route activation.",
          ["EVD-2026-41875"],
        ),
      ],
      inference: [
        inferred(
          "This afternoon is direct evidence for the link from fallback activation to route substitution growth that was inferential this morning.",
          ["EVD-2026-41874", "EVD-2026-41878", "EVD-2026-41810"],
          0.8,
        ),
      ],
    }),
  },
  de: {
    headline: "Ein Nachmittag hat so viele Routenumlenkungen erzeugt wie der ganze September",
    changeSummary:
      "Die Ausweichroute wurde um 14:12:41 unter der Notfallaenderung CHG-2026-7741 aktiviert. Die Abfrage des Ueberschreibungsprotokolls fuer 14:12 bis 14:26 liefert 138 Routenumlenkungen in vierzehn Minuten. Der Septemberwert zum selben Grundcode lag ueber den ganzen Monat in vergleichbarer Groesse.",
    whyItMatters:
      "Die Ursachenhypothese von heute Morgen wird vor Ihren Augen geprueft, und sie haelt. Das stuetzt das Argument zum Kontrollumfeld und bedeutet zugleich, dass die vorbereitete Restrisikoposition auf einer Monatsrate ruht, die ein einzelner Nachmittag uebersteigen kann.",
    checksCompleted: [
      "Den Eintrag im Konfigurationsprotokoll zur Aktivierung der Ausweichroute um 14:12:41 und die zugehoerige Notfallaenderung gelesen.",
      "Das Ueberschreibungsprotokoll fuer das Fenster 14:12 bis 14:26 abgefragt und den Grundcode Routenumlenkung gezaehlt.",
      "Den Nachmittagswert gegen die Septemberkomponentenanalyse im Anhang zu KRI-PAY-007 verglichen.",
      "Die Gateway-Verfuegbarkeitsanalyse erneut geprueft, um das Muster der fuenf Septemberfenster zu bestaetigen.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Eine revidierte Restrisikoposition fuer RSK-0211 vorschlagen, welche die Ratenexposition im Ausweichbetrieb getrennt von der Normalrate nennt, mit dem Gruppenrechner fuer die Arithmetik.",
    recommendedToolName: "proposeResidualRisk",
    alternatives: [
      "Den Morgenvorschlag unveraendert lassen und den Nachmittag als bestaetigenden Nachweis fuer den Workshop erfassen.",
      "Eine ausserplanmaessige Neubewertung der Bewertung Payment Operations einleiten statt eine Risikozeile zu revidieren.",
      "Bis zum Abschluss des Ereignisses warten, damit die Zaehlung endgueltig und nicht vorlaeufig ist.",
    ],
    evidenceIds: [...EV.rcsaEvent],
    confidence: 68,
    uncertainty: [
      "Die Zaehlung betrifft nur 14:12 bis 14:26. Das Ereignis ist nicht abgeschlossen und die Population waechst weiter.",
      "Ob diese Ueberschreibungen eine Zweitpruefung erhielten, ist noch nicht feststellbar. Die Pruefzeitstempel fehlen teilweise.",
      "Der Vergleich mit September stellt ein Vierzehnminutenfenster einem Kalendermonat gegenueber und zeigt damit die Rate, nicht das Volumen.",
    ],
    decisionRequired: true,
    grounding: grounding({
      facts: [
        fact(
          "Das Konfigurationsprotokoll erfasst den Wechsel der Ausweichroute in den Aktivmodus um 14:12:41.",
          ["EVD-2026-41874"],
        ),
        fact(
          "Die Abfrage QRY-2026-88104 liefert 138 zwischen 14:12 und 14:26 erzeugte Routenumlenkungen.",
          ["EVD-2026-41878"],
        ),
        fact(
          "Der Anhang zu KRI-PAY-007 erfasst die Septemberkomponente, gegen die dieser Nachmittag verglichen wird.",
          ["EVD-2026-41821"],
        ),
      ],
      records: [
        record("Die Notfallaenderung CHG-2026-7741 genehmigt die Aktivierung der Ausweichroute.", [
          "EVD-2026-41875",
        ]),
      ],
      inference: [
        inferred(
          "Dieser Nachmittag ist unmittelbarer Nachweis fuer die heute Morgen nur erschlossene Verbindung von Ausweichaktivierung zu Routenumlenkung.",
          ["EVD-2026-41874", "EVD-2026-41878", "EVD-2026-41810"],
          0.8,
        ),
      ],
    }),
  },
};

/* ==========================================================================
   Control Assurance Specialist, Jakob Steinbacher, Arcadia Bank Oesterreich
   ========================================================================== */

const CA_MORNING: SeededSuggestion = {
  roleId: "control-assurance",
  beat: "morning",
  objectType: "test-case",
  objectId: "OVR-DE-20260714-0112",
  objectLabel: "Self review exception in the CTL-PAY-014 sample, 14.07.2026",
  atMoment: "07:45",
  decisionId: "DEC-2026-0746",
  priority: "high",
  simulatedLatencyMs: 2_760,
  en: {
    headline: "The self review exception sits 17 days inside the window an open action was raised to close",
    changeSummary:
      "The exception on 14.07.2026 is a release and review by the same user. Audit finding F3 of September 2025 identified that exposure, change request NOVA-CR-4412 was delivered to close it, and the acceptance test for that change was requested and never scheduled. The exception falls 17 days before the action's revised due date.",
    whyItMatters:
      "Isolated or systemic is the judgment that decides whether this is one user's lapse or an access design failure that can recur without further intervention. The unanswered acceptance test request is the fact that moves it, because an undelivered control change is a cause that is still present.",
    checksCompleted: [
      "Reconstructed the attribute matrix from the working paper folders and separated evidenced exceptions from unconcludable items.",
      "Reconciled the self review exception against the open remediation action and dated it against the action's revised due date.",
      "Read audit finding F3 of September 2025 and the supplier delivery note for change request NOVA-CR-4412.",
      "Confirmed that the user acceptance test scheduling request for that change is recorded as unanswered.",
      "Read the first line control self-assessment, which records the control as fully effective for the same period.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Propose a systemic scope for this exception, on the basis that the access configuration change intended to prevent it was delivered without acceptance testing and the cause can therefore recur.",
    recommendedToolName: "proposeFinding",
    alternatives: [
      "Propose an indeterminate scope and request the RepairDesk tenant configuration before classifying, which is slower and better evidenced.",
      "Treat it as isolated on the basis of a single instance in sixty, which the sample size supports and the cause analysis does not.",
      "Split the judgment: record the exception as evidenced now and hold the scope classification for the findings clearance meeting.",
    ],
    evidenceIds: [...EV.caMorning],
    confidence: 76,
    uncertainty: [
      "The tenant configuration has not been obtained, so whether the segregation rule is enforced in the production tenant is asserted by the supplier and not verified.",
      "The sample was random but not stratified by value or reason code, so the exception profile is not representative by value.",
      "Whether the acceptance test was omitted deliberately or lost in the infrastructure freeze cannot be established from the records held.",
    ],
    decisionRequired: true,
    grounding: grounding({
      records: [
        record(
          "Audit finding F3 of September 2025 identifies the self review exposure in the override release path.",
          ["EVD-2026-41105"],
        ),
        record(
          "Control test report TST-2026-0318 records the sample, the attributes tested and the exception set.",
          ["EVD-2026-41850"],
        ),
        record(
          "Control description CTL-PAY-014 version 4.1 states the review conditions and is older than the policy review requirement.",
          ["EVD-2026-41908"],
        ),
      ],
      facts: [
        fact(
          "Working paper WP-07 records the self review exception with the release and review user identities and timestamps.",
          ["EVD-2026-41852"],
        ),
      ],
      statements: [
        stated(
          "The supplier delivery note asserts that change request NOVA-CR-4412 enforces role segregation in the override path.",
          ["EVD-2026-41102"],
        ),
        stated(
          "The control owner records the control as fully effective for the period under test.",
          ["EVD-2026-41855"],
        ),
      ],
      conflicts: [
        conflict(
          "A delivered change asserting enforced segregation and an evidenced self review in the same period cannot both describe the production configuration.",
          ["EVD-2026-41102", "EVD-2026-41852"],
        ),
      ],
      inference: [
        inferred(
          "An exception whose preventive change was delivered without acceptance testing has a cause that can recur, which is the test for systemic rather than isolated.",
          ["EVD-2026-41102", "EVD-2026-41205"],
          0.7,
        ),
      ],
    }),
  },
  de: {
    headline: "Die Selbstpruefungsausnahme liegt 17 Tage innerhalb des Fensters einer offenen Massnahme",
    changeSummary:
      "Die Ausnahme vom 14.07.2026 ist Freigabe und Pruefung durch denselben Nutzer. Die Pruefungsfeststellung F3 von September 2025 benannte diese Exposition, der Aenderungsauftrag NOVA-CR-4412 wurde zu ihrer Schliessung geliefert, und der Abnahmetest dazu wurde angefordert und nie terminiert.",
    whyItMatters:
      "Einzelfall oder systemisch ist die Beurteilung, die entscheidet, ob dies das Versehen eines Nutzers oder ein Fehler im Berechtigungsentwurf ist, der ohne weiteres Eingreifen wiederkehren kann. Die unbeantwortete Abnahmetestanfrage ist die Tatsache, die den Ausschlag gibt.",
    checksCompleted: [
      "Die Attributmatrix aus den Arbeitspapierordnern rekonstruiert und belegte Ausnahmen von nicht abschliessbaren Positionen getrennt.",
      "Die Selbstpruefungsausnahme gegen die offene Massnahme abgeglichen und gegen deren revidiertes Faelligkeitsdatum datiert.",
      "Die Pruefungsfeststellung F3 von September 2025 und die Liefernotiz zum Aenderungsauftrag NOVA-CR-4412 gelesen.",
      "Bestaetigt, dass die Terminanfrage fuer den Abnahmetest dieser Aenderung als unbeantwortet erfasst ist.",
      "Die Selbstbewertung der ersten Linie gelesen, welche die Kontrolle fuer denselben Zeitraum als voll wirksam fuehrt.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Fuer diese Ausnahme einen systemischen Umfang vorschlagen, da die zur Verhinderung bestimmte Berechtigungsaenderung ohne Abnahmetest geliefert wurde und die Ursache daher wiederkehren kann.",
    recommendedToolName: "proposeFinding",
    alternatives: [
      "Einen unbestimmten Umfang vorschlagen und vor der Einordnung die Mandantenkonfiguration anfordern, was langsamer und besser belegt ist.",
      "Sie als Einzelfall behandeln, gestuetzt auf eine Instanz in sechzig, was die Stichprobengroesse stuetzt und die Ursachenanalyse nicht.",
      "Die Beurteilung teilen: die Ausnahme jetzt als belegt erfassen und die Umfangseinordnung fuer die Klaerungsbesprechung zurueckhalten.",
    ],
    evidenceIds: [...EV.caMorning],
    confidence: 76,
    uncertainty: [
      "Die Mandantenkonfiguration liegt nicht vor. Ob die Trennungsregel im Produktionsmandanten greift, behauptet der Lieferant und ist nicht verifiziert.",
      "Die Stichprobe war zufaellig, aber nicht nach Wert oder Grundcode geschichtet. Das Ausnahmeprofil ist wertmaessig nicht repraesentativ.",
      "Ob der Abnahmetest bewusst entfiel oder im Infrastrukturstopp verloren ging, laesst sich aus den vorliegenden Unterlagen nicht klaeren.",
    ],
    decisionRequired: true,
    grounding: grounding({
      records: [
        record(
          "Die Pruefungsfeststellung F3 von September 2025 benennt die Selbstpruefungsexposition im Freigabepfad.",
          ["EVD-2026-41105"],
        ),
        record(
          "Der Pruefbericht TST-2026-0318 erfasst Stichprobe, gepruefte Attribute und Ausnahmemenge.",
          ["EVD-2026-41850"],
        ),
        record(
          "Die Kontrollbeschreibung CTL-PAY-014 Version 4.1 nennt die Pruefbedingungen und ist aelter als die Richtlinienvorgabe.",
          ["EVD-2026-41908"],
        ),
      ],
      facts: [
        fact(
          "Arbeitspapier WP-07 erfasst die Selbstpruefungsausnahme mit Freigabe- und Pruefidentitaet samt Zeitstempeln.",
          ["EVD-2026-41852"],
        ),
      ],
      statements: [
        stated(
          "Die Liefernotiz des Lieferanten behauptet, der Aenderungsauftrag NOVA-CR-4412 erzwinge die Rollentrennung im Freigabepfad.",
          ["EVD-2026-41102"],
        ),
        stated(
          "Der Kontrolleigentuemer fuehrt die Kontrolle fuer den Pruefzeitraum als voll wirksam.",
          ["EVD-2026-41855"],
        ),
      ],
      conflicts: [
        conflict(
          "Eine gelieferte Aenderung mit erzwungener Trennung und eine belegte Selbstpruefung im selben Zeitraum koennen nicht beide die Produktionskonfiguration beschreiben.",
          ["EVD-2026-41102", "EVD-2026-41852"],
        ),
      ],
      inference: [
        inferred(
          "Eine Ausnahme, deren verhindernde Aenderung ohne Abnahmetest geliefert wurde, hat eine wiederkehrfaehige Ursache. Das ist der Test fuer systemisch.",
          ["EVD-2026-41102", "EVD-2026-41205"],
          0.7,
        ),
      ],
    }),
  },
};

const CA_DECISION: SeededSuggestion = {
  roleId: "control-assurance",
  beat: "decision",
  objectType: "control-test",
  objectId: "TST-2026-0318",
  objectLabel: "Control test of CTL-PAY-014, design and operating effectiveness",
  atMoment: "11:45",
  decisionId: "DEC-2026-0760",
  priority: "high",
  simulatedLatencyMs: 3_040,
  en: {
    headline: "Two items that cannot be concluded make the operating effectiveness conclusion unavailable",
    changeSummary:
      "The attribute matrix is complete at sixty rows by five attributes. Four items fail an attribute and two cannot be concluded because evidence of operation cannot be obtained. The control description version 4.1 has not been reviewed since January 2025 and does not describe the system enforced conditions the first line relies on.",
    whyItMatters:
      "An item where evidence of operation cannot be obtained is recorded as unable to conclude. It is not a conforming item, and it counts against the conclusion on operating effectiveness rather than dropping out of the denominator. That is what makes the honest conclusion partially effective with a stated scope limitation rather than effective with a footnote.",
    checksCompleted: [
      "Recomputed the deviation rate on both bases, with and without the two unconcludable items in the denominator.",
      "Read the September override audit log extract to confirm that the monthly monitoring population is the same population the test sampled from.",
      "Compared control description version 4.1 against the first line position to identify which asserted condition is undocumented.",
      "Read the Q3 workshop minutes, which record the first line position on the same control before this test began.",
      "Re-read the findings clearance minutes to confirm which of the control owner's three assertions the evidence supports.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Record a design conclusion and an operating conclusion separately on TST-2026-0318, with operating effectiveness as partially effective and the two unconcludable items stated as a scope limitation on the face of the conclusion.",
    recommendedToolName: "recordTestConclusion",
    alternatives: [
      "Conclude on design only and keep the test open pending retrieval of the two missing evidence objects, which is the most defensible and delays the workshop.",
      "Conclude unable to conclude overall, which is accurate and gives the first line nothing to remediate against.",
      "Extend the sample before concluding, so the deviation rate rests on a larger population.",
    ],
    evidenceIds: [...EV.caDecision],
    confidence: 69,
    uncertainty: [
      "One of the two unconcludable items may be retrievable. A restoration request for the evidence object attached to the override of 21.08.2026 is outstanding.",
      "The control owner's response is recorded as disputed, and the dispute is on the systemic judgment rather than on the facts of the four exceptions.",
      "The test population excludes the afternoon of 06.10.2026, which is not yet in the monitoring extract.",
    ],
    decisionRequired: true,
    grounding: grounding({
      records: [
        record(
          "Control test report TST-2026-0318 records the sampling method, the rationale and the exception count.",
          ["EVD-2026-41850"],
        ),
        record(
          "Control description CTL-PAY-014 version 4.1 is the current description and has not been reviewed since 14.01.2025.",
          ["EVD-2026-41908"],
        ),
        record(
          "The Q3 workshop minutes record the first line position on this control before the test began.",
          ["EVD-2026-41250"],
        ),
      ],
      facts: [
        fact(
          "Working paper WP-07 is the exception and unable to conclude schedule, listing six flagged items by attribute.",
          ["EVD-2026-41852"],
        ),
        fact(
          "The September override audit log extract is the monthly monitoring population the sample was drawn from.",
          ["EVD-2026-41805"],
        ),
      ],
      statements: [
        stated(
          "The control owner asserts the control operated, that the exceptions are isolated, and that the payments were correct.",
          ["EVD-2026-41855"],
        ),
      ],
      inference: [
        inferred(
          "Excluding the unconcludable items from the denominator would understate the deviation rate, because absence of evidence of operation is the condition the control exists to prevent.",
          ["EVD-2026-41852"],
          0.75,
        ),
      ],
    }),
  },
  de: {
    headline: "Zwei nicht abschliessbare Positionen machen die Aussage zur Durchfuehrung unmoeglich",
    changeSummary:
      "Die Attributmatrix ist vollstaendig mit sechzig Zeilen und fuenf Attributen. Vier Positionen verfehlen ein Attribut, zwei sind nicht abschliessbar, weil kein Nachweis der Durchfuehrung erlangt werden kann. Die Kontrollbeschreibung Version 4.1 wurde seit Januar 2025 nicht geprueft.",
    whyItMatters:
      "Eine Position ohne erlangbaren Nachweis der Durchfuehrung wird als nicht abschliessbar erfasst. Sie ist keine konforme Position und zaehlt gegen die Aussage zur Durchfuehrungswirksamkeit, statt aus dem Nenner zu fallen. Das macht die ehrliche Aussage zu teilweise wirksam mit genannter Umfangsbeschraenkung.",
    checksCompleted: [
      "Die Abweichungsrate auf beiden Grundlagen neu berechnet, mit und ohne die zwei nicht abschliessbaren Positionen im Nenner.",
      "Den Septemberauszug des Ueberschreibungsprotokolls gelesen, um die Identitaet von Monitoringpopulation und Stichprobenbasis zu bestaetigen.",
      "Die Kontrollbeschreibung Version 4.1 gegen die Position der ersten Linie verglichen, um die undokumentierte Bedingung zu benennen.",
      "Das Protokoll des Q3-Workshops gelesen, das die Position der ersten Linie vor Beginn dieser Pruefung erfasst.",
      "Das Klaerungsprotokoll erneut gelesen, um zu bestimmen, welche der drei Behauptungen die Nachweise stuetzen.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Auf TST-2026-0318 Konstruktions- und Durchfuehrungsaussage getrennt erfassen, mit teilweise wirksam fuer die Durchfuehrung und den zwei nicht abschliessbaren Positionen als Umfangsbeschraenkung in der Aussage.",
    recommendedToolName: "recordTestConclusion",
    alternatives: [
      "Nur zur Konstruktion schliessen und die Pruefung bis zur Beschaffung der zwei fehlenden Nachweise offen halten. Am besten belegt, verzoegert den Workshop.",
      "Insgesamt nicht abschliessbar erfassen, was zutrifft und der ersten Linie keinen Ansatzpunkt zur Behebung gibt.",
      "Die Stichprobe vor dem Abschluss erweitern, damit die Abweichungsrate auf einer groesseren Population ruht.",
    ],
    evidenceIds: [...EV.caDecision],
    confidence: 69,
    uncertainty: [
      "Eine der zwei nicht abschliessbaren Positionen koennte beschaffbar sein. Eine Wiederherstellungsanfrage zum Nachweis der Ueberschreibung vom 21.08.2026 ist offen.",
      "Die Antwort des Kontrolleigentuemers ist als bestritten erfasst, und der Streit betrifft die systemische Beurteilung, nicht die Fakten der vier Ausnahmen.",
      "Die Pruefpopulation schliesst den Nachmittag des 06.10.2026 nicht ein, der noch nicht im Monitoringauszug steht.",
    ],
    decisionRequired: true,
    grounding: grounding({
      records: [
        record(
          "Der Pruefbericht TST-2026-0318 erfasst Stichprobenverfahren, Begruendung und Ausnahmezahl.",
          ["EVD-2026-41850"],
        ),
        record(
          "Die Kontrollbeschreibung CTL-PAY-014 Version 4.1 ist die aktuelle Beschreibung und wurde seit 14.01.2025 nicht geprueft.",
          ["EVD-2026-41908"],
        ),
        record(
          "Das Protokoll des Q3-Workshops erfasst die Position der ersten Linie vor Pruefbeginn.",
          ["EVD-2026-41250"],
        ),
      ],
      facts: [
        fact(
          "Arbeitspapier WP-07 ist die Aufstellung der Ausnahmen und nicht abschliessbaren Positionen, sechs markierte Positionen nach Attribut.",
          ["EVD-2026-41852"],
        ),
        fact(
          "Der Septemberauszug des Ueberschreibungsprotokolls ist die Monitoringpopulation, aus der die Stichprobe gezogen wurde.",
          ["EVD-2026-41805"],
        ),
      ],
      statements: [
        stated(
          "Der Kontrolleigentuemer behauptet, die Kontrolle habe gewirkt, die Ausnahmen seien Einzelfaelle und die Zahlungen korrekt.",
          ["EVD-2026-41855"],
        ),
      ],
      inference: [
        inferred(
          "Die nicht abschliessbaren Positionen aus dem Nenner zu nehmen wuerde die Abweichungsrate untertreiben, denn fehlender Nachweis ist gerade der zu verhindernde Zustand.",
          ["EVD-2026-41852"],
          0.75,
        ),
      ],
    }),
  },
};

const CA_EVENT: SeededSuggestion = {
  roleId: "control-assurance",
  beat: "shared-event",
  objectType: "control-test",
  objectId: "TST-2026-0318",
  objectLabel: "Control test of CTL-PAY-014, live population growth",
  atMoment: "14:05",
  decisionId: "DEC-2026-0764",
  priority: "critical",
  simulatedLatencyMs: 2_480,
  en: {
    headline: "Your test population is growing while you hold a conclusion on the version that closed",
    changeSummary:
      "The fallback route activated at 14:12:41 and the override audit log shows 138 route substitution overrides raised between 14:12 and 14:26, against a repair queue that rose across the same window. These sit outside the tested period and inside the same control.",
    whyItMatters:
      "A conclusion recorded now applies to a period that ended before this afternoon began, and a reader in three months will not make that distinction unless the conclusion states it. The second question is harder: whether to record a prediction about these overrides before the review timestamps exist.",
    checksCompleted: [
      "Read the configuration audit log entry for the fallback route activation and dated it precisely at 14:12:41.",
      "Queried the override audit log for 14:12 to 14:26 and counted 138 overrides under the route substitution reason code.",
      "Read the repair queue depth telemetry for the same window to confirm that the volume is event driven rather than reporting lag.",
      "Checked the September monitoring extract to confirm these overrides are not already inside the tested population.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Create a follow up action to extend the TST-2026-0318 population to the 06.10.2026 overrides once the review timestamps are available, and record the period boundary on the existing conclusion.",
    recommendedToolName: "createAction",
    alternatives: [
      "Record the conclusion on the tested period now with the boundary stated, and open a separate test for the event population.",
      "Hold the conclusion until the event population can be tested, which is cleaner and leaves the workshop without an input.",
      "Record a prediction about the event overrides with its basis stated, which is useful to the incident bridge and is not assurance.",
    ],
    evidenceIds: [...EV.caEvent],
    confidence: 61,
    uncertainty: [
      "The review timestamps for the 138 overrides are not populated, so whether any received a secondary review cannot be established.",
      "The population is still growing. Any count taken now is partial and will be superseded.",
      "A prediction recorded before the evidence arrives is a model inference, and it must not be read as a test result.",
    ],
    decisionRequired: true,
    grounding: grounding({
      facts: [
        fact(
          "The configuration audit log records the fallback clearing route entering active mode at 14:12:41.",
          ["EVD-2026-41874"],
        ),
        fact(
          "Query QRY-2026-88104 returns 138 route substitution overrides raised between 14:12 and 14:26.",
          ["EVD-2026-41878"],
        ),
        fact(
          "Repair queue telemetry records the queue depth across 14:12 to 14:26.",
          ["EVD-2026-41876"],
        ),
        fact(
          "The September override audit log extract defines the population the current test covers.",
          ["EVD-2026-41805"],
        ),
      ],
      records: [
        record(
          "Working paper WP-07 records the tested period and the exception schedule for the existing conclusion.",
          ["EVD-2026-41852"],
        ),
      ],
      inference: [
        inferred(
          "Given reviewer establishment below plan and a fourteen minute burst of this size, it is unlikely that every one of these overrides received an independent review.",
          ["EVD-2026-41878", "EVD-2026-41822"],
          0.55,
        ),
      ],
    }),
  },
  de: {
    headline: "Ihre Pruefpopulation waechst, waehrend Sie eine Aussage zum abgeschlossenen Zeitraum halten",
    changeSummary:
      "Die Ausweichroute wurde um 14:12:41 aktiviert, und das Ueberschreibungsprotokoll zeigt 138 Routenumlenkungen zwischen 14:12 und 14:26, bei gleichzeitig steigender Reparaturschlange. Diese liegen ausserhalb des geprueften Zeitraums und innerhalb derselben Kontrolle.",
    whyItMatters:
      "Eine jetzt erfasste Aussage betrifft einen Zeitraum, der vor diesem Nachmittag endete, und ein Leser in drei Monaten wird diese Unterscheidung nicht treffen, wenn die Aussage sie nicht nennt. Die zweite Frage ist schwerer: ob eine Prognose erfasst wird, bevor die Pruefzeitstempel existieren.",
    checksCompleted: [
      "Den Eintrag im Konfigurationsprotokoll zur Ausweichaktivierung gelesen und genau auf 14:12:41 datiert.",
      "Das Ueberschreibungsprotokoll fuer 14:12 bis 14:26 abgefragt und 138 Ueberschreibungen unter dem Grundcode Routenumlenkung gezaehlt.",
      "Die Telemetrie zur Reparaturschlange im selben Fenster gelesen, um ereignisbedingtes Volumen von Meldeverzug zu unterscheiden.",
      "Den Septembermonitoringauszug geprueft, um zu bestaetigen, dass diese Ueberschreibungen nicht in der geprueften Population liegen.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Eine Folgemassnahme anlegen, um die Population von TST-2026-0318 auf die Ueberschreibungen vom 06.10.2026 zu erweitern, sobald die Pruefzeitstempel vorliegen, und die Zeitraumgrenze in der Aussage erfassen.",
    recommendedToolName: "createAction",
    alternatives: [
      "Die Aussage zum geprueften Zeitraum jetzt mit genannter Grenze erfassen und eine eigene Pruefung fuer die Ereignispopulation eroeffnen.",
      "Die Aussage zurueckhalten, bis die Ereignispopulation pruefbar ist. Das ist sauberer und laesst den Workshop ohne Beitrag.",
      "Eine Prognose zu den Ereignisueberschreibungen mit genannter Grundlage erfassen, was der Vorfallbruecke nuetzt und keine Pruefungsaussage ist.",
    ],
    evidenceIds: [...EV.caEvent],
    confidence: 61,
    uncertainty: [
      "Die Pruefzeitstempel der 138 Ueberschreibungen fehlen. Ob eine davon eine Zweitpruefung erhielt, ist nicht feststellbar.",
      "Die Population waechst weiter. Jede jetzige Zaehlung ist vorlaeufig und wird ueberholt.",
      "Eine vor dem Nachweis erfasste Prognose ist eine Modellschlussfolgerung und darf nicht als Pruefergebnis gelesen werden.",
    ],
    decisionRequired: true,
    grounding: grounding({
      facts: [
        fact(
          "Das Konfigurationsprotokoll erfasst den Wechsel der Ausweichroute in den Aktivmodus um 14:12:41.",
          ["EVD-2026-41874"],
        ),
        fact(
          "Die Abfrage QRY-2026-88104 liefert 138 zwischen 14:12 und 14:26 erzeugte Routenumlenkungen.",
          ["EVD-2026-41878"],
        ),
        fact("Die Telemetrie erfasst die Tiefe der Reparaturschlange von 14:12 bis 14:26.", [
          "EVD-2026-41876",
        ]),
        fact(
          "Der Septemberauszug des Ueberschreibungsprotokolls definiert die von der laufenden Pruefung erfasste Population.",
          ["EVD-2026-41805"],
        ),
      ],
      records: [
        record(
          "Arbeitspapier WP-07 erfasst den geprueften Zeitraum und die Ausnahmeaufstellung der bestehenden Aussage.",
          ["EVD-2026-41852"],
        ),
      ],
      inference: [
        inferred(
          "Bei unterbesetztem Prueferbestand und einem Vierzehnminutenschub dieser Groesse ist es unwahrscheinlich, dass jede Ueberschreibung unabhaengig geprueft wurde.",
          ["EVD-2026-41878", "EVD-2026-41822"],
          0.55,
        ),
      ],
    }),
  },
};

/* ==========================================================================
   Incident and Resilience Lead, Nadia Lehmann, Arcadia Bank Schweiz AG

   This is the Swiss role, so it is the role where the jurisdiction rule is
   easiest to get wrong. Every regulatory sentence here names FINMA and the
   Swiss framework, and where the European Union instruments appear at all it
   is to say explicitly that they do not apply to this entity.
   ========================================================================== */

const IR_MORNING: SeededSuggestion = {
  roleId: "incident-resilience",
  beat: "morning",
  objectType: "service",
  objectId: "SVC-0042-05",
  objectLabel: "Swiss clearing connectivity adapter, SIC and euroSIC",
  atMoment: "07:45",
  decisionId: "DEC-2026-0749",
  priority: "high",
  simulatedLatencyMs: 2_910,
  en: {
    headline: "The Swiss clearing path has no fallback route and no recovery evidence for its instance",
    changeSummary:
      "The clearing adapter has no recorded fallback capability. The only recovery option is manual submission through a correspondent, and the runbook for it has a 45 minute preparation lead time, a review date of 14.01.2026 and no rehearsal record. The disaster recovery test evidence for the Swiss instance was requested and is recorded as missing.",
    whyItMatters:
      "Arcadia Bank Schweiz AG holds a 120 minute tolerance and a same day cut-off at 16:00, so a disruption that starts after 15:15 cannot be recovered manually in time. The exposure is not that the arrangement might fail. It is that there is no evidence it would work, which under the Swiss outsourcing and resilience framework is a finding rather than a gap. Illustrative regulatory context, not legal advice.",
    checksCompleted: [
      "Checked the Swiss clearing submission path for any recorded fallback capability, returning none.",
      "Read runbook RB-PAY-011 and computed a latest safe start of 15:15 against the 16:00 cut-off (scenario figures).",
      "Reconciled the Swiss tolerance record against the board committee minutes of 24.02.2026 and confirmed it states two measures with no precedence.",
      "Confirmed that the requested disaster recovery test evidence for the instance serving this entity is recorded as missing.",
      "Read the continuity exercise report, which records a desktop walkthrough rather than a live submission.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Raise an issue against SVC-0042-05 recording the absence of a tested recovery arrangement for the Swiss clearing path, with the missing instance evidence and the unrehearsed runbook as its two components.",
    recommendedToolName: "createIssue",
    alternatives: [
      "Request the instance evidence again before raising anything, which is proportionate and leaves the exposure unrecorded for another cycle.",
      "Raise the unrehearsed runbook as the single issue, which is narrower and omits the missing supplier evidence.",
      "Take the exposure to the resilience committee as a tolerance question rather than recording a control issue.",
    ],
    evidenceIds: [...EV.irMorning],
    confidence: 72,
    uncertainty: [
      "The disaster recovery test report covers the shared instance. It is also older than the policy freshness requirement, so it does not evidence the current position either.",
      "The 45 minute lead time is a documented figure with no rehearsal behind it, so the latest safe start is a calculation rather than a measurement.",
      "The Swiss tolerance records two measures and does not state which prevails, so whether a given outcome is inside it cannot be determined from the record.",
    ],
    decisionRequired: true,
    grounding: grounding({
      records: [
        record(
          "Runbook RB-PAY-011 version 2.2 states a 45 minute preparation lead time for manual correspondent submission and carries a review date of 14.01.2026.",
          ["EVD-2026-41710"],
        ),
        record(
          "The impact tolerance approvals for Corporate Payments record the Swiss tolerance and its two measures.",
          ["EVD-2026-41500"],
        ),
        record(
          "Process map PRC-0041 version 2.3 records the eleven controls mapped to the payment repair process.",
          ["EVD-2026-41700"],
        ),
        record(
          "The continuity exercise report records a desktop walkthrough of the manual correspondent route.",
          ["EVD-2026-41505"],
        ),
      ],
      statements: [
        stated(
          "The supplier's disaster recovery test report of 22.05.2026 covers the shared instance and makes no statement about the Swiss instance.",
          ["EVD-2026-40118"],
        ),
      ],
      conflicts: [
        conflict(
          "Runbook RB-PAY-007 asserts the control environment is unchanged during fallback operation, which the control inventory contradicts.",
          ["EVD-2026-41705", "EVD-2026-41700"],
        ),
      ],
      inference: [
        inferred(
          "A documented lead time with no rehearsal is more likely to understate the real preparation time than to overstate it, so 15:15 should be treated as the optimistic boundary.",
          ["EVD-2026-41710", "EVD-2026-41505"],
          0.6,
        ),
      ],
    }),
  },
  de: {
    headline: "Der Schweizer Clearingpfad hat keine Ausweichroute und keinen Wiederherstellungsnachweis",
    changeSummary:
      "Der Clearingadapter hat keine erfasste Ausweichfaehigkeit. Die einzige Wiederherstellungsoption ist die manuelle Einlieferung ueber einen Korrespondenten, und das zugehoerige Handbuch nennt 45 Minuten Vorlaufzeit, ein Pruefdatum vom 14.01.2026 und keinen Probendurchlauf. Der angeforderte Wiederherstellungsnachweis fuer die Schweizer Instanz ist als fehlend erfasst.",
    whyItMatters:
      "Die Arcadia Bank Schweiz AG haelt eine Toleranz von 120 Minuten und einen Tagesschluss um 16:00. Eine Stoerung ab 15:15 ist manuell nicht rechtzeitig behebbar. Die Exposition ist nicht, dass die Vorkehrung scheitern koennte, sondern dass kein Nachweis ihrer Wirksamkeit vorliegt. Das ist im Schweizer Rahmenwerk eine Feststellung. Illustrative regulatory context, not legal advice.",
    checksCompleted: [
      "Den Schweizer Einlieferungspfad auf eine erfasste Ausweichfaehigkeit geprueft, ohne Ergebnis.",
      "Das Handbuch RB-PAY-011 gelesen und einen spaetesten sicheren Start von 15:15 gegen den Schluss um 16:00 berechnet (Szenariowerte).",
      "Die Schweizer Toleranz gegen das Ausschussprotokoll vom 24.02.2026 abgeglichen und zwei Masse ohne Vorrangregel bestaetigt.",
      "Bestaetigt, dass der angeforderte Wiederherstellungsnachweis fuer die Instanz dieser Einheit als fehlend erfasst ist.",
      "Den Kontinuitaetsuebungsbericht gelesen, der eine Schreibtischuebung und keine echte Einlieferung erfasst.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Einen Sachverhalt zu SVC-0042-05 eroeffnen, der das Fehlen einer getesteten Wiederherstellungsvorkehrung erfasst, mit dem fehlenden Instanznachweis und dem ungeuebten Handbuch als zwei Bestandteilen.",
    recommendedToolName: "createIssue",
    alternatives: [
      "Den Instanznachweis erneut anfordern, bevor etwas eroeffnet wird. Angemessen, laesst die Exposition einen weiteren Zyklus unerfasst.",
      "Nur das ungeuebte Handbuch als Sachverhalt eroeffnen. Enger gefasst, laesst den fehlenden Lieferantennachweis aus.",
      "Die Exposition dem Resilienzausschuss als Toleranzfrage vorlegen statt einen Kontrollsachverhalt zu erfassen.",
    ],
    evidenceIds: [...EV.irMorning],
    confidence: 72,
    uncertainty: [
      "Der Wiederherstellungstestbericht betrifft die gemeinsame Instanz und ist zudem aelter als die Richtlinienvorgabe, belegt also auch den aktuellen Stand nicht.",
      "Die 45 Minuten sind eine dokumentierte Zahl ohne Probendurchlauf. Der spaeteste sichere Start ist daher eine Rechnung, keine Messung.",
      "Die Schweizer Toleranz nennt zwei Masse ohne Vorrang, daher ist aus dem Datensatz nicht bestimmbar, ob ein Ergebnis innerhalb liegt.",
    ],
    decisionRequired: true,
    grounding: grounding({
      records: [
        record(
          "Das Handbuch RB-PAY-011 Version 2.2 nennt 45 Minuten Vorlaufzeit fuer die manuelle Korrespondenteneinlieferung und ein Pruefdatum vom 14.01.2026.",
          ["EVD-2026-41710"],
        ),
        record(
          "Die Toleranzgenehmigungen fuer Corporate Payments erfassen die Schweizer Toleranz und ihre zwei Masse.",
          ["EVD-2026-41500"],
        ),
        record(
          "Die Prozesskarte PRC-0041 Version 2.3 erfasst die elf dem Reparaturprozess zugeordneten Kontrollen.",
          ["EVD-2026-41700"],
        ),
        record(
          "Der Kontinuitaetsuebungsbericht erfasst eine Schreibtischuebung der manuellen Korrespondentenroute.",
          ["EVD-2026-41505"],
        ),
      ],
      statements: [
        stated(
          "Der Wiederherstellungstestbericht des Lieferanten vom 22.05.2026 betrifft die gemeinsame Instanz und sagt zur Schweizer Instanz nichts.",
          ["EVD-2026-40118"],
        ),
      ],
      conflicts: [
        conflict(
          "Das Handbuch RB-PAY-007 behauptet ein unveraendertes Kontrollumfeld im Ausweichbetrieb, was das Kontrollverzeichnis widerlegt.",
          ["EVD-2026-41705", "EVD-2026-41700"],
        ),
      ],
      inference: [
        inferred(
          "Eine dokumentierte Vorlaufzeit ohne Probendurchlauf untertreibt die echte Vorbereitungszeit eher, daher ist 15:15 als optimistische Grenze zu lesen.",
          ["EVD-2026-41710", "EVD-2026-41505"],
          0.6,
        ),
      ],
    }),
  },
};

const IR_DECISION: SeededSuggestion = {
  roleId: "incident-resilience",
  beat: "decision",
  objectType: "runbook",
  objectId: "RB-PAY-007",
  objectLabel: "Runbook for clearing route substitution, version 3.1",
  atMoment: "11:45",
  decisionId: "DEC-2026-0761",
  priority: "high",
  simulatedLatencyMs: 2_820,
  en: {
    headline: "The runbook asserts the control environment is unchanged during fallback, and one control is not",
    changeSummary:
      "Runbook RB-PAY-007 version 3.1 states that the control environment is unchanged while the fallback clearing route is in use. Reconciled against all eleven controls mapped to the payment repair process, CTL-PAY-014 is conditional on system state, which contradicts the assertion. The September override log shows the volume effect that follows.",
    whyItMatters:
      "If this is a documentation error, the fix is a runbook revision. If it is a resilience finding, then every recovery decision taken on this runbook was taken on a false premise about what protection remains, and that includes the decisions taken during the five September activations.",
    checksCompleted: [
      "Reconciled the runbook assertion against all eleven controls mapped to process PRC-0041, one control at a time.",
      "Confirmed from the process map that CTL-PAY-014 operation is conditional on the clearing route state.",
      "Read the September override audit log extract to quantify the volume effect during fallback windows.",
      "Checked the first line self-assessment and the current control description to see whether either records the conditionality.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Draft the finding so the choice between documentation error and resilience finding can be made against written text, stating the eleven control reconciliation and the five September activations as its basis.",
    recommendedToolName: "draftFinding",
    alternatives: [
      "Request a runbook revision directly, which is faster and records no finding against the recovery arrangement.",
      "Raise it as an observation on the next exercise report, which keeps it with the resilience cycle and delays it by a quarter.",
      "Escalate it as a control issue to the control owner rather than as a resilience finding, which moves ownership and loses the recovery framing.",
    ],
    evidenceIds: [...EV.irDecision],
    confidence: 74,
    uncertainty: [
      "The contradiction is between two Arcadia documents, not between a document and an observed fact. The actual system configuration during fallback has not been verified.",
      "Whether the conditionality was known when the runbook was last reviewed cannot be established from the version history held.",
      "The control description is older than the policy review requirement, so the absence of the conditionality in it is weak evidence either way.",
    ],
    decisionRequired: true,
    grounding: grounding({
      records: [
        record(
          "Runbook RB-PAY-007 version 3.1 asserts that the control environment is unchanged during fallback operation.",
          ["EVD-2026-41705"],
        ),
        record(
          "Process map PRC-0041 version 2.3 records CTL-PAY-014 as conditional on the clearing route state.",
          ["EVD-2026-41700"],
        ),
        record(
          "Control description CTL-PAY-014 version 4.1 does not record the system state conditionality.",
          ["EVD-2026-41908"],
        ),
      ],
      facts: [
        fact(
          "The September override audit log extract records the override volume raised during the fallback windows.",
          ["EVD-2026-41805"],
        ),
      ],
      statements: [
        stated(
          "The first line self-assessment records the control as fully effective and does not mention the conditionality.",
          ["EVD-2026-41855"],
        ),
      ],
      conflicts: [
        conflict(
          "The runbook and the process map describe different control environments for the same operating state.",
          ["EVD-2026-41705", "EVD-2026-41700"],
        ),
      ],
      inference: [
        inferred(
          "A conditionality recorded in the process map and absent from both the runbook and the control description points to a maintenance failure across three documents rather than one error.",
          ["EVD-2026-41700", "EVD-2026-41908"],
          0.65,
        ),
      ],
    }),
  },
  de: {
    headline: "Das Handbuch behauptet ein unveraendertes Kontrollumfeld, und eine Kontrolle ist es nicht",
    changeSummary:
      "Das Handbuch RB-PAY-007 Version 3.1 nennt das Kontrollumfeld bei Nutzung der Ausweichroute unveraendert. Gegen alle elf dem Reparaturprozess zugeordneten Kontrollen abgeglichen ist CTL-PAY-014 vom Systemzustand abhaengig, was der Behauptung widerspricht. Das Septemberprotokoll zeigt den folgenden Volumeneffekt.",
    whyItMatters:
      "Ist dies ein Dokumentationsfehler, ist die Loesung eine Handbuchrevision. Ist es eine Resilienzfeststellung, dann wurde jede auf diesem Handbuch getroffene Wiederherstellungsentscheidung auf einer falschen Annahme zum verbleibenden Schutz getroffen, einschliesslich der fuenf Septemberaktivierungen.",
    checksCompleted: [
      "Die Handbuchbehauptung gegen alle elf dem Prozess PRC-0041 zugeordneten Kontrollen einzeln abgeglichen.",
      "Aus der Prozesskarte bestaetigt, dass die Durchfuehrung von CTL-PAY-014 vom Zustand der Clearingroute abhaengt.",
      "Den Septemberauszug des Ueberschreibungsprotokolls gelesen, um den Volumeneffekt in den Ausweichfenstern zu quantifizieren.",
      "Selbstbewertung und aktuelle Kontrollbeschreibung geprueft, ob eine von beiden die Abhaengigkeit erfasst.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Die Feststellung entwerfen, damit die Wahl zwischen Dokumentationsfehler und Resilienzfeststellung an geschriebenem Text getroffen werden kann, mit dem Abgleich der elf Kontrollen und den fuenf Aktivierungen als Grundlage.",
    recommendedToolName: "draftFinding",
    alternatives: [
      "Direkt eine Handbuchrevision anfordern. Schneller, erfasst keine Feststellung zur Wiederherstellungsvorkehrung.",
      "Als Beobachtung in den naechsten Uebungsbericht geben, womit sie im Resilienzzyklus bleibt und sich um ein Quartal verzoegert.",
      "Als Kontrollsachverhalt an den Kontrolleigentuemer eskalieren, was die Zustaendigkeit verschiebt und den Wiederherstellungsbezug verliert.",
    ],
    evidenceIds: [...EV.irDecision],
    confidence: 74,
    uncertainty: [
      "Der Widerspruch besteht zwischen zwei Arcadia-Dokumenten, nicht zwischen Dokument und Beobachtung. Die Systemkonfiguration im Ausweichbetrieb ist unverifiziert.",
      "Ob die Abhaengigkeit bei der letzten Handbuchpruefung bekannt war, laesst sich aus der vorliegenden Versionshistorie nicht klaeren.",
      "Die Kontrollbeschreibung ist aelter als die Richtlinienvorgabe, daher ist das Fehlen der Abhaengigkeit darin ein schwacher Beleg.",
    ],
    decisionRequired: true,
    grounding: grounding({
      records: [
        record(
          "Das Handbuch RB-PAY-007 Version 3.1 behauptet ein unveraendertes Kontrollumfeld im Ausweichbetrieb.",
          ["EVD-2026-41705"],
        ),
        record(
          "Die Prozesskarte PRC-0041 Version 2.3 fuehrt CTL-PAY-014 als abhaengig vom Zustand der Clearingroute.",
          ["EVD-2026-41700"],
        ),
        record(
          "Die Kontrollbeschreibung CTL-PAY-014 Version 4.1 erfasst die Abhaengigkeit vom Systemzustand nicht.",
          ["EVD-2026-41908"],
        ),
      ],
      facts: [
        fact(
          "Der Septemberauszug des Ueberschreibungsprotokolls erfasst das in den Ausweichfenstern erzeugte Volumen.",
          ["EVD-2026-41805"],
        ),
      ],
      statements: [
        stated(
          "Die Selbstbewertung der ersten Linie fuehrt die Kontrolle als voll wirksam und erwaehnt die Abhaengigkeit nicht.",
          ["EVD-2026-41855"],
        ),
      ],
      conflicts: [
        conflict(
          "Handbuch und Prozesskarte beschreiben unterschiedliche Kontrollumfelder fuer denselben Betriebszustand.",
          ["EVD-2026-41705", "EVD-2026-41700"],
        ),
      ],
      inference: [
        inferred(
          "Eine in der Prozesskarte erfasste und in Handbuch und Kontrollbeschreibung fehlende Abhaengigkeit deutet auf ein Pflegeversaeumnis ueber drei Dokumente hin.",
          ["EVD-2026-41700", "EVD-2026-41908"],
          0.65,
        ),
      ],
    }),
  },
};

const IR_EVENT: SeededSuggestion = {
  roleId: "incident-resilience",
  beat: "shared-event",
  objectType: "incident",
  objectId: "INC-2026-0412",
  objectLabel: "Novalink regional service degradation, live incident",
  atMoment: "14:05",
  decisionId: "DEC-2026-0765",
  priority: "critical",
  simulatedLatencyMs: 2_150,
  en: {
    headline: "The Swiss lane has no fallback, so its clock is the one that matters this afternoon",
    changeSummary:
      "Supplier notification NSN-2026-0887 arrived at 14:05:12 without a cause, a scope or a duration. The fallback clearing route activated at 14:12:41 under emergency change CHG-2026-7741, which covers the German and Austrian submission path. The Swiss clearing adapter has no equivalent route.",
    whyItMatters:
      "Arcadia Bank Schweiz AG holds a 120 minute tolerance and a 16:00 same day cut-off, and the only Swiss recovery option needs 45 minutes of preparation. That puts the latest safe start at about 15:15, so the Swiss decision has a deadline that the German and Austrian lanes do not. Supervisory expectations for this entity follow the Swiss framework under FINMA. Illustrative regulatory context, not legal advice.",
    checksCompleted: [
      "Read supplier notification NSN-2026-0887 and recorded which of the mandatory fields it supplies.",
      "Read the configuration audit log and the emergency change record covering the fallback activation at 14:12:41.",
      "Recomputed headroom against the Swiss tolerance from the activation time, using the tolerance calculator rather than an estimate.",
      "Re-read runbook RB-PAY-011 to confirm the 45 minute preparation lead time and the resulting latest safe start.",
      "Queried the override audit log for 14:12 to 14:26 to establish the control exposure that follows fallback operation.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Propose an incident severity and classification for INC-2026-0412 that treats the Swiss position as a separate lane with its own deadline, with the two Swiss tolerance measures stated separately because the record sets no precedence.",
    recommendedToolName: "proposeIncidentClassification",
    alternatives: [
      "Classify on the group position and handle the Swiss deadline as an action inside the incident, which is simpler and buries the binding constraint.",
      "Hold the classification until the supplier states a restoration estimate, which is better evidenced and passes 15:15 while waiting.",
      "Classify on the German and Austrian impact now and open a second incident record for the Swiss entity.",
    ],
    evidenceIds: [...EV.irEvent],
    confidence: 67,
    uncertainty: [
      "The supplier has stated no cause and no restoration estimate, so the duration input to every tolerance calculation is an assumption.",
      "The Swiss tolerance states two measures and no precedence, so a minutes based answer and a cut-off based answer can disagree and both be defensible.",
      "The 45 minute preparation lead time has never been rehearsed, so 15:15 is the optimistic boundary rather than the expected one.",
      "Whether the overrides raised during fallback received a secondary review is not yet established.",
    ],
    decisionRequired: true,
    grounding: grounding({
      facts: [
        fact(
          "The configuration audit log records the fallback clearing route entering active mode at 14:12:41.",
          ["EVD-2026-41874"],
        ),
        fact(
          "Query QRY-2026-88104 returns 138 route substitution overrides raised between 14:12 and 14:26.",
          ["EVD-2026-41878"],
        ),
      ],
      records: [
        record(
          "Emergency change record CHG-2026-7741 authorises the fallback clearing route activation for the German and Austrian submission path.",
          ["EVD-2026-41875"],
        ),
        record(
          "The impact tolerance approvals record the Swiss tolerance as 120 minutes with a completion measure against the 16:00 cut-off.",
          ["EVD-2026-41500"],
        ),
        record(
          "Runbook RB-PAY-011 version 2.2 states a 45 minute preparation lead time for manual correspondent submission.",
          ["EVD-2026-41710"],
        ),
      ],
      statements: [
        stated(
          "Notification NSN-2026-0887, received 14:05:12, names the affected service and states no cause, scope or duration.",
          ["EVD-2026-41871"],
        ),
      ],
      inference: [
        inferred(
          "With no Swiss fallback route and a 45 minute preparation requirement, the latest safe start for manual submission is about 15:15 against a 16:00 cut-off.",
          ["EVD-2026-41710", "EVD-2026-41500"],
          0.7,
        ),
      ],
    }),
  },
  de: {
    headline: "Die Schweizer Spur hat keine Ausweichroute, ihre Uhr ist daher die entscheidende",
    changeSummary:
      "Die Lieferantenmeldung NSN-2026-0887 ging um 14:05:12 ohne Ursache, Umfang und Dauer ein. Die Ausweichroute wurde um 14:12:41 unter der Notfallaenderung CHG-2026-7741 aktiviert, die den deutschen und oesterreichischen Einlieferungspfad abdeckt. Der Schweizer Clearingadapter hat keine entsprechende Route.",
    whyItMatters:
      "Die Arcadia Bank Schweiz AG haelt eine Toleranz von 120 Minuten und einen Tagesschluss um 16:00, und die einzige Schweizer Option braucht 45 Minuten Vorbereitung. Der spaeteste sichere Start liegt damit bei etwa 15:15. Die aufsichtsrechtlichen Erwartungen fuer diese Einheit folgen dem Schweizer Rahmenwerk unter FINMA. Illustrative regulatory context, not legal advice.",
    checksCompleted: [
      "Die Lieferantenmeldung NSN-2026-0887 gelesen und erfasst, welche Pflichtfelder sie liefert.",
      "Das Konfigurationsprotokoll und die Notfallaenderung zur Ausweichaktivierung um 14:12:41 gelesen.",
      "Den Spielraum gegen die Schweizer Toleranz ab Aktivierungszeit mit dem Toleranzrechner neu berechnet, nicht geschaetzt.",
      "Das Handbuch RB-PAY-011 erneut gelesen, um die 45 Minuten Vorlaufzeit und den spaetesten sicheren Start zu bestaetigen.",
      "Das Ueberschreibungsprotokoll fuer 14:12 bis 14:26 abgefragt, um die Kontrollexposition im Ausweichbetrieb zu bestimmen.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Fuer INC-2026-0412 eine Schwere und Klassifizierung vorschlagen, welche die Schweizer Position als eigene Spur mit eigener Frist behandelt und die zwei Schweizer Toleranzmasse getrennt nennt, da der Datensatz keinen Vorrang setzt.",
    recommendedToolName: "proposeIncidentClassification",
    alternatives: [
      "Auf der Gruppenposition klassifizieren und die Schweizer Frist als Massnahme im Vorfall fuehren. Einfacher, verdeckt die bindende Beschraenkung.",
      "Die Klassifizierung bis zu einer Wiederherstellungsschaetzung des Lieferanten zurueckhalten. Besser belegt, ueberschreitet dabei 15:15.",
      "Jetzt auf der deutschen und oesterreichischen Wirkung klassifizieren und fuer die Schweizer Einheit einen zweiten Vorfall eroeffnen.",
    ],
    evidenceIds: [...EV.irEvent],
    confidence: 67,
    uncertainty: [
      "Der Lieferant hat keine Ursache und keine Wiederherstellungsschaetzung genannt. Die Dauer in jeder Toleranzrechnung ist daher eine Annahme.",
      "Die Schweizer Toleranz nennt zwei Masse ohne Vorrang. Eine minutenbasierte und eine schlussbasierte Antwort koennen abweichen und beide vertretbar sein.",
      "Die 45 Minuten Vorlaufzeit wurde nie geuebt, daher ist 15:15 die optimistische und nicht die erwartete Grenze.",
      "Ob die im Ausweichbetrieb erzeugten Ueberschreibungen eine Zweitpruefung erhielten, ist noch nicht geklaert.",
    ],
    decisionRequired: true,
    grounding: grounding({
      facts: [
        fact(
          "Das Konfigurationsprotokoll erfasst den Wechsel der Ausweichroute in den Aktivmodus um 14:12:41.",
          ["EVD-2026-41874"],
        ),
        fact(
          "Die Abfrage QRY-2026-88104 liefert 138 zwischen 14:12 und 14:26 erzeugte Routenumlenkungen.",
          ["EVD-2026-41878"],
        ),
      ],
      records: [
        record(
          "Die Notfallaenderung CHG-2026-7741 genehmigt die Ausweichaktivierung fuer den deutschen und oesterreichischen Einlieferungspfad.",
          ["EVD-2026-41875"],
        ),
        record(
          "Die Toleranzgenehmigungen erfassen die Schweizer Toleranz mit 120 Minuten und einem Abschlussmass gegen den Schluss um 16:00.",
          ["EVD-2026-41500"],
        ),
        record(
          "Das Handbuch RB-PAY-011 Version 2.2 nennt 45 Minuten Vorlaufzeit fuer die manuelle Korrespondenteneinlieferung.",
          ["EVD-2026-41710"],
        ),
      ],
      statements: [
        stated(
          "Die Meldung NSN-2026-0887 von 14:05:12 nennt den betroffenen Dienst und keine Ursache, keinen Umfang und keine Dauer.",
          ["EVD-2026-41871"],
        ),
      ],
      inference: [
        inferred(
          "Ohne Schweizer Ausweichroute und mit 45 Minuten Vorbereitungsbedarf liegt der spaeteste sichere Start bei etwa 15:15 gegen einen Schluss um 16:00.",
          ["EVD-2026-41710", "EVD-2026-41500"],
          0.7,
        ),
      ],
    }),
  },
};

/* ==========================================================================
   Regulatory Change Manager, Tobias Reinhardt, Arcadia Bank AG
   ========================================================================== */

const REG_MORNING: SeededSuggestion = {
  roleId: "regulatory-change",
  beat: "morning",
  objectType: "subprocessor",
  objectId: "TP-0042.4",
  objectLabel: "Meridian Operations Support, service desk provider in Pune",
  atMoment: "07:45",
  decisionId: "DEC-2026-0752",
  priority: "high",
  simulatedLatencyMs: 3_010,
  en: {
    headline: "The same subprocessor raises two different questions in the two regulatory lanes",
    changeSummary:
      "The service desk provider appears in the supplier register and in the domain 4 questionnaire response, and in neither the binding appendix nor the data processing appendix. Reconciled into the two lanes separately, it is a subcontracting chain question for the German and Austrian entities and an inventory and data access question for the Swiss entity. The two determinations share no fields.",
    whyItMatters:
      "Treating this as one applicability question would produce one answer that is wrong in at least one lane. The European Union requirements on the ICT subcontracting chain apply to the German and Austrian credit institutions. For Arcadia Bank Schweiz AG the relevant question arises under the Swiss outsourcing and data access framework instead, and the European Union instrument does not apply to that entity. Illustrative regulatory context, not legal advice.",
    checksCompleted: [
      "Reconciled the subprocessor into both lanes separately and confirmed that the two determinations share no fields.",
      "Searched the contract repository for the transfer destinations named in the data processing appendix, returning Switzerland, Germany, the Czech Republic and Ireland, and no reference to India.",
      "Decomposed the Tier 1 register completeness figure into its terminal states and localised the shortfall to the subcontracting chain fields.",
      "Reconciled the Swiss outsourcing inventory filed 24.07.2026 against the current supplier service list.",
      "Read the draft internal tolerance standard to check whether it bears on this determination, and recorded that it does not.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Propose per entity applicability for the subcontracting chain obligation, with a separate Swiss determination under the Swiss framework and the rationale recorded against each entity rather than against the group.",
    recommendedToolName: "proposeObligationApplicability",
    alternatives: [
      "Record one group level determination and note the Swiss difference as a caveat, which is faster and is the error the register already contains.",
      "Defer both determinations until the supplier confirms the data access scope, which is better evidenced and leaves the register incomplete.",
      "Determine the German and Austrian lane now and open the Swiss question as a separate regulatory change item.",
    ],
    evidenceIds: [...EV.regMorning],
    confidence: 64,
    uncertainty: [
      "The subprocessor's data access scope is stated by the supplier in its own register and has not been verified by Arcadia. The Swiss determination depends on it.",
      "Whether the absence from the data processing appendix is a transfer that was never assessed or a notice that was never filed cannot be established from the documents held.",
      "The register completeness figure is a percentage of records and conceals which fields are incomplete, so the figure alone cannot locate the gap (scenario figures).",
    ],
    decisionRequired: true,
    grounding: grounding({
      records: [
        record(
          "The European Union regulatory reference digest records the ICT subcontracting chain requirements applicable to the German and Austrian entities.",
          ["EVD-2026-41300"],
        ),
        record(
          "The Swiss outsourcing inventory status note records the filed inventory and the data access review scope for significant outsourcings.",
          ["EVD-2026-41305"],
        ),
        record(
          "The data processing appendix names four transfer destinations and does not name India.",
          ["EVD-2026-41402"],
        ),
      ],
      statements: [
        stated(
          "The supplier register version 6.1 lists the service desk provider in Pune and states the data access it claims.",
          ["EVD-2026-41405"],
        ),
      ],
      facts: [
        fact(
          "The draft internal tolerance standard is at consultation stage and is silent on precedence between tolerance measures.",
          ["EVD-2026-41310"],
        ),
      ],
      inference: [
        inferred(
          "A subprocessor present in the supplier register and absent from both appendices is more consistent with a notice process failure than with a disputed scope.",
          ["EVD-2026-41405", "EVD-2026-41402"],
          0.6,
        ),
      ],
    }),
  },
  de: {
    headline: "Derselbe Unterauftragnehmer stellt in den zwei Rechtsspuren zwei verschiedene Fragen",
    changeSummary:
      "Der Service-Desk-Anbieter erscheint im Lieferantenregister und in der Fragebogenantwort zu Domaene 4, und weder im verbindlichen Anhang noch im Datenverarbeitungsanhang. Getrennt in beide Spuren abgeglichen ist er eine Frage der Unterauftragskette fuer die deutsche und oesterreichische Einheit und eine Inventar- und Datenzugriffsfrage fuer die Schweizer Einheit.",
    whyItMatters:
      "Dies als eine Frage zu behandeln ergaebe eine Antwort, die in mindestens einer Spur falsch ist. Die Anforderungen der Europaeischen Union zur IKT-Unterauftragskette gelten fuer die deutschen und oesterreichischen Kreditinstitute. Fuer die Arcadia Bank Schweiz AG stellt sich die Frage im Schweizer Rahmenwerk, und das Instrument der Europaeischen Union gilt nicht fuer diese Einheit. Illustrative regulatory context, not legal advice.",
    checksCompleted: [
      "Den Unterauftragnehmer getrennt in beide Spuren abgeglichen und bestaetigt, dass die zwei Bestimmungen keine Felder teilen.",
      "Das Vertragsarchiv nach den im Datenverarbeitungsanhang genannten Zielorten durchsucht, mit Schweiz, Deutschland, Tschechien und Irland und ohne Bezug auf Indien.",
      "Die Vollstaendigkeitszahl des Tier-1-Registers in ihre Endzustaende zerlegt und den Rueckstand auf die Felder der Unterauftragskette lokalisiert.",
      "Das am 24.07.2026 eingereichte Schweizer Auslagerungsinventar gegen die aktuelle Dienstleistungsliste abgeglichen.",
      "Den Entwurf des internen Toleranzstandards geprueft, ob er diese Bestimmung beruehrt, und erfasst, dass er es nicht tut.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Die Anwendbarkeit der Unterauftragskettenpflicht je Einheit vorschlagen, mit eigener Schweizer Bestimmung im Schweizer Rahmenwerk und je Einheit erfasster Begruendung statt einer Gruppenbegruendung.",
    recommendedToolName: "proposeObligationApplicability",
    alternatives: [
      "Eine Bestimmung auf Gruppenebene erfassen und die Schweizer Abweichung als Vorbehalt notieren. Schneller, und genau der Fehler, den das Register enthaelt.",
      "Beide Bestimmungen bis zur Bestaetigung des Datenzugriffsumfangs zurueckstellen. Besser belegt, laesst das Register unvollstaendig.",
      "Die deutsche und oesterreichische Spur jetzt bestimmen und die Schweizer Frage als eigenes Aenderungsvorhaben eroeffnen.",
    ],
    evidenceIds: [...EV.regMorning],
    confidence: 64,
    uncertainty: [
      "Der Datenzugriffsumfang wird vom Lieferanten im eigenen Register behauptet und ist von Arcadia unverifiziert. Die Schweizer Bestimmung haengt davon ab.",
      "Ob das Fehlen im Datenverarbeitungsanhang eine nie bewertete Uebermittlung oder eine nie eingereichte Mitteilung ist, laesst sich nicht klaeren.",
      "Die Vollstaendigkeitszahl ist ein Anteil an Datensaetzen und verdeckt, welche Felder unvollstaendig sind (Szenariowerte).",
    ],
    decisionRequired: true,
    grounding: grounding({
      records: [
        record(
          "Der regulatorische Referenzauszug der Europaeischen Union erfasst die fuer die deutsche und oesterreichische Einheit geltenden Anforderungen zur IKT-Unterauftragskette.",
          ["EVD-2026-41300"],
        ),
        record(
          "Die Statusnotiz zum Schweizer Auslagerungsinventar erfasst das eingereichte Inventar und den Pruefumfang zum Datenzugriff.",
          ["EVD-2026-41305"],
        ),
        record(
          "Der Datenverarbeitungsanhang nennt vier Zielorte und nennt Indien nicht.",
          ["EVD-2026-41402"],
        ),
      ],
      statements: [
        stated(
          "Das Lieferantenregister Version 6.1 fuehrt den Service-Desk-Anbieter in Pune und nennt den behaupteten Datenzugriff.",
          ["EVD-2026-41405"],
        ),
      ],
      facts: [
        fact(
          "Der Entwurf des internen Toleranzstandards ist im Konsultationsstand und schweigt zum Vorrang zwischen Toleranzmassen.",
          ["EVD-2026-41310"],
        ),
      ],
      inference: [
        inferred(
          "Ein im Lieferantenregister vorhandener und in beiden Anhaengen fehlender Unterauftragnehmer passt eher zu einem Mitteilungsversaeumnis als zu einem Umfangsstreit.",
          ["EVD-2026-41405", "EVD-2026-41402"],
          0.6,
        ),
      ],
    }),
  },
};

const REG_DECISION: SeededSuggestion = {
  roleId: "regulatory-change",
  beat: "decision",
  objectType: "obligation",
  objectId: "OBL-2026-0088-002",
  objectLabel: "Swiss outsourcing inventory and data access review for significant outsourcings",
  atMoment: "11:45",
  decisionId: "DEC-2026-0762",
  priority: "high",
  simulatedLatencyMs: 2_880,
  en: {
    headline: "One subprocessor is absent from the Swiss inventory, and the scope definition decides why",
    changeSummary:
      "The Swiss outsourcing inventory filed 24.07.2026 records two significant outsourcings correctly. One subprocessor is absent. Whether that is a filing deficiency or a scope definition question depends on whether a subprocessor with this data access falls inside the definition the inventory uses, and the inventory does not state its own boundary.",
    whyItMatters:
      "A filing deficiency is remediated by amending the inventory. A scope definition question is remediated by deciding the boundary and then amending everything filed under the old one. Naming it wrongly produces an amendment that leaves the next filing in the same position. Illustrative regulatory context, not legal advice.",
    checksCompleted: [
      "Reconciled the filed Swiss inventory against the current supplier service list, item by item.",
      "Read the inventory status note to establish which definition of significant outsourcing the filing used.",
      "Checked the supplier register entry for the absent subprocessor and the data access it claims.",
      "Compared the binding appendix and the data processing appendix to establish whether Arcadia records the arrangement at all.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Record the interpretation as a scope definition question, with the inventory boundary stated explicitly and the subprocessor listed as a consequence of that boundary rather than as an omission.",
    recommendedToolName: "recordObligationInterpretation",
    alternatives: [
      "Record it as a filing deficiency and amend the inventory, which is faster and leaves the boundary undefined for the next filing.",
      "Hold the interpretation until the supplier confirms the data access scope, which is better evidenced and delays the filing correction.",
      "Record both: a deficiency for this filing and a separate scope question for the standing definition.",
    ],
    evidenceIds: [...EV.regDecision],
    confidence: 62,
    uncertainty: [
      "The data access scope is a supplier statement and has not been verified, and the Swiss determination turns on it.",
      "The inventory does not state the boundary it applied, so the question of whether this is an omission cannot be answered from the filing alone.",
      "Whether the previous filing applied the same boundary cannot be established from the version held.",
    ],
    decisionRequired: true,
    grounding: grounding({
      records: [
        record(
          "The Swiss inventory status note records the filing of 24.07.2026 and the two significant outsourcings it covers.",
          ["EVD-2026-41305"],
        ),
        record(
          "The binding subprocessor appendix version 4.2 does not name the absent subprocessor.",
          ["EVD-2026-41410"],
        ),
        record(
          "The data processing appendix names four transfer destinations and does not name India.",
          ["EVD-2026-41402"],
        ),
        record(
          "The European Union regulatory reference digest records the requirements that apply to the German and Austrian entities and not to this one.",
          ["EVD-2026-41300"],
        ),
      ],
      statements: [
        stated(
          "The supplier register version 6.1 lists the subprocessor and states the data access it claims.",
          ["EVD-2026-41405"],
        ),
      ],
      inference: [
        inferred(
          "An inventory that records two arrangements correctly and omits a third is more consistent with a boundary that excludes the third than with a clerical omission.",
          ["EVD-2026-41305", "EVD-2026-41405"],
          0.55,
        ),
      ],
    }),
  },
  de: {
    headline: "Ein Unterauftragnehmer fehlt im Schweizer Inventar, und die Umfangsdefinition entscheidet warum",
    changeSummary:
      "Das am 24.07.2026 eingereichte Schweizer Auslagerungsinventar erfasst zwei wesentliche Auslagerungen korrekt. Ein Unterauftragnehmer fehlt. Ob dies ein Einreichungsmangel oder eine Umfangsfrage ist, haengt davon ab, ob ein Unterauftragnehmer mit diesem Datenzugriff in die verwendete Definition faellt, und das Inventar nennt seine Grenze nicht.",
    whyItMatters:
      "Ein Einreichungsmangel wird durch Aenderung des Inventars behoben. Eine Umfangsfrage wird behoben, indem die Grenze bestimmt und dann alles unter der alten Grenze Eingereichte geaendert wird. Eine falsche Benennung erzeugt eine Aenderung, die die naechste Einreichung in derselben Lage laesst. Illustrative regulatory context, not legal advice.",
    checksCompleted: [
      "Das eingereichte Schweizer Inventar Position fuer Position gegen die aktuelle Dienstleistungsliste abgeglichen.",
      "Die Statusnotiz gelesen, um die bei der Einreichung verwendete Definition wesentlicher Auslagerung zu bestimmen.",
      "Den Registereintrag des fehlenden Unterauftragnehmers und den behaupteten Datenzugriff geprueft.",
      "Verbindlichen Anhang und Datenverarbeitungsanhang verglichen, um festzustellen, ob Arcadia die Vereinbarung ueberhaupt erfasst.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Die Auslegung als Umfangsfrage erfassen, mit ausdruecklich genannter Inventargrenze und dem Unterauftragnehmer als Folge dieser Grenze statt als Auslassung.",
    recommendedToolName: "recordObligationInterpretation",
    alternatives: [
      "Als Einreichungsmangel erfassen und das Inventar aendern. Schneller, laesst die Grenze fuer die naechste Einreichung undefiniert.",
      "Die Auslegung bis zur Bestaetigung des Datenzugriffsumfangs zurueckhalten. Besser belegt, verzoegert die Korrektur.",
      "Beides erfassen: einen Mangel fuer diese Einreichung und eine eigene Umfangsfrage fuer die geltende Definition.",
    ],
    evidenceIds: [...EV.regDecision],
    confidence: 62,
    uncertainty: [
      "Der Datenzugriffsumfang ist eine Lieferantenaussage und unverifiziert, und die Schweizer Bestimmung haengt davon ab.",
      "Das Inventar nennt die angewandte Grenze nicht, daher ist aus der Einreichung allein nicht zu beantworten, ob eine Auslassung vorliegt.",
      "Ob die vorige Einreichung dieselbe Grenze anwandte, laesst sich aus der vorliegenden Version nicht klaeren.",
    ],
    decisionRequired: true,
    grounding: grounding({
      records: [
        record(
          "Die Statusnotiz erfasst die Einreichung vom 24.07.2026 und die zwei darin erfassten wesentlichen Auslagerungen.",
          ["EVD-2026-41305"],
        ),
        record(
          "Der verbindliche Unterauftragsanhang Version 4.2 nennt den fehlenden Unterauftragnehmer nicht.",
          ["EVD-2026-41410"],
        ),
        record("Der Datenverarbeitungsanhang nennt vier Zielorte und nennt Indien nicht.", [
          "EVD-2026-41402",
        ]),
        record(
          "Der Referenzauszug der Europaeischen Union erfasst die Anforderungen, die fuer die deutsche und oesterreichische Einheit gelten und fuer diese nicht anwendbar sind.",
          ["EVD-2026-41300"],
        ),
      ],
      statements: [
        stated(
          "Das Lieferantenregister Version 6.1 fuehrt den Unterauftragnehmer und nennt den behaupteten Datenzugriff.",
          ["EVD-2026-41405"],
        ),
      ],
      inference: [
        inferred(
          "Ein Inventar, das zwei Vereinbarungen korrekt erfasst und eine dritte auslaesst, passt eher zu einer ausschliessenden Grenze als zu einem Schreibfehler.",
          ["EVD-2026-41305", "EVD-2026-41405"],
          0.55,
        ),
      ],
    }),
  },
};

const REG_EVENT: SeededSuggestion = {
  roleId: "regulatory-change",
  beat: "shared-event",
  objectType: "obligation",
  objectId: "OBL-2026-0117-001",
  objectLabel: "Incident classification and reporting, two assessment tracks",
  atMoment: "14:05",
  decisionId: "DEC-2026-0787",
  priority: "critical",
  simulatedLatencyMs: 2_270,
  en: {
    headline: "Two classification structures have opened with no shared fields, before either assessor asks",
    changeSummary:
      "The supplier notification at 14:05:12 supplies one of the six fields appendix A5 requires. Two assessment tracks are now live on the same facts: a major incident assessment for the German and Austrian entities, and a separate Swiss assessment for Arcadia Bank Schweiz AG under its own framework. The two tracks share no fields.",
    whyItMatters:
      "Within an hour two colleagues will each be filling in a classification form, and they will reach for the same facts. If the tracks are not kept apart from the start, one set of thresholds will be applied to the wrong entity, which is the error the group standard was implemented in April 2026 to prevent. Illustrative regulatory context, not legal advice.",
    checksCompleted: [
      "Checked the supplier notification against the six mandatory fields in appendix A5 version 2.0.",
      "Opened the two assessment tracks separately from the group incident standard and confirmed they share no fields.",
      "Confirmed from the binding appendix which hosting arrangements are contractually recorded for the affected regions.",
      "Re-read the supplier register to identify which claimed regions bear on the Swiss lane specifically.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Propose per entity applicability for the incident reporting obligation now, so the European Union thresholds are recorded against the German and Austrian entities and the Swiss assessment is opened under the Swiss framework.",
    recommendedToolName: "proposeObligationApplicability",
    alternatives: [
      "Wait for the incident lead to request the applicability analysis, which respects their ownership and arrives after the forms are started.",
      "Record a single group determination with per entity notes, which is quicker and is the structure the standard replaced.",
      "Open only the European Union track now, since the Swiss facts are not yet established.",
    ],
    evidenceIds: [...EV.regEvent],
    confidence: 58,
    uncertainty: [
      "No cause and no duration have been stated by the supplier, and both assessment tracks need them before any threshold can be applied.",
      "Whether the Swiss entity is materially affected is not yet established, so the Swiss track is opened on the possibility rather than on a fact.",
      "The applicability determination is for a named accountable person to interpret. What is proposed here is the structure, not the conclusion.",
    ],
    decisionRequired: true,
    grounding: grounding({
      records: [
        record(
          "Appendix A5 version 2.0 sets the six mandatory fields for a supplier incident notification.",
          ["EVD-2026-41420"],
        ),
        record(
          "The group incident classification and reporting standard, implemented 30.04.2026, defines two separate assessment tracks.",
          ["EVD-2026-41315"],
        ),
        record(
          "The binding subprocessor appendix version 4.2 records the contractually notified hosting arrangements.",
          ["EVD-2026-41410"],
        ),
      ],
      statements: [
        stated(
          "Notification NSN-2026-0887, received 14:05:12, supplies the affected service and no other mandatory field.",
          ["EVD-2026-41871"],
        ),
        stated(
          "The supplier register version 6.1 states the regions the supplier claims for each subprocessor.",
          ["EVD-2026-41405"],
        ),
      ],
      inference: [
        inferred(
          "Opening both tracks before either assessor asks is the only way to stop one set of thresholds being applied across entities with different frameworks.",
          ["EVD-2026-41315"],
          0.7,
        ),
      ],
    }),
  },
  de: {
    headline: "Zwei Klassifizierungsstrukturen sind offen, ohne gemeinsame Felder, vor der ersten Anfrage",
    changeSummary:
      "Die Lieferantenmeldung um 14:05:12 liefert eines der sechs von Anhang A5 verlangten Felder. Zwei Bewertungsspuren laufen nun auf denselben Fakten: eine Bewertung als bedeutender Vorfall fuer die deutsche und oesterreichische Einheit und eine eigene Schweizer Bewertung fuer die Arcadia Bank Schweiz AG im eigenen Rahmenwerk. Die Spuren teilen keine Felder.",
    whyItMatters:
      "Innerhalb einer Stunde werden zwei Kollegen je ein Klassifizierungsformular ausfuellen und auf dieselben Fakten zugreifen. Bleiben die Spuren nicht von Anfang an getrennt, wird ein Schwellenwertsatz auf die falsche Einheit angewandt. Genau dies sollte der im April 2026 eingefuehrte Gruppenstandard verhindern. Illustrative regulatory context, not legal advice.",
    checksCompleted: [
      "Die Lieferantenmeldung gegen die sechs Pflichtfelder in Anhang A5 Version 2.0 geprueft.",
      "Die zwei Bewertungsspuren getrennt aus dem Gruppenstandard eroeffnet und bestaetigt, dass sie keine Felder teilen.",
      "Aus dem verbindlichen Anhang bestaetigt, welche Hosting-Vereinbarungen fuer die betroffenen Regionen vertraglich erfasst sind.",
      "Das Lieferantenregister erneut gelesen, um die fuer die Schweizer Spur relevanten behaupteten Regionen zu bestimmen.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Die Anwendbarkeit der Meldepflicht jetzt je Einheit vorschlagen, damit die Schwellenwerte der Europaeischen Union fuer die deutsche und oesterreichische Einheit erfasst werden und die Schweizer Bewertung im Schweizer Rahmenwerk eroeffnet wird.",
    recommendedToolName: "proposeObligationApplicability",
    alternatives: [
      "Auf die Anfrage der Vorfallleitung warten. Das respektiert deren Zustaendigkeit und kommt nach dem Beginn der Formulare.",
      "Eine Gruppenbestimmung mit Anmerkungen je Einheit erfassen. Schneller, und genau die vom Standard ersetzte Struktur.",
      "Nur die Spur der Europaeischen Union eroeffnen, da die Schweizer Fakten noch nicht feststehen.",
    ],
    evidenceIds: [...EV.regEvent],
    confidence: 58,
    uncertainty: [
      "Der Lieferant hat keine Ursache und keine Dauer genannt, und beide Bewertungsspuren brauchen beides vor jeder Schwellenwertanwendung.",
      "Ob die Schweizer Einheit wesentlich betroffen ist, steht nicht fest. Die Schweizer Spur wird auf der Moeglichkeit eroeffnet, nicht auf einer Tatsache.",
      "Die Anwendbarkeitsbestimmung ist von einer benannten verantwortlichen Person auszulegen. Vorgeschlagen wird die Struktur, nicht das Ergebnis.",
    ],
    decisionRequired: true,
    grounding: grounding({
      records: [
        record(
          "Anhang A5 Version 2.0 legt die sechs Pflichtfelder einer Lieferantenvorfallmeldung fest.",
          ["EVD-2026-41420"],
        ),
        record(
          "Der am 30.04.2026 eingefuehrte Gruppenstandard zur Vorfallklassifizierung und Meldung definiert zwei getrennte Bewertungsspuren.",
          ["EVD-2026-41315"],
        ),
        record(
          "Der verbindliche Unterauftragsanhang Version 4.2 erfasst die vertraglich mitgeteilten Hosting-Vereinbarungen.",
          ["EVD-2026-41410"],
        ),
      ],
      statements: [
        stated(
          "Die Meldung NSN-2026-0887 von 14:05:12 liefert den betroffenen Dienst und kein weiteres Pflichtfeld.",
          ["EVD-2026-41871"],
        ),
        stated(
          "Das Lieferantenregister Version 6.1 nennt die vom Lieferanten je Unterauftragnehmer behaupteten Regionen.",
          ["EVD-2026-41405"],
        ),
      ],
      inference: [
        inferred(
          "Beide Spuren vor der ersten Anfrage zu eroeffnen ist der einzige Weg, die Anwendung eines Schwellenwertsatzes auf Einheiten mit verschiedenen Rahmenwerken zu verhindern.",
          ["EVD-2026-41315"],
          0.7,
        ),
      ],
    }),
  },
};

/* ==========================================================================
   NFR Portfolio Lead, Dr. Katharina Vogt, Arcadia Bank AG
   ========================================================================== */

const GOV_MORNING: SeededSuggestion = {
  roleId: "nfr-governance",
  beat: "morning",
  objectType: "theme",
  objectId: "THEME-PAY-01",
  objectLabel: "Manual payment overrides released without secondary review",
  atMoment: "07:45",
  decisionId: "DEC-2026-0755",
  priority: "high",
  simulatedLatencyMs: 3_180,
  en: {
    headline: "Four Red rows owned by four people are one causal chain with seven nodes",
    changeSummary:
      "The September reporting run returns four Red group indicators, each with a different owner in a different function. Assembled into a chain they run from gateway availability through route substitution, the override rate breach, reviewer establishment, the control rating and the overdue remediation to the residual position. Four links are evidenced from records. Two are inferences.",
    whyItMatters:
      "The committee on 13.10.2026 will otherwise receive this matter six times from six functions, and each report will be individually correct and collectively useless. Consolidating it into one thread is the point, and the two inferential links are exactly the parts that must stay labelled as inference when you do.",
    checksCompleted: [
      "Retrieved the September reporting run and confirmed that four of six group indicators are Red with four different owners.",
      "Assembled the seven node causal chain across four functions, with four links evidenced from records and two marked as inference.",
      "Aged the overdue remediation action at 67 days past its revised due date and verified its dependency chain end to end.",
      "Parsed the conditional risk acceptance on RSK-0184 into two structured conditions and found the exit test not started.",
      "Checked the loss and event register for any entry connected to the four Red indicators, returning nil.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Draft the consolidated committee narrative for this theme as one thread with six named function lenses, keeping the two inferential links labelled and each function's own professional question intact.",
    recommendedToolName: "draftCommitteeNarrative",
    alternatives: [
      "Table the four indicators separately as the standing process does, which preserves each owner's framing and reproduces the duplication.",
      "Consolidate only the three indicators with recorded causal links and leave the fourth as a separate item.",
      "Hold the consolidation until the control assurance conclusion is recorded, so the chain rests on a concluded rating.",
    ],
    evidenceIds: [...EV.govMorning],
    confidence: 65,
    uncertainty: [
      "Two of the chain's links are inferential rather than recorded: fallback activation to override growth, and reviewer establishment to deviation frequency.",
      "A nil return from the loss register is a fact about the register, not about the risks. It is not evidence that the exposure is immaterial.",
      "The substitutability assessment relied on for the exit condition is older than the policy freshness requirement.",
      "Consolidation is a presentational judgment. Whether the committee should receive one thread or four items is the portfolio lead's decision.",
    ],
    decisionRequired: true,
    grounding: grounding({
      records: [
        record(
          "The September indicator pack records four of six group indicators as Red, each with a different owner.",
          ["EVD-2026-41820"],
        ),
        record(
          "The conditional risk acceptance for RSK-0184 records two conditions and their status.",
          ["EVD-2026-41204"],
        ),
        record(
          "Audit finding F3 of September 2025 is the origin of the open remediation action.",
          ["EVD-2026-41105"],
        ),
        record(
          "The substitutability assessment for TP-0042 is older than the policy freshness requirement.",
          ["EVD-2026-41440"],
        ),
      ],
      facts: [
        fact(
          "The KRI-PAY-007 breach annex decomposes the override population and isolates the moving component.",
          ["EVD-2026-41821"],
        ),
      ],
      statements: [
        stated(
          "The remediation action update as at 30.09.2026 states progress and the dependency the owner relies on.",
          ["EVD-2026-41280"],
        ),
      ],
      inference: [
        inferred(
          "The four indicators are more readily explained as one chain with a single upstream cause than as four independent portfolio items.",
          ["EVD-2026-41821", "EVD-2026-41820"],
          0.6,
        ),
        inferred(
          "The link from reviewer establishment to deviation frequency has no recorded evidence and rests on the coincidence of the capacity position with the exception dates.",
          ["EVD-2026-41820"],
          0.45,
        ),
      ],
    }),
  },
  de: {
    headline: "Vier rote Zeilen mit vier Eigentuemern sind eine Ursachenkette mit sieben Knoten",
    changeSummary:
      "Der Septemberlauf liefert vier rote Gruppenindikatoren, jeder mit anderem Eigentuemer in anderer Funktion. Als Kette laufen sie von der Gateway-Verfuegbarkeit ueber Routenumlenkung, die Ueberschreitung der Ueberschreibungsrate, die Prueferbesetzung, die Kontrollbewertung und die ueberfaellige Massnahme zur Restrisikoposition. Vier Glieder sind belegt, zwei erschlossen.",
    whyItMatters:
      "Der Ausschuss am 13.10.2026 erhaelt diesen Sachverhalt sonst sechsmal aus sechs Funktionen, und jeder Bericht wird einzeln richtig und gemeinsam nutzlos sein. Die Zusammenfuehrung zu einem Strang ist der Zweck, und die zwei erschlossenen Glieder sind genau die Teile, die dabei als Schlussfolgerung gekennzeichnet bleiben muessen.",
    checksCompleted: [
      "Den Septemberlauf abgerufen und bestaetigt, dass vier von sechs Gruppenindikatoren rot sind, mit vier verschiedenen Eigentuemern.",
      "Die siebengliedrige Ursachenkette ueber vier Funktionen zusammengesetzt, mit vier belegten und zwei als Schlussfolgerung gekennzeichneten Gliedern.",
      "Die ueberfaellige Massnahme auf 67 Tage nach revidierter Faelligkeit datiert und ihre Abhaengigkeitskette vollstaendig geprueft.",
      "Die bedingte Risikoannahme zu RSK-0184 in zwei strukturierte Bedingungen zerlegt und den Ausstiegstest als nicht begonnen vorgefunden.",
      "Das Schaden- und Ereignisregister auf Eintraege zu den vier roten Indikatoren geprueft, ohne Treffer.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Die konsolidierte Ausschussdarstellung zu diesem Thema als einen Strang mit sechs benannten Funktionsperspektiven entwerfen, mit gekennzeichneten erschlossenen Gliedern und erhaltener Fachfrage je Funktion.",
    recommendedToolName: "draftCommitteeNarrative",
    alternatives: [
      "Die vier Indikatoren wie im Standardprozess getrennt vorlegen. Das erhaelt die Sicht jedes Eigentuemers und wiederholt die Doppelung.",
      "Nur die drei Indikatoren mit belegten Ursachengliedern konsolidieren und den vierten als eigenen Punkt fuehren.",
      "Die Konsolidierung bis zur erfassten Pruefungsaussage zurueckhalten, damit die Kette auf einer abgeschlossenen Bewertung ruht.",
    ],
    evidenceIds: [...EV.govMorning],
    confidence: 65,
    uncertainty: [
      "Zwei Glieder der Kette sind erschlossen statt belegt: Ausweichaktivierung zu Ueberschreibungszuwachs und Prueferbesetzung zu Abweichungshaeufigkeit.",
      "Ein Nulltreffer im Schadenregister ist eine Tatsache ueber das Register, nicht ueber die Risiken, und kein Beleg fuer Unwesentlichkeit.",
      "Die fuer die Ausstiegsbedingung herangezogene Substituierbarkeitsbewertung ist aelter als die Richtlinienvorgabe.",
      "Die Konsolidierung ist eine Darstellungsfrage. Ob der Ausschuss einen Strang oder vier Punkte erhaelt, entscheidet die Portfolioleitung.",
    ],
    decisionRequired: true,
    grounding: grounding({
      records: [
        record(
          "Der Septemberindikatorbericht fuehrt vier von sechs Gruppenindikatoren als rot, jeden mit anderem Eigentuemer.",
          ["EVD-2026-41820"],
        ),
        record(
          "Die bedingte Risikoannahme zu RSK-0184 erfasst zwei Bedingungen und deren Status.",
          ["EVD-2026-41204"],
        ),
        record(
          "Die Pruefungsfeststellung F3 von September 2025 ist der Ursprung der offenen Massnahme.",
          ["EVD-2026-41105"],
        ),
        record(
          "Die Substituierbarkeitsbewertung zu TP-0042 ist aelter als die Richtlinienvorgabe.",
          ["EVD-2026-41440"],
        ),
      ],
      facts: [
        fact(
          "Der Anhang zu KRI-PAY-007 zerlegt die Ueberschreibungspopulation und isoliert die bewegte Komponente.",
          ["EVD-2026-41821"],
        ),
      ],
      statements: [
        stated(
          "Die Massnahmenaktualisierung mit Stand 30.09.2026 nennt den Fortschritt und die Abhaengigkeit, auf die sich der Eigentuemer beruft.",
          ["EVD-2026-41280"],
        ),
      ],
      inference: [
        inferred(
          "Die vier Indikatoren erklaeren sich eher als eine Kette mit einer vorgelagerten Ursache denn als vier unabhaengige Portfoliopunkte.",
          ["EVD-2026-41821", "EVD-2026-41820"],
          0.6,
        ),
        inferred(
          "Das Glied von der Prueferbesetzung zur Abweichungshaeufigkeit hat keinen erfassten Nachweis und ruht auf der Gleichzeitigkeit von Kapazitaet und Ausnahmedaten.",
          ["EVD-2026-41820"],
          0.45,
        ),
      ],
    }),
  },
};

const GOV_DECISION: SeededSuggestion = {
  roleId: "nfr-governance",
  beat: "decision",
  objectType: "action",
  objectId: "MSN-2026-0147",
  objectLabel: "Remediation action arising from audit finding F3, role segregation in the override path",
  atMoment: "11:45",
  decisionId: "DEC-2026-0763",
  priority: "high",
  simulatedLatencyMs: 2_940,
  en: {
    headline: "The action is 67 days past a revised due date and its blocking dependency has ended",
    changeSummary:
      "The remediation action is exactly 67 days past the due date the committee approved on 14.04.2026. The supplier change was delivered. The acceptance test that would confirm it was requested and never scheduled. The infrastructure freeze the owner cites as the blocker has an end date that has passed.",
    whyItMatters:
      "Re-baselining is defensible when the dependency is still live. Here the dependency has ended and the remaining gap is an unscheduled test, which makes a second extension a decision to accept the original audit exposure for another quarter without saying so. The extension granted in April also carried a monthly reporting condition that stopped being met after July.",
    checksCompleted: [
      "Aged the action at 67 days past its revised due date and verified the dependency chain end to end.",
      "Confirmed the infrastructure freeze end date from the change record and compared it to the owner's stated blocker.",
      "Read the supplier delivery note for the change and confirmed the acceptance test request is recorded as unanswered.",
      "Reconciled the April extension against its monthly reporting condition, finding reports in May, June and July 2026 and none since.",
      "Read audit finding F3 to confirm what exposure the action was raised to close.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Add this action to the 13.10.2026 committee agenda as an escalation with a named accountable executive, stating the ended dependency, the unscheduled acceptance test and the lapsed reporting condition.",
    recommendedToolName: "addCommitteeAgendaItem",
    alternatives: [
      "Re-baseline to a date derived from the acceptance test lead time, which is proportionate and is a second extension on the same exposure.",
      "Escalate to the entity board rather than the committee, which matches the age and bypasses the forum that granted the extension.",
      "Split it: escalate the unmet reporting condition as a governance failure and re-baseline the technical action.",
    ],
    evidenceIds: [...EV.govDecision],
    confidence: 73,
    uncertainty: [
      "The acceptance test lead time is not recorded anywhere held, so any re-baselined date would be an estimate rather than a plan.",
      "Whether the reporting condition lapsed through the owner's omission or the committee's own follow up cannot be separated from the records.",
      "The owner's stated blocker may have a successor constraint that is real and simply not recorded in the change system.",
    ],
    decisionRequired: true,
    grounding: grounding({
      records: [
        record(
          "The committee minute of 14.04.2026 records the extension of this action and the monthly reporting condition attached to it.",
          ["EVD-2026-41270"],
        ),
        record(
          "Audit finding F3 of September 2025 records the exposure this action was raised to close.",
          ["EVD-2026-41105"],
        ),
      ],
      facts: [
        fact(
          "The user acceptance test scheduling request for the supplier change is recorded as unanswered.",
          ["EVD-2026-41205"],
        ),
      ],
      statements: [
        stated(
          "The action update as at 30.09.2026 states progress and names the infrastructure freeze as the blocking dependency.",
          ["EVD-2026-41280"],
        ),
        stated(
          "The supplier delivery note asserts that the change enforces role segregation in the override path.",
          ["EVD-2026-41102"],
        ),
      ],
      conflicts: [
        conflict(
          "The owner cites a live blocking dependency while the change record shows the freeze end date has passed.",
          ["EVD-2026-41280"],
        ),
      ],
      inference: [
        inferred(
          "An action whose dependency has ended and whose only remaining step is an unscheduled test is more likely to be a capacity problem than a technical one.",
          ["EVD-2026-41280", "EVD-2026-41205"],
          0.65,
        ),
      ],
    }),
  },
  de: {
    headline: "Die Massnahme ist 67 Tage ueberfaellig und ihre blockierende Abhaengigkeit ist beendet",
    changeSummary:
      "Die Massnahme liegt genau 67 Tage nach dem am 14.04.2026 vom Ausschuss genehmigten Faelligkeitsdatum. Die Lieferantenaenderung wurde geliefert. Der bestaetigende Abnahmetest wurde angefordert und nie terminiert. Der vom Eigentuemer genannte Infrastrukturstopp hat ein Enddatum, das verstrichen ist.",
    whyItMatters:
      "Eine Neuterminierung ist vertretbar, solange die Abhaengigkeit besteht. Hier ist sie beendet, und es bleibt ein unterminierter Test. Eine zweite Verlaengerung ist damit eine Entscheidung, die urspruengliche Pruefungsexposition ein weiteres Quartal zu akzeptieren, ohne das auszusprechen. Die Aprilverlaengerung trug zudem eine Monatsberichtsbedingung, die seit Juli nicht erfuellt wird.",
    checksCompleted: [
      "Die Massnahme auf 67 Tage nach revidierter Faelligkeit datiert und die Abhaengigkeitskette vollstaendig geprueft.",
      "Das Enddatum des Infrastrukturstopps aus dem Aenderungsdatensatz bestaetigt und mit dem genannten Hindernis verglichen.",
      "Die Liefernotiz des Lieferanten gelesen und bestaetigt, dass die Abnahmetestanfrage als unbeantwortet erfasst ist.",
      "Die Aprilverlaengerung gegen ihre Monatsberichtsbedingung abgeglichen, mit Berichten in Mai, Juni und Juli 2026 und keinem danach.",
      "Die Pruefungsfeststellung F3 gelesen, um die zu schliessende Exposition zu bestaetigen.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Diese Massnahme als Eskalation mit benannter verantwortlicher Fuehrungskraft auf die Ausschusstagesordnung vom 13.10.2026 setzen, mit beendeter Abhaengigkeit, unterminiertem Abnahmetest und entfallener Berichtsbedingung.",
    recommendedToolName: "addCommitteeAgendaItem",
    alternatives: [
      "Auf ein aus der Abnahmetestvorlaufzeit abgeleitetes Datum neu terminieren. Angemessen, und eine zweite Verlaengerung derselben Exposition.",
      "An den Einheitsvorstand statt den Ausschuss eskalieren. Passt zum Alter und umgeht das Gremium, das die Verlaengerung erteilte.",
      "Teilen: die nicht erfuellte Berichtsbedingung als Governance-Versaeumnis eskalieren und die technische Massnahme neu terminieren.",
    ],
    evidenceIds: [...EV.govDecision],
    confidence: 73,
    uncertainty: [
      "Die Vorlaufzeit des Abnahmetests ist nirgends erfasst, daher waere jedes neue Datum eine Schaetzung und kein Plan.",
      "Ob die Berichtsbedingung durch Versaeumnis des Eigentuemers oder der Ausschussnachverfolgung entfiel, laesst sich nicht trennen.",
      "Das genannte Hindernis koennte eine Nachfolgebeschraenkung haben, die besteht und im Aenderungssystem nicht erfasst ist.",
    ],
    decisionRequired: true,
    grounding: grounding({
      records: [
        record(
          "Das Ausschussprotokoll vom 14.04.2026 erfasst die Verlaengerung dieser Massnahme und die beigefuegte Monatsberichtsbedingung.",
          ["EVD-2026-41270"],
        ),
        record(
          "Die Pruefungsfeststellung F3 von September 2025 erfasst die Exposition, zu deren Schliessung die Massnahme erhoben wurde.",
          ["EVD-2026-41105"],
        ),
      ],
      facts: [
        fact(
          "Die Terminanfrage fuer den Abnahmetest der Lieferantenaenderung ist als unbeantwortet erfasst.",
          ["EVD-2026-41205"],
        ),
      ],
      statements: [
        stated(
          "Die Massnahmenaktualisierung mit Stand 30.09.2026 nennt den Fortschritt und den Infrastrukturstopp als blockierende Abhaengigkeit.",
          ["EVD-2026-41280"],
        ),
        stated(
          "Die Liefernotiz des Lieferanten behauptet, die Aenderung erzwinge die Rollentrennung im Freigabepfad.",
          ["EVD-2026-41102"],
        ),
      ],
      conflicts: [
        conflict(
          "Der Eigentuemer nennt eine bestehende Abhaengigkeit, waehrend der Aenderungsdatensatz das verstrichene Enddatum zeigt.",
          ["EVD-2026-41280"],
        ),
      ],
      inference: [
        inferred(
          "Eine Massnahme mit beendeter Abhaengigkeit und nur einem unterminierten Test als Restschritt ist eher ein Kapazitaets- als ein Technikproblem.",
          ["EVD-2026-41280", "EVD-2026-41205"],
          0.65,
        ),
      ],
    }),
  },
};

const GOV_EVENT: SeededSuggestion = {
  roleId: "nfr-governance",
  beat: "shared-event",
  objectType: "theme",
  objectId: "THEME-PAY-01",
  objectLabel: "Manual payment overrides, live event exposure across six functions",
  atMoment: "14:05",
  decisionId: "DEC-2026-0781",
  priority: "critical",
  simulatedLatencyMs: 2_390,
  en: {
    headline: "A framework defect of your own: a zero tolerance with nothing that detects a breach",
    changeSummary:
      "The fallback route activated at 14:12:41 and 138 route substitution overrides were raised in the following fourteen minutes, against a rising repair queue. One of the four Corporate Payments tolerances is set at zero releases with an unsatisfied mandatory control gate, and nothing in the control inventory detects that condition in real time.",
    whyItMatters:
      "Every function will bring you a piece of this before the committee, and the agenda has to be built against a fact arrival schedule rather than against the functions. The harder item is yours: a tolerance the group cannot measure is a governance defect that this afternoon has made visible, and it is not any one function's to raise.",
    checksCompleted: [
      "Read the configuration audit log and dated the fallback route activation precisely at 14:12:41.",
      "Queried the override audit log for 14:12 to 14:26 and counted 138 overrides under the route substitution reason code.",
      "Read the repair queue telemetry across the same window to confirm the volume is event driven.",
      "Re-read the conditional risk acceptance on RSK-0184 against today's facts and confirmed its exit condition is still not started.",
      "Checked the September breach annex to establish which of the four Red indicators this afternoon moves.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Propose an agenda order for the 13.10.2026 committee built around when each fact will actually be available, with the unmeasurable tolerance listed as a separate framework item owned by the portfolio.",
    recommendedToolName: "proposeAgendaPriority",
    alternatives: [
      "Keep the agenda as circulated and let each function update in its own slot, which is fair and will put the earliest decision on the least complete facts.",
      "Defer the whole theme to the November committee so the facts are settled, which is better evidenced and leaves the risk acceptance running.",
      "Split the agenda item in two now: the event response, and the tolerance framework defect.",
    ],
    evidenceIds: [...EV.govEvent],
    confidence: 70,
    uncertainty: [
      "The event has not closed, so the override count and the affected value are both partial and will be superseded.",
      "Whether these overrides received a secondary review is not yet established, and the tolerance in question turns on exactly that.",
      "Agenda construction and portfolio materiality are the portfolio lead's decisions. What is proposed here is a sequence, not a conclusion.",
    ],
    decisionRequired: true,
    grounding: grounding({
      facts: [
        fact(
          "The configuration audit log records the fallback clearing route entering active mode at 14:12:41.",
          ["EVD-2026-41874"],
        ),
        fact(
          "Query QRY-2026-88104 returns 138 route substitution overrides raised between 14:12 and 14:26.",
          ["EVD-2026-41878"],
        ),
        fact("Repair queue telemetry records the queue depth across 14:12 to 14:26.", [
          "EVD-2026-41876",
        ]),
      ],
      records: [
        record(
          "The conditional risk acceptance on RSK-0184 records two conditions, one of which is an exit test that has not started.",
          ["EVD-2026-41204"],
        ),
        record(
          "The KRI-PAY-007 breach annex records the September component analysis for the override rate indicator.",
          ["EVD-2026-41821"],
        ),
      ],
      inference: [
        inferred(
          "A tolerance expressed as zero releases with an unsatisfied control gate, with no detective control mapped to it, cannot be adjudicated and is therefore a framework defect rather than a breach.",
          ["EVD-2026-41204"],
          0.6,
        ),
      ],
    }),
  },
  de: {
    headline: "Ein eigener Rahmenwerksfehler: eine Nulltoleranz ohne jede Erkennung",
    changeSummary:
      "Die Ausweichroute wurde um 14:12:41 aktiviert, und in den folgenden vierzehn Minuten entstanden 138 Routenumlenkungen bei steigender Reparaturschlange. Eine der vier Toleranzen fuer Corporate Payments steht auf null Freigaben mit unerfuellter Pflichtkontrolle, und keine Kontrolle im Verzeichnis erkennt diesen Zustand in Echtzeit.",
    whyItMatters:
      "Jede Funktion bringt Ihnen davor ein Teilstueck, und die Tagesordnung muss nach dem Eintreffen der Fakten gebaut werden, nicht nach den Funktionen. Der schwerere Punkt ist Ihr eigener: eine Toleranz, die die Gruppe nicht messen kann, ist ein Governance-Fehler, den dieser Nachmittag sichtbar gemacht hat.",
    checksCompleted: [
      "Das Konfigurationsprotokoll gelesen und die Ausweichaktivierung genau auf 14:12:41 datiert.",
      "Das Ueberschreibungsprotokoll fuer 14:12 bis 14:26 abgefragt und 138 Ueberschreibungen unter dem Grundcode Routenumlenkung gezaehlt.",
      "Die Telemetrie der Reparaturschlange im selben Fenster gelesen, um das ereignisbedingte Volumen zu bestaetigen.",
      "Die bedingte Risikoannahme zu RSK-0184 gegen die heutigen Fakten gelesen und die Ausstiegsbedingung als nicht begonnen bestaetigt.",
      "Den Septemberanhang geprueft, um zu bestimmen, welchen der vier roten Indikatoren dieser Nachmittag bewegt.",
    ],
    actionsCompleted: [],
    recommendedAction:
      "Eine Tagesordnungsfolge fuer den Ausschuss am 13.10.2026 vorschlagen, gebaut nach der tatsaechlichen Verfuegbarkeit jeder Tatsache, mit der nicht messbaren Toleranz als eigenem Rahmenwerkspunkt des Portfolios.",
    recommendedToolName: "proposeAgendaPriority",
    alternatives: [
      "Die Tagesordnung wie versandt belassen und jede Funktion im eigenen Slot berichten lassen. Fair, und stellt die fruehste Entscheidung auf die unvollstaendigsten Fakten.",
      "Das Thema auf den Novemberausschuss verschieben, damit die Fakten feststehen. Besser belegt, laesst die Risikoannahme laufen.",
      "Den Punkt jetzt zweiteilen: die Ereignisreaktion und den Fehler im Toleranzrahmenwerk.",
    ],
    evidenceIds: [...EV.govEvent],
    confidence: 70,
    uncertainty: [
      "Das Ereignis ist nicht abgeschlossen, daher sind Zaehlung und betroffener Wert vorlaeufig und werden ueberholt.",
      "Ob diese Ueberschreibungen eine Zweitpruefung erhielten, ist offen, und genau davon haengt die betreffende Toleranz ab.",
      "Tagesordnung und Portfoliowesentlichkeit entscheidet die Portfolioleitung. Vorgeschlagen wird eine Folge, kein Ergebnis.",
    ],
    decisionRequired: true,
    grounding: grounding({
      facts: [
        fact(
          "Das Konfigurationsprotokoll erfasst den Wechsel der Ausweichroute in den Aktivmodus um 14:12:41.",
          ["EVD-2026-41874"],
        ),
        fact(
          "Die Abfrage QRY-2026-88104 liefert 138 zwischen 14:12 und 14:26 erzeugte Routenumlenkungen.",
          ["EVD-2026-41878"],
        ),
        fact("Die Telemetrie erfasst die Tiefe der Reparaturschlange von 14:12 bis 14:26.", [
          "EVD-2026-41876",
        ]),
      ],
      records: [
        record(
          "Die bedingte Risikoannahme zu RSK-0184 erfasst zwei Bedingungen, davon einen nicht begonnenen Ausstiegstest.",
          ["EVD-2026-41204"],
        ),
        record(
          "Der Anhang zu KRI-PAY-007 erfasst die Septemberkomponentenanalyse des Ueberschreibungsratenindikators.",
          ["EVD-2026-41821"],
        ),
      ],
      inference: [
        inferred(
          "Eine als null Freigaben mit unerfuellter Kontrolle formulierte Toleranz ohne zugeordnete Erkennungskontrolle ist nicht entscheidbar und daher ein Rahmenwerksfehler.",
          ["EVD-2026-41204"],
          0.6,
        ),
      ],
    }),
  },
};

/* ==========================================================================
   The registry and its lookups
   ========================================================================== */

export const SEEDED_SUGGESTIONS: readonly SeededSuggestion[] = [
  TPRM_MORNING,
  TPRM_DECISION,
  TPRM_EVENT,
  RCSA_MORNING,
  RCSA_DECISION,
  RCSA_EVENT,
  CA_MORNING,
  CA_DECISION,
  CA_EVENT,
  IR_MORNING,
  IR_DECISION,
  IR_EVENT,
  REG_MORNING,
  REG_DECISION,
  REG_EVENT,
  GOV_MORNING,
  GOV_DECISION,
  GOV_EVENT,
];

/** The cache key a seeded beat is stored and looked up under. */
export function beatKeyFor(roleId: RoleId, beat: SuggestionBeat, language: "en" | "de"): string {
  return `suggestion:${roleId}:${beat}:${language}`;
}

/**
 * Which beat a moment belongs to.
 *
 * Boundaries rather than exact matches, because the user scrubs the live
 * player to arbitrary moments and an exact match would leave 09:30 with no
 * seeded content at all. The 14:05 beat extends to the end of the day because
 * the event dominates everything after it.
 */
export function beatForMoment(moment: string): SuggestionBeat {
  const minutes = momentMinutes(moment);
  if (minutes >= momentMinutes(BEAT_MOMENTS["shared-event"])) return "shared-event";
  if (minutes >= momentMinutes(BEAT_MOMENTS.decision)) return "decision";
  return "morning";
}

export function seededSuggestionFor(
  roleId: RoleId,
  beat: SuggestionBeat,
): SeededSuggestion | null {
  return (
    SEEDED_SUGGESTIONS.find((entry) => entry.roleId === roleId && entry.beat === beat) ?? null
  );
}

/**
 * Finds the card authored about this exact work object, or null.
 *
 * Strict, and that is the point. A suggestion card's copy is about one named
 * object: it cites that object's evidence, names the checks run against it and
 * recommends an action on it. Serving the CTL-PAY-014 card under a different
 * object identifier would publish prose about one record while the row says
 * another, which is the kind of mismatch nobody notices until a reviewer opens
 * the citation and finds it is about something else.
 *
 * Matching is on the identifier alone rather than on the type as well. The
 * identifiers in this scenario are globally unique by convention, and the
 * callers of this function are independent components whose idea of a type
 * string ("test-case" against "control-test") is not guaranteed to match the
 * one authored here. Failing to find a card because of a type synonym would
 * silently remove content that exists.
 *
 * Where two cards concern the same object, the one whose beat matches the
 * moment wins: the supplier dossier at 07:45 is the morning card and the same
 * dossier at 14:05 is the event card.
 */
export function seededSuggestionForObjectStrict(
  roleId: RoleId,
  objectId: string,
  moment: string,
): SeededSuggestion | null {
  if (objectId.length === 0) return null;

  const matches = SEEDED_SUGGESTIONS.filter(
    (entry) => entry.roleId === roleId && entry.objectId === objectId,
  );
  if (matches.length === 0) return null;

  const beat = beatForMoment(moment);
  return matches.find((entry) => entry.beat === beat) ?? matches[0] ?? null;
}

/**
 * Finds the seeded card for a work object, falling back to the beat.
 *
 * Used where a card for the moment is better than nothing, for instance when
 * assembling the evidence set in scope for an object the day does not have an
 * authored card for. It is deliberately not used to choose publishable copy:
 * `seededSuggestionForObjectStrict` is, for the reason given above.
 */
export function seededSuggestionForObject(
  roleId: RoleId,
  objectType: string,
  objectId: string,
  moment: string,
): SeededSuggestion | null {
  return (
    seededSuggestionForObjectStrict(roleId, objectId, moment) ??
    seededSuggestionFor(roleId, beatForMoment(moment))
  );
}

/** Every copy string in the seeded set, for the copy rule tests. */
export function allSeededStrings(): string[] {
  const out: string[] = [];
  for (const entry of SEEDED_SUGGESTIONS) {
    out.push(entry.objectLabel);
    for (const draft of [entry.en, entry.de]) out.push(...copyStrings(draft));
  }
  return out;
}

/** Every evidence identifier the seeded set cites. */
export function allSeededEvidenceIds(): string[] {
  const out = new Set<string>();
  for (const entry of SEEDED_SUGGESTIONS) {
    for (const draft of [entry.en, entry.de]) {
      for (const id of draft.evidenceIds) out.add(id);
      for (const section of [
        draft.grounding.verifiedFacts,
        draft.grounding.approvedRecords,
        draft.grounding.stakeholderStatements,
        draft.grounding.modelInference,
        draft.grounding.conflictingEvidence,
      ]) {
        for (const statement of section) for (const id of statement.sourceIds) out.add(id);
      }
    }
  }
  return [...out].sort();
}

/** The disclosure, re-exported so the seed and the tests share one constant. */
export { REGULATORY_DISCLOSURE };

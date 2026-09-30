# DACH Context

NFR WorkOS, technical documentation for the bank's technology, security and audit functions.

Synthetic institution and data. All persons are fictional. All regulatory instruments in the scenario
are synthetic.

**Illustrative regulatory context, not legal advice.**

This document sets out the jurisdictional model the product implements: three legal entities, two
supervisory frameworks, one group, and the structural mechanisms that keep the European Union lane
and the Swiss lane apart. It also records the bilingual terminology contract, the three lines of
defence model as the scenario implements it, and the display conventions.

Primary sources:

| Concern | File |
|---|---|
| Institution, entities, people, roles | `src/scenario/data/institution.ts` |
| Regulatory publications and candidate obligations | `src/scenario/data/event.ts` from line 1288 |
| Evidence corpus and its lane discipline | `src/scenario/data/evidence.ts` |
| Entity constants | `src/scenario/data/contract.ts:91` |
| Interface labels, English and German | `src/i18n/labels.ts` |
| Formatting helpers | `src/domain/nfr/calculators.ts:250` onwards |
| Schema, entity and jurisdiction columns | `src/db/schema/core.ts`, `practice.ts`, `domain.ts` |
| Mechanical jurisdiction check | `src/agents/evaluations/suite.ts:265` |
| Scenario narrative of record | `docs/SCENARIO_BIBLE.md` sections 3, 3.1, 3.2 and 18.4 |

Where this document and `docs/SCENARIO_BIBLE.md` disagree, the bible is authoritative for scenario
content and this document is authoritative for what the code does.

---

## 1. The institution

Arcadia Banking Group. Synthetic institution and data.

| Attribute | Value |
|---|---|
| Group parent | Arcadia Banking Group AG, Frankfurt am Main |
| Type | Mid-large universal banking group, scenario profile |
| Business lines | Retail banking, corporate banking, payments |
| Employees | Approximately 16,000, scenario figure |
| Countries of operation | Germany, Austria, Switzerland |
| NFR operating model | Central policy and group level governance; local legal entity accountability; shared technology and third party services |
| Group reporting currency | EUR |

These are scenario figures, not benchmarks. The product has no external benchmark data and
`src/components/evidence/figures.tsx:14` states that there is deliberately no figure basis meaning
"external benchmark", because this prototype has none.

---

## 2. The three legal entities and their distinct supervisory contexts

`src/scenario/data/institution.ts:31`. Three rows, each carrying `jurisdiction`, `regulatoryBloc`,
`currency` and a `supervisoryContext` sentence.

| Field | `ARC-DE` | `ARC-AT` | `ARC-CH` |
|---|---|---|---|
| Legal name | Arcadia Bank AG | Arcadia Bank Oesterreich AG | Arcadia Bank Schweiz AG |
| `jurisdiction` | Germany | Austria | Switzerland |
| `regulatoryBloc` | `eu` | `eu` | `ch` |
| `currency` | EUR | EUR | CHF |
| Locations | Frankfurt am Main, head office; Munich, payment operations hub | Vienna | Zurich |
| Employees, scenario figure | approx. 9,400 | approx. 2,900 | approx. 3,700 |
| Prudential context | EU credit institution | EU credit institution | Swiss bank, FINMA supervised |

The `supervisoryContext` strings, verbatim from the code:

- `ARC-DE` and `ARC-AT`: "EU credit institution. Subject to national supervision and applicable EU
  requirements including the digital operational resilience framework."
- `ARC-CH`: "Swiss bank under FINMA supervision. Operational risk, operational resilience and
  outsourcing expectations follow the Swiss framework. The EU digital operational resilience
  regulation does not apply to this entity."

Note the asymmetry of expression, which is deliberate. The EU entities state what applies. The Swiss
entity states what applies **and** states what does not. The negative statement is load bearing,
because the mechanical check described in section 3.4 looks for exactly that kind of statement.

**Illustrative regulatory context, not legal advice.**

### 2.1 Why the entity structure matters operationally, not just legally

Two scenario facts make the entity boundaries real rather than decorative:

1. **All group functions are employed by `ARC-DE` and charged out under intragroup service
   agreements** (`src/scenario/data/institution.ts:26` and `docs/SCENARIO_BIBLE.md` section 3.1).
   Group NFR staff are legally `ARC-DE` employees performing work for `ARC-AT` and `ARC-CH`. The
   stated consequence is that local entity sign off is always required and cannot be absorbed by the
   group function. This is why the unowned gap `OBL-2026-0088-002` exists: the group third party
   relationship owner, P-002 Stefan Brunner, is an `ARC-DE` employee acting under an intragroup
   arrangement and therefore cannot be the accountable person for a Swiss data access question.

2. **Group Procurement sits in Vienna**
   (`src/scenario/data/institution.ts:59`), which is why the commercial route to the supplier runs
   through the Austrian entity even where the service is consumed in Germany. A supplier question is
   therefore never a single entity question.

`ARC-CH` additionally "holds its own impact tolerance position and a domestic clearing cut-off
constraint that the EU entities do not share" (`src/scenario/data/institution.ts:73`). That constraint,
the 16:00 CET SIC and euroSIC submission cut-off, is what makes the Swiss position genuinely different
in the worked example at section 6.

### 2.2 The six product roles across the three entities

`src/scenario/data/institution.ts:336` onwards. Each role carries an `entityId`, a `titleDe`, a
`mandate`, a `humanOwnedDecisions` list and a `specialistAgent`.

| Role id | Title | German title | Entity | Holder | Line |
|---|---|---|---|---|---|
| `tprm` | Third-Party Risk Manager | Manager Drittparteienrisiko | `ARC-DE` | P-002 Stefan Brunner | 2LoD |
| `rcsa` | Operational Risk Partner | Partner Operationelles Risiko | `ARC-DE` | P-003 Marlene Aigner | 2LoD |
| `control-assurance` | Control Assurance Specialist | Spezialist Kontrollsicherung | `ARC-AT` | P-004 Jakob Steinbacher | 2LoD |
| `incident-resilience` | Incident and Resilience Lead | Leiter Vorfall und Resilienz | `ARC-CH` | P-005 Nadia Lehmann | 2LoD |
| `regulatory-change` | Regulatory Change Manager | Manager Regulatorische Aenderungen | `ARC-DE` | P-006 Tobias Reinhardt | 2LoD |
| `nfr-governance` | NFR Portfolio Lead | Leiterin NFR-Portfolio | `ARC-DE` | P-001 Dr. Katharina Vogt | 2LoD |

All three entities are represented among the playable roles, which is what makes the jurisdiction
question arrive in ordinary work rather than as a special case. The Incident and Resilience Lead sits
at `ARC-CH`, so the role most likely to face a notification question is the role whose entity is
outside the EU framework.

The `PreservedContext` carried into every model request includes `entity`, `jurisdiction` and
`regulatoryBloc` (`src/agents/sessions/session.ts:194`), and `renderPreservedContext` writes the line
"Legal entity: <name>, <jurisdiction>, regulatory bloc <bloc>" (`:291`). The acting entity is
therefore stated to the model on every turn and cannot be inferred wrongly from the conversation.

---

## 3. The EU and Swiss separation, and how it is kept structurally

The product's position, stated at `src/scenario/data/event.ts:13`: `ARC-DE` and `ARC-AT` sit in the
EU lane; `ARC-CH` sits in the Swiss lane and carries FINMA context. The lanes are kept apart
structurally rather than by editorial convention. Five distinct mechanisms.

### 3.1 A typed field on the entity, not a description

`regulatoryBloc` is a `NOT NULL` column on `legal_entities` (`src/db/schema/core.ts:66`) taking the
values `eu` or `ch`. It is not free text and it is not derived from `jurisdiction`. Every consumer
that needs to know which framework applies reads that field:

- `src/agents/tools/reads.ts:90`, `getRoleContext` returns it to the model
- `src/agents/sessions/session.ts:239`, it is part of preserved context
- `src/agents/evaluations/suite.ts:269`, the jurisdiction check derives the Swiss entity set from it

A view cannot accidentally treat the Swiss entity as an EU entity, because the bloc is an attribute of
the entity row rather than a property of whatever narrative is being rendered.

### 3.2 Separate publications, with a lane suffix in the identifier

`regulatoryPublications` (`src/scenario/data/event.ts:1315`). Six synthetic instruments behind four
regulatory change items. Where one change item has two lanes, the identifier carries the lane:

| Publication | `jurisdiction` | Reference | Subject |
|---|---|---|---|
| `REG-2026-0031-EU` | `eu` | EFSCB/GL/2026/04 | Register of information, subcontracting chains |
| `REG-2026-0031-DE` | `de` | FOFMS-RS-07/2026 | National outsourcing and internal control system expectations |
| `REG-2026-0117-EU` | `eu` | EFSCB/TS/2026/09 | Incident classification and reporting |
| `REG-2026-0104-EU` | `eu` | EFSCB/CP/2026/11 | Impact tolerance definition and testing |
| `REG-2026-0088` | `ch` | SFMOB-RS-2026/02 | Outsourcing inventory and data access abroad |
| `REG-2026-0104-CH` | `ch` | SFMOB-RS-2026/05 | Operational risk, resilience, incident reporting |

The comment at `src/scenario/data/event.ts:1293` states why the suffix exists: `REG-2026-0104` and
`REG-2026-0117` each carry an EU reference and a Swiss reference that are assessed separately and
"must never be answered once". Two lanes of the same change item are two publications with two
identifiers, so a single answer cannot be recorded against both.

The full texts are written to state their own limits. `REG-2026-0031-EU` paragraph 2, quoted from
`src/scenario/data/event.ts:1336`:

> "These guidelines are addressed to credit institutions established in the Union and to the
> competent authorities that supervise them. They do not extend to an entity established outside the
> Union. Where a group contains such an entity, the corresponding requirement, if any, arises under
> the framework applicable to that entity and must be identified, mapped and evidenced separately. A
> determination made at group level does not discharge an obligation that sits at entity level, and
> an entity outside the Union is not brought within the scope of this instrument by consolidation."

The German national circular states the equivalent limit at paragraph 2: it applies to institutions
supervised in that jurisdiction, does not address entities supervised elsewhere including group
entities established outside the Union, and complements rather than displaces the Union framework.
Note that it is also **not** addressed to `ARC-AT`, which is supervised in Austria. The lane split is
therefore not simply EU against Switzerland: within the EU lane, a national instrument scopes to one
entity.

**Illustrative regulatory context, not legal advice.**

### 3.3 Separate obligations, with a candidate entity list that poses the question without answering it

`obligations` (`src/scenario/data/event.ts:1737`). Eighteen candidates extracted from the six
publications. Every row carries `candidateEntityIds`, and the comment at
`src/scenario/data/event.ts:1721` states the rule precisely: "EU-lane candidates list ARC-DE and
ARC-AT, or ARC-DE alone for the national circular. Swiss-lane candidates list ARC-CH alone. No row
lists an EU instrument against ARC-CH."

Verified against the data:

| Publication | Obligations | `candidateEntityIds` |
|---|---|---|
| `REG-2026-0031-EU` | `OBL-2026-0031-001` to `-004` | `ARC-DE`, `ARC-AT` |
| `REG-2026-0031-DE` | `OBL-2026-0031-005`, `-006` | `ARC-DE` only |
| `REG-2026-0117-EU` | `OBL-2026-0117-001` to `-003` | `ARC-DE`, `ARC-AT` |
| `REG-2026-0104-EU` | `OBL-2026-0104-001` to `-003` | `ARC-DE`, `ARC-AT` |
| `REG-2026-0088` | `OBL-2026-0088-001` to `-003` | `ARC-CH` only |
| `REG-2026-0104-CH` | `OBL-2026-0104-004` to `-006` | `ARC-CH` only |

Two further properties of these rows matter for the accountability model:

- **`applicabilityDecision`, `applicabilityRationale`, `decidedByUserId` and `decidedOn` are null on
  every one of the eighteen rows.** The comment at `src/scenario/data/event.ts:1714` is explicit:
  applicability is determined per legal entity with a recorded rationale, and that determination is
  the Regulatory Change Manager's work. `candidateEntityIds` says where the question arises; it does
  not answer it.
- **Five rows are marked `isUnownedGap: true` with a `gapNote` and `ownerUserId: null`.** Those are
  the rows the role exists to find. Two of the five sit in the Swiss lane.

The obligation text and the extraction summary are separate fields, and the summary is prefixed
"Extraction summary:" in every row. The regulatory change specialist prompt requires quoting the
paragraph and summarising it separately, never presenting the summary as the text of the requirement
(`src/agents/prompts/system.ts:142`).

### 3.4 A mechanical check, not a review convention

`evaluateJurisdictionSeparation` (`src/agents/evaluations/suite.ts:265`) is a structural evaluation
that runs with no model call. The docstring states the reason it exists: blurring the two lanes is
"the single most damaging factual error the product could make to this audience, so it is checked
mechanically rather than trusted to review."

What it does:

1. derive the Swiss entity identifier set from `regulatoryBloc === "ch"`
2. define `euOnlyTerms` as `/\bDORA\b|Regulation \(EU\) 2022\/2554|\bEBA\b/i`
3. define `negation` as `/not apply|does not apply|not applicable|no application|outside the scope|does not extend|not in scope/i`
4. for every obligation scoped to a Swiss entity, concatenate `obligationText` and `extractedSummary`
   and fail if an EU only term appears without a negation
5. for every publication with `jurisdiction === "ch"`, concatenate `summary` and `fullText` and apply
   the same test

The evaluation reports how many obligations and publications it checked against how many Swiss entity
identifiers, so its coverage is stated rather than assumed.

A companion grounded probe, `probe-swiss-jurisdiction`
(`src/agents/evaluations/suite.ts:664`), asks a live model "Which supervisory notification requirement
applies to the Swiss entity for this event?" and fails the answer against
`/DORA (?:applies|requires|mandates)[^.]{0,40}(?:Schweiz|Swiss)/i`, annotated in the code as "The
single most damaging error this product could make."

### 3.5 A single constant for the EU entity set in the evidence corpus

`src/scenario/data/evidence.ts:59` declares `const EU_ENTITIES = [ENTITY_DE, ENTITY_AT]` with the
comment "DORA and EBA references stop here", alongside `ALL_ENTITIES` for the three entity case. An
evidence document tagging a DORA reference uses `EU_ENTITIES` rather than listing entity constants by
hand, so the scope cannot drift document by document. The file header records the same rule as a
numbered principle: "DORA and EBA guidance are referenced for ARC-DE and ARC-AT only. ARC-CH is
addressed through FINMA operational risk, resilience and outsourcing context."

### 3.6 Entity partitioning throughout the schema

Entity scope is a column, not a convention. `entity_id` is `NOT NULL` on risks
(`src/db/schema/practice.ts:30`), controls (`:88`), control tests (`:138`), suppliers
(`src/db/schema/domain.ts:141`) and contracts (`:165`). Where a record legitimately spans entities it
carries an `entity_ids` JSON array rather than a single value: impact tolerances
(`src/db/schema/practice.ts:182`), services (`src/db/schema/domain.ts:86`), and three further
relationship tables. Regulatory publications carry their own `jurisdiction` column
(`src/db/schema/practice.ts:282`).

The scenario's operating model states the consequence for any write
(`docs/SCENARIO_BIBLE.md` section 3.2): "Any state change written by NFR WorkOS must name the target
system of record, the entity partition, the record identifier, the accountable human and the evidence
reference. A state change without all five is invalid and must be rejected." The entity partition is
one of the five.

### 3.7 What the separation looks like in the incident record

The shared event `INC-2026-0412` produced **two** classification records, five minutes apart, and the
data preserves both rather than reconciling them
(`src/scenario/data/event.ts:301`):

> "Two assessments, recorded separately and never merged. ARC-DE and ARC-AT were assessed against the
> EU major-incident classification criteria and the event was not classified as a major incident.
> ARC-CH was assessed separately against FINMA operational risk and resilience expectations for
> reporting incidents of substantial importance and was found not to be of substantial importance.
> Two entities, two frameworks, two conclusions. Illustrative regulatory context, not legal advice."

The notification rationale field records that the two conclusions rest on different reasoning: the
Swiss conclusion turned on submission completing inside the cut-off with 41 minutes of margin and no
client identifying data exposed; the EU conclusion turned on duration and economic impact. The record
keeps them apart because the frameworks are different.

`DEC-2026-0774` carries the EU determination at 15:47 and `DEC-2026-0775` carries the Swiss
determination at 15:52. Both are recorded as provisional, both identify the missing information as
the supplier report due 13.10.2026, and neither may be presented as a group conclusion. The incident
specialist prompt enforces the same discipline: "Keep the jurisdictions separate. A notification
requirement for the German entity is not a notification requirement for the Swiss entity, and you
must identify the applicable requirement per entity" (`src/agents/prompts/system.ts:130`).

One incident in the history, `INC-2026-0407`, is Swiss lane only, and its classification field states
that "No EU assessment was performed because no EU entity was affected, and the Swiss assessment
stands on the Swiss framework alone." The separation therefore runs in both directions.

**Illustrative regulatory context, not legal advice.**

---

## 4. Paired English and German terminology

`docs/SCENARIO_BIBLE.md` section 18.4 declares the mandatory pairs. The rule stated there is that
every surface uses the paired form on first use in a view: English, German, and the abbreviation
where one exists.

| English | German | Abbreviation | Appears in code as |
|---|---|---|---|
| Internal Control System | Internes Kontrollsystem | IKS | `src/scenario/data/institution.ts:901` policy title `Konzernstandard Internes Kontrollsystem`; department string at `:124`; paired inline at `src/scenario/data/assurance.ts:768` |
| Third-Party Risk Management | Drittparteienrisikomanagement | TPRM | Role title `Manager Drittparteienrisiko` (`institution.ts:341`); policy `Konzernrichtlinie Drittparteienrisiko` (`:757`) |
| Outsourcing | Auslagerung | | 16 occurrences in `src/`; `wesentliche Auslagerung` at `event.ts:2115` |
| Material outsourcing | Wesentliche Auslagerung | | `OBL-2026-0088-001` extraction summary |
| Subprocessor | Unterauftragnehmer | | Paired heading `Subprocessors and fourth parties / Unterauftragnehmer` |
| Fourth party | Viertpartei | | Bible pair; English form used in code |
| Materiality | Wesentlichkeit | | Bible pair. **Not present in `src/`**: see section 8, item 3 |
| Control Effectiveness | Kontrollwirksamkeit | | 7 occurrences, for example `decisions.ts:751` `CTL-PAY-014 Kontrollwirksamkeit` and the paired form at `assurance.ts:286` |
| Risk Acceptance | Risikoakzeptanz | | 48 occurrences, the most used German term after Massnahme |
| First Line of Defence | Erste Verteidigungslinie | 1LoD | 35 occurrences of `1LoD`; `users.line = "1lod"` |
| Second Line of Defence | Zweite Verteidigungslinie | 2LoD | 33 occurrences of `2LoD`; `users.line = "2lod"` |
| Third Line of Defence | Dritte Verteidigungslinie | 3LoD | `users.line = "3lod"`, P-017 Group Internal Audit |
| Remediation Action | Massnahme | | 79 occurrences, the most used German term; action label `Massnahme anlegen` (`labels.ts:104`) |
| Risk and Control Self Assessment | Risiko- und Kontrollselbstbewertung | RCSA | Paired form `Risk and Control Self Assessment / Risiko-...` in the scenario data |
| Key Risk Indicator | Risikoindikator | KRI | Identifier prefix `KRI-` |
| Important business service | Wichtige Geschaeftsdienstleistung | | Identifier prefix `IBS-`; `isImportantBusinessService` on the dependency map |
| Impact tolerance | Toleranzschwelle | | Paired heading `Impact tolerances / Toleranzschwellen`; identifier prefix `ITOL-` |
| Business Continuity Management | Betriebskontinuitaetsmanagement | BCM | Paired in the department string for P-005 |
| Segregation of duties | Funktionstrennung | | 8 occurrences; paired heading `Segregation of duties / Funktionstrennung` |
| Four-eyes principle | Vier-Augen-Prinzip | | `RD-RULE-0031`, the four-eyes enforcement rule |
| Finding | Feststellung | | `Feststellung erheben` in German decision option labels |
| Evidence | Nachweis | | Rail tab `Nachweise` (`labels.ts:81`); `Nachweis oeffnen` (`:98`) |
| Escalation | Eskalation | | Status `Eskaliert` (`labels.ts:118`); action `Eskalieren` (`:97`) |
| Incident | Vorfall | | Role title `Leiter Vorfall und Resilienz` (`institution.ts:453`) |
| Committee | Gremium | | `Gruppenkomitee` in the committee name pair |

### 4.1 Further pairs found in the code and not listed in the bible

Drawn from `src/i18n/labels.ts` and the German option labels in `src/scenario/data/decisions.ts`.

| English | German | Where |
|---|---|---|
| Organise / Personal Work Orchestration | Organisieren / Persoenliche Arbeitsorchestrierung | `labels.ts:30` |
| Understand / Evidence and Risk Intelligence | Verstehen / Nachweise und Risikointelligenz | `labels.ts:36` |
| Assess / Core Risk Practice | Beurteilen / Fachliche Risikoarbeit | `labels.ts:42` |
| Decide / Human Judgment and Challenge | Entscheiden / Menschliches Urteil und kritische Wuerdigung | `labels.ts:48` |
| Execute / Controlled Execution and Assurance | Umsetzen / Kontrollierte Umsetzung und Sicherung | `labels.ts:54` |
| Trust and Audit | Vertrauen und Revision | `labels.ts:76` |
| Workbench | Arbeitsbereich | `labels.ts:73` |
| Why this matters | Warum das wichtig ist | `labels.ts:82` |
| Uncertainty | Unsicherheit | `labels.ts:83` |
| Applicable policy | Geltende Richtlinie | `labels.ts:84` |
| Human approvals | Menschliche Genehmigungen | `labels.ts:85` |
| AI activity | KI-Aktivitaet | `labels.ts:86` |
| Audit trail | Revisionsprotokoll | `labels.ts:87` |
| Record decision | Entscheidung erfassen | `labels.ts:92` |
| Approve and execute | Genehmigen und ausfuehren | `labels.ts:94` |
| Defer | Zurueckstellen | `labels.ts:96` |
| I confirm this rationale is mine | Ich bestaetige diese Begruendung als meine | `labels.ts:100` |
| Challenge | Hinterfragen | `labels.ts:101` |
| Request factual validation | Sachverhaltsklaerung anfordern | `labels.ts:102` |
| Activate enhanced monitoring | Verstaerkte Ueberwachung aktivieren | `labels.ts:103` |
| Add to committee agenda | Auf die Agenda setzen | `labels.ts:105` |
| Record factual correction | Sachliche Korrektur erfassen | `labels.ts:110` |
| Overdue | Ueberfaellig | `labels.ts:119` |
| Superseded | Ersetzt | `labels.ts:123` |
| Stale | Veraltet | `labels.ts:126` |
| Within appetite | Innerhalb der Risikoneigung | `labels.ts:132` |
| At limit | An der Grenze | `labels.ts:133` |
| Outside appetite | Ausserhalb der Risikoneigung | `labels.ts:134` |
| Verified fact | Gesicherte Tatsache | `labels.ts:142` |
| Approved record | Genehmigter Eintrag | `labels.ts:143` |
| Stakeholder statement | Aussage eines Beteiligten | `labels.ts:144` |
| Model inference | Modellschlussfolgerung | `labels.ts:145` |
| Conflicting evidence | Widerspruechlicher Nachweis | `labels.ts:146` |
| Telemetry | Telemetrie | `labels.ts:147` |
| Assist | Unterstuetzen | `labels.ts:193` |
| Prepare | Vorbereiten | `labels.ts:194` |
| Recommend | Empfehlen | `labels.ts:195` |
| Act with approval | Handeln nach Genehmigung | `labels.ts:196` |
| Act within policy | Handeln im Rahmen der Richtlinie | `labels.ts:197` |
| Presenter Safe | Praesentationssicher | `labels.ts:203` |
| Illustrative regulatory context, not legal advice. | Illustrativer regulatorischer Kontext, keine Rechtsberatung. | `labels.ts:169` |
| Synthetic institution and data | Synthetische Institution und Daten | `labels.ts:167` |
| The human owns this decision | Diese Entscheidung liegt beim Menschen | `labels.ts:184` |
| AI-enabled future | KI-gestuetzte Zukunft | `labels.ts:182` |
| Rating scale: Not effective | Nicht wirksam | `calculators.ts:61` |
| Rating scale: Partially effective | Teilweise wirksam | `calculators.ts:62` |
| Rating scale: Largely effective | Weitgehend wirksam | `calculators.ts:63` |
| Rating scale: Fully effective | Vollstaendig wirksam | `calculators.ts:64` |
| Rating scale: Not assessed | Nicht beurteilt | `calculators.ts:65` |
| Likelihood 1 to 5 | Selten, Unwahrscheinlich, Moeglich, Wahrscheinlich, Nahezu sicher | `calculators.ts:15` |
| Impact 1 to 5 | Unbedeutend, Gering, Mittel, Erheblich, Schwerwiegend | `calculators.ts:23` |
| Risk rating | Niedrig, Mittel, Hoch, Kritisch | `calculators.ts:34` |

`t(dict, key, language)` (`src/i18n/labels.ts:208`) resolves any entry for a language and falls back
to English when the key is absent, so a missing German string degrades to English rather than to a
blank.

### 4.2 The scope of the German coverage

Stated at `src/i18n/labels.ts:4`: the primary interface language is English, and German covers core
navigation, the five work lane labels, decision buttons, high value story copy and common status
labels. That is the scope the product brief sets. Long form narrative content is bilingual only where
`titleDe` and `labelDe` fields exist on a record; the bodies of evidence documents, extraction
summaries and gap notes are English with embedded German terms.

### 4.3 A real terminology defect the scenario deliberately carries

`docs/SCENARIO_BIBLE.md` section 17.1 records that `CTL-PAY-014` carries
"Fully Effective / Voll wirksam" as a first line self assessment label, while the second line scale
offers "Effective / Wirksam". The two scales are not identical and nobody has aligned them. The bible
instructs that the product should surface this "as a small, real, irritating finding, because it is
the kind of thing that actually happens and it slightly weakens both positions." Note that
`src/domain/nfr/calculators.ts:57` implements a five band scale using
"Vollstaendig wirksam" for `fully-effective`, which is a third variant of the same label. The
inconsistency is a feature of the scenario, and in the calculator it is not obviously intentional:
see section 8, item 4.

---

## 5. The three lines of defence, as the scenario implements it

The model is described at `docs/SCENARIO_BIBLE.md` section 3.2 and implemented as a `line` column on
the user record (`src/db/schema/core.ts:84`) taking one of `1lod`, `2lod`, `3lod`, `external` or
`management`.

| Line | Owns | People in the register |
|---|---|---|
| **First Line of Defence, 1LoD** | Processes, controls and remediation | P-007 Andreas Kellner, Head of Payment Operations, Munich; P-008 Beatrix Hofmann, Payment Repair Team Lead; P-009 Elif Demir, Senior Payment Repair Analyst and designated Secondary Reviewer; P-010 Lukas Wiesinger, Category Lead Payments Technology, Group Procurement Vienna; P-015 Sibylle Graf, Resilience Officer, `ARC-CH` Zurich |
| **Second Line of Defence, 2LoD** | Framework, challenge, independent assessment and aggregate reporting | All six product roles: P-001 to P-006 |
| **Third Line of Defence, 3LoD** | Independent assurance | P-017 Peter Maurer, Head of Group Internal Audit. Present as a stakeholder, explicitly **out of scope as a user role** |
| Management | Accountability for acceptance and escalation | P-013 Claudia Renner, Group Chief Risk Officer; P-014 Dr. Heinrich Adler, Group Chief Operating Officer and Chair of the Group NFR Committee; P-016 Dr. Anja Weiss, Outsourcing Counsel, Group Legal |
| External | Counterparties and former staff | P-018 Tomas Nowak, former Secondary Reviewer, position PR-SR-02, left the group; the two supplier contacts under `EXT-NOVALINK` |

### 5.1 How the two lines actually interact in the product

The three lines model is not a label on a person. It is the source of the product's central
disagreement, and three mechanisms carry it:

1. **Two assessments are held, not one.** The RCSA specialist prompt requires that where the first
   line and independent testing disagree, both positions are set out fairly, with the observation
   that "the first line owner may be right about their team and wrong about the system, and that
   distinction is usually where the answer is" (`src/agents/prompts/system.ts:97`).
   `controlAssessmentSchema` (`src/agents/schemas/index.ts:238`) carries
   `proposedEffectiveness` for the second line position and `firstLineAssertedEffectiveness` as a
   separate field, plus `divergenceExplanation` and `whatMustBeTrueForCurrentRating`. The two
   positions cannot be stored in one field.
2. **The divergence is rendered as geometry, not as a footnote.** `RiskControlGraph`
   (`src/components/visualisations/RiskControlGraph.tsx:9`) draws a divergent control as two stacked
   assessment bands inside one node, each with its own segmented effectiveness meter and its own
   named owner, emitting two `mitigates` edges to the same risk at different stroke widths. The file
   header states the rule: "Nothing is averaged. Averaging a divergence is how disagreements get
   resolved by dilution, and this component exists to make that impossible."
3. **The authority scope model separates testing from rating.** Only the `rcsa` role holds
   `control.rate`; only the `control-assurance` role holds `control.test.conclude`
   (`src/server/security/authority.ts:236` and `:241`). The Control Assurance Specialist can conclude
   a test and cannot change the control's recorded rating. That is the real separation between
   independent testing and the assessment of record, expressed as a permission rather than as a
   process note.

### 5.2 Second line powers the scenario grants explicitly

From the group policy text seeded at `src/scenario/data/institution.ts`:

- **Criticality is a second line determination.** "A first line proposal is an input and is not
  sufficient on its own" (`institution.ts:766`).
- **Enhanced monitoring may be activated by the second line without first line agreement**, and
  requires a defined review frequency, a named reviewer and a defined exit condition.
  "Enhanced monitoring is not a substitute for remediation" (`institution.ts:820`).
- **A control may be assessed as fully effective only where independent testing supports it**, or
  where no independent testing was required and the first line assessment is supported by documented
  evidence of operation. Where testing has identified exceptions, the first line assessment may not
  remain at fully effective unless the second line records a documented basis for treating the
  exceptions as immaterial, and that basis must address the number of exceptions, their nature and
  whether they share a cause (`institution.ts:712`).

### 5.3 Committee structure

Entity NFR Committees for `ARC-DE`, `ARC-AT` and `ARC-CH`, each feeding the Group NFR Committee. The
constraint stated at `docs/SCENARIO_BIBLE.md` section 3.2: "The Group NFR Committee cannot overrule
an entity board; it can require an entity to take a decision and record it." This is the governance
expression of the entity separation. A group level view can surface a matter; only the entity can
decide it.

Systems of record: one group GRC platform, `SYS-0031` Arcadia RiskCore, holding risks, controls,
tests, findings, Massnahmen, RCSAs, third parties and incidents with entity partitioning, and
`SYS-0032` Arcadia Evidence Vault for evidence with immutable versioning.

---

## 6. Worked example: the obligation where the EU and Swiss answers genuinely differ

Two obligations cover the same subject matter, "know your supply chain and record it". They are not
the same obligation, and a single group answer would be wrong twice. The comment at
`src/scenario/data/event.ts:2094` says so directly: "This is the row where the EU answer and the
Swiss answer genuinely differ, and it is why the product keeps two inventories instead of one."

### 6.1 The two obligations, side by side

| | `OBL-2026-0031-001`, EU lane | `OBL-2026-0088-001`, Swiss lane |
|---|---|---|
| Publication | `REG-2026-0031-EU`, EFSCB/GL/2026/04 | `REG-2026-0088`, SFMOB-RS-2026/02 |
| Locator | Section 2, paragraph 3 | Margin number 6 |
| Candidate entities | `ARC-DE`, `ARC-AT` | `ARC-CH` |
| Instrument type | Guideline | Circular |
| Artefact required | A register of information | An inventory of significant outsourcings |
| Population | Every ICT third party arrangement | Significant outsourcings of the Swiss bank only |
| Unit of account | Organised by **arrangement** | Organised by **outsourced function** |
| Substitutability assessment | Not required | **Required** |
| Places of performance | Required to the level at which the service is actually performed | Required |
| Maintained at | Entity level for each EU entity | Entity level, at the level of the Swiss bank |
| Owner in the scenario | P-002 Stefan Brunner | P-006 Tobias Reinhardt with P-015 Sibylle Graf |
| Extraction confidence | 0.91 | 0.90 |
| Theme | `outsourcing` | `outsourcing` |

The EU paragraph, quoted from `src/scenario/data/event.ts:1743`:

> "A financial entity shall record in the register every subcontractor that effectively underpins an
> ICT service supporting a critical or important function, and shall do so to the level of the
> subcontracting chain at which the service is actually performed. Recording the direct contractual
> counterparty alone does not satisfy this paragraph."

The Swiss margin number, quoted from `src/scenario/data/event.ts:2113`:

> "The bank shall maintain an inventory of its significant outsourcings which states, for each
> outsourcing, the function outsourced, the provider, the subcontractors engaged in performing it,
> the places from which the service is performed, and the bank's assessment of substitutability. The
> inventory shall be maintained at the level of the Swiss bank and shall be capable of being produced
> on request."

**Illustrative regulatory context, not legal advice.**

### 6.2 Why the difference is substantive and not cosmetic

The Swiss extraction summary states it: "The two instruments therefore produce two inventories with
different populations, different fields and different owners... Neither instrument extends to the
other's entities and a single group inventory maintained for one of them does not satisfy the other."

Four concrete divergences:

1. **Different populations.** The EU register reaches every ICT third party arrangement of `ARC-DE`
   and `ARC-AT`. The Swiss inventory reaches only the significant outsourcings of `ARC-CH`. Neither
   is a subset of the other.
2. **Different unit of account.** Arrangement against outsourced function. The same supplier
   relationship appears once per contract in one and once per function in the other, so the row counts
   do not reconcile and should not be made to.
3. **A field one requires and the other does not.** Substitutability. The Swiss inventory cannot be
   produced from the EU register, because the EU register never asked the question.
4. **Different accountable owners in different entities.** The EU row is owned by an `ARC-DE`
   employee; the Swiss row by the Regulatory Change Manager working with the `ARC-CH` Resilience
   Officer.

### 6.3 The same facts, two answers

The concrete objects on both sides are the same supplier chain, which is what makes the divergence
visible rather than theoretical:

- **EU side.** `TP-0042.4` Meridian Operations Support Pvt Ltd performs level 1 service desk and out
  of hours monitoring for NOVA-GATE and RepairDesk from Pune and is absent from the binding appendix
  altogether. `TP-0042.2` Rheinstack GmbH is listed for the Frankfurt region only while the Amsterdam
  region carried NOVA-GATE write traffic during `INC-2026-0412`. `KRI-TPR-002`, Tier 1 third parties
  with a complete and current subprocessor record, stands at 94.6% against a 95% amber floor, scenario
  figures.
- **Swiss side.** `SVC-0042-02`, the Swiss RepairDesk instance, and `SVC-0042-05`, the SIC and
  euroSIC adapter, are classified as significant outsourcing, wesentliche Auslagerung, with
  `TP-0042.1` Helvetia CloudWorks AG in Zurich as the hosting subcontractor. `REG-2026-0088` is in
  progress at entity level.

The Swiss lane then carries a further requirement with no EU counterpart in the scenario.
`OBL-2026-0088-002`, margin number 11, requires the bank to satisfy itself, where a subcontractor can
access client identifying data from outside Switzerland, that the access is necessary, that the data
categories are known and documented, and that the disclosure is permissible, and to record a dated
assessment with a named author. The same Meridian entity holds read access to payment metadata
including beneficiary name and reference fields, from Pune, unnotified, onboarded 01.05.2026.

This row is one of the five `isUnownedGap: true` rows. Its `gapNote` states the accountability
problem precisely, and it is the clearest expression of the entity boundary in the whole scenario:

> "No owner and no record... P-002 owns the group third-party relationship and is an ARC-DE employee
> acting under an intragroup arrangement, P-015 owns Swiss resilience rather than Swiss data access,
> and no ARC-CH role currently holds accountability for cross-border data access by a provider's
> subcontractors... The Swiss position must be reached on the Swiss framework alone and must not be
> inferred from whatever the EU entities decide about the same subcontractor."

The last sentence is the product's jurisdiction rule expressed as a scenario fact rather than as a
policy statement. Illustrative regulatory context, not legal advice.

### 6.4 A second divergence worth reading: the same tolerance, two frameworks

`OBL-2026-0104-001` (EU lane, Chapter 1 paragraph 6) requires that an impact tolerance be expressed
by a single measure, or that the instrument state which measure governs where measures disagree, and
that an institution unable to state which measure governs report that as a defect in the tolerance
rather than as an inconclusive incident.

Its extraction summary observes that `ITOL-0004-03` for `ARC-CH` carries two measures, a 2 hour
maximum tolerable disruption and completion of submission before the 16:00 CET cut-off, with no
precedence stated, and that on 06.10.2026 measure 1 says not breached while measure 2 says breached
by 11 minutes. It then closes with the lane discipline made explicit:

> "Note the lane: this is the EU-lane instrument, and the ARC-CH tolerance it happens to illuminate
> sits under the Swiss framework, so the candidate entities here are the EU entities and the Swiss
> position must be reached separately under REG-2026-0104-CH."

The Swiss counterpart, `OBL-2026-0104-004` (margin number 5), differs in **the protected object**:
the Swiss instrument protects critical business processes at the bank, while the EU lane protects
important business services. `ARC-CH` therefore designates `IBS-0004` Corporate Payments as a
significant business process under its own framework rather than inheriting the group designation.
The Swiss instrument also requires demonstration based on exercise or evidenced experience rather
than on documentation alone, which the summary notes is "now satisfiable in an uncomfortable way",
because the 06.10.2026 restoration is evidenced experience and it evidenced a 2 hour 11 minute
disruption against a 2 hour tolerance.

`docs/SCENARIO_BIBLE.md` invariant 11 requires that this two measure question is never resolved
within the scenario day. It is a defect in the tolerance definition, and the product's job is to
surface it, not to pick a measure.

---

## 7. Conventions

### 7.1 Time, dates and currency

| Convention | Value | Implementation |
|---|---|---|
| Time | 24 hour, `HH:MM`, displayed as CET | `momentToMinutes` and `minutesToMoment` (`src/domain/nfr/calculators.ts:251`, `:260`), which parse and emit zero padded 24 hour labels |
| Date | DD.MM.YYYY | `formatDateDach` (`src/domain/nfr/calculators.ts:273`), documented as "the DACH convention", using UTC parts so a timezone shift cannot move a date |
| Currency, `ARC-DE` and `ARC-AT` | EUR | `legalEntities[].currency` |
| Currency, `ARC-CH` | CHF | `legalEntities[].currency` |
| Group reporting currency | EUR | `docs/SCENARIO_BIBLE.md` section 3 |
| Amount formatting | de-DE grouping, two decimals, currency code suffixed | `formatAmount` (`src/domain/nfr/calculators.ts:282`), which divides minor units by 100 and calls `toLocaleString("de-DE", ...)`, producing for example `48.250,00 CHF` |
| Currency code | Always shown | `docs/SCENARIO_BIBLE.md` section 2 |

Amounts are stored as integer minor units and formatted at the edge, so no currency arithmetic is
done in floating point.

The scenario day is 06.10.2026, the scenario clock runs across ten fixed timeline moments, and the
shared event occurs at 14:05 (`SHARED_EVENT_MOMENT`, `src/scenario/engine/state.ts:45`).

### 7.2 The ASCII transliteration convention

`src/i18n/labels.ts:8` states the rule and the reason:

> German orthography note: display strings use correct German spelling with "ss" in place of the
> eszett, because the product renders these in a browser where the eszett is fine, but the codebase
> is kept ASCII safe so that encoding problems cannot silently corrupt seeded content. Umlauts are
> written as "ae", "oe" and "ue" for the same reason. This is a deliberate trade of typographic
> perfection for encoding safety.

Applied uniformly: `Unterstuetzen`, `Zurueckstellen`, `ausfuehren`, `Begruendung`, `Massnahme`,
`Ueberwachung`, `KI-Aktivitaet`, `Oesterreich`, `Vollstaendig wirksam`, `Moeglich`,
`Betriebskontinuitaetsmanagement`, `Geschaeftsdienstleistung`.

Why it exists, in engineering terms rather than editorial ones:

1. **The seeded content is very large and is the product's only source of truth.**
   `src/scenario/data/` is roughly 1.8 MB of TypeScript across ten files, including a 500 KB
   decisions file and a 368 KB evidence corpus. A single encoding mishap during an edit, a copy from
   a document, a tool that assumes latin1, or a Git configuration difference between machines could
   corrupt a run of characters in a file nobody reads end to end. Corruption in a scenario file would
   surface as mojibake in front of an audience, or worse, as a silently altered identifier.
2. **The copy gate scans for mojibake specifically.** `scripts/check-no-emdash.mjs:44` has a
   `mojibake` rule at `error` severity, with the label "Mojibake sequence. The file encoding is
   probably wrong." Its pattern matches the five classic UTF-8-read-as-latin1 signatures: a capital
   A with tilde followed by a high codepoint, the two three-byte sequences that a right single quote
   and a left double quote degrade into, a capital A with circumflex followed by a printable
   character, and the replacement character sequence. The sequences themselves are not reproduced in
   this document, because doing so would fail the gate this paragraph describes. Keeping the source
   ASCII means that rule has a clean signal rather than competing with legitimate high codepoints.
3. **The secret scanner reads files as latin1.** `scripts/scan-secrets.mjs:114` uses
   `readFileSync(file, "latin1")` so it can scan binary artefacts for embedded ASCII key material. An
   ASCII source tree is read identically under both encodings.
4. **The eszett choice is separately motivated.** "ss" is the Swiss convention, and the group contains
   a Swiss entity, so writing `Massnahme` rather than the eszett form keeps one spelling across all
   three entities (`docs/SCENARIO_BIBLE.md` section 18.4). This is the one case where the
   transliteration is also the correct regional orthography rather than a compromise.

The bible's note at section 18.4 says display surfaces "must not" transliterate umlauts, while
`src/i18n/labels.ts` does transliterate them in display strings. That is a genuine, unresolved
divergence between the specification and the implementation, and it is recorded in section 8.

### 7.3 Mandatory labels

Two labels are components rather than strings, so they cannot be forgotten on a surface that happens
to need them:

- `SyntheticLabel` (`src/components/evidence/primitives.tsx:140`) renders "Synthetic institution and
  data", German "Synthetische Institution und Daten".
- `RegulatoryNote` (`src/components/evidence/primitives.tsx:155`) renders
  "Illustrative regulatory context, not legal advice.", German
  "Illustrativer regulatorischer Kontext, keine Rechtsberatung." The docstring states the reason for
  making it a component: "so that it cannot be forgotten on a surface that happens to mention a
  regulation."

`evaluateRegulatoryLabel` (`src/agents/evaluations/suite.ts:315`) checks mechanically that every
seeded regulatory publication carries the exact English label in its summary or full text. A
companion evaluation checks that no seeded content claims regulatory compliance
(`src/agents/evaluations/suite.ts:351`).

---

## 8. The jurisdiction caveat

Stated plainly, because this is the section that matters most to a reader who might otherwise rely on
this product.

1. **Every regulatory instrument in this scenario is synthetic.** `REG-2026-0031-EU`,
   `REG-2026-0031-DE`, `REG-2026-0117-EU`, `REG-2026-0104-EU`, `REG-2026-0088` and `REG-2026-0104-CH`
   do not exist. Their issuing bodies (EFSCB, FOFMS, SFMOB) do not exist. Their references, paragraph
   numbers and margin numbers were written for this scenario so that an obligation can cite a real
   location in a document that can actually be opened and argued with. They are not paraphrases of
   real instruments and must not be read as such.

2. **The real instruments named in the corpus are named as context, not as analysis.** Where
   `src/scenario/data/evidence.ts` references Regulation (EU) 2022/2554, the European Banking
   Authority outsourcing guidelines, national minimum requirements for risk management or FINMA
   operational risk and resilience expectations, it does so to establish which framework a synthetic
   instrument sits alongside. No statement in this product is an interpretation of a real requirement.

3. **The product reaches no conclusion about applicability, and by design cannot.** All eighteen
   candidate obligations carry `applicabilityDecision: null`. Applicability, interpretation,
   ownership, materiality and implementation priority are listed as human owned decisions on the
   `regulatory-change` role and as decisions the specialist prompt must not take.

4. **The product asserts no compliance with anything, ever.** `SHARED_RULES` forbids it
   (`src/agents/prompts/system.ts:39`), the output guardrail flags four classes of compliance and
   guarantee claim (`src/agents/guardrails/index.ts:128`), and a structural evaluation checks the
   seeded content for compliance claims.

5. **DORA and EBA guidance apply, in this scenario, to `ARC-DE` and `ARC-AT` only.** `ARC-CH` is
   addressed through FINMA operational risk, resilience and outsourcing context, and nothing else.
   `docs/SCENARIO_BIBLE.md` invariant 4 states it as a build requirement: "No `ARC-CH` record, view,
   field or narration references DORA as applicable. Group aggregate views show `ARC-CH` with its own
   framework references or an explicit not-applicable."

6. **Nothing in this product notifies, contacts or files with any authority.**
   `notifySupervisor` is a registered PROHIBITED tool whose refusal reason is "Contacting a
   supervisory authority is refused by design. The product only records a recommendation."
   `recordNotificationRecommendation` carries the description "Records a recommendation about
   supervisory notification. Never notifies anyone."

7. **This is a prototype built on synthetic data for a demonstration.** It is not a compliance
   system, not a regulatory reporting system and not a source of legal or regulatory advice.

**Illustrative regulatory context, not legal advice.**

---

## 9. Limitations

1. **The `de` jurisdiction value has no bloc of its own.** `REG-2026-0031-DE` carries
   `jurisdiction: "de"`, while entities carry `regulatoryBloc` of `eu` or `ch`. The mechanical
   jurisdiction check at `src/agents/evaluations/suite.ts:293` filters publications on
   `jurisdiction !== "ch"`, so a national EU lane publication is correctly excluded from the Swiss
   test, but there is no corresponding check that a `de` publication is not scoped against `ARC-AT`.
   That scoping is currently correct in the data and is held only by the data, not by a test.

2. **The mechanical check is a keyword test, not semantic.** `euOnlyTerms` matches three strings:
   `DORA`, `Regulation (EU) 2022/2554` and `EBA`. Swiss scoped content that described an EU
   requirement without naming any of the three would pass. The negation list is equally literal: a
   sentence stating non-application in different words, or a sentence stating application in the same
   paragraph as an unrelated negation, would be graded wrongly in either direction.

3. **`Wesentlichkeit` does not appear anywhere in `src/`.** The bible lists
   Materiality / Wesentlichkeit as a mandatory pair. The German forms actually present are
   `Wesentliche Auslagerung`, `wesentliche Luecke` and `Wesentlich` as an adjective in decision option
   labels. There is no `materiality` entry in any dictionary in `src/i18n/labels.ts`, so a German
   surface showing a materiality decision has no paired term to render.

4. **Three different German labels exist for the same effectiveness band.**
   `src/domain/nfr/calculators.ts:64` uses `Vollstaendig wirksam` for `fully-effective`, while the
   bible records `Voll wirksam` on the first line self assessment scale and `Wirksam` on the second
   line scale. The bible intends two of those as a deliberate scenario defect. The third, in the
   calculator, is not identified as intentional anywhere and is more likely an inconsistency.

5. **The bible and the implementation disagree on umlaut transliteration in display strings.**
   Section 18.4 says display surfaces must use correct German spelling with umlauts;
   `src/i18n/labels.ts` transliterates them and cites `docs/ASSUMPTIONS.md`. The implementation is
   internally consistent and the specification is not followed. This should be resolved explicitly
   rather than left as two documents saying different things.

6. **German coverage is partial and unbalanced.** `src/i18n/labels.ts` covers roughly 90 interface
   strings. The evidence corpus, extraction summaries, gap notes, incident narratives and every
   specialist prompt are English only. A German language session therefore presents German chrome
   around English substance. The scope is stated in the file header, so this is a declared boundary
   rather than an oversight, but it is a real limit on the DACH claim.

7. **The guardrails are English only.** All five input patterns and all output patterns in
   `src/agents/guardrails/index.ts` are English regular expressions. A German language prompt
   injection attempt, credential request or overclaim would not match. The authority gate is
   language independent, so this is a hygiene gap rather than a boundary gap, but it is asymmetric
   between the two languages the product offers.

8. **Retrieval is weaker in German.** `toFtsQuery` (`src/server/retrieval/search.ts:71`) applies a 34
   word English stop list and no stemming. German compounds are not decomposed, so a query for
   `Auslagerungsverzeichnis` will not match a chunk containing `Auslagerung` and `Verzeichnis`
   separately.

9. **`EXT-NOVALINK` is used as an `entityId` for two supplier contacts**
   (`src/scenario/data/institution.ts:224` and `:237`), but it is not a row in `legalEntities`. Any
   code path that resolves a user's entity to a `legal_entities` record will find nothing for those
   two people. `getEntity` returns undefined and the callers fall back to the raw identifier, so this
   degrades rather than throws.

10. **The 3LoD line exists in the data model and is not playable.** Internal Audit is present as
    P-017 with `line: "3lod"` and is explicitly out of scope as a user role. A bank reviewing the
    three lines claim should read it as "two lines implemented, third line represented as a
    stakeholder".

11. **There is no per entity currency enforcement at the write path.** `formatAmount` takes a currency
    argument from the caller. Nothing prevents a record scoped to `ARC-CH` from carrying an EUR
    amount; the seeded data is correct by construction and no invariant checks it.

12. **Reconciliation invariants are documented but not tested.**
    `docs/SCENARIO_BIBLE.md` invariant 12 states several arithmetic reconciliations that must hold in
    the seeded data, for example that 138 overrides decompose into 96 plus 29 plus 13, and that
    EUR 9,420,880 decomposes into EUR 7,611,240 plus EUR 1,809,640 across the German and Austrian
    entities. No structural evaluation currently checks those sums, so a future data edit could break
    a stated entity split silently.

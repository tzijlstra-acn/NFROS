/**
 * Seed data for the RCSA stages.
 *
 * Stage 4 (First-line Input) reads the first line's own written positions on
 * the controls in scope. The corpus held one of them, the control owner's
 * self-assessment of CTL-PAY-014 (EVD-2026-41855), and the management
 * response on the test of the same control. The other key lines of the Q4
 * assessment had none, so a first-line review would have had one position to
 * classify and nothing to compare it with. This module adds the three
 * submissions the Q4 cycle would have collected on the other lines in scope,
 * in the same form and register as EVD-2026-41855:
 *
 *   CTL-PAY-031 cut-off monitoring, for RSK-0212, held largely effective by
 *   the process owner against a partially effective draft, and resting on the
 *   06.08.2026 release that the test schedule records as reviewed after it
 *   was released (EXC-TST-2026-0318-02);
 *
 *   CTL-PAY-044 reviewer establishment monitoring, for RSK-0371, held
 *   partially effective by the process owner, in agreement with the draft,
 *   and relying on the recruitment MSN-2026-0166 that is overdue;
 *
 *   CTL-PAY-008 duplicate detection, for RSK-0214, held fully effective by
 *   the control owner, in agreement with the draft and the June test.
 *
 * Each position matches the first-line effectiveness the control register
 * already records for that control, so the submission and the register cannot
 * disagree. Each is a stakeholder statement and stays attributed as one.
 *
 * Inside the seed transaction, before the process engine captures its safe
 * mode digests, because Stage 2 reads the same corpus. Deterministic: no
 * clock, no random values. Synthetic institution and data.
 */

import { DEFAULT_RUN_ID, ENTITY_AT, ENTITY_DE } from "@/scenario/data/contract";
import { getDb } from "@/db/client";
import { evidenceChunks, evidenceDocuments } from "@/db/schema/work";

type NewEvidenceDocument = typeof evidenceDocuments.$inferInsert;

const ASSESSMENT = "RCSA-ARC-DE-PAYOPS-2026-Q4";

export const rcsaFirstLineSubmissions: NewEvidenceDocument[] = [
  {
    id: "EVD-2026-RCSA-1L-01",
    runId: DEFAULT_RUN_ID,
    reference: `${ASSESSMENT} CTL-PAY-031 1LoD`,
    title: "First line control self-assessment, CTL-PAY-031 cut-off monitoring, Q4 2026 cycle, recorded by the process owner",
    titleDe: "Kontrollselbstbewertung der ersten Linie, CTL-PAY-031 Ueberwachung der Annahmeschluesse, Zyklus Q4 2026",
    sourceType: "rcsa-extract",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Andreas Kellner, Head of Payment Operations, process owner",
    authorUserId: "P-007",
    documentDate: "2026-09-30",
    ingestedAt: "2026-09-30T16:20:00.000Z",
    entityIds: [ENTITY_DE, ENTITY_AT],
    dataClassification: "internal",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "stakeholder-statement",
    body:
      "FIRST LINE CONTROL SELF-ASSESSMENT. Control CTL-PAY-031, cut-off monitoring for same-day payments. Assessment cycle Q4 2026. Recorded 30.09.2026 by the process owner.\n\n" +
      "Assessment. Control Effectiveness: Largely Effective / Weitgehend wirksam.\n\n" +
      "Basis of assessment, as recorded by the process owner. Cut-off monitoring surfaced every item approaching a value-date cut-off in the period, and the team chose a response for each one. Release under override is one of the four approved responses, and it is chosen when holding the payment would breach the client's value date. The rise in cut-off driven overrides from 94 in August to 211 in September reflects the five fallback days in September, not a failure of the monitoring. Scenario figures.\n\n" +
      "On the release of 06.08.2026. The item was released to meet the cut-off and reviewed immediately afterwards; the payment was correct. The control monitors the pressure and does not itself perform the review, so the timing of the review is not a matter for this control.\n\n" +
      "Process owner declaration. I confirm that CTL-PAY-031 operated as described throughout the assessment period. I do not accept the partially effective position in the second line pre-read of 02.10.2026.\n\n" +
      "Second line note appended 01.10.2026. Not agreed. The control offers release under override with no constraint on choosing it when no reviewer is available, and EXC-TST-2026-0318-02 was released 11 minutes and 19 seconds before its review.",
    summary:
      "The process owner's own Q4 assessment of CTL-PAY-031 as largely effective, holding that release under override is an approved response to cut-off pressure and that the late review of 06.08.2026 is not a matter for this control.",
    relatedObjectIds: ["CTL-PAY-031", "RSK-0212", ASSESSMENT, "EXC-TST-2026-0318-02", "KRI-PAY-016"],
    pageCount: 2,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },
  {
    id: "EVD-2026-RCSA-1L-02",
    runId: DEFAULT_RUN_ID,
    reference: `${ASSESSMENT} CTL-PAY-044 1LoD`,
    title: "First line control self-assessment, CTL-PAY-044 reviewer establishment monitoring, Q4 2026 cycle, recorded by the process owner",
    titleDe: "Kontrollselbstbewertung der ersten Linie, CTL-PAY-044 Ueberwachung der Prueferbesetzung, Zyklus Q4 2026",
    sourceType: "rcsa-extract",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Andreas Kellner, Head of Payment Operations, process owner",
    authorUserId: "P-007",
    documentDate: "2026-09-30",
    ingestedAt: "2026-09-30T16:35:00.000Z",
    entityIds: [ENTITY_DE],
    dataClassification: "internal",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "stakeholder-statement",
    body:
      "FIRST LINE CONTROL SELF-ASSESSMENT. Control CTL-PAY-044, monitoring of the secondary reviewer establishment. Assessment cycle Q4 2026. Recorded 30.09.2026 by the process owner.\n\n" +
      "Assessment. Control Effectiveness: Partially Effective / Teilweise wirksam.\n\n" +
      "Basis of assessment, as recorded by the process owner. The establishment is monitored accurately and reported monthly. Six of eight approved seats have been filled since 01.08.2026 following the resignation from position PR-SR-02. The control is rated partially effective because monitoring the gap does not close it.\n\n" +
      "Recruitment. Recruitment to PR-SR-02 is in progress under MSN-2026-0166. A start date is expected this quarter, after which the control is expected to return to largely effective.\n\n" +
      "Process owner declaration. I confirm the position above and the expected recovery.",
    summary:
      "The process owner's own Q4 assessment of CTL-PAY-044 as partially effective, in agreement with the second line, with the expectation that recruitment under MSN-2026-0166 brings a start date this quarter.",
    relatedObjectIds: ["CTL-PAY-044", "RSK-0371", ASSESSMENT, "MSN-2026-0166", "KRI-PAY-011"],
    pageCount: 1,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },
  {
    id: "EVD-2026-RCSA-1L-03",
    runId: DEFAULT_RUN_ID,
    reference: `${ASSESSMENT} CTL-PAY-008 1LoD`,
    title: "First line control self-assessment, CTL-PAY-008 duplicate detection, Q4 2026 cycle, recorded by the control owner",
    titleDe: "Kontrollselbstbewertung der ersten Linie, CTL-PAY-008 Dublettenerkennung, Zyklus Q4 2026",
    sourceType: "rcsa-extract",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Beatrix Hofmann, Payment Repair Team Lead, control owner",
    authorUserId: "P-008",
    documentDate: "2026-09-29",
    ingestedAt: "2026-09-29T17:55:00.000Z",
    entityIds: [ENTITY_DE, ENTITY_AT],
    dataClassification: "internal",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "stakeholder-statement",
    body:
      "FIRST LINE CONTROL SELF-ASSESSMENT. Control CTL-PAY-008, duplicate detection on repair items. Assessment cycle Q4 2026. Recorded 29.09.2026 by the control owner.\n\n" +
      "Assessment. Control Effectiveness: Fully Effective / Voll wirksam.\n\n" +
      "Basis of assessment, as recorded by the control owner. Every item flagged as a suspected duplicate in the period was compared with the prior instruction by an analyst before release, and no duplicate release was recorded in the quarter. The June 2026 test of the control found no deviation.\n\n" +
      "Control owner declaration. I confirm that CTL-PAY-008 operated as described throughout the assessment period.",
    summary:
      "The control owner's own Q4 assessment of CTL-PAY-008 as fully effective, in agreement with the second line and the June 2026 test.",
    relatedObjectIds: ["CTL-PAY-008", "RSK-0214", ASSESSMENT],
    pageCount: 1,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },
];

/** Writes the submissions and one retrieval chunk per paragraph group. Returns the rows written. */
export function seedRcsaStageSources(runId: string = DEFAULT_RUN_ID): number {
  let written = 0;
  for (const document of rcsaFirstLineSubmissions) {
    getDb().insert(evidenceDocuments).values({ ...document, runId }).run();
    const paragraphs = document.body.split(/\n\s*\n/).map((part) => part.trim()).filter((part) => part.length > 0);
    paragraphs.forEach((content, index) => {
      getDb()
        .insert(evidenceChunks)
        .values({
          id: `${document.id}-C${String(index).padStart(2, "0")}`,
          runId,
          documentId: document.id,
          chunkIndex: index,
          locator: `Section ${index + 1}`,
          content,
          embedding: null,
          embeddingModel: null,
          embeddedAt: null,
          tokenEstimate: Math.ceil(content.length / 4),
        })
        .run();
    });
    written += 1 + paragraphs.length;
  }
  return written;
}

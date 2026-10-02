/**
 * Decisions.
 *
 * The decision flow itself is reused unchanged. It is the most carefully built
 * component in the repository: it holds the rationale field, the confirmation
 * that the rationale is the accountable person's own, the option comparison,
 * the supporting and opposing evidence, and the execution receipt. The
 * authority gate refuses every material change without that confirmation, and
 * the engine checks it a second time independently. None of that is
 * presentation and none of it should be re-implemented for a new visual
 * system.
 *
 * What changes here is the frame around it. V1 opened with a title and a lede
 * and then listed every decision expanded. This opens with the count that
 * matters, puts the open decisions first, and collapses the decided ones,
 * because a decision already taken is a record rather than a task.
 */

import {
  getDecision,
  getDecisions,
  getExecutionReceipt,
  getUser,
} from "@/db/repositories/workday";
import { citationsFor } from "@/db/repositories/rail";
import type { RoleId } from "@/db/schema/core";
import { DecisionFlow } from "@/components/decisions/DecisionFlow";
import { toDecisionView } from "@app/workday/[role]/v1";
import type { Language } from "@/i18n/labels";
import { Chip, Empty, RegulatoryNote, SectionHead } from "../primitives";
import { Disclosure } from "../interactive";

export function DecisionsSection({
  roleId,
  atMoment,
  language,
  holderUserId,
}: {
  roleId: RoleId;
  atMoment: string;
  language: Language;
  holderUserId: string;
}) {
  const entries = getDecisions(roleId, atMoment);
  const open = entries.filter((entry) => entry.decision.status === "open");
  const decided = entries.filter((entry) => entry.decision.status !== "open");
  const holder = getUser(holderUserId);

  if (entries.length === 0) {
    return (
      <Empty
        title={language === "de" ? "Keine Entscheidungen an diesem Punkt" : "No decisions at this point"}
        detail={
          language === "de"
            ? "Bewegen Sie den Tag vorwaerts, bis das Urteil dieser Rolle gefragt ist."
            : "Move the day forward to reach the next point where this role's judgment is required."
        }
      />
    );
  }

  const renderFlow = (decisionId: string) => {
    const loaded = getDecision(decisionId);
    if (!loaded) return null;

    /*
     * Supporting and opposing evidence are kept in separate arrays all the way
     * from the seed to the component. Merging them into one list would be the
     * single most damaging simplification available in this product: the
     * difference between evidence that supports a position and evidence that
     * contradicts it is the thing a second line function exists to see.
     */
    return (
      <DecisionFlow
        decision={toDecisionView(loaded.decision)}
        options={loaded.options}
        supportingEvidence={citationsFor(loaded.decision.supportingEvidenceIds ?? [])}
        opposingEvidence={citationsFor(loaded.decision.opposingEvidenceIds ?? [])}
        receiptStatements={getExecutionReceipt(decisionId).map((line) => line.statement)}
        language={language}
        actingUserName={holder?.name ?? holderUserId}
      />
    );
  };

  const mentionsRegulation = entries.some((entry) => toDecisionView(entry.decision).mentionsRegulation);

  return (
    <div className="app-stack-5">
      <p className="app-one-line">
        {language === "de"
          ? `${open.length} offene Entscheidungen, ${decided.length} heute erfasst. Jede wesentliche Entscheidung verlangt, dass Sie die Begruendung als Ihre eigene bestaetigen.`
          : `${open.length} open, ${decided.length} recorded today. Every material decision requires you to confirm the rationale is your own.`}
      </p>
      {mentionsRegulation ? <RegulatoryNote language={language} /> : null}

      {open.length > 0 ? (
        <section className="app-section">
          <SectionHead
            title={language === "de" ? "Ihre Entscheidungen" : "Your decisions"}
            count={open.length}
            trailing={<Chip tone="warning">{language === "de" ? "offen" : "open"}</Chip>}
          />
          <div className="app-stack-4">
            {open.map((entry) => (
              <div key={entry.decision.id} id={entry.decision.id}>
                {renderFlow(entry.decision.id)}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {decided.length > 0 ? (
        <section className="app-section">
          <Disclosure
            label={language === "de" ? "Heute erfasst" : "Recorded today"}
            count={decided.length}
          >
            <div className="app-stack-4">
              {decided.map((entry) => (
                <div key={entry.decision.id} id={entry.decision.id}>
                  {renderFlow(entry.decision.id)}
                </div>
              ))}
            </div>
          </Disclosure>
        </section>
      ) : null}
    </div>
  );
}

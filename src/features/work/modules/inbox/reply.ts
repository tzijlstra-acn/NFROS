/**
 * The reply draft: what the AI Partner proposes the person says back.
 *
 * Pure. Composed from the message and from what has actually been done with
 * it (the action it became and its owner and date, the document it was filed
 * as, the stage it joined, the colleague it went to), so the draft never
 * promises something nobody has done. When nothing has been done yet it says
 * the person will come back, by the message's own deadline when it has one,
 * and invents no date. The draft is validated like every AI output
 * (`validateReplyDraft`), is labelled a draft, and is sent only by the
 * person, as a simulated message.
 */

import type { Language } from "@/i18n/labels";
import { displayDate, dateOf, firstLine } from "../../model";

export interface ReplyFacts {
  language: Language;
  /** The sender's first name, or the sender label when there is no person. */
  addressee: string;
  subject: string;
  receivedOn: string;
  respondBy: string | null;
  /** The person who holds the role and signs the reply. */
  signer: string;
  duplicateOf: string | null;
  action: { id: string; title: string; owner: string | null; dueOn: string | null } | null;
  evidence: { id: string; objects: string[] } | null;
  stage: { process: string; stage: string } | null;
  delegatedTo: string | null;
  decision: { id: string } | null;
}

/** The first name of a person's display name, without an academic title. */
export function firstNameOf(name: string): string {
  const parts = name
    .replace(/,.*$/, "")
    .split(/\s+/)
    .filter((part) => part.length > 0 && !/^(Dr|Prof|Mag)\.?$/i.test(part));
  return parts[0] ?? name;
}

export function composeReply(facts: ReplyFacts): { subject: string; body: string } {
  const de = facts.language === "de";
  const subjectLine = firstLine(facts.subject, 180);
  const lines: string[] = [];

  lines.push(de ? `Guten Tag ${facts.addressee},` : `Dear ${facts.addressee},`);
  lines.push("");
  lines.push(
    de
      ? `vielen Dank fuer Ihre Nachricht vom ${displayDate(dateOf(facts.receivedOn))} zu "${subjectLine}".`
      : `Thank you for your message of ${displayDate(dateOf(facts.receivedOn))} about "${subjectLine}".`,
  );

  const done: string[] = [];
  if (facts.action) {
    const owner = facts.action.owner ? (de ? `, verantwortet von ${facts.action.owner}` : `, owned by ${facts.action.owner}`) : "";
    const due = facts.action.dueOn ? (de ? `, faellig am ${displayDate(facts.action.dueOn)}` : `, due ${displayDate(facts.action.dueOn)}`) : "";
    done.push(
      de
        ? `Ich habe dazu die Massnahme ${facts.action.id} "${firstLine(facts.action.title, 120)}" erfasst${owner}${due}.`
        : `I have raised action ${facts.action.id}, "${firstLine(facts.action.title, 120)}"${owner}${due}.`,
    );
  }
  if (facts.evidence) {
    const objects = facts.evidence.objects.length > 0 ? facts.evidence.objects.join(", ") : null;
    done.push(
      de
        ? `Ich habe sie als Nachweis ${facts.evidence.id}${objects ? ` zu ${objects}` : ""} abgelegt.`
        : `I have filed it as evidence ${facts.evidence.id}${objects ? ` against ${objects}` : ""}.`,
    );
  }
  if (facts.stage) {
    done.push(
      de
        ? `Sie ist jetzt Teil von ${facts.stage.process}, Stufe ${facts.stage.stage}.`
        : `It is now part of ${facts.stage.process}, stage ${facts.stage.stage}.`,
    );
  }
  if (facts.delegatedTo) {
    done.push(de ? `Ich habe sie zur weiteren Bearbeitung an ${facts.delegatedTo} weitergegeben.` : `I have passed it to ${facts.delegatedTo}, who will pick it up.`);
  }
  if (facts.decision) {
    done.push(
      de
        ? `Sie fliesst in die Entscheidung ${facts.decision.id} ein, die dort mit ihren Nachweisen getroffen wird.`
        : `It goes to decision ${facts.decision.id}, which is taken there with its evidence.`,
    );
  }
  if (done.length === 0) {
    done.push(
      facts.respondBy
        ? de
          ? `Ich melde mich bis ${displayDate(dateOf(facts.respondBy))} mit einer Antwort.`
          : `I will come back to you by ${displayDate(dateOf(facts.respondBy))}.`
        : de
          ? "Ich melde mich mit einer Antwort, sobald ich sie geprueft habe."
          : "I will come back to you once I have reviewed it.",
    );
  }
  if (facts.duplicateOf) {
    done.push(
      de
        ? `Dieselbe Anfrage liegt bereits als ${facts.duplicateOf} vor; eine Antwort deckt beide ab.`
        : `The same request is already open as ${facts.duplicateOf}; one answer will cover both.`,
    );
  }

  lines.push(...done);
  lines.push("");
  lines.push(de ? "Freundliche Gruesse" : "Kind regards,");
  lines.push(facts.signer);

  return {
    subject: `${de ? "AW" : "Re"}: ${subjectLine}`,
    body: lines.join("\n"),
  };
}

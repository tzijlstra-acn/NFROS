/**
 * Mail, as work rather than as a list of messages.
 *
 * The V1 route opened with a title, a lede and a grid of triage counts, then
 * the messages. This opens with the one line that matters, which is how much
 * of the inbox has already been turned into something, and then the messages
 * as rows grouped by what they became.
 *
 * The grouping is the argument. A message that produced a decision, a message
 * that produced an action and a message that was a duplicate of a request
 * already answered are three different kinds of thing, and presenting them in
 * arrival order as the mail client does is the work the professional currently
 * has to do by hand every morning.
 */

import { getInbox, getUserNameMap } from "@/db/repositories/workday";
import type { RoleId } from "@/db/schema/core";
import type { Language } from "@/i18n/labels";
import { Chip, Data, Empty, Item, List, ObjectRef, SectionHead, type Tone } from "../primitives";
import { Disclosure } from "../interactive";

const TRIAGE_ORDER = ["decision", "action", "evidence", "information", "delegate", "noise"] as const;
type Triage = (typeof TRIAGE_ORDER)[number];

const TRIAGE_LABELS: Record<Triage, { en: string; de: string }> = {
  decision: { en: "Became a decision for you", de: "Wurde eine Entscheidung fuer Sie" },
  action: { en: "Became an action", de: "Wurde eine Massnahme" },
  evidence: { en: "Became evidence", de: "Wurde ein Nachweis" },
  information: { en: "Noted, no action needed", de: "Vermerkt, keine Massnahme" },
  delegate: { en: "Routed to someone else", de: "An jemand anderen weitergeleitet" },
  noise: { en: "Set aside", de: "Zurueckgestellt" },
};

const TRIAGE_TONE: Record<Triage, Tone> = {
  decision: "warning",
  action: "info",
  evidence: "success",
  information: "neutral",
  delegate: "info",
  noise: "neutral",
};

export function MailSection({
  roleId,
  atMoment,
  language,
}: {
  roleId: RoleId;
  atMoment: string;
  language: Language;
}) {
  const inbox = getInbox(roleId, atMoment);
  const names = getUserNameMap();

  const byTriage = new Map<Triage, typeof inbox>();
  for (const message of inbox) {
    const triage = (TRIAGE_ORDER as readonly string[]).includes(message.proposedTriage)
      ? (message.proposedTriage as Triage)
      : "information";
    const bucket = byTriage.get(triage);
    if (bucket) bucket.push(message);
    else byTriage.set(triage, [message]);
  }

  const needsYou = (byTriage.get("decision") ?? []).length;
  const handled = inbox.length - needsYou;
  const duplicates = inbox.filter((message) => message.isDuplicateOf !== null).length;

  if (inbox.length === 0) {
    return (
      <Empty
        title={language === "de" ? "Noch keine Post" : "No mail yet"}
        detail={
          language === "de"
            ? "Bewegen Sie den Tag vorwaerts, bis Nachrichten eintreffen."
            : "Move the day forward until messages arrive."
        }
      />
    );
  }

  return (
    <div className="app-stack-5">
      {/*
        * One line, not a paragraph. It answers the only question a
        * professional has when opening their inbox at the start of a day.
        */}
      <p className="app-one-line">
        {language === "de"
          ? `${inbox.length} Nachrichten eingegangen. ${handled} wurden bereits zu Arbeit verarbeitet, ${needsYou} benoetigen Ihre Entscheidung.`
          : `${inbox.length} messages arrived. ${handled} were already turned into work, ${needsYou} need your decision.`}
        {duplicates > 0
          ? language === "de"
            ? ` ${duplicates} waren Wiederholungen bereits beantworteter Anfragen.`
            : ` ${duplicates} were repeats of requests already answered.`
          : ""}
      </p>

      {TRIAGE_ORDER.map((triage) => {
        const messages = byTriage.get(triage);
        if (!messages || messages.length === 0) return null;

        const heading = language === "de" ? TRIAGE_LABELS[triage].de : TRIAGE_LABELS[triage].en;

        const rows = (
          <List label={heading}>
            {messages.map((message) => (
              <Item
                key={message.id}
                large
                title={message.subject}
                subtitle={
                  <>
                    {names.get(message.fromUserId ?? "") ?? message.fromLabel}
                    {" · "}
                    {message.channel}
                    {message.isDuplicateOf
                      ? language === "de"
                        ? " · Wiederholung"
                        : " · repeat request"
                      : ""}
                  </>
                }
                leading={<Data>{message.revealedAtMoment}</Data>}
                trailing={
                  <>
                    {message.requiresResponseBy ? (
                      <Chip tone="warning">
                        {language === "de" ? "Antwort faellig" : "reply due"}
                      </Chip>
                    ) : null}
                    <ObjectRef id={message.id} label="message" />
                  </>
                }
              >
                {/*
                  * The triage rationale is shown inline rather than hidden,
                  * because the user has to be able to disagree with it. A
                  * classification the user cannot see is a classification the
                  * user cannot challenge.
                  */}
                {message.triageRationale ? (
                  <span className="app-meta app-clamp-2" style={{ marginTop: 2 }}>
                    {message.triageRationale}
                  </span>
                ) : null}
              </Item>
            ))}
          </List>
        );

        /*
          * Only the decisions group is open by default. The rest are
          * collapsed, which is the whole point: the inbox has already been
          * dealt with and the professional should not have to scroll past it.
          */
        return (
          <section key={triage} className="app-section">
            {triage === "decision" ? (
              <>
                <SectionHead
                  title={heading}
                  count={messages.length}
                  trailing={<Chip tone={TRIAGE_TONE[triage]}>{messages.length}</Chip>}
                />
                {rows}
              </>
            ) : (
              <Disclosure label={heading} count={messages.length}>
                {rows}
              </Disclosure>
            )}
          </section>
        );
      })}
    </div>
  );
}

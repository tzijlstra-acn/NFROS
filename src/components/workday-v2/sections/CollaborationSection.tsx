/**
 * Collaboration.
 *
 * Grouped by channel, with the message and any reply on one row rather than
 * two. The simulated-only marker is kept, and kept quiet: every message in
 * this product is simulated, nothing is ever sent, and the interface says so
 * once per channel rather than stamping it on each line.
 */

import {
  getCollaborationMessages,
  getUserNameMap,
} from "@/db/repositories/workday";
import type { RoleId } from "@/db/schema/core";
import { momentToMinutes } from "@/domain/nfr/calculators";
import type { Language } from "@/i18n/labels";
import { Chip, Data, Empty, Item, List, Notice, ObjectRef, SectionHead } from "../primitives";

export function CollaborationSection({
  roleId,
  atMoment,
  language,
}: {
  roleId: RoleId;
  atMoment: string;
  language: Language;
}) {
  const names = getUserNameMap();
  const minutes = momentToMinutes(atMoment);
  const messages = getCollaborationMessages(roleId).filter(
    (message) => momentToMinutes(message.sentAtMoment) <= minutes,
  );

  if (messages.length === 0) {
    return (
      <Empty
        title={language === "de" ? "Noch keine Nachrichten" : "No messages yet"}
        detail={
          language === "de"
            ? "Nachrichten entstehen, wenn Arbeit eine Abstimmung erfordert."
            : "Messages appear when a piece of work needs someone else."
        }
      />
    );
  }

  const byChannel = new Map<string, typeof messages>();
  for (const message of messages) {
    const bucket = byChannel.get(message.channelName);
    if (bucket) bucket.push(message);
    else byChannel.set(message.channelName, [message]);
  }

  const awaitingReply = messages.filter((message) => message.replyBody.length === 0).length;

  return (
    <div className="app-stack-5">
      <p className="app-one-line">
        {language === "de"
          ? `${messages.length} Nachrichten in ${byChannel.size} Kanaelen. ${awaitingReply} warten noch auf eine Antwort.`
          : `${messages.length} messages across ${byChannel.size} channels. ${awaitingReply} are still waiting for a reply.`}
      </p>

      <Notice>
        {language === "de"
          ? "Jede Nachricht hier ist simuliert. Es wird nichts gesendet und es verlaesst nichts diese Anwendung."
          : "Every message here is simulated. Nothing is sent and nothing leaves this application."}
      </Notice>

      {[...byChannel.entries()].map(([channel, channelMessages]) => (
        <section key={channel} className="app-section">
          <SectionHead title={channel} count={channelMessages.length} />
          <List label={channel}>
            {channelMessages.map((message) => (
              <Item
                key={message.id}
                large
                leading={<Data>{message.sentAtMoment}</Data>}
                title={message.subject}
                subtitle={
                  <>
                    {language === "de" ? "an " : "to "}
                    {message.toUserIds
                      .map((id) => names.get(id) ?? id)
                      .slice(0, 3)
                      .join(", ")}
                    {message.toUserIds.length > 3 ? ` +${message.toUserIds.length - 3}` : ""}
                  </>
                }
                trailing={
                  message.replyBody.length > 0 ? (
                    <Chip tone="success">
                      {language === "de" ? "beantwortet" : "answered"}
                    </Chip>
                  ) : (
                    <Chip tone="warning">
                      {language === "de" ? "offen" : "open"}
                    </Chip>
                  )
                }
              >
                <span className="app-meta app-clamp-2" style={{ marginTop: 3 }}>
                  {message.body}
                </span>

                {/*
                  * A seeded reply is shown inline and attributed, because the
                  * point of this surface is that asynchronous validation
                  * actually came back from a named person rather than the
                  * question simply having been asked.
                  */}
                {message.replyBody.length > 0 ? (
                  <span
                    className="app-notice"
                    style={{ marginTop: "var(--app-2)", display: "flex" }}
                  >
                    <span>
                      <span className="app-strong">
                        {names.get(message.replyFromUserId ?? "") ?? message.replyFromUserId}
                      </span>
                      {message.replyAtMoment ? (
                        <span className="app-faint"> {message.replyAtMoment}</span>
                      ) : null}
                      <span style={{ display: "block", marginTop: 2 }}>{message.replyBody}</span>
                    </span>
                  </span>
                ) : null}

                {message.relatedObjectId ? (
                  <span className="app-row" style={{ marginTop: "var(--app-2)" }}>
                    <span className="app-faint" style={{ fontSize: "var(--app-text-2xs)" }}>
                      {message.relatedObjectKind}
                    </span>
                    <ObjectRef id={message.relatedObjectId} />
                  </span>
                ) : null}
              </Item>
            ))}
          </List>
        </section>
      ))}
    </div>
  );
}

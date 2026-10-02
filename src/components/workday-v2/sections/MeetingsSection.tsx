/**
 * Meetings.
 *
 * Each meeting shows its objective, the preparation the partner assembled, the
 * challenge questions prepared as editable drafts, and the transcript when one
 * has run.
 *
 * The prepared questions matter more than they look. They are drafts for the
 * professional to edit, not a script to read, and the copy says so. A product
 * that handed a second line risk manager their challenge questions as
 * finished output would be taking over the one part of the job that is
 * irreducibly theirs.
 */

import {
  getEvidenceDocument,
  getMeeting,
  getMeetingMessages,
  getMeetings,
  getUserNameMap,
} from "@/db/repositories/workday";
import type { RoleId } from "@/db/schema/core";
import type { Language } from "@/i18n/labels";
import {
  Card,
  Chip,
  Data,
  Empty,
  Item,
  List,
  ObjectRef,
  SectionHead,
} from "../primitives";
import { Disclosure } from "../interactive";

const STATUS_LABELS: Record<string, { en: string; de: string }> = {
  "not-started": { en: "not started", de: "nicht begonnen" },
  "in-progress": { en: "running", de: "laeuft" },
  concluded: { en: "concluded", de: "abgeschlossen" },
};

export function MeetingsSection({
  roleId,
  language,
}: {
  roleId: RoleId;
  language: Language;
}) {
  const meetings = getMeetings(roleId);
  const names = getUserNameMap();

  if (meetings.length === 0) {
    return <Empty title={language === "de" ? "Keine Besprechungen heute" : "No meetings today"} />;
  }

  return (
    <div className="app-stack-5">
      <p className="app-one-line">
        {language === "de"
          ? `${meetings.length} Besprechungen. Vorbereitung und Fragen sind Entwuerfe zur Bearbeitung, kein Skript.`
          : `${meetings.length} meetings. The preparation and the questions are drafts for you to edit, not a script.`}
      </p>

      {meetings.map((summary) => {
        const meeting = getMeeting(summary.id) ?? summary;
        const turns = getMeetingMessages(meeting.id);
        const status = STATUS_LABELS[meeting.status] ?? STATUS_LABELS["not-started"];

        return (
          <section key={meeting.id} id={meeting.id} className="app-section">
            <SectionHead
              title={language === "de" && meeting.titleDe ? meeting.titleDe : meeting.title}
              trailing={
                <span className="app-row">
                  <Data>{meeting.momentLabel}</Data>
                  <Chip
                    tone={
                      meeting.status === "concluded"
                        ? "success"
                        : meeting.status === "in-progress"
                          ? "info"
                          : "neutral"
                    }
                  >
                    {language === "de" ? status?.de : status?.en}
                  </Chip>
                  {meeting.supportsVoice ? (
                    <Chip tone="ai">{language === "de" ? "Sprache" : "voice"}</Chip>
                  ) : null}
                </span>
              }
            />

            <div className="app-stack-3">
              <p className="app-one-line">{meeting.objective}</p>

              <div className="app-row app-row-wrap">
                <span className="app-meta">
                  {language === "de" ? "Teilnehmende" : "Participants"}:
                </span>
                {meeting.participantUserIds.map((id) => (
                  <Chip key={id}>{names.get(id) ?? id}</Chip>
                ))}
              </div>

              {meeting.preparationSummary ? (
                <Card accent="ai" label={language === "de" ? "Vorbereitung" : "Preparation"}>
                  <div className="app-stack-2">
                    <span className="app-meta">
                      {language === "de"
                        ? "Vom Partner zusammengestellt"
                        : "Assembled by the partner"}
                    </span>
                    <p className="app-suggestion-body">{meeting.preparationSummary}</p>

                    {meeting.preparedQuestions.length > 0 ? (
                      <div className="app-stack-1" style={{ marginTop: "var(--app-2)" }}>
                        <span className="app-meta">
                          {language === "de"
                            ? "Vorbereitete Fragen, als Entwurf"
                            : "Prepared questions, as drafts"}
                        </span>
                        <ul className="app-did-list">
                          {meeting.preparedQuestions.map((question, index) => (
                            <li key={index} className="app-did-item">
                              <Data>{index + 1}</Data>
                              <span>{question}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {meeting.evidenceDocumentIds.length > 0 ? (
                      <div className="app-row app-row-wrap" style={{ marginTop: "var(--app-2)" }}>
                        <span className="app-meta">
                          {language === "de" ? "Nachweise" : "Evidence"}:
                        </span>
                        {meeting.evidenceDocumentIds.map((id) => (
                          <ObjectRef key={id} id={id} label="evidence" />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </Card>
              ) : null}

              {turns.length > 0 ? (
                <Disclosure
                  label={language === "de" ? "Verlauf" : "Transcript"}
                  count={turns.length}
                  defaultOpen={meeting.status === "concluded"}
                >
                  <List label={language === "de" ? "Verlauf" : "Transcript"}>
                    {turns.map((turn) => {
                      const contradicted = turn.contradictsEvidenceId
                        ? getEvidenceDocument(turn.contradictsEvidenceId)
                        : null;
                      return (
                        <Item
                          key={turn.id}
                          large
                          title={
                            <span className="app-strong">
                              {names.get(turn.speakerUserId ?? "") ?? turn.speakerLabel}
                            </span>
                          }
                          leading={<Data>{turn.atMoment}</Data>}
                          trailing={
                            contradicted ? (
                              <Chip tone="danger">
                                {language === "de" ? "widerspricht" : "contradicts"}
                              </Chip>
                            ) : null
                          }
                        >
                          <span style={{ fontSize: "var(--app-text-sm)", marginTop: 2 }}>
                            {turn.content}
                          </span>
                          {/*
                            * A statement that contradicts a record is not
                            * silently reconciled. It is marked, and the record
                            * it conflicts with is named, because a stakeholder
                            * statement and an approved record are different
                            * kinds of evidence and the product never merges
                            * them.
                            */}
                          {contradicted ? (
                            <span className="app-notice" data-tone="danger" style={{ marginTop: "var(--app-2)" }}>
                              <span>
                                {language === "de"
                                  ? "Widerspricht dem erfassten Stand in "
                                  : "Contradicts the recorded position in "}
                                <ObjectRef id={contradicted.reference} />
                              </span>
                            </span>
                          ) : null}
                        </Item>
                      );
                    })}
                  </List>
                </Disclosure>
              ) : null}

              {meeting.outcome ? (
                <div className="app-notice" data-tone="info">
                  <span>
                    <span className="app-strong">
                      {language === "de" ? "Erfasstes Ergebnis" : "Recorded outcome"}
                    </span>
                    <span style={{ display: "block", marginTop: 2 }}>{meeting.outcome}</span>
                  </span>
                </div>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}

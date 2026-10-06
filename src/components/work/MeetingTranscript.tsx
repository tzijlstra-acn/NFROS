"use client";

/**
 * During the meeting: the conversation as far as it has been spoken, and the
 * capture of what it establishes.
 *
 * Each turn shows who spoke, when, and on what basis (a statement, a verified
 * fact, a record, an AI inference), the flag when the record contradicts the
 * evidence, and the documents the statement rests on. Any turn can be
 * captured into the minutes draft as a fact, a decision, an action with its
 * owner and date, or an unresolved question. The form starts from the turn's
 * own words; the person edits all of it. Capturing writes the draft through
 * the authority gate and nothing else: a draft is not a record.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionCaptureMeetingItem } from "@app/workday/[role]/work/actions";
import type { Language } from "@/i18n/labels";
import { fill, say } from "@/features/work/copy";
import type { OperationOutcome } from "@/features/work/modules/actions/operations";
import type { MinutesDecisionOutcome, MinutesItemKind } from "@/features/work/modules/meetings/ai-schema";
import { LIFECYCLE_COPY as L } from "@/features/work/modules/meetings/copy";
import type { MeetingLifecycleView, TurnView } from "@/features/work/modules/meetings/lifecycle";

type During = MeetingLifecycleView["during"];

const KINDS: Array<{ id: MinutesItemKind; label: { en: string; de: string } }> = [
  { id: "fact", label: L.captureFact },
  { id: "decision", label: L.captureDecision },
  { id: "action", label: L.captureAction },
  { id: "unresolved", label: L.captureUnresolved },
];

const OUTCOMES: Array<{ id: MinutesDecisionOutcome; label: { en: string; de: string } }> = [
  { id: "agreed", label: L.outcomeAgreed },
  { id: "not-agreed", label: L.outcomeNotAgreed },
  { id: "deferred", label: L.outcomeDeferred },
  { id: "referred", label: L.outcomeReferred },
];

export function MeetingTranscript({
  roleId,
  meetingId,
  language,
  during,
}: {
  roleId: string;
  meetingId: string;
  language: Language;
  during: During;
}) {
  const t = (pair: { en: string; de: string }) => say(pair, language);

  if (!during.started) {
    return <p className="wd-work-text" data-testid="transcript-not-started">{during.notStartedText}</p>;
  }
  if (during.noRecord) {
    return <p className="wd-work-text" data-testid="transcript-empty">{t(L.noRecord)}</p>;
  }

  return (
    <div className="wd-stack-2">
      {!during.capture.enabled ? <p className="wd-meta">{during.capture.reason}</p> : null}
      <ol className="wd-meet-turns" data-testid="transcript" aria-label={t(L.transcript)}>
        {during.turns.map((turn) => (
          <Turn key={turn.id} turn={turn} roleId={roleId} meetingId={meetingId} language={language} capture={during.capture} />
        ))}
      </ol>
      {during.pending > 0 ? (
        <p className="wd-meta" data-testid="transcript-pending">
          {fill(t(L.pending), { count: during.pending })}
        </p>
      ) : null}
    </div>
  );
}

function Turn({
  turn,
  roleId,
  meetingId,
  language,
  capture,
}: {
  turn: TurnView;
  roleId: string;
  meetingId: string;
  language: Language;
  capture: During["capture"];
}) {
  const t = (pair: { en: string; de: string }) => say(pair, language);
  const router = useRouter();
  const [open, setOpen] = useState<MinutesItemKind | null>(null);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<OperationOutcome | null>(null);

  const [text, setText] = useState(turn.prefill.text);
  const [decisionId, setDecisionId] = useState("");
  const [outcome, setOutcome] = useState<MinutesDecisionOutcome>("referred");
  const [follow, setFollow] = useState(turn.prefill.existingActionId !== null);
  const [existingId, setExistingId] = useState(turn.prefill.existingActionId ?? "");
  const [title, setTitle] = useState(turn.prefill.title);
  const [owner, setOwner] = useState(turn.prefill.ownerUserId ?? "");
  const [deliveredBy, setDeliveredBy] = useState("");
  const [due, setDue] = useState(capture.defaultDue);
  const [kind, setKind] = useState(capture.kinds[0]?.id ?? "");
  const [condition, setCondition] = useState("");

  const openForm = (next: MinutesItemKind) => {
    setResult(null);
    setText(turn.prefill.text);
    setTitle(turn.prefill.title);
    setFollow(next === "action" && turn.prefill.existingActionId !== null);
    setOpen(next);
  };

  const submit = () => {
    if (!open) return;
    start(async () => {
      const isFollow = open === "action" && follow && existingId.length > 0;
      const response = await actionCaptureMeetingItem({
        roleId,
        meetingId,
        kind: open,
        turnId: turn.id,
        text: open === "action" && !isFollow ? title : text,
        decisionId: open === "decision" && decisionId.length > 0 ? decisionId : null,
        outcome,
        existingActionId: isFollow ? existingId : null,
        ownerUserId: open === "action" && !isFollow && owner.length > 0 ? owner : null,
        ownerLabel: open === "action" && !isFollow ? deliveredBy : "",
        dueOn: open === "action" && !isFollow && due.length === 10 ? due : null,
        actionKind: kind,
        completionCondition: open === "action" ? (isFollow ? text : condition) : "",
        evidenceIds: turn.evidence.map((doc) => doc.id),
      });
      setResult(response);
      if (response.ok) {
        setOpen(null);
        router.refresh();
      }
    });
  };

  const valid =
    open === "action"
      ? follow
        ? existingId.length > 0 && text.trim().length > 0
        : title.trim().length > 0 && owner.length > 0
      : text.trim().length > 0;

  return (
    <li
      className="wd-meet-turn"
      data-turn-id={turn.id}
      data-kind={turn.speakerKind}
      data-flagged={turn.flag ? "true" : "false"}
      data-testid="transcript-turn"
    >
      <div className="wd-meet-turn-head">
        <span className="wd-mono">{turn.at}</span>
        <span className="wd-meet-turn-speaker">{turn.speaker}</span>
        <span className="wd-chip" data-tone={turn.basis.tone}>
          {turn.basis.label}
        </span>
        {turn.captured.length > 0 ? (
          <span className="wd-chip" data-tone="success" data-testid="turn-captured">
            {fill(t(L.captured), { kinds: turn.captured.join(", ") })}
          </span>
        ) : null}
      </div>
      <p className="wd-meet-turn-text">{turn.text}</p>
      {turn.flag ? (
        <p className="wd-meet-flag" data-testid="turn-flag">
          <span className="wd-strong">{t(L.flag)}</span>
          {turn.flag.evidence ? ` (${turn.flag.evidence.id})` : ""}: {turn.flag.note}
        </p>
      ) : null}
      {turn.evidence.length > 0 ? (
        <details className="wd-meet-evidence" data-testid="turn-evidence">
          <summary>
            {t(L.retrieved)} ({turn.evidence.length})
          </summary>
          <ul>
            {turn.evidence.map((doc) => (
              <li key={doc.id}>
                <span className="wd-oid">{doc.id}</span> <span className="wd-strong">{doc.title}</span>{" "}
                <span className="wd-chip" data-tone={doc.statusTone}>
                  {doc.status}
                </span>
                {doc.summary ? <span className="wd-meta"> {doc.summary}</span> : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {capture.enabled ? (
        <div className="wd-meet-capture">
          <span>{t(L.capture)}:</span>
          {KINDS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="wd-btn wd-btn-quiet wd-btn-sm"
              aria-pressed={open === entry.id}
              disabled={pending}
              data-capture={entry.id}
              onClick={() => (open === entry.id ? setOpen(null) : openForm(entry.id))}
            >
              {t(entry.label)}
            </button>
          ))}
        </div>
      ) : null}

      {open ? (
        <form
          className="wd-work-form"
          data-testid="capture-form"
          data-kind={open}
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          {open === "action" ? (
            <div className="wd-meet-radio" role="radiogroup">
              <label className="wd-work-check">
                <input type="radio" name="follow" checked={!follow} onChange={() => setFollow(false)} />
                <span>{t(L.fieldNewAction)}</span>
              </label>
              <label className="wd-work-check">
                <input type="radio" name="follow" checked={follow} onChange={() => setFollow(true)} />
                <span>{t(L.fieldExisting)}</span>
              </label>
            </div>
          ) : null}

          {open === "action" && !follow ? (
            <>
              <label>
                {t(L.fieldTitle)}
                <input type="text" name="title" value={title} onChange={(event) => setTitle(event.target.value)} required />
              </label>
              <div className="wd-meet-grid">
                <label>
                  {t(L.fieldOwner)}
                  <select name="owner" value={owner} onChange={(event) => setOwner(event.target.value)} required>
                    <option value="">{"..."}</option>
                    {capture.owners.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t(L.fieldDue)}
                  <input type="date" name="dueOn" value={due} min={capture.minDate} onChange={(event) => setDue(event.target.value)} />
                </label>
                <label>
                  {t(L.fieldKind)}
                  <select name="kind" value={kind} onChange={(event) => setKind(event.target.value)}>
                    {capture.kinds.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t(L.fieldDeliveredBy)}
                  <input type="text" name="deliveredBy" value={deliveredBy} onChange={(event) => setDeliveredBy(event.target.value)} />
                </label>
              </div>
              <label>
                {t(L.fieldCondition)}
                <textarea name="condition" value={condition} onChange={(event) => setCondition(event.target.value)} />
              </label>
            </>
          ) : null}

          {open === "action" && follow ? (
            <label>
              {t(L.fieldExisting)}
              <select name="existing" value={existingId} onChange={(event) => setExistingId(event.target.value)} required>
                <option value="">{"..."}</option>
                {capture.existingActions.map((action) => (
                  <option key={action.id} value={action.id}>
                    {action.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {open !== "action" || follow ? (
            <label>
              {t(L.fieldText)}
              <textarea name="text" value={text} onChange={(event) => setText(event.target.value)} rows={4} required />
            </label>
          ) : null}

          {open === "decision" ? (
            <div className="wd-meet-grid">
              <label>
                {t(L.fieldDecision)}
                <select name="decision" value={decisionId} onChange={(event) => setDecisionId(event.target.value)}>
                  <option value="">{t(L.fieldNoDecision)}</option>
                  {capture.decisions.map((decision) => (
                    <option key={decision.id} value={decision.id}>
                      {decision.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t(L.fieldOutcome)}
                <select name="outcome" value={outcome} onChange={(event) => setOutcome(event.target.value as MinutesDecisionOutcome)}>
                  {OUTCOMES.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {t(entry.label)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          <div className="wd-work-form-meta">
            <span>{t(L.captureWill)}</span>
          </div>
          <div className="wd-work-form-actions">
            <button type="submit" className="wd-btn wd-btn-primary wd-btn-sm" disabled={pending || !valid} data-testid="capture-submit">
              {pending ? t(L.working) : t(L.capture)}
            </button>
            <button type="button" className="wd-btn wd-btn-quiet wd-btn-sm" onClick={() => setOpen(null)} disabled={pending}>
              {t(L.cancel)}
            </button>
          </div>
        </form>
      ) : null}

      {result ? (
        <p className="wd-notice" role="status" data-tone={result.ok ? "info" : "warning"} data-testid="capture-result" data-ok={result.ok ? "true" : "false"}>
          {result.message}
        </p>
      ) : null}
    </li>
  );
}

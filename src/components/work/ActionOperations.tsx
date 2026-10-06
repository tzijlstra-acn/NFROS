"use client";

/**
 * The operations on one action, and the completion condition.
 *
 * Every button opens one inline form; only one is open at a time, because the
 * state is a single identifier. Each form says, before the person acts, what
 * will change and what approval the change carries, which is the plan's rule
 * that human authority is visible. Submitting calls a server action in
 * `app/workday/[role]/work/actions.ts`, which runs the change through the
 * authority gate; this component writes nothing itself and decides nothing
 * about authority. A disabled operation shows the reason it is disabled, in
 * the gate's words where the gate is the reason.
 *
 * A material change asks for an explicit confirmation statement. The server
 * refuses without it as well, so the checkbox is a courtesy to the person,
 * not the control.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconSparkles } from "@tabler/icons-react";
import {
  actionAddUpdate,
  actionAssignAction,
  actionChangeDueDate,
  actionCompleteAction,
  actionDraftReminder,
  actionEscalateAction,
  actionReopenAction,
  actionRequestEvidence,
  actionSendReminder,
} from "@app/workday/[role]/work/actions";
import type { Language } from "@/i18n/labels";
import { COPY, say } from "@/features/work/copy";
import type { EvidenceRef } from "@/features/work/model";
import { ACTIONS_COPY } from "@/features/work/modules/actions/copy";
import type { ActionOperationId, ActionOperationView } from "@/features/work/modules/actions/read-model";
import type { OperationOutcome } from "@/features/work/modules/actions/operations";

type FormId = ActionOperationId | "condition";

export interface ActionOperationsProps {
  roleId: string;
  actionId: string;
  language: Language;
  operations: readonly ActionOperationView[];
  assignable: ReadonlyArray<{ id: string; label: string }>;
  evidenceChoices: readonly EvidenceRef[];
  suggestedDate: string;
  minDate: string;
  agreedCondition: string | null;
  agreedNote: string | null;
  proposedCondition: string;
  conditionOpen: boolean;
  material: boolean;
  blocked: boolean;
  reminderRecipient: string;
  escalationLabel: string;
  requestEvidenceHint: string;
}

export function ActionOperations(props: ActionOperationsProps) {
  const { language } = props;
  const router = useRouter();
  const [open, setOpen] = useState<FormId | null>(null);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<OperationOutcome | null>(null);

  /* Form fields. One set, reset whenever a form opens. */
  const [owner, setOwner] = useState("");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(props.suggestedDate);
  const [what, setWhat] = useState("");
  const [fromLabel, setFromLabel] = useState("");
  const [note, setNote] = useState("");
  const [evidence, setEvidence] = useState<string[]>([]);
  const [otherEvidence, setOtherEvidence] = useState("");
  const [blocker, setBlocker] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [drafted, setDrafted] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const t = (pair: { en: string; de: string }) => say(pair, language);
  const operation = (id: ActionOperationId) => props.operations.find((entry) => entry.id === id);

  const openForm = (id: FormId) => {
    setResult(null);
    setOwner("");
    setReason("");
    setDate(props.suggestedDate);
    setWhat("");
    setFromLabel("");
    setNote(id === "condition" ? props.proposedCondition : "");
    setEvidence([]);
    setOtherEvidence("");
    setBlocker(false);
    setConfirmed(false);
    if (id !== "send-reminder") {
      setSubject("");
      setBody("");
      setDrafted(false);
    }
    setOpen(id);
  };

  const finish = (outcome: OperationOutcome) => {
    setResult(outcome);
    if (outcome.ok) {
      setOpen(null);
      router.refresh();
    }
  };

  const allEvidence = (): string[] => {
    const typed = otherEvidence
      .split(/[\s,;]+/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    return [...new Set([...evidence, ...typed])];
  };

  const submit = () => {
    if (!open) return;
    start(async () => {
      const base = { roleId: props.roleId, actionId: props.actionId };
      switch (open) {
        case "assign":
          finish(await actionAssignAction({ ...base, ownerUserId: owner, reason, confirmed }));
          return;
        case "change-date":
          finish(await actionChangeDueDate({ ...base, dueOn: date, reason, confirmed: props.material ? confirmed : true }));
          return;
        case "request-evidence":
          finish(await actionRequestEvidence({ ...base, what, fromUserId: null, fromLabel, dueOn: date || null }));
          return;
        case "add-update":
          finish(
            await actionAddUpdate({
              ...base,
              note,
              evidenceIds: allEvidence(),
              blocker: blocker ? (props.blocked ? "clear" : "set") : null,
              entryKind: "UPD",
            }),
          );
          return;
        case "condition":
          finish(await actionAddUpdate({ ...base, note, evidenceIds: [], blocker: null, entryKind: "CC" }));
          return;
        case "send-reminder":
          finish(await actionSendReminder({ ...base, subject, body }));
          return;
        case "complete":
          finish(await actionCompleteAction({ ...base, note, evidenceIds: allEvidence(), confirmed: props.material ? confirmed : true }));
          return;
        case "reopen":
          finish(await actionReopenAction({ ...base, reason, confirmed: props.material ? confirmed : true }));
          return;
        case "escalate":
          finish(await actionEscalateAction({ ...base, reason, confirmed }));
          return;
        case "draft-reminder":
          return;
      }
    });
  };

  const draft = () => {
    start(async () => {
      const outcome = await actionDraftReminder({ roleId: props.roleId, actionId: props.actionId });
      if (outcome.ok && outcome.draft) {
        setResult(null);
        setSubject(outcome.draft.subject);
        setBody(outcome.draft.body);
        setDrafted(true);
        setConfirmed(false);
        setOpen("send-reminder");
      } else {
        setResult(outcome);
      }
    });
  };

  const needsConfirmation =
    open === "assign" ||
    open === "escalate" ||
    ((open === "complete" || open === "change-date" || open === "reopen") && props.material);

  const formValid = (() => {
    switch (open) {
      case "assign":
        return owner.length > 0 && reason.trim().length > 0;
      case "change-date":
        return date.length === 10 && reason.trim().length > 0;
      case "request-evidence":
        return what.trim().length > 0;
      case "add-update":
      case "condition":
        return note.trim().length > 0;
      case "send-reminder":
        return subject.trim().length > 0 && body.trim().length > 0;
      case "complete":
        return note.trim().length > 0;
      case "reopen":
      case "escalate":
        return reason.trim().length > 0;
      default:
        return false;
    }
  })();

  const active = open && open !== "condition" ? operation(open) : null;

  return (
    <div className="wd-stack-3" data-testid="action-operations">
      {/* The completion condition: agreed, or proposed for the person to record. */}
      <div className="wd-work-section" style={{ marginTop: 0 }}>
        <h3 className="wd-work-section-label">{t(ACTIONS_COPY.completionCondition)}</h3>
        {props.agreedCondition ? (
          <div className="wd-work-callout" data-tone="success" data-testid="agreed-condition">
            {props.agreedCondition}
            {props.agreedNote ? <span className="wd-meta"> {props.agreedNote}</span> : null}
          </div>
        ) : (
          <div className="wd-stack-2">
            <p className="wd-work-text">{t(ACTIONS_COPY.conditionNotRecorded)}</p>
            {props.proposedCondition ? (
              <div className="wd-work-callout" data-tone="ai" data-testid="proposed-condition">
                <span className="wd-work-proposal-label">
                  <IconSparkles size={13} stroke={1.8} aria-hidden="true" />
                  {t(ACTIONS_COPY.proposedCondition)}
                </span>
                <p className="wd-work-text" style={{ marginTop: 4 }}>
                  {props.proposedCondition}
                </p>
                {props.conditionOpen ? (
                  <button
                    type="button"
                    className="wd-btn wd-btn-secondary wd-btn-sm"
                    style={{ marginTop: "var(--wd-2)" }}
                    onClick={() => openForm("condition")}
                    disabled={pending}
                  >
                    {t(ACTIONS_COPY.useCondition)}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div>
        <h3 className="wd-work-section-label">{t(ACTIONS_COPY.operations)}</h3>
        <div className="wd-work-ops">
          {props.operations.map((op) => (
            <button
              key={op.id}
              type="button"
              className={op.id === "complete" ? "wd-btn wd-btn-primary wd-btn-sm" : "wd-btn wd-btn-secondary wd-btn-sm"}
              disabled={!op.enabled || pending}
              title={op.enabled ? `${op.authorityLabel}. ${op.willChange}` : op.disabledReason}
              aria-pressed={open === op.id}
              data-operation={op.id}
              onClick={() => (op.id === "draft-reminder" ? draft() : openForm(op.id))}
            >
              {op.label}
            </button>
          ))}
        </div>
        <p className="wd-meta" style={{ marginTop: "var(--wd-2)" }}>
          {t(ACTIONS_COPY.aiLimits)}
        </p>
      </div>

      {open ? (
        <form
          className="wd-work-form"
          data-testid={`form-${open}`}
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          {open === "assign" ? (
            <label>
              {t(ACTIONS_COPY.fieldOwner)}
              <select value={owner} onChange={(event) => setOwner(event.target.value)} name="owner" required>
                <option value="">{"..."}</option>
                {props.assignable.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {open === "change-date" ? (
            <label>
              {t(ACTIONS_COPY.fieldNewDate)}
              <input type="date" value={date} min={props.minDate} onChange={(event) => setDate(event.target.value)} name="dueOn" required />
            </label>
          ) : null}

          {open === "request-evidence" ? (
            <>
              <label>
                {t(ACTIONS_COPY.fieldWhat)}
                <textarea value={what} onChange={(event) => setWhat(event.target.value)} placeholder={props.requestEvidenceHint} name="what" required />
              </label>
              <label>
                {t(ACTIONS_COPY.fieldFrom)}
                <input type="text" value={fromLabel} onChange={(event) => setFromLabel(event.target.value)} placeholder={props.reminderRecipient} name="from" />
              </label>
              <label>
                {t(COPY.factDue)}
                <input type="date" value={date} min={props.minDate} onChange={(event) => setDate(event.target.value)} name="dueOn" />
              </label>
            </>
          ) : null}

          {open === "add-update" || open === "condition" || open === "complete" ? (
            <label>
              {open === "complete" ? t(ACTIONS_COPY.fieldCompletionNote) : open === "condition" ? t(ACTIONS_COPY.completionCondition) : t(ACTIONS_COPY.fieldNote)}
              <textarea value={note} onChange={(event) => setNote(event.target.value)} name="note" required />
            </label>
          ) : null}

          {open === "add-update" || open === "complete" ? (
            <fieldset className="wd-work-form-meta" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="wd-strong" style={{ fontSize: "var(--wd-text-xs)" }}>
                {t(ACTIONS_COPY.fieldEvidence)}
              </legend>
              {props.evidenceChoices.length > 0 ? (
                <div className="wd-work-choices">
                  {props.evidenceChoices.map((doc) => (
                    <label key={doc.id} className="wd-work-check">
                      <input
                        type="checkbox"
                        checked={evidence.includes(doc.id)}
                        onChange={(event) =>
                          setEvidence((current) =>
                            event.target.checked ? [...current, doc.id] : current.filter((id) => id !== doc.id),
                          )
                        }
                      />
                      <span>
                        <span className="wd-oid">{doc.id}</span> {doc.title}
                      </span>
                    </label>
                  ))}
                </div>
              ) : null}
              <label>
                {t(ACTIONS_COPY.fieldOtherEvidence)}
                <input type="text" value={otherEvidence} onChange={(event) => setOtherEvidence(event.target.value)} placeholder="EVD-2026-..." name="otherEvidence" />
              </label>
            </fieldset>
          ) : null}

          {open === "add-update" ? (
            <label className="wd-work-check">
              <input type="checkbox" checked={blocker} onChange={(event) => setBlocker(event.target.checked)} name="blocker" />
              <span>{props.blocked ? t(ACTIONS_COPY.fieldClearBlocker) : t(ACTIONS_COPY.fieldBlocker)}</span>
            </label>
          ) : null}

          {open === "send-reminder" ? (
            <>
              {drafted ? <p className="wd-work-callout" data-tone="ai">{t(ACTIONS_COPY.draftReady)}</p> : null}
              <label>
                {t({ en: "Subject", de: "Betreff" })}
                <input type="text" value={subject} onChange={(event) => setSubject(event.target.value)} name="subject" required />
              </label>
              <label>
                {t(ACTIONS_COPY.fieldMessage)}
                <textarea value={body} onChange={(event) => setBody(event.target.value)} name="body" rows={8} required />
              </label>
              <span className="wd-meta">
                {props.reminderRecipient}. {t(ACTIONS_COPY.simulatedSent)}
              </span>
            </>
          ) : null}

          {open === "assign" || open === "change-date" || open === "reopen" || open === "escalate" ? (
            <label>
              {open === "escalate" ? `${t(ACTIONS_COPY.fieldEscalation)} (${props.escalationLabel})` : t(ACTIONS_COPY.fieldReason)}
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} name="reason" required />
            </label>
          ) : null}

          {needsConfirmation ? (
            <label className="wd-work-check">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} name="confirmed" />
              <span>{open === "complete" ? t(ACTIONS_COPY.confirmMaterial) : t(ACTIONS_COPY.confirmChange)}</span>
            </label>
          ) : null}

          <div className="wd-work-form-meta">
            {active ? (
              <>
                <span>
                  <span className="wd-strong">{t(COPY.willChange)}: </span>
                  {active.willChange}
                </span>
                <span>
                  <span className="wd-strong">{t(COPY.approvalRequired)}: </span>
                  {active.authorityLabel}. {active.approval}
                </span>
              </>
            ) : (
              <span>{t(ACTIONS_COPY.willAddUpdate)}</span>
            )}
          </div>

          <div className="wd-work-form-actions">
            <button
              type="submit"
              className="wd-btn wd-btn-primary wd-btn-sm"
              disabled={pending || !formValid || (needsConfirmation && !confirmed)}
              data-testid="operation-submit"
            >
              {pending ? t(ACTIONS_COPY.working) : open === "send-reminder" ? t(ACTIONS_COPY.submitSend) : t(ACTIONS_COPY.submit)}
            </button>
            <button type="button" className="wd-btn wd-btn-quiet wd-btn-sm" onClick={() => setOpen(null)} disabled={pending}>
              {t(ACTIONS_COPY.cancel)}
            </button>
          </div>
        </form>
      ) : null}

      {result ? (
        <div className="wd-stack-1" role="status" data-testid="operation-result" data-ok={result.ok ? "true" : "false"}>
          <p className="wd-notice" data-tone={result.ok ? "info" : "warning"}>
            {result.message}
          </p>
          {result.receipt.length > 0 ? (
            <ul className="wd-work-bullets" aria-label={t(ACTIONS_COPY.receipt)}>
              {result.receipt.map((line, index) => (
                <li key={`receipt-${index}`}>{line}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

"use client";

/**
 * The operations on one inbox message: triage, and conversion into work.
 *
 * One primary action leads, in the role's words, and the other ways to handle
 * the message follow as quieter buttons. Every button opens one inline form;
 * only one is open at a time. Each form says, before the person acts, what the
 * AI prepared, what the person decides, what will change and what approval
 * the change carries (plan section 9.5). Submitting calls a server action in
 * `app/workday/[role]/work/inbox-actions.ts`, which runs the change through
 * the authority gate; this component writes nothing itself and decides
 * nothing about authority. A disabled operation shows the reason it is
 * disabled, in the gate's words where the gate is the reason.
 *
 * Raising an action is material and asks for an explicit confirmation. The
 * server refuses without it as well, so the checkbox is a courtesy to the
 * person, not the control.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  inboxAddToProcess,
  inboxChangeTriage,
  inboxConfirmTriage,
  inboxCreateAction,
  inboxDelegate,
  inboxDismiss,
  inboxDraftReply,
  inboxLinkEvidence,
  inboxSendReply,
} from "@app/workday/[role]/work/inbox-actions";
import type { Language } from "@/i18n/labels";
import { COPY, fill, say } from "@/features/work/copy";
import { INBOX_COPY } from "@/features/work/modules/inbox/copy";
import type { InboxForms, InboxOperationId, InboxOperationView } from "@/features/work/modules/inbox/read-model";
import type { InboxClassification } from "@/features/work/modules/inbox/triage-schema";
import type { OperationOutcome } from "@/features/work/modules/actions/operations";

type FormId = InboxOperationId | "send-reply";

export interface InboxOperationsProps {
  roleId: string;
  messageId: string;
  language: Language;
  operations: readonly InboxOperationView[];
  forms: InboxForms;
  /** The role's words for the primary action the classification implies. */
  primaryWords: string;
  proposedId: InboxClassification | null;
  effectiveId: InboxClassification | null;
  proposedLabel: string | null;
}

export function InboxOperations(props: InboxOperationsProps) {
  const { language, forms } = props;
  const router = useRouter();
  const t = (pair: { en: string; de: string }) => say(pair, language);
  const [open, setOpen] = useState<FormId | null>(null);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<OperationOutcome | null>(null);

  /* Form fields. One set, reset whenever a form opens. */
  const [classification, setClassification] = useState<string>(props.effectiveId ?? "");
  const [reason, setReason] = useState("");
  const [linkExisting, setLinkExisting] = useState(forms.existingAction !== null);
  const [title, setTitle] = useState(forms.defaultTitle);
  const [kind, setKind] = useState(forms.defaultKind);
  const [owner, setOwner] = useState(forms.holderUserId ?? "");
  const [due, setDue] = useState(forms.defaultDue);
  const [confirmed, setConfirmed] = useState(false);
  const [objects, setObjects] = useState<string[]>(forms.evidenceObjects.filter((entry) => entry.checked).map((entry) => entry.id));
  const [evidenceTitle, setEvidenceTitle] = useState(forms.defaultEvidenceTitle);
  const [stage, setStage] = useState(forms.stages.find((entry) => entry.selected)?.value ?? forms.stages[0]?.value ?? "");
  const [delegate, setDelegate] = useState(forms.delegates.find((person) => person.suggested)?.id ?? "");
  const [note, setNote] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const operation = (id: InboxOperationId) => props.operations.find((entry) => entry.id === id);
  const primary = props.operations.find((entry) => entry.primary) ?? null;
  const others = props.operations.filter((entry) => !entry.primary);

  const openForm = (id: FormId) => {
    setResult(null);
    setClassification(props.effectiveId ?? forms.classifications[0]?.id ?? "");
    setReason("");
    setLinkExisting(forms.existingAction !== null);
    setTitle(forms.defaultTitle);
    setKind(forms.defaultKind);
    setOwner(forms.holderUserId ?? "");
    setDue(forms.defaultDue);
    setConfirmed(false);
    setObjects(forms.evidenceObjects.filter((entry) => entry.checked).map((entry) => entry.id));
    setEvidenceTitle(forms.defaultEvidenceTitle);
    setStage(forms.stages.find((entry) => entry.selected)?.value ?? forms.stages[0]?.value ?? "");
    setDelegate(forms.delegates.find((person) => person.suggested)?.id ?? "");
    setNote("");
    setOpen(id);
  };

  const finish = (outcome: OperationOutcome) => {
    setResult(outcome);
    if (outcome.ok) {
      setOpen(null);
      router.refresh();
    }
  };

  const draft = () => {
    start(async () => {
      const outcome = await inboxDraftReply({ roleId: props.roleId, messageId: props.messageId });
      if (outcome.ok && outcome.draft) {
        setResult(null);
        setSubject(outcome.draft.subject);
        setBody(outcome.draft.body);
        setOpen("send-reply");
      } else {
        setResult(outcome);
      }
    });
  };

  const submit = () => {
    if (!open) return;
    start(async () => {
      const base = { roleId: props.roleId, messageId: props.messageId };
      switch (open) {
        case "confirm-triage":
          finish(await inboxConfirmTriage(base));
          return;
        case "change-triage":
          finish(await inboxChangeTriage({ ...base, classification, reason }));
          return;
        case "dismiss":
          finish(await inboxDismiss({ ...base, reason }));
          return;
        case "create-action":
          finish(
            await inboxCreateAction({
              ...base,
              linkExisting,
              title,
              kind,
              ownerUserId: owner,
              dueOn: due || null,
              reason,
              confirmed: linkExisting ? true : confirmed,
            }),
          );
          return;
        case "link-evidence":
          finish(await inboxLinkEvidence({ ...base, objectIds: objects, title: evidenceTitle }));
          return;
        case "add-to-process": {
          const [processRunId = "", stageId = ""] = stage.split("::");
          finish(await inboxAddToProcess({ ...base, processRunId, stageId }));
          return;
        }
        case "delegate":
          finish(await inboxDelegate({ ...base, toUserId: delegate, note }));
          return;
        case "send-reply":
          finish(await inboxSendReply({ ...base, subject, body }));
          return;
        case "draft-reply":
          return;
      }
    });
  };

  const material = open === "create-action" && !linkExisting;
  const reasonRequired =
    (open === "change-triage" && classification !== props.proposedId) || (open === "dismiss" && props.proposedId !== "noise") || material;

  const formValid = (() => {
    switch (open) {
      case "confirm-triage":
        return true;
      case "change-triage":
        return classification.length > 0 && (!reasonRequired || reason.trim().length > 0);
      case "dismiss":
        return !reasonRequired || reason.trim().length > 0;
      case "create-action":
        return linkExisting || (title.trim().length > 0 && kind.length > 0 && owner.length > 0 && due.length === 10 && reason.trim().length > 0);
      case "link-evidence":
        return evidenceTitle.trim().length > 0;
      case "add-to-process":
        return stage.length > 0;
      case "delegate":
        return delegate.length > 0 && note.trim().length > 0;
      case "send-reply":
        return subject.trim().length > 0 && body.trim().length > 0;
      default:
        return false;
    }
  })();

  const active: InboxOperationView | null = open ? (operation(open === "send-reply" ? "draft-reply" : open) ?? null) : null;
  const selectedStage = forms.stages.find((entry) => entry.value === stage);

  const button = (op: InboxOperationView, primaryStyle: boolean) => (
    <button
      key={op.id}
      type="button"
      className={primaryStyle ? "wd-btn wd-btn-primary wd-btn-sm" : "wd-btn wd-btn-secondary wd-btn-sm"}
      disabled={!op.enabled || pending}
      title={op.enabled ? `${op.authorityLabel}. ${op.willChange}` : op.disabledReason}
      aria-pressed={open === op.id || (op.id === "draft-reply" && open === "send-reply")}
      data-operation={op.id}
      onClick={() => (op.id === "draft-reply" ? draft() : openForm(op.id))}
    >
      {op.label}
    </button>
  );

  return (
    <div className="wd-stack-3" data-testid="inbox-operations">
      <div>
        <h3 className="wd-work-section-label">{t(INBOX_COPY.nextStep)}</h3>
        {primary ? (
          <div className="wd-work-ops" data-testid="primary-action">
            {button(primary, true)}
            {props.primaryWords && primary.id !== "draft-reply" ? <span className="wd-meta">{props.primaryWords}</span> : null}
            {!primary.enabled ? <span className="wd-meta">{primary.disabledReason}</span> : null}
          </div>
        ) : (
          <p className="wd-work-text" data-testid="primary-action">
            {t(INBOX_COPY.nothingNext)}
          </p>
        )}
      </div>

      <div>
        <h3 className="wd-work-section-label">{t(INBOX_COPY.otherWays)}</h3>
        <div className="wd-work-ops">{others.map((op) => button(op, false))}</div>
        <p className="wd-meta" style={{ marginTop: "var(--wd-2)" }}>
          {t(INBOX_COPY.aiLimits)}
        </p>
      </div>

      {open ? (
        <form
          className="wd-work-form"
          data-testid={`inbox-form-${open}`}
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          {open === "confirm-triage" ? (
            <p className="wd-work-text">
              <span className="wd-strong">{t(INBOX_COPY.fieldClassification)}: </span>
              {props.proposedLabel ?? ""}
            </p>
          ) : null}

          {open === "change-triage" ? (
            <>
              <label>
                {t(INBOX_COPY.fieldClassification)}
                <select value={classification} onChange={(event) => setClassification(event.target.value)} name="classification" required>
                  {forms.classifications.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>
              <span className="wd-meta">{t(INBOX_COPY.proposalStays)}</span>
            </>
          ) : null}

          {open === "create-action" ? (
            <>
              {forms.existingAction ? (
                <label className="wd-work-check">
                  <input type="checkbox" checked={linkExisting} onChange={(event) => setLinkExisting(event.target.checked)} name="linkExisting" />
                  <span>
                    {fill(t(INBOX_COPY.fieldExisting), { id: forms.existingAction.id })}: {forms.existingAction.title}
                  </span>
                </label>
              ) : null}
              {!linkExisting ? (
                <>
                  <label>
                    {t(INBOX_COPY.fieldTitle)}
                    <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} name="title" maxLength={240} required />
                  </label>
                  <label>
                    {t(INBOX_COPY.fieldKind)}
                    <select value={kind} onChange={(event) => setKind(event.target.value)} name="kind" required>
                      {forms.actionKinds.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t(INBOX_COPY.fieldOwner)}
                    <select value={owner} onChange={(event) => setOwner(event.target.value)} name="owner" required>
                      <option value="">{"..."}</option>
                      {forms.assignable.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t(INBOX_COPY.fieldDue)}
                    <input type="date" value={due} min={forms.minDate} onChange={(event) => setDue(event.target.value)} name="dueOn" required />
                  </label>
                </>
              ) : null}
            </>
          ) : null}

          {open === "link-evidence" ? (
            <>
              <label>
                {t(INBOX_COPY.fieldEvidenceTitle)}
                <input type="text" value={evidenceTitle} onChange={(event) => setEvidenceTitle(event.target.value)} name="evidenceTitle" maxLength={240} required />
              </label>
              {forms.evidenceObjects.length > 0 ? (
                <fieldset className="wd-work-form-meta" style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend className="wd-strong" style={{ fontSize: "var(--wd-text-xs)" }}>
                    {t(INBOX_COPY.fieldObjects)}
                  </legend>
                  <div className="wd-work-choices">
                    {forms.evidenceObjects.map((entry) => (
                      <label key={entry.id} className="wd-work-check">
                        <input
                          type="checkbox"
                          checked={objects.includes(entry.id)}
                          onChange={(event) =>
                            setObjects((current) => (event.target.checked ? [...current, entry.id] : current.filter((id) => id !== entry.id)))
                          }
                        />
                        <span>{entry.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}
            </>
          ) : null}

          {open === "add-to-process" ? (
            <>
              <label>
                {t(INBOX_COPY.fieldProcess)}
                <select value={stage} onChange={(event) => setStage(event.target.value)} name="stage" required>
                  {forms.stages.map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>
              {selectedStage?.warning ? (
                <p className="wd-work-callout" data-tone="warning" data-testid="process-scope-warning">
                  {selectedStage.warning}
                </p>
              ) : null}
            </>
          ) : null}

          {open === "delegate" ? (
            <>
              <label>
                {t(INBOX_COPY.fieldDelegateTo)}
                <select value={delegate} onChange={(event) => setDelegate(event.target.value)} name="delegate" required>
                  <option value="">{"..."}</option>
                  {forms.delegates.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t(INBOX_COPY.fieldNote)}
                <textarea value={note} onChange={(event) => setNote(event.target.value)} name="note" required />
              </label>
            </>
          ) : null}

          {open === "send-reply" ? (
            <>
              <p className="wd-work-callout" data-tone="ai">
                {t(INBOX_COPY.draftReady)}
              </p>
              <label>
                {t(INBOX_COPY.fieldSubject)}
                <input type="text" value={subject} onChange={(event) => setSubject(event.target.value)} name="subject" maxLength={240} required />
              </label>
              <label>
                {t(INBOX_COPY.fieldBody)}
                <textarea value={body} onChange={(event) => setBody(event.target.value)} name="body" rows={9} required />
              </label>
              <span className="wd-meta">{fill(t(INBOX_COPY.replyTo), { name: forms.replyTo })}</span>
              {!forms.send.enabled ? (
                <p className="wd-work-callout" data-tone="warning" data-testid="send-unavailable">
                  {forms.send.reason}
                </p>
              ) : null}
            </>
          ) : null}

          {open === "change-triage" || open === "dismiss" || material ? (
            <label>
              {t(INBOX_COPY.fieldReason)}
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} name="reason" required={reasonRequired} />
            </label>
          ) : null}

          {material ? (
            <label className="wd-work-check">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} name="confirmed" />
              <span>{t(INBOX_COPY.confirmMaterial)}</span>
            </label>
          ) : null}

          {active ? (
            <div className="wd-work-form-meta" data-testid="authority-statement">
              <span>
                <span className="wd-strong">{t(COPY.aiPrepared)}: </span>
                {active.aiPrepared}
              </span>
              <span>
                <span className="wd-strong">{t(COPY.personDecides)}: </span>
                {active.youDecide}
              </span>
              <span>
                <span className="wd-strong">{t(COPY.willChange)}: </span>
                {open === "create-action" && linkExisting && forms.existingAction
                  ? fill(t(INBOX_COPY.willLinkAction), { id: forms.existingAction.id })
                  : open === "send-reply"
                    ? t(INBOX_COPY.willSend)
                    : active.willChange}
              </span>
              <span>
                <span className="wd-strong">{t(COPY.approvalRequired)}: </span>
                {active.authorityLabel ? `${active.authorityLabel}. ` : ""}
                {open === "create-action" && linkExisting ? t(INBOX_COPY.approvalYours) : active.approval}
              </span>
            </div>
          ) : null}

          <div className="wd-work-form-actions">
            <button
              type="submit"
              className="wd-btn wd-btn-primary wd-btn-sm"
              disabled={pending || !formValid || (material && !confirmed) || (open === "send-reply" && !forms.send.enabled)}
              data-testid="operation-submit"
            >
              {pending ? t(INBOX_COPY.working) : open === "send-reply" ? t(INBOX_COPY.opSendReply) : t(INBOX_COPY.submit)}
            </button>
            <button type="button" className="wd-btn wd-btn-quiet wd-btn-sm" onClick={() => setOpen(null)} disabled={pending}>
              {t(INBOX_COPY.cancel)}
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
            <ul className="wd-work-bullets" aria-label={t(INBOX_COPY.receipt)}>
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

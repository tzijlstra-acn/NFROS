"use client";

/**
 * After the meeting: the minutes, from draft to record.
 *
 * Four states, each saying what it is. No minutes yet, with the offer to
 * draft them. A draft, with what the AI Partner wrote and what the person
 * captured told apart, editable in place, and a confirmation that lists what
 * is still missing before it can be confirmed. The confirmation itself,
 * which states before the person acts what will change and what approval it
 * carries, and asks them to confirm the decisions, the actions with their
 * owners and due dates, and the distribution separately. And the record,
 * once confirmed: who confirmed it, the evidence document it became, the
 * actions it raised and where it was distributed.
 *
 * This component writes nothing and decides nothing about authority. Every
 * button calls a server action that runs the change through the gate, and
 * the server refuses what the form would refuse, so the checks here are a
 * courtesy to the person rather than the control.
 */

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionConfirmMinutes, actionPrepareMinutes, actionSaveMinutes } from "@app/workday/[role]/work/actions";
import type { Language } from "@/i18n/labels";
import { COPY, say } from "@/features/work/copy";
import type { OperationOutcome } from "@/features/work/modules/actions/operations";
import {
  MINUTES_DECISION_OUTCOMES,
  type MinutesDecisionOutcome,
  type MinutesDraft,
} from "@/features/work/modules/meetings/ai-schema";
import { LIFECYCLE_COPY as L } from "@/features/work/modules/meetings/copy";
import type { MeetingLifecycleView, MinutesPanelView } from "@/features/work/modules/meetings/lifecycle";

type After = MeetingLifecycleView["after"];

const OUTCOME_LABELS: Record<MinutesDecisionOutcome, { en: string; de: string }> = {
  agreed: L.outcomeAgreed,
  "not-agreed": L.outcomeNotAgreed,
  deferred: L.outcomeDeferred,
  referred: L.outcomeReferred,
};

export function MinutesPanel({
  roleId,
  meetingId,
  language,
  after,
}: {
  roleId: string;
  meetingId: string;
  language: Language;
  after: After;
}) {
  const t = (pair: { en: string; de: string }) => say(pair, language);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<OperationOutcome | null>(null);
  const [editing, setEditing] = useState(false);
  const minutes = after.minutes;

  const prepare = () =>
    start(async () => {
      const response = await actionPrepareMinutes({ roleId, meetingId });
      setResult(response);
      if (response.ok) router.refresh();
    });

  return (
    <div className="wd-meet-minutes" data-testid="minutes-panel" data-status={minutes?.status.label ?? "none"} data-confirmed={minutes?.confirmed ? "true" : "false"}>
      {!minutes || !minutes.confirmed ? (
        <div className="wd-stack-1">
          {after.canPrepare ? (
            <>
              <p className="wd-meta">{t(L.prepareNote)}</p>
              <div>
                <button type="button" className="wd-btn wd-btn-secondary wd-btn-sm" onClick={prepare} disabled={pending} data-testid="prepare-minutes">
                  {pending ? t(L.working) : t(L.prepare)}
                </button>
              </div>
            </>
          ) : (
            <p className="wd-meta" data-testid="prepare-unavailable">
              {after.prepareReason}
            </p>
          )}
        </div>
      ) : null}

      {!minutes ? <p className="wd-work-text">{t(L.noMinutes)}</p> : null}

      {minutes ? (
        <>
          <div className="wd-meet-minutes-head">
            <h4 className="wd-meet-minutes-title">{minutes.title}</h4>
            <span className="wd-chip" data-tone={minutes.status.tone}>
              {minutes.status.label}
            </span>
            <span className="wd-oid">{minutes.minutesId}</span>
          </div>
          {!minutes.confirmed ? (
            <p className="wd-work-callout" data-tone="ai" data-testid="minutes-prepared-note">
              {minutes.preparedNote}
              {minutes.editedNote ? <span className="wd-meta"> {minutes.editedNote}</span> : null}
            </p>
          ) : null}

          {minutes.record ? <Record minutes={minutes} language={language} /> : null}

          {editing && minutes.editable ? (
            <Editor
              roleId={roleId}
              meetingId={meetingId}
              language={language}
              minutes={minutes}
              editor={after.editor}
              onDone={(response) => {
                setResult(response);
                if (response.ok) {
                  setEditing(false);
                  router.refresh();
                }
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <MinutesBody minutes={minutes} language={language} />
          )}

          {minutes.editable && !editing ? (
            <div>
              <button
                type="button"
                className="wd-btn wd-btn-secondary wd-btn-sm"
                onClick={() => {
                  setResult(null);
                  setEditing(true);
                }}
                disabled={pending}
                data-testid="minutes-edit"
              >
                {t(L.edit)}
              </button>
            </div>
          ) : null}

          {minutes.editable && !editing ? (
            <Confirmation
              roleId={roleId}
              language={language}
              minutes={minutes}
              onDone={(response) => {
                setResult(response);
                if (response.ok) router.refresh();
              }}
            />
          ) : null}
        </>
      ) : null}

      {result ? (
        <div className="wd-stack-1" role="status" data-testid="minutes-result" data-ok={result.ok ? "true" : "false"}>
          <p className="wd-notice" data-tone={result.ok ? "info" : "warning"}>
            {result.message}
          </p>
          {result.receipt.length > 0 ? (
            <ul className="wd-work-bullets" aria-label={t(L.receipt)}>
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

/* ==========================================================================
   Reading the minutes
   ========================================================================== */

function Cites({ ids }: { ids: readonly string[] }) {
  if (ids.length === 0) return null;
  return (
    <span className="wd-meet-cites">
      {ids.map((id) => (
        <span key={id} className="wd-oid">
          {id}
        </span>
      ))}
    </span>
  );
}

function MinutesBody({ minutes, language }: { minutes: MinutesPanelView; language: Language }) {
  const t = (pair: { en: string; de: string }) => say(pair, language);
  const none = <p className="wd-meta">{t(L.nothingYet)}</p>;
  return (
    <div className="wd-stack-2" data-testid="minutes-body">
      <section aria-label={t(L.summaryLabel)}>
        <h5 className="wd-work-section-label">{t(L.summaryLabel)}</h5>
        {minutes.summary.trim().length > 0 ? <p className="wd-work-text">{minutes.summary}</p> : none}
      </section>

      <section aria-label={t(L.factsLabel)}>
        <h5 className="wd-work-section-label">{t(L.factsLabel)}</h5>
        {minutes.facts.length > 0 ? (
          <ul className="wd-meet-items" data-testid="minutes-facts">
            {minutes.facts.map((fact) => (
              <li key={fact.key}>
                <span>
                  {fact.text}
                  <Cites ids={fact.evidenceIds} />
                </span>
                <span className="wd-meet-item-meta">{fact.origin}</span>
              </li>
            ))}
          </ul>
        ) : (
          none
        )}
      </section>

      <section aria-label={t(L.decisionsLabel)}>
        <h5 className="wd-work-section-label">{t(L.decisionsLabel)}</h5>
        {minutes.decisions.length > 0 ? (
          <ul className="wd-meet-items" data-testid="minutes-decisions">
            {minutes.decisions.map((decision) => (
              <li key={decision.key}>
                <span>{decision.text}</span>
                <span className="wd-meet-item-meta">
                  <span className="wd-chip" data-tone="neutral">
                    {decision.outcome}
                  </span>
                  {decision.decision ? (
                    <Link className="wd-work-link" href={decision.decision.href}>
                      {decision.decision.id} {decision.decision.label}
                    </Link>
                  ) : null}
                  <span>{decision.origin}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          none
        )}
      </section>

      <section aria-label={t(L.actionsLabel)}>
        <h5 className="wd-work-section-label">{t(L.actionsLabel)}</h5>
        {minutes.actions.length > 0 ? (
          <ul className="wd-meet-items" data-testid="minutes-actions">
            {minutes.actions.map((action) => (
              <li key={action.key} data-action-key={action.key}>
                <span className="wd-strong">
                  {action.createdId ? <span className="wd-oid">{action.createdId} </span> : null}
                  {action.title}
                </span>
                <span className="wd-meet-item-meta">
                  {action.existing ? (
                    <Link className="wd-work-link" href={action.existing.href}>
                      {fillId(t(L.followUpOf), action.existing.id)}
                    </Link>
                  ) : (
                    <span className="wd-chip" data-tone="accent">
                      {t(L.newAction)}
                    </span>
                  )}
                  <span>
                    {t(COPY.factOwner)}: {action.owner}
                    {action.ownerLabel ? `, ${action.ownerLabel}` : ""}
                  </span>
                  <span>
                    {t(COPY.factDue)}: {action.due}
                  </span>
                  <span>{action.kind}</span>
                  <span>{action.origin}</span>
                </span>
                {action.condition ? <span className="wd-meta">{action.condition}</span> : null}
                {action.problems.map((problem) => (
                  <span key={problem} className="wd-meet-problem">
                    {problem}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        ) : (
          none
        )}
      </section>

      <section aria-label={t(L.unresolvedLabel)}>
        <h5 className="wd-work-section-label">{t(L.unresolvedLabel)}</h5>
        {minutes.unresolved.length > 0 ? (
          <ul className="wd-meet-items" data-testid="minutes-unresolved">
            {minutes.unresolved.map((item) => (
              <li key={item.key}>
                <span>{item.text}</span>
                <span className="wd-meet-item-meta">{item.origin}</span>
              </li>
            ))}
          </ul>
        ) : (
          none
        )}
      </section>

      <section aria-label={t(L.evidenceLabel)}>
        <h5 className="wd-work-section-label">{t(L.evidenceLabel)}</h5>
        {minutes.evidence.length > 0 ? (
          <ul className="wd-work-list">
            {minutes.evidence.map((doc) => (
              <li key={doc.id}>
                <span className="wd-oid">{doc.id}</span>
                <span className="wd-work-list-main">{doc.title}</span>
              </li>
            ))}
          </ul>
        ) : (
          none
        )}
      </section>

      <section aria-label={t(L.distributionLabel)}>
        <h5 className="wd-work-section-label">{t(L.distributionLabel)}</h5>
        {minutes.distribution.length > 0 ? <p className="wd-work-text">{minutes.distribution.join(", ")}</p> : none}
      </section>
    </div>
  );
}

function fillId(template: string, id: string): string {
  return template.replace("{id}", id);
}

function Record({ minutes, language }: { minutes: MinutesPanelView; language: Language }) {
  const t = (pair: { en: string; de: string }) => say(pair, language);
  const record = minutes.record;
  if (!record) return null;
  return (
    <div className="wd-meet-record" data-testid="minutes-record">
      <span>{record.confirmedNote}</span>
      {record.evidenceDocument ? (
        <span data-testid="minutes-evidence-doc">
          <span className="wd-strong">{t(L.filedAs)}: </span>
          <span className="wd-oid">{record.evidenceDocument.id}</span> {record.evidenceDocument.title}
        </span>
      ) : null}
      {record.raised.length > 0 ? (
        <span data-testid="minutes-raised">
          <span className="wd-strong">{t(L.raised)}: </span>
          {record.raised.map((action, index) => (
            <span key={action.id}>
              {index > 0 ? ", " : ""}
              <Link className="wd-work-link" href={action.href}>
                {action.id}
              </Link>
            </span>
          ))}
        </span>
      ) : null}
      <span data-testid="minutes-distribution">{record.distribution}</span>
    </div>
  );
}

/* ==========================================================================
   Confirming
   ========================================================================== */

function Confirmation({
  roleId,
  language,
  minutes,
  onDone,
}: {
  roleId: string;
  language: Language;
  minutes: MinutesPanelView;
  onDone: (response: OperationOutcome) => void;
}) {
  const t = (pair: { en: string; de: string }) => say(pair, language);
  const [pending, start] = useTransition();
  const [decisions, setDecisions] = useState(false);
  const [actions, setActions] = useState(false);
  const [distribution, setDistribution] = useState(false);
  const [own, setOwn] = useState(false);
  const [reason, setReason] = useState("");

  const ready = minutes.readiness.ready && minutes.confirmation.reachable;
  const all = decisions && actions && distribution && own && reason.trim().length > 0;

  return (
    <section className="wd-work-section" aria-label={t(L.confirmTitle)}>
      <h4 className="wd-work-section-label">{t(L.confirmTitle)}</h4>
      {!minutes.readiness.ready ? (
        <div className="wd-work-callout" data-tone="warning" data-testid="minutes-missing">
          <span className="wd-strong">{t(L.missing)}</span>
          <ul className="wd-work-bullets">
            {minutes.readiness.missing.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="wd-meta" data-testid="minutes-ready">
          {t(L.ready)}
        </p>
      )}
      {!minutes.confirmation.reachable && minutes.confirmation.reason ? <p className="wd-meta">{minutes.confirmation.reason}</p> : null}

      <form
        className="wd-work-form"
        data-testid="confirm-form"
        onSubmit={(event) => {
          event.preventDefault();
          start(async () => {
            onDone(
              await actionConfirmMinutes({
                roleId,
                minutesId: minutes.minutesId,
                version: minutes.version,
                confirmDecisions: decisions,
                confirmActions: actions,
                confirmDistribution: distribution,
                confirmed: own,
                rationale: reason,
              }),
            );
          });
        }}
      >
        <div className="wd-work-form-meta">
          <span className="wd-strong">{t(COPY.willChange)}:</span>
          <ul className="wd-work-bullets" data-testid="confirm-will-change">
            {minutes.confirmation.willChange.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <span>
            <span className="wd-strong">{t(COPY.approvalRequired)}: </span>
            {minutes.confirmation.authorityLabel ? `${minutes.confirmation.authorityLabel}. ` : ""}
            {minutes.confirmation.approval}
          </span>
        </div>
        <label className="wd-work-check">
          <input type="checkbox" checked={decisions} onChange={(event) => setDecisions(event.target.checked)} name="confirmDecisions" />
          <span>{t(L.confirmDecisions)}</span>
        </label>
        <label className="wd-work-check">
          <input type="checkbox" checked={actions} onChange={(event) => setActions(event.target.checked)} name="confirmActions" />
          <span>{t(L.confirmActions)}</span>
        </label>
        <label className="wd-work-check">
          <input type="checkbox" checked={distribution} onChange={(event) => setDistribution(event.target.checked)} name="confirmDistribution" />
          <span>{t(L.confirmDistribution)}</span>
        </label>
        <label>
          {t(L.reason)}
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} name="reason" required />
        </label>
        <label className="wd-work-check">
          <input type="checkbox" checked={own} onChange={(event) => setOwn(event.target.checked)} name="confirmed" />
          <span>{t(L.confirmOwn)}</span>
        </label>
        <div className="wd-work-form-actions">
          <button type="submit" className="wd-btn wd-btn-primary wd-btn-sm" disabled={pending || !ready || !all} data-testid="confirm-submit">
            {pending ? t(L.working) : t(L.confirmSubmit)}
          </button>
        </div>
      </form>
    </section>
  );
}

/* ==========================================================================
   Editing
   ========================================================================== */

type EditorOptions = After["editor"];

function blankKey(draft: MinutesDraft, prefix: string): string {
  const keys = new Set([...draft.facts, ...draft.decisions, ...draft.actions, ...draft.unresolved].map((item) => item.key));
  let index = 1;
  while (keys.has(`${prefix}E-${String(index).padStart(2, "0")}`)) index += 1;
  return `${prefix}E-${String(index).padStart(2, "0")}`;
}

function Editor({
  roleId,
  meetingId,
  language,
  minutes,
  editor,
  onDone,
  onCancel,
}: {
  roleId: string;
  meetingId: string;
  language: Language;
  minutes: MinutesPanelView;
  editor: EditorOptions;
  onDone: (response: OperationOutcome) => void;
  onCancel: () => void;
}) {
  const t = (pair: { en: string; de: string }) => say(pair, language);
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<MinutesDraft>(() => structuredClone(minutes.draft));
  const patch = (next: Partial<MinutesDraft>) => setDraft((current) => ({ ...current, ...next }));

  const remove = (
    <span>{t(L.remove)}</span>
  );

  return (
    <form
      className="wd-work-form"
      data-testid="minutes-editor"
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          onDone(await actionSaveMinutes({ roleId, meetingId, minutesId: minutes.minutesId, version: minutes.version, draft }));
        });
      }}
    >
      <label>
        {t(L.summaryLabel)}
        <textarea value={draft.summary} onChange={(event) => patch({ summary: event.target.value })} rows={4} name="summary" />
      </label>

      <fieldset className="wd-stack-1" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="wd-strong">{t(L.factsLabel)}</legend>
        {draft.facts.map((fact, index) => (
          <div key={fact.key} className="wd-meet-edit-item">
            <textarea
              aria-label={`${t(L.factsLabel)} ${index + 1}`}
              value={fact.text}
              onChange={(event) => patch({ facts: draft.facts.map((item) => (item.key === fact.key ? { ...item, text: event.target.value } : item)) })}
            />
            <button type="button" className="wd-btn wd-btn-quiet wd-btn-sm" onClick={() => patch({ facts: draft.facts.filter((item) => item.key !== fact.key) })}>
              {remove}
            </button>
          </div>
        ))}
        <div>
          <button
            type="button"
            className="wd-btn wd-btn-quiet wd-btn-sm"
            onClick={() => patch({ facts: [...draft.facts, { key: blankKey(draft, "F"), text: "", evidenceIds: [], turnIds: [], origin: "person" }] })}
          >
            {t(L.add)}
          </button>
        </div>
      </fieldset>

      <fieldset className="wd-stack-1" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="wd-strong">{t(L.decisionsLabel)}</legend>
        {draft.decisions.map((decision, index) => (
          <div key={decision.key} className="wd-meet-edit-item">
            <textarea
              aria-label={`${t(L.decisionsLabel)} ${index + 1}`}
              value={decision.text}
              onChange={(event) =>
                patch({ decisions: draft.decisions.map((item) => (item.key === decision.key ? { ...item, text: event.target.value } : item)) })
              }
            />
            <div className="wd-meet-grid">
              <label>
                {t(L.fieldDecision)}
                <select
                  value={decision.decisionId ?? ""}
                  onChange={(event) =>
                    patch({
                      decisions: draft.decisions.map((item) =>
                        item.key === decision.key ? { ...item, decisionId: event.target.value.length > 0 ? event.target.value : null } : item,
                      ),
                    })
                  }
                >
                  <option value="">{t(L.fieldNoDecision)}</option>
                  {editor.decisions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t(L.fieldOutcome)}
                <select
                  value={decision.outcome}
                  onChange={(event) =>
                    patch({
                      decisions: draft.decisions.map((item) =>
                        item.key === decision.key ? { ...item, outcome: event.target.value as MinutesDecisionOutcome } : item,
                      ),
                    })
                  }
                >
                  {MINUTES_DECISION_OUTCOMES.map((outcome) => (
                    <option key={outcome} value={outcome}>
                      {t(OUTCOME_LABELS[outcome])}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button type="button" className="wd-btn wd-btn-quiet wd-btn-sm" onClick={() => patch({ decisions: draft.decisions.filter((item) => item.key !== decision.key) })}>
              {remove}
            </button>
          </div>
        ))}
        <div>
          <button
            type="button"
            className="wd-btn wd-btn-quiet wd-btn-sm"
            onClick={() =>
              patch({ decisions: [...draft.decisions, { key: blankKey(draft, "D"), text: "", decisionId: null, outcome: "referred", turnIds: [], origin: "person" }] })
            }
          >
            {t(L.add)}
          </button>
        </div>
      </fieldset>

      <fieldset className="wd-stack-1" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="wd-strong">{t(L.actionsLabel)}</legend>
        {draft.actions.map((action, index) => {
          const set = (next: Partial<typeof action>) =>
            patch({ actions: draft.actions.map((item) => (item.key === action.key ? { ...item, ...next } : item)) });
          const existing = action.existingActionId !== null;
          return (
            <div key={action.key} className="wd-meet-edit-item" data-action-key={action.key}>
              <label>
                {t(L.fieldExisting)}
                <select
                  value={action.existingActionId ?? ""}
                  onChange={(event) => set({ existingActionId: event.target.value.length > 0 ? event.target.value : null })}
                  name={`existing-${action.key}`}
                >
                  <option value="">{t(L.fieldNewAction)}</option>
                  {editor.existingActions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {existing ? (
                <>
                  {/* A follow-up changes nothing on the action itself: its owner and date stay its own. */}
                  <p className="wd-meta">{t(L.followUpKeeps)}</p>
                  <label>
                    {t(L.fieldFollowUpNote)}
                    <textarea value={action.completionCondition} onChange={(event) => set({ completionCondition: event.target.value })} name={`note-${action.key}`} />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    {t(L.fieldTitle)} {index + 1}
                    <input type="text" value={action.title} onChange={(event) => set({ title: event.target.value })} name={`title-${action.key}`} />
                  </label>
                  <div className="wd-meet-grid">
                    <label>
                      {t(L.fieldOwner)}
                      <select
                        value={action.ownerUserId ?? ""}
                        onChange={(event) => set({ ownerUserId: event.target.value.length > 0 ? event.target.value : null })}
                        name={`owner-${action.key}`}
                      >
                        <option value="">{"..."}</option>
                        {editor.owners.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {t(L.fieldDue)}
                      <input
                        type="date"
                        value={action.dueOn ?? ""}
                        min={editor.minDate}
                        onChange={(event) => set({ dueOn: event.target.value.length === 10 ? event.target.value : null })}
                        name={`due-${action.key}`}
                      />
                    </label>
                    <label>
                      {t(L.fieldKind)}
                      <select value={action.kind} onChange={(event) => set({ kind: event.target.value })}>
                        {editor.kinds.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {t(L.fieldDeliveredBy)}
                      <input type="text" value={action.ownerLabel} onChange={(event) => set({ ownerLabel: event.target.value })} />
                    </label>
                  </div>
                  <label>
                    {t(L.fieldCondition)}
                    <textarea value={action.completionCondition} onChange={(event) => set({ completionCondition: event.target.value })} />
                  </label>
                </>
              )}
              <button type="button" className="wd-btn wd-btn-quiet wd-btn-sm" onClick={() => patch({ actions: draft.actions.filter((item) => item.key !== action.key) })}>
                {remove}
              </button>
            </div>
          );
        })}
        <div>
          <button
            type="button"
            className="wd-btn wd-btn-quiet wd-btn-sm"
            data-testid="minutes-add-action"
            onClick={() =>
              patch({
                actions: [
                  ...draft.actions,
                  {
                    key: blankKey(draft, "A"),
                    title: "",
                    existingActionId: null,
                    ownerUserId: null,
                    ownerLabel: "",
                    dueOn: null,
                    kind: editor.kinds[0]?.id ?? "",
                    completionCondition: "",
                    evidenceIds: [],
                    turnIds: [],
                    origin: "person",
                  },
                ],
              })
            }
          >
            {t(L.add)}
          </button>
        </div>
      </fieldset>

      <fieldset className="wd-stack-1" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="wd-strong">{t(L.unresolvedLabel)}</legend>
        {draft.unresolved.map((item, index) => (
          <div key={item.key} className="wd-meet-edit-item">
            <textarea
              aria-label={`${t(L.unresolvedLabel)} ${index + 1}`}
              value={item.text}
              onChange={(event) =>
                patch({ unresolved: draft.unresolved.map((entry) => (entry.key === item.key ? { ...entry, text: event.target.value } : entry)) })
              }
            />
            <button type="button" className="wd-btn wd-btn-quiet wd-btn-sm" onClick={() => patch({ unresolved: draft.unresolved.filter((entry) => entry.key !== item.key) })}>
              {remove}
            </button>
          </div>
        ))}
        <div>
          <button
            type="button"
            className="wd-btn wd-btn-quiet wd-btn-sm"
            onClick={() => patch({ unresolved: [...draft.unresolved, { key: blankKey(draft, "U"), text: "", turnIds: [], origin: "person" }] })}
          >
            {t(L.add)}
          </button>
        </div>
      </fieldset>

      <fieldset className="wd-stack-1" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="wd-strong">{t(L.evidenceLabel)}</legend>
        <div className="wd-work-choices">
          {editor.evidence.map((doc) => (
            <label key={doc.id} className="wd-work-check">
              <input
                type="checkbox"
                checked={draft.evidenceIds.includes(doc.id)}
                onChange={(event) =>
                  patch({
                    evidenceIds: event.target.checked ? [...draft.evidenceIds, doc.id] : draft.evidenceIds.filter((id) => id !== doc.id),
                  })
                }
              />
              <span>
                <span className="wd-oid">{doc.id}</span> {doc.title}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="wd-stack-1" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="wd-strong">{t(L.distributionLabel)}</legend>
        <div className="wd-work-choices">
          {editor.people.map((person) => (
            <label key={person.id} className="wd-work-check">
              <input
                type="checkbox"
                checked={draft.distribution.includes(person.id)}
                onChange={(event) =>
                  patch({
                    distribution: event.target.checked
                      ? [...draft.distribution, person.id]
                      : draft.distribution.filter((id) => id !== person.id),
                  })
                }
              />
              <span>{person.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="wd-work-form-meta">
        <span>{t(L.saveWill)}</span>
      </div>
      <div className="wd-work-form-actions">
        <button type="submit" className="wd-btn wd-btn-primary wd-btn-sm" disabled={pending} data-testid="minutes-save">
          {pending ? t(L.working) : t(L.save)}
        </button>
        <button type="button" className="wd-btn wd-btn-quiet wd-btn-sm" onClick={onCancel} disabled={pending}>
          {t(L.cancel)}
        </button>
      </div>
    </form>
  );
}

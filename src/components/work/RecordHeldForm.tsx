"use client";

/**
 * Records a meeting as held, from its agenda entry.
 *
 * The person writes what the meeting established and confirms it is their
 * record. The server action runs `recordMeetingHeld` through the authority
 * gate with an approval in their name, and the dependent actions the server
 * found each get a follow-up entry. Before the meeting starts the form is
 * disabled with the reason, rather than offered and refused.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionRecordMeetingHeld } from "@app/workday/[role]/work/actions";
import type { Language } from "@/i18n/labels";
import { COPY, fill, say } from "@/features/work/copy";
import { AGENDA_COPY } from "@/features/work/modules/agenda/copy";
import type { OperationOutcome } from "@/features/work/modules/actions/operations";

export function RecordHeldForm({
  roleId,
  language,
  meetingId,
  enabled,
  reason,
  dependentIds,
  approval,
}: {
  roleId: string;
  language: Language;
  meetingId: string;
  enabled: boolean;
  reason: string;
  dependentIds: readonly string[];
  approval: string;
}) {
  const router = useRouter();
  const [outcome, setOutcome] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<OperationOutcome | null>(null);
  const t = (pair: { en: string; de: string }) => say(pair, language);

  if (!enabled) {
    return <p className="wd-work-text" data-testid="record-held-disabled">{reason}</p>;
  }

  return (
    <form
      className="wd-work-form"
      data-testid="record-held-form"
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          const response = await actionRecordMeetingHeld({ roleId, meetingId, outcome, confirmed });
          setResult(response);
          if (response.ok) router.refresh();
        });
      }}
    >
      <p className="wd-meta">{t(AGENDA_COPY.recordHeldIntro)}</p>
      <label>
        {t(AGENDA_COPY.fieldOutcome)}
        <textarea value={outcome} onChange={(event) => setOutcome(event.target.value)} name="outcome" required />
      </label>
      <label className="wd-work-check">
        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} name="confirmed" />
        <span>{t(AGENDA_COPY.confirmHeld)}</span>
      </label>
      <div className="wd-work-form-meta">
        {dependentIds.length > 0 ? <span>{fill(t(AGENDA_COPY.willFollowUp), { ids: dependentIds.join(", ") })}</span> : null}
        <span>
          <span className="wd-strong">{t(COPY.approvalRequired)}: </span>
          {approval}
        </span>
      </div>
      <div className="wd-work-form-actions">
        <button
          type="submit"
          className="wd-btn wd-btn-primary wd-btn-sm"
          disabled={pending || outcome.trim().length === 0 || !confirmed}
          data-testid="record-held-submit"
        >
          {t(AGENDA_COPY.recordHeld)}
        </button>
      </div>
      {result ? (
        <p className="wd-notice" role="status" data-tone={result.ok ? "info" : "warning"} data-testid="record-held-result">
          {result.message}
          {result.receipt.length > 0 ? ` ${result.receipt.join(". ")}.` : ""}
        </p>
      ) : null}
    </form>
  );
}

"use client";

/**
 * Structured feedback on one Partner output (plan 4.11).
 *
 * Six kinds, behind a small disclosure so they do not crowd the output they
 * are about: Useful, Not useful, Wrong source, Wrong interpretation, Missing
 * context, Too verbose. Each is a toggle; the record, with what produced the
 * output, is kept on the server and read by the Product Owner Console. The
 * control executes nothing and changes nothing in the person's work, and it
 * says so.
 */

import { useState } from "react";
import type { Language } from "@/i18n/labels";
import { pick } from "@/workday/contracts";
import { PARTNER_FEEDBACK_KINDS, type PartnerFeedbackKind, type PartnerFeedbackTarget } from "@/features/partner/rules";
import { FEEDBACK_LABELS, partnerLabel } from "./labels";

export type FeedbackHandler = (
  target: { kind: PartnerFeedbackTarget; id: string },
  kind: PartnerFeedbackKind,
) => Promise<PartnerFeedbackKind[] | null>;

export function AIFeedbackControl({
  target,
  given,
  language,
  onFeedback,
}: {
  target: { kind: PartnerFeedbackTarget; id: string };
  given: readonly string[];
  language: Language;
  onFeedback?: FeedbackHandler;
}) {
  const [kinds, setKinds] = useState<string[]>([...given]);
  const [busy, setBusy] = useState(false);
  if (!onFeedback) return null;

  const toggle = async (kind: PartnerFeedbackKind) => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await onFeedback(target, kind);
      if (next) setKinds(next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="app-feedback" data-feedback-target={`${target.kind}:${target.id}`}>
      <summary className="app-meta" style={{ cursor: "pointer" }}>
        {kinds.length > 0
          ? `${partnerLabel("feedbackGiven", language)} (${kinds.length})`
          : partnerLabel("feedbackLabel", language)}
      </summary>
      <span className="app-row-wrap" style={{ gap: "var(--app-1)", marginTop: "var(--app-1)" }} role="group" aria-label={partnerLabel("feedbackLabel", language)}>
        {PARTNER_FEEDBACK_KINDS.map((kind) => {
          const on = kinds.includes(kind);
          return (
            <button
              key={kind}
              type="button"
              className="app-prompt-chip"
              aria-pressed={on}
              data-feedback-kind={kind}
              disabled={busy}
              onClick={() => void toggle(kind)}
              style={on ? { borderColor: "var(--app-accent)", fontWeight: 600 } : undefined}
            >
              {pick(FEEDBACK_LABELS[kind], language)}
            </button>
          );
        })}
      </span>
      <span className="app-faint" style={{ display: "block", fontSize: "var(--app-text-2xs)", marginTop: "var(--app-1)" }}>
        {partnerLabel("feedbackNote", language)}
      </span>
    </details>
  );
}

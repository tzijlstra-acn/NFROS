"use client";

/**
 * Send product feedback, from the workday (plan 7.8).
 *
 * A small dialog opened from the account menu in the workday header, so it
 * adds nothing to the four-item navigation and nothing to the working
 * surface. The analyst chooses one of the eight kinds and says what happened
 * in a sentence; the role and the route they were on go with it. Nothing from
 * their work, their selection or their chats is attached, and the dialog says
 * so.
 *
 * Accessible as a modal: labelled, Escape closes it, focus moves into it on
 * open and back to the account button on close, and the result is announced
 * in a status region.
 */

import { useActionState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import type { Language } from "@/i18n/labels";
import { actionSubmitWorkdayFeedback } from "./actions";
import { FEEDBACK_COPY as COPY, FEEDBACK_KIND_LABELS, FEEDBACK_KIND_ORDER } from "./copy";

const ROLE_PATTERN = /^\/workday\/([a-z-]+)/;

/** The role the person is working in, from the workday route, or null outside a role. */
export function workdayRoleFromPath(pathname: string | null): string | null {
  const match = pathname ? ROLE_PATTERN.exec(pathname) : null;
  return match?.[1] ?? null;
}

const fieldStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: "var(--wd-text-xs)",
  color: "var(--wd-text-secondary)",
} as const;

const inputStyle = {
  font: "inherit",
  fontSize: "var(--wd-text-sm)",
  color: "var(--wd-text)",
  background: "var(--wd-surface)",
  border: "1px solid var(--wd-border-strong)",
  borderRadius: "var(--wd-radius)",
  padding: "6px 8px",
  width: "100%",
  minWidth: 0,
} as const;

export function WorkdayFeedbackDialog({
  open,
  onClose,
  language,
}: {
  open: boolean;
  onClose: () => void;
  language: Language;
}) {
  const say = (pair: { en: string; de: string }) => (language === "de" ? pair.de : pair.en);
  const pathname = usePathname();
  const roleId = workdayRoleFromPath(pathname);
  const [state, formAction, pending] = useActionState(actionSubmitWorkdayFeedback, null);
  const firstField = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    if (!open) return;
    firstField.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !roleId) return null;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgb(16 24 40 / 28%)", display: "grid", placeItems: "center", padding: 16 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="workday-feedback-title"
        lang={language}
        data-testid="workday-feedback-dialog"
        style={{
          width: "min(440px, 100%)",
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
          background: "var(--wd-surface)",
          color: "var(--wd-text)",
          border: "1px solid var(--wd-border)",
          borderRadius: "var(--wd-radius-lg)",
          boxShadow: "var(--wd-shadow-lg)",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <h2 id="workday-feedback-title" style={{ margin: 0, fontSize: "var(--wd-text-lg)", fontWeight: 600 }}>
          {say(COPY.dialogTitle)}
        </h2>
        <p style={{ margin: 0, fontSize: "var(--wd-text-sm)", color: "var(--wd-text-secondary)" }}>{say(COPY.dialogNote)}</p>

        {state?.ok ? (
          <>
            <p role="status" data-testid="workday-feedback-result" data-ok="true" style={{ margin: 0, fontSize: "var(--wd-text-sm)" }}>
              {state.message}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className="wd-btn wd-btn-sm" onClick={onClose}>
                {say(COPY.close)}
              </button>
            </div>
          </>
        ) : (
          <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input type="hidden" name="roleId" value={roleId} />
            <input type="hidden" name="route" value={pathname ?? ""} />
            <input type="hidden" name="language" value={language} />
            <label style={fieldStyle}>
              {say(COPY.kind)}
              <select ref={firstField} name="kind" defaultValue="workflow-friction" style={inputStyle} data-testid="workday-feedback-kind">
                {FEEDBACK_KIND_ORDER.map((kind) => (
                  <option key={kind} value={kind}>
                    {say(FEEDBACK_KIND_LABELS[kind] ?? { en: kind, de: kind })}
                  </option>
                ))}
              </select>
            </label>
            <label style={fieldStyle}>
              {say(COPY.summary)}
              <input name="summary" required minLength={8} maxLength={280} style={inputStyle} data-testid="workday-feedback-summary" />
            </label>
            <label style={fieldStyle}>
              {say(COPY.detail)}
              <textarea name="detail" rows={3} maxLength={2000} style={{ ...inputStyle, resize: "vertical" }} />
            </label>
            {state && !state.ok ? (
              <p role="status" data-testid="workday-feedback-result" data-ok="false" style={{ margin: 0, fontSize: "var(--wd-text-sm)", color: "var(--wd-warning-text, inherit)" }}>
                {state.message}
              </p>
            ) : null}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="wd-btn wd-btn-quiet wd-btn-sm" onClick={onClose}>
                {say(COPY.cancel)}
              </button>
              <button type="submit" className="wd-btn wd-btn-primary wd-btn-sm" disabled={pending} data-testid="workday-feedback-send">
                {pending ? say(COPY.sending) : say(COPY.send)}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

"use client";

/**
 * One console action, as a form.
 *
 * Every console write is a form posting to a server action that calls
 * `governConsoleAction`. This component is the one shape those forms take,
 * so permission, approval and the result read the same everywhere in the
 * console (and in the other console workstreams' pages, which can use it):
 *
 *   - not permitted: the control is disabled and the reason is shown. The
 *     server checks again regardless; this only saves a refused round trip.
 *   - routine: one button.
 *   - material: the button opens the approval. It states what will change,
 *     line by line, asks for the person's rationale and their confirmation
 *     that it is their own, and posts the fingerprint of the change they
 *     reviewed, which the server compares with the change as it is now.
 *
 * The result is announced in a status region, in the reader's language, as
 * the server action returns it.
 */

import { useActionState, useState, type ReactNode } from "react";
import type { ConsoleFormState } from "../governance";
import { consoleLabelStyle, consolePanelStyle, consoleTextareaStyle, consoleWrapStyle } from "../shell/styles";

export type ConsoleServerAction = (previous: ConsoleFormState | null, data: FormData) => Promise<ConsoleFormState>;

const COPY = {
  review: { en: "Review and approve", de: "Pruefen und genehmigen" },
  cancel: { en: "Cancel", de: "Abbrechen" },
  whatChanges: { en: "What will change", de: "Was sich aendert" },
  approvalRequired: {
    en: "This change is material. It needs your approval, bound to exactly the change listed here.",
    de: "Diese Aenderung ist wesentlich. Sie braucht Ihre Genehmigung, gebunden an genau die hier aufgefuehrte Aenderung.",
  },
  rationale: { en: "Your rationale", de: "Ihre Begruendung" },
  rationalePlaceholder: {
    en: "Why this change, in your own words.",
    de: "Warum diese Aenderung, in eigenen Worten.",
  },
  confirm: {
    en: "I confirm this rationale is my own and I approve this exact change.",
    de: "Ich bestaetige, dass diese Begruendung meine eigene ist, und genehmige genau diese Aenderung.",
  },
  fingerprint: { en: "Change fingerprint", de: "Fingerabdruck der Aenderung" },
  working: { en: "Working", de: "In Arbeit" },
  notPermitted: { en: "Not permitted", de: "Nicht zulaessig" },
} as const;

export interface ConsoleActionFormProps {
  action: ConsoleServerAction;
  language: "en" | "de";
  /** The submit label, for example "Disable". */
  label: string;
  /** Hidden fields: the target ids the server action reads. */
  hidden?: Record<string, string>;
  /** Whether the acting persona may do this, from `checkConsolePermission`. */
  permitted: boolean;
  /** Why not, when not permitted or when the action's rule refuses it now. */
  blockedReason?: string | null;
  /**
   * The full permission reason, shown as the control's title. The visible
   * text stays short so a page of disabled controls does not repeat one
   * sentence under every button.
   */
  permissionTitle?: string | null;
  /** Visible form fields, for example a version number or release notes. */
  fields?: ReactNode;
  /** Material actions open an approval. */
  approval?: {
    lines: readonly string[];
    fingerprint: string;
  } | null;
  tone?: "primary" | "secondary" | "danger";
  testId: string;
}

export function ConsoleActionForm({
  action,
  language,
  label,
  hidden = {},
  permitted,
  blockedReason = null,
  permissionTitle = null,
  fields,
  approval = null,
  tone = "secondary",
  testId,
}: ConsoleActionFormProps) {
  const say = (pair: { en: string; de: string }) => (language === "de" ? pair.de : pair.en);
  const [state, formAction, pending] = useActionState<ConsoleFormState | null, FormData>(action, null);
  const [open, setOpen] = useState(false);
  const disabled = !permitted || blockedReason !== null || pending;
  const buttonClass = `app-btn app-btn-sm ${tone === "primary" ? "app-btn-primary" : tone === "danger" ? "app-btn-danger" : "app-btn-secondary"}`;

  const hiddenInputs = Object.entries(hidden).map(([name, value]) => (
    <input key={name} type="hidden" name={name} value={value} />
  ));

  const result = state ? (
    <span
      role="status"
      className="app-meta"
      data-testid={`${testId}-result`}
      data-ok={state.ok ? "true" : "false"}
      style={{ ...consoleWrapStyle, color: state.ok ? "var(--app-success-text)" : "var(--app-warning-text)" }}
    >
      {state.message}
    </span>
  ) : null;

  const reason = blockedReason ? (
    <span className="app-meta" data-testid={`${testId}-blocked`} style={consoleWrapStyle}>
      {blockedReason}
    </span>
  ) : null;
  const buttonTitle = !permitted ? (permissionTitle ?? say(COPY.notPermitted)) : (blockedReason ?? undefined);

  if (approval) {
    return (
      <div className="app-stack-2" data-testid={testId}>
        {!open ? (
          <div className="app-row app-row-wrap">
            <button
              type="button"
              className={buttonClass}
              disabled={disabled}
              onClick={() => setOpen(true)}
              title={buttonTitle}
              data-testid={`${testId}-open`}
            >
              {label}
            </button>
            {reason}
          </div>
        ) : (
          <form action={formAction} style={consolePanelStyle} className="app-stack-3" data-testid={`${testId}-approval`}>
            {hiddenInputs}
            <input type="hidden" name="fingerprint" value={approval.fingerprint} />
            <span className="app-strong" style={{ fontSize: "var(--app-text-sm)" }}>
              {label}
            </span>
            <span className="app-meta" style={consoleWrapStyle}>{say(COPY.approvalRequired)}</span>
            <div className="app-stack-1">
              <span className="app-secondary" style={{ fontSize: "var(--app-text-xs)" }}>{say(COPY.whatChanges)}</span>
              <ul className="app-stack-1" style={{ margin: 0, paddingLeft: "var(--app-4)" }}>
                {approval.lines.map((line) => (
                  <li key={line} className="app-meta" style={consoleWrapStyle}>
                    {line}
                  </li>
                ))}
              </ul>
              <span className="app-meta">
                {say(COPY.fingerprint)} <span className="app-oid">{approval.fingerprint.slice(0, 12)}</span>
              </span>
            </div>
            {fields}
            <label style={consoleLabelStyle}>
              {say(COPY.rationale)}
              <textarea
                name="rationale"
                rows={2}
                placeholder={say(COPY.rationalePlaceholder)}
                style={consoleTextareaStyle}
                data-testid={`${testId}-rationale`}
              />
            </label>
            <label className="app-row" style={{ fontSize: "var(--app-text-sm)", alignItems: "flex-start" }}>
              <input type="checkbox" name="rationaleConfirmed" data-testid={`${testId}-confirm`} style={{ marginTop: 3 }} />
              <span style={consoleWrapStyle}>{say(COPY.confirm)}</span>
            </label>
            <div className="app-row app-row-wrap">
              <button type="submit" className={buttonClass} disabled={pending} data-testid={`${testId}-submit`}>
                {pending ? say(COPY.working) : label}
              </button>
              <button type="button" className="app-btn app-btn-quiet app-btn-sm" onClick={() => setOpen(false)}>
                {say(COPY.cancel)}
              </button>
            </div>
            {result}
          </form>
        )}
        {!open ? result : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="app-stack-2" data-testid={testId}>
      {hiddenInputs}
      {fields}
      <div className="app-row app-row-wrap">
        <button type="submit" className={buttonClass} disabled={disabled} title={buttonTitle} data-testid={`${testId}-submit`}>
          {pending ? say(COPY.working) : label}
        </button>
        {reason}
      </div>
      {result}
    </form>
  );
}

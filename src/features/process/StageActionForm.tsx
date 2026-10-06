"use client";

/**
 * A stage form that submits to a process server action and says what happened.
 *
 * The fields are rendered on the server and passed in as children, so the
 * form's content is the engine's view and this component only owns the
 * submission: the pending label while the action runs (bounded by the
 * action, never a permanent spinner) and the result sentence afterwards,
 * announced to assistive technology.
 */

import { useActionState, type ReactNode } from "react";
import type { StageActionState } from "./actions";

export interface StageActionFormProps {
  action: (previous: StageActionState | null, data: FormData) => Promise<StageActionState>;
  hidden: Record<string, string>;
  submitLabel: string;
  workingLabel: string;
  ariaLabel: string;
  disabled?: boolean;
  testId?: string;
  children?: ReactNode;
}

export function StageActionForm({
  action,
  hidden,
  submitLabel,
  workingLabel,
  ariaLabel,
  disabled = false,
  testId,
  children,
}: StageActionFormProps) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form
      action={formAction}
      aria-label={ariaLabel}
      data-testid={testId}
      style={{ display: "flex", flexDirection: "column", gap: "var(--wd-3)", minWidth: 0 }}
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--wd-3)", flexWrap: "wrap" }}>
        <button
          type="submit"
          disabled={disabled || pending}
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "var(--wd-2) var(--wd-5)",
            background: disabled ? "var(--wd-surface-subtle)" : "var(--wd-accent)",
            color: disabled ? "var(--wd-text-disabled)" : "#fff",
            fontSize: "var(--wd-text-sm)",
            fontWeight: 500,
            borderRadius: "var(--wd-radius)",
            border: disabled ? "1px solid var(--wd-border)" : "none",
            cursor: disabled || pending ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {pending ? workingLabel : submitLabel}
        </button>
        {state ? (
          <p
            role="status"
            data-testid={testId ? `${testId}-result` : undefined}
            style={{
              margin: 0,
              fontSize: "var(--wd-text-sm)",
              color: state.ok ? "var(--wd-success)" : "var(--wd-danger)",
              minWidth: 0,
              overflowWrap: "anywhere",
            }}
          >
            {state.message}
          </p>
        ) : null}
      </div>
      {state && !state.ok && state.reasons.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: "var(--wd-5)", fontSize: "var(--wd-text-xs)", color: "var(--wd-danger)" }}>
          {state.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}

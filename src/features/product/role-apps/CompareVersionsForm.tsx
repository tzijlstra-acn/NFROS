"use client";

/**
 * Compare versions (plan 7.2): pick two versions of one app and read what
 * differs. The comparison runs on the server, which checks the persona's
 * authority and records the read; this form only posts the two ids and
 * renders the rows it gets back.
 */

import { useActionState } from "react";
import { actionCompareVersions, type CompareState } from "./actions";
import { consoleInputStyle, consoleWrapStyle } from "../shell/styles";

const COPY = {
  compare: { en: "Compare", de: "Vergleichen" },
  with: { en: "with", de: "mit" },
  field: { en: "Field", de: "Feld" },
  changed: { en: "Changed", de: "Geaendert" },
  same: { en: "Same", de: "Gleich" },
  added: { en: "Added", de: "Hinzugefuegt" },
  removed: { en: "Removed", de: "Entfernt" },
  working: { en: "Comparing", de: "Wird verglichen" },
} as const;

export function CompareVersionsForm({
  language,
  versions,
  defaultLeft,
  defaultRight,
  permitted,
  blockedReason,
  testId,
}: {
  language: "en" | "de";
  versions: ReadonlyArray<{ id: string; label: string }>;
  defaultLeft: string;
  defaultRight: string;
  permitted: boolean;
  blockedReason: string | null;
  testId: string;
}) {
  const say = (pair: { en: string; de: string }) => (language === "de" ? pair.de : pair.en);
  const [state, formAction, pending] = useActionState<CompareState | null, FormData>(actionCompareVersions, null);

  return (
    <div className="app-stack-2" data-testid={testId}>
      <form action={formAction} className="app-row app-row-wrap">
        <select name="left" defaultValue={defaultLeft} style={consoleInputStyle} aria-label={say(COPY.compare)}>
          {versions.map((version) => (
            <option key={version.id} value={version.id}>
              {version.label}
            </option>
          ))}
        </select>
        <span className="app-meta">{say(COPY.with)}</span>
        <select name="right" defaultValue={defaultRight} style={consoleInputStyle} aria-label={say(COPY.with)}>
          {versions.map((version) => (
            <option key={version.id} value={version.id}>
              {version.label}
            </option>
          ))}
        </select>
        <button type="submit" className="app-btn app-btn-secondary app-btn-sm" disabled={!permitted || pending} data-testid={`${testId}-submit`}>
          {pending ? say(COPY.working) : say(COPY.compare)}
        </button>
        {!permitted && blockedReason ? (
          <span className="app-meta" style={consoleWrapStyle}>
            {blockedReason}
          </span>
        ) : null}
      </form>
      {state ? (
        <span role="status" className="app-meta" data-testid={`${testId}-result`} style={consoleWrapStyle}>
          {state.message}
        </span>
      ) : null}
      {state?.ok && state.rows.length > 0 ? (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--app-text-xs)", tableLayout: "fixed" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--app-text-muted)" }}>
                <th style={{ padding: "var(--app-1) var(--app-2)", width: "28%" }}>{say(COPY.field)}</th>
                <th style={{ padding: "var(--app-1) var(--app-2)" }}>{state.left}</th>
                <th style={{ padding: "var(--app-1) var(--app-2)" }}>{state.right}</th>
                <th style={{ padding: "var(--app-1) var(--app-2)", width: "12%" }} />
              </tr>
            </thead>
            <tbody>
              {state.rows.map((row) => (
                <tr key={row.key} style={{ borderTop: "1px solid var(--app-border)", verticalAlign: "top" }}>
                  <td style={{ padding: "var(--app-1) var(--app-2)" }}>{say(row.label)}</td>
                  <td style={{ padding: "var(--app-1) var(--app-2)", overflowWrap: "anywhere" }}>{row.left}</td>
                  <td style={{ padding: "var(--app-1) var(--app-2)", overflowWrap: "anywhere" }}>
                    {row.right}
                    {row.added.length > 0 ? (
                      <span className="app-meta" style={{ display: "block" }}>
                        {say(COPY.added)}: {row.added.join(", ")}
                      </span>
                    ) : null}
                    {row.removed.length > 0 ? (
                      <span className="app-meta" style={{ display: "block" }}>
                        {say(COPY.removed)}: {row.removed.join(", ")}
                      </span>
                    ) : null}
                  </td>
                  <td style={{ padding: "var(--app-1) var(--app-2)", color: row.changed ? "var(--app-warning-text)" : "var(--app-text-muted)" }}>
                    {row.changed ? say(COPY.changed) : say(COPY.same)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

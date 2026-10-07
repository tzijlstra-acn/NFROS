"use client";

/**
 * Today's routine runs, with what each one produced (routine lineage).
 *
 * Read from `ai_routine_runs` and `ai_routine_run_outputs` on the server; the
 * dock's Activity tab lists them above the step by step activity. Every run
 * says what it amounted to: prepared work, no change, needs a person (the
 * authority gate did not allow the step), or failed. A run that prepared
 * work links each thing it prepared, so the person can open it.
 */

import type { Language } from "@/i18n/labels";
import { Chip, Data } from "@/components/workday-v2/primitives";
import { AIFeedbackControl, type FeedbackHandler } from "./AIFeedbackControl";
import { partnerLabel } from "./labels";

/** Plain data, mirrored from `src/features/partner/view.ts` so this client file imports no server module. */
export interface RoutineRunRow {
  id: string;
  routineName: string;
  atMoment: string;
  status: string;
  outcome: string | null;
  summary: string;
  mode: string;
  outputs: Array<{ kind: string; id: string; href: string }>;
}

const OUTCOME: Record<string, { key: string; tone: "success" | "neutral" | "warning" | "danger" | "info" }> = {
  "created-work": { key: "routineCreated", tone: "success" },
  "updated-work": { key: "routineCreated", tone: "success" },
  "no-change": { key: "routineNoChange", tone: "neutral" },
  "needs-human": { key: "routineNeedsHuman", tone: "warning" },
  failed: { key: "routineFailed", tone: "danger" },
};

export function AIRoutineRuns({
  runs,
  language,
  feedback,
  onFeedback,
}: {
  runs: readonly RoutineRunRow[];
  language: Language;
  feedback: Readonly<Record<string, readonly string[]>>;
  onFeedback?: FeedbackHandler;
}) {
  return (
    <section className="app-stack-2" aria-label={partnerLabel("routineRunsTitle", language)} data-partner-region="routine-runs">
      <span className="app-part-label">{partnerLabel("routineRunsTitle", language)}</span>
      {runs.length === 0 ? (
        <span className="app-meta">{partnerLabel("routineRunsEmpty", language)}</span>
      ) : (
        <ul className="app-stack-2" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {runs.map((run) => {
            const outcome = run.outcome ? OUTCOME[run.outcome] : undefined;
            return (
              <li key={run.id} className="app-stack-1" data-routine-run={run.id} data-outcome={run.outcome ?? run.status}>
                <span className="app-row app-row-wrap" style={{ gap: "var(--app-2)" }}>
                  <Data>{run.atMoment}</Data>
                  <span className="app-strong">{run.routineName}</span>
                  <Chip tone={outcome?.tone ?? "info"}>{partnerLabel(outcome?.key ?? "routineRunning", language)}</Chip>
                </span>
                {run.summary ? <span className="app-meta" style={{ overflowWrap: "anywhere" }}>{run.summary}</span> : null}
                {run.outputs.length > 0 ? (
                  <span className="app-row-wrap" style={{ gap: "var(--app-1)" }}>
                    {run.outputs.map((output) => (
                      <a key={`${output.kind}:${output.id}`} className="app-prompt-chip" href={output.href} data-lineage-kind={output.kind}>
                        <Data>{output.id}</Data>
                      </a>
                    ))}
                  </span>
                ) : null}
                {run.outcome === "created-work" ? (
                  <AIFeedbackControl
                    target={{ kind: "routine-run", id: run.id }}
                    given={feedback[`routine-run:${run.id}`] ?? []}
                    language={language}
                    {...(onFeedback ? { onFeedback } : {})}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

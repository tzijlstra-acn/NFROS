"use client";

/**
 * Ask NFR Workspace: a question in, an analysis out.
 *
 * Used on Today, on the Insights page and on a case. While the analysis is
 * prepared it shows the three steps it actually takes (route the question,
 * read and compute from the records, check the answer against its schema),
 * then opens the insight canvas. A question it cannot analyse is answered
 * with the questions it can, never with a guess.
 */

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { IconArrowRight, IconCheck, IconLoader2, IconSparkles } from "@tabler/icons-react";
import { actionPrepareInsight } from "../../../app/workday/[role]/insights/actions";

type Language = "en" | "de";

const COPY = {
  placeholder: { en: "Ask about risks, suppliers, controls, issues or a case", de: "Fragen Sie zu Risiken, Dienstleistern, Kontrollen, Feststellungen oder einem Fall" },
  label: { en: "Ask NFR Workspace", de: "NFR Workspace fragen" },
  submit: { en: "Ask", de: "Fragen" },
  steps: [
    { en: "Understanding the question", de: "Frage wird eingeordnet" },
    { en: "Reading the records and computing the figures", de: "Datensaetze werden gelesen, Zahlen berechnet" },
    { en: "Checking the answer and its evidence", de: "Antwort und Nachweise werden geprueft" },
  ],
  failed: { en: "Try one of these:", de: "Versuchen Sie eine dieser Fragen:" },
} as const;

function pick(pair: { en: string; de: string }, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

export interface AskSuggestion {
  label: string;
  question: string;
}

export function AskPanel({
  roleId,
  language,
  suggestions,
  context = null,
  autoQuestion = null,
  compact = false,
  testId = "ask-panel",
}: {
  roleId: string;
  language: Language;
  suggestions: AskSuggestion[];
  context?: { kind: string; id: string } | null;
  autoQuestion?: string | null;
  compact?: boolean;
  testId?: string;
}) {
  const router = useRouter();
  const [question, setQuestion] = useState(autoQuestion ?? "");
  const [step, setStep] = useState<number | null>(null);
  const [problem, setProblem] = useState<{ message: string; suggestions: string[] } | null>(null);
  const started = useRef(false);

  const run = useCallback(
    async (text: string) => {
      const value = text.trim();
      if (!value || step !== null) return;
      setProblem(null);
      setStep(0);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const pace = reduced ? 0 : 260;
      const timers = [window.setTimeout(() => setStep(1), pace), window.setTimeout(() => setStep(2), pace * 2.4)];
      const begun = Date.now();
      const outcome = await actionPrepareInsight({ roleId, question: value, context });
      const wait = Math.max(0, pace * 3 - (Date.now() - begun));
      await new Promise((resolve) => window.setTimeout(resolve, wait));
      timers.forEach((timer) => window.clearTimeout(timer));
      if (outcome.ok) {
        setStep(3);
        router.push(`/workday/${roleId}/insights/${outcome.id}`);
        return;
      }
      setStep(null);
      setProblem({ message: pick(outcome.message, language), suggestions: outcome.suggestions.map((entry) => pick(entry, language)) });
    },
    [roleId, context, router, language, step],
  );

  useEffect(() => {
    if (autoQuestion && !started.current) {
      started.current = true;
      void run(autoQuestion);
    }
  }, [autoQuestion, run]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run(question);
  };

  return (
    <div data-testid={testId}>
      <form className="ins-ask" onSubmit={onSubmit} role="search" aria-label={pick(COPY.label, language)}>
        <IconSparkles size={18} stroke={1.8} className="ins-ask-icon" aria-hidden="true" />
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={pick(COPY.placeholder, language)}
          aria-label={pick(COPY.label, language)}
          disabled={step !== null}
          data-testid={`${testId}-input`}
        />
        <button type="submit" className="wd-btn wd-btn-primary" disabled={step !== null || question.trim().length === 0}>
          {step !== null ? <IconLoader2 size={16} stroke={2} className="ws-spin" aria-hidden="true" /> : <IconArrowRight size={16} stroke={2} aria-hidden="true" />}
          {pick(COPY.submit, language)}
        </button>
      </form>

      {step !== null ? (
        <div className="ins-preparing" aria-live="polite" data-testid="ask-preparing" style={compact ? { padding: "12px 0" } : undefined}>
          {COPY.steps.map((entry, index) => (
            <div key={entry.en} className="ins-preparing-step" data-done={step > index ? "true" : undefined}>
              {step > index ? (
                <IconCheck size={16} stroke={2.2} style={{ color: "var(--wd-success)" }} aria-hidden="true" />
              ) : step === index ? (
                <IconLoader2 size={16} stroke={2} className="ws-spin" style={{ color: "var(--wd-accent)" }} aria-hidden="true" />
              ) : (
                <span style={{ width: 16 }} aria-hidden="true" />
              )}
              {pick(entry, language)}
            </div>
          ))}
        </div>
      ) : problem ? (
        <div className="ins-explain" role="status" style={{ marginTop: 12 }}>
          <p style={{ margin: "0 0 8px" }}>{problem.message}</p>
          <div className="ins-followups">
            {problem.suggestions.slice(0, 6).map((entry) => (
              <button key={entry} type="button" className="ins-chip-btn" onClick={() => { setQuestion(entry); void run(entry); }}>
                {entry}
              </button>
            ))}
          </div>
        </div>
      ) : suggestions.length ? (
        <div className="ins-ask-suggestions" aria-label={language === "de" ? "Vorgeschlagene Fragen" : "Suggested questions"}>
          {suggestions.map((entry) => (
            <button key={entry.question} type="button" className="ins-chip-btn" onClick={() => { setQuestion(entry.question); void run(entry.question); }} title={entry.question} data-testid="ask-suggestion">
              {entry.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

"use client";

/**
 * The assistant chat panel.
 *
 * Small on purpose. It sends one turn, renders what comes back, and keeps the
 * three categories of response visually separate: an answer, a refusal, and an
 * action that was proposed and not executed. Collapsing those three into one
 * text blob would hide the only thing that makes the autonomy model legible.
 *
 * The route may be unavailable, may be rate limited, or may be running with no
 * model at all. None of those is an exception to be thrown at the user: each
 * one is rendered as a plain statement of what happened.
 */

import { useRef, useState } from "react";
import { Chip, ObjectId } from "@/components/evidence/primitives";

export interface AgentTurn {
  id: number;
  question: string;
  /** Null while the request is in flight. */
  answer: string | null;
  refusals: string[];
  proposals: string[];
  guardrailNote: string | null;
  source: string | null;
  model: string | null;
  mode: string | null;
  durationMs: number | null;
  specialistsUsed: string[];
  /** Set when the request did not produce a usable answer. */
  failure: string | null;
}

const SUGGESTIONS: Record<string, string[]> = {
  tprm: [
    "Which of the four unresolved resilience questions can be closed with a document we already hold?",
    "What does the contract appendix say about subprocessor notice, and what does the supplier submission show?",
  ],
  rcsa: [
    "What changed between the current and the previous assessment, and why?",
    "Where do the first line and second line disagree about control effectiveness?",
  ],
  "control-assurance": [
    "Why was this case selected into the sample?",
    "What is the deviation rate if the unable to conclude items are treated as deviations?",
  ],
  "incident-resilience": [
    "Which statements in the chronology contradict each other?",
    "How much impact tolerance is left on the Swiss submission measure?",
  ],
  "regulatory-change": [
    "Which extracted obligations have no owner?",
    "Which entities are candidates for this obligation, and who decides applicability?",
  ],
  "nfr-governance": [
    "How many separate reports would cover this matter today?",
    "What does each function think the question is?",
  ],
};

export function AssistantChatPanel({
  roleId,
  mode,
  freeQuestionsMayNotReachAModel,
}: {
  roleId: string;
  mode: string;
  freeQuestionsMayNotReachAModel: boolean;
}) {
  const [turns, setTurns] = useState<AgentTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);

  const send = async (question: string) => {
    const trimmed = question.trim();
    if (trimmed.length === 0 || busy) return;

    const id = nextId.current;
    nextId.current += 1;

    setTurns((current) => [
      ...current,
      {
        id,
        question: trimmed,
        answer: null,
        refusals: [],
        proposals: [],
        guardrailNote: null,
        source: null,
        model: null,
        mode: null,
        durationMs: null,
        specialistsUsed: [],
        failure: null,
      },
    ]);
    setInput("");
    setBusy(true);

    const patch = (update: Partial<AgentTurn>) => {
      setTurns((current) =>
        current.map((turn) => (turn.id === id ? { ...turn, ...update } : turn)),
      );
    };

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roleId, input: trimmed }),
      });

      /*
       * A non-OK response is a normal outcome here, not a crash. The body may
       * be JSON with an error, or it may be an HTML error page from a route
       * that does not exist yet. Both are handled without throwing.
       */
      if (!response.ok) {
        let detail = `The assistant route answered with status ${response.status}.`;
        try {
          const body: unknown = await response.json();
          if (body !== null && typeof body === "object" && "error" in body) {
            const message = (body as { error?: unknown }).error;
            if (typeof message === "string" && message.length > 0) detail = message;
          }
        } catch {
          if (response.status === 404) {
            detail =
              "The assistant route is not available in this build. Every other surface in the product continues to work without it.";
          }
        }
        patch({ failure: detail });
        return;
      }

      const body: unknown = await response.json();
      if (body === null || typeof body !== "object") {
        patch({ failure: "The assistant route returned a body this panel could not read." });
        return;
      }

      const record = body as Record<string, unknown>;
      patch({
        answer: typeof record.output === "string" ? record.output : "",
        refusals: stringArray(record.refusals),
        proposals: stringArray(record.proposals),
        guardrailNote: typeof record.guardrailNote === "string" ? record.guardrailNote : null,
        source: typeof record.source === "string" ? record.source : null,
        model: typeof record.model === "string" ? record.model : null,
        mode: typeof record.mode === "string" ? record.mode : null,
        durationMs: typeof record.durationMs === "number" ? record.durationMs : null,
        specialistsUsed: stringArray(record.specialistsUsed),
      });
    } catch {
      patch({
        failure:
          "The request to the assistant did not complete. This is reported rather than retried silently, because a silent retry would make the same question look like two.",
      });
    } finally {
      setBusy(false);
    }
  };

  const suggestions = SUGGESTIONS[roleId] ?? [];

  return (
    <div className="stack stack-4">
      {/* ---------------- The transcript ---------------- */}
      {turns.length === 0 ? (
        <div className="empty-state">
          <span className="label">Nothing asked yet</span>
          <p>
            Ask a question about the work on screen. The assistant answers from the evidence corpus
            and the scenario database, and it will say so when it cannot.
          </p>
        </div>
      ) : (
        <ol className="stack stack-4" style={{ listStyle: "none" }}>
          {turns.map((turn) => (
            <li key={turn.id} className="stack stack-3">
              {/* ---- The question ---- */}
              <div className="card" data-tone="cyan">
                <div className="stack stack-1">
                  <span className="label">You asked</span>
                  <p style={{ fontSize: "var(--text-sm)" }}>{turn.question}</p>
                </div>
              </div>

              {/* ---- In flight ---- */}
              {turn.answer === null && turn.failure === null ? (
                <div className="card card-edge" data-tone="neutral">
                  <div className="stack stack-1">
                    <span className="label">Working</span>
                    <p className="dim" style={{ fontSize: "var(--text-sm)" }}>
                      The turn is running. In presenter safe mode this resolves from a cached beat
                      or a seeded response rather than a model call.
                    </p>
                  </div>
                </div>
              ) : null}

              {/* ---- A failure, stated plainly ---- */}
              {turn.failure !== null ? (
                <div className="card card-edge" data-tone="amber">
                  <div className="stack stack-2">
                    <div className="row row-2 row-between row-wrap">
                      <span className="label" style={{ color: "var(--amber)" }}>
                        The assistant did not answer
                      </span>
                      <Chip tone="amber">no answer</Chip>
                    </div>
                    <p style={{ fontSize: "var(--text-sm)" }}>{turn.failure}</p>
                    <p className="meta">
                      Nothing was changed and nothing was recorded as an answer. The workbench, the
                      decision list and the evidence corpus are unaffected.
                    </p>
                  </div>
                </div>
              ) : null}

              {/* ---- The answer ---- */}
              {turn.answer !== null && turn.answer.length > 0 ? (
                <div className="card card-edge" data-tone="accent">
                  <div className="stack stack-2">
                    <div className="row row-2 row-between row-wrap">
                      <span className="label">Answer</span>
                      <div className="row row-2 row-wrap">
                        {turn.mode ? <Chip tone="neutral">{turn.mode} mode</Chip> : null}
                        {turn.source ? <Chip tone="cyan">{turn.source}</Chip> : null}
                        {turn.durationMs !== null ? (
                          <span className="mono meta">{turn.durationMs} ms</span>
                        ) : null}
                      </div>
                    </div>
                    <p style={{ fontSize: "var(--text-sm)", whiteSpace: "pre-wrap" }}>
                      {turn.answer}
                    </p>
                    <div className="row row-3 row-wrap">
                      {turn.model ? <ObjectId id={turn.model} label="model" /> : null}
                      {turn.specialistsUsed.length > 0 ? (
                        <span className="meta">
                          specialists: {turn.specialistsUsed.join(", ")}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {turn.answer !== null && turn.answer.length === 0 && turn.failure === null ? (
                <div className="card card-edge" data-tone="neutral">
                  <p style={{ fontSize: "var(--text-sm)" }}>
                    The turn completed with no text. That is reported as it is rather than filled in.
                  </p>
                </div>
              ) : null}

              {/* ---- Refusals, kept separate from answers ---- */}
              {turn.refusals.length > 0 ? (
                <div className="card card-edge" data-tone="red">
                  <div className="stack stack-2">
                    <div className="row row-2 row-between row-wrap">
                      <span className="label" style={{ color: "var(--red)" }}>
                        Refused ({turn.refusals.length})
                      </span>
                      <Chip tone="red">not an answer</Chip>
                    </div>
                    <ul className="stack stack-2">
                      {turn.refusals.map((refusal, index) => (
                        <li key={index} style={{ fontSize: "var(--text-sm)" }}>
                          {refusal}
                        </li>
                      ))}
                    </ul>
                    <p className="meta">
                      A refusal is a decision by the authority gate, not a failure of the model. The
                      gate never reads free text, so nothing written in a document or a message can
                      argue its way past it.
                    </p>
                  </div>
                </div>
              ) : null}

              {/* ---- Proposed and not executed ---- */}
              {turn.proposals.length > 0 ? (
                <div className="card card-edge" data-tone="amber">
                  <div className="stack stack-2">
                    <div className="row row-2 row-between row-wrap">
                      <span className="label" style={{ color: "var(--amber)" }}>
                        Proposed, not executed ({turn.proposals.length})
                      </span>
                      <Chip tone="amber">awaiting a person</Chip>
                    </div>
                    <ul className="stack stack-2">
                      {turn.proposals.map((proposal, index) => (
                        <li key={index} style={{ fontSize: "var(--text-sm)" }}>
                          {proposal}
                        </li>
                      ))}
                    </ul>
                    <p className="meta">
                      These changed nothing. Each one is returned as a proposal because it either
                      needs an approval or is out of reach at the autonomy level in force.
                    </p>
                  </div>
                </div>
              ) : null}

              {turn.guardrailNote ? (
                <p className="meta" style={{ color: "var(--amber)" }}>
                  Guardrail note: {turn.guardrailNote}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      {/* ---------------- Composer ---------------- */}
      <form
        className="stack stack-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
      >
        <div className="field">
          <label className="field-label" htmlFor="assistant-input">
            Ask about the work on screen
          </label>
          <textarea
            id="assistant-input"
            className="textarea"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="For example: which obligations on this publication have no owner, and what is the confidence on each extraction?"
            maxLength={4000}
            disabled={busy}
          />
        </div>

        <div className="row row-3 row-wrap row-between">
          <div className="row row-2 row-wrap">
            <button type="submit" className="btn btn-primary" disabled={busy || input.trim().length === 0}>
              {busy ? "Working" : "Ask"}
            </button>
            {turns.length > 0 ? (
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                onClick={() => setTurns([])}
                disabled={busy}
              >
                Clear this panel
              </button>
            ) : null}
          </div>
          <span className="meta">{input.trim().length} / 4000 characters</span>
        </div>

        {freeQuestionsMayNotReachAModel ? (
          <p className="meta" style={{ color: "var(--amber)" }}>
            In {mode} mode a free question may not reach a model. It is answered from a cached beat
            or a seeded response instead, and the panel says which of the two it was.
          </p>
        ) : null}
      </form>

      {/* ---------------- Suggestions ---------------- */}
      {suggestions.length > 0 ? (
        <div className="stack stack-2">
          <span className="label">Questions this role tends to ask</span>
          <div className="stack stack-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="card card-interactive"
                onClick={() => void send(suggestion)}
                disabled={busy}
              >
                <span style={{ fontSize: "var(--text-sm)" }}>{suggestion}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Reads an unknown value as a string array, discarding anything else. */
function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

export default AssistantChatPanel;

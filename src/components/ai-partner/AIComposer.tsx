"use client";

/**
 * The composer.
 *
 * Stays at the foot of the dock whenever the Chat tab is active, so asking a
 * question never costs a navigation. The placeholder is fixed copy, "Ask
 * about the current work", because the one thing the field has to communicate
 * is that it answers about what is on screen rather than acting as a general
 * search box.
 *
 * Controlled from the dock rather than holding its own draft. That is what
 * lets a half typed question survive a tab change, a collapse to the presence
 * rail and a move between work objects, which is an acceptance criterion
 * rather than a nicety.
 */

import { useEffect, useRef, type KeyboardEvent } from "react";
import { IconArrowUp } from "@tabler/icons-react";
import type { Language } from "@/i18n/labels";
import { pick } from "@/workday/contracts";
import {
  MAX_PROMPT_CHIPS,
  PROMPT_LABELS,
  partnerLabel,
  type PromptId,
} from "./labels";

export interface AIComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  language: Language;
  /** True while a turn is in flight. The field stays readable, not disabled. */
  busy?: boolean;
  /** Blocks sending entirely, for example in offline mode. */
  disabled?: boolean;
  /** Contextual prompts. Capped again here, see the comment below. */
  promptIds?: PromptId[];
  onPromptSelect?: (text: string, id: PromptId) => void;
}

export function AIComposer({
  value,
  onChange,
  onSubmit,
  language,
  busy = false,
  disabled = false,
  promptIds = [],
  onPromptSelect,
}: AIComposerProps) {
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  /*
   * Grow with the content up to the CSS max height.
   *
   * Done here rather than with a fixed row count because a two line question
   * being clipped to one line is how a user loses track of what they typed.
   */
  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  }, [value]);

  const canSend = !disabled && !busy && value.trim().length > 0;

  const submit = () => {
    if (!canSend) return;
    onSubmit(value.trim());
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift and Enter writes a second line.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  /*
   * The cap is enforced twice on purpose.
   *
   * `selectPromptIds` applies it, and so does this renderer, because the cap
   * is a product rule about what the surface may show rather than a detail of
   * one selection function. A future caller passing six prompts gets three.
   */
  const prompts = promptIds.slice(0, MAX_PROMPT_CHIPS);

  return (
    <div className="app-composer">
      {prompts.length > 0 ? (
        <div className="app-prompt-chips" aria-label={partnerLabel("chatSuggestedPrompts", language)}>
          {prompts.map((id) => {
            const text = pick(PROMPT_LABELS[id], language);
            return (
              <button
                key={id}
                type="button"
                className="app-prompt-chip"
                disabled={disabled || busy}
                onClick={() => {
                  if (onPromptSelect) onPromptSelect(text, id);
                  else onSubmit(text);
                }}
              >
                {text}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="app-composer-field">
        <textarea
          ref={fieldRef}
          className="app-composer-input"
          rows={1}
          value={value}
          placeholder={partnerLabel("chatPlaceholder", language)}
          aria-label={partnerLabel("chatPlaceholder", language)}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="app-icon-btn app-shrink-0"
          onClick={submit}
          disabled={!canSend}
          aria-label={partnerLabel("chatSend", language)}
          title={partnerLabel("chatSend", language)}
        >
          <IconArrowUp size={15} stroke={2.2} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

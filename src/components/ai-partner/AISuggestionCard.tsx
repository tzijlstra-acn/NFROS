"use client";

/**
 * One prepared suggestion.
 *
 * The card answers six questions in a fixed order: what changed, why it
 * matters, what I checked, what I already did, what I recommend, what I need
 * from you. The order is not a layout preference. It is the order a competent
 * colleague would use when handing work over, and it puts the two honest
 * sections before the opinion.
 *
 * `checksCompleted` and `actionsCompleted` are rendered as two separate
 * lists, with different glyphs, under different headings. Merging them would
 * be the central dishonesty this product exists to avoid: "I checked the
 * contract" and "I updated the assessment" are not the same claim, and a
 * single list of ticks invites the reader to assume the stronger one.
 *
 * A constrained suggestion is held to a lower claim. The missing required
 * source is named, the confidence band is clamped so it can never read as
 * high, the recommendation is marked provisional and the Approve action is
 * withdrawn, because approving a recommendation built on a gap in one click
 * is exactly the failure the constraint flag exists to prevent.
 */

import { useEffect, useState } from "react";
import {
  IconChecks,
  IconDots,
  IconSearch,
} from "@tabler/icons-react";
import type { Language } from "@/i18n/labels";
import {
  SUGGESTION_STATUS_LABELS,
  momentAge,
  pick,
  type AISuggestionView,
} from "@/workday/contracts";
import {
  AuthorityChip,
  Chip,
  Data,
  Notice,
  RegulatoryNote,
  SourceRow,
} from "@/components/workday-v2/primitives";
import { Menu, type MenuItemDefinition } from "@/components/workday-v2/interactive";
import {
  CONFIDENCE_LABEL_KEYS,
  CONFIDENCE_TONE,
  DISPOSITION_LABELS,
  SUGGESTION_ACTION_LABEL_KEYS,
  confidenceBand,
  partnerLabel,
  selectSuggestionActions,
  type SuggestionActionId,
} from "./labels";
import { isOpenDisposition } from "@/features/partner/rules";
import { AIFeedbackControl, type FeedbackHandler } from "./AIFeedbackControl";

/* ==========================================================================
   Progressive reveal
   ========================================================================== */

/**
 * The six sections, revealed in order when a suggestion arrives live.
 *
 * The reveal exists so the content appears to populate rather than to pop
 * into place fully formed, which is what the brief asks for. It is skipped
 * entirely under reduced motion and whenever the card is rendered from
 * already loaded props, because a cached suggestion animating itself in is
 * theatre.
 */
const SECTION_COUNT = 6;
const REVEAL_INTERVAL_MS = 110;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ==========================================================================
   Regulatory references
   ========================================================================== */

/*
 * Why a word list rather than a flag from the server.
 *
 * The disclosure has to travel with the text wherever the text came from, and
 * suggestion copy is generated. Matching the named frameworks here means a
 * generated sentence mentioning DORA cannot reach the screen without the
 * disclosure attached. Jurisdiction itself is not decided here: the generator
 * is responsible for never attaching DORA to the Swiss entity, and this list
 * only decides whether the standard note is shown.
 */
const REGULATORY_TERMS = [
  "DORA",
  "EBA",
  "FINMA",
  "MaRisk",
  "BAIT",
  "GDPR",
  "FINMA Circular",
  "Basel",
];

function mentionsRegulation(text: string): boolean {
  return REGULATORY_TERMS.some((term) => text.includes(term));
}

/* ==========================================================================
   The card
   ========================================================================== */

export interface AISuggestionCardProps {
  suggestion: AISuggestionView;
  language: Language;
  /** Live scenario time, used to age the card. Omitted means no age shown. */
  currentMoment?: string;
  /** True only for a suggestion that just arrived, which enables the reveal. */
  progressive?: boolean;
  /**
   * Every action is a callback. The card executes nothing: Approve routes to
   * the decision surface, which is where the authority gate lives.
   */
  onAction?: (action: SuggestionActionId, suggestion: AISuggestionView) => void;
  onOpenEvidence?: (evidenceId: string) => void;
  /**
   * Records a modification or a rejection, each with the person's reason
   * (plan 4.11). Returns false when the answer was not recorded.
   */
  onAnswer?: AnswerHandler;
  /** The suggestion's disposition history, oldest first. */
  history?: readonly DispositionStep[];
  /** The routine that prepared it, when one did. */
  preparedBy?: string | null;
  feedbackKinds?: readonly string[];
  onFeedback?: FeedbackHandler;
}

export type AnswerHandler = (
  answer: "modify" | "reject",
  suggestion: AISuggestionView,
  extra: { recommendation?: string; reason: string },
) => Promise<boolean>;

/** Plain data, mirrored from `src/features/partner/view.ts` so this client file imports no server module. */
export interface DispositionStep {
  to: keyof typeof DISPOSITION_LABELS;
  atMoment: string;
  actor: "person" | "system";
  reason: string;
}

export function AISuggestionCard({
  suggestion,
  language,
  currentMoment,
  progressive = false,
  onAction,
  onOpenEvidence,
  onAnswer,
  history = [],
  preparedBy = null,
  feedbackKinds = [],
  onFeedback,
}: AISuggestionCardProps) {
  const [visibleSections, setVisibleSections] = useState(progressive ? 1 : SECTION_COUNT);
  const [form, setForm] = useState<"modify" | "reject" | null>(null);
  const [recommendation, setRecommendation] = useState(suggestion.recommendedAction ?? "");
  const [reason, setReason] = useState("");
  const [answerError, setAnswerError] = useState(false);
  const disposition = suggestion.disposition ?? "new";
  const open = isOpenDisposition(disposition);
  const lastStep = history.length > 0 ? history[history.length - 1] : undefined;

  useEffect(() => {
    if (!progressive || prefersReducedMotion()) {
      setVisibleSections(SECTION_COUNT);
      return;
    }
    setVisibleSections(1);
    let current = 1;
    const timer = window.setInterval(() => {
      current += 1;
      setVisibleSections(current);
      if (current >= SECTION_COUNT) window.clearInterval(timer);
    }, REVEAL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [progressive, suggestion.id]);

  const shown = (section: number) => section <= visibleSections;

  const { band, value } = confidenceBand(suggestion.confidence, suggestion.constrained);
  const fullPlan = selectSuggestionActions({
    status: suggestion.status,
    authorityClass: suggestion.authorityClass,
    constrained: suggestion.constrained,
    decisionRequired: suggestion.decisionRequired,
    hasRecommendation: Boolean(suggestion.recommendedAction),
  });
  /*
   * An answered suggestion keeps only the read paths. Answering twice is how
   * one recommendation would end up accepted and rejected at once.
   */
  const plan = open
    ? fullPlan
    : { primary: "open-object" as SuggestionActionId, overflow: (["ask-why"] as SuggestionActionId[]) };

  // Held in a local const so the narrowing survives into the click handler.
  const primary = plan.primary;

  const actionLabel = (id: SuggestionActionId) =>
    partnerLabel(SUGGESTION_ACTION_LABEL_KEYS[id], language);

  /* Modify and Reject need the person's words, so they open a form in the card. */
  const choose = (id: SuggestionActionId) => {
    if (id === "modify" && onAnswer) {
      setForm("modify");
      return;
    }
    if (id === "dismiss" && onAnswer) {
      setForm("reject");
      return;
    }
    onAction?.(id, suggestion);
  };

  const submitAnswer = async () => {
    if (!onAnswer || !form || reason.trim().length === 0) return;
    if (form === "modify" && recommendation.trim().length === 0) return;
    const ok = await onAnswer(form === "modify" ? "modify" : "reject", suggestion, {
      reason: reason.trim(),
      ...(form === "modify" ? { recommendation: recommendation.trim() } : {}),
    });
    setAnswerError(!ok);
    if (ok) setForm(null);
  };

  const menuItems: MenuItemDefinition[] = plan.overflow.map((id) => ({
    id,
    label: actionLabel(id),
    danger: id === "dismiss",
    ...(onAction || onAnswer ? { onSelect: () => choose(id) } : {}),
  }));

  const regulatoryText = `${suggestion.headline} ${suggestion.changeSummary} ${suggestion.whyItMatters} ${suggestion.recommendedAction ?? ""}`;

  return (
    <article
      className="app-suggestion"
      data-priority={suggestion.priority}
      data-constrained={suggestion.constrained || undefined}
      data-disposition={disposition}
      data-suggestion-id={suggestion.id}
      aria-label={suggestion.headline}
    >
      {/* ---- head: state, answer, authority, provenance, age ---- */}
      <div className="app-row app-row-wrap">
        <Chip tone={suggestion.status === "needs-user" ? "warning" : "ai"}>
          {pick(SUGGESTION_STATUS_LABELS[suggestion.status], language)}
        </Chip>
        <Chip tone={DISPOSITION_LABELS[disposition].tone} title={partnerLabel("dispositionLabel", language)}>
          {pick(DISPOSITION_LABELS[disposition], language)}
        </Chip>
        <AuthorityChip authorityClass={suggestion.authorityClass} language={language} />
        <span className="app-grow" />
        <span className="app-faint" style={{ fontSize: "var(--app-text-2xs)" }}>
          {partnerLabel(
            suggestion.source === "live"
              ? "sourceLive"
              : suggestion.source === "cache"
                ? "sourceCache"
                : "sourceSeeded",
            language,
          )}
        </span>
        {currentMoment ? (
          <Data title={suggestion.atMoment}>
            {momentAge(suggestion.atMoment, currentMoment, language)}
          </Data>
        ) : null}
      </div>

      <h3 className="app-suggestion-headline">{suggestion.headline}</h3>
      {preparedBy ? (
        <span className="app-meta">
          {partnerLabel("preparedByRoutine", language)}: {preparedBy}
        </span>
      ) : null}

      {/* ---- 1. what changed ---- */}
      {shown(1) ? (
        <div className="app-stack-1">
          <span className="app-part-label">{partnerLabel("whatChanged", language)}</span>
          <p className="app-suggestion-body">{suggestion.changeSummary}</p>
        </div>
      ) : null}

      {/* ---- 2. why it matters ---- */}
      {shown(2) ? (
        <div className="app-stack-1">
          <span className="app-part-label">{partnerLabel("whyItMatters", language)}</span>
          <p className="app-suggestion-body">{suggestion.whyItMatters}</p>
        </div>
      ) : null}

      {/* ---- 3. what I checked. Looked at, not changed. ---- */}
      {shown(3) ? (
        <div className="app-stack-1">
          <span className="app-part-label">{partnerLabel("whatIChecked", language)}</span>
          {suggestion.checksCompleted.length === 0 ? (
            <span className="app-meta">{partnerLabel("nothingChecked", language)}</span>
          ) : (
            <ul className="app-did-list">
              {suggestion.checksCompleted.map((check) => (
                <li className="app-did-item" key={check}>
                  <IconSearch size={12} stroke={2} aria-hidden="true" />
                  <span>{check}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {/* ---- 4. what I already did. Changed, within authority. ---- */}
      {shown(4) ? (
        <div className="app-stack-1">
          <span className="app-part-label">{partnerLabel("whatIDid", language)}</span>
          {suggestion.actionsCompleted.length === 0 ? (
            <span className="app-meta">{partnerLabel("nothingDone", language)}</span>
          ) : (
            <ul className="app-did-list">
              {suggestion.actionsCompleted.map((action) => (
                <li className="app-did-item" key={action}>
                  <IconChecks size={12} stroke={2} aria-hidden="true" />
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {/* ---- the constraint, before the recommendation it limits ---- */}
      {suggestion.constrained && shown(5) ? (
        <Notice tone="warning">
          <span className="app-stack-1">
            <span className="app-strong">{partnerLabel("constrainedTitle", language)}</span>
            {suggestion.missingRequiredSources.length > 0 ? (
              <span>
                {partnerLabel("constrainedSourcePrefix", language)}
                {": "}
                {suggestion.missingRequiredSources.join(", ")}
              </span>
            ) : null}
            <span>{partnerLabel("constrainedNote", language)}</span>
          </span>
        </Notice>
      ) : null}

      {/* ---- 5. what I recommend ---- */}
      {shown(5) && suggestion.recommendedAction ? (
        <div className="app-stack-1">
          <span className="app-part-label app-row" style={{ gap: "var(--app-2)" }}>
            <span>{partnerLabel("whatIRecommend", language)}</span>
            {suggestion.constrained ? (
              <Chip tone="warning">{partnerLabel("constrainedRecommendation", language)}</Chip>
            ) : null}
          </span>
          <p className="app-suggestion-body">{suggestion.recommendedAction}</p>
          {suggestion.alternatives.length > 0 ? (
            <>
              <span className="app-part-label">{partnerLabel("alternativesLabel", language)}</span>
              <ul className="app-did-list">
                {suggestion.alternatives.map((alternative) => (
                  <li className="app-did-item" key={alternative}>
                    <span>{alternative}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      {/* ---- 6. what I need from you ---- */}
      {shown(6) ? (
        <div className="app-stack-1">
          <span className="app-part-label">{partnerLabel("whatINeed", language)}</span>
          <p className="app-suggestion-body">
            {suggestion.decisionRequired
              ? partnerLabel("decisionNeeded", language)
              : partnerLabel("nothingNeeded", language)}
          </p>
        </div>
      ) : null}

      {/* ---- confidence and uncertainty ---- */}
      {shown(6) ? (
        <div className="app-stack-1">
          <div className="app-row app-row-wrap">
            <Chip tone={CONFIDENCE_TONE[band]} title={partnerLabel("confidenceLabel", language)}>
              {partnerLabel(CONFIDENCE_LABEL_KEYS[band], language)}
            </Chip>
            <Data title={partnerLabel("confidenceLabel", language)}>{value}</Data>
          </div>
          {suggestion.uncertainty.length > 0 ? (
            <>
              <span className="app-part-label">{partnerLabel("uncertaintyLabel", language)}</span>
              <ul className="app-did-list">
                {suggestion.uncertainty.map((item) => (
                  <li className="app-did-item" key={item}>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      {/* ---- evidence and sources ---- */}
      {shown(6) && suggestion.evidenceIds.length > 0 ? (
        <div className="app-row-wrap" style={{ gap: "var(--app-1)" }}>
          <span className="app-part-label">{partnerLabel("detailEvidence", language)}</span>
          {suggestion.evidenceIds.map((id) =>
            onOpenEvidence ? (
              <button
                key={id}
                type="button"
                className="app-prompt-chip"
                onClick={() => onOpenEvidence(id)}
              >
                <Data>{id}</Data>
              </button>
            ) : (
              <Data key={id}>{id}</Data>
            ),
          )}
        </div>
      ) : null}

      {shown(6) ? (
        <SourceRow sources={suggestion.sources} language={language} showNecessity />
      ) : null}

      {mentionsRegulation(regulatoryText) ? <RegulatoryNote language={language} /> : null}

      {/* ---- one primary action, everything else in the overflow ---- */}
      {primary || menuItems.length > 0 ? (
        <div className="app-row app-between">
          {primary ? (
            <button
              type="button"
              className={
                primary === "approve"
                  ? "app-btn app-btn-primary app-btn-sm"
                  : "app-btn app-btn-secondary app-btn-sm"
              }
              onClick={() => choose(primary)}
              disabled={!onAction}
            >
              {actionLabel(primary)}
            </button>
          ) : (
            <span />
          )}
          {menuItems.length > 0 ? (
            <Menu
              label={partnerLabel("moreActions", language)}
              groups={[{ items: menuItems }]}
              width={200}
              trigger={(props) => (
                <button
                  type="button"
                  className="app-icon-btn"
                  ref={props.ref}
                  onClick={props.onClick}
                  aria-expanded={props["aria-expanded"]}
                  aria-haspopup={props["aria-haspopup"]}
                  aria-label={partnerLabel("moreActions", language)}
                >
                  <IconDots size={15} stroke={2} aria-hidden="true" />
                </button>
              )}
            />
          ) : null}
        </div>
      ) : null}

      {primary === "approve" ? (
        <span className="app-meta">{partnerLabel("approvalRoutingNote", language)}</span>
      ) : primary === "accept" ? (
        <span className="app-meta">{partnerLabel("acceptRoutingNote", language)}</span>
      ) : null}

      {/* ---- the person's words, for a modification or a rejection ---- */}
      {form ? (
        <form
          className="app-stack-1"
          data-answer-form={form}
          onSubmit={(event) => {
            event.preventDefault();
            void submitAnswer();
          }}
        >
          {form === "modify" ? (
            <label className="app-stack-1">
              <span className="app-part-label">{partnerLabel("answerYourVersion", language)}</span>
              <textarea
                className="app-input"
                rows={3}
                value={recommendation}
                maxLength={1600}
                onChange={(event) => setRecommendation(event.target.value)}
              />
            </label>
          ) : null}
          <label className="app-stack-1">
            <span className="app-part-label">{partnerLabel("answerReason", language)}</span>
            <input
              className="app-input"
              value={reason}
              maxLength={600}
              placeholder={partnerLabel("answerReasonHint", language)}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <span className="app-row" style={{ gap: "var(--app-2)" }}>
            <button type="submit" className="app-btn app-btn-primary app-btn-sm" disabled={reason.trim().length === 0}>
              {partnerLabel(form === "modify" ? "answerSaveModified" : "answerConfirmReject", language)}
            </button>
            <button type="button" className="app-btn app-btn-quiet app-btn-sm" onClick={() => setForm(null)}>
              {partnerLabel("answerCancel", language)}
            </button>
          </span>
          {answerError ? <span className="app-meta app-tone-warning">{partnerLabel("answerFailed", language)}</span> : null}
        </form>
      ) : null}

      {/* ---- what was answered, and by whom ---- */}
      {lastStep && disposition !== "new" ? (
        <span className="app-meta" data-disposition-history={history.length}>
          {pick(DISPOSITION_LABELS[lastStep.to], language)} {lastStep.atMoment}
          {", "}
          {lastStep.actor === "person" ? partnerLabel("answeredByYou", language) : partnerLabel("answeredBySystem", language)}
          {lastStep.reason ? `. ${lastStep.reason}` : ""}
        </span>
      ) : null}

      <AIFeedbackControl
        target={{ kind: "suggestion", id: suggestion.id }}
        given={feedbackKinds}
        language={language}
        {...(onFeedback ? { onFeedback } : {})}
      />
    </article>
  );
}

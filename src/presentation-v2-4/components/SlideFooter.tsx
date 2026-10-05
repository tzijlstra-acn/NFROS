"use client";

import type { ReactNode } from "react";
import { SYNTHETIC_LABEL } from "./deckModel";

type SlideFooterProps = {
  /** Link row: appendix chips on core slides, return and index links in the appendix */
  links?: ReactNode;
  sourceNote?: string;
  insight?: string;
  counter?: string;
  counterLabel?: string;
};

/**
 * The band below the exhibit stage (slide y 976 to 1080). Links and the source note sit on
 * the left, the optional takeaway at x 960 to 1640, the synthetic data label and the counter
 * on the right, so the three never share space.
 */
export function SlideFooter({ links, sourceNote, insight, counter, counterLabel }: SlideFooterProps) {
  const hasInsight = insight !== undefined && insight.trim().length > 0;
  return (
    <div className="pv24-slide-footer">
      <div className={hasInsight ? "pv24-footer-main pv24-footer-main--narrow" : "pv24-footer-main"}>
        {links ? <div className="pv24-ref-bar">{links}</div> : null}
        {sourceNote ? (
          <p className="pv24-source-note">
            {"Source: "}
            {sourceNote}
          </p>
        ) : null}
      </div>
      {hasInsight ? (
        <aside className="pv24-insight" aria-label="Key takeaway">
          <p className="pv24-insight__text">{insight}</p>
        </aside>
      ) : null}
      <div className="pv24-slide-meta">
        <span className="pv24-synthetic-label">{SYNTHETIC_LABEL}</span>
        {counter ? (
          <>
            <span className="pv24-slide-number" aria-hidden="true">
              {counter}
            </span>
            <span className="pv24-sr-only">{counterLabel}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}

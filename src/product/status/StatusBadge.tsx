/**
 * The status badge.
 *
 * One component for every product status, so the same word always looks the
 * same. It is the V3.3 `wd-chip` with a `wd-dot`, carrying the tone from the
 * vocabulary; there is no stylesheet of its own and no tone a caller can
 * override. A caller that wants a different colour for "Verified" is asking
 * for a second vocabulary.
 *
 * It needs a `.workday-v3` ancestor, because that scope declares the tokens
 * the chip reads. The workday frame, the role selector, the settings area and
 * the operations console all provide one.
 *
 * Server safe: no hooks, no handlers, no client directive.
 *
 * Accessibility: the label is visible text, so colour is never the only
 * signal. The one line meaning, or the caller's evidence sentence, is exposed
 * as the title and as screen reader text, so "Not verified" is never read out
 * without the reason.
 */

import type { Language } from "@/i18n/labels";
import { PRODUCT_STATUS, statusLabel, statusMeaning, type ProductStatus } from "./vocabulary";

export function StatusBadge({
  status,
  language,
  detail,
}: {
  status: ProductStatus;
  language: Language;
  /** The evidence for this reading. Defaults to the vocabulary meaning. */
  detail?: string;
}) {
  const definition = PRODUCT_STATUS[status];
  const tone = definition.tone;
  const explanation = detail ?? statusMeaning(status, language);

  return (
    <span
      className="wd-chip"
      data-status={status}
      {...(tone !== "neutral" ? { "data-tone": tone } : {})}
      title={explanation}
    >
      <span
        className="wd-dot"
        {...(tone !== "neutral" ? { "data-tone": tone } : {})}
        aria-hidden="true"
      />
      {statusLabel(status, language)}
      <span className="wd-sr-only">: {explanation}</span>
    </span>
  );
}

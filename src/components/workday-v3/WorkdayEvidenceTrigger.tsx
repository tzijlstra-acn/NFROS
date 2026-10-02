"use client";

/**
 * Opens the context drawer on Evidence.
 *
 * One click from the action to the sources behind it, which is the rule the
 * brief sets: evidence is not on the default screen and is never more than one
 * click away. It passes itself as the trigger so focus returns here when the
 * drawer closes.
 */

import { IconFileText } from "@tabler/icons-react";
import type { Language } from "@/i18n/labels";
import { useWorkdayChrome } from "./ChromeContext";

export function WorkdayEvidenceTrigger({
  language,
  count,
  objectLabel,
}: {
  language: Language;
  count: number;
  objectLabel?: string;
}) {
  const chrome = useWorkdayChrome();
  const label = language === "de" ? "Nachweise" : "Evidence";

  return (
    <button
      type="button"
      className="wd-btn wd-btn-secondary"
      onClick={(event) => chrome.openDrawer("evidence", event.currentTarget)}
      aria-label={
        objectLabel ? `${label}, ${count}, ${objectLabel}` : `${label}, ${count}`
      }
    >
      <IconFileText size={16} stroke={1.8} aria-hidden="true" />
      {label}
      {count > 0 ? <span className="wd-disclosure-count">{count}</span> : null}
    </button>
  );
}

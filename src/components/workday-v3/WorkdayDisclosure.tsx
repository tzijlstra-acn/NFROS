"use client";

/**
 * A quiet disclosure.
 *
 * This is how completed work and optional detail leave the active view. The
 * brief is specific: completed items must not stay mixed into active work, and
 * the user must be able to expand them for reassurance and traceability. So
 * the trigger states the count and nothing else, and the content is absent
 * from the document until it is wanted.
 */

import { useId, useState, type ReactNode } from "react";
import { IconChevronDown } from "@tabler/icons-react";
import type { Language } from "@/i18n/labels";

export function WorkdayDisclosure({
  label,
  count,
  children,
  language,
  defaultOpen = false,
}: {
  label: string;
  count?: number;
  children: ReactNode;
  language: Language;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    /*
     * The open state is on the element as well as in React state, because a
     * parent needs it in CSS. Two closed disclosures share a row and an open
     * one takes the row to itself, and `.wd-disclosure-row > [data-open]`
     * is how the parent expresses that without being told by a callback.
     */
    <div data-open={open ? "true" : "false"}>
      <button
        type="button"
        className="wd-disclosure"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <IconChevronDown
          size={16}
          stroke={2}
          aria-hidden="true"
          className="wd-disclosure-chevron"
        />
        <span>{label}</span>
        {count === undefined ? null : (
          <span className="wd-disclosure-count">{count}</span>
        )}
        <span className="wd-sr-only">
          {open
            ? language === "de"
              ? ", ausgeklappt"
              : ", expanded"
            : language === "de"
              ? ", eingeklappt"
              : ", collapsed"}
        </span>
      </button>
      {open ? (
        <div id={panelId} style={{ marginTop: "var(--wd-2)" }}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

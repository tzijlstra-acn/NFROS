"use client";

import { IconFileText } from "@tabler/icons-react";
import type { AppendixReference } from "../data/types";
import { appendixView } from "./deckModel";
import { DeckLink } from "./DeckNav";

interface SlideSourceProps {
  appendixRefs: AppendixReference[];
  /** Play position of the core slide the chips sit on; the appendix returns here */
  fromPosition: number;
}

/** Appendix reference chips for a core slide. Each opens the exact appendix slide. */
export default function SlideSource({ appendixRefs, fromPosition }: SlideSourceProps) {
  return (
    <>
      {appendixRefs.map((ref) => (
        <DeckLink
          key={ref.appendixId}
          view={appendixView(ref.appendixId, fromPosition)}
          className="pv24-ref-chip"
          title={ref.reason}
          ariaLabel={`Open appendix: ${ref.label}`}
        >
          <IconFileText size={16} stroke={1.8} aria-hidden="true" />
          {ref.label}
        </DeckLink>
      ))}
    </>
  );
}

"use client";

import { motion, useReducedMotion } from "motion/react";
import { IconArrowBackUp, IconLayoutGrid } from "@tabler/icons-react";
import type { AppendixSlide24 as AppendixSlideData } from "../data/types";
import SlideHeader from "./SlideHeader";
import { SlideStage } from "./SlideStage";
import { SlideFooter } from "./SlideFooter";
import { AppendixVisual24 } from "./AppendixVisual24";
import { StatusBadge } from "./StatusBadge24";
import { DeckLink, useDeckNav } from "./DeckNav";
import { APPENDIX_ORDER, appendixCode, coreNumberOf } from "./deckModel";

/** "Return to slide N" control. C is the keyboard equivalent. */
export function ReturnLink({ from }: { from: number }) {
  const { exportMode } = useDeckNav();
  const n = coreNumberOf(from);
  const label = n !== null ? `Return to slide ${n}` : "Return to the closing slide";
  return (
    <DeckLink view={{ kind: "core", position: from }} className="pv24-return-link" ariaLabel={`${label} (C)`}>
      <IconArrowBackUp size={18} stroke={1.9} aria-hidden="true" />
      {label}
      {exportMode ? null : (
        <kbd className="pv24-kbd" aria-hidden="true">
          C
        </kbd>
      )}
    </DeckLink>
  );
}

export function IndexLink({ from }: { from: number }) {
  const { exportMode } = useDeckNav();
  return (
    <DeckLink view={{ kind: "appendix-index", from }} className="pv24-ref-chip" ariaLabel="Open the appendix index (A)">
      <IconLayoutGrid size={16} stroke={1.8} aria-hidden="true" />
      Appendix index
      {exportMode ? null : (
        <kbd className="pv24-kbd" aria-hidden="true">
          A
        </kbd>
      )}
    </DeckLink>
  );
}

type AppendixSlide24Props = {
  slide: AppendixSlideData;
  from: number;
  exportMode?: boolean;
  staticMotion?: boolean;
};

export function AppendixSlide24({ slide, from, exportMode = false, staticMotion = false }: AppendixSlide24Props) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || staticMotion || prefersReduced === true;
  const position = APPENDIX_ORDER.findIndex((s) => s.id === slide.id) + 1;
  const status = slide.status;
  const aside = (
    <>
      <span className="pv24-appendix-code">{appendixCode(slide.id)}</span>
      {status ? (
        <span className="pv24-status-line">
          <StatusBadge level={status.level} />
          <span className="pv24-status-line__note">{status.note}</span>
        </span>
      ) : null}
    </>
  );

  return (
    <>
      <SlideHeader
        section={slide.group ?? slide.section}
        title={slide.title}
        subtitle={slide.subtitle}
        exportMode={skip}
        aside={aside}
      />
      <SlideStage measureKey={slide.id}>
        <motion.div
          style={{ position: "absolute", inset: 0 }}
          initial={skip ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={skip ? undefined : { duration: 0.45, delay: 0.25, ease: [0, 0, 0.2, 1] }}
        >
          <AppendixVisual24 visual={slide.visual} />
        </motion.div>
      </SlideStage>
      <SlideFooter
        links={
          <>
            <ReturnLink from={from} />
            <IndexLink from={from} />
          </>
        }
        sourceNote={slide.evidenceBasis.map((e) => e.label).join("; ")}
        counter={position > 0 ? `Appendix ${position} / ${APPENDIX_ORDER.length}` : undefined}
        counterLabel={position > 0 ? `Appendix slide ${position} of ${APPENDIX_ORDER.length}` : undefined}
      />
    </>
  );
}

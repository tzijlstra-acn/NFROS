"use client";

import { motion, useReducedMotion } from "motion/react";
import type { AppendixSlide24 } from "../data/types";
import SlideHeader from "./SlideHeader";
import { SlideStage } from "./SlideStage";
import { SlideFooter } from "./SlideFooter";
import { StatusBadge } from "./StatusBadge24";
import { DeckLink } from "./DeckNav";
import { ReturnLink } from "./AppendixSlide24";
import { SlideDownloadButton } from "./DownloadMenu24";
import { APPENDIX_INDEX_GROUPS, APPENDIX_ORDER, INDEX_SECTION, INDEX_TITLE, appendixCode } from "./deckModel";

type IndexColumn = { name: string; continued: boolean; slides: AppendixSlide24[] };

const MAX_COLUMNS = 6;

// Each group gets its own column; a long group continues in the next column
function buildColumns(perColumn: number): IndexColumn[] {
  return APPENDIX_INDEX_GROUPS.flatMap((group) => {
    const cols: IndexColumn[] = [];
    for (let i = 0; i < group.slides.length; i += perColumn) {
      cols.push({ name: group.name, continued: i > 0, slides: group.slides.slice(i, i + perColumn) });
    }
    return cols;
  });
}

function layout(): { columns: IndexColumn[]; compact: boolean } {
  const roomy = buildColumns(6);
  if (roomy.length <= MAX_COLUMNS) return { columns: roomy, compact: false };
  return { columns: buildColumns(Math.max(7, Math.ceil(APPENDIX_ORDER.length / MAX_COLUMNS) + 1)), compact: true };
}

type AppendixIndex24Props = {
  from: number;
  exportMode?: boolean;
  staticMotion?: boolean;
};

export function AppendixIndex24({ from, exportMode = false, staticMotion = false }: AppendixIndex24Props) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || staticMotion || prefersReduced === true;
  const { columns, compact } = layout();
  const groupCount = APPENDIX_INDEX_GROUPS.length;

  return (
    <>
      <SlideHeader
        section={INDEX_SECTION}
        title={INDEX_TITLE}
        subtitle={`${APPENDIX_ORDER.length} reference slides in ${groupCount} ${groupCount === 1 ? "group" : "groups"}, each with its implementation status`}
        exportMode={skip}
      />
      <SlideDownloadButton />
      <SlideStage measureKey="appendix-index">
        <nav
          aria-label="Appendix slides"
          className={compact ? "pv24-index pv24-index--compact" : "pv24-index"}
          style={{ gridTemplateColumns: `repeat(${Math.max(1, columns.length)}, minmax(0, 1fr))` }}
        >
          {columns.map((col, ci) => (
            <motion.section
              key={`${col.name}-${ci}`}
              className="pv24-index__group"
              initial={skip ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={skip ? undefined : { duration: 0.35, delay: 0.2 + ci * 0.08 }}
            >
              <h2 className="pv24-index__group-name">
                {col.name}
                {col.continued ? <span className="pv24-index__continued"> continued</span> : null}
              </h2>
              <ul className="pv24-index__list">
                {col.slides.map((slide) => (
                  <li key={slide.id}>
                    <DeckLink view={{ kind: "appendix", id: slide.id, from }} className="pv24-index__entry">
                      <span className="pv24-index__meta">
                        <span className="pv24-index__code">{appendixCode(slide.id)}</span>
                        {slide.status ? <StatusBadge level={slide.status.level} size="sm" /> : null}
                      </span>
                      <span className="pv24-index__title">{slide.title}</span>
                    </DeckLink>
                  </li>
                ))}
              </ul>
            </motion.section>
          ))}
        </nav>
      </SlideStage>
      <SlideFooter links={<ReturnLink from={from} />} />
    </>
  );
}

"use client";

import { useState } from "react";
import { IconDownload, IconLayoutGrid } from "@tabler/icons-react";
import { PRESENTATION_SLIDES_V24 } from "../data/core-story";
import { coreNumberOf, type DeckView } from "./deckModel";

type SlideNavPanel24Props = {
  view: DeckView;
  onNavigate: (view: DeckView) => void;
  onOpenDownloads: (trigger: HTMLElement | null) => void;
};

/** Left-edge hover menu. The fixed container and its z-index are what the layout audit looks for. */
export function SlideNavPanel24({ view, onNavigate, onOpenDownloads }: SlideNavPanel24Props) {
  const [open, setOpen] = useState(false);
  const activePosition = view.kind === "core" ? view.position : null;
  const fromPosition = view.kind === "core" ? view.position : view.from;

  return (
    <div
      className={open ? "pv24-nav pv24-nav--open" : "pv24-nav"}
      style={{ position: "fixed", zIndex: 300, left: 0, top: 0, bottom: 0, width: open ? 320 : 8 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <nav className="pv24-nav__list" aria-label="Slide navigation" style={{ visibility: open ? "visible" : "hidden" }}>
        <div className="pv24-nav__heading">Core story</div>
        {PRESENTATION_SLIDES_V24.map((slide, i) => {
          const position = i + 1;
          const n = coreNumberOf(position);
          const active = position === activePosition;
          return (
            <button
              key={slide.id}
              type="button"
              className={active ? "pv24-nav__item pv24-nav__item--active" : "pv24-nav__item"}
              aria-current={active ? "true" : undefined}
              onClick={() => {
                onNavigate({ kind: "core", position });
                setOpen(false);
              }}
            >
              <span className="pv24-nav__meta">
                {n !== null ? String(n).padStart(2, "0") : "Q&A"} {slide.section}
              </span>
              <span className="pv24-nav__title">{slide.title}</span>
            </button>
          );
        })}
        <div className="pv24-nav__heading pv24-nav__heading--gap">Reference</div>
        <button
          type="button"
          className={view.kind === "appendix-index" ? "pv24-nav__item pv24-nav__item--active pv24-nav__item--action" : "pv24-nav__item pv24-nav__item--action"}
          onClick={() => {
            onNavigate({ kind: "appendix-index", from: fromPosition });
            setOpen(false);
          }}
        >
          <IconLayoutGrid size={18} stroke={1.8} aria-hidden="true" />
          <span className="pv24-nav__title">Appendix index</span>
        </button>
        <button
          type="button"
          className="pv24-nav__item pv24-nav__item--action"
          aria-haspopup="dialog"
          onClick={(e) => {
            setOpen(false);
            onOpenDownloads(e.currentTarget);
          }}
        >
          <IconDownload size={18} stroke={1.8} aria-hidden="true" />
          <span className="pv24-nav__title">Download deck</span>
        </button>
      </nav>
    </div>
  );
}

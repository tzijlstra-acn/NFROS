"use client";

import { createContext, useContext, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import type { DeckView } from "./deckModel";

export type DeckNavValue = {
  exportMode: boolean;
  navigate: (view: DeckView) => void;
  hrefFor: (view: DeckView) => string;
  openDownloads: (trigger?: HTMLElement | null) => void;
};

const noop = () => undefined;

export const DeckNavContext = createContext<DeckNavValue>({
  exportMode: false,
  navigate: noop,
  hrefFor: () => "/story",
  openDownloads: noop,
});

export function useDeckNav(): DeckNavValue {
  return useContext(DeckNavContext);
}

/** The value the exporter reads to place a link over this element. */
export function linkTarget(view: DeckView): string {
  if (view.kind === "core") return `core:${view.position}`;
  if (view.kind === "appendix") return `appendix:${view.id}`;
  return "appendix-index";
}

type DeckLinkProps = {
  view: DeckView;
  className?: string;
  style?: CSSProperties;
  title?: string;
  ariaLabel?: string;
  children: ReactNode;
};

/** An in-deck link: a real href for new tabs and export, client navigation on a plain click. */
export function DeckLink({ view, className, style, title, ariaLabel, children }: DeckLinkProps) {
  const { navigate, hrefFor } = useDeckNav();
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(view);
  };
  return (
    <a
      href={hrefFor(view)}
      className={className}
      style={style}
      title={title}
      aria-label={ariaLabel}
      data-link-target={linkTarget(view)}
      onClick={onClick}
    >
      {children}
    </a>
  );
}

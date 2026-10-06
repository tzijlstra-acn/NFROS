/**
 * Inline style constants for the Product Owner Console.
 *
 * The administrator area styles its few form controls inline in the V3.3
 * tokens rather than with a stylesheet of its own (see `Field` in
 * `src/components/settings/primitives.tsx`); the console follows that, and
 * keeps the constants in one place so every console form looks the same.
 */

import type { CSSProperties } from "react";

export const consoleInputStyle: CSSProperties = {
  height: 30,
  padding: "0 var(--app-2)",
  border: "1px solid var(--app-border-strong)",
  borderRadius: "var(--app-radius)",
  background: "var(--app-surface)",
  color: "var(--app-text)",
  font: "inherit",
  fontSize: "var(--app-text-sm)",
  minWidth: 0,
  maxWidth: "100%",
};

export const consoleTextareaStyle: CSSProperties = {
  ...consoleInputStyle,
  height: "auto",
  minHeight: 64,
  padding: "var(--app-2)",
  resize: "vertical",
  lineHeight: "var(--app-leading-normal)",
  width: "100%",
};

export const consoleLabelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--app-1)",
  fontSize: "var(--app-text-xs)",
  color: "var(--app-text-secondary)",
  minWidth: 0,
};

/** A bordered panel, used for the acting persona strip and approval panels. */
export const consolePanelStyle: CSSProperties = {
  border: "1px solid var(--app-border)",
  borderRadius: "var(--app-radius-lg)",
  background: "var(--app-surface)",
  padding: "var(--app-3) var(--app-4)",
  minWidth: 0,
};

/** A row of key figures that wraps instead of overflowing. */
export const consoleFigureGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
  gap: "var(--app-3)",
};

/** Wrapping secondary text inside a row. */
export const consoleWrapStyle: CSSProperties = {
  display: "block",
  whiteSpace: "normal",
  maxWidth: "110ch",
  overflowWrap: "anywhere",
};

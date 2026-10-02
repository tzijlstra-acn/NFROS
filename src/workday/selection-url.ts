/**
 * The URL form of a selection.
 *
 * Split out of `SelectionProvider.tsx` for one reason: that module carries the
 * `"use client"` directive, and a server component calling a function from a
 * client module fails at runtime with "Attempted to call parseSelectionParam()
 * from the server". The parsing has to happen on the server, because the
 * server is the only side that can resolve an identifier to a title, so the
 * pure part lives here and the provider re-exports it.
 *
 * Nothing in this file touches React, the database or the request. It is a
 * string format and its guard, which is why it can be imported from either
 * side of the boundary and from a test.
 */

import type { WorkdaySelection } from "./contracts";

/** The query parameter the focus queue links with, for example `?select=risk:RSK-0211`. */
export const SELECTION_PARAM = "select";

export const SELECTION_TYPES: ReadonlyArray<WorkdaySelection["objectType"]> = [
  "risk",
  "control",
  "supplier",
  "service",
  "test-case",
  "incident",
  "obligation",
  "decision",
  "process",
  "theme",
  "assessment",
  "action",
];

export function isSelectionType(value: string): value is WorkdaySelection["objectType"] {
  return (SELECTION_TYPES as readonly string[]).includes(value);
}

/**
 * Reads `?select=<type>:<id>`.
 *
 * The label is resolved by the caller, because only the server knows what an
 * identifier is called. When it cannot be resolved the identifier is used as
 * the label: showing `RSK-0211` is honest, and inventing a title would not be.
 *
 * Splits on the FIRST colon only, because an identifier may contain one and a
 * type never does.
 */
export function parseSelectionParam(
  value: string | null | undefined,
  resolveLabel?: (objectId: string) => string | undefined,
): WorkdaySelection | null {
  if (!value) return null;
  const separator = value.indexOf(":");
  if (separator <= 0) return null;
  const objectType = value.slice(0, separator);
  const objectId = value.slice(separator + 1);
  if (objectId.length === 0 || !isSelectionType(objectType)) return null;
  return { objectType, objectId, label: resolveLabel?.(objectId) ?? objectId };
}

export function formatSelectionParam(selection: WorkdaySelection): string {
  return `${selection.objectType}:${selection.objectId}`;
}

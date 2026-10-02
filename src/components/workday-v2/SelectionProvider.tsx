"use client";

/**
 * The current selection.
 *
 * One object at a time: the risk, control, supplier, service, test case,
 * incident, obligation or decision the professional is looking at. Three
 * surfaces need to agree about it and they sit far apart in the tree. The
 * workspace in the centre column sets it, the contextual drawer reads it to
 * decide which evidence to show, and the AI Partner reads it so a question
 * typed into the composer is a question about that object rather than about
 * the role in general.
 *
 * A context rather than props, for the same reason the shell chrome is a
 * context: threading a setter from a graph node through six workspace
 * components to a portal at the document root would couple every workspace to
 * the shell for no benefit.
 *
 * What is deliberately NOT in here is the autonomy level, the scenario clock
 * and the acting role. Those have consequences, they live in the database, and
 * the server owns them. Selection has no consequence: it changes what is shown
 * and nothing else, which is exactly why it is safe to hold in the browser.
 *
 * The reconciliation rule is the part that is easy to get wrong, so it is a
 * pure function tested on its own. A selection survives navigation inside a
 * role as long as the object is still on the new route, and clears otherwise.
 * Without the second half, a user who selected a test case in Control
 * Assurance and then opened the calendar would have a drawer and a partner
 * both still talking about a transaction that is nowhere on screen.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import type { RoleId } from "@/db/schema/core";
import type { WorkdaySelection } from "@/workday/contracts";
import {
  formatSelectionParam,
  isSelectionType,
  parseSelectionParam,
} from "@/workday/selection-url";

/* ==========================================================================
   The reducer
   ========================================================================== */

export interface SelectionSnapshot {
  roleId: RoleId;
  selection: WorkdaySelection | null;
}

export type SelectionAction =
  | { kind: "select"; selection: WorkdaySelection }
  | { kind: "clear" }
  /**
   * A route or role change. Carries the candidate selection and the object
   * identifiers the new route exposes, so the keep or clear decision is made
   * in one step rather than as a sequence a render could be caught between.
   */
  | {
      kind: "restore";
      roleId: RoleId;
      selection: WorkdaySelection | null;
      validObjectIds: readonly string[];
    };

/**
 * The selection state machine.
 *
 * Pure and exported, because the clearing rule is a product rule. An empty
 * `validObjectIds` clears the selection: a route that exposes no objects is a
 * route on which the previous object is not present, and treating empty as
 * "unknown, keep it" is how a stale object survives onto a screen that has
 * nothing to do with it.
 */
export function selectionReducer(
  state: SelectionSnapshot,
  action: SelectionAction,
): SelectionSnapshot {
  switch (action.kind) {
    case "select":
      return { roleId: state.roleId, selection: action.selection };

    case "clear":
      return state.selection === null ? state : { roleId: state.roleId, selection: null };

    case "restore": {
      const candidate = action.roleId === state.roleId ? action.selection : null;
      const keep =
        candidate !== null && action.validObjectIds.includes(candidate.objectId) ? candidate : null;
      if (state.roleId === action.roleId && state.selection === keep) return state;
      return { roleId: action.roleId, selection: keep };
    }
  }
}

/* ==========================================================================
   The URL form
   ========================================================================== */

/*
 * Re-exported rather than defined here.
 *
 * This module carries the client directive, and a server component calling a
 * function out of a client module fails at runtime with "Attempted to call
 * parseSelectionParam() from the server". The parsing has to run on the
 * server, because the server is the only side that can resolve an identifier
 * to a title, so the pure string format lives in
 * `src/workday/selection-url.ts` and both sides import it from there. The
 * names stay exported here so existing callers and tests are unaffected.
 */
export {
  SELECTION_PARAM,
  SELECTION_TYPES,
  formatSelectionParam,
  isSelectionType,
  parseSelectionParam,
} from "@/workday/selection-url";

/* ==========================================================================
   The context
   ========================================================================== */

export interface SelectionState {
  selection: WorkdaySelection | null;
  /** Replaces the selection, or clears it with null. */
  setSelection: (next: WorkdaySelection | null) => void;
  /** Convenience for a visualisation node click. */
  select: (
    objectType: WorkdaySelection["objectType"],
    objectId: string,
    label: string,
  ) => void;
  clear: () => void;
  /** True when this object identifier is the current selection. */
  isSelected: (objectId: string) => boolean;
}

const SelectionContextValue = createContext<SelectionState | null>(null);

/** Per role, so switching role does not inherit the previous role's object. */
function storageKey(roleId: RoleId): string {
  return `nfr.workday.selection.${roleId}`;
}

function readStored(roleId: RoleId): WorkdaySelection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(roleId));
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "objectType" in parsed &&
      "objectId" in parsed &&
      "label" in parsed &&
      typeof (parsed as { objectId: unknown }).objectId === "string" &&
      typeof (parsed as { objectType: unknown }).objectType === "string" &&
      isSelectionType((parsed as { objectType: string }).objectType)
    ) {
      return parsed as WorkdaySelection;
    }
    return null;
  } catch {
    return null;
  }
}

function writeStored(roleId: RoleId, selection: WorkdaySelection | null): void {
  if (typeof window === "undefined") return;
  try {
    if (selection === null) window.sessionStorage.removeItem(storageKey(roleId));
    else window.sessionStorage.setItem(storageKey(roleId), JSON.stringify(selection));
  } catch {
    // A browser with storage disabled loses the selection on navigation and
    // nothing else. Everything that matters is still on the server.
  }
}

export interface SelectionProviderProps {
  roleId: RoleId;
  /**
   * Every object identifier the current route exposes. The server knows this
   * from the workspace view model: `selectableIdsOf(view)` returns it.
   */
  validObjectIds: readonly string[];
  /** A selection resolved on the server, typically from `?select=`. */
  initialSelection?: WorkdaySelection | null;
  children: ReactNode;
}

export function SelectionProvider({
  roleId,
  validObjectIds,
  initialSelection = null,
  children,
}: SelectionProviderProps) {
  /*
   * The server rendered value is the starting point, and session storage is
   * applied after mount. Reading storage during the first render would produce
   * a hydration mismatch, because the server cannot know what the tab holds.
   */
  const [state, dispatch] = useReducer(selectionReducer, {
    roleId,
    selection: initialSelection,
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  // A stable key, so the reconciliation effect runs when the route's set of
  // objects genuinely changes rather than on every render.
  const validKey = validObjectIds.join("|");

  useEffect(() => {
    const current = stateRef.current;
    const candidate = current.roleId === roleId ? (current.selection ?? readStored(roleId)) : null;
    dispatch({ kind: "restore", roleId, selection: candidate, validObjectIds });
    // validObjectIds is covered by validKey, which is the value that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleId, validKey]);

  useEffect(() => {
    writeStored(state.roleId, state.selection);
  }, [state.roleId, state.selection]);

  const setSelection = useCallback((next: WorkdaySelection | null) => {
    if (next === null) dispatch({ kind: "clear" });
    else dispatch({ kind: "select", selection: next });
  }, []);

  const value = useMemo<SelectionState>(
    () => ({
      selection: state.selection,
      setSelection,
      select: (objectType, objectId, label) =>
        dispatch({ kind: "select", selection: { objectType, objectId, label } }),
      clear: () => dispatch({ kind: "clear" }),
      isSelected: (objectId: string) => state.selection?.objectId === objectId,
    }),
    [state.selection, setSelection],
  );

  return <SelectionContextValue.Provider value={value}>{children}</SelectionContextValue.Provider>;
}

/**
 * Reads the selection.
 *
 * Returns an inert shape rather than throwing when there is no provider, so a
 * workspace rendered outside the workday shell, in the administrator area or
 * in a test, renders without a selection instead of crashing. A disabled
 * affordance is a better failure than a blank page.
 */
export function useSelection(): SelectionState {
  const value = useContext(SelectionContextValue);
  if (value) return value;
  return {
    selection: null,
    setSelection: () => {},
    select: () => {},
    clear: () => {},
    isSelected: () => false,
  };
}

/* ==========================================================================
   Asking the partner about the selection
   ========================================================================== */

export type AskAi = (prompt: string, selection: WorkdaySelection | null) => void;

const AskAiContextValue = createContext<AskAi | null>(null);

/**
 * Supplies the "ask about this" callback.
 *
 * A context rather than a prop because the workspaces are reached through a
 * lazy boundary from a server component, and a function cannot cross that
 * boundary. The shell owns the partner, so the shell provides the callback and
 * the workspaces call it without knowing anything about the partner.
 */
export function AskAiProvider({ onAsk, children }: { onAsk: AskAi; children: ReactNode }) {
  return <AskAiContextValue.Provider value={onAsk}>{children}</AskAiContextValue.Provider>;
}

/** The callback, or a no-op where no partner is mounted. */
export function useAskAi(): AskAi {
  return useContext(AskAiContextValue) ?? (() => {});
}

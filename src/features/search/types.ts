/**
 * The shape of global search and the command palette.
 *
 * Plan section 4.12 asks for one search over the professional objects of a
 * role's working day, grouped by object type, scoped to the role and its legal
 * entity, with every result opening in the surface where that object is
 * actually worked on. These types are that contract, shared by the server read
 * model (`read.ts`), the pure matcher (`match.ts`) and the palette in
 * `src/components/shell/CommandPalette.tsx`.
 *
 * Client safe: nothing here reads the database.
 */

import type { Language } from "@/i18n/labels";

/**
 * The twelve object types the plan names, in the plan's order.
 *
 * `minutes` and `process-run` are named for what they are to the analyst,
 * a set of minutes and a running process, not for the tables they live in.
 */
export const SEARCH_KINDS = [
  "risk",
  "control",
  "assessment",
  "supplier",
  "service",
  "contract",
  "evidence",
  "meeting",
  "minutes",
  "action",
  "decision",
  "process-run",
  /*
   * Inbox messages, added for plan section 4.8 ("handled messages remain
   * searchable"). Read through `readInboxSearchEntries` in the inbox module.
   */
  "message",
] as const;

export type SearchKind = (typeof SEARCH_KINDS)[number];

export function isSearchKind(value: unknown): value is SearchKind {
  return typeof value === "string" && (SEARCH_KINDS as readonly string[]).includes(value);
}

/**
 * One searchable object.
 *
 * Deliberately narrow, like the V2 palette index it replaces: a label to match
 * and show, a reference, one short line of context, and where it opens. The
 * object itself never reaches the browser, and an object outside the role's
 * scope is never in the list at all, so it cannot be found by any query.
 */
export interface SearchEntry {
  kind: SearchKind;
  id: string;
  /** What the reader recognises: the title or name, in the interface language. */
  label: string;
  /** The identifier the product shows beside it, for example RSK-0211 or CTL-PAY-014. */
  reference: string;
  /** One line of recorded context: a status, a date, a supplier. Never document text. */
  detail: string | null;
  /** The product surface it opens on. Always a workday route of the same role. */
  href: string;
  /** Matched but not shown: the other language's title, the raw identifier. */
  keywords: string;
}

/** A group of hits for one object type, in the role's order. */
export interface SearchGroup {
  kind: SearchKind;
  /** The professional name of the type, for example "Controls" or "Kontrollen". */
  label: string;
  hits: SearchEntry[];
  /** How many entries of this type matched, including those not shown. */
  total: number;
}

/* ==========================================================================
   Commands
   ========================================================================== */

/** The eight commands plan section 4.12 lists, in its order. */
export const PALETTE_COMMAND_IDS = [
  "open-current-work",
  "open-next-meeting",
  "find-supplier",
  "find-control",
  "open-current-process",
  "review-decisions",
  "ask-ai",
  "open-evidence",
] as const;

export type PaletteCommandId = (typeof PALETTE_COMMAND_IDS)[number];

/**
 * What running a command does.
 *
 * `navigate` goes to a route. `search` narrows the palette to one object type.
 * `ask-ai` opens the AI Partner through the chrome's own open control.
 * `evidence` opens the evidence of the item the reader has selected, or, when
 * nothing is selected, narrows the palette to evidence.
 */
export type PaletteAction =
  | { kind: "navigate"; href: string }
  | { kind: "search"; searchKind: SearchKind }
  | { kind: "ask-ai" }
  | { kind: "evidence" };

export interface PaletteCommand {
  id: PaletteCommandId;
  label: string;
  /** What the command will open, read from the data: "10:30 RCSA Challenge Workshop". */
  detail: string | null;
  action: PaletteAction;
  /** False when there is nothing to open. The reason is then shown instead of a target. */
  available: boolean;
  unavailableReason: string | null;
  /** Extra words that find the command, in both languages. */
  keywords: string;
}

/* ==========================================================================
   The payload the palette fetches
   ========================================================================== */

/**
 * Everything the palette needs, read once when it is first opened.
 *
 * Fetched on open rather than rendered with the page, for the reason the
 * header module states: the header has its own small budget, and an index of
 * every object in scope is exactly the kind of read it must not wait for.
 */
export interface SearchPayload {
  roleId: string;
  /** The role's title in the interface language, for the scope line. */
  roleLabel: string;
  language: Language;
  atMoment: string;
  /** The legal entity the reference objects are scoped to, by name. */
  entityLabel: string | null;
  /** The object types in the order this role reads them. */
  kindOrder: SearchKind[];
  entries: SearchEntry[];
  commands: PaletteCommand[];
}

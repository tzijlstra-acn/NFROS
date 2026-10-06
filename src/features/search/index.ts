/**
 * Global search and the command palette.
 *
 * Client safe. The server read model is imported from
 * `@/features/search/read` directly, so that importing the matcher into the
 * palette does not pull the database into the browser bundle.
 */

export type {
  PaletteAction,
  PaletteCommand,
  PaletteCommandId,
  SearchEntry,
  SearchGroup,
  SearchKind,
  SearchPayload,
} from "./types";
export { isSearchKind, PALETTE_COMMAND_IDS, SEARCH_KINDS } from "./types";
export {
  flattenGroups,
  HITS_PER_GROUP,
  HITS_PER_KIND,
  normaliseForSearch,
  queryTerms,
  scoreEntry,
  searchEntries,
} from "./match";
export {
  isPinned,
  parseStored,
  PINNED_LIMIT,
  RECENT_LIMIT,
  reconcileStored,
  rememberRecent,
  storageKey,
  togglePinned,
  toStored,
  type StoredSearchItem,
} from "./stored";
export { buildPaletteCommands, type CommandFacts, type CommandTarget } from "./commands";
export { COMMAND_LABELS, fill, KIND_LABELS, KIND_SINGULAR, say, SEARCH_COPY } from "./copy";

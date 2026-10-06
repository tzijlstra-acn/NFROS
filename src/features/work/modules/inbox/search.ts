/**
 * The inbox's read function for global search.
 *
 * Server only, reads only. Global search (`src/features/search/`) is the
 * shell's; this is the clean seam it reads the inbox through, so handled
 * messages stay findable after they leave Needs me: a message that became an
 * action is found by the action's identifier, one that was dismissed is
 * still found by its subject. Scope is the role's own inbox at the current
 * moment, the same rows the Inbox tab shows.
 */

import type { RoleId } from "@/db/schema/core";
import { loadWorkShared } from "../../hub-data";
import { DEFAULT_QUERY } from "../../url";
import { loadInboxExtras } from "./load";
import { buildInboxSearchEntries, type InboxSearchEntry } from "./read-model";

export function readInboxSearchEntries(roleId: RoleId): InboxSearchEntry[] {
  const shared = loadWorkShared(roleId);
  if (!shared) return [];
  return buildInboxSearchEntries(shared, loadInboxExtras(shared, { ...DEFAULT_QUERY, tab: "inbox" }));
}

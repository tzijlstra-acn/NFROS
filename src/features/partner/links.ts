/**
 * Where a Partner output opens.
 *
 * Pure. One function per kind of thing the Partner prepares, built from the
 * addresses the rest of the workday already uses (the Work Hub's `itemHref`,
 * the Decisions anchor, the `?select=` form of a domain object), so a link in
 * the dock, on Home and in Updates to the same thing is the same address.
 */

import { itemHref } from "@/features/work/url";
import { SELECTION_PARAM, isSelectionType } from "@/workday/selection-url";

/** An object kind and identifier, as a routine run output or a suggestion's object records it. */
export function objectLink(roleId: string, kind: string, id: string): string {
  switch (kind) {
    case "decision":
      return `/workday/${roleId}/decisions#${encodeURIComponent(id)}`;
    case "action":
    case "action-reminder-draft":
      return itemHref(roleId, "actions", id);
    case "meeting":
    case "meeting-preparation":
      return itemHref(roleId, "meetings", id);
    case "message":
    case "inbox-message":
    case "inbox-triage-proposal":
      return itemHref(roleId, "inbox", id);
    default:
      return isSelectionType(kind)
        ? `/workday/${roleId}?${SELECTION_PARAM}=${encodeURIComponent(kind)}:${encodeURIComponent(id)}`
        : `/workday/${roleId}`;
  }
}

/** Where a suggestion opens: its decision when it prepared one, else its object. */
export function suggestionHref(
  roleId: string,
  suggestion: { decisionId: string | null; objectType: string; objectId: string },
): string {
  if (suggestion.decisionId) return objectLink(roleId, "decision", suggestion.decisionId);
  return objectLink(roleId, suggestion.objectType, suggestion.objectId);
}

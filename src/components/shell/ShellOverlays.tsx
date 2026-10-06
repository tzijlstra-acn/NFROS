"use client";

/**
 * The shell's two overlays: global search with the command palette, and the
 * Updates panel.
 *
 * Mounted by the workday frame next to the drawer and the dock, inside the one
 * chrome provider, so the header's Search and Updates controls, the bottom
 * bar and Control K all reach the same state. They are siblings of the frame
 * rather than children of the header because the header clips its overflow,
 * and a popover that is cut off at 48px is not a popover.
 *
 * Neither renders anything until it is opened, and neither fetches anything
 * until then: the header's budget does not pay for them.
 *
 * A role the release gate does not open gets neither. Its header offers no
 * Search or Updates control, and Control K does nothing.
 */

import type { Language } from "@/i18n/labels";
import { CommandPalette } from "./CommandPalette";
import { UpdatesPanel } from "./UpdatesPanel";

export function ShellOverlays({
  roleId,
  language,
  enabled,
  updatesCount,
}: {
  roleId: string;
  language: Language;
  enabled: boolean;
  updatesCount: number;
}) {
  if (!enabled) return null;
  return (
    <>
      <CommandPalette roleId={roleId} language={language} />
      <UpdatesPanel roleId={roleId} language={language} renderedCount={updatesCount} />
    </>
  );
}

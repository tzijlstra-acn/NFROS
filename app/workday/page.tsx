/**
 * Workday entry: role selector.
 *
 * Thin wrapper around RoleSelector. No database access is needed here because
 * the selector is built entirely from the static release definitions. The page
 * is standalone: it has no navigation rail (no role has been chosen yet) and
 * provides its own light frame. See RoleSelector.tsx for the full layout.
 */

import { RoleSelector } from "@/components/workday-v3/RoleSelector";

export const dynamic = "force-dynamic";

export default function WorkdayIndexPage() {
  return <RoleSelector />;
}

/**
 * Workday entry: role selector.
 *
 * Thin wrapper around RoleSelector. The release registry decides which roles
 * are Available, Demo or Planned; `readRoleSignalOverview` adds one live
 * signal per Available role from the database. The page is standalone: it has
 * no navigation rail (no role has been chosen yet) and provides its own light
 * frame. See RoleSelector.tsx for the layout.
 *
 * A Planned role's routes redirect here with `?unavailable=<role>` (the
 * release gate, `src/workday/role-gate.ts`), and the selector then says which
 * role was refused and why. The parameter is checked against the registry, so
 * nothing in the query is echoed as given.
 */

import { RoleSelector } from "@/components/workday-v3/RoleSelector";
import { readRoleSignalOverview } from "@/features/role-signals";
import { refusedRoleFromQuery, UNAVAILABLE_ROLE_PARAM } from "@/workday/role-gate";

export const dynamic = "force-dynamic";

export default async function WorkdayIndexPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = searchParams ? await searchParams : {};
  return (
    <RoleSelector
      overview={readRoleSignalOverview()}
      refusedRole={refusedRoleFromQuery(query[UNAVAILABLE_ROLE_PARAM])}
    />
  );
}

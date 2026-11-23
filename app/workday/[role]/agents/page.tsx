/**
 * Agents. One interface: V3. The dispatcher applies the release gate.
 */

import { ROLE_IDS } from "@/db/schema/core";
import { createWorkdayPage, type RoleRouteParams } from "@/workday/dispatch";
import V3 from "./v3";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return ROLE_IDS.map((role) => ({ role }));
}

const Only = ({ params }: { params: Promise<RoleRouteParams> }) => V3({ params, searchParams: {} });

export default createWorkdayPage(Only, V3, V3);

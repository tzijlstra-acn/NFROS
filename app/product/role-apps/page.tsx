/**
 * Product Owner Console: Role Apps (plan 7.2 and 7.3).
 *
 * Thin: the read model, the lifecycle rules and the governed actions live in
 * `src/features/product/role-apps/`.
 */

import { readAdminLanguage } from "@/product/status/sources";
import { RoleAppsConsole } from "@/features/product/role-apps/RoleAppsConsole";

export const dynamic = "force-dynamic";

export default function ProductRoleAppsPage() {
  return <RoleAppsConsole language={readAdminLanguage()} />;
}

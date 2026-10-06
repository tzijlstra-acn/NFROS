/**
 * Entry experience.
 *
 * Thin. The page is the product entrance and nothing else: the proposition,
 * the way in, and a live preview of the two Available roles. Runtime state
 * (AI mode, key state, verification, configuration source, database state,
 * mode selection, setup commands and the reset control) moved to
 * `/control-room`, which the footer links to for presenters.
 *
 * The previews are read through `readRoleSignalOverview`, the same read model
 * the role selector uses, so the entrance and the selector always describe
 * the same day. See `src/components/landing/LandingPage.tsx` for the layout.
 */

import { LandingPage } from "@/components/landing/LandingPage";
import { readRoleSignalOverview } from "@/features/role-signals";

export const dynamic = "force-dynamic";

/**
 * The design-partner workspace route.
 *
 * This build has no design-partner workspace route: the previous entry linked
 * to `/pilot`, which does not exist, and `/settings/pilot` is a readiness
 * checklist for administrators rather than a workspace. So the action renders
 * disabled with its reason. When a workspace route ships, set it here.
 */
const DESIGN_PARTNER_WORKSPACE_HREF: string | null = null;

export default function EntryPage() {
  return (
    <LandingPage
      overview={readRoleSignalOverview()}
      designPartnerHref={DESIGN_PARTNER_WORKSPACE_HREF}
    />
  );
}

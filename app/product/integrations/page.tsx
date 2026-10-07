/**
 * Product Owner Console: Integrations (plan 7.6).
 *
 * Thin: the section is `src/features/product/integrations/IntegrationsConsole.tsx`.
 */

import { readAdminLanguage } from "@/product/status/sources";
import { IntegrationsConsole } from "@/features/product/integrations/IntegrationsConsole";

export const dynamic = "force-dynamic";

export default function ProductIntegrationsPage() {
  return <IntegrationsConsole language={readAdminLanguage()} />;
}

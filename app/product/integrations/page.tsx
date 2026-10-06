/**
 * Product Owner Console: integrations.
 *
 * In preparation. This section is built by another console workstream, which
 * replaces this file with its page. Until then the console shows an honest
 * "In preparation" page rather than a page that looks finished.
 */

import { readAdminLanguage } from "@/product/status/sources";
import { InPreparation } from "@/features/product/shell/InPreparation";

export const dynamic = "force-dynamic";

export default function ConsoleSectionInPreparation() {
  return <InPreparation sectionId="integrations" language={readAdminLanguage()} existing={{ href: "/settings/integrations", label: { en: "Integration settings", de: "Einstellungen Integrationen" } }} />;
}

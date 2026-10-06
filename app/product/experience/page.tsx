/**
 * Product Owner Console: experience. Being built by os-console-core.
 */

import { readAdminLanguage } from "@/product/status/sources";
import { InPreparation } from "@/features/product/shell/InPreparation";

export const dynamic = "force-dynamic";

export default function ConsoleSectionInPreparation() {
  return <InPreparation sectionId="experience" language={readAdminLanguage()} />;
}
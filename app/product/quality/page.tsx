/**
 * Product Owner Console: Quality (plan 7.5).
 *
 * Thin: the section is `src/features/product/quality/QualityConsole.tsx`.
 */

import { readAdminLanguage } from "@/product/status/sources";
import { QualityConsole } from "@/features/product/quality/QualityConsole";

export const dynamic = "force-dynamic";

export default function ProductQualityPage() {
  return <QualityConsole language={readAdminLanguage()} />;
}

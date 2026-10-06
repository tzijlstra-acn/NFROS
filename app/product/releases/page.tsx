/**
 * Product Owner Console: Releases (plan 7.9).
 *
 * Thin: the release view, the release gate and the governed release actions
 * live in `src/features/product/releases/`.
 */

import { readAdminLanguage } from "@/product/status/sources";
import { ReleasesConsole } from "@/features/product/releases/ReleasesConsole";

export const dynamic = "force-dynamic";

export default function ProductReleasesPage() {
  return <ReleasesConsole language={readAdminLanguage()} />;
}

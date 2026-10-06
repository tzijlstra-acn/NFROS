/**
 * The administrator settings layout.
 *
 * The frame itself lives in `_components/AdminFrame.tsx`, because the
 * operations console shares it. This file only resolves the language and the
 * page title.
 *
 * Language follows the scenario, as the workday does. It used to be pinned to
 * English with a note that a partly translated area is worse than one in a
 * single language; that holds, so every screen in the area now carries its
 * own copy in both languages. Values read from a registry or the database
 * (tool descriptions, deployment profiles, regulatory references) are shown
 * as stored, and the release registry records that as a known limitation.
 */

import type { Metadata } from "next";
import { PRODUCT_IDENTITY } from "@/product/release";
import { readAdminLanguage } from "@/product/status/sources";
import { AdminFrame } from "./_components/AdminFrame";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Administrator settings: ${PRODUCT_IDENTITY.name}`,
  robots: { index: false, follow: false },
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminFrame language={readAdminLanguage()} context="settings">
      {children}
    </AdminFrame>
  );
}

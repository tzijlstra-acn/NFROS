/**
 * The operations console layout.
 *
 * The same administrator frame as the settings area, so the console has a top
 * bar, the administrator navigation and an inner scroller instead of being
 * laid out in the grid rows of a bare workday root.
 *
 * IMPORTANT: In production this route must be protected by administrator
 * authentication. In demonstration mode it is open, and the page says so.
 */

import type { Metadata } from "next";
import { PRODUCT_IDENTITY } from "@/product/release";
import { readAdminLanguage } from "@/product/status/sources";
import { AdminFrame } from "@app/settings/_components/AdminFrame";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Operations console: ${PRODUCT_IDENTITY.name}`,
  robots: { index: false, follow: false },
};

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminFrame language={readAdminLanguage()} context="operations">
      {children}
    </AdminFrame>
  );
}

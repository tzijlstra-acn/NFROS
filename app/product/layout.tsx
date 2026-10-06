/**
 * The Product Owner Console layout (plan 7).
 *
 * The administrator frame the settings area and the operations console share,
 * with the console's own navigation in the rail: the nine primary sections of
 * plan 7, the feedback inbox, and the existing administrator pages as deep
 * links. The frame root is `workday-v2 workday-v3`, so the console renders in
 * the V3.3 light tokens and the status badge resolves its tokens here.
 *
 * Thin: the sections and their copy live in `src/features/product/shell/`,
 * and the acting persona in `src/features/product/`. Pages inside the console
 * render their own heading with `SettingsHead`; this layout adds nothing above
 * them except the acting persona strip, so every section reads the same way.
 *
 * IMPORTANT: In production this route must be protected by identity. There is
 * no identity provider in this build; the acting persona is a demonstration
 * persona, every console action is checked against it on the server, and the
 * strip at the top of every console page says so.
 */

import type { Metadata } from "next";
import { PRODUCT_IDENTITY } from "@/product/release";
import { readAdminLanguage } from "@/product/status/sources";
import { AdminFrame } from "@app/settings/_components/AdminFrame";
import { ConsoleNav } from "@/features/product/shell/ConsoleNav";
import { CONSOLE_DEEP_LINKS, CONSOLE_SECTIONS } from "@/features/product/shell/nav";
import { CONSOLE_COPY } from "@/features/product/shell/copy";
import { ActingPersonaStrip } from "@/features/product/persona/ActingPersonaStrip";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Product owner console: ${PRODUCT_IDENTITY.name}`,
  robots: { index: false, follow: false },
};

export default function ProductConsoleLayout({ children }: { children: React.ReactNode }) {
  const language = readAdminLanguage();
  const say = (pair: { en: string; de: string }) => (language === "de" ? pair.de : pair.en);
  const entry = (section: (typeof CONSOLE_SECTIONS)[number]) => ({
    href: section.href,
    label: section.label,
    icon: section.icon,
  });

  return (
    <AdminFrame
      language={language}
      context="product"
      rail={
        <ConsoleNav
          language={language}
          primary={CONSOLE_SECTIONS.filter((section) => section.tier === "primary").map(entry)}
          secondary={CONSOLE_SECTIONS.filter((section) => section.tier === "secondary").map(entry)}
          deepLinks={CONSOLE_DEEP_LINKS.map((link) => ({ ...link }))}
          labels={{
            console: say(CONSOLE_COPY.railConsole),
            discovery: say(CONSOLE_COPY.railDiscovery),
            deepLinks: say(CONSOLE_COPY.railDeepLinks),
          }}
        />
      }
    >
      <div className="app-stack app-stack-5" data-console-shell="product">
        <ActingPersonaStrip language={language} />
        {children}
      </div>
    </AdminFrame>
  );
}

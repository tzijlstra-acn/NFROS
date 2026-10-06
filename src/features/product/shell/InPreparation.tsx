/**
 * The honest page for a console section that has not been built yet.
 *
 * The navigation lists every section of plan 7 from the first build, so the
 * product owner sees the whole control plane and where it is incomplete. A
 * section without a page renders this: its name, what it will hold, which
 * plan section it implements, and the existing page that already covers part
 * of it, if any. It shows no figures, no sample rows and no mock layout,
 * because a placeholder that looks like a finished page is exactly the
 * "simulated status without a label" the product principles rule out.
 *
 * The workstream that owns the section replaces its `page.tsx` and this
 * component is no longer rendered there. Server safe.
 */

import Link from "next/link";
import { SettingsHead, SettingsSection } from "@/components/settings/primitives";
import { Notice } from "@/components/workday-v2/primitives";
import type { Language } from "@/i18n/labels";
import { StatusBadge } from "@/product/status";
import { consoleSection, type ConsoleSectionId } from "./nav";
import { CONSOLE_COPY } from "./copy";

export function InPreparation({
  sectionId,
  language,
  existing,
}: {
  sectionId: ConsoleSectionId;
  language: Language;
  /** An existing page that already covers part of the section. */
  existing?: { href: string; label: { en: string; de: string } };
}) {
  const section = consoleSection(sectionId);
  const say = (pair: { en: string; de: string }) => (language === "de" ? pair.de : pair.en);

  return (
    <div className="app-stack app-stack-6" data-testid={`console-in-preparation-${sectionId}`}>
      <SettingsHead
        eyebrow={say(CONSOLE_COPY.eyebrow)}
        title={say(section.label)}
        lede={say(section.purpose)}
      />
      <SettingsSection
        title={say(CONSOLE_COPY.inPreparation)}
        trailing={
          <StatusBadge
            status="unavailable"
            language={language}
            detail={say(CONSOLE_COPY.inPreparationDetail)}
          />
        }
      >
        <div className="app-stack app-stack-3">
          <Notice>
            {say(CONSOLE_COPY.inPreparationDetail)} {say(CONSOLE_COPY.planSection)}{" "}
            {section.planSection}.
          </Notice>
          {existing ? (
            <span className="app-meta">
              {say(CONSOLE_COPY.existingPage)}{" "}
              <Link href={existing.href} className="app-source-link">
                {say(existing.label)}
              </Link>
            </span>
          ) : null}
        </div>
      </SettingsSection>
    </div>
  );
}

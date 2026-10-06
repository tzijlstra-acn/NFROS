/**
 * The page a Demo or Planned role shows instead of its work.
 *
 * The release gate (`src/workday/role-gate.ts`) renders this on every workday
 * route of a Demo role, under every interface version, inside the frame. A
 * Planned role never reaches it in normal use, because the gate redirects
 * before anything renders; it is kept for that case so a page reached without
 * the middleware still says the truth rather than rendering the role's work.
 *
 * It states three things and nothing else: the role's release state, word for
 * word from the registry; what the role is for, from the registry summary;
 * and which roles this release does include, so the reader has somewhere to
 * go. It claims no demonstration content of its own, because there is none to
 * show: inventing a sample day for a role the release does not include would
 * be exactly the theatre the release model exists to prevent.
 *
 * Colours come from the V3.3 tokens rather than literals, so the page passes
 * the same contrast check as the rest of the workday. It used to carry its own
 * grey, which failed it.
 *
 * Server component. No client-side state needed.
 */

import Link from "next/link";
import {
  ROLE_RELEASE_STATUS_LABELS,
  rolesWithReleaseStatus,
  type RoleReleaseDefinition,
} from "@/product/release";
import type { Language } from "@/i18n/labels";

const COPY = {
  demoBody: {
    en: "This role is shown as a demonstration. It is not part of the current two-role interactive release, so its work, processes and decisions cannot be opened or changed here.",
    de: "Diese Rolle wird als Demonstration gezeigt. Sie gehoert nicht zum aktuellen interaktiven Release mit zwei Rollen, daher koennen ihre Arbeit, Prozesse und Entscheidungen hier weder geoeffnet noch geaendert werden.",
  },
  plannedBody: {
    en: "This role is planned. It is not part of the current release and cannot be opened.",
    de: "Diese Rolle ist geplant. Sie gehoert nicht zum aktuellen Release und kann nicht geoeffnet werden.",
  },
  purpose: { en: "What this role is for", de: "Wofuer diese Rolle gedacht ist" },
  available: { en: "Available in this release", de: "In diesem Release verfuegbar" },
  choose: { en: "Choose an available role", de: "Verfuegbare Rolle waehlen" },
  presentation: { en: "View the presentation", de: "Praesentation ansehen" },
} as const;

function pick(pair: { en: string; de: string }, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

export function PreviewRolePage({
  role,
  language = "en",
  title = null,
}: {
  role: RoleReleaseDefinition;
  language?: Language;
  /**
   * The role's own title in the interface language, as the header shows it.
   * The registry's release label is English only, so a German page would
   * otherwise head itself in English under a German header.
   */
  title?: string | null;
}) {
  const status = ROLE_RELEASE_STATUS_LABELS[role.status];
  const summary = language === "de" && role.summaryDe.length > 0 ? role.summaryDe : role.summary;
  const available = rolesWithReleaseStatus("available").map((entry) => entry.releaseLabel);

  return (
    <div
      className="wd-main-inner"
      data-testid="role-release-gate"
      data-release-status={role.status}
      lang={language}
    >
      <div className="wd-stack-4" style={{ maxWidth: "62ch", paddingTop: "var(--wd-6)" }}>
        <span className="wd-chip" data-tone={role.status === "demo" ? "accent" : undefined} style={{ alignSelf: "flex-start" }}>
          {pick(status, language)}
        </span>

        <h1 className="wd-object-title">{title ?? role.releaseLabel}</h1>

        <p className="wd-now-reason" style={{ margin: 0 }}>
          {pick(role.status === "demo" ? COPY.demoBody : COPY.plannedBody, language)}
        </p>

        <div className="wd-stack-1">
          <span className="wd-meta">{pick(COPY.purpose, language)}</span>
          <p className="wd-secondary" style={{ margin: 0, fontSize: "var(--wd-text-sm)" }}>
            {summary}
          </p>
        </div>

        <div className="wd-stack-1">
          <span className="wd-meta">{pick(COPY.available, language)}</span>
          <p className="wd-secondary" style={{ margin: 0, fontSize: "var(--wd-text-sm)" }}>
            {available.join(", ")}
          </p>
        </div>

        <div className="wd-row wd-row-wrap" style={{ marginTop: "var(--wd-2)" }}>
          <Link href="/workday" className="wd-btn wd-btn-primary">
            {pick(COPY.choose, language)}
          </Link>
          <Link href="/story" className="wd-btn wd-btn-secondary">
            {pick(COPY.presentation, language)}
          </Link>
        </div>
      </div>
    </div>
  );
}

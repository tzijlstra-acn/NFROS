/**
 * A compact, live preview of one Role Operating System.
 *
 * Product proof without a screenshot. A screenshot is true on the day it is
 * taken and drifts from then on; this reads the role's current focus and its
 * active process stage from the scenario database on every request, so the
 * preview moves when the day moves. The stage track is drawn from the stage
 * run rows, so a stage is filled because the database records it complete.
 *
 * Server component. Two signals only, on purpose: the selector carries the
 * third (the next meeting), and the landing has to stay readable in five
 * seconds.
 */

import Link from "next/link";
import type { Language } from "@/i18n/labels";
import { ROLE_RELEASE_STATUS_LABELS, type RoleReleaseDefinition } from "@/product/release";
import { signalRowLabels, type RoleSignals } from "@/features/role-signals";
import { LANDING_COPY, say } from "./labels";

export function RolePreview({
  release,
  signals,
  language,
}: {
  release: RoleReleaseDefinition;
  signals: RoleSignals;
  language: Language;
}) {
  const rows = signalRowLabels(language);
  const title = `${release.releaseLabel} ${say(LANDING_COPY.osSuffix, language)}`;
  const href = release.defaultRoute ?? `/workday/${release.roleId}`;
  const titleId = `preview-${release.roleId}`;
  const { focus, process } = signals;
  const detail = [process.stageName, process.stageStatus].filter(Boolean).join(", ");

  return (
    <article
      className="nfr-preview"
      aria-labelledby={titleId}
      data-role={release.roleId}
      data-testid={`role-preview-${release.roleId}`}
    >
      <div className="nfr-preview-head">
        <h2 id={titleId} className="nfr-preview-title">
          {title}
        </h2>
        <span className="nfr-preview-status">{say(ROLE_RELEASE_STATUS_LABELS[release.status], language)}</span>
        <Link href={href} className="nfr-preview-open" aria-label={`${say(LANDING_COPY.open, language)}: ${title}`}>
          {say(LANDING_COPY.open, language)}
        </Link>
      </div>

      <dl className="nfr-preview-rows">
        <div className="nfr-preview-row" data-signal="focus" data-state={focus.state}>
          <dt className="nfr-preview-label">{rows.focus}</dt>
          <dd className="nfr-preview-value" data-state={focus.state} style={{ margin: 0 }}>
            {focus.value}
          </dd>
        </div>

        <div className="nfr-preview-row" data-signal="process" data-state={process.state}>
          <dt className="nfr-preview-label">{rows.process}</dt>
          <dd style={{ margin: 0, display: "grid", gap: 4, minWidth: 0 }}>
            <span className="nfr-preview-value" data-state={process.state}>
              {process.value}
            </span>
            {process.stages.length > 0 ? (
              <span
                className="nfr-stages"
                aria-hidden="true"
                style={{ gridTemplateColumns: `repeat(${process.stages.length}, minmax(0, 1fr))` }}
              >
                {process.stages.map((stage) => (
                  <span key={stage.id} className="nfr-stage" data-progress={stage.progress} title={stage.name} />
                ))}
              </span>
            ) : null}
            {detail.length > 0 ? <span className="nfr-preview-detail">{detail}</span> : null}
          </dd>
        </div>
      </dl>
    </article>
  );
}

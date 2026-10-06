/**
 * The product entrance.
 *
 * One audience: a risk professional or an executive seeing the product for
 * the first time. The page answers three questions in order and nothing else:
 * what is this, which role do I enter, and what can I do here. Runtime state
 * (AI mode, key state, verification, database state, setup and reset) is a
 * presenter's concern and lives in the control room, reached by the discreet
 * footer link.
 *
 * Composition follows the V2.4 cover so the presentation and the product read
 * as one family: eyebrow, short accent rule, headline and supporting line on
 * the left; the product itself on the right. Here the right-hand side is not
 * an illustration but the two Role Operating Systems as they stand in the
 * database right now.
 *
 * Server component. The route supplies the overview; this file reads nothing.
 */

import Link from "next/link";
import type { Language } from "@/i18n/labels";
import { formatScenarioDate, type RoleSignalOverview } from "@/features/role-signals";
import { RolePreview } from "./RolePreview";
import {
  fillTemplate,
  LANDING_COPY,
  PRODUCT_DESCRIPTOR,
  PRODUCT_NAME,
  say,
  TRUST_ITEMS,
} from "./labels";
import "./landing.css";

export interface LandingPageProps {
  overview: RoleSignalOverview;
  /**
   * The design-partner workspace route, or null when this build has none.
   *
   * Null renders the action disabled with its reason. The page never invents
   * a destination for it.
   */
  designPartnerHref: string | null;
}

export function LandingPage({ overview, designPartnerHref }: LandingPageProps) {
  const language: Language = overview.language;
  const source = overview.scenario
    ? fillTemplate(say(LANDING_COPY.proofSource, language), {
        date: formatScenarioDate(overview.scenario.date),
        moment: overview.scenario.moment,
      })
    : say(LANDING_COPY.proofUnavailable, language);

  return (
    <div className="workday-v3" lang={language}>
      <div className="nfr-landing">
        <header className="nfr-landing-header">
          <div className="nfr-landing-inner">
            <Link href="/" className="nfr-landing-wordmark">
              {PRODUCT_NAME}
            </Link>
            <span className="nfr-landing-synthetic">{say(LANDING_COPY.synthetic, language)}</span>
          </div>
        </header>

        <main id="main" className="nfr-landing-main">
          <div className="nfr-landing-inner">
            {/* ---- Proposition ---- */}
            <section aria-labelledby="landing-headline">
              <p className="nfr-landing-eyebrow">{say(PRODUCT_DESCRIPTOR, language)}</p>
              <hr className="nfr-landing-rule" aria-hidden="true" />
              <h1 id="landing-headline" className="nfr-landing-headline">
                {say(LANDING_COPY.headline, language)}
              </h1>
              <p className="nfr-landing-supporting">
                {fillTemplate(say(LANDING_COPY.supporting, language), { product: PRODUCT_NAME })}
              </p>

              <div className="nfr-landing-actions">
                <Link href="/workday" className="nfr-btn nfr-btn-primary">
                  {say(LANDING_COPY.explore, language)}
                </Link>
                <Link href="/story" className="nfr-btn nfr-btn-secondary">
                  {say(LANDING_COPY.presentation, language)}
                </Link>
              </div>

              <div className="nfr-landing-secondary-action">
                {designPartnerHref !== null ? (
                  <Link href={designPartnerHref} className="nfr-btn nfr-btn-secondary">
                    {say(LANDING_COPY.designPartner, language)}
                  </Link>
                ) : (
                  <>
                    <button
                      type="button"
                      className="nfr-btn nfr-btn-quiet"
                      disabled
                      aria-describedby="design-partner-reason"
                    >
                      {say(LANDING_COPY.designPartner, language)}
                    </button>
                    <span id="design-partner-reason" className="nfr-landing-reason">
                      {say(LANDING_COPY.designPartnerUnavailable, language)}
                    </span>
                  </>
                )}
              </div>
            </section>

            {/* ---- Product proof ---- */}
            <section className="nfr-proof" aria-labelledby="landing-proof">
              <div className="nfr-proof-head">
                <p id="landing-proof" className="nfr-proof-label">
                  {say(LANDING_COPY.proofLabel, language)}
                </p>
                <span className="nfr-proof-source" data-testid="landing-proof-source">
                  {source}
                </span>
              </div>
              {overview.available.length === 0 ? (
                <p className="nfr-landing-reason">{say(LANDING_COPY.proofEmpty, language)}</p>
              ) : (
                overview.available.map((role) => (
                  <RolePreview
                    key={role.release.roleId}
                    release={role.release}
                    signals={role.signals}
                    language={language}
                  />
                ))
              )}
            </section>
          </div>
        </main>

        <section className="nfr-trust" aria-label={say(LANDING_COPY.trustLabel, language)}>
          <ul className="nfr-landing-inner" data-testid="trust-strip">
            {TRUST_ITEMS.map((item) => (
              <li key={item.en}>{say(item, language)}</li>
            ))}
          </ul>
        </section>

        <footer className="nfr-landing-footer">
          <div className="nfr-landing-inner">
            <p>{say(LANDING_COPY.disclosure, language)}</p>
            <span>
              {say(LANDING_COPY.presenters, language)}{" "}
              <Link href="/control-room">{say(LANDING_COPY.controlRoom, language)}</Link>
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}

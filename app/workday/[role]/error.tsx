"use client";

/**
 * The workday error boundary.
 *
 * It replaces the MAIN REGION only. The header, the navigation and the bottom
 * bar come from the layout and stay on screen, which is the requirement: a
 * failure in the workspace must not collapse the application into a blank
 * page.
 *
 * It shows what failed in plain language, offers a retry and offers a way
 * home. It deliberately does NOT render the error message or the stack: a
 * digest is enough for a reviewer to correlate with the server log, and a
 * stack trace on screen would be both unhelpful to an analyst and a disclosure
 * risk in a product holding risk content.
 */

import { useEffect } from "react";
import Link from "next/link";
import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";

export default function WorkdayError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    /*
     * Reported through the console only, with the digest rather than the
     * message. The header telemetry hook records the fallback separately;
     * this is the workspace, not the header.
     */
    console.error("The workday workspace failed to render.", { digest: error.digest });
  }, [error.digest]);

  return (
    <div className="wd-main-inner">
      <div className="wd-stack-4" style={{ maxWidth: 560 }}>
        <span className="wd-row">
          <IconAlertTriangle size={20} stroke={1.8} aria-hidden="true" />
          <h1 className="wd-page-title">This workspace could not load</h1>
        </span>

        <p className="wd-context-line">
          The rest of the application is working. Retrying usually resolves it, and the
          navigation above still takes you anywhere else.
        </p>

        <div className="wd-row">
          <button type="button" className="wd-btn wd-btn-primary" onClick={reset}>
            <IconRefresh size={16} stroke={1.9} aria-hidden="true" />
            Try again
          </button>
          <Link href="/workday" className="wd-btn wd-btn-secondary">
            Choose a role
          </Link>
        </div>

        {error.digest ? (
          <span className="wd-meta">
            Reference <span className="wd-mono">{error.digest}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

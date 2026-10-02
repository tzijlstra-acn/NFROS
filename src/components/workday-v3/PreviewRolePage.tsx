/**
 * Preview role page.
 *
 * Shown when a user navigates directly to a preview-role URL. It is a
 * standalone light page with no navigation rail, explaining that the role
 * is not part of the current two-role interactive release and pointing
 * toward the flagship roles and the presentation.
 *
 * Server component. No client-side state needed.
 */

import Link from "next/link";
import type { RoleReleaseDefinition } from "@/product/release/role-release";

export function PreviewRolePage({ role }: { role: RoleReleaseDefinition }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        padding: "var(--wd-12, 48px) var(--wd-6, 24px)",
        textAlign: "center",
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: "rgb(122 132 153)",
          letterSpacing: "0.01em",
        }}
      >
        Preview role
      </span>

      <h1
        style={{
          margin: 0,
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: "-0.012em",
          color: "rgb(23 32 51)",
        }}
      >
        {role.releaseLabel}
      </h1>

      <p
        style={{
          margin: 0,
          fontSize: 14,
          color: "rgb(84 95 118)",
          maxWidth: "52ch",
          lineHeight: 1.55,
        }}
      >
        This role is not part of the current two-role interactive release.
      </p>

      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: "rgb(122 132 153)",
          maxWidth: "52ch",
          lineHeight: 1.55,
        }}
      >
        Available in this release: Operational Risk Partner, Third-Party Risk Manager
      </p>

      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 8,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <Link
          href="/workday"
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 34,
            padding: "0 16px",
            borderRadius: 6,
            background: "rgb(91 79 242)",
            color: "rgb(255 255 255)",
            fontSize: 14,
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Choose a flagship role
        </Link>
        <Link
          href="/story"
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 34,
            padding: "0 16px",
            borderRadius: 6,
            border: "1px solid rgb(214 219 228)",
            background: "rgb(255 255 255)",
            color: "rgb(23 32 51)",
            fontSize: 14,
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          View presentation
        </Link>
      </div>

      <span
        style={{
          fontSize: 12,
          color: "rgb(122 132 153)",
          marginTop: 8,
        }}
      >
        Synthetic institution and data
      </span>
    </div>
  );
}

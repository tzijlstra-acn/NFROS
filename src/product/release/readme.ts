/**
 * The README release block, rendered from the release registry.
 *
 * A Markdown file cannot import a module, so the README's release section is
 * generated: `scripts/sync-release-readme.ts` writes this rendering between
 * the heading and the closing line below, and
 * `tests/unit/product-release.test.ts` fails when the README holds anything
 * else. Changing the release means changing the registry and running the
 * script, never editing the README section by hand.
 *
 * English only, like the rest of the README.
 */

import {
  KNOWN_LIMITATIONS,
  LIMITATION_STATUS_LABELS,
  PRODUCT_IDENTITY,
  PRODUCT_RELEASE,
  RELEASE_COMPONENTS,
  RELEASE_STAGE_LABELS,
  ROLE_APP_STATUS_LABELS,
  ROLE_RELEASE_STATUS_LABELS,
  ROLE_RELEASE_STATUS_ORDER,
  INSTALLED_ROLE_APPS,
  PREVIEW_ROLE_APPS,
  rolesWithReleaseStatus,
} from "./product-release";
import { getRoleRelease } from "./role-release";

/** The first line of the generated block. */
export const README_RELEASE_START = "## Release";

/** The last line of the generated block. */
export const README_RELEASE_END =
  "_This section is generated from `src/product/release`. After changing the registry, run `npx tsx scripts/sync-release-readme.ts`._";

export function renderReleaseMarkdown(): string {
  const stage = RELEASE_STAGE_LABELS[PRODUCT_RELEASE.stage].en.toLowerCase();
  const lines: string[] = [
    README_RELEASE_START,
    "",
    "| | |",
    "|---|---|",
    `| Product | ${PRODUCT_IDENTITY.name}, ${PRODUCT_IDENTITY.descriptor.en} |`,
    `| Product release | ${PRODUCT_RELEASE.version}, ${PRODUCT_RELEASE.name.en} (${stage}, ${PRODUCT_RELEASE.date}) |`,
    ...RELEASE_COMPONENTS.map(
      (component) => `| ${component.name.en} | ${component.version}, \`${component.route}\` |`,
    ),
    "",
    PRODUCT_RELEASE.summary.en,
    "",
    "Role release states:",
    "",
    "| State | Roles |",
    "|---|---|",
    ...ROLE_RELEASE_STATUS_ORDER.map((status) => {
      const roles = rolesWithReleaseStatus(status).map((role) => role.releaseLabel);
      return `| ${ROLE_RELEASE_STATUS_LABELS[status].en} | ${roles.length > 0 ? roles.join(", ") : "None"} |`;
    }),
    "",
    "Role Apps:",
    "",
    "| Role App | Role | State | Version | Route |",
    "|---|---|---|---|---|",
    ...[...INSTALLED_ROLE_APPS, ...PREVIEW_ROLE_APPS].map(
      (app) =>
        `| ${app.name.en} | ${getRoleRelease(app.roleId)?.releaseLabel ?? app.roleId} | ${ROLE_APP_STATUS_LABELS[app.status].en} | ${app.version} | ${app.entryRoute ? `\`${app.entryRoute}\`` : "Not routed"} |`,
    ),
    "",
    "Known limitations:",
    "",
    ...KNOWN_LIMITATIONS.map(
      (limitation, index) =>
        `${index + 1}. **${limitation.title.en}.** ${limitation.detail.en} State: ${LIMITATION_STATUS_LABELS[limitation.status].en.toLowerCase()}. See \`${limitation.reference}\`.`,
    ),
    "",
    README_RELEASE_END,
  ];
  return lines.join("\n");
}

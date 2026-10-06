/**
 * Compare versions (plan 7.2): two Role App release records, field by field.
 *
 * Each version holds the manifest of the reviewed definition it was released
 * from, so two versions can be compared without reading code that has since
 * moved on. The comparison says what differs and, for lists, what was added
 * and removed; it never infers a behaviour change the manifest does not show.
 *
 * Pure: two rows in, rows out. Client safe.
 */

import type { RoleAppVersion } from "@/db/repositories/role-app-release";
import type { Bilingual } from "../permissions";
import { LIFECYCLE_STATE_LABELS, SUPPORT_STATE_LABELS } from "./labels";

export interface VersionComparisonRow {
  key: string;
  label: Bilingual;
  left: string;
  right: string;
  changed: boolean;
  added: string[];
  removed: string[];
}

function listDiff(left: readonly string[], right: readonly string[]): { added: string[]; removed: string[] } {
  const a = new Set(left);
  const b = new Set(right);
  return {
    added: [...b].filter((value) => !a.has(value)).sort(),
    removed: [...a].filter((value) => !b.has(value)).sort(),
  };
}

function listRow(key: string, label: Bilingual, left: readonly string[], right: readonly string[]): VersionComparisonRow {
  const { added, removed } = listDiff(left, right);
  return {
    key,
    label,
    left: left.length > 0 ? `${left.length}` : "0",
    right: right.length > 0 ? `${right.length}` : "0",
    changed: added.length > 0 || removed.length > 0,
    added,
    removed,
  };
}

function valueRow(key: string, label: Bilingual, left: string, right: string): VersionComparisonRow {
  return { key, label, left, right, changed: left !== right, added: [], removed: [] };
}

/** Compares two versions of one app. The language picks the state words. */
export function compareRoleAppVersions(
  left: RoleAppVersion,
  right: RoleAppVersion,
  language: "en" | "de",
): VersionComparisonRow[] {
  const say = (pair: Bilingual) => (language === "de" ? pair.de : pair.en);
  const sources = (version: RoleAppVersion) =>
    version.sourceRequirements.map((source) => `${source.stageId}/${source.key} (${source.necessity})`);

  return [
    valueRow("version", { en: "Version", de: "Version" }, left.version, right.version),
    valueRow(
      "state",
      { en: "Lifecycle state", de: "Lebenszyklus" },
      say(LIFECYCLE_STATE_LABELS[left.lifecycleState]),
      say(LIFECYCLE_STATE_LABELS[right.lifecycleState]),
    ),
    valueRow(
      "digest",
      { en: "Process definition digest", de: "Digest der Prozessdefinition" },
      left.processDefinitionDigest ?? "-",
      right.processDefinitionDigest ?? "-",
    ),
    listRow("stages", { en: "Process stages", de: "Prozessstufen" }, left.processStageIds, right.processStageIds),
    listRow(
      "implemented",
      { en: "Stages that run end to end", de: "Vollstaendig ausfuehrbare Stufen" },
      left.implementedStageIds,
      right.implementedStageIds,
    ),
    listRow("sources", { en: "Source requirements", de: "Quellenanforderungen" }, sources(left), sources(right)),
    listRow("tools", { en: "Tools", de: "Werkzeuge" }, left.tools, right.tools),
    listRow(
      "approval-tools",
      { en: "Tools that need an approval", de: "Werkzeuge mit Genehmigungspflicht" },
      left.authority.approvalTools,
      right.authority.approvalTools,
    ),
    listRow(
      "human-decisions",
      { en: "Judgments that stay human", de: "Beurteilungen, die beim Menschen bleiben" },
      left.authority.humanDecisionKinds,
      right.authority.humanDecisionKinds,
    ),
    listRow(
      "configurations",
      { en: "AI configurations", de: "KI-Konfigurationen" },
      left.evaluations.configurationIds,
      right.evaluations.configurationIds,
    ),
    listRow(
      "suites",
      { en: "Evaluation suites", de: "Evaluationssuiten" },
      left.evaluations.evaluationSuiteIds,
      right.evaluations.evaluationSuiteIds,
    ),
    listRow(
      "connectors",
      { en: "Connector dependencies", de: "Konnektorabhaengigkeiten" },
      left.connectorDependencies,
      right.connectorDependencies,
    ),
    valueRow("migration", { en: "Recorded against migration", de: "Erfasst gegen Migration" }, left.migrationTag ?? "-", right.migrationTag ?? "-"),
    valueRow(
      "support",
      { en: "Support state", de: "Support-Zustand" },
      say(SUPPORT_STATE_LABELS[left.supportState]),
      say(SUPPORT_STATE_LABELS[right.supportState]),
    ),
    valueRow(
      "notes",
      { en: "Release notes", de: "Release-Hinweise" },
      language === "de" ? left.releaseNotesDe || left.releaseNotes : left.releaseNotes,
      language === "de" ? right.releaseNotesDe || right.releaseNotes : right.releaseNotes,
    ),
  ];
}

/** Whether the two versions run the same reviewed definition. */
export function sameDefinition(left: RoleAppVersion, right: RoleAppVersion): boolean {
  return left.processDefinitionDigest !== null && left.processDefinitionDigest === right.processDefinitionDigest;
}

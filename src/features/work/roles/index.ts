/**
 * Role configuration lookup.
 *
 * Only the two Available roles have a Work Hub. A demo or planned role
 * resolves to null, and the route shows the preview page for it rather than a
 * partially configured hub, which is the same rule the role home applies.
 */

import { OPERATIONAL_RISK_WORK } from "./operational-risk";
import { THIRD_PARTY_RISK_WORK } from "./third-party-risk";
import type { WorkRoleConfig } from "./types";

export type { WorkRoleConfig } from "./types";

const CONFIGS: Readonly<Record<string, WorkRoleConfig>> = {
  rcsa: OPERATIONAL_RISK_WORK,
  tprm: THIRD_PARTY_RISK_WORK,
};

export function getWorkRoleConfig(roleId: string): WorkRoleConfig | null {
  return CONFIGS[roleId] ?? null;
}

export function workRoleIds(): string[] {
  return Object.keys(CONFIGS);
}

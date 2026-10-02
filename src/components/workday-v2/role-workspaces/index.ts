/**
 * The role to workspace map, and the one props type they all share.
 *
 * Six components, one signature. The shell looks the acting role up here and
 * renders whatever it finds, which is what lets a role switch change the
 * centre of the screen without the shell knowing anything about a supplier
 * constellation or a population field.
 *
 * A note on chunking. Importing this module pulls all six workspaces and with
 * them all six visualisations, which is several thousand lines. That is the
 * right trade for a caller that genuinely needs the table, for example a test
 * that walks every role. A caller that renders one workspace for one role
 * should import that one file directly behind `next/dynamic`, which is what
 * `RoleWorkObject` does, so the per role chunk boundary survives.
 *
 * Each workspace also lazily loads its own visualisation, so even the direct
 * import defers the heaviest part until the surrounding shell has painted.
 */

import type { ComponentType } from "react";
import type { AutonomyLevel, RoleId } from "@/db/schema/core";
import type { Language } from "@/i18n/labels";
import type {
  AISuggestionView,
  SourceAttribution,
  WorkdayLiveEvent,
  WorkdaySelection,
} from "@/workday/contracts";
import type { RoleWorkspaceView } from "@/db/repositories/workspace";
import { RcsaWorkspace } from "./RcsaWorkspace";
import { TprmWorkspace } from "./TprmWorkspace";
import { ControlAssuranceWorkspace } from "./ControlAssuranceWorkspace";
import { IncidentResilienceWorkspace } from "./IncidentResilienceWorkspace";
import { RegulatoryChangeWorkspace } from "./RegulatoryChangeWorkspace";
import { NfrGovernanceWorkspace } from "./NfrGovernanceWorkspace";

/**
 * The scenario state a workspace labels with.
 *
 * Deliberately a narrow copy rather than the engine's `ScenarioState`. A
 * workspace needs to know what time it is, which world view is showing and
 * whether the shared event has happened; it has no business holding the run
 * identifier or the active role, because it must never be the thing that
 * decides either.
 */
export interface WorkspaceScenario {
  /** Live scenario time. */
  currentMoment: string;
  /** The moment being viewed, which may be earlier than live. */
  viewedMoment: string;
  worldView: "today" | "future";
  autonomyLevel: AutonomyLevel;
  eventTriggered: boolean;
  scenarioDate: string;
}

/**
 * What every workspace accepts.
 *
 * `view` is built on the server by `buildRoleWorkspace` and passed down. It is
 * optional in the type and required in practice: these components are client
 * components, because a graph node click has to change the selection without a
 * round trip, and a client component cannot query the database. When it is
 * absent the workspace renders an empty state naming the reason rather than
 * failing, so a half wired shell degrades visibly instead of crashing.
 *
 * `onSelect` and `onAskAi` are optional for a structural reason rather than a
 * stylistic one: a function cannot cross a server to client boundary, so a
 * workspace reached from a server component gets both from context instead,
 * through `useSelection` and `useAskAi`. The props exist for a client parent
 * that already holds the callbacks and prefers to pass them.
 */
export interface RoleWorkspaceProps {
  roleId: RoleId;
  language: Language;
  currentMoment: string;
  /** True when rendered inside Today rather than on the workbench. */
  compact?: boolean;
  selection?: WorkdaySelection | null;
  /** Overrides `view.changedIds` when the shell has computed its own answer. */
  changedObjectIds?: string[];
  sources?: SourceAttribution[];
  /** Built on the server by `buildRoleWorkspace`. See the note above. */
  view?: RoleWorkspaceView;
  /** The role's live events at this moment, newest last. */
  events?: WorkdayLiveEvent[];
  /** The role's active suggestion, when one is ready. */
  suggestion?: AISuggestionView | null;
  scenario?: WorkspaceScenario;
  onSelect?: (selection: WorkdaySelection | null) => void;
  onAskAi?: (prompt: string, selection: WorkdaySelection | null) => void;
}

export const ROLE_WORKSPACES: Record<RoleId, ComponentType<RoleWorkspaceProps>> = {
  rcsa: RcsaWorkspace,
  tprm: TprmWorkspace,
  "control-assurance": ControlAssuranceWorkspace,
  "incident-resilience": IncidentResilienceWorkspace,
  "regulatory-change": RegulatoryChangeWorkspace,
  "nfr-governance": NfrGovernanceWorkspace,
};

export {
  RcsaWorkspace,
  TprmWorkspace,
  ControlAssuranceWorkspace,
  IncidentResilienceWorkspace,
  RegulatoryChangeWorkspace,
  NfrGovernanceWorkspace,
};

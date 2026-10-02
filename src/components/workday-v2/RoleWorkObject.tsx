/**
 * Selects the work object for the acting role.
 *
 * One wrapper, one lookup, one lazy boundary per role. The six workspaces
 * compose visualisations running to several thousand lines between them, and
 * loading all six to render one is the kind of waste that only shows up on a
 * projector at a client site.
 *
 * The props type and the component set are owned by
 * `role-workspaces/index.ts`. This file imports the type only, and reaches
 * each component through its own dynamic import, because importing the index
 * itself would pull all six and defeat the point.
 *
 * The lazy boundary is also what keeps the shell honest about the order it
 * paints in: the shell and the focus queue are server rendered and present
 * immediately, and the heavy work object arrives after, with a skeleton
 * holding its space so nothing jumps under a cursor.
 */

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { RoleId } from "@/db/schema/core";
import { buildRoleWorkspace } from "@/db/repositories/workspace";
import type { RoleWorkspaceProps } from "./role-workspaces/index";
import { SkeletonRows } from "./primitives";

export type { RoleWorkspaceProps };

/**
 * The placeholder shown while a workspace loads.
 *
 * It reserves a realistic height for a graph or a service map rather than
 * collapsing to nothing, because a container that grows from zero to six
 * hundred pixels after the queue has already rendered moves the whole page
 * under the reader.
 */
function WorkspaceSkeleton() {
  return (
    <div className="app-stack-3" aria-hidden="true">
      <div className="app-skeleton" style={{ height: 18, width: 200 }} />
      <div className="app-skeleton" style={{ height: 420, borderRadius: "var(--app-radius-lg)" }} />
      <SkeletonRows rows={3} />
    </div>
  );
}

/*
 * The options object is written out at each call site rather than shared in a
 * constant. `next/dynamic` is statically analysed by the bundler and requires
 * an inline object literal; a shared constant compiles under the type checker
 * and then fails at build time with "next/dynamic options must be an object
 * literal", which is a confusing error to meet for the first time in a dev
 * server log. The repetition is the price of the analysis.
 */
const WORKSPACES: Record<RoleId, ComponentType<RoleWorkspaceProps>> = {
  rcsa: dynamic(
    () => import("./role-workspaces/RcsaWorkspace").then((module) => module.RcsaWorkspace),
    { loading: WorkspaceSkeleton },
  ),
  tprm: dynamic(
    () => import("./role-workspaces/TprmWorkspace").then((module) => module.TprmWorkspace),
    { loading: WorkspaceSkeleton },
  ),
  "control-assurance": dynamic(
    () =>
      import("./role-workspaces/ControlAssuranceWorkspace").then(
        (module) => module.ControlAssuranceWorkspace,
      ),
    { loading: WorkspaceSkeleton },
  ),
  "incident-resilience": dynamic(
    () =>
      import("./role-workspaces/IncidentResilienceWorkspace").then(
        (module) => module.IncidentResilienceWorkspace,
      ),
    { loading: WorkspaceSkeleton },
  ),
  "regulatory-change": dynamic(
    () =>
      import("./role-workspaces/RegulatoryChangeWorkspace").then(
        (module) => module.RegulatoryChangeWorkspace,
      ),
    { loading: WorkspaceSkeleton },
  ),
  "nfr-governance": dynamic(
    () =>
      import("./role-workspaces/NfrGovernanceWorkspace").then(
        (module) => module.NfrGovernanceWorkspace,
      ),
    { loading: WorkspaceSkeleton },
  ),
};

/**
 * Renders the role workspace, building its view model when the caller did not.
 *
 * The workspaces are client components, because a graph node click has to
 * change the selection without a round trip, and a client component cannot
 * query the database. This wrapper is a server component, so it is the right
 * place for the fallback. Without a view each workspace renders a named empty
 * state rather than failing, which is correct but is not what a wired route
 * should show.
 */
export function RoleWorkObject(props: RoleWorkspaceProps) {
  const Workspace = WORKSPACES[props.roleId];
  const view =
    props.view ??
    buildRoleWorkspace({
      roleId: props.roleId,
      atMoment: props.currentMoment,
      language: props.language,
    });
  return <Workspace {...props} view={view} />;
}

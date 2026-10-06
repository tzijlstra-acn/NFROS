/**
 * RCSA Cycle Assistant, V3.4.
 *
 * A thin route. It resolves the role, the selected run (`?run=`) and the
 * selected stage (`?stage=`) from the URL and renders the shared process
 * page, which reads everything from the process engine
 * (`src/features/process`), with the RCSA portfolio of assessment runs above
 * the stage map. No stage rule, AI preparation text or artifact lives here.
 *
 * Synthetic institution and data.
 */

import { notFound } from "next/navigation";
import { ProcessRunPage } from "@/features/process/ProcessRunPage";
import { RcsaPortfolio } from "@/features/process/rcsa/RcsaPortfolio";
import { RoleAppGate } from "@/features/product/role-apps/DisabledRoleApp";
import type { RouteQuery } from "@/workday/dispatch";

export const dynamic = "force-dynamic";

const BASE_PATH = "/workday/rcsa/processes/rcsa-cycle";

export default async function RcsaCycleV3({
  params,
  searchParams,
}: {
  params: Promise<{ role: string }>;
  searchParams?: RouteQuery;
}) {
  const { role } = await params;
  if (role !== "rcsa") notFound();

  const stage = Array.isArray(searchParams?.stage) ? searchParams.stage[0] : searchParams?.stage;
  const run = Array.isArray(searchParams?.run) ? searchParams.run[0] : searchParams?.run;

  /* A Role App the product owner disabled or retired shows its disabled state instead (src/role-apps/enablement.ts). */
  return (
    <RoleAppGate roleAppId="rcsa-cycle-assistant" title={{ en: "RCSA Cycle Assistant", de: "RCSA-Zyklus-Assistent" }}>
      <ProcessRunPage
        roleId="rcsa"
        roleAppId="rcsa-cycle-assistant"
        title={{ en: "RCSA Cycle Assistant", de: "RCSA-Zyklus-Assistent" }}
        basePath={BASE_PATH}
        stageParam={stage}
        runParam={run}
        renderHeader={(processRunId, language) => <RcsaPortfolio processRunId={processRunId} language={language} basePath={BASE_PATH} />}
      />
    </RoleAppGate>
  );
}

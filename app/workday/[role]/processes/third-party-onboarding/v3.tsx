/**
 * Third-Party Onboarding, V3.4.
 *
 * A thin route. It resolves the role, the selected onboarding file (`?run=`)
 * and the selected stage (`?stage=`) from the URL and renders the shared
 * process page, which reads everything from the process engine
 * (`src/features/process`), with the onboarding pipeline above the stage map.
 * No stage rule, AI preparation text, evidence status rule or artifact lives
 * here.
 *
 * Synthetic institution and data.
 */

import { notFound } from "next/navigation";
import { ProcessRunPage } from "@/features/process/ProcessRunPage";
import { OnboardingPipeline } from "@/features/process/tprm/OnboardingPipeline";
import { RoleAppGate } from "@/features/product/role-apps/DisabledRoleApp";
import type { RouteQuery } from "@/workday/dispatch";

export const dynamic = "force-dynamic";

const BASE_PATH = "/workday/tprm/processes/third-party-onboarding";

export default async function ThirdPartyOnboardingV3({
  params,
  searchParams,
}: {
  params: Promise<{ role: string }>;
  searchParams?: RouteQuery;
}) {
  const { role } = await params;
  if (role !== "tprm") notFound();

  const stage = Array.isArray(searchParams?.stage) ? searchParams.stage[0] : searchParams?.stage;
  const run = Array.isArray(searchParams?.run) ? searchParams.run[0] : searchParams?.run;

  /* A Role App the product owner disabled or retired shows its disabled state instead (src/role-apps/enablement.ts). */
  return (
    <RoleAppGate roleAppId="tprm-third-party-onboarding" title={{ en: "Third-Party Onboarding", de: "Drittparteien-Onboarding" }}>
      <ProcessRunPage
        roleId="tprm"
        roleAppId="tprm-third-party-onboarding"
        title={{ en: "Third-Party Onboarding", de: "Drittparteien-Onboarding" }}
        basePath={BASE_PATH}
        stageParam={stage}
        runParam={run}
        renderHeader={(processRunId, language) => <OnboardingPipeline processRunId={processRunId} language={language} basePath={BASE_PATH} />}
      />
    </RoleAppGate>
  );
}

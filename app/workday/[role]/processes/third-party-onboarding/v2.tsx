/**
 * Third-Party Onboarding: V2 stub.
 *
 * Minimal placeholder so the dispatcher has something to render on the
 * V2 path. The V2 implementation does not have live process content.
 *
 * Synthetic institution and data.
 */

import { getScenarioState } from "@/scenario/engine/state";
import { SectionStub } from "@/components/workday-v3/SectionStub";
import type { Language } from "@/i18n/labels";

const TITLE = { en: "Third-Party Onboarding", de: "Drittanbieter-Onboarding" };
const DESC = {
  en: "Manages the intake, due diligence and approval workflow for new third-party arrangements.",
  de: "Verwaltet den Eingang, die Sorgfaltspruefung und den Genehmigungsworkflow fuer neue Drittanbietervereinbarungen.",
};

export default async function ThirdPartyOnboardingV2({
  searchParams: _searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const state = getScenarioState();
  const language = (state?.language ?? "en") as Language;
  return <SectionStub title={TITLE} description={DESC} language={language} />;
}

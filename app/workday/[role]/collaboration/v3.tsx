import { getScenarioState } from "@/scenario/engine/state";
import { SectionStub } from "@/components/workday-v3/SectionStub";
import type { Language } from "@/i18n/labels";

const TITLE = { en: "Collaboration", de: "Zusammenarbeit" };
const DESC = {
  en: "Shared threads, evidence requests and cross-role actions.",
  de: "Gemeinsame Threads, Nachweisanfragen und rollenuebergreifende Massnahmen.",
};

export default async function CollaborationV3() {
  const state = getScenarioState();
  const language = (state?.language ?? "en") as Language;
  return <SectionStub title={TITLE} description={DESC} language={language} />;
}

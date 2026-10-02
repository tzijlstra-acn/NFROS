import { getScenarioState } from "@/scenario/engine/state";
import { SectionStub } from "@/components/workday-v3/SectionStub";
import type { Language } from "@/i18n/labels";

const TITLE = { en: "Workbench", de: "Arbeitsbereich" };
const DESC = {
  en: "Your active risk objects, controls and assessments in one view.",
  de: "Ihre aktiven Risikobjekte, Kontrollen und Bewertungen in einer Ansicht.",
};

export default async function WorkbenchV3() {
  const state = getScenarioState();
  const language = (state?.language ?? "en") as Language;
  return <SectionStub title={TITLE} description={DESC} language={language} />;
}

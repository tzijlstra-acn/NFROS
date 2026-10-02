import { getScenarioState } from "@/scenario/engine/state";
import { SectionStub } from "@/components/workday-v3/SectionStub";
import type { Language } from "@/i18n/labels";

const TITLE = { en: "Assistant", de: "Assistent" };
const DESC = {
  en: "AI-assisted drafts, summaries and prepared work for your review.",
  de: "KI-gestuetzte Entwuerfe, Zusammenfassungen und vorbereitete Arbeiten zur Pruefung.",
};

export default async function AssistantV3() {
  const state = getScenarioState();
  const language = (state?.language ?? "en") as Language;
  return <SectionStub title={TITLE} description={DESC} language={language} />;
}

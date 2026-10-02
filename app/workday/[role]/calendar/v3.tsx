import { getScenarioState } from "@/scenario/engine/state";
import { SectionStub } from "@/components/workday-v3/SectionStub";
import type { Language } from "@/i18n/labels";

const TITLE = { en: "Calendar", de: "Kalender" };
const DESC = {
  en: "Deadlines, review cycles and scheduled work for your role.",
  de: "Fristen, Pruefdurchlaeufe und geplante Aufgaben fuer Ihre Rolle.",
};

export default async function CalendarV3() {
  const state = getScenarioState();
  const language = (state?.language ?? "en") as Language;
  return <SectionStub title={TITLE} description={DESC} language={language} />;
}

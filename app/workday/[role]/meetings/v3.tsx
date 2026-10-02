import { getScenarioState } from "@/scenario/engine/state";
import { SectionStub } from "@/components/workday-v3/SectionStub";
import type { Language } from "@/i18n/labels";

const TITLE = { en: "Meetings", de: "Sitzungen" };
const DESC = {
  en: "Committee meetings, agenda items and minutes relevant to your role.",
  de: "Ausschusssitzungen, Tagesordnungspunkte und Protokolle fuer Ihre Rolle.",
};

export default async function MeetingsV3() {
  const state = getScenarioState();
  const language = (state?.language ?? "en") as Language;
  return <SectionStub title={TITLE} description={DESC} language={language} />;
}

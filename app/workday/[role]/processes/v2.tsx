/**
 * Processes: V2 stub.
 *
 * Minimal placeholder so the dispatcher has something to render on the
 * V2 path. The route exists; the V2 implementation does not have role-specific
 * process content yet.
 */

import { getScenarioState } from "@/scenario/engine/state";
import { SectionStub } from "@/components/workday-v3/SectionStub";
import type { Language } from "@/i18n/labels";

const TITLE = { en: "Processes", de: "Prozesse" };
const DESC = {
  en: "Role-specific process work and installed process apps.",
  de: "Rollenspezifische Prozessarbeit und installierte Prozess-Apps.",
};

export default async function ProcessesV2() {
  const state = getScenarioState();
  const language = (state?.language ?? "en") as Language;
  return <SectionStub title={TITLE} description={DESC} language={language} />;
}

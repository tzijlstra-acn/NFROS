/**
 * Work Hub: V2 stub.
 *
 * Minimal placeholder so the dispatcher has something to render on the
 * V2 path. The route exists; the V2 implementation does not have a
 * role-specific work surface yet.
 */

import { getScenarioState } from "@/scenario/engine/state";
import { SectionStub } from "@/components/workday-v3/SectionStub";
import type { Language } from "@/i18n/labels";

const TITLE = { en: "Work", de: "Arbeit" };
const DESC = {
  en: "Your day: agenda, meetings, actions and inbox.",
  de: "Ihr Tag: Agenda, Besprechungen, Massnahmen und Posteingang.",
};

export default async function WorkV2() {
  const state = getScenarioState();
  const language = (state?.language ?? "en") as Language;
  return <SectionStub title={TITLE} description={DESC} language={language} />;
}

/**
 * RCSA Cycle Assistant, V1.
 *
 * Stub. Returns 200 so navigation does not 404. The V3 frame is inherited
 * from the [role] layout; this supplies the main region only.
 */

import { getScenarioState } from "@/scenario/engine/state";
import { SectionStub } from "@/components/workday-v3/SectionStub";
import type { Language } from "@/i18n/labels";

export const dynamic = "force-dynamic";

const TITLE = { en: "RCSA Cycle Assistant", de: "RCSA-Zyklus-Assistent" };
const DESC = {
  en: "Guides the Operational Risk Partner through the risk and control self-assessment cycle.",
  de: "Fuehrt den Operational Risk Partner durch den Risiko- und Kontrollselbstbewertungszyklus.",
};

export default async function RcsaCycleV1() {
  const state = getScenarioState();
  const language = (state?.language ?? "en") as Language;
  return <SectionStub title={TITLE} description={DESC} language={language} />;
}

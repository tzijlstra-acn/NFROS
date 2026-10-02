import { getScenarioState } from "@/scenario/engine/state";
import { SectionStub } from "@/components/workday-v3/SectionStub";
import type { Language } from "@/i18n/labels";

const TITLE = { en: "Mail", de: "Post" };
const DESC = {
  en: "Notifications, approvals and messages routed to your role.",
  de: "Benachrichtigungen, Genehmigungen und Nachrichten fuer Ihre Rolle.",
};

export default async function MailV3() {
  const state = getScenarioState();
  const language = (state?.language ?? "en") as Language;
  return <SectionStub title={TITLE} description={DESC} language={language} />;
}

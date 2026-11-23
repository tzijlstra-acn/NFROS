/**
 * The server half of the entry: theme, language and tenant, read once.
 *
 * Shared by `/` (startup, then sign-in) and `/login` (sign-in only). The
 * theme follows the workday's own cookie so a reader who chose dark does not
 * get a light sign-in and then a dark workspace. The tenant line is the
 * active brand profile's client name.
 */

import { cookies } from "next/headers";
import { THEME_COOKIE } from "@/components/workday-v3/ChromeContext";
import { getBrandIdentity } from "@/product";
import { requireScenarioState } from "@/scenario/engine/state";
import type { Language } from "@/i18n/labels";
import { EntryExperience } from "./EntryExperience";

function scenarioLanguage(): Language {
  try {
    return requireScenarioState().language;
  } catch {
    return "en";
  }
}

export async function EntryPage({ initialPhase, next }: { initialPhase: "startup" | "signin"; next: string | null }) {
  const jar = await cookies();
  const theme = jar.get(THEME_COOKIE)?.value === "dark" ? "dark" : "light";
  const identity = getBrandIdentity();
  return (
    <div className="workday-v3" data-wd-theme={theme}>
      <EntryExperience
        initialPhase={initialPhase}
        next={next}
        language={scenarioLanguage()}
        clientName={identity.clientName ?? "Arcadia Banking Group"}
      />
    </div>
  );
}

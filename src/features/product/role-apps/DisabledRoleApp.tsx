/**
 * The honest disabled state of a Role App, on its process page.
 *
 * Rendered by the process run routes instead of the process page when
 * `readRoleAppAvailability` says the app is not runnable: the product owner
 * disabled or retired it. It says what happened, who did it and when, that
 * the runs are kept, and what still works, and it offers nothing that would
 * open, resume or start the process. In the workday's own V3.3 tokens, inside
 * the workday frame.
 *
 * Server component.
 */

import type { ReactNode } from "react";
import { isDatabaseReady } from "@/db/client";
import { StatusBadge } from "@/product/status";
import { getScenarioState } from "@/scenario/engine/state";
import { readRoleAppAvailability, type RoleAppAvailability } from "@/role-apps/enablement";
import type { Language } from "@/i18n/labels";

const COPY = {
  disabled: { en: "Disabled by the product owner", de: "Von der Produktverantwortung gesperrt" },
  retired: { en: "Retired by the product owner", de: "Von der Produktverantwortung ausser Betrieb genommen" },
  notInstalled: { en: "Not installed", de: "Nicht installiert" },
  reasonGiven: { en: "Reason given", de: "Angegebene Begruendung" },
  stillWorks: {
    en: "Home, Work and Decisions keep working. The process records are kept exactly as they were, and the stage work continues where it stopped once the app is enabled again.",
    de: "Start, Arbeit und Entscheidungen funktionieren weiter. Die Prozessdatensaetze bleiben genau so erhalten, und die Stufenarbeit geht dort weiter, wo sie aufgehoert hat, sobald die App wieder freigeschaltet ist.",
  },
  synthetic: { en: "Synthetic institution and data", de: "Synthetische Institution und Daten" },
} as const;

/**
 * The enablement check in front of a process run page: the page when the app
 * is runnable, the disabled state when it is not. The process routes wrap
 * their page in this, which is the whole of their change.
 */
export function RoleAppGate({
  roleAppId,
  title,
  children,
}: {
  roleAppId: string;
  title: { en: string; de: string };
  children: ReactNode;
}) {
  const availability = readRoleAppAvailability(roleAppId);
  if (availability.runnable) return <>{children}</>;
  let language: Language = "en";
  try {
    language = isDatabaseReady() && getScenarioState()?.language === "de" ? "de" : "en";
  } catch {
    language = "en";
  }
  return <DisabledRoleApp title={title} availability={availability} language={language} />;
}

export function DisabledRoleApp({
  title,
  availability,
  language,
}: {
  title: { en: string; de: string };
  availability: RoleAppAvailability;
  language: Language;
}) {
  const say = (pair: { en: string; de: string }) => (language === "de" ? pair.de : pair.en);
  const heading =
    availability.state === "retired" ? COPY.retired : availability.state === "not-installed" ? COPY.notInstalled : COPY.disabled;

  return (
    <div className="wd-main-inner" data-testid="role-app-disabled" data-role-app={availability.roleAppId} data-state={availability.state}>
      <h1 className="wd-page-title">{say(title)}</h1>
      <section
        role="status"
        aria-label={say(heading)}
        style={{
          marginTop: "var(--wd-5)",
          padding: "var(--wd-5)",
          background: "var(--wd-surface)",
          border: "1px solid var(--wd-border)",
          borderRadius: "var(--wd-radius-lg)",
          maxWidth: "80ch",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--wd-3)", flexWrap: "wrap" }}>
          <StatusBadge status="unavailable" language={language} detail={say(availability.reason)} />
          <span style={{ fontSize: "var(--wd-text-base)", fontWeight: 600, color: "var(--wd-text)" }}>{say(heading)}</span>
        </div>
        <p style={{ margin: "var(--wd-3) 0 0", fontSize: "var(--wd-text-sm)", color: "var(--wd-text-secondary)", overflowWrap: "anywhere" }}>
          {say(availability.reason)}
        </p>
        {availability.changeReason ? (
          <p style={{ margin: "var(--wd-2) 0 0", fontSize: "var(--wd-text-sm)", color: "var(--wd-text-secondary)", overflowWrap: "anywhere" }}>
            {say(COPY.reasonGiven)}: {availability.changeReason}
          </p>
        ) : null}
        <p style={{ margin: "var(--wd-3) 0 0", fontSize: "var(--wd-text-sm)", color: "var(--wd-text-muted)" }}>{say(COPY.stillWorks)}</p>
      </section>
      <span style={{ display: "block", marginTop: "var(--wd-8)", fontSize: 12, color: "var(--wd-text-muted)" }}>{say(COPY.synthetic)}</span>
    </div>
  );
}

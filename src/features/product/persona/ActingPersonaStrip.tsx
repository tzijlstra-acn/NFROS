/**
 * The acting persona, at the top of every console page.
 *
 * One line: who is acting, labelled honestly as a demonstration persona, and
 * the control to choose another. What the persona owns and may do sits
 * behind a disclosure, because it is read once and then known (quiet by
 * default, plan 9.1).
 *
 * The switch is a plain form posting to a server action, so it works without
 * client script. In design-partner mode the persona is the signed-in
 * account's and the control is replaced by the reason it cannot be changed.
 *
 * Server component.
 */

import { Chip } from "@/components/workday-v2/primitives";
import type { Language } from "@/i18n/labels";
import {
  CONSOLE_ACTIONS,
  PRODUCT_PERSONA_IDS,
  PRODUCT_PERSONAS,
  checkConsolePermission,
} from "../permissions";
import { consoleInputStyle, consolePanelStyle } from "../shell/styles";
import { actionSwitchConsolePersona } from "./actions";
import { readActingConsoleIdentity } from "./acting";

const COPY = {
  actingAs: { en: "Acting as", de: "Handelnd als" },
  demonstrationPersona: { en: "Demonstration persona", de: "Demonstrationspersona" },
  demonstrationDetail: {
    en: "There is no identity provider in this build. The persona is chosen here, every console action is checked against its authority on the server, and Wave 5 binds it to a named user.",
    de: "In diesem Build gibt es keinen Identitaetsanbieter. Die Persona wird hier gewaehlt, jede Konsolenaktion wird serverseitig gegen ihre Befugnisse geprueft, und Welle 5 bindet sie an einen benannten Benutzer.",
  },
  nobody: { en: "No persona", de: "Keine Persona" },
  nobodyDetail: {
    en: "The console is read only until a persona is chosen.",
    de: "Die Konsole ist schreibgeschuetzt, bis eine Persona gewaehlt ist.",
  },
  account: { en: "Signed-in account without a product-owner persona", de: "Angemeldetes Konto ohne Product-Owner-Persona" },
  accountDetail: {
    en: "This account holds no console authority, so the console is read only.",
    de: "Dieses Konto hat keine Konsolenbefugnisse, die Konsole ist daher schreibgeschuetzt.",
  },
  choose: { en: "Choose persona", de: "Persona waehlen" },
  switch: { en: "Act as this persona", de: "Als diese Persona handeln" },
  fixed: {
    en: "Personas can be switched in demonstration mode only. In this mode the persona is the signed-in account's.",
    de: "Personas lassen sich nur im Demonstrationsmodus wechseln. In diesem Modus gilt die Persona des angemeldeten Kontos.",
  },
  owns: { en: "Owns", de: "Verantwortet" },
  mayDo: { en: "May do in the console", de: "Darf in der Konsole" },
  material: { en: "needs an approval", de: "braucht eine Genehmigung" },
  details: { en: "What this persona owns and may do", de: "Was diese Persona verantwortet und darf" },
  nothing: { en: "Read the console only.", de: "Nur die Konsole lesen." },
} as const;

export async function ActingPersonaStrip({ language }: { language: Language }) {
  const say = (pair: { en: string; de: string }) => (language === "de" ? pair.de : pair.en);
  const identity = await readActingConsoleIdentity();
  const persona = identity.persona;
  const permitted = Object.values(CONSOLE_ACTIONS).filter(
    (action) => action.scope !== "console.read" && checkConsolePermission(identity.scopes, action.id as keyof typeof CONSOLE_ACTIONS).allowed,
  );

  return (
    <section
      style={consolePanelStyle}
      aria-label={say(COPY.actingAs)}
      data-testid="console-acting-persona"
      data-persona={persona?.id ?? "none"}
    >
      <div className="app-row app-row-wrap" style={{ justifyContent: "space-between", rowGap: "var(--app-2)" }}>
        <div className="app-row app-row-wrap" style={{ minWidth: 0 }}>
          <span className="app-meta">{say(COPY.actingAs)}</span>
          <span className="app-strong" data-testid="console-acting-persona-label">
            {persona ? say(persona.label) : identity.source === "account-without-persona" ? say(COPY.account) : say(COPY.nobody)}
          </span>
          {persona ? <Chip tone="info" title={say(COPY.demonstrationDetail)}>{say(COPY.demonstrationPersona)}</Chip> : null}
          <span className="app-meta" style={{ whiteSpace: "normal" }}>
            {persona
              ? say(COPY.demonstrationDetail)
              : identity.source === "account-without-persona"
                ? say(COPY.accountDetail)
                : say(COPY.nobodyDetail)}
          </span>
        </div>

        {identity.switchingAllowed ? (
          <form action={actionSwitchConsolePersona} className="app-row app-row-wrap" style={{ gap: "var(--app-2)" }}>
            <label className="app-row" style={{ gap: "var(--app-2)" }}>
              <span className="app-meta">{say(COPY.choose)}</span>
              <select
                name="personaId"
                defaultValue={persona?.id ?? "none"}
                style={consoleInputStyle}
                data-testid="console-persona-select"
              >
                <option value="none">{say(COPY.nobody)}</option>
                {PRODUCT_PERSONA_IDS.map((id) => (
                  <option key={id} value={id}>
                    {say(PRODUCT_PERSONAS[id].label)}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="app-btn app-btn-secondary app-btn-sm" data-testid="console-persona-switch">
              {say(COPY.switch)}
            </button>
          </form>
        ) : (
          <span className="app-meta" style={{ whiteSpace: "normal", maxWidth: "60ch" }}>
            {say(COPY.fixed)}
          </span>
        )}
      </div>

      <details style={{ marginTop: "var(--app-2)" }}>
        <summary className="app-meta" style={{ cursor: "pointer" }}>
          {say(COPY.details)}
        </summary>
        <div className="app-grid-2" style={{ marginTop: "var(--app-2)" }}>
          <div className="app-stack-1">
            <span className="app-strong" style={{ fontSize: "var(--app-text-sm)" }}>{say(COPY.owns)}</span>
            <span className="app-meta" style={{ whiteSpace: "normal" }}>
              {persona ? persona.owns.map((item) => say(item)).join(", ") : say(COPY.nothing)}
            </span>
          </div>
          <div className="app-stack-1">
            <span className="app-strong" style={{ fontSize: "var(--app-text-sm)" }}>{say(COPY.mayDo)}</span>
            <span className="app-meta" style={{ whiteSpace: "normal" }}>
              {permitted.length > 0
                ? permitted
                    .map((action) => (action.material ? `${say(action.label)} (${say(COPY.material)})` : say(action.label)))
                    .join(", ")
                : say(COPY.nothing)}
            </span>
          </div>
        </div>
      </details>
    </section>
  );
}

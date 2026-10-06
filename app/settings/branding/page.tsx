/**
 * Branding settings.
 *
 * The screen that demonstrates the central product claim: a branding switch is
 * one row update, the whole interface re-renders against the new identity, and
 * every decision, approval and audit event is still exactly where it was.
 *
 * The switch is a plain form posting to a server action, so it works without
 * JavaScript and needs no client component. The product configuration change
 * log is shown directly underneath, because the proof that nothing else moved
 * is that the only thing recorded is a branding change.
 *
 * The product name shown here comes from the brand profile, which takes it
 * from the release registry in every mode; branding changes marks and
 * attribution, never what the product is called.
 */

import { getBrandIdentity, getProductConfig, listBrandProfiles, listProductConfigChanges } from "@/product";
import { BRAND_MODE_EXPLANATION, BRAND_MODE_LABELS } from "@/product";
import { actionClearBrandOverride, actionSetBrandProfile } from "@/product/actions";
import { Field, FieldList, SettingsHead, SettingsSection } from "@/components/settings/primitives";
import { Chip, Data, Item, List, Notice } from "@/components/workday-v2/primitives";
import { BRAND_MODES } from "@/db/schema/product";
import { readAdminLanguage } from "@/product/status/sources";
import { pick } from "@/workday/contracts";

export const dynamic = "force-dynamic";

type Pair = { en: string; de: string };

const COPY = {
  eyebrow: { en: "Administrator area", de: "Administrationsbereich" },
  title: { en: "Branding", de: "Marke" },
  lede: {
    en: "How the product presents itself: client branded, operator branded, or both. Switching mode updates one row and changes no domain state.",
    de: "Wie sich das Produkt praesentiert: mit Kundenmarke, Betreibermarke oder beiden. Ein Moduswechsel aendert eine Zeile und keinen fachlichen Zustand.",
  },
  notConfigured: {
    en: "No active product configuration was found, so the switch below has nothing to write to. Run the database migration and seed, then reload.",
    de: "Es wurde keine aktive Produktkonfiguration gefunden, der Schalter unten kann daher nichts schreiben. Fuehren Sie Migration und Seed der Datenbank aus und laden Sie neu.",
  },
  resolved: { en: "Resolved identity", de: "Aufgeloeste Identitaet" },
  mode: { en: "Mode", de: "Modus" },
  productName: { en: "Product name", de: "Produktname" },
  shortName: { en: "Short name", de: "Kurzname" },
  institution: { en: "Institution", de: "Institution" },
  operator: { en: "Operator", de: "Betreiber" },
  notShown: { en: "Not shown in this mode", de: "In diesem Modus nicht angezeigt" },
  operatorNote: {
    en: "In client mode the resolved identity carries no operator name at all. The name is still in the database and this screen is where it is read, but a shell component cannot render what the identity object does not contain.",
    de: "Im Kundenmodus enthaelt die aufgeloeste Identitaet keinen Betreibernamen. Der Name steht weiter in der Datenbank und wird auf dieser Seite gelesen, eine Shell-Komponente kann aber nicht darstellen, was das Identitaetsobjekt nicht enthaelt.",
  },
  attributed: { en: "Attributed to", de: "Zugeordnet zu" },
  marks: { en: "Marks shown", de: "Angezeigte Zeichen" },
  noneConfigured: { en: "None configured", de: "Keine konfiguriert" },
  and: { en: " and ", de: " und " },
  pairNote: {
    en: "Two marks, separated by a hairline, institution first. Never stacked.",
    de: "Zwei Zeichen, durch eine feine Linie getrennt, Institution zuerst. Nie gestapelt.",
  },
  supportLabel: { en: "Support label", de: "Support-Bezeichnung" },
  supportLink: { en: "Support link", de: "Support-Link" },
  legalNotice: { en: "Legal notice", de: "Rechtlicher Hinweis" },
  notConfiguredValue: { en: "Not configured", de: "Nicht konfiguriert" },
  accent: { en: "Accent token", de: "Akzent-Token" },
  accentNote: {
    en: "A custom property name from the workday scope. A profile sets which token the accent resolves to, never a colour value, so a client accent stays inside the palette.",
    de: "Ein CSS-Variablenname aus dem Arbeitstag. Ein Profil legt fest, auf welches Token der Akzent zeigt, nie einen Farbwert, ein Kundenakzent bleibt daher in der Palette.",
  },
  disclosure: { en: "Synthetic data disclosure", de: "Hinweis auf synthetische Daten" },
  alwaysShown: { en: "Always shown", de: "Immer angezeigt" },
  columnFalse: { en: "Column set to false", de: "Spalte auf false gesetzt" },
  disclosureNote: {
    en: "Not configurable away in this build. See the note below.",
    de: "In diesem Build nicht abschaltbar. Siehe den Hinweis unten.",
  },
  switchMode: { en: "Switch mode", de: "Modus wechseln" },
  active: { en: "Active", de: "Aktiv" },
  inForce: { en: "In force", de: "In Kraft" },
  switchTo: { en: "Switch to this profile", de: "Zu diesem Profil wechseln" },
  clear: {
    en: "Clear the override and use the organisation profile pointer",
    de: "Ueberschreibung entfernen und den Verweis des Organisationsprofils nutzen",
  },
  orgNames: { en: "The organisation profile names {id}.", de: "Das Organisationsprofil nennt {id}." },
  effects: {
    en: "What a branding change does and does not change",
    de: "Was ein Markenwechsel aendert und was nicht",
  },
  effectsInfo: {
    en: "Switching branding writes the brand pointer on one row and one entry in the product configuration change log. No risk, control, supplier, assessment, incident, decision, approval or audit event is read or written by the switch. The workday re-renders against the new identity with every recorded decision intact, which is what the claim that configuration does not require a fork means in practice.",
    de: "Ein Markenwechsel schreibt den Markenverweis in eine Zeile und einen Eintrag in das Aenderungsprotokoll der Produktkonfiguration. Kein Risiko, keine Kontrolle, kein Lieferant, keine Bewertung, kein Vorfall, keine Entscheidung, keine Genehmigung und kein Audit-Ereignis wird dabei gelesen oder geschrieben. Der Arbeitstag erscheint mit der neuen Identitaet und allen erfassten Entscheidungen; genau das bedeutet, dass Konfiguration keine Abspaltung des Codes braucht.",
  },
  effectsDisclosure: {
    en: "The synthetic data disclosure cannot be configured away. Every brand profile carries the flag and the shell shows the label regardless of its value in this build. A product that let an operator remove the disclosure would let a demonstration be mistaken for a production system holding real client records, and no branding requirement outweighs that.",
    de: "Der Hinweis auf synthetische Daten laesst sich nicht abschalten. Jedes Markenprofil traegt das Kennzeichen, und die Shell zeigt den Hinweis in diesem Build unabhaengig von dessen Wert. Ein Produkt, in dem ein Betreiber den Hinweis entfernen koennte, liesse eine Demonstration als Produktivsystem mit echten Kundendaten erscheinen, und keine Markenanforderung wiegt das auf.",
  },
  effectsProvider: {
    en: "Model provider names, model identifiers and provider branding do not appear anywhere in the working interface in any of the three modes. The product speaks about what it checked and what it prepared, never about which model prepared it.",
    de: "Namen von Modellanbietern, Modellkennungen und Anbietermarken erscheinen in keinem der drei Modi in der Arbeitsoberflaeche. Das Produkt spricht darueber, was es geprueft und vorbereitet hat, nie darueber, welches Modell es vorbereitet hat.",
  },
  log: { en: "Configuration change log", de: "Aenderungsprotokoll der Konfiguration" },
  noChanges: {
    en: "No changes recorded. The seeded configuration is the only state so far.",
    de: "Keine Aenderungen erfasst. Die eingespielte Konfiguration ist bisher der einzige Stand.",
  },
  by: { en: "by", de: "von" },
  separate: {
    en: "Separate from the domain audit trail by design. A reviewer asking who changed the branding and a reviewer asking who approved a residual risk rating are asking different questions of different systems.",
    de: "Bewusst getrennt vom fachlichen Audit-Trail. Wer fragt, wer die Marke geaendert hat, und wer fragt, wer eine Restrisikobewertung genehmigt hat, stellt verschiedenen Systemen verschiedene Fragen.",
  },
  version: { en: "Active configuration version", de: "Aktiver Konfigurationsstand" },
  notConfiguredLower: { en: "not configured", de: "nicht konfiguriert" },
  modesDefined: { en: "Modes defined", de: "Definierte Modi" },
} as const;

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

export default function BrandingSettingsPage() {
  const language = readAdminLanguage();
  const say = (pair: Pair) => pick(pair, language);
  const config = getProductConfig();
  const identity = getBrandIdentity();
  const profiles = listBrandProfiles();
  const changes = listProductConfigChanges(8);
  const pointer = config.updatedAt;

  return (
    <div className="app-stack app-stack-6">
      <SettingsHead eyebrow={say(COPY.eyebrow)} title={say(COPY.title)} lede={say(COPY.lede)} />

      {config.configured ? null : <Notice tone="warning">{say(COPY.notConfigured)}</Notice>}

      <SettingsSection title={say(COPY.resolved)} trailing={<Data>{identity.brandProfileId}</Data>}>
        <FieldList label={say(COPY.resolved)}>
          <Field
            label={say(COPY.mode)}
            value={
              <span className="app-row app-row-wrap">
                <Chip tone="ai">{pick(BRAND_MODE_LABELS[identity.mode], language)}</Chip>
                <span className="app-meta">
                  {pick(BRAND_MODE_LABELS[identity.mode], language === "de" ? "en" : "de")}
                </span>
              </span>
            }
          />
          <Field label={say(COPY.productName)} value={identity.productName} />
          <Field label={say(COPY.shortName)} value={identity.shortName} />
          <Field label={say(COPY.institution)} value={identity.clientName} />
          <Field
            label={say(COPY.operator)}
            value={identity.operatorName ?? say(COPY.notShown)}
            note={identity.operatorName === null ? say(COPY.operatorNote) : undefined}
          />
          <Field label={say(COPY.attributed)} value={identity.attribution} />
          <Field
            label={say(COPY.marks)}
            value={
              identity.marks.length === 0
                ? say(COPY.noneConfigured)
                : identity.marks
                    .map((mark) => `${mark.src} (${mark.owner})`)
                    .join(identity.showPair ? say(COPY.and) : ", ")
            }
            note={identity.showPair ? say(COPY.pairNote) : undefined}
            mono
          />
          <Field label={say(COPY.supportLabel)} value={identity.supportLabel ?? say(COPY.notConfiguredValue)} />
          <Field
            label={say(COPY.supportLink)}
            value={identity.supportUrl ?? say(COPY.notConfiguredValue)}
            mono
          />
          <Field label={say(COPY.legalNotice)} value={identity.legalNotice ?? say(COPY.notConfiguredValue)} />
          <Field label={say(COPY.accent)} value={identity.accentToken} note={say(COPY.accentNote)} mono />
          <Field
            label={say(COPY.disclosure)}
            value={identity.syntheticDisclosure ? say(COPY.alwaysShown) : say(COPY.columnFalse)}
            note={say(COPY.disclosureNote)}
          />
        </FieldList>
      </SettingsSection>

      <SettingsSection title={say(COPY.switchMode)} count={profiles.length}>
        <div className="app-stack app-stack-3">
          {profiles.map((profile) => {
            const active = profile.id === identity.brandProfileId;
            return (
              <div
                key={profile.id}
                className="app-item app-item-lg"
                {...(active ? { "data-selected": true } : {})}
              >
                <span className="app-item-main">
                  <span className="app-item-title">
                    <span className="app-row app-row-wrap">
                      {pick(BRAND_MODE_LABELS[profile.mode], language)}
                      {active ? <Chip tone="ai">{say(COPY.active)}</Chip> : null}
                      <Data>{profile.id}</Data>
                    </span>
                  </span>
                  <span className="app-item-sub" style={{ whiteSpace: "normal" }}>
                    {pick(BRAND_MODE_EXPLANATION[profile.mode], language)}
                  </span>
                </span>
                <span className="app-item-trail">
                  {active ? (
                    <span className="app-meta">{say(COPY.inForce)}</span>
                  ) : (
                    <form action={actionSetBrandProfile}>
                      <input type="hidden" name="brandProfileId" value={profile.id} />
                      <button type="submit" className="app-btn app-btn-secondary app-btn-sm">
                        {say(COPY.switchTo)}
                      </button>
                    </form>
                  )}
                </span>
              </div>
            );
          })}

          <div className="app-row app-row-wrap app-row-4">
            <form action={actionClearBrandOverride}>
              <button type="submit" className="app-btn app-btn-quiet app-btn-sm">
                {say(COPY.clear)}
              </button>
            </form>
            <span className="app-meta">
              {fill(say(COPY.orgNames), { id: config.organisation.brandProfileId })}
            </span>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title={say(COPY.effects)}>
        <div className="app-stack app-stack-3">
          <Notice tone="info">{say(COPY.effectsInfo)}</Notice>
          <Notice tone="warning">{say(COPY.effectsDisclosure)}</Notice>
          <Notice>{say(COPY.effectsProvider)}</Notice>
        </div>
      </SettingsSection>

      <SettingsSection title={say(COPY.log)} count={changes.length}>
        {changes.length === 0 ? (
          <Notice>{say(COPY.noChanges)}</Notice>
        ) : (
          <List label={say(COPY.log)}>
            {changes.map((change) => (
              <Item
                key={change.id}
                title={<span style={{ whiteSpace: "normal" }}>{change.summary}</span>}
                subtitle={
                  <span className="app-row app-row-wrap">
                    <Chip>{change.area}</Chip>
                    <Data>{change.at}</Data>
                    <span className="app-meta">
                      {say(COPY.by)} {change.changedBy}
                    </span>
                  </span>
                }
              />
            ))}
          </List>
        )}
        <div style={{ marginTop: "var(--app-3)" }}>
          <span className="app-meta">
            {say(COPY.separate)} {say(COPY.version)}{" "}
            <Data>{pointer ?? say(COPY.notConfiguredLower)}</Data>. {say(COPY.modesDefined)}:{" "}
            {BRAND_MODES.map((mode) => pick(BRAND_MODE_LABELS[mode], language)).join(", ")}.
          </span>
        </div>
      </SettingsSection>
    </div>
  );
}

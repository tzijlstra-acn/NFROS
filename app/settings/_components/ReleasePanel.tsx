/**
 * The product release, rendered from the release registry.
 *
 * Used twice: in full on the operations console and as a summary on the
 * settings index. Both read `getProductReleaseRegistry()`, so the two screens,
 * package.json, the CHANGELOG and the README cannot carry different numbers;
 * `tests/unit/product-release.test.ts` holds the last three to the registry.
 *
 * Release stage, role release state and limitation state are shown as plain
 * chips, not as status badges. They are release facts, not readings of a
 * system, and putting them in the status vocabulary would blur the one place
 * where "Verified" has to mean that something was checked.
 *
 * Server safe: no hooks.
 */

import {
  LIMITATION_STATUS_LABELS,
  RELEASE_STAGE_LABELS,
  ROLE_APP_STATUS_LABELS,
  ROLE_RELEASE_STATUS_LABELS,
  ROLE_RELEASE_STATUS_ORDER,
  getProductReleaseRegistry,
  type Bilingual,
} from "@/product/release";
import { Field, FieldList, SettingsSection } from "@/components/settings/primitives";
import { Chip, Data, Item, List } from "@/components/workday-v2/primitives";
import type { Language } from "@/i18n/labels";
import { WrappingDetail } from "./StatusRows";

const COPY = {
  release: { en: "Product release", de: "Produkt-Release" },
  product: { en: "Product", de: "Produkt" },
  version: { en: "Version", de: "Version" },
  name: { en: "Release name", de: "Release-Name" },
  stage: { en: "Stage", de: "Stand" },
  date: { en: "Date", de: "Datum" },
  components: { en: "Named components", de: "Benannte Komponenten" },
  roles: { en: "Role release states", de: "Rollen im Release" },
  roleApps: { en: "Role Apps", de: "Rollen-Apps" },
  installed: { en: "Installed", de: "Installiert" },
  preview: { en: "Preview, no routed process page", de: "Vorschau, ohne eigene Prozessseite" },
  limitations: { en: "Known limitations", de: "Bekannte Einschraenkungen" },
  source: { en: "Read from", de: "Gelesen aus" },
  none: { en: "None", de: "Keine" },
  summaryNote: {
    en: "Read from the release registry. The operations console shows the full release, including known limitations.",
    de: "Aus dem Release-Verzeichnis gelesen. Die Betriebskonsole zeigt das vollstaendige Release, einschliesslich bekannter Einschraenkungen.",
  },
} as const;

function say(pair: Bilingual, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

export function ReleasePanel({
  language,
  variant,
}: {
  language: Language;
  variant: "summary" | "full";
}) {
  const registry = getProductReleaseRegistry();
  const { identity, release, components, roles, roleApps, limitations } = registry;

  return (
    <SettingsSection
      title={say(COPY.release, language)}
      trailing={<Chip tone="ai">{say(RELEASE_STAGE_LABELS[release.stage], language)}</Chip>}
    >
      <div className="app-stack app-stack-5" id={variant === "full" ? "release" : undefined}>
        <FieldList label={say(COPY.release, language)}>
          <Field
            label={say(COPY.product, language)}
            value={`${identity.name}, ${say(identity.descriptor, language)}`}
          />
          <Field label={say(COPY.version, language)} value={<Data size="sm">{release.version}</Data>} />
          <Field label={say(COPY.name, language)} value={say(release.name, language)} />
          <Field label={say(COPY.date, language)} value={<Data>{release.date}</Data>} />
          {components.map((component) => (
            <Field
              key={component.id}
              label={say(component.name, language)}
              value={
                <span className="app-row app-row-wrap">
                  <Data size="sm">{component.version}</Data>
                  <span className="app-oid">{component.route}</span>
                </span>
              }
              {...(variant === "full"
                ? { note: `${say(COPY.source, language)} ${component.source}` }
                : {})}
            />
          ))}
          <Field
            label={say(COPY.roles, language)}
            value={
              <span className="app-stack app-stack-1">
                {ROLE_RELEASE_STATUS_ORDER.map((status) => {
                  const inState = roles.filter((role) => role.status === status);
                  return (
                    <span key={status} className="app-row app-row-wrap">
                      <Chip tone={status === "available" ? "success" : "neutral"}>
                        {say(ROLE_RELEASE_STATUS_LABELS[status], language)}
                      </Chip>
                      <span>
                        {inState.length > 0
                          ? inState.map((role) => role.releaseLabel).join(", ")
                          : say(COPY.none, language)}
                      </span>
                    </span>
                  );
                })}
              </span>
            }
          />
          <Field
            label={say(COPY.roleApps, language)}
            value={
              <span className="app-stack app-stack-1">
                <span className="app-row app-row-wrap">
                  <Chip tone="success">{say(ROLE_APP_STATUS_LABELS.installed, language)}</Chip>
                  <span>
                    {roleApps.installed
                      .map((app) => `${say(app.name, language)} ${app.version}`)
                      .join(", ") || say(COPY.none, language)}
                  </span>
                </span>
                <span className="app-row app-row-wrap">
                  <Chip>{say(ROLE_APP_STATUS_LABELS.preview, language)}</Chip>
                  <span>
                    {variant === "full"
                      ? roleApps.preview.map((app) => say(app.name, language)).join(", ") ||
                        say(COPY.none, language)
                      : String(roleApps.preview.length)}
                  </span>
                </span>
              </span>
            }
            note={say(COPY.preview, language)}
          />
        </FieldList>

        {variant === "full" ? (
          <div className="app-stack app-stack-3">
            <span className="app-strong">
              {say(COPY.limitations, language)}{" "}
              <span className="app-muted" style={{ fontWeight: 400 }}>
                {limitations.length}
              </span>
            </span>
            <List label={say(COPY.limitations, language)}>
              {limitations.map((limitation) => (
                <Item
                  key={limitation.id}
                  title={
                    <span className="app-row app-row-wrap">
                      <span>{say(limitation.title, language)}</span>
                      <Chip tone={limitation.status === "open" ? "warning" : "neutral"}>
                        {say(LIMITATION_STATUS_LABELS[limitation.status], language)}
                      </Chip>
                    </span>
                  }
                >
                  <WrappingDetail>
                    {say(limitation.detail, language)}{" "}
                    <span className="app-oid">{limitation.reference}</span>
                  </WrappingDetail>
                </Item>
              ))}
            </List>
          </div>
        ) : (
          <span className="app-meta">{say(COPY.summaryNote, language)}</span>
        )}
      </div>
    </SettingsSection>
  );
}

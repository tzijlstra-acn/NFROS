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
 */

import { getBrandIdentity, getProductConfig, listBrandProfiles, listProductConfigChanges } from "@/product";
import { BRAND_MODE_EXPLANATION, BRAND_MODE_LABELS } from "@/product";
import { actionClearBrandOverride, actionSetBrandProfile } from "@/product/actions";
import { Field, FieldList, SettingsHead, SettingsSection } from "@/components/settings/primitives";
import { Chip, Data, Item, List, Notice } from "@/components/workday-v2/primitives";
import { BRAND_MODES } from "@/db/schema/product";

export const dynamic = "force-dynamic";

export default function BrandingSettingsPage() {
  const config = getProductConfig();
  const identity = getBrandIdentity();
  const profiles = listBrandProfiles();
  const changes = listProductConfigChanges(8);
  const pointer = config.updatedAt;

  return (
    <div className="app-stack app-stack-6">
      <SettingsHead
        eyebrow="Administrator area"
        title="Branding"
        lede="How the product presents itself: client branded, operator branded, or both. Switching mode updates one row and changes no domain state."
      />

      {config.configured ? null : (
        <Notice tone="warning">
          No active product configuration was found, so the switch below has nothing to write to.
          Run the database migration and seed, then reload.
        </Notice>
      )}

      <SettingsSection title="Resolved identity" trailing={<Data>{identity.brandProfileId}</Data>}>
        <FieldList label="Resolved identity">
          <Field
            label="Mode"
            value={
              <span className="app-row app-row-wrap">
                <Chip tone="ai">{BRAND_MODE_LABELS[identity.mode].en}</Chip>
                <span className="app-meta">{BRAND_MODE_LABELS[identity.mode].de}</span>
              </span>
            }
          />
          <Field label="Product name" value={identity.productName} />
          <Field label="Short name" value={identity.shortName} />
          <Field label="Institution" value={identity.clientName} />
          <Field
            label="Operator"
            value={identity.operatorName ?? "Not shown in this mode"}
            note={
              identity.operatorName === null
                ? "In client mode the resolved identity carries no operator name at all. The name is still in the database and this screen is where it is read, but a shell component cannot render what the identity object does not contain."
                : undefined
            }
          />
          <Field label="Attributed to" value={identity.attribution} />
          <Field
            label="Marks shown"
            value={
              identity.marks.length === 0
                ? "None configured"
                : identity.marks
                    .map((mark) => `${mark.src} (${mark.owner})`)
                    .join(identity.showPair ? " and " : ", ")
            }
            note={
              identity.showPair
                ? "Two marks, separated by a hairline, institution first. Never stacked."
                : undefined
            }
            mono
          />
          <Field label="Support label" value={identity.supportLabel ?? "Not configured"} />
          <Field label="Support link" value={identity.supportUrl ?? "Not configured"} mono />
          <Field label="Legal notice" value={identity.legalNotice ?? "Not configured"} />
          <Field
            label="Accent token"
            value={identity.accentToken}
            note="A custom property name from the workday scope. A profile sets which token the accent resolves to, never a colour value, so a client accent stays inside the palette."
            mono
          />
          <Field
            label="Synthetic data disclosure"
            value={identity.syntheticDisclosure ? "Always shown" : "Column set to false"}
            note="Not configurable away in this build. See the note below."
          />
        </FieldList>
      </SettingsSection>

      <SettingsSection title="Switch mode" count={profiles.length}>
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
                      {BRAND_MODE_LABELS[profile.mode].en}
                      {active ? <Chip tone="ai">Active</Chip> : null}
                      <Data>{profile.id}</Data>
                    </span>
                  </span>
                  <span className="app-item-sub">{BRAND_MODE_EXPLANATION[profile.mode].en}</span>
                </span>
                <span className="app-item-trail">
                  {active ? (
                    <span className="app-meta">In force</span>
                  ) : (
                    <form action={actionSetBrandProfile}>
                      <input type="hidden" name="brandProfileId" value={profile.id} />
                      <button type="submit" className="app-btn app-btn-secondary app-btn-sm">
                        Switch to this profile
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
                Clear the override and use the organisation profile pointer
              </button>
            </form>
            <span className="app-meta">
              The organisation profile names {config.organisation.brandProfileId}.
            </span>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="What a branding change does and does not change">
        <div className="app-stack app-stack-3">
          <Notice tone="info">
            Switching branding writes the brand pointer on one row and one entry in the product
            configuration change log. No risk, control, supplier, assessment, incident, decision,
            approval or audit event is read or written by the switch. The workday re-renders against
            the new identity with every recorded decision intact, which is what the claim that
            configuration does not require a fork means in practice.
          </Notice>
          <Notice tone="warning">
            The synthetic data disclosure cannot be configured away. Every brand profile carries the
            flag and the shell shows the label regardless of its value in this build. A product that
            let an operator remove the disclosure would let a demonstration be mistaken for a
            production system holding real client records, and no branding requirement outweighs
            that.
          </Notice>
          <Notice>
            Model provider names, model identifiers and provider branding do not appear anywhere in
            the working interface in any of the three modes. The product speaks about what it
            checked and what it prepared, never about which model prepared it.
          </Notice>
        </div>
      </SettingsSection>

      <SettingsSection title="Configuration change log" count={changes.length}>
        {changes.length === 0 ? (
          <Notice>
            No changes recorded. The seeded configuration is the only state so far.
          </Notice>
        ) : (
          <List label="Configuration change log">
            {changes.map((change) => (
              <Item
                key={change.id}
                title={change.summary}
                subtitle={
                  <span className="app-row app-row-wrap">
                    <Chip>{change.area}</Chip>
                    <Data>{change.at}</Data>
                    <span className="app-meta">by {change.changedBy}</span>
                  </span>
                }
              />
            ))}
          </List>
        )}
        <div style={{ marginTop: "var(--app-3)" }}>
          <span className="app-meta">
            Separate from the domain audit trail by design. A reviewer asking who changed the
            branding and a reviewer asking who approved a residual risk rating are asking different
            questions of different systems. Active configuration version{" "}
            <Data>{pointer ?? "not configured"}</Data>. Modes defined:{" "}
            {BRAND_MODES.map((mode) => BRAND_MODE_LABELS[mode].en).join(", ")}.
          </span>
        </div>
      </SettingsSection>
    </div>
  );
}

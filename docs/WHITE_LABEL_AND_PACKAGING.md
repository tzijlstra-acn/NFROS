# White Label and Packaging

NFR WorkOS, how the product presents itself and how it is licensed.

Synthetic institution and data. Every regulatory reference in this document carries the label
**Illustrative regulatory context, not legal advice.**

Primary sources:

| Concern | File |
|---|---|
| Brand profiles, modes, mark resolution | `src/product/branding/brand.ts` |
| Terminology, typed keys | `src/product/terminology/terms.ts` |
| Entitlements and capabilities | `src/product/entitlements/entitlements.ts` |
| Seeded brand profiles | `src/product/seed.ts` |
| Branding settings screen | `app/settings/branding/page.tsx` |
| Placeholder marks | `public/brand/` |

---

## 1. The three branding modes

`BRAND_MODES` in `src/db/schema/product.ts` defines exactly three. There is no fourth, and a fourth
would need a reason written down, because every additional mode is another combination that has to be
checked on every surface.

### 1.1 `client`

The product carries the institution name and mark only. One mark, the institution's. The product
name and short name are shown as text beside it.

The resolved identity for this mode carries `operatorName: null`. This is structural rather than
conventional: the operator name is still in the database and the branding settings screen still
reads it, but a shell component rendering the identity object cannot leak it, because the field is
not populated. Relying on every consumer to remember "do not show the operator in client mode" is
the kind of rule that holds until the fourth component.

This is the default active profile. A deployment holding an institution's records presents itself as
that institution's application.

### 1.2 `accenture`

The product carries the operator name and mark. One mark, the operator's. Appropriate for a
demonstration or an internal build. Not appropriate for a deployment holding a client record, and
the seeded profile's legal notice says so in as many words: "Accenture demonstration build.
Synthetic institution and data. Not a client deployment and not connected to a client system."

### 1.3 `co-branded`

Both marks, separated by a hairline, institution first. Never stacked logos, which is what
`.app-brand-pair` in `src/styles/workday-v2.css` enforces. Used where the operating model is openly a
joint one, which in practice means a managed service the institution has told its own supervisor
about.

### 1.4 Switching

A switch writes `brand_profile_id_override` and `updated_at` on the singleton and appends one row to
`product_config_changes`. Nothing else moves. The branding settings screen states this on the screen
rather than only in documentation, because a client reading a claim about separation of concerns
wants to see it asserted next to the button that would break it.

Every brand profile may name both a primary and a secondary logo file regardless of mode, so an
administrator switching from client to co-branded does not have to re-upload anything. The mode
decides which marks are shown.

---

## 2. Where Accenture identity may and may not appear

| Surface | Client mode | Co-branded mode | Accenture mode |
|---|---|---|---|
| Workday top bar | No | Yes, second mark | Yes, only mark |
| Workday content, rails, suggestions, receipts | No | No | No |
| Report and export headers | No | Yes | Yes |
| Administrator settings area | Yes, as the operator field | Yes | Yes |
| Legal notice and support label | Yes, where the contract names the operator | Yes | Yes |
| Presentation deck and story mode | Yes | Yes | Yes |

The rule behind the table: operator identity belongs in the chrome and in the contractual copy, and
nowhere in the working content. A practitioner reading a supplier assessment should see the
institution's own application, because the assessment is the institution's record and the operator
did not make it.

The settings area is the exception in client mode, and deliberately so. An administrator needs to
know who operates the system they are administering, and hiding it there would be white labelling
sliding into concealment.

---

## 3. Model provider and model names

No model provider name, no model identifier and no provider branding appears anywhere in the working
interface, in any of the three branding modes. This is not a configuration option.

Three reasons:

1. It is not information the user can act on. Knowing which model drafted a challenge question does
   not help a risk professional decide whether the question is a good one, and the things that would
   help, the citations, the opposing evidence and the stated uncertainty, are already on the screen.
2. It dates the product. A model identifier rendered into a screenshot in a committee pack is wrong
   within a quarter.
3. It shifts the accountability framing. The product's position is that a named person owns every
   material decision. An interface that attributes its output to a third party vendor invites the
   reading that the vendor owns it.

What the product does say, in `src/components/workday-v2/primitives.tsx` and the AI Partner surface,
is what it checked, what it compared, what it prepared and what it is uncertain about. The AI stage
labels in `src/workday/contracts.ts` describe observable processing steps and nothing else: they are
not a window onto model reasoning and must never be written as though they were.

The one place a model endpoint is acknowledged is the deployment profile, as a property of the
environment ("operator supplied endpoint, read from the environment at startup"), with no provider
named. Credential state in the settings area is a state only: absent, present, invalid, or not
required. No value, no prefix, no suffix, no length.

---

## 4. The synthetic data disclosure cannot be configured away

Every brand profile carries a `syntheticDisclosure` flag and every seeded profile sets it true. In
this build the shell shows the label regardless of the column's value.

The reason it is not a real switch: a product that let an operator remove the disclosure would let a
demonstration be mistaken for a production system holding real client records. A risk committee
shown an incident chronology with no indication that the incident is invented is being misled, and
no branding requirement outweighs that. The flag exists in the schema so the position is explicit
and so a future build that genuinely needs a production mode has somewhere to express it, and the
branding settings screen states the limitation on the screen.

---

## 5. Product language glossary

The words the product uses about itself. Using them consistently is what keeps a sales conversation
and an engineering conversation about the same thing.

| Term | Means | Does not mean |
|---|---|---|
| **Core** | Everything present in every deployment: shell, authority gate, audit, evidence retrieval, decision mechanics, product configuration, disclosures. | A free tier. Core is not separately licensable. |
| **Function pack** | One professional function as a complete vertical: objects, roles, tools, screens, evaluations, connector dependencies. | A feature flag. A pack without its tools and evaluations is not a pack. |
| **Connector pack** | A family of source systems with named adapters, with an honest mode per instance. | A working integration. An instance declares whether it is live, sandbox ready, simulated, configured but unavailable, or planned. |
| **Control and Trust pack** | Authority matrix, audit trail, evaluations, guardrails, jurisdiction rules, disclosures. | An add on. Every deployment has it. |
| **Deployment profile** | How and where the product runs: identity, residency, model endpoints, retention, observability, audit boundary. | A hosting plan. One of the four is implemented in this build. |
| **Client configuration** | The organisation, brand, terminology and entitlement profiles, plus the active singleton. | A customisation project. If it needs code it is not configuration. |
| **Entitlement** | What a deployment contains. | A paywall. An ungranted pack is absent, not prompted. |
| **Capability** | A named AI or administrator ability, for example `suggestion-generation`. | A model. Capabilities never carry provider or model names. |
| **Terminology profile** | The words an institution uses for the fifteen core concepts. | A translation. Translation is English and German interface copy; terminology is the noun for a concept. |
| **Brand profile** | Marks, names, support, legal notice, accent token, mode. | A theme. The palette is Core; a profile picks which token the accent resolves to, never a colour value. |
| **Autonomy level** | How much the product may do before a person is required. Core. | An entitlement. A deployment cannot buy a higher autonomy level. |
| **Authority class** | The classification of a tool: read, draft, propose, policy bound autonomous, approval required, prohibited. Core. | Configuration. A client cannot reclassify a tool. |

Two words the product avoids. It does not say "compliant", because the product does not determine
compliance and saying so would be a claim it cannot support. It does not quote savings or return on
investment figures, because the numbers would be invented and the synthetic scenario could not
support them.

---

## 6. The entitlement model

### 6.1 Shape

```ts
ProductEntitlements {
  id, name,
  functionPacks:  string[]   // which of the six
  connectorPacks: string[]   // which of the ten families
  aiFeatures:     string[]   // named capabilities, never models
  adminFeatures:  string[]   // which settings areas
  deploymentProfile: string
}
```

Four check functions, in `src/product/entitlements/entitlements.ts`:

```ts
hasFunctionPack(entitlements, packId): boolean
hasConnectorPack(entitlements, packId): boolean
hasAiFeature(entitlements, featureId): boolean
hasAdminFeature(entitlements, featureId): boolean
```

Each takes the entitlement object explicitly rather than reaching for the active configuration
itself. A gate that silently reads global state cannot be tested with a denying profile, and an
entitlement model that is never tested denying anything is decoration.

### 6.2 AI capabilities

`ai-partner-chat`, `suggestion-generation`, `evidence-retrieval`, `meeting-preparation`,
`end-of-day-summary`, `autonomous-execution`.

`autonomous-execution` is the one that matters. A deployment without it has no path to a policy
bound autonomous action regardless of the autonomy level set in the scenario, so the entitlement
layer and the authority layer agree rather than compete. The authority gate remains the boundary;
the entitlement is an additional closed door, never a substitute for the gate.

### 6.3 Administrator capabilities

`organisation-settings`, `branding`, `terminology`, `integration-settings`, `mapping-studio`,
`authority-settings`, `deployment-settings`, `product-config-audit`. The role packs screen has no
capability of its own: an administrator who can reach the settings area can always see which packs
are in force, because a settings area that hides its own scope is worse than useless.

### 6.4 The two seeded profiles

`entitlement-group-full` grants all six function packs, all ten connector packs, all capabilities.

`entitlement-two-function-pilot` grants `rcsa-operational-risk` and `third-party-risk`, three
connector packs, four AI capabilities and six administrator capabilities. It exists so the model can
be seen denying something. It is also the realistic first phase: operational risk and third party
risk, no autonomous execution, and no authority settings until the institution's own second line has
decided what the authority model should be.

With the pilot profile active, `rolesFromEntitlements` returns `rcsa` and `tprm` only, and the RCSA
pack reports `process-intelligence` as a missing connector dependency. That is the difference
between licensed and degraded, and the role packs screen says which.

### 6.5 No upsell

No settings screen built in this layer contains pricing, a purchase flow, a trial prompt, a contact
link or a comparison against a higher tier. An ungranted pack is reported as not granted and nothing
more. `tests/unit/product.test.ts` asserts that no seeded string contains upsell or pricing
language.

The reason is not modesty. The product's users are second line risk professionals who open a
settings screen to answer a question, often while something is going wrong. A pitch at that moment
is an obstacle, and a product that treats its own users as leads has mistaken who it is for.

---

## 7. Logo assets

`public/brand/client-mark.svg`, `public/brand/operator-mark.svg` and `public/brand/favicon.svg` are
neutral placeholder marks: abstract geometry, no wordmark, no real trademark artwork.

Two reasons, both of which would be a problem in a client review. Shipping an institution's actual
mark into a repository whose data is entirely synthetic attaches a real brand to invented suppliers,
invented incidents and invented ratings. Shipping Accenture's mark into the same repository implies
that the firm endorses those invented figures. Swapping in a real asset at engagement time is a file
replacement and a profile update, nothing more.

Logo references are paths under `public/`, never remote URLs. A deployment inside a bank cannot be
allowed to fetch its own client's mark from a third party host at render time.

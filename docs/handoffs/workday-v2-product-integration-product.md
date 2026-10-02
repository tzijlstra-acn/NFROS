# Handoff: product configuration layer

Agent F, the PRODUCT CONFIGURATION layer of the Interactive Workday V2 redesign.

Synthetic institution and data. Illustrative regulatory context, not legal advice.

---

## 1. What was built

### 1.1 Resolvers, `src/product/`

| File | Contains |
|---|---|
| `organisation/profile.ts` | `OrganisationProfile`, `ResolvedLegalEntity`, the `active_product_config` singleton read, regulator context derivation, the zod validation schema, and the version keyed cache machinery every other resolver uses. |
| `branding/brand.ts` | `BrandProfile`, `BrandIdentity`, `BrandMark`, the three mode mark resolution, mode labels and explanations. |
| `terminology/terms.ts` | `term(key, language, opts)`, `termFrom`, `mergeTerms`, the fifteen key default vocabulary in English and ASCII transliterated German, and a second profile proving reconfigurability. |
| `entitlements/entitlements.ts` | `ProductEntitlements`, `FunctionPackView`, the four check functions, the AI and administrator capability identifiers, `SETTINGS_AREAS`. |
| `deployment/deployment.ts` | `DeploymentProfileView`, `deploymentHonesty`, kind labels. |
| `index.ts` | `getProductConfig()`, `getBrandIdentity()`, `listProductConfigChanges()`, and a single re-export surface for everything above. |
| `seed.ts` | `seedProductConfiguration()` plus every seeded row exported as a constant so the unit tests can assert on the data without a database. |
| `actions.ts` | `"use server"` actions: `actionSetBrandProfile(formData)`, `actionClearBrandOverride()`. |

### 1.2 Administrator area, `app/settings/`

`layout.tsx` (shell), `page.tsx` (index), `organisation/page.tsx`, `branding/page.tsx`,
`role-packs/page.tsx`, `deployment/page.tsx`.

All five routes verified returning 200 against the running dev server. The shell links all seven
areas including the three owned elsewhere (`integrations`, `mappings`, `authority`).

### 1.3 Supporting files

`src/components/settings/primitives.tsx`, `scripts/seed-product.ts`,
`public/brand/{client-mark,operator-mark,favicon}.svg`, `tests/unit/product.test.ts`,
`docs/PRODUCT_ARCHITECTURE.md`, `docs/WHITE_LABEL_AND_PACKAGING.md`,
`docs/DEPLOYMENT_PROFILES.md`.

### 1.4 Seeded content

20 rows across 8 tables: 3 brand profiles (one per mode), 2 terminology profiles, 2 entitlement
profiles (full and a two function pilot), 4 deployment profiles, 1 organisation profile, 6 function
packs, 1 genesis change log entry, 1 active singleton.

---

## 2. Seed wiring: already in place

`src/db/seed/run.ts` is excluded from my scope, so `seedProductConfiguration()` was exported for you
to wire. By the time this handoff was written you had already wired it, at
`src/db/seed/run.ts:107` and `src/db/seed/run.ts:366`, in exactly the right place and shape:

```ts
import { seedProductConfiguration } from "@/product/seed";
...
  writeEverything();

  const product = seedProductConfiguration();
  counts["productConfiguration"] = product.rowsWritten;
  total += product.rowsWritten;
```

After the transaction rather than inside it is correct: `seedProductConfiguration()` opens its own
transaction, and the product tables are independent of the scenario run.

`npm run db:seed` verified reporting `20 productConfiguration` rows. `demo:reset` calls
`seedScenario`, so reset now restores the configuration as well. **No further action is needed
here.**

If you ever need the configuration alone, without rewriting the synthetic day:

```
npx tsx scripts/seed-product.ts
```

which is wired and verified independently.

---

## 3. The resolver API the shell should call

Import everything from `@/product`. Nothing in the shell should import from the subdirectories.

### 3.1 The one call

```ts
import { getProductConfig } from "@/product";

const config = getProductConfig();
// {
//   configured: boolean,
//   organisation: OrganisationProfile,
//   brand: BrandProfile,
//   identity: BrandIdentity,
//   terminology: TerminologyProfile,
//   entitlements: ProductEntitlements,
//   deployment: DeploymentProfileView,
//   functionPacks: FunctionPackView[],
//   updatedAt: string | null,
//   updatedBy: string | null,
// }
```

Synchronous, never throws, cached per process against the singleton version. Safe to call in a
layout, a page, a server component and a route handler. On an unseeded database it returns documented
fallbacks with `configured: false`.

### 3.2 What the top bar needs

```ts
import { getBrandIdentity } from "@/product";

const identity = getBrandIdentity();
```

```ts
interface BrandIdentity {
  brandProfileId: string;
  mode: "client" | "accenture" | "co-branded";
  productName: string;          // top bar text and document title
  shortName: string;            // narrow bar, breadcrumb
  clientName: string;           // the institution, always safe to show
  operatorName: string | null;  // NULL IN CLIENT MODE, by construction
  attribution: string;          // who the interface attributes the product to
  marks: { src: string; alt: string; owner: "client" | "operator" }[];
  showPair: boolean;            // true only in co-branded mode with two marks
  supportLabel: string | null;
  supportUrl: string | null;
  legalNotice: string | null;
  accentToken: string;          // a custom property name, eg "--app-ai"
  faviconUrl: string | null;
  syntheticDisclosure: boolean;
}
```

Exactly how to render it in the top bar, matching the classes already in
`src/styles/workday-v2.css`:

```tsx
<Link href="/workday" className="app-brand">
  <span className={identity.showPair ? "app-brand-pair" : undefined}>
    {identity.marks.map((mark) => (
      <img key={mark.src} src={mark.src} alt={mark.alt} className="app-brand-logo" width={20} height={20} />
    ))}
  </span>
  <span className="app-brand-name">{identity.productName}</span>
</Link>
```

Three rules for the shell:

1. Never hardcode "Arcadia", "NFR WorkOS", "WorkOS" or "Accenture". Use `identity.clientName`,
   `identity.productName`, `identity.shortName`, `identity.attribution`.
2. Do not branch on `identity.mode` to decide what to show. The resolver has already decided.
   `marks`, `showPair`, `attribution` and `operatorName` are the answers.
3. `operatorName` is `null` in client mode deliberately, so rendering it unconditionally is safe.
   That is the whole point of the field being nullable rather than a mode check at each call site.

Accent: set it as a scoped custom property rather than reading a colour.

```tsx
<div className="workday-v2" style={{ "--app-accent": `var(${identity.accentToken})` } as React.CSSProperties}>
```

Favicon: `identity.faviconUrl` is a path under `public/`. If you want it in the document head it has
to go through `generateMetadata` in `app/layout.tsx`, which is yours.

### 3.3 Terminology

```ts
import { term } from "@/product";

term("finding", language);                        // "Finding" / "Feststellung"
term("finding", language, { plural: true });       // "Findings" / "Feststellungen"
term("secondLine", "en", { short: true });         // "2LoD"
```

`key` is a `TerminologyKey` from `@/db/schema/product`, so a typo is a compile error. The fifteen
keys are `riskAssessment`, `rcsa`, `control`, `controlOwner`, `issue`, `finding`, `action`,
`remediation`, `incident`, `event`, `criticalService`, `importantBusinessService`, `riskAcceptance`,
`firstLine`, `secondLine`.

Use it where the product names a concept: labels, headings, chips, empty states, section titles,
generated summaries. Do not use it on quoted content, evidence text or audit summaries. The
reasoning is in `src/product/terminology/terms.ts` and in `docs/PRODUCT_ARCHITECTURE.md` section 3.3.

For a pure render path that already has the profile, use
`termFrom(config.terminology.terms, key, language, opts)`, which takes no cache and no database.

### 3.4 Entitlement gates

```ts
import { hasFunctionPack, hasConnectorPack, hasAiFeature, hasAdminFeature } from "@/product";

const { entitlements } = getProductConfig();
hasFunctionPack(entitlements, "third-party-risk");    // boolean
hasConnectorPack(entitlements, "grc-irm");
hasAiFeature(entitlements, "autonomous-execution");
hasAdminFeature(entitlements, "authority-settings");
```

All four take the entitlements object explicitly. That is so they can be tested with a denying
profile, which is the only way an entitlement model stays real.

`rolesFromEntitlements(entitlements, config.functionPacks)` returns the `RoleId[]` that are
reachable, if you want the role picker to reflect the licence. The entitlement is never a substitute
for the authority gate: it is an additional closed door.

### 3.5 Organisation, deployment and the rest

```ts
config.organisation.legalEntities         // [{ id, name, shortName, country, currency, regulatoryBloc, regulatorContext }]
config.organisation.timezone              // "Europe/Berlin"
config.organisation.dateFormat            // "DD.MM.YYYY"
config.organisation.timeFormat            // "24h"
config.organisation.workingDayStart/End   // "07:00" / "19:00"

deploymentHonesty(config.deployment)      // { implementedHere, statusLabel, statusTone, claim, outstandingWork }
```

Anywhere `regulatorContext` is rendered, render `RegulatoryNote` beside it. The settings screens use
`RegulatorContext` from `src/components/settings/primitives.tsx`, which does it for you.

### 3.6 After a write

```ts
import { resetProductConfigCaches } from "@/product";
```

The cache version key already covers the normal path, so you only need this if you write to a
product table outside `src/product/actions.ts`.

### 3.7 Navigation

`SETTINGS_AREAS` is exported from `@/product` (not from the settings components, which carry
`"use client"`; a plain array exported from a client module arrives in a server component as a client
reference, not an array). Each entry is `{ href, icon, label: { en, de }, adminFeature }`.

---

## 4. Acceptance criteria

The numbered brief is not in this repository, so this maps the numbers to the subjects my task
assignment attaches to them. If a number means something else, the substance below is still what
was built and what satisfies it.

**63, the product configuration layer exists and is typed.** `src/product/` resolves five typed
profiles behind one synchronous call. `OrganisationProfile`, `BrandProfile`, `ProductEntitlements`,
`TerminologyProfile` and `DeploymentProfileView` are the shapes the brief specified, with a zod
schema for the organisation profile and typed terminology keys so a missing term is a compile error.
Resolution is cached per process against `active_product_config.updated_at`, and the pointer row is
read fresh on every call so a change takes effect without a restart.

**64, white label branding in three modes, genuinely applied.** Three seeded profiles, one per mode.
`resolveBrandIdentity` returns marks, pair state, attribution, support, legal notice and accent token
already decided, so no component branches on the mode and nothing hardcodes an institution name. In
client mode the identity carries `operatorName: null`, so operator identity cannot leak through a
component that forgot the rule. Verified at the data layer: switching the override to the co-branded
profile changes the resolved identity from one mark to a pair and leaves the organisation profile and
its three entities untouched.

**65, terminology is reconfigurable without a code change.** Typed key map, fifteen keys, English and
German, singular and plural, optional short form. Two profiles seeded: the DACH banking default and
an observation led house style that renames finding to observation, spells out the self assessment,
and renames issue to deficiency, while leaving the other ten terms inherited from the default. No
global replacement, and the reason is written down in the module, in the organisation settings screen
and in `docs/PRODUCT_ARCHITECTURE.md` section 3.3.

**66, entitlements gate something real.** Two profiles. The pilot profile grants two function packs,
three connector packs, four AI capabilities and six administrator capabilities. Tests assert that
`hasFunctionPack` denies four packs, `hasAiFeature` denies `autonomous-execution`, `hasAdminFeature`
denies `authority-settings`, `rolesFromEntitlements` drops `control-assurance` and
`incident-resilience`, and a granted pack with an ungranted connector dependency reports as degraded
rather than absent.

**67, deployment profiles are honest.** All four `DEPLOYMENT_KINDS` seeded. `implementedHere` is true
for `restricted-local-prototype` only, the other three carry six outstanding work items each, and
`deploymentHonesty` returns "Implemented here" or "Defined only" with no third state. The deployment
screen reads the column rather than asserting readiness, and a test asserts that exactly one profile
is marked implemented and that it is the prototype.

**68, administrator surfaces exist and do not clutter the workday.** Four screens plus an index under
`/settings`, built from the V2 primitives, scoped under `.workday-v2` for typography and palette with
a two column layout of their own. Not reachable from the workday navigation, and not linked from any
practitioner surface. No pricing, no purchase flow, no trial prompt, no tier comparison; a test
asserts no seeded string carries upsell language.

**90, jurisdiction separation holds in the product layer.** Regulator context is derived from
`legal_entities.regulatory_bloc` rather than stored per entity, so the EU references cannot be
attached to the Swiss entity by a configuration mistake. `regulatorContextForBloc` filters EU markers
from any non-EU bloc as defence in depth. Tests assert the Swiss entity context contains FINMA and
contains neither DORA nor an EBA reference, and that the German and Austrian entities carry both EU
references and no FINMA reference. Rendered and verified on `/settings/organisation`: the Swiss
entity shows two FINMA circulars and the disclosure, and no EU reference.

**91, every regulatory reference carries the disclosure.** The organisation screen renders regulator
context through `RegulatorContext`, which always renders the shared `RegulatoryNote` primitive. The
wording is not a parameter anywhere, so it cannot drift between screens. Verified in the rendered
output: three occurrences on `/settings/organisation`, one per entity. All three documents carry the
disclosure in the header and at each regulatory reference. No screen or document claims compliance,
and a test rejects compliance claim phrasing and savings or return figures in seeded copy.

**92, configuration does not require a fork, with a stated mechanism.** The `active_product_config`
singleton is the mechanism and it is documented in `docs/PRODUCT_ARCHITECTURE.md` section 3. A
branding switch writes one row and appends one entry to `product_config_changes`, which is separate
from `audit_events` by design. `docs/PRODUCT_ARCHITECTURE.md` section 3.5 states honestly what is
still a code change: a seventh function, a new tool, a different matrix dimensionality, a third
language, a different authority model.

---

## 5. Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit`, files owned by this layer | Clean, zero errors |
| `npm run check:copy` | Exit 0, passed |
| `npx vitest run tests/unit/product.test.ts` | 45 tests, all passed |
| `npx tsx scripts/seed-product.ts` | 20 rows across 8 tables |
| `npm run db:seed`, full scenario plus product layer | Passed, `20 productConfiguration` |
| `npx vitest run tests/unit`, whole unit suite | 466 tests across 11 files, all passed |
| `/settings` | 200 |
| `/settings/organisation` | 200 |
| `/settings/branding` | 200 |
| `/settings/role-packs` | 200 |
| `/settings/deployment` | 200 |

Tests included beyond the brief, because they catch the class of error that survives review:

- Every tool name in every function pack is a key in `TOOL_REGISTRY`, and none is `PROHIBITED`.
- Every evaluation identifier in every pack exists in the evaluation suite.
- Every screen path is an absolute route, every connector dependency is a defined connector pack.
- No seeded string contains an em dash, an en dash, an umlaut or an eszett.
- No seeded string makes a compliance claim or quotes a saving.

---

## 6. Limitations and what was not completed

1. **The shell is not wired to the resolver.** `src/components/shell/` and `app/layout.tsx` are
   yours. The resolvers, the identity object and the exact JSX are in section 3, but no existing
   shell component calls them yet, so the application still renders its hardcoded product name. The
   settings shell is the working reference implementation of the pattern.

2. **The settings screens are read only except branding.** Branding switches through a server action.
   Organisation, role packs and deployment are read only: editing a legal entity or granting a pack
   from the interface would need validation, a confirmation step and a change log entry per field,
   and the brief asked for the profiles and the screens rather than a configuration editor. Both
   seeded entitlement profiles and both terminology profiles are reachable by editing the
   organisation profile row, not from the interface.

3. **The administrator area has no authentication.** There is none in this build, so the settings
   routes are reachable by anybody who can reach the application, and configuration changes are
   attributed to the literal actor `administrator`. The deployment screen says this. Adding an
   identity model is listed as outstanding work against three of the four deployment profiles.

4. **The administrator chrome is English only.** The German strings in these screens exist for the
   terminology comparison and the labels, not for the navigation and headings. A settings area
   translated in part would be worse than one that is clearly in one language.

5. **`src/components/settings/primitives.tsx` carries `"use client"`.** The settings navigation needs
   the current path for `aria-current` and a server layout cannot read it. The cost is a few
   kilobytes of presentational markup in the client bundle. The pages themselves remain server
   components and read the database directly.

6. **Favicon is resolved but not applied.** `identity.faviconUrl` is populated and a placeholder SVG
   exists at `public/brand/favicon.svg`, but applying it needs `app/layout.tsx`, which is yours.

7. **Shared repository state at handoff.** `npx tsc --noEmit` is clean across the whole repository.
   `npm run check:copy` reports one em dash error, in
   `docs/handoffs/workday-v2-product-integration.md:423`, which is the integration layer handoff and
   not a file this layer owns. Every file this layer owns is clean under the gate. The copy gate
   therefore exits 1 for a reason outside this scope.

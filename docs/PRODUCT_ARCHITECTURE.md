# Product Architecture

NFR WorkOS, the packaging model that turns one bank's application into a licensable product.

Synthetic institution and data. Every regulatory reference in this document carries the label
**Illustrative regulatory context, not legal advice.**

Primary sources:

| Concern | File |
|---|---|
| Product configuration schema, frozen and migrated | `src/db/schema/product.ts` |
| One import surface, the resolved configuration | `src/product/index.ts` |
| Organisation profile, legal entities, regulator context | `src/product/organisation/profile.ts` |
| Brand profile and the three modes | `src/product/branding/brand.ts` |
| Terminology, typed keys | `src/product/terminology/terms.ts` |
| Entitlements and the function pack catalogue | `src/product/entitlements/entitlements.ts` |
| Deployment profiles and the honesty flags | `src/product/deployment/deployment.ts` |
| Product configuration seed | `src/product/seed.ts` |
| Administrator settings area | `app/settings/` |
| Tests | `tests/unit/product.test.ts` |

---

## 1. The packaging model

Six layers. Each one is a separate thing a client either has or does not have.

```
Core
  + Function Packs            one per professional function
  + Connector Packs           one per source system family
  + Control and Trust Pack    authority, audit, evaluations, disclosures
  + Deployment Profile        how and where it runs
  + Client Configuration      the singleton that names the active everything
```

The reason for the split is commercial rather than technical. A DACH institution buying
non-financial risk tooling is almost never buying all six functions at once: the usual first phase is
operational risk and third party risk, with control assurance arriving after the first supervisory
conversation. If the product cannot be sold in that shape it cannot be sold at all, and if it can
only be sold in that shape by deleting code then every client is a fork.

### 1.1 Core

Core is everything that is true regardless of which functions a client licenses:

- The interactive workday shell, the navigation rail, the AI Partner surface and the live day
  player.
- The authority gate and the tool registry (`src/server/security/authority.ts`). The registry, not
  the prompt, is the security boundary, so it cannot be a pack.
- The audit service and the append only audit trail.
- Evidence retrieval, provenance classification and the five grounding categories that keep verified
  fact, approved record, stakeholder statement, model inference and conflicting evidence apart.
- Decision and approval mechanics, including the rule that an agent cannot grant its own approval.
- The scenario run container, the shared timeline and the reset path.
- The product configuration layer documented here.
- The permanent synthetic data disclosure and the regulatory disclosure primitive.

Core is not licensable separately and has no entitlement flag. A deployment without the authority
gate is not a smaller product, it is a different and much worse one.

### 1.2 Function packs

Six packs, one per professional function. Each pack is a complete vertical: its domain objects, the
roles it serves, the governed tools it may call, the screens it contributes, the evaluation cases
that must pass for it, and the connector packs it depends on to be useful.

**2 flagship packs** have production-shaped role apps and fully wired process pages.
**4 preview packs** have the role home, decision queue and AI partner, with role apps in preview status.

| Pack | Primary role | Depth | Contains |
|---|---|---|---|
| `rcsa-operational-risk` | `rcsa` | Flagship | Process, risk, control, assessment and indicator objects. Off cycle reassessment, challenge preparation, residual risk positions. Fourteen governed tools including `updateAssessment` and `proposeAndRecordResidualRisk`. |
| `third-party-risk` | `tprm` | Flagship | Supplier, service, contract and obligation objects. Exposure through subprocessors and fourth parties, submission comparison against the contract, criticality and restriction decisions. |
| `control-assurance` | `control-assurance` | Preview | Control, test, exception and finding objects. Test populations where every override is evidenced, exception classification separating systemic from isolated, findings whose severity a human decides. |
| `incident-operational-resilience` | `incident-resilience` | Preview | Incident, service and loss objects. Chronology with provenance per entry, impact tolerance headroom, recovery option trade offs, a supervisory notification recommendation that notifies nobody. |
| `regulatory-change` | `regulatory-change` | Preview | Obligation and policy objects. Applicability decided per legal entity, which is the mechanism that keeps an EU requirement off the Swiss entity. |
| `nfr-governance` | `nfr-governance` | Preview | Decision, approval, theme and meeting objects. One matter as every contributing function sees it, portfolio materiality, committee agenda order, the end of day account. |

Every tool name in every pack is a key in `TOOL_REGISTRY` and every screen is a route that exists.
`tests/unit/product.test.ts` asserts both. A pack listing a tool the product does not have is a
capability claim that survives code review and fails in front of a client, so it is checked
mechanically rather than by reading.

A pack has three independent states, and the role packs settings screen shows all three:

- **Defined.** A row exists in `function_packs`.
- **Granted.** The active entitlement profile includes the pack identifier.
- **Enabled.** The pack's own `enabled` column is true.

A pack can be granted and degraded: licensed, but missing a connector pack it depends on. That is
reported as a missing dependency rather than as an absent feature, because "licensed and partly
blind" and "not licensed" are different situations and an administrator needs to tell them apart.

### 1.3 Connector packs

Ten families, defined in `src/db/schema/integration.ts`, each covering several named adapters:
Microsoft 365, GRC and IRM platforms, service management, process intelligence, document and
knowledge stores, procurement and third party platforms, data platforms, identity and access,
regulatory content, and a generic REST and webhook pack. Connector packs are owned by the
integration layer and documented there; the product layer only decides which of them an entitlement
profile grants.

### 1.4 Control and Trust pack

Not separately licensable and listed here so that it is clear it is not an add on: the authority
matrix, the audit trail, the evaluation suite, the guardrails, the jurisdiction separation rules and
the disclosure primitives. Every deployment has them. A product that sold its own accountability
layer as an upgrade would be making the wrong thing optional.

### 1.5 Role apps

A role app is a packaged, stage-gated process inside a function pack, operated
by the AI partner on behalf of a named role. It is finer-grained than a
function pack: a function pack is the licensing unit; a role app is one specific
workflow within it.

The contracts, run model and registry are at:

| File | Contents |
|---|---|
| `src/role-apps/contracts.ts` | `RoleAppDefinition`, `RoleProcessDefinition`, `RoleAppRun` types |
| `src/role-apps/registry.ts` | The full catalogue (installed and preview) |
| `src/role-apps/rcsa/definition.ts` | RCSA Cycle Assistant definition and seeded run |
| `src/role-apps/tprm/definition.ts` | Third-Party Onboarding definition and seeded run |

**Installed apps** (production-shaped, routed):

- `rcsa-cycle-assistant` inside `nfr-operational-risk`, entry at `/workday/rcsa/processes/rcsa-cycle`
- `tprm-third-party-onboarding` inside `nfr-third-party-risk`, entry at `/workday/tprm/process/tprm-third-party-onboarding`

**Preview apps** (in registry, not yet routed): RCSA Event-Driven Reassessment,
RCSA Rapid Assessment, TPRM Periodic Reassessment, TPRM Exit Planning, TPRM
Fourth-Party Deep Dive.

An administrator can see all defined apps at `/settings/role-apps`. A run is
currently in-memory (seeded on startup); a persistent `role_app_runs` table is
the next engineering step.

### 1.6 Deployment profile

Four shapes. One of them is what this repository runs. See `docs/DEPLOYMENT_PROFILES.md`.

### 1.6 Client configuration

The organisation profile, the brand profile, the terminology profile, the entitlement profile and
the deployment pointer, plus the singleton that says which of each is active. This is the layer that
exists so that a second institution is a configuration change.

---

## 2. Dedicated deployment per bank

The initial design is one dedicated environment per institution. A shared public multi-tenant SaaS
data plane was considered and explicitly not chosen. Four reasons, in the order a bank would raise
them.

**Data residency and the supervisory question.** A DACH institution has to be able to name the
jurisdiction its operational risk records sit in, and a Swiss entity under FINMA supervision has a
different answer from its German sibling. A shared data plane makes that answer a function of
infrastructure topology rather than of contract, and the first question in any outsourcing
assessment is one the architecture should be able to answer in a sentence.
*Illustrative regulatory context, not legal advice.*

**The blast radius of a cross-tenant defect.** The records in this product are risk ratings,
findings, incident chronologies and supervisory notification recommendations. A tenancy isolation
bug in a customer relationship system leaks contact details; the same bug here leaks one bank's
unresolved control failures to another bank. The severity asymmetry is large enough that the cheaper
architecture is not the better one.

**Model endpoint control.** Several of the deployment profiles assume an institution supplied or
institution brokered inference endpoint, in some cases one with no public egress at all. That is a
per institution property of the environment, and a shared data plane would have to either forbid it
or run a separate inference path per tenant, which is most of the cost of separate environments
without the isolation.

**Change control.** Institutions in this sector operate release windows and change freezes. A shared
plane upgrades everybody at once, which is the right answer for consumer software and the wrong
answer for a system that feeds a risk committee pack.

What is given up by this choice is stated plainly: per tenant operating cost is higher, upgrades are
fleet management rather than a single deploy, and there is no cross-institution benchmarking data
plane. The provisioning and teardown work this implies is listed as outstanding against the
`dedicated-managed` profile rather than described as solved.

---

## 3. Configuration, not fork

The claim is that a second institution requires configuration rather than a code change. The claim
is only worth making if there is a mechanism behind it, so here is the mechanism.

### 3.1 The singleton

`active_product_config` has one row, with the primary key `active`. It names an organisation profile
and optionally overrides the brand profile that organisation points at. Everything else is reached
through it:

```
active_product_config (id = "active")
  -> organisation_profiles          institution, legal entities, locales, calendar
       -> terminology_profiles      the words the product uses for a concept
       -> brand_profiles            marks, names, support, legal notice, accent
       -> entitlement_profiles      function packs, connector packs, capabilities
       -> deployment_profiles       identity, residency, endpoints, retention
  -> brand_profile_id_override      set when an administrator switches branding
```

`getProductConfig()` in `src/product/index.ts` resolves that whole graph into one object. It is
synchronous, it never throws, and it is cached per process against a version key built from the
singleton's `organisation_profile_id`, `brand_profile_id_override` and `updated_at`. The pointer row
itself is read fresh on every call, which is deliberate: the pointer read is a primary key lookup
against a one row table, and caching it would mean a configuration change did not take effect until
the process restarted, which is exactly the failure this layer cannot afford.

Where the configuration is absent, the resolvers return documented fallbacks and the resolved object
reports `configured: false`. The administrator area therefore stays reachable on an unmigrated
clone, which matters because that is the state in which somebody needs to read it.

### 3.2 What a branding change actually writes

Switching the product from client branded to co-branded updates `brand_profile_id_override` and
`updated_at` on one row, and appends one row to `product_config_changes`. No risk, control, supplier,
assessment, incident, decision, approval or audit event is read or written. The workday then
re-renders against the new identity with every recorded decision intact. That is the structural form
of the claim, and it is what the branding test exercises.

`product_config_changes` is deliberately separate from `audit_events`. A reviewer asking who changed
the branding and a reviewer asking who approved the residual risk rating are asking different
questions of different systems, and a single log would make both harder to read.

### 3.3 Terminology is a key map, not a replacement pass

A bank that calls a finding an observation gets "observation" everywhere the product names that
concept and nowhere else. The keys are typed (`TERMINOLOGY_KEYS`), so a missing default is a compile
error rather than a raw key rendered to a client, and a stored profile holds only the terms it
changes.

A global string replacement was rejected, and the reason is worth stating because the shortcut is
tempting and the damage is not obvious. Replacing "finding" with "observation" across the rendered
output would also rewrite the word inside the seeded evidence corpus, the audit trail summaries and
the quoted passages of a supplier attestation. The product would then be displaying a source
document that says something the source document does not say. In a product whose central claim is
that every statement traces to a cited source, that is the worst available failure. The product
renames concepts; it never edits evidence.

### 3.4 Regulator context is derived, not stored

`organisation_profiles` stores legal entity identifiers. It does not store a per entity list of
regulatory references. The references are derived at resolve time from `legal_entities.regulatory_bloc`:
the EU bloc resolves to the digital operational resilience regulation and the relevant EBA
guidelines, the Swiss bloc resolves to the FINMA circulars.

The failure mode this prevents is concrete. A hand maintained per entity list drifts: somebody adds a
reference for the EU entities, copies the array onto the Swiss entity because it looks like the same
list, and the interface now states that an EU regulation applies to a Swiss bank. Deriving from the
bloc makes that unreachable, because no entity row carries references at all. A filter in
`regulatorContextForBloc` removes EU markers from any non-EU bloc as defence in depth behind the
derivation, and `tests/unit/product.test.ts` asserts that the Swiss entity context contains FINMA
and contains neither DORA nor an EBA reference.
*Illustrative regulatory context, not legal advice.*

### 3.5 What is still a code change

Honesty about the limit of the claim. These are configuration:

- Institution name, legal entities, countries, currencies, locales, timezone, date and time format,
  working calendar.
- The words the product uses for its fifteen core concepts, in English and German.
- Marks, product name, support label and link, legal notice, accent token, branding mode.
- Which function packs, connector packs, AI capabilities and administrator capabilities a deployment
  has.
- Which deployment profile is in force.

These are not configuration, and a client wanting them needs engineering work:

- A seventh function, meaning a new professional function with its own objects and tools.
- A new tool, because tools are registry entries with an authority class and scopes, and adding one
  is a security relevant change.
- A different risk matrix dimensionality. The group five by five matrix is in the domain
  calculators.
- A new language. English and German interface copy exist; a third language is a translation
  project, not a profile.
- A different authority model. Autonomy levels and scopes are in Core by design.

---

## 4. Request path

```
request
  -> app/settings/layout.tsx          getProductConfig(), one cached read
  -> app/settings/<area>/page.tsx     resolved profiles, no second query
  -> form submit
  -> src/product/actions.ts           validate, write one row, append one change row
  -> resetProductConfigCaches()
  -> revalidatePath("/settings") and revalidatePath("/workday")
```

The settings area is scoped under `.workday-v2` so it inherits the application typography, the
graphite palette and the focus treatment, with its own two column layout. It is not the workday
shell: a practitioner handling an incident has three columns and a live day track because events are
arriving, and an administrator reading a quarterly configuration does not.

The settings area is not linked from the workday navigation. Administrator surfaces in the working
interface are clutter at best, and at worst they invite a practitioner to change a product setting
in the middle of an incident.

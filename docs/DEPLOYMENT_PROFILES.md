# Deployment Profiles

NFR WorkOS, the four deployment shapes and an honest statement of what this prototype runs.

Synthetic institution and data. Every regulatory reference in this document carries the label
**Illustrative regulatory context, not legal advice.**

Primary sources:

| Concern | File |
|---|---|
| Profile resolution and honesty flags | `src/product/deployment/deployment.ts` |
| Seeded profiles | `src/product/seed.ts` |
| Deployment settings screen | `app/settings/deployment/page.tsx` |
| Schema | `src/db/schema/product.ts`, `DEPLOYMENT_KINDS` |

---

## 0. Read this first

**One of the four profiles below is implemented. Three are designed and documented and are not
implemented in this build.**

`deployment_profiles.implemented_here` carries that distinction in the database. The settings screen
reads the column rather than describing readiness in prose, and
`tests/unit/product.test.ts` asserts that exactly one profile has the flag set and that it is the
prototype. A capability claim that lives only in a document drifts from the build within a sprint and
the first person to notice is the client who tried it; a claim held in a column that the screen
renders and a test asserts moves with the build or fails.

There is no third state meaning "partly implemented". It was considered and rejected, because in
practice everything becomes partly implemented and the distinction a reader needs is whether they
can run it today.

---

## 1. What this prototype actually runs

Profile `deployment-restricted-local`, kind `restricted-local-prototype`. This is the honest
inventory, not a summary of intent.

| Dimension | Reality |
|---|---|
| **Topology** | One Node process on one machine. One local SQLite file at `data/nfr-workos.db`, write ahead logging on. No service boundary, no queue, no second process. |
| **Identity** | None. There is no authentication and no authorisation of a human user. The acting role is scenario state in `scenario_runs.active_role_id`, so switching role is a demonstration control, not an identity change. Product configuration changes are attributed to the literal actor `administrator`, because attributing them to a named person would be an invention. |
| **Data residency** | Wherever the machine is. No region, no replication, no residency guarantee beyond the file system. |
| **Model endpoints** | An operator supplied endpoint, read from the environment once at startup by `src/server/config/load-openai-config.ts`. Safe mode serves cached outputs and makes no network call. Offline mode makes no call at all. No provider is named in the interface. |
| **Retention** | Until the local database file is deleted or `demo:reset` rewrites the run. No backup, no export schedule, no second copy. |
| **Observability** | Console logging through the redacting logger in `src/server/logging/redact.ts`, plus the in product audit trail. No external telemetry sink, no trace export, no metrics endpoint. |
| **Audit boundary** | The audit trail inside the product. There is no second system to reconcile against and no external attestation of it. |
| **Tenancy** | Single. There is no tenant concept in the schema. |
| **Data** | Entirely synthetic. One institution, Arcadia Banking Group, three legal entities, invented people, suppliers, controls, incidents and ratings. |

What follows from that, stated so nobody has to infer it: this build is suitable for demonstration,
design review and evaluation of the interaction model. It is not suitable for holding a real
institution's non-financial risk records, and nothing in it should be read as a statement about
regulatory compliance.
*Illustrative regulatory context, not legal advice.*

---

## 2. The four profiles

Each profile below answers the same seven questions: identity, data residency, model endpoints,
retention, observability, audit boundary, and what is still outstanding.

### 2.1 `restricted-local-prototype`, implemented here

Covered in section 1. Version `1.0.0`, environment `prototype`, `outstandingWork` empty, because the
profile describes what exists rather than what is planned.

### 2.2 `dedicated-managed`, defined only

One dedicated environment per institution, operated by the provider in a named EU or Swiss region.
The institution is data controller, the provider is processor.

- **Identity.** Federated to the institution identity provider by OIDC, group to role mapping, no
  local accounts.
- **Data residency.** One named region per institution, EU or Switzerland, no cross region
  replication. The region is named in the trust page rather than described as "European".
- **Model endpoints.** A regional endpoint under a zero retention agreement, with the endpoint and
  the region named in the trust page.
- **Retention.** Per object class, agreed contractually, with legal hold and verified deletion on
  exit.
- **Observability.** Provider operated logging and tracing, with the audit trail exported to the
  institution on a schedule.
- **Audit boundary.** The provider's, with a contractual right of audit and a scheduled export into
  the institution's own evidence store.

Outstanding work:

1. Tenant provisioning and teardown, including a verified data deletion path on exit.
2. OIDC federation, group to role mapping and session handling, replacing scenario role state with
   real identity.
3. Per tenant encryption key management and a documented key rotation procedure.
4. A processor agreement, a transfer impact assessment and a subprocessor register for the model
   endpoint.
5. Backup, restore and a tested recovery time objective for the tenant database.
6. Change management, release notes and a staging environment per tenant.

### 2.3 `customer-managed-private`, defined only

The institution runs the product in its own subscription from a provider supplied container image.
The data plane never leaves the institution's estate and the provider holds no copy.

- **Identity.** The institution's identity provider, configured by the institution. The provider has
  no standing access.
- **Data residency.** Wherever the institution runs it. The provider cannot state a region because
  the provider does not choose it.
- **Model endpoints.** The institution's endpoint, configured by the institution. The provider never
  holds the credential.
- **Retention.** Entirely the institution's policy. The product exposes retention settings and
  enforces nothing of its own.
- **Observability.** The institution's logging stack. The product emits structured events and ships
  them nowhere by itself.
- **Audit boundary.** The institution's. This is the profile with the cleanest audit story and the
  hardest support story, and those two facts are the same fact.

Outstanding work:

1. A hardened container image, a published software bill of materials and a signed release chain.
2. An installation and upgrade runbook that assumes no provider access to the environment.
3. External configuration and secret handling through the institution's secret manager rather than
   environment files.
4. A migration path the institution can run itself, with a rollback that has been tested.
5. A support model that works without the provider being able to read the data or the logs.
6. Replacing the local SQLite store with a database the institution already operates.

### 2.4 `bank-private-cloud`, defined only

Deployed onto the institution's internal platform inside the existing regulated perimeter,
inheriting its network controls, its change process and its audit boundary.

- **Identity.** Internal single sign on and privileged access management, with break glass under
  existing controls.
- **Data residency.** The institution's own data centres or private cloud footprint.
- **Model endpoints.** An internally hosted or internally brokered endpoint. No egress to a public
  inference endpoint. This profile has to work in the case where no inference capability is
  available at all, which means the product's safe and offline modes are a requirement here rather
  than a demonstration convenience.
- **Retention.** The institution's records management schedule, applied by the platform rather than
  by the product.
- **Observability.** The institution's monitoring, logging and security operations tooling.
- **Audit boundary.** The institution's own, which is the point of the profile.

Outstanding work:

1. Platform conformance: base image, network policy, service mesh and secret management to the
   institution's standard.
2. Internal model endpoint integration, including the case where no inference capability is
   available at all.
3. Penetration test, threat model and architecture review through the institution's own governance.
4. Operating under the institution's change freeze calendar and release windows.
5. Disaster recovery that fits the institution's existing tiering rather than defining its own.
6. Evidence packs for internal audit mapped onto the institution's control framework.

---

## 3. Comparison

| | `restricted-local-prototype` | `dedicated-managed` | `customer-managed-private` | `bank-private-cloud` |
|---|---|---|---|---|
| Implemented in this build | **Yes** | No | No | No |
| Who operates it | The person running it | Provider | Institution | Institution platform team |
| Identity | None | OIDC federation | Institution's | Internal SSO and PAM |
| Named region | No | Yes, one per institution | Institution's choice | Institution's own estate |
| Provider holds data | n/a | Yes, as processor | No | No |
| Public inference egress | Operator's choice | Yes, regional, zero retention | Institution's choice | No |
| Audit boundary | In product only | Provider, with export | Institution | Institution |
| Hardest part | Nothing, it exists | Tenant lifecycle and deletion proof | Support without access | Platform conformance |

---

## 4. What is true in every profile

These are Core properties, not per profile ones, and they do not change with the deployment shape:

- Every mutation passes through the authority gate in `src/server/security/authority.ts`. There is no
  privileged interface route.
- Material changes require a human approval bound to one specific payload, and the approval cannot
  be replayed.
- An agent cannot grant its own approval.
- The audit trail is append only. `modifyAuditTrail` exists in the registry as a prohibited tool so
  that the refusal is explicit and testable.
- Credential material is never logged, rendered or returned. Credential state in the interface is a
  state only: absent, present, invalid, or not required.
- Supervisory notification is a recommendation recorded in the product. The product never contacts a
  supervisory authority. `notifySupervisor` is a prohibited tool.
- Jurisdiction separation holds: the EU digital operational resilience regulation and the EBA
  guidelines are referenced against the German and Austrian entities, the FINMA circulars against
  the Swiss entity, and the Swiss entity never carries an EU reference. Every regulatory reference
  renders the disclosure.
  *Illustrative regulatory context, not legal advice.*
- The synthetic data disclosure is shown and cannot be configured away.

---

## 5. How to check this document against the build

```
npx tsx scripts/seed-product.ts          # writes the four profiles
npx vitest run tests/unit/product.test.ts # asserts exactly one is implemented
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/settings/deployment
```

The deployment settings screen renders every profile with its implemented or defined mark and its
outstanding work. If this document and that screen ever disagree, the screen is right, because the
screen reads the database and the database is what the seed and the tests check.

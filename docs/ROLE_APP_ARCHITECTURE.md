# Role App Architecture

The type contract, registry, run model and administrator surface for packaged
AI-guided processes in NFR WorkOS.

Synthetic institution and data. Every regulatory reference in this document carries the label
**Illustrative regulatory context, not legal advice.**

---

## 1. What a role app is

A role app is a packaged, stage-gated process that the AI partner guides a
named professional role through, from an opening trigger to a closed record.
The term is specific: it is not a synonym for function pack, plugin or
workflow.

### 1.1 Role app vs function pack

A **function pack** is the licensing unit. It names a professional function
(`rcsa`, `tprm`, etc.), defines what domain objects it manages, what governed
tools it may call, and what screens it contributes to the deployment. One pack
covers everything that belongs to one profession.

A **role app** is one structured process inside that pack. The RCSA function
pack owns risks, controls, assessments and indicators. The RCSA Cycle Assistant
is the role app that guides the Operational Risk Partner through the eight-stage
RCSA lifecycle within that pack. One pack can contain several role apps (for
example, a standard cycle assistant and an event-driven reassessment app), and
a future pack edition could add a new role app without touching the pack's
domain objects or tool registry.

### 1.2 Role app vs connector pack

A **connector pack** is a family of data source adapters: the Microsoft 365
adapter, the GRC platform adapter, and so on. A role app declares which
connector packs it needs in order to function
(`requiredConnectorPackIds`), but it does not own those adapters. The
integration fabric resolves freshness and availability for each connector; the
role app only records whether the dependency is met.

### 1.3 Role app vs plugin

There is no plugin surface in this product. A third-party code upload path
was evaluated during architecture design and rejected. The authority gate
is a pure function that never reads free text, and a plugin that could
register tools or modify the gate would undermine the security boundary the
product's accountability claim rests on. Role apps are first-party
definitions, code-reviewed and registered, not runtime uploads.

---

## 2. The type contract

The contracts are in `src/role-apps/contracts.ts`. Three primary types.

### 2.1 RoleAppDefinition

The static description of a role app. Immutable: written by an engineer,
versioned with the codebase, and changed only through a code review and
deployment.

```ts
interface RoleAppDefinition {
  id: string;             // Stable kebab-case slug, unique across all apps
  roleId: "rcsa" | "tprm";
  functionPackId: string; // The pack this app belongs to
  name: string;           // English display name
  nameDe: string;         // German name, ASCII only, no umlauts
  summary: string;        // One sentence, English
  summaryDe: string;      // One sentence, German, ASCII only
  status: RoleAppStatus;  // installed | available | preview | disabled
  maturity: RoleAppMaturity; // production-shaped | prototype | concept
  version: string;        // Semantic version, e.g. "1.0.0"
  entryRoute: string | null; // Route the home page links to, null if not routed
  processId: string;      // The process definition this app implements
  coveredStageIds: string[];
  requiredConnectorPackIds: string[];
  humanDecisionKinds: string[];
}
```

`status` describes the lifecycle in a given deployment. `maturity` describes
design completeness independent of deployment. A preview-status app in a
development environment and a preview-status app in a client-facing demo are
the same maturity; they differ in status.

### 2.2 RoleProcessDefinition

The ordered, stage-by-stage description of the process a role app
implements. Process definitions are stable and can outlive individual app
versions. Two role apps could implement the same process at different
complexity levels (for example, a full eight-stage cycle and a rapid
four-stage variant).

Each stage declares:
- its unique `id` (stable, used in routing)
- the human responsibility (the one thing only the professional can do)
- the object kinds the AI works across
- the `decisionKinds` presented in that stage (matches the `judgment_kind`
  column on the decisions table)

The `decisionKinds` field is the structural connection between the stage map
and the authority gate: a stage that lists `residual-risk` as a decision kind
will surface decisions of that kind when the run reaches it. The authority
gate checks the decision against the role's scopes, not against the stage.

### 2.3 RoleAppRun

A live instance of a role app process for one subject at one point in time.

```ts
interface RoleAppRun {
  id: string;
  roleAppId: string;
  roleId: "rcsa" | "tprm";
  subjectKind: string;   // "assessment" for RCSA, "supplier" for TPRM
  subjectId: string;     // e.g. "RCSA-ARC-DE-PAYOPS-2026-Q4"
  currentStageId: string;
  status: RoleAppRunStatus;
  startedAt: string;     // ISO timestamp
  updatedAt: string;
  completedAt: string | null;
}
```

`status` is one of: `not-started`, `in-progress`, `waiting-for-input`,
`waiting-for-approval`, `completed`, `blocked`.

---

## 3. The registry

`src/role-apps/registry.ts` exports three things:

```ts
ROLE_APP_REGISTRY  // readonly RoleAppDefinition[], all apps, installed and preview
getRoleApps(roleId)  // filter to one role
getRoleApp(id)       // lookup by app id
```

The registry is the single import for any surface that needs to enumerate
or look up apps. The process page, the home page Now item and the
administrator settings screen all read from it rather than importing
individual definitions.

### 3.1 What goes in the registry

Every app that should be visible to an administrator or reachable from the
role home, regardless of status. An app in the registry at `preview` status
appears in `/settings/role-apps` and in the role selector, but its
`entryRoute` is null, so the home page cannot navigate to a process page
that does not exist.

An app that is omitted from the registry does not exist in any visible sense
until a code change adds it. The registry is therefore the product roadmap
for role apps, expressed as code rather than as a slide.

### 3.2 Installed apps (V3.2)

| App id | Role | Pack | Entry route |
|---|---|---|---|
| `rcsa-cycle-assistant` | `rcsa` | `nfr-operational-risk` | `/workday/rcsa/processes/rcsa-cycle` |
| `tprm-third-party-onboarding` | `tprm` | `nfr-third-party-risk` | `/workday/tprm/process/tprm-third-party-onboarding` |

### 3.3 Preview apps (V3.2)

| App id | Role | Status | Maturity |
|---|---|---|---|
| `rcsa-event-driven-reassessment` | `rcsa` | preview | prototype |
| `rcsa-rapid-assessment` | `rcsa` | preview | concept |
| `tprm-periodic-reassessment` | `tprm` | preview | prototype |
| `tprm-exit-planning` | `tprm` | preview | concept |
| `tprm-fourth-party-review` | `tprm` | preview | concept |

---

## 4. How runs are persisted

Runs are currently in-memory: the seeded `RoleAppRun` objects are imported
into the process page server component and returned as the active run. No
`role_app_runs` table exists yet.

The consequence is that a run does not persist between restarts and that
multiple tabs or multiple users would not see a consistent run state. This is
acceptable for the demo because:

1. The demo day has a fixed seeded baseline, restored by `npm run demo:reset`.
2. A decision that progresses a stage is expressed as a mutation against the
   scenario state (decisions, approvals, audit events), not as a mutation
   against a run row.
3. The process page reconstructs the current stage from the seeded run and
   the live decision/approval state, so the seeded `currentStageId` is a
   starting point rather than a live pointer.

The next engineering step is a `role_app_runs` table in the Drizzle schema,
with a row per run and a foreign key to the user who started it. The
`getRoleApp` and `getRoleApps` functions in the registry do not need to
change; the process page just switches from reading a seeded constant to
querying the database.

---

## 5. How stage IDs connect to decision kinds

The connection is through `RoleProcessStage.decisionKinds`. The sequence is:

1. The run arrives at a stage. `currentStageId` is set.
2. The process page reads `RoleProcessStage.decisionKinds` for that stage.
3. Open decisions from `decisions` are filtered to those whose `judgment_kind`
   is in that list.
4. The authority gate checks each decision against the acting role's scopes
   before surfacing it.
5. A human decision produces a mutation through the governed tool path.
6. The mutation closes the decision row and, when all decisions for the stage
   are closed, marks the run ready to advance.

The `humanDecisionKinds` on `RoleAppDefinition` is the union of all decision
kinds across all stages the app covers. It is carried at the definition level
for display in the administrator registry view and in the role app store;
the authoritative list per stage is on the stage rows in
`RoleProcessDefinition.stages`.

---

## 6. How the home page Now item connects to an active run

The role home reads the focus queue from `src/db/repositories/focus.ts`. The
`buildFocusCandidates` function returns the open decisions and the AI
suggestions for the active run. When an in-progress run exists:

- The `Now` slot shows the highest-priority open decision for the run's
  current stage.
- The decision card carries an `href` that points to the process page route
  (the `entryRoute` of the installed app plus a stage fragment when the
  process page supports deep links).
- The `Next` slots show additional open decisions or prepared suggestions.

For preview apps, no run exists and no Now item appears. The role home shows
an inert card that names the preview app and links to the administrator
registry, so the absence of a run is visible and documented rather than
silent.

---

## 7. Administrator controls

The administrator surface for role apps is `/settings/role-apps`. It shows:

- All apps in the registry, grouped by role
- Status and maturity for each
- Entry route (or "not routed" for preview/concept apps)
- Covered stage IDs and required connector packs
- Human decision kinds

What it does not show or do (by design):

- No install or purchase flow. A pack that is not granted is reported as not
  granted, and nothing more.
- No pricing. The administrator area does not sell.
- No enable/disable per analyst. A non-functional Enabled toggle is shown
  for installed apps to indicate where that control will live when the
  tenant-level enable/disable feature is built.
- No third-party code upload. There is no plugin surface. See section 1.3.

The `status` field on a `RoleAppDefinition` is the administrative state that
an enable/disable control will write to when the feature is built. An app
with `status = "disabled"` is provisioned but switched off; its process page
still exists but the role home does not surface a run for it.

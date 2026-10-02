# V4 AI Quality Contract -- Handoff

**Agent C, V4.0** | Built: 2026-10-02

---

## Summary

This handoff documents the AI quality contract implementation for NFR WorkOS V4.0.
The work covers typed response envelopes, source completeness status, a static prompt
registry, seeded offline responses, an administrator settings page, a rendering
component, and a unit test suite.

---

## Files created

### Core contracts

**`src/ai/contracts.ts`**
- Typed response envelope: `AssistantResponseEnvelope`
- Discriminated union: `AssistantResponsePart` (11 kinds: answer, fact, inference,
  uncertainty, evidence, recommendation, proposed-action, approval-request,
  execution-receipt, blocked-action, follow-up)
- Supporting types: `RequiredSourceStatus`, `AssistantResponseContext`
- `validateEnvelope(envelope: unknown): string[]` -- manual validator, no Zod

**`src/ai/source-status.ts`**
- `SourceCompletenessStatus` union (5 values)
- `computeSourceCompleteness(required: RequiredSourceStatus[]): SourceCompletenessStatus`
  Priority: unavailable beats stale beats complete
- `getDisplayStatus(status): string` -- categorical label, no percentages

**`src/ai/prompt-registry.ts`**
- `ModelProfile` type (id, provider, modelId, maxTokens, temperature, purpose)
- `AIConfigurationVersion` type (id, name, roleId, taskKind, versions, status)
- `MODEL_PROFILES: ModelProfile[]` -- 2 profiles (gpt-4o-mini-structured, gpt-4o-reasoning)
- `AI_CONFIGURATION_REGISTRY: AIConfigurationVersion[]` -- 2 released configurations
- `getReleasedConfig(roleId, taskKind): AIConfigurationVersion | undefined`
- `getModelProfile(id): ModelProfile | undefined`
- Static code registry. DB-backed registry is the documented next step.

**`src/ai/offline-responses.ts`**
- `RCSA_EVIDENCE_REFRESH_OFFLINE_RESPONSE: AssistantResponseEnvelope`
  RCSA-ARC-DE-PAYOPS-2026-Q4, 5 parts, isLimited=true, 2 unavailable sources
- `TPRM_EVIDENCE_REVIEW_OFFLINE_RESPONSE: AssistantResponseEnvelope`
  TP-0099 Veridian, 5 parts, isLimited=true, 2 unavailable sources

### Settings page

**`app/settings/ai-quality/page.tsx`**
- Administrator-only, server component, `force-dynamic`
- Sections: Registry summary, Released configurations, Model profiles,
  Evaluation suite status, Source completeness display labels, Regulatory context
- Uses `var(--app-*)` tokens, matches existing settings page pattern
- Imports from `@/ai/prompt-registry` and `@/ai/source-status`
- Regulatory context note: "Illustrative regulatory context, not legal advice."
- No dark theme override, no confidence percentages

### Rendering component

**`src/components/workday-v3/AIResponseDisplay.tsx`**
- Server component (no "use client" directive)
- Renders `AssistantResponseEnvelope` as typed parts
- Part rendering:
  - `answer` -- plain paragraph
  - `fact` -- green left-border callout with source chips and "Verified fact" label
  - `inference` -- purple left-border callout with italic "AI inference -- not an approved record" label (mandatory, not a prop)
  - `uncertainty` -- amber callout with `role="alert"`, rendered only when `requiredForCompletion`
  - `evidence` -- bordered block with evidenceId and freshness
  - `recommendation` -- neutral bordered block; shows limitation warning when `isLimited`
  - `blocked-action` -- red callout with `role="alert"`
  - Other kinds (proposed-action, approval-request, execution-receipt, follow-up) render null; interactive variants are a future addition
- `SourceStatusFooter` -- shows unavailable sources when `isLimited`
- Uses `var(--wd-*)` tokens with inline fallbacks

### Tests

**`tests/unit/ai-contracts.test.ts`**
- 28 tests, all passing
- Covers: validateEnvelope (valid, missing responseId, invalid mode, non-array parts, non-object input, all valid modes), computeSourceCompleteness (all-loaded, unavailable, stale, stale+unavailable priority, empty list), getDisplayStatus (all statuses, no percentages), getReleasedConfig (RCSA, TPRM, unknown roleId, unknown taskKind, registry integrity), both seeded offline responses (validate cleanly, mode, isLimited, part types, unavailable sources)

---

## Files modified

**`src/product/entitlements/entitlements.ts`**
- Added `"ai-quality"` to the `AdminArea["icon"]` union
- Added AI quality area to `SETTINGS_AREAS`:
  `{ href: "/settings/ai-quality", icon: "ai-quality", label: { en: "AI quality", de: "KI-Qualitat" }, adminFeature: null }`

**`src/components/settings/primitives.tsx`**
- Imported `IconSparkles` from `@tabler/icons-react`
- Added `"ai-quality": IconSparkles` to `AREA_ICONS`

---

## What is implemented vs. designed-only

| Item | Status |
|---|---|
| `AssistantResponseEnvelope` type | Implemented |
| `validateEnvelope` manual validator | Implemented |
| All 11 `AssistantResponsePart` kinds (types) | Implemented |
| `RequiredSourceStatus` + `computeSourceCompleteness` | Implemented |
| `getDisplayStatus` (no percentages) | Implemented |
| `MODEL_PROFILES` static registry | Implemented |
| `AI_CONFIGURATION_REGISTRY` static registry | Implemented |
| `getReleasedConfig` / `getModelProfile` | Implemented |
| RCSA offline response envelope | Implemented |
| TPRM offline response envelope | Implemented |
| AI quality settings page | Implemented |
| `AIResponseDisplay` server component | Implemented (11 part kinds; interactive kinds render null) |
| Interactive part rendering (proposed-action, approval-request, execution-receipt, follow-up) | Designed-only; these need client event handlers wired to the decision surface |
| DB-backed prompt registry with staged rollout | Designed-only; noted in `prompt-registry.ts` |
| Evaluation suite results | Designed-only; run `npm run eval` (eval:structural) to generate |

---

## Zod

Zod 4.6.5 is installed in this repo. The envelope validator is intentionally manual:
it is imported in contexts that should not pull the schema builder (server components,
test utilities). Zod would be the right choice for a user-facing form schema. No Zod
dependency was added by this work.

---

## Pre-existing TypeScript errors

Two pre-existing TypeScript errors exist in `app/ops/page.tsx` and
`evals/graders/schema.ts`. None of the files in this handoff introduce TypeScript
errors. Verified with `tsc --noEmit`.

---

## Test run

```
Test Files  1 passed (1)
     Tests  28 passed (28)
```

All 28 tests pass. Run with:
```
npm run test:unit
```

# V4.0 Evaluation Suite Handoff

Illustrative regulatory context, not legal advice. All data is synthetic.

## Summary

Agent D (V4.0) built the AI evaluation suite for NFR WorkOS. The suite adds a corpus-based evaluation layer on top of the existing structural evaluations in `src/agents/evaluations/suite.ts`.

## What was built

### 1. Evaluation corpus (evals/cases/)

60 evaluation cases across 12 files:

| File | Cases | What is tested |
|---|---|---|
| rcsa-factual.json | 8 | Evidence retrieval, KRI status, control test status, incident count, prior cycle comparison, assessment scope, first-line input status, action overdue count |
| rcsa-conflicting.json | 6 | First-line vs evidence document contradictions; AI must surface conflict not silently resolve |
| rcsa-rating.json | 6 | Rating rationale; AI may propose position but must not finalise autonomously |
| rcsa-challenge.json | 5 | Challenge workshop question preparation; AI must not make the judgment |
| tprm-classification.json | 6 | Outsourcing vs ICT classification, materiality, criticality, DORA jurisdiction |
| tprm-contradiction.json | 6 | SOC 2 vs pen test, BCP vs test result, DDQ vs contract appendix |
| tprm-conditions.json | 5 | Contract condition tracking, remediation, waiver documentation |
| meeting-minutes.json | 5 | Fact/decision separation, action owners and due dates, unresolved items |
| inbox-triage.json | 4 | Classification into Decision/Action/Evidence/Information/Delegate/Noise with rationale |
| action-quality.json | 3 | Measurable completion criteria; vague wording flagged |
| authority.json | 3 | Prohibited action refusal: record-risk-rating, approve-own-decision, distribute-minutes |
| german.json | 3 | German language output with correct banking terminology |

Total: 60 cases.

### 2. Graders (evals/graders/)

Seven grader modules, each exporting a `grade(testCase, response)` function returning a `GraderResult`:

| Grader | File | Checks |
|---|---|---|
| schema | graders/schema.ts | Parts array present and non-empty; each part has kind and text; known kinds only; mustHaveParts present; mustNotHaveParts absent |
| citations | graders/citations.ts | Evidence parts carry source identifiers; minimum source count met |
| authority | graders/authority.ts | Prohibited actions return blocked part; no proposed-action or execution-receipt for prohibited tools |
| source-coverage | graders/source-coverage.ts | Required source type labels referenced in response text |
| language | graders/language.ts | Response lang field correct; German signal words present; required terms used |
| jurisdiction | graders/jurisdiction.ts | DORA not attributed to Swiss (CH) entities without negation |
| process-stage | graders/process-stage.ts | No forward-stage references in proposed actions |

A shared types file (`graders/types.ts`) defines `EvalCase`, `AssistantResponseEnvelope`, `ResponsePart`, and `GraderResult`.

### 3. Golden scenarios (evals/golden/)

Two golden scenario files with prohibited outcomes and invariant checklists:

- `rcsa-payments-q4.json`: Full RCSA cycle for RCSA-ARC-DE-PAYOPS-2026-Q4
- `tprm-veridian.json`: Full TPRM onboarding for Veridian Document Systems GmbH (TP-0099)

Each golden file records: start state, evidence set, approved human decisions, prohibited outcomes, expected process transitions, and final state invariants.

### 4. Evaluation runner (scripts/eval-runner.ts)

A TypeScript script runnable with `npx tsx scripts/eval-runner.ts --mode=structural`.

In structural mode (offline):
- Loads all 60 cases from evals/cases/
- Constructs synthetic offline envelopes for each case
- Runs schema, authority, and jurisdiction graders
- Writes results to evals/results/latest.json

Result format:
```json
{
  "runAt": "2026-10-02T...",
  "mode": "structural",
  "totalCases": 60,
  "passed": 60,
  "failed": 0,
  "notRun": 0,
  "cases": [...]
}
```

Other modes (grounding, live, golden, release) mark cases as "not-run" until a live model and database are available.

### 5. Scripts added to package.json

```json
"eval:structural": "tsx scripts/eval-runner.ts --mode=structural",
"eval:grounding": "tsx scripts/eval-runner.ts --mode=grounding",
"eval:live": "tsx scripts/eval-runner.ts --mode=live",
"eval:golden": "tsx scripts/eval-runner.ts --mode=golden",
"eval:release": "tsx scripts/eval-runner.ts --mode=release"
```

### 6. Evaluation README (evals/README.md)

Documents: suite structure, how to add a case, how to run each mode, grader descriptions, not-run vs failed distinction, jurisdiction note, and regulatory label.

## TypeScript status

All grader modules pass `tsc --noEmit`. The eval runner passes `tsc --noEmit`. No em dashes used. No Tailwind dependencies. Case files use ASCII only (German cases use ASCII transliteration: Risikoappetit, Kontrolleffektivitaet, Wesentlichkeit).

## How to interpret results

- **passed**: All structural graders (schema, authority, jurisdiction) passed against the offline envelope.
- **failed**: At least one grader failed. Check `graderResults[].details` for the specific failure.
- **not-run**: The mode requires a live model. Not-run is not a pass.

In structural mode, the offline envelopes are synthetic. A structural pass confirms the case schema is valid and the graders are wired correctly. It does not confirm that a real model response would pass.

## Next steps for the next agent

1. Wire the grader modules into the existing `scripts/evaluate.ts` so they run as part of the release gate alongside the structural evaluations in `src/agents/evaluations/suite.ts`.
2. Implement live-mode response collection in `eval-runner.ts`: call `runManagerTurn` for each case and pass the output to all seven graders.
3. Add golden scenario runner that checks `finalStateInvariants` against the seeded database state after a scripted scenario run.
4. Increase case count beyond 60 by adding cases for: control-assurance, incident-resilience, and regulatory-change roles.

## Regulatory note

Illustrative regulatory context, not legal advice. DORA (Regulation (EU) 2022/2554) and EBA guidelines apply to EU-regulated entities (ARC-DE, ARC-AT). FINMA Circular 2023/1 governs ARC-CH. No Swiss entity is attributed EU obligations in any eval case. All institutions, persons, and figures are synthetic.

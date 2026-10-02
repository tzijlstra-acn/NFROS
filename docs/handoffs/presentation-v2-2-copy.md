# Presentation V2.2 Copy Audit

## Double-hyphen violation counts in V2.1 source files

Measured using the regex pattern: `--` in string values, excluding CSS custom
properties (`--[a-z][a-z0-9-]*`) and TypeScript comment lines.

| File | `--` violations |
|------|----------------|
| `src/presentation-v2-1/data/core-story.ts` | 45 |
| `src/presentation-v2-1/data/appendix.ts` | 45 |
| `src/presentation-v2-1/data/service-model.ts` | 21 |
| `src/presentation-v2-1/data/role-app-library.ts` | 3 |
| `docs/PRESENTATION_V2_1_SCRIPT.md` | 91 |
| `docs/PRESENTATION_V2_1_QA_GUIDE.md` | 5 |
| **Total** | **210** |

## V2.2 corrections

V2.2 data files created in `src/presentation-v2-2/data/`. All `--` punctuation
removed from string values and replaced with commas, colons, semicolons,
parentheses, or separate sentences.

Additional corrections in V2.2:
- Slide 7 (Role Apps): corrected from six-stage to eight-stage processes,
  matching the actual product in `src/role-apps/rcsa/definition.ts` and
  `src/role-apps/tprm/definition.ts`.
- Appendix app-03 and app-04: updated to reflect the actual eight-stage
  process definitions.
- Slide 12 (Rollout): "10 weeks" hard-code removed from typed `RolloutStep`
  objects.
- All slides now carry typed `appendixRefs` instead of free-text references.

## V2.1 files that need manual fixing

Do not edit V2.1 files directly. V2.2 clean versions are the canonical source.
The V2.1 files remain unmodified as a reference baseline.

Files with violations that require manual update if V2.1 is ever re-presented:
- `docs/PRESENTATION_V2_1_SCRIPT.md` (91 violations)
- `docs/PRESENTATION_V2_1_QA_GUIDE.md` (5 violations)
- `src/presentation-v2-1/data/core-story.ts` (45 violations)
- `src/presentation-v2-1/data/appendix.ts` (45 violations)
- `src/presentation-v2-1/data/service-model.ts` (21 violations)
- `src/presentation-v2-1/data/role-app-library.ts` (3 violations)

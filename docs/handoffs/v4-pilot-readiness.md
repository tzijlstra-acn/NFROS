# V4 Pilot Readiness -- Handoff

Design Partner Release: NFR WorkOS V4.0

## Files created or modified

### New files

| File | Purpose |
|------|---------|
| `app/setup/page.tsx` | Five-step first-run wizard. Reached via `/setup`. Display-only, no DB writes. |
| `app/settings/pilot/page.tsx` | Pilot readiness dashboard with 6 checks, account roster, regulatory scope and evidence pack link. |
| `scripts/evidence-pack.ts` | Generates `release/pilot-evidence.json` via `npm run pilot:evidence-pack`. |
| `docs/handoffs/v4-pilot-readiness.md` | This document. |

### Modified files

| File | Change |
|------|--------|
| `src/product/entitlements/entitlements.ts` | Added `"pilot"` to `AdminArea["icon"]` union. Added pilot entry to `SETTINGS_AREAS`. |
| `src/components/settings/primitives.tsx` | Imported `IconRocket` from `@tabler/icons-react`. Added `pilot: IconRocket` to `AREA_ICONS`. |
| `package.json` | Added `"pilot:evidence-pack": "tsx scripts/evidence-pack.ts"` to scripts. |

## The six readiness checks

| # | Check | Pass condition | Warn condition |
|---|-------|---------------|----------------|
| 1 | Database: accessible | `sqlite_master` query returns > 0 tables | Table count = 0 or query fails |
| 2 | Seed data: loaded | `role_app_runs` row count > 0 | Table missing or count = 0 |
| 3 | Identity mode: configured | `PRODUCT_MODE` = `design-partner` or `offline-evaluation` | Unset or = `demonstration` |
| 4 | AI routines: seeded | `ai_routines` row count > 0 | Table missing or count = 0 |
| 5 | Audit chain: initialised | `audit_chain_records` table exists (count >= 0) | Table missing |
| 6 | At least one process run active | `role_app_runs` with `status != 'archived'` > 0 | Count = 0 or table missing |

All checks use raw SQLite queries wrapped in `try/catch`. A missing table returns warn,
not error, to handle partially migrated databases gracefully.

## Pilot accounts (no credentials)

| User ID | Display name | Role | Administrator |
|---------|-------------|------|--------------|
| PILOT-001 | RCSA Analyst (Pilot) | rcsa | No |
| PILOT-002 | TPRM Analyst (Pilot) | tprm | No |
| PILOT-ADM | Pilot Administrator | (all) | Yes |

Institution: Arcadia Savings Bank (synthetic). Credentials are in `src/identity/pilot-config.ts`
and are never shown in the UI.

## Regulatory scope

- **DE/AT entities**: DORA and EBA ICT/security risk guidelines apply.
- **CH entities**: FINMA circulars apply. DORA does not directly apply to Swiss entities.

Disclaimer on every regulatory reference: "Illustrative regulatory context, not legal advice."

## Security constraints applied

- No em dash (U+2014) in any file -- " -- " used instead.
- No umlaut characters -- ASCII transliterations only.
- No Tailwind -- CSS custom properties (`var(--app-*)`) only.
- Every regulatory reference carries the disclaimer.
- No claim of regulatory compliance.
- "Synthetic institution and data" label on every page.
- Pilot accounts shown without credentials.
- DORA/EBA restricted to DE/AT; FINMA restricted to CH.

## Known limitations

1. **No live DB check in the wizard.** The setup wizard (`/setup`) is display-only and does not
   run any database queries. Use `/settings/pilot` for the live readiness checks.

2. **Evidence pack API route not implemented.** The link `/api/pilot/evidence` on the pilot
   settings page links to a route that does not yet exist. The CLI script
   (`npm run pilot:evidence-pack`) is the working mechanism.

3. **Jurisdiction is hard-coded to DE.** The pilot page reads the jurisdiction as `"DE"` from a
   constant rather than from the organisation profile. When the design-partner institution changes
   jurisdiction, update `app/settings/pilot/page.tsx` and `scripts/evidence-pack.ts`.

4. **No navigation link to `/setup`.** The wizard is reached via direct URL only. It is not
   linked from the main navigation or the settings rail, which matches the spec (direct URL only).

5. **Pilot accounts are static.** Accounts are defined in `src/identity/pilot-config.ts`. Adding
   or removing accounts requires editing that file and redeploying.

## How to use before a pilot session

1. Run `npm run db:migrate && npm run db:seed` if this is a fresh environment.
2. Set `PRODUCT_MODE=design-partner` in your environment.
3. Open `/setup` and walk through the five wizard steps.
4. Open `/settings/pilot` and confirm all six checks show Pass.
5. Run `npm run pilot:evidence-pack` to generate `release/pilot-evidence.json` for your records.

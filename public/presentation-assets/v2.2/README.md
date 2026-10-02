# Presentation Assets -- V2.2

Product screenshots captured from the running NFR OS application for use in
NFROS Presentation V2.2, slide 5 (Work Hub / split layout slide).

## Status

No real captures are present yet. Run the capture script against a live server
to populate this directory.

## How to generate captures

1. Start the dev server (with live demo data for the richest state):

   ```
   npm run demo:live
   ```

2. In a second terminal, run the capture script:

   ```
   npm run capture:presentation-assets
   ```

3. Verify the output:

   ```
   npm run verify:presentation-assets
   ```

## What is captured

| Asset ID          | URL                                                        | Region element                         |
|-------------------|------------------------------------------------------------|----------------------------------------|
| rcsa-work-hub     | /workday/rcsa/work?presentationCapture=1                   | data-presentation-region="rcsa-work-hub"     |
| rcsa-stage-1      | /workday/rcsa/processes/rcsa-cycle?stage=evidence-refresh  | data-presentation-region="rcsa-stage-workspace" |
| tprm-work-hub     | /workday/tprm/work?presentationCapture=1                   | data-presentation-region="tprm-work-hub"     |
| role-home-rcsa    | /workday/rcsa?presentationCapture=1                        | data-presentation-region="role-home"         |

## Authentication

The demo identity provider uses the `rcsa-analyst` persona (Thomas Zijlstra).
Pages that use static/synthetic data do not require authentication and will
render correctly without a session. Run `npm run demo:live` for the full seeded
data set.

If a page redirects to login the capture script prints a warning and captures
whatever is on screen, rather than failing the run.

## Output format

The manifest at `manifest.json` lists all captured assets with their SHA-256
hash and the ISO timestamp of the capture run. The manifest is used by the
verify script to check asset integrity.

## Where the markers live

The `data-presentation-region` attributes are placed as follows:

- `rcsa-work-hub` and `tprm-work-hub`: outer div in
  `app/workday/[role]/work/v3.tsx`
- `rcsa-stage-workspace`: outer div of `StageWorkspace` in
  `src/components/workday-v3/StageWorkspace.tsx`
- `role-home`: outer div in `src/components/workday-v3/RoleHome.tsx`

These are harmless data attributes that carry no styling or behaviour.
They are present unconditionally (no env var gate needed).

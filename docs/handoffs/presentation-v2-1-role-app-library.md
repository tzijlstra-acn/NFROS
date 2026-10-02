# Presentation V2.1 -- Role App Catalogue and App Factory Lifecycle

## Role App catalogue

Role Apps are the core unit of value delivery in NFR OS. Each app packages one end-to-end process as a six-stage structured workflow. Status labels below match the truth audit in appendix A1 and A2.

### Operational Risk

| App | Status | Notes |
|-----|--------|-------|
| RCSA Cycle Assistant | Implemented | Six-stage workflow with AI drafting; full end-to-end testing complete locally |
| Event-Driven Reassessment | Demo | Triggers a mini-RCSA from a loss event or near-miss; not ready for pilot deployment |
| Rapid Assessment | Demo | Compressed two-stage cycle for emerging risks |
| Challenge Workshop Assistant | Planned | Prepares materials and records outcomes for second-line challenge sessions |
| Committee Delta Builder | Planned | Generates a delta pack showing what changed since the last committee |
| Scenario Library Builder | Planned | Structured scenario analysis with AI-assisted drafting |
| Risk Appetite Monitor | Planned | Monitors portfolio against agreed risk appetite thresholds |

### Third-Party Risk Management

| App | Status | Notes |
|-----|--------|-------|
| Third-Party Onboarding | Implemented | Six-stage onboarding workflow; installed and tested locally |
| Periodic Reassessment | Demo | Annual or trigger-based full reassessment of an existing supplier |
| Continuous Monitoring | Planned | Daily monitoring flags from external data feeds and internal signals |
| Fourth-Party Deep Dive | Demo | Extended due diligence on critical sub-processors |
| Exit Planning | Demo | Structured exit with data offboarding checklist and contract closure |
| Portfolio Heat Map | Planned | Visualisation of TPRM portfolio by risk and tier |
| Inherent Risk Screener | Planned | AI-assisted initial risk classification for new supplier requests |

### Control Assurance

| App | Status | Notes |
|-----|--------|-------|
| Control Testing Planner | Planned | Sample design and test scheduling |
| Sample Design Assistant | Planned | AI-assisted sample selection for control testing |
| Deficiency Tracker | Planned | Structured deficiency logging with remediation tracking |

### Incident and Resilience

| App | Status | Notes |
|-----|--------|-------|
| Incident Capture Assistant | Planned | Structured capture of operational incidents with AI classification |
| Root Cause Analyser | Planned | AI-assisted root cause analysis linked to the incident record |
| Lessons Learned Packager | Planned | Formats lessons learned for committee and regulatory reporting |

## App factory lifecycle

A new Role App moves through six delivery stages. This is the internal lifecycle for adding an app to the catalogue.

### 1. Intake and scoping
- Identify the process to be packaged as a Role App
- Run a process design workshop with client or internal SME
- Define the six stages, their inputs, and their outputs
- Identify AI assistance points and human gate points
- Agree evidence schema and audit trail requirements
- Produce a workflow specification document

### 2. Build
- Implement the six-stage workflow in the role app scaffold
- Write AI prompt templates for each assistance stage
- Configure evidence linking schema
- Build stage gate logic (professional must approve before advancing)
- Connect to the platform data layer via the defined entity model

### 3. AI evaluation
- Configure eval suite for the new app's AI assistance points
- Run structural eval: does the AI produce outputs in the correct schema?
- Run grounding eval: are AI-generated narratives factually grounded in the input data?
- Document eval results in the app release record

### 4. User acceptance testing
- Deploy the app to a test environment
- Walk through at least one complete cycle with internal testers
- Verify that all six stages can be completed, all outputs are correct, all evidence links work
- Verify audit log entries are generated at each stage gate

### 5. Release
- Produce release documentation (stage definitions, AI assistance points, known limitations)
- Update the role app catalogue status from Planned to Implemented
- Update appendix A1 and A2 slide data in `src/presentation-v2-1/data/appendix.ts`
- Merge to main and tag the release

### 6. Post-release review (first 30 days)
- Monitor AI utilisation and edit rates
- Review audit log for unexpected patterns
- Collect user feedback from first cohort
- Produce a 30-day review note and update the app's known limitations

## How a new app gets added to the catalogue data

The catalogue is defined in `src/presentation-v2-1/data/appendix.ts` in the `APPENDIX_SLIDES` array. The relevant slides are:

- `app-01` (status table) -- add a row with the new app's name and status
- `app-02` (catalogue) -- add the app to the appropriate function group with its status label

Status labels must match exactly: `Implemented`, `Demo`, or `Planned`. Any other string will not be styled correctly by the AppendixSlideRenderer.

After updating the data, regenerate the PDFs so the download files reflect the new status.

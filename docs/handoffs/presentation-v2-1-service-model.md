# Presentation V2.1 -- Service Model and Commercial Structure

## What the service model is

NFR OS is delivered as a managed service, not a software license. This distinction matters commercially and operationally. The client buys ongoing value delivery, not a point-in-time implementation.

The service has five components, three of which are recurring and two of which are one-time or per-delivery.

## Five service components

### Design and Mobilisation (one-time)
Structured engagement that configures the platform for a specific client: process workshops, role configuration, pilot cohort training, integration scoping. This is the upfront investment that makes everything else work in the client's environment. It is scoped per client and priced separately from the subscription.

### Platform (recurring, monthly)
Infrastructure, AI model access, security patching, backup, health monitoring. All role apps share the platform tier. The client pays a fixed monthly fee regardless of how many role apps are running. This is the foundation cost.

### Function Packs (recurring, per function enabled monthly)
Each risk function is a separate module: Operational Risk Pack, TPRM Pack, Control Assurance Pack (planned). Clients enable the functions they need. A client starting with OR does not pay for TPRM until they are ready to expand. Function packs are added by enabling the pack -- not by rebuilding the platform.

### Role Apps (per-delivery, one-time per app)
Each role app (RCSA Cycle Assistant, TPRM Onboarding, etc.) is a discrete build engagement: design, build, evaluation, testing, release. Once released, a role app runs on the platform as part of the relevant function pack. Additional role apps are additions, not replacements. The running platform is not disrupted when a new app is released.

### Managed Operations (recurring, monthly)
Ongoing monitoring, monthly model performance reviews, new role app releases, user adoption coaching, quarterly service reviews. Managed ops is the service that keeps the platform current and the user adoption healthy after the initial rollout.

## Subscription metric

**Active role seats** -- the number of professionals actively using NFR OS in a given month. This aligns the commercial model with adoption: the client pays more as they use more, and we are incentivised to drive adoption because our revenue scales with it.

## What is subscription vs implementation

| Item | Type | Timing |
|------|------|--------|
| Design and mobilisation | One-time | Before pilot or each expansion |
| Role App build (per app) | One-time | Per app delivery |
| Integration connector build | One-time | Per connector |
| Platform | Recurring | Monthly from day one |
| Function packs | Recurring | Monthly per function enabled |
| Managed operations | Recurring | Monthly from go-live |
| Active role seats | Recurring | Monthly per user above threshold |

## Commercial guardrails for client conversations

1. Do not quote specific prices. The structure above is the commercial model; rates are subject to negotiation.
2. The pilot commercial terms are simplified: a fixed mobilisation fee plus platform subscription for the pilot duration. Full commercial terms come at the step two expansion decision.
3. Pilot pricing should be structured so the client can make a decision at week ten without feeling locked into the full commercial model.
4. Do not commit to a total programme cost without scoping the number of role apps, users, and functions.

## How to describe the growth model to a client

The commercial model is designed to start narrow and grow. The client pays for what they use. When they enable a new function pack, they pay for that function. When they commission a new role app, they pay for that build. When more users are active, the subscription reflects that adoption. This is a deliberate alignment: our commercial incentive is to make NFR OS genuinely useful to the maximum number of enrolled professionals.

## Source data

- `src/presentation-v2-1/data/service-model.ts` -- SERVICE_COMPONENTS, COMMERCIAL_PACKAGING, ROLLOUT_STEPS, CORE_QUESTIONS arrays
- Appendix slides A13 (service stack detail) and A14 (commercial packaging) carry the client-facing version of this content

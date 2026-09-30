/**
 * The delivery roadmap.
 *
 * Six phases, in the order the product brief sets them. The page is written
 * for a sponsor who has to fund the first phase and has seen enough roadmaps
 * to distrust one, so each phase states five things and nothing else: what is
 * delivered, what it proves, what the bank must provide, the main risk, and
 * the exit criteria that permit the next phase to start.
 *
 * Two deliberate omissions. There is no committed duration: the only durations
 * shown are labelled illustrative and are explicitly conditional on scope.
 * There is no benefit figure: the measurement that would produce one is the
 * first deliverable of phase one, so quoting it here would invert the logic of
 * the whole plan.
 */

import { Caveat, ReportSection, ReportShell } from "@/components/shell/ReportShell";
import { BasisLabel } from "@/components/evidence/figures";
import { Chip } from "@/components/evidence/primitives";
import { isDatabaseReady } from "@/db/client";
import { getScenarioState } from "@/scenario/engine/state";
import type { Language } from "@/i18n/labels";

export const dynamic = "force-dynamic";

interface Phase {
  number: number;
  name: string;
  purpose: string;
  /** Indicative only. Always rendered with the illustrative label. */
  indicativeDuration: string;
  delivered: string[];
  proves: string[];
  bankMustProvide: string[];
  mainRisk: { risk: string; mitigation: string };
  exitCriteria: string[];
}

const PHASES: Phase[] = [
  {
    number: 1,
    name: "Role and work discovery",
    purpose:
      "Establish what the work actually is, per function and per entity, and measure the current state before anything is automated.",
    indicativeDuration: "6 to 10 weeks",
    delivered: [
      "A work inventory per non-financial risk function: the recurring work objects, the decisions that belong to a person, the systems opened, the evidence normally required and the handoffs.",
      "A decision rights map per legal entity, distinguishing group mandate from local entity accountability, including where a group function cannot absorb a local sign off.",
      "A baseline measurement of the current state: touches per case, systems per case, elapsed time per case, rework rate, and the proportion of evidence requests that are duplicates.",
      "A tool inventory candidate list: the read, draft, propose and mutate operations the work would require, with a first authority classification for each.",
      "A data readiness assessment of the systems of record: what is queryable, what is only reachable by export, and where the record of a decision currently lives.",
    ],
    proves: [
      "That the work can be described precisely enough to govern, rather than only described in policy language.",
      "That there is a measurable baseline, so any later claim of improvement can be tested rather than asserted.",
      "Whether the functions really do share an orchestration pattern, which is the structural assumption the whole product rests on.",
    ],
    bankMustProvide: [
      "Access to the practitioners, not only their managers: a working session with each function for their own work, per entity where entities differ.",
      "Read access to the systems of record, or a sanctioned extract, sufficient to assess data readiness.",
      "The current policy, framework and decision rights documentation, including the local adoption and deviation registers.",
      "A named sponsor per function who can confirm which decisions must remain human owned.",
    ],
    mainRisk: {
      risk: "The discovery produces a description of the process as documented rather than the process as performed, which then invalidates every later phase built on it.",
      mitigation:
        "Measure by observation and by system telemetry, not only by interview. Where the documented and observed processes differ, record both and treat the difference as a finding in its own right.",
    },
    exitCriteria: [
      "A signed work inventory and decision rights map per function and per entity.",
      "A baseline measurement set that the functions accept as a fair description of today.",
      "A draft tool registry with an authority class proposed for every entry, and named owners for the material ones.",
      "An explicit list of work the bank has decided is out of scope, with the reason recorded.",
    ],
  },
  {
    number: 2,
    name: "Read-only personal work layer",
    purpose:
      "Put the orchestration layer in front of real work with no ability to change anything, so trust is earned before authority is granted.",
    indicativeDuration: "8 to 14 weeks",
    delivered: [
      "A personal work environment per professional: the brief, the inbox with proposed triage, the calendar, the open decisions and the work object, assembled from the real systems of record.",
      "Retrieval over the bank's own evidence, with provenance and classification carried on every citation and a locator rather than a whole document reference.",
      "Read and draft tools only. Nothing in this phase writes to a system of record.",
      "The audit service, append only, recording every retrieval and every draft produced.",
      "The authority gate itself, live and enforcing, even though only read and draft classes are reachable.",
    ],
    proves: [
      "That the evidence can be retrieved with provenance intact from the bank's own systems, which is the single most common point of failure in this kind of programme.",
      "That the professionals will use it. Adoption of a read-only layer is a real signal, because nothing compels them to open it.",
      "That the gate, the audit trail and the classification handling work against real data volumes and real access controls.",
    ],
    bankMustProvide: [
      "Production or production-like read access to the systems of record, through a sanctioned integration pattern.",
      "An identity provider integration, so the acting person and their scopes are the bank's own, not the application's.",
      "A data protection and information security assessment of the retrieval layer, including cross border data access where the entities differ.",
      "A named group of practitioners willing to use it for their real work for a defined period.",
    ],
    mainRisk: {
      risk: "Retrieval quality on the real corpus is materially worse than on a curated one, and the professionals stop trusting the layer before it earns the right to do anything else.",
      mitigation:
        "Measure retrieval quality explicitly against a set of questions the practitioners define, publish the failures, and keep the layer read-only until the professionals themselves say the evidence is reliable.",
    },
    exitCriteria: [
      "Retrieval quality measured against a practitioner defined question set, with results the practitioners accept.",
      "Sustained voluntary use by the pilot group over an agreed period, measured rather than reported.",
      "Security, data protection and model risk review of the read-only layer completed with findings closed or accepted.",
      "Zero unintended writes, evidenced by the audit trail rather than by assertion.",
    ],
  },
  {
    number: 3,
    name: "Specialist evidence production",
    purpose:
      "Add the function specific intelligence: prepared positions, challenge, contradiction detection and stated uncertainty, all still without authority to change a record.",
    indicativeDuration: "10 to 16 weeks",
    delivered: [
      "A specialist capability per function, producing a prepared position with supporting and opposing evidence, stated uncertainty and an explicit confidence.",
      "Contradiction detection across sources, presented as two claims side by side and never resolved on the professional's behalf.",
      "Structured output schemas for every produced artefact, validated before anything reaches a person.",
      "Meeting and workshop preparation: the pack, the challenge questions, the evidence gaps.",
      "An evaluation harness: a labelled set from the bank's own assessed population, with measured accuracy, measured citation correctness and inter-rater agreement between reviewers.",
    ],
    proves: [
      "That the specialist output is good enough for a professional to challenge from, which is a lower bar than being right and a much more useful one.",
      "That accuracy can be measured rather than claimed, because the evaluation harness exists and produces numbers.",
      "That opposing evidence and uncertainty survive into the interface rather than being smoothed away.",
    ],
    bankMustProvide: [
      "An assessed population with known conclusions, to serve as the labelled evaluation set.",
      "Reviewer time from the functions to grade outputs and to establish inter-rater agreement.",
      "Model risk governance engagement: the model inventory entry, the validation approach and the acceptance thresholds, agreed before the measurement starts rather than after.",
      "A decision on which specialist conclusions may be shown to a professional at all, per function.",
    ],
    mainRisk: {
      risk: "Measured accuracy is acceptable on average but fails on the material cases, and an average is used to justify proceeding.",
      mitigation:
        "Stratify the evaluation by materiality and report the material stratum separately. Set the acceptance threshold on the material cases, not on the mean.",
    },
    exitCriteria: [
      "Measured accuracy, citation correctness and uncertainty calibration meeting thresholds agreed in advance with model risk, reported by materiality stratum.",
      "Model risk validation completed and the capability recorded in the model inventory.",
      "Professionals confirm that the prepared positions are usable as a basis for challenge.",
      "Every produced artefact conforms to a named schema, evidenced by validation logs.",
    ],
  },
  {
    number: 4,
    name: "Approval-gated execution",
    purpose:
      "Allow state changes in the systems of record, each one bound to a named human approval, with a full receipt.",
    indicativeDuration: "12 to 20 weeks",
    delivered: [
      "Write integration with the systems of record, through typed tools only, with no direct database access from any model.",
      "The approval mechanism in production form: payload bound, single use, granted by a named person, with the rationale confirmed as theirs and the approver's scopes checked at the moment of approval.",
      "Execution receipts naming the target system, the entity partition, the record identifier, the accountable person and the evidence reference for every change.",
      "Reversal and supersession handling: nothing is deleted, versions are retained, and the audit record survives the reversal of the change it recorded.",
      "A defined set of low risk, reversible, routine actions that may execute within policy, and an explicit list of what never may.",
    ],
    proves: [
      "That authority can be enforced deterministically at the point of execution, not merely described in a policy.",
      "That an auditor can reconstruct any change from the trail alone: what changed, who authorised it, on what evidence, under what authority.",
      "That a refused action is recorded, so the control can be tested rather than trusted.",
    ],
    bankMustProvide: [
      "Write access to the systems of record with a change control and rollback path agreed with the platform owners.",
      "Segregation of duties enforced by the bank's own directory, so the approver identity is the bank's identity.",
      "Internal audit engagement on the design of the trail, before it is built rather than after it is populated.",
      "A formal decision, per material tool, on who may approve and at what threshold.",
      "Electronic signature or equivalent legal weight where a recorded approval has to carry it.",
    ],
    mainRisk: {
      risk: "An approved change executes against the wrong record or the wrong entity partition, or an approval is reused for a payload it never covered.",
      mitigation:
        "Bind every approval to a payload fingerprint and make it single use, reject any change that cannot name all five required fields, and test the gate with adversarial cases including instruction text embedded in evidence documents.",
    },
    exitCriteria: [
      "Internal audit accepts the execution trail as sufficient to reconstruct any change without interviewing anyone.",
      "Adversarial testing of the gate completed, including prompt injection attempts through documents, supplier correspondence and meeting transcripts, with no successful bypass.",
      "A period of live operation with no unapproved state change, evidenced by reconciliation between the audit trail and the systems of record.",
      "Rollback tested on a real change in a real system, not only in a test environment.",
    ],
  },
  {
    number: 5,
    name: "Process redesign",
    purpose:
      "Change the process itself rather than accelerating the existing one, now that there is evidence about what the capability can and cannot be trusted with.",
    indicativeDuration: "16 to 26 weeks",
    delivered: [
      "Redesigned processes per function: the steps that exist only because the evidence was previously hard to assemble are removed, not automated.",
      "Revised policy, framework and procedure documentation reflecting the new division of work between person and system.",
      "Revised committee and reporting operating model: one prepared position per matter instead of several functions reporting the same matter separately.",
      "Revised control design where the control relied on a manual step that no longer exists, including the internal control system documentation.",
      "A remeasurement against the phase one baseline, using the same definitions, so the change is comparable.",
    ],
    proves: [
      "That the benefit comes from the redesign rather than from the tool, which is the finding that determines whether the programme is worth scaling.",
      "That the control environment is at least as strong after the redesign, evidenced by control design review rather than asserted.",
      "That the measured baseline has moved, using the original definitions.",
    ],
    bankMustProvide: [
      "Process ownership and the authority to change a process, which is a different authority from the authority to run a pilot.",
      "Policy and framework change governance, including the local adoption step in each entity.",
      "Control owners and internal audit involvement in redesigning any control that touches the internal control system.",
      "Change management capacity: the professionals whose work changes need time to absorb it.",
    ],
    mainRisk: {
      risk: "The tool is adopted and the process is not redesigned, so cost is added and the old process survives underneath, which is the most common way programmes of this kind fail quietly.",
      mitigation:
        "Make the removal of specific steps an explicit, named deliverable with a process owner accountable for it, and remeasure against the phase one baseline rather than against a new one.",
    },
    exitCriteria: [
      "Remeasurement against the phase one baseline, using the original definitions, accepted by the functions.",
      "Policy, framework and procedure changes approved and locally adopted per entity.",
      "Control design review completed for every affected control, with no net weakening accepted without a documented risk acceptance.",
      "Named steps removed from the process, evidenced in the revised procedure documentation.",
    ],
  },
  {
    number: 6,
    name: "Scaled operating model",
    purpose:
      "Run it as a capability the bank owns, across functions and entities, with the governance, support and lifecycle that implies.",
    indicativeDuration: "continuing",
    delivered: [
      "Rollout across the remaining functions and entities, respecting the differences between jurisdictions rather than flattening them.",
      "An operating model for the capability itself: ownership, funding, support, incident handling, change control and a service level the functions can rely on.",
      "Model lifecycle management: periodic revalidation, drift monitoring, a defined process for a model version change and a tested fallback when a provider is unavailable.",
      "Tool registry governance: how a new tool is proposed, classified, approved and added, and who may change an authority class.",
      "Continuous measurement of the trust and control figures, reported to the committee that owns the capability.",
      "Third party risk governance of the model provider itself, treated as what it is: a dependency of the risk function.",
    ],
    proves: [
      "That the capability survives contact with normal institutional life: staff turnover, provider changes, audits, examinations and budget cycles.",
      "That the control evidence continues to be produced when nobody is watching a demonstration.",
    ],
    bankMustProvide: [
      "A permanent owner with a budget, not a programme with an end date.",
      "Committee governance for the capability, including who is accountable when it produces a wrong position that a person relies on.",
      "Provider risk assessment and contractual arrangements for the model provider, including exit planning.",
      "A training and competence approach, so a professional who joins next year understands what the system may and may not do.",
    ],
    mainRisk: {
      risk: "The capability becomes infrastructure that nobody owns: it keeps running, its outputs keep being relied upon, and its validation quietly expires.",
      mitigation:
        "Tie the right to operate to a periodic revalidation with a stated expiry, and make the expiry visible in the product itself rather than held in a governance document.",
    },
    exitCriteria: [
      "Phases are not exited here. The capability is subject to periodic revalidation with a stated expiry, and the right to operate lapses if revalidation is not completed.",
    ],
  },
];

export default function RoadmapPage() {
  /* Read only for the interface language. This page needs no scenario data. */
  const state = isDatabaseReady() ? getScenarioState() : null;
  const language = (state?.language ?? "en") as Language;

  return (
    <ReportShell
      title="Delivery roadmap"
      lede="Six phases, each with what it delivers, what it proves, what the bank must supply, its main risk and the criteria to leave it."
      active="roadmap"
      language={language}
      status={
        <>
          <Chip tone="cyan">{PHASES.length} phases</Chip>
          <Chip tone="amber">no committed dates</Chip>
        </>
      }
    >
      <section className="panel">
        <div className="panel-head">
          <span className="panel-title">How this roadmap is constructed</span>
        </div>
        <div className="panel-body stack stack-4">
          <p className="lede">
            The sequence is not a preference. Each phase exists to produce the evidence that permits
            the next one, and the exit criteria are the form that evidence takes. A phase that is
            skipped removes the basis for the phase after it.
          </p>
          <div className="grid grid-2">
            <div className="stack stack-2">
              <span className="label">Why this order</span>
              <ul className="stack stack-2" style={{ fontSize: "var(--text-sm)" }}>
                <li>
                  Measurement comes first, because without a baseline no later claim of improvement
                  can be tested, only asserted.
                </li>
                <li>
                  Reading comes before writing, because retrieval quality against the bank&apos;s own
                  corpus is the most common point of failure and the cheapest place to discover it.
                </li>
                <li>
                  Producing a position comes before executing one, because a position can be
                  challenged and withdrawn and an executed change cannot.
                </li>
                <li>
                  Redesign comes after execution, because redesigning a process around a capability
                  that has not been trusted in operation is a guess.
                </li>
                <li>
                  Scaling comes last, because scaling an unowned capability multiplies an unowned
                  capability.
                </li>
              </ul>
            </div>
            <div className="stack stack-2">
              <span className="label">On durations</span>
              <p style={{ fontSize: "var(--text-sm)" }}>
                Each phase carries an indicative duration. Those figures are illustrative: they
                assume a defined scope, available practitioners and an integration pattern that
                already exists. They are not a commitment, they are not an estimate for any
                particular institution, and they should be replaced by a scoped plan after phase
                one.
              </p>
              <div className="row row-2 row-wrap">
                <BasisLabel basis="illustrative" />
                <span className="meta">applies to every duration on this page</span>
              </div>
              <p style={{ fontSize: "var(--text-sm)" }}>
                No benefit figure appears on this roadmap. The measurement that would produce one is
                the first deliverable of phase one, and quoting a benefit before that measurement
                exists would invert the logic of the entire plan.
              </p>
            </div>
          </div>
        </div>
      </section>

      {PHASES.map((phase) => (
        <PhaseCard key={phase.number} phase={phase} />
      ))}

      {/* ---------------- Closing statement ---------------- */}
      <ReportSection
        title="What this prototype establishes, and what it does not"
        question="What can be concluded from what has been demonstrated?"
        answer="That the control pattern is implementable and inspectable. Nothing beyond that."
        tone="amber"
      >
        <div className="grid grid-2">
          <div className="card card-edge" data-tone="green">
            <div className="stack stack-3">
              <span className="label">What it does establish</span>
              <ul className="stack stack-2" style={{ fontSize: "var(--text-sm)" }}>
                <li>
                  That a deterministic authority gate can sit between a model and a system of
                  record, and that its refusals can be made explicit, recorded and testable.
                </li>
                <li>
                  That an approval can be bound to a specific payload, made single use, and
                  restricted to a named person who confirms the rationale as their own.
                </li>
                <li>
                  That provenance can be carried at the row level, so a verified fact, an approved
                  record, a stakeholder statement, a conflicting account and a model inference never
                  share a style or a field.
                </li>
                <li>
                  That an append only audit trail can be written on every state change and on every
                  refusal, and that modification of the trail can be refused by design.
                </li>
                <li>
                  That the orchestration layer is largely common across six non-financial risk
                  functions, while the specialist work and the decision rights are not.
                </li>
                <li>
                  That a product can state its own uncertainty, show opposing evidence and decline
                  to resolve a contradiction, and still be usable.
                </li>
                <li>
                  That the work can be instrumented: the counts on the value page are rows, not
                  claims.
                </li>
              </ul>
            </div>
          </div>

          <div className="card card-edge" data-tone="red">
            <div className="stack stack-3">
              <span className="label">What it does not establish</span>
              <ul className="stack stack-2" style={{ fontSize: "var(--text-sm)" }}>
                <li>
                  Any accuracy claim. No output has been evaluated against a labelled set from a
                  real assessed population, and no confidence figure here is calibrated.
                </li>
                <li>
                  Any benefit, saving, efficiency or return. There is no measured baseline of a real
                  process, so there is nothing to compare against.
                </li>
                <li>
                  Any statement about retrieval quality at institutional scale. The corpus here is
                  sized for a demonstration.
                </li>
                <li>
                  Any integration readiness. No system of record is connected; the mapping is
                  described, not built.
                </li>
                <li>
                  Any security assurance. There has been no penetration test, no threat model
                  review and no formal prompt injection assessment.
                </li>
                <li>
                  Any regulatory or legal acceptability. Nothing here has been reviewed by a
                  supervisor, by legal counsel or by model risk governance.
                </li>
                <li>
                  Any conclusion about a real institution. The bank, its people, its suppliers and
                  its incidents are invented.
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div
          className="card card-edge"
          data-tone="amber"
          style={{ background: "var(--amber-tint)" }}
        >
          <div className="stack stack-2">
            <span className="label">Required statement</span>
            <p className="strong-text" style={{ fontSize: "var(--text-md)" }}>
              The prototype demonstrates control patterns that require validation within the
              bank&apos;s legal, regulatory, security, and model-risk framework.
            </p>
          </div>
        </div>

        <Caveat>
          The honest summary is short. This prototype is an argument about how the work should be
          controlled, made concrete enough to inspect and to disagree with. It is not evidence that
          the argument holds at a real bank, and the roadmap above is the sequence by which that
          would be found out.
        </Caveat>
      </ReportSection>
    </ReportShell>
  );
}

/* ==========================================================================
   Phase card
   ========================================================================== */

function PhaseCard({ phase }: { phase: Phase }) {
  return (
    <section className="panel" id={`phase-${phase.number}`}>
      <div className="panel-head">
        <div className="stack stack-1">
          <span className="label">Phase {phase.number}</span>
          <span className="panel-title">{phase.name}</span>
        </div>
        <div className="row row-2 row-wrap">
          <span className="meta">indicative duration {phase.indicativeDuration}</span>
          <BasisLabel basis="illustrative" />
        </div>
      </div>
      <div className="panel-body stack stack-5">
        <p className="lede" style={{ fontSize: "var(--text-base)" }}>
          {phase.purpose}
        </p>

        <div className="grid grid-2">
          <PhaseBlock title="What is delivered" items={phase.delivered} tone="cyan" />
          <PhaseBlock title="What it proves" items={phase.proves} tone="green" />
        </div>

        <div className="grid grid-2">
          <PhaseBlock
            title="What the bank must provide"
            items={phase.bankMustProvide}
            tone="accent"
          />
          <div className="stack stack-3">
            <div className="card card-edge" data-tone="red">
              <div className="stack stack-2">
                <span className="label">The main risk</span>
                <p style={{ fontSize: "var(--text-sm)" }}>{phase.mainRisk.risk}</p>
                <span className="label">How it is managed</span>
                <p className="dim" style={{ fontSize: "var(--text-sm)" }}>
                  {phase.mainRisk.mitigation}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card card-edge" data-tone="amber">
          <div className="stack stack-2">
            <span className="label">
              Exit criteria to start phase {phase.number === PHASES.length ? phase.number : phase.number + 1}
            </span>
            <ul className="stack stack-2" style={{ fontSize: "var(--text-sm)" }}>
              {phase.exitCriteria.map((item, index) => (
                <li key={index} className="row row-2 row-start">
                  <span className="meta shrink-0" style={{ paddingTop: 2 }}>
                    {phase.number}.{index + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function PhaseBlock({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "accent" | "cyan" | "green" | "amber" | "red" | "neutral";
}) {
  return (
    <div className="card card-edge" data-tone={tone}>
      <div className="stack stack-2">
        <span className="label">{title}</span>
        <ul className="stack stack-2" style={{ fontSize: "var(--text-sm)" }}>
          {items.map((item, index) => (
            <li key={index} className="row row-2 row-start">
              <span className="meta shrink-0" aria-hidden="true" style={{ paddingTop: 2 }}>
                &#9633;
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

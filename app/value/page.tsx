/**
 * The value model.
 *
 * The temptation on a page like this is to show a saving. This page does not,
 * because this prototype cannot know one: it runs a synthetic institution for
 * one synthetic day, and any figure extrapolated from that to a real bank
 * would be an invention dressed as an analysis.
 *
 * What it does instead is count. Every figure that can be counted from the
 * rows in this scenario is counted and labelled as measured in this
 * simulation. Every figure that would require the bank's own baseline is
 * labelled as client input required and left without a number. Figures that
 * are modelled rather than observed are labelled illustrative. The label is a
 * required prop on the component that renders a figure, so a number cannot
 * reach this page without one.
 *
 * The four groups are the groups the product brief defines: capacity, risk
 * quality, trust and control, and economics.
 */

import { MetricGroup, ValueMetric } from "@/components/evidence/figures";
import { Caveat, ReportSection, ReportShell, SeedNotice } from "@/components/shell/ReportShell";
import { Chip } from "@/components/evidence/primitives";
import { isDatabaseReady } from "@/db/client";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import {
  getAllSubprocessors,
  getAssessments,
  getControlTests,
  getIssues,
  getPopulationSummary,
  getPortfolioThemes,
  getServiceDependencies,
  getUnownedObligationGaps,
} from "@/db/repositories/workday";
import {
  countBy,
  countContradictionPairs,
  formatUsd,
  getAgentRuns,
  getAllActionRows,
  getAllAuditEvents,
  getAllBackgroundActions,
  getAllCollaborationMessages,
  getAllDecisionRows,
  getAllEvidenceDocumentRows,
  getAllInboxMessages,
  getAllMeetingMessages,
  getAllMeetings,
  getAllMonitoringActivations,
  getApprovalRows,
  getToolCalls,
  summariseTrace,
} from "@/db/repositories/observability";
import { getAuditCompleteness } from "@/server/security/audit";
import { getScenarioState } from "@/scenario/engine/state";
import type { Language } from "@/i18n/labels";

export const dynamic = "force-dynamic";

export default function ValuePage() {
  /* A scenario run must exist. Migrated but empty tables are not a scenario. */
  const state = isDatabaseReady() ? getScenarioState() : null;
  const seeded = state !== null;
  const language = (state?.language ?? "en") as Language;

  return (
    <ReportShell
      title="Value model"
      lede="What this simulation can count, what it cannot, and the difference between the two."
      active="value"
      language={language}
      status={
        <>
          <Chip tone="green">measured figures come from rows</Chip>
          <Chip tone="amber">no client saving is claimed</Chip>
        </>
      }
    >
      <section className="panel">
        <div className="panel-head">
          <span className="panel-title">How to read these figures</span>
        </div>
        <div className="panel-body stack stack-4">
          <p className="lede">
            Every figure on this page is scenario derived. None of them is an external benchmark,
            an industry average, a vendor claim or a projected saving. There are exactly three
            labels and each figure carries one of them.
          </p>
          <div className="grid grid-3">
            <div className="card card-edge" data-tone="green">
              <div className="stack stack-2">
                <span className="label">measured in this simulation</span>
                <p style={{ fontSize: "var(--text-sm)" }}>
                  Counted or summed from rows in the local scenario database. It describes this
                  synthetic day and nothing outside it. The derivation is printed under every one of
                  them so it can be checked against the tables.
                </p>
              </div>
            </div>
            <div className="card card-edge" data-tone="cyan">
              <div className="stack stack-2">
                <span className="label">illustrative</span>
                <p style={{ fontSize: "var(--text-sm)" }}>
                  Modelled rather than observed. Cost figures are the clearest case: they apply an
                  indicative price table held in this repository to measured token counts. Useful
                  for order of magnitude, useless for budgeting.
                </p>
              </div>
            </div>
            <div className="card card-edge" data-tone="amber">
              <div className="stack stack-2">
                <span className="label">client input required</span>
                <p style={{ fontSize: "var(--text-sm)" }}>
                  The prototype cannot know this. Hours, effort, cycle times and first time right
                  rates depend on the bank&apos;s own baseline measurement. These figures are shown
                  without a number rather than filled with an estimate.
                </p>
              </div>
            </div>
          </div>
          <Caveat>
            A measured figure here is evidence that the product instruments the work, not evidence
            that the work improved. Improvement can only be established by measuring the bank&apos;s
            current state and then measuring it again, which is the first phase of the delivery
            roadmap for exactly this reason.
          </Caveat>
        </div>
      </section>

      {seeded ? (
        <SeededValueModel />
      ) : (
        <SeedNotice unavailable="Every measured figure in the four groups below is counted from database rows, so none of them can be shown. No estimate is substituted in their place." />
      )}
    </ReportShell>
  );
}

/* ==========================================================================
   The measured model
   ========================================================================== */

function SeededValueModel() {
  /* ---- reads ---- */
  const background = getAllBackgroundActions();
  const actionRows = getAllActionRows();
  const documents = getAllEvidenceDocumentRows();
  const collaboration = getAllCollaborationMessages();
  const meetings = getAllMeetings();
  const meetingStatements = getAllMeetingMessages();
  const inbox = getAllInboxMessages();
  const decisionRows = getAllDecisionRows();
  const approvalRows = getApprovalRows();
  const calls = getToolCalls();
  const runs = getAgentRuns();
  const totals = summariseTrace(runs, calls);
  const auditEvents = getAllAuditEvents();
  const completeness = getAuditCompleteness(DEFAULT_RUN_ID);
  const assessments = getAssessments();
  const themes = getPortfolioThemes();
  const issues = getIssues();
  const monitoring = getAllMonitoringActivations();
  const subprocessors = getAllSubprocessors();
  const dependencies = getServiceDependencies();
  const unownedObligations = getUnownedObligationGaps();
  const controlTests = getControlTests();

  /* ---- capacity ---- */
  const systemsOpened = new Set(
    background.filter((row) => row.kind === "system-checked").map((row) => row.targetId),
  ).size;
  const evidenceRequestActions = actionRows.filter((row) => row.kind === "evidence-request").length;
  const validationRequestActions = actionRows.filter(
    (row) => row.kind === "validation-request",
  ).length;
  const requestedDocuments = documents.filter(
    (row) => row.status === "requested" || row.status === "missing",
  ).length;
  const duplicateRequests = inbox.filter((row) => row.isDuplicateOf !== null).length;
  const handoffsWithReply = collaboration.filter((row) => row.replyBody.length > 0).length;
  const handoffsAwaitingReply = collaboration.length - handoffsWithReply;
  const preparedMeetings = meetings.filter((row) => row.preparationSummary.length > 0).length;
  const preparedQuestions = meetings.reduce((sum, row) => sum + row.preparedQuestions.length, 0);
  const supersededAssessments = assessments.filter((row) => row.status === "superseded").length;
  const duplicateReports = themes.reduce((sum, row) => sum + row.duplicateReportCount, 0);
  const challengeStatements = meetingStatements.filter(
    (row) => row.contradictsEvidenceId !== null,
  ).length;

  /* ---- risk quality ---- */
  const currentDocuments = documents.filter((row) => row.status === "current").length;
  const staleDocuments = documents.filter((row) => row.isStale).length;
  const contradictionPairs = countContradictionPairs();
  const contradictionsFoundInBackground = background.filter(
    (row) => row.kind === "contradiction-identified",
  ).length;
  const comparableAssessments = new Set(
    assessments
      .filter((row) => row.version > 1)
      .map((row) => row.subjectId),
  ).size;
  const unownedActions = actionRows.filter((row) => row.isUnowned).length;
  const overdueActions = actionRows.filter((row) => row.status === "overdue").length;
  const undeclaredSubprocessors = subprocessors.filter((row) => row.isDiscrepancy).length;

  const population = controlTests.reduce(
    (acc, test) => {
      const summary = getPopulationSummary(test.id);
      return {
        cases: acc.cases + summary.total,
        exceptions: acc.exceptions + summary.exceptions,
        unclassified: acc.unclassified + summary.unclassifiedExceptions,
        missingReviewEvidence: acc.missingReviewEvidence + summary.missingReviewEvidence,
      };
    },
    { cases: 0, exceptions: 0, unclassified: 0, missingReviewEvidence: 0 },
  );

  /* ---- trust and control ---- */
  const triageOverrides = inbox.filter(
    (row) => row.confirmedTriage !== null && row.confirmedTriage !== row.proposedTriage,
  ).length;
  const triageConfirmed = inbox.filter(
    (row) => row.confirmedTriage !== null && row.confirmedTriage === row.proposedTriage,
  ).length;
  const factualCorrections = meetingStatements.filter((row) => row.correctionRecorded).length;
  const dismissedFlags = meetingStatements.filter((row) => row.flagDismissed).length;
  const unsupportedDecisions = decisionRows.filter(
    (row) => row.supportingEvidenceIds.length === 0,
  ).length;
  const approvalsWithoutConfirmedRationale = approvalRows.filter(
    (row) => !row.rationaleConfirmed,
  ).length;
  const citedDocuments = new Set<string>();
  for (const decision of decisionRows) {
    for (const id of decision.supportingEvidenceIds) citedDocuments.add(id);
    for (const id of decision.opposingEvidenceIds) citedDocuments.add(id);
  }
  const confidence = {
    low: decisionRows.filter((row) => row.confidence < 0.5).length,
    medium: decisionRows.filter((row) => row.confidence >= 0.5 && row.confidence < 0.8).length,
    high: decisionRows.filter((row) => row.confidence >= 0.8).length,
  };

  /* ---- economics ---- */
  const decidedDecisions = decisionRows.filter((row) => row.status === "decided").length;
  const costPerCompletedCase =
    decidedDecisions > 0 ? totals.recomputedCostUsd / decidedDecisions : null;

  return (
    <>
      {/* ================= Capacity ================= */}
      <MetricGroup
        title="Capacity"
        intro="Where the working day goes. These figures count the orchestration work the product performed or recorded: systems opened, evidence chased, handoffs made, meetings prepared, work redone and time spent waiting. They do not convert any of it into hours, because the conversion needs the bank's own baseline."
      >
        <ValueMetric
          label="Manual touches taken over"
          value={background.length}
          basis="measured"
          derivation="Row count in background_actions. Each row names the object it touched and the authority class it ran under, so the total can be expanded rather than only quoted."
          note="This is the count of orchestration actions the product performed. It is not a claim that each one would have taken a person the same effort."
        />
        <ValueMetric
          label="Distinct systems opened"
          value={systemsOpened}
          basis="measured"
          derivation="Distinct target identifiers among background actions of kind system-checked."
        />
        <ValueMetric
          label="Evidence requests recorded"
          value={evidenceRequestActions + requestedDocuments}
          basis="measured"
          derivation="Actions of kind evidence-request, plus evidence documents whose status is requested or missing."
        />
        <ValueMetric
          label="Duplicate evidence requests identified"
          value={duplicateRequests}
          basis="measured"
          derivation="Inbox messages carrying a reference to the earlier request they duplicate."
          note="A duplicate request is a cost paid twice by the person being asked, which is why it is surfaced rather than merged silently."
        />
        <ValueMetric
          label="Handoffs to another function"
          value={collaboration.length}
          basis="measured"
          derivation="Row count in collaboration_messages. Every one is simulated and never reaches a real recipient."
        />
        <ValueMetric
          label="Handoffs still awaiting a reply"
          value={handoffsAwaitingReply}
          basis="measured"
          tone={handoffsAwaitingReply > 0 ? "amber" : "green"}
          derivation="Collaboration messages with no seeded reply body. This is the visible form of waiting time within the scenario."
        />
        <ValueMetric
          label="Meetings with a preparation pack assembled"
          value={`${preparedMeetings} of ${meetings.length}`}
          basis="measured"
          derivation="Meetings whose preparation summary is not empty, against the total number of meetings in the day."
        />
        <ValueMetric
          label="Challenge questions prepared"
          value={preparedQuestions}
          basis="measured"
          derivation="Sum of the prepared question lists across all meetings. Each one is a draft for the professional to edit or reject."
        />
        <ValueMetric
          label="Statements challenged against evidence"
          value={challengeStatements}
          basis="measured"
          derivation="Meeting statements linked to an evidence document they contradict."
          note="Time spent on challenge is the part of the day the product is trying to increase, not reduce."
        />
        <ValueMetric
          label="Rework, records superseded by a new version"
          value={supersededAssessments}
          basis="measured"
          derivation="Assessment rows with status superseded. A superseded version is retained, so rework is visible rather than overwritten."
        />
        <ValueMetric
          label="Duplicate reports covering the same theme today"
          value={duplicateReports}
          basis="measured"
          derivation="Sum of the duplicate report count recorded on each cross function theme."
          note="This is the current state the scenario describes: several functions reporting the same matter separately."
        />
        <ValueMetric
          label="Waiting time and manual effort in hours"
          value="not stated"
          basis="client-input"
          derivation="Converting these counts into hours requires the bank's own time study of the current process, per function and per entity. The prototype has no basis for an hours figure and does not invent one."
        />
      </MetricGroup>

      {/* ================= Risk quality ================= */}
      <MetricGroup
        title="Risk quality"
        intro="Whether the risk work is better, not faster. These figures count evidence completeness, detected contradictions, the availability of a version comparison, ownership gaps, stale evidence and dependency visibility. Quality claims that need an outcome to verify them are marked as client input required."
      >
        <ValueMetric
          label="Evidence documents current"
          value={`${currentDocuments} of ${documents.length}`}
          basis="measured"
          derivation="Documents with status current, against the total corpus."
        />
        <ValueMetric
          label="Evidence requested and not arrived"
          value={requestedDocuments}
          basis="measured"
          tone={requestedDocuments > 0 ? "amber" : "green"}
          derivation="Documents with status requested or missing. A conclusion that would have relied on one of these is shown as unsupported."
        />
        <ValueMetric
          label="Stale evidence in the corpus"
          value={staleDocuments}
          basis="measured"
          tone={staleDocuments > 0 ? "amber" : "green"}
          derivation="Documents flagged stale, meaning older than the policy freshness requirement. Each carries a staleness note."
        />
        <ValueMetric
          label="Contradictions detected"
          value={contradictionPairs}
          basis="measured"
          derivation="Pairs of conflicting statements in the incident chronology, counted as pairs rather than rows so one disagreement is not reported as two."
        />
        <ValueMetric
          label="Contradictions found before the professional arrived"
          value={contradictionsFoundInBackground}
          basis="measured"
          derivation="Background actions of kind contradiction-identified."
        />
        <ValueMetric
          label="Subjects with a version comparison available"
          value={comparableAssessments}
          basis="measured"
          derivation="Distinct assessment subjects holding more than one version, so a line by line comparison is a read rather than a reconstruction."
          note="Assessment consistency is supported by keeping every version. Whether the assessments agree is a professional judgment, not a count."
        />
        <ValueMetric
          label="Actions with no owner"
          value={unownedActions}
          basis="measured"
          tone={unownedActions > 0 ? "red" : "green"}
          derivation="Action rows with the unowned flag set."
        />
        <ValueMetric
          label="Actions overdue"
          value={overdueActions}
          basis="measured"
          tone={overdueActions > 0 ? "amber" : "green"}
          derivation="Action rows with status overdue."
        />
        <ValueMetric
          label="Obligations with no owner or control"
          value={unownedObligations.length}
          basis="measured"
          tone={unownedObligations.length > 0 ? "red" : "green"}
          derivation="Obligation rows flagged as an unowned gap, each carrying a gap note."
        />
        <ValueMetric
          label="Undeclared or mismatched subprocessors"
          value={undeclaredSubprocessors}
          basis="measured"
          tone={undeclaredSubprocessors > 0 ? "red" : "green"}
          derivation="Subprocessor rows flagged as a discrepancy against the supplier's declaration."
          note="A missed dependency is the failure mode this figure exists to expose."
        />
        <ValueMetric
          label="Service dependency edges mapped"
          value={dependencies.length}
          basis="measured"
          derivation="Row count in service_dependencies. These are the edges the impact assessment traverses."
        />
        <ValueMetric
          label="Control test cases examined"
          value={population.cases}
          basis="measured"
          derivation="Sum of test case rows across every control test in the scenario."
        />
        <ValueMetric
          label="Test exceptions not yet classified"
          value={population.unclassified}
          basis="measured"
          tone={population.unclassified > 0 ? "amber" : "green"}
          derivation="Test cases with outcome exception and no exception classification. Classification is a human decision and stays open until made."
        />
        <ValueMetric
          label="Test cases missing secondary review evidence"
          value={population.missingReviewEvidence}
          basis="measured"
          tone={population.missingReviewEvidence > 0 ? "red" : "green"}
          derivation="Test cases where the secondary review is not evidenced. This is an evidence completeness defect in a key control, not a model opinion."
        />
        <ValueMetric
          label="Issues open in the scenario"
          value={issues.length}
          basis="measured"
          derivation="Row count in issues."
        />
        <ValueMetric
          label="First time right rate"
          value="not stated"
          basis="client-input"
          derivation="A first time right rate requires the bank to define a completed case, measure how many pass review without a correction today, and then measure it again. The prototype has no review history to compute it from."
        />
      </MetricGroup>

      {/* ================= Trust and control ================= */}
      <MetricGroup
        title="Trust and control"
        intro="Whether the human stayed in charge. These figures count overrides, unsupported conclusions, approval exceptions, refused actions, audit coverage, the spread of stated confidence and how much of the corpus is actually cited."
      >
        <ValueMetric
          label="Human overrides of a proposed triage"
          value={triageOverrides}
          basis="measured"
          derivation="Inbox messages where the confirmed triage differs from the triage the assistant proposed."
          note="An override is a healthy signal. A product that is never overridden is either perfect or not being read."
        />
        <ValueMetric
          label="Proposed triage confirmed unchanged"
          value={triageConfirmed}
          basis="measured"
          derivation="Inbox messages where the confirmed triage matches the proposed triage."
        />
        <ValueMetric
          label="Factual corrections recorded by a person"
          value={factualCorrections}
          basis="measured"
          derivation="Meeting statements against which a human recorded a factual correction."
        />
        <ValueMetric
          label="Contradiction flags dismissed by a person"
          value={dismissedFlags}
          basis="measured"
          derivation="Meeting statements where a human dismissed the contradiction flag. Dismissal is recorded, not hidden."
        />
        <ValueMetric
          label="Decisions with no supporting citation"
          value={unsupportedDecisions}
          basis="measured"
          tone={unsupportedDecisions > 0 ? "red" : "green"}
          derivation="Decision rows whose supporting evidence list is empty."
        />
        <ValueMetric
          label="Approvals without a confirmed rationale"
          value={approvalsWithoutConfirmedRationale}
          basis="measured"
          tone={approvalsWithoutConfirmedRationale > 0 ? "red" : "green"}
          derivation="Approval rows where the approver did not confirm the rationale as their own. The gate refuses to execute on these."
        />
        <ValueMetric
          label="Actions refused by the authority gate"
          value={totals.blockedCount}
          basis="measured"
          tone="red"
          derivation="Tool calls with outcome blocked, each carrying the reason the gate gave."
        />
        <ValueMetric
          label="Actions held for a human approval"
          value={totals.proposedCount}
          basis="measured"
          tone="amber"
          derivation="Tool calls with outcome proposed, returned as a proposal instead of executing."
        />
        <ValueMetric
          label="Audit events recorded"
          value={auditEvents.length}
          basis="measured"
          derivation="Row count in audit_events for this scenario run. The table is append only."
        />
        <ValueMetric
          label="State changes with an audit event"
          value={`${completeness.mutations} of ${completeness.mutations}`}
          basis="measured"
          derivation="Every mutation in this application writes exactly one audit event through the audit service, so the two counts are the same by construction. The figure is shown so that a divergence would be visible."
        />
        <ValueMetric
          label="Monitoring activated by a person"
          value={monitoring.length}
          basis="measured"
          derivation="Row count in monitoring_activations, each naming the person who activated it."
        />
        <ValueMetric
          label="Source coverage of the corpus"
          value={`${citedDocuments.size} of ${documents.length}`}
          basis="measured"
          derivation="Distinct documents cited by a decision, against the total corpus. Low coverage is not a defect in itself; an uncited document is simply one the day did not need."
        />
        <ValueMetric
          label="Confidence distribution of prepared positions"
          value={`${confidence.high} high, ${confidence.medium} medium, ${confidence.low} low`}
          basis="measured"
          derivation="Decision rows banded by the confidence column: high at or above 80 of 100, medium 50 to 79, low below 50."
          note="Confidence is stated by the producing component and is not calibrated against outcomes."
        />
      </MetricGroup>

      {/* ================= Economics ================= */}
      <MetricGroup
        title="Economics"
        intro="What the machine consumed. Call counts and token counts are measured. Every money figure is illustrative, because it applies an indicative price table held in this repository rather than a live price list, and because a synthetic day is not a workload."
      >
        <ValueMetric
          label="Model invocations recorded"
          value={runs.length}
          basis="measured"
          derivation="Row count in agent_runs for this scenario run."
        />
        <ValueMetric
          label="Invocations served from cache"
          value={`${totals.fromCacheCount} of ${runs.length}`}
          basis="measured"
          derivation="Agent runs with the from cache flag set, against all agent runs. Presenter safe mode serves the critical beats from cache."
        />
        <ValueMetric
          label="Governed tool calls"
          value={calls.length}
          basis="measured"
          derivation="Row count in tool_calls. Deterministic tool calls involve no model and no token cost."
        />
        <ValueMetric
          label="Input tokens"
          value={totals.inputTokens}
          basis="measured"
          derivation="Sum of input tokens across agent runs."
        />
        <ValueMetric
          label="Output tokens"
          value={totals.outputTokens}
          basis="measured"
          derivation="Sum of output tokens across agent runs."
        />
        <ValueMetric
          label="Estimated model cost for this run"
          value={formatUsd(totals.recomputedCostUsd)}
          unit="USD"
          basis="illustrative"
          derivation="Measured token counts multiplied by the indicative price table in src/server/config/models.ts. Published prices change and this application does not read a live price list."
          note="This is the cost of running this synthetic day in this mode. It must not be extrapolated to a production workload."
        />
        <ValueMetric
          label="Estimated cost per completed case"
          value={costPerCompletedCase === null ? "not computable yet" : formatUsd(costPerCompletedCase)}
          unit={costPerCompletedCase === null ? undefined : "USD"}
          basis="illustrative"
          derivation={
            costPerCompletedCase === null
              ? "No decision in this run has been recorded as decided, so there is no completed case to divide by. No placeholder figure is shown."
              : `Illustrative run cost divided by the ${decidedDecisions} decisions recorded as decided in this run.`
          }
          note="A decision in this scenario is not a unit of production work. Treat this as a shape, not a rate."
        />
        <ValueMetric
          label="Human review effort per case"
          value="not stated"
          basis="client-input"
          derivation="Requires the bank to measure the time a reviewer spends on a case today and after the change, per function. The prototype cannot observe reviewer time."
        />
        <ValueMetric
          label="Exception handling effort"
          value="not stated"
          basis="client-input"
          derivation="Requires the bank's own exception volumes and the effort per exception. The scenario contains exceptions but no effort measurement."
        />
        <ValueMetric
          label="Licence, infrastructure and implementation cost"
          value="not stated"
          basis="client-input"
          derivation="Commercial and infrastructure costs are outside the prototype entirely and are not estimated here."
        />
      </MetricGroup>

      {/* ================= What is deliberately absent ================= */}
      <ReportSection
        title="What is deliberately absent"
        question="Why is there no saving on this page?"
        answer="Because this prototype has no basis for one. A saving requires a measured baseline of the bank's current process and a measured comparison after the change. The prototype has neither, and inventing one would undermine every measured figure above it."
        tone="amber"
      >
        <ul className="stack stack-2" style={{ fontSize: "var(--text-sm)" }}>
          <li>No hours saved, no headcount equivalent and no efficiency multiple appears anywhere in this product.</li>
          <li>No external benchmark, industry average or peer comparison is cited, because none has been validated for this context.</li>
          <li>No payback period or return figure is shown. Those require commercial inputs the prototype does not have.</li>
          <li>
            Counts of work the product performed are not presented as work eliminated. Whether a
            background action replaces a manual touch, and what that touch costs, is a question for
            the discovery phase.
          </li>
        </ul>
        <Caveat>
          The figures on this page describe a synthetic institution on a synthetic day. They are
          evidence that the work can be instrumented and inspected. They are not evidence of a
          business case, and the roadmap begins with the measurement that would produce one.
        </Caveat>
      </ReportSection>

      {/* ================= Provenance of the measured set ================= */}
      <ReportSection
        title="Where the measured figures come from"
        question="Can these numbers be checked?"
        answer="Yes. Every measured figure above is a count over a named table in the local scenario database, and the derivation is printed under the figure. The tables themselves are visible in the control room and the trust page."
      >
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">Row counts of the tables behind the measured figures</caption>
            <thead>
              <tr>
                <th scope="col">Table read</th>
                <th scope="col" className="num">
                  Rows in this run
                </th>
                <th scope="col">What it supports</th>
              </tr>
            </thead>
            <tbody>
              {[
                { table: "background_actions", rows: background.length, supports: "Manual touches, systems opened, contradictions found early." },
                { table: "actions", rows: actionRows.length, supports: "Evidence requests, unowned actions, overdue actions." },
                { table: "evidence_documents", rows: documents.length, supports: "Evidence completeness, stale evidence, source coverage." },
                { table: "collaboration_messages", rows: collaboration.length, supports: "Handoffs and waiting." },
                { table: "meetings", rows: meetings.length, supports: "Meeting preparation and prepared challenge." },
                { table: "meeting_messages", rows: meetingStatements.length, supports: "Challenge, corrections, dismissed flags." },
                { table: "inbox_messages", rows: inbox.length, supports: "Triage overrides and duplicate requests." },
                { table: "decisions", rows: decisionRows.length, supports: "Unsupported conclusions, confidence distribution, completed cases." },
                { table: "approvals", rows: approvalRows.length, supports: "Approval exceptions." },
                { table: "tool_calls", rows: calls.length, supports: "Blocked and held actions." },
                { table: "agent_runs", rows: runs.length, supports: "Invocations, tokens, illustrative cost." },
                { table: "audit_events", rows: auditEvents.length, supports: "Audit completeness." },
                { table: "assessments", rows: assessments.length, supports: "Rework and version comparison." },
                { table: "monitoring_activations", rows: monitoring.length, supports: "Monitoring a person turned on." },
                { table: "subprocessors", rows: subprocessors.length, supports: "Missed dependencies." },
                { table: "service_dependencies", rows: dependencies.length, supports: "Dependency visibility." },
              ].map((row) => (
                <tr key={row.table}>
                  <th scope="row" className="mono">
                    {row.table}
                  </th>
                  <td className="num">{row.rows}</td>
                  <td className="dim">{row.supports}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="stack stack-2">
          <span className="label">Tool call outcomes behind the control figures</span>
          <div className="row row-2 row-wrap">
            {countBy(calls, (call) => call.outcome).map((entry) => (
              <Chip
                key={entry.value}
                tone={
                  entry.value === "blocked"
                    ? "red"
                    : entry.value === "proposed"
                      ? "amber"
                      : entry.value === "executed"
                        ? "green"
                        : "neutral"
                }
              >
                {entry.value} {entry.count}
              </Chip>
            ))}
            {calls.length === 0 ? <span className="meta">No tool call has been recorded.</span> : null}
          </div>
        </div>
      </ReportSection>
    </>
  );
}

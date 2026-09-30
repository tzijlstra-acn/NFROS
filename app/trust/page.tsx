/**
 * The trust and accountability view.
 *
 * This page is written for the reader who has to sign something: a Chief Risk
 * Officer, a Head of Internal Audit, a model risk reviewer, a data protection
 * officer. Such a reader does not want a narrative about responsible AI. They
 * want eighteen specific questions answered with the actual state of the
 * system, and they want the answers to be checkable.
 *
 * The page is therefore structured as answers rather than themes. Each section
 * states its question, gives a direct answer drawn from data where the data
 * exists, and then shows the rows behind it. Where the prototype cannot
 * answer, it says so in the answer position rather than in a footnote.
 *
 * The authority matrix carries the refusals at the top. A product's refusals
 * are the part of it that a control function can rely on, so the tools this
 * system will never run are the first thing in the table.
 */

import {
  Caveat,
  KeyValue,
  ReportSection,
  ReportShell,
  SeedNotice,
} from "@/components/shell/ReportShell";
import {
  Chip,
  ConfidenceMeter,
  ObjectId,
  ProvenanceBadge,
  RegulatoryNote,
  type Tone,
} from "@/components/evidence/primitives";
import { BasisLabel, ValueMetric } from "@/components/evidence/figures";
import { SCHEMA_REGISTRY } from "@/agents/schemas";
import { isDatabaseReady } from "@/db/client";
import {
  AUTONOMY_LEVELS,
  DEFAULT_RUN_ID,
  PROVENANCE_KINDS,
  ROLE_IDS,
  type RoleId,
} from "@/db/schema/core";
import {
  getEntities,
  getIncidents,
  getRoles,
  getSuppliers,
  getUser,
  getUsers,
} from "@/db/repositories/workday";
import {
  countBy,
  getAgentRuns,
  getAllAuditEvents,
  getAllBackgroundActions,
  getAllDecisionRows,
  getAllEvidenceDocumentRows,
  getAllMeetingMessages,
  getApprovalRows,
  getCachedOutputs,
  getExecutionReceiptLines,
  getMutationEvents,
  getToolCalls,
  groupEventsByObjectKind,
  countContradictionPairs,
} from "@/db/repositories/observability";
import { getRuntimeStatus } from "@/server/config/runtime";
import { getAuditCompleteness, getAuditTrail } from "@/server/security/audit";
import {
  AUTHORITY_SCOPES,
  AUTONOMY_DESCRIPTIONS,
  listToolRegistry,
  ROLE_AUTHORITY_SCOPES,
  toolsAvailableAt,
  type AuthorityScope,
  type ToolDefinition,
} from "@/server/security/authority";
import { getScenarioState } from "@/scenario/engine/state";
import type { Language } from "@/i18n/labels";

export const dynamic = "force-dynamic";

/**
 * The statement the product brief requires, verbatim.
 *
 * Held as a constant so it is rendered from one place and cannot drift through
 * an editing pass.
 */
const VALIDATION_STATEMENT =
  "The prototype demonstrates control patterns that require validation within the bank's legal, regulatory, security, and model-risk framework.";

const AUTHORITY_CLASS_ORDER = [
  "PROHIBITED",
  "APPROVAL_REQUIRED",
  "POLICY_BOUND_AUTONOMOUS",
  "PROPOSE",
  "DRAFT",
  "READ",
] as const;

const AUTHORITY_CLASS_MEANING: Record<string, string> = {
  PROHIBITED:
    "Never executable, at any autonomy level, for any role. Present in the registry so the refusal is explicit and testable rather than merely absent.",
  APPROVAL_REQUIRED:
    "Changes a record materially. Requires a payload bound approval granted by a named person who has confirmed the rationale is theirs.",
  POLICY_BOUND_AUTONOMOUS:
    "Low risk, reversible and routine. Executes without approval only at the most permissive autonomy level, and never when the change is material.",
  PROPOSE: "Produces a recommendation with alternatives and stated uncertainty. Changes nothing.",
  DRAFT: "Produces text for a person to edit, confirm or reject. Changes nothing.",
  READ: "Retrieval and deterministic calculation. Changes nothing.",
};

export default function TrustPage() {
  const runtime = getRuntimeStatus();
  /* A scenario run must exist. Migrated but empty tables are not a scenario. */
  const state = isDatabaseReady() ? getScenarioState() : null;
  const seeded = state !== null;
  const language = (state?.language ?? "en") as Language;
  const registry = listToolRegistry();
  const prohibited = registry.filter((tool) => tool.authorityClass === "PROHIBITED");

  const status = (
    <>
      <Chip tone="red">{prohibited.length} tools refused by design</Chip>
      <Chip tone="cyan">{registry.length} governed tools</Chip>
      <Chip tone={runtime.openai.configured ? "green" : "amber"}>
        key {runtime.openai.configured ? "resolved" : "not resolved"}
      </Chip>
    </>
  );

  return (
    <ReportShell
      title="Trust and accountability"
      lede="Eighteen questions a control function asks before it relies on anything, each answered from the state of this system."
      active="trust"
      language={language}
      status={status}
    >
      {/* ---------------- Framing and the required statement ---------------- */}
      <section className="panel">
        <div className="panel-head">
          <span className="panel-title">How to read this page</span>
        </div>
        <div className="panel-body stack stack-4">
          <p className="lede">
            Every section below states a question, answers it directly, and then shows the rows the
            answer came from. Where this prototype cannot answer a question, the answer says so.
            Nothing on this page is an external benchmark, a compliance claim or an assurance
            opinion.
          </p>
          <div
            className="card card-edge"
            data-tone="amber"
            style={{ background: "var(--amber-tint)" }}
          >
            <div className="stack stack-2">
              <span className="label">Required statement</span>
              <p className="strong-text" style={{ fontSize: "var(--text-md)" }}>
                {VALIDATION_STATEMENT}
              </p>
            </div>
          </div>
          <Caveat>
            Arcadia Banking Group is a synthetic institution. Every person, supplier, control,
            transaction, incident and regulatory publication referenced here is invented for the
            purpose of the demonstration. Regulatory references are illustrative context and not
            legal advice.
          </Caveat>
        </div>
      </section>

      {/* ---------------- Authority matrix ---------------- */}
      <ReportSection
        title="The authority matrix"
        question="What is this system permitted to do, and what will it never do?"
        answer={`The registry holds ${registry.length} tools. ${prohibited.length} of them are refused by design and cannot be reached at any autonomy level by any role. A tool that is not in this registry cannot be called at all, which is why the registry rather than the prompt is the security boundary.`}
        tone="red"
      >
        <div className="stack stack-3">
          <div className="row row-2 row-wrap">
            {AUTHORITY_CLASS_ORDER.map((authorityClass) => {
              const count = registry.filter((tool) => tool.authorityClass === authorityClass).length;
              return (
                <Chip key={authorityClass} tone={authorityTone(authorityClass)}>
                  {authorityClass} {count}
                </Chip>
              );
            })}
          </div>

          {AUTHORITY_CLASS_ORDER.map((authorityClass) => {
            const tools = registry.filter((tool) => tool.authorityClass === authorityClass);
            if (tools.length === 0) return null;
            return (
              <div key={authorityClass} className="stack stack-2">
                <div className="row row-2 row-wrap row-between">
                  <span className="label" style={{ color: toneColour(authorityTone(authorityClass)) }}>
                    {authorityClass} ({tools.length})
                  </span>
                </div>
                <p className="dim" style={{ fontSize: "var(--text-sm)", maxWidth: "92ch" }}>
                  {AUTHORITY_CLASS_MEANING[authorityClass]}
                </p>
                <ToolTable tools={tools} />
              </div>
            );
          })}
        </div>
      </ReportSection>

      {/* ---------------- Access scoping ---------------- */}
      <ReportSection
        title="Role to authority scope matrix"
        question="How is access scoped?"
        answer={`Access is scoped twice, independently. A role holds a set of authority scopes and a tool requires a set of scopes; both must match. Separately, the autonomy level must be able to reach the tool's authority class at all. There are ${AUTHORITY_SCOPES.length} scopes and ${ROLE_IDS.length} roles, and no role holds every scope.`}
      >
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">Authority scopes held by each role</caption>
            <thead>
              <tr>
                <th scope="col">Authority scope</th>
                {ROLE_IDS.map((roleId) => (
                  <th key={roleId} scope="col">
                    {roleId}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AUTHORITY_SCOPES.map((scope) => (
                <tr key={scope}>
                  <th scope="row" className="mono">
                    {scope}
                  </th>
                  {ROLE_IDS.map((roleId) => {
                    const held = ROLE_AUTHORITY_SCOPES[roleId].includes(scope as AuthorityScope);
                    return (
                      <td key={roleId}>
                        {held ? (
                          <Chip tone="green" title={`${roleId} holds ${scope}`}>
                            held
                          </Chip>
                        ) : (
                          <span className="meta" title={`${roleId} does not hold ${scope}`}>
                            not held
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="stack stack-2">
          <span className="label">What each autonomy level can reach</span>
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Tools reachable at each autonomy level</caption>
              <thead>
                <tr>
                  <th scope="col">Autonomy level</th>
                  <th scope="col">What it means</th>
                  <th scope="col" className="num">
                    Tools reachable
                  </th>
                  <th scope="col" className="num">
                    Tools withheld
                  </th>
                </tr>
              </thead>
              <tbody>
                {AUTONOMY_LEVELS.map((level) => {
                  const roleId: RoleId = state?.activeRoleId ?? "nfr-governance";
                  const { available, withheld } = toolsAvailableAt(level, roleId);
                  return (
                    <tr key={level}>
                      <th scope="row">{AUTONOMY_DESCRIPTIONS[level].label}</th>
                      <td className="dim">{AUTONOMY_DESCRIPTIONS[level].detail}</td>
                      <td className="num">{available.length}</td>
                      <td className="num">{withheld.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Caveat>
            The reachable and withheld counts above are computed for the{" "}
            {state?.activeRoleId ?? "nfr-governance"} role, because scope holdings differ by role.
            Raising the autonomy level never makes a material change free: a material tool still
            requires an approval at the most permissive level.
          </Caveat>
        </div>
      </ReportSection>

      {seeded ? (
        <SeededTrustAnswers language={language} />
      ) : (
        <SeedNotice unavailable="The evidence corpus statistics, the approval records, the blocked actions, the state changes, the audit completeness figures and the provenance distribution are all counted from database rows and are therefore not shown. The authority matrix and the scope matrices above are defined in code and remain accurate." />
      )}

      {/* ---------------- Key protection ---------------- */}
      <ReportSection
        title="Credential handling"
        question="How is the key protected?"
        answer={
          runtime.openai.configured
            ? "A usable key was resolved at runtime from a file outside this repository. This page reports that fact and the name of the file. It does not report any part of the value."
            : "No usable key was resolved, so the application runs from cached and seeded outputs. Nothing about a key value is held, displayed or logged."
        }
        tone={runtime.openai.configured ? "green" : "amber"}
      >
        <div className="stack stack-3">
          <KeyValue label="Key resolved">
            <Chip tone={runtime.openai.configured ? "green" : "amber"}>
              {runtime.openai.configured ? "true" : "false"}
            </Chip>
          </KeyValue>
          <KeyValue label="File that supplied it">
            <span className="mono meta">{runtime.openai.source}</span>
          </KeyValue>
          <KeyValue label="Live calls permitted right now">
            <Chip tone={runtime.liveCallsPermitted ? "green" : "neutral"}>
              {runtime.liveCallsPermitted ? "true" : "false"}
            </Chip>
          </KeyValue>
          <ul className="stack stack-2" style={{ fontSize: "var(--text-sm)" }}>
            <li className="row row-2 row-start">
              <span aria-hidden="true">&#9633;</span>
              <span>
                The key is read at runtime from a read-only source repository. It is never copied
                into this repository and never written to disk here.
              </span>
            </li>
            <li className="row row-2 row-start">
              <span aria-hidden="true">&#9633;</span>
              <span>
                No prefix, suffix, length, hash or masked form of the value is displayed, logged,
                exported or sent to the browser. There is no code path in this application that
                produces one.
              </span>
            </li>
            <li className="row row-2 row-start">
              <span aria-hidden="true">&#9633;</span>
              <span>
                The environment file parser reads an allowlist of variable names only, so unrelated
                secrets in the same file are never held in memory.
              </span>
            </li>
            <li className="row row-2 row-start">
              <span aria-hidden="true">&#9633;</span>
              <span>
                A value that looks like a placeholder is rejected rather than accepted, so live mode
                is never reported as available and then found to fail in front of an audience.
              </span>
            </li>
            <li className="row row-2 row-start">
              <span aria-hidden="true">&#9633;</span>
              <span>
                <span className="mono">readLocalSecrets</span> is a registered prohibited tool. An
                agent asking for credential material is refused and the refusal is recorded.
              </span>
            </li>
          </ul>
        </div>
      </ReportSection>

      {/* ---------------- Output evaluation ---------------- */}
      <ReportSection
        title="Output evaluation"
        question="How are outputs evaluated?"
        answer={`Every model output is validated against one of ${Object.keys(SCHEMA_REGISTRY).length} named output schemas before it reaches the interface, and every cached beat is validated at seed time so a malformed beat fails the seed rather than the demonstration. That is structural validation. It is not an accuracy evaluation, and this prototype does not contain one.`}
        tone="amber"
      >
        <div className="stack stack-3">
          <div className="stack stack-2">
            <span className="label">Named output schemas ({Object.keys(SCHEMA_REGISTRY).length})</span>
            <div className="row row-2 row-wrap">
              {Object.keys(SCHEMA_REGISTRY).map((name) => (
                <span key={name} className="chip" data-tone="cyan">
                  {name}
                </span>
              ))}
            </div>
          </div>

          <div className="stack stack-2">
            <span className="label">What is checked, and how</span>
            <ul className="stack stack-2" style={{ fontSize: "var(--text-sm)" }}>
              <li>
                Schema conformance. A response that omits its grounding block, its uncertainty list
                or its source references fails validation and is not rendered.
              </li>
              <li>
                Deterministic recomputation. Residual risk positions and impact tolerance headroom
                are computed by functions, not asserted by a model, so those figures cannot drift
                with a prompt change.
              </li>
              <li>
                Citation presence. A statement without a source identifier is rendered as having no
                source cited rather than being presented as supported.
              </li>
              <li>
                Gate refusal. An action outside authority is refused regardless of how confident or
                well argued the request was.
              </li>
              <li>
                Contradiction surfacing. Conflicting statements are shown side by side and are
                never resolved on the reader&apos;s behalf.
              </li>
            </ul>
          </div>

          <Caveat>
            Honest limitation: there is no labelled gold standard set, no inter-rater agreement
            study and no measured accuracy figure for any model output in this prototype. Building
            one requires the bank&apos;s own assessed population and its own reviewers. Until that
            exists, no accuracy claim should be made from this system, and none is made on any of
            these pages.
          </Caveat>
        </div>
      </ReportSection>

      {/* ---------------- Jurisdiction ---------------- */}
      <JurisdictionSection seeded={seeded} />

      {/* ---------------- Limitations ---------------- */}
      <ReportSection
        title="Limitations, stated specifically"
        question="What does this prototype not establish?"
        answer="It establishes that the control pattern is implementable and inspectable. It establishes nothing about accuracy on real data, nothing about performance at the bank's volumes, and nothing about regulatory acceptability."
        tone="amber"
      >
        <div className="stack stack-3">
          <ul className="stack stack-3" style={{ fontSize: "var(--text-sm)" }}>
            {[
              "The institution, the people, the suppliers, the controls, the incidents and the regulatory publications are synthetic. No figure on any page describes a real bank.",
              "The scenario is one day with one shared event. It does not exercise month end, year end, an examination, a supervisory visit, a merger or a staff absence.",
              "Retrieval runs over a corpus of a size that fits a demonstration. Retrieval quality at a corpus of hundreds of thousands of documents is not demonstrated here.",
              "There is no integration with a real system of record. Every state change is written to a local database, and the mapping to a GRC platform, an evidence vault or a payments system is described rather than built.",
              "There is no identity provider, no single sign on, no segregation of duties enforced by an external directory, and no encryption at rest beyond what the host filesystem provides.",
              "Approvals are recorded as rows. They are not electronic signatures and carry no legal weight.",
              "Model outputs have not been evaluated for accuracy against a labelled set. Confidence figures shown in the interface are stated by the producing component and are not calibrated.",
              "Cost figures are derived from an indicative price table held in this repository. They are illustrative and cannot be used for budgeting.",
              "German language coverage is partial: navigation, work lane labels, decision buttons and key story copy. It is not a full localisation and it has not been reviewed by a native speaking risk professional.",
              "The authority gate is deterministic and testable, but the completeness of the tool registry against a real bank's process inventory has not been assessed. A tool the bank needs and that is missing here would be a gap, not a refusal.",
              "No penetration test, threat model review or prompt injection assessment has been carried out against this prototype.",
              "Voice interaction depends on a realtime model being available to the account. When it is not, the product falls back to typed interaction, which changes the experience being demonstrated.",
            ].map((item, index) => (
              <li key={index} className="row row-2 row-start">
                <span className="meta shrink-0" style={{ paddingTop: 2 }}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div
            className="card card-edge"
            data-tone="amber"
            style={{ background: "var(--amber-tint)" }}
          >
            <div className="stack stack-2">
              <span className="label">Required statement</span>
              <p className="strong-text" style={{ fontSize: "var(--text-md)" }}>
                {VALIDATION_STATEMENT}
              </p>
            </div>
          </div>
        </div>
      </ReportSection>
    </ReportShell>
  );
}

/* ==========================================================================
   The authority matrix table
   ========================================================================== */

function ToolTable({ tools }: { tools: ToolDefinition[] }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="sr-only">
          Tools with their authority class, required scopes and effect
        </caption>
        <thead>
          <tr>
            <th scope="col">Tool</th>
            <th scope="col">Required authority scopes</th>
            <th scope="col">Mutates</th>
            <th scope="col">Material</th>
            <th scope="col">Reversible</th>
            <th scope="col">What it does</th>
          </tr>
        </thead>
        <tbody>
          {tools.map((tool) => (
            <tr key={tool.name}>
              <th scope="row" className="mono">
                {tool.name}
              </th>
              <td className="mono meta">
                {tool.requiredScopes.length === 0 ? "none, it is never callable" : tool.requiredScopes.join(", ")}
              </td>
              <td>
                <Chip tone={tool.mutates ? "amber" : "neutral"}>{tool.mutates ? "yes" : "no"}</Chip>
              </td>
              <td>
                <Chip tone={tool.material ? "red" : "neutral"}>{tool.material ? "yes" : "no"}</Chip>
              </td>
              <td>
                <Chip tone={tool.reversible ? "green" : "red"}>{tool.reversible ? "yes" : "no"}</Chip>
              </td>
              <td className="dim" style={{ maxWidth: 460 }}>
                {tool.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ==========================================================================
   The answers that require the database
   ========================================================================== */

function SeededTrustAnswers({ language }: { language: Language }) {
  const runtime = getRuntimeStatus();
  const documents = getAllEvidenceDocumentRows();
  const entities = getEntities();
  const users = getUsers();
  const roles = getRoles();
  const suppliers = getSuppliers();
  const incidents = getIncidents();
  const decisionRows = getAllDecisionRows();
  const approvalRows = getApprovalRows();
  const calls = getToolCalls();
  const runs = getAgentRuns();
  const background = getAllBackgroundActions();
  const mutations = getMutationEvents();
  const receipts = getExecutionReceiptLines();
  const cached = getCachedOutputs();
  const meetingStatements = getAllMeetingMessages();
  const allEvents = getAllAuditEvents();
  const completeness = getAuditCompleteness(DEFAULT_RUN_ID);
  const recentEvents = getAuditTrail(DEFAULT_RUN_ID, 60);
  const contradictionPairs = countContradictionPairs();

  const registry = listToolRegistry();
  const byName = new Map(registry.map((tool) => [tool.name, tool]));

  const blockedCalls = calls.filter((call) => call.outcome === "blocked");
  const heldCalls = calls.filter((call) => call.outcome === "proposed");
  const blockedEvents = allEvents.filter((event) => event.blocked);

  const citedByDecisions = new Set<string>();
  for (const decision of decisionRows) {
    for (const id of decision.supportingEvidenceIds) citedByDecisions.add(id);
    for (const id of decision.opposingEvidenceIds) citedByDecisions.add(id);
  }

  const classifications = countBy(documents, (row) => row.dataClassification);
  const sourceTypes = countBy(documents, (row) => row.sourceType);
  const sourceSystems = countBy(documents, (row) => row.sourceSystem);
  const documentStatus = countBy(documents, (row) => row.status);
  const documentProvenance = countBy(documents, (row) => row.provenance);
  const statementProvenance = countBy(meetingStatements, (row) => row.provenance);
  const modelsUsed = countBy(runs, (row) => row.model);
  const backgroundKinds = countBy(background, (row) => row.kind);
  const mutationsByObject = groupEventsByObjectKind(mutations);

  const confidenceBands = {
    low: decisionRows.filter((row) => row.confidence < 0.5).length,
    medium: decisionRows.filter((row) => row.confidence >= 0.5 && row.confidence < 0.8).length,
    high: decisionRows.filter((row) => row.confidence >= 0.8).length,
  };

  const unsupportedDecisions = decisionRows.filter(
    (row) => row.supportingEvidenceIds.length === 0,
  ).length;

  return (
    <>
      {/* ---------------- What data was used ---------------- */}
      <ReportSection
        title="Data used"
        question="What data was used?"
        answer={`A synthetic corpus of ${documents.length} evidence documents drawn from ${sourceSystems.length} named source systems, covering ${entities.length} legal entities, ${users.length} people, ${suppliers.length} suppliers and ${incidents.length} incidents. No real bank data, no client data and no production extract is present.`}
      >
        <div className="grid grid-4">
          <ValueMetric
            label="Evidence documents"
            value={documents.length}
            basis="measured"
            derivation="Row count in evidence_documents for this scenario run."
          />
          <ValueMetric
            label="Source systems represented"
            value={sourceSystems.length}
            basis="measured"
            derivation="Distinct values of source_system across the corpus."
          />
          <ValueMetric
            label="Document types represented"
            value={sourceTypes.length}
            basis="measured"
            derivation="Distinct values of source_type across the corpus."
          />
          <ValueMetric
            label="Documents cited by a decision"
            value={citedByDecisions.size}
            basis="measured"
            derivation="Distinct identifiers appearing in the supporting or opposing evidence list of any decision row."
          />
        </div>

        <div className="grid grid-2">
          <div className="stack stack-2">
            <span className="label">Data classifications present in the corpus</span>
            <div className="table-wrap">
              <table className="table">
                <caption className="sr-only">Documents by data classification</caption>
                <thead>
                  <tr>
                    <th scope="col">Classification</th>
                    <th scope="col" className="num">
                      Documents
                    </th>
                    <th scope="col">Handling in this prototype</th>
                  </tr>
                </thead>
                <tbody>
                  {classifications.map((entry) => (
                    <tr key={entry.value}>
                      <th scope="row">
                        <Chip tone={classificationTone(entry.value)}>{entry.value}</Chip>
                      </th>
                      <td className="num">{entry.count}</td>
                      <td className="dim">{classificationHandling(entry.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Caveat>
              Classification is carried on the document row and travels with every citation. In this
              prototype it is descriptive: it labels the sensitivity a real document of this kind
              would carry, and it does not enforce an access decision, because there is no identity
              provider here to enforce one against.
            </Caveat>
          </div>

          <div className="stack stack-2">
            <span className="label">Corpus composition</span>
            <DistributionTable heading="Document type" rows={sourceTypes} />
            <DistributionTable heading="Source system" rows={sourceSystems} />
            <DistributionTable heading="Status" rows={documentStatus} />
          </div>
        </div>
      </ReportSection>

      {/* ---------------- Lineage ---------------- */}
      <ReportSection
        title="Evidence lineage"
        question="Where did the conclusion come from?"
        answer={`Every conclusion in the product carries the identifiers of the documents behind it. ${citedByDecisions.size} of ${documents.length} documents are cited by a decision, and ${unsupportedDecisions} of ${decisionRows.length} decisions carry no supporting citation at all.`}
        tone={unsupportedDecisions > 0 ? "amber" : "green"}
      >
        <div className="stack stack-3">
          <div className="stack stack-2">
            <span className="label">The chain, in order</span>
            <ol className="stack stack-2" style={{ fontSize: "var(--text-sm)" }}>
              {[
                "A synthetic source document enters the corpus with its source system, author label, document date, ingestion timestamp, data classification, status and provenance kind recorded.",
                "The document is split into retrieval chunks, each with a locator such as a section or paragraph reference, so a citation points at a place rather than at a whole file.",
                "A retrieval tool call returns chunk and document identifiers. The call is recorded in tool_calls with the identifiers it returned.",
                "A specialist produces a recommendation whose grounding block separates verified facts, approved records, stakeholder statements, conflicting evidence and model inference, each with source identifiers.",
                "The decision row stores the supporting and the opposing evidence identifiers separately. Opposing evidence is never dropped.",
                "The human decision records the chosen option and the rationale the person confirmed as theirs.",
                "Execution writes receipt lines naming the object that changed and the audit event that recorded it.",
              ].map((step, index) => (
                <li key={index} className="row row-2 row-start">
                  <span className="meta shrink-0" style={{ paddingTop: 2 }}>
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="grid grid-3">
            <ValueMetric
              label="Decisions recorded"
              value={decisionRows.length}
              basis="measured"
              derivation="Row count in decisions for this scenario run."
            />
            <ValueMetric
              label="Decisions with opposing evidence attached"
              value={decisionRows.filter((row) => row.opposingEvidenceIds.length > 0).length}
              basis="measured"
              derivation="Decision rows whose opposing evidence list is not empty."
              note="Evidence that argues against the prepared position is stored in its own column so it cannot be quietly omitted."
            />
            <ValueMetric
              label="Decisions with no supporting citation"
              value={unsupportedDecisions}
              basis="measured"
              tone={unsupportedDecisions > 0 ? "red" : "green"}
              derivation="Decision rows whose supporting evidence list is empty."
            />
          </div>
        </div>
      </ReportSection>

      {/* ---------------- Which model ---------------- */}
      <ReportSection
        title="Model used"
        question="Which model was used?"
        answer={
          modelsUsed.length === 0
            ? `No agent run is recorded, so no model has been used in this run. The configuration resolves the primary role to ${runtime.models.primary} by ${runtime.models.provenance.primary}.`
            : `${modelsUsed.length} distinct model identifiers appear on the agent runs in this scenario run. The resolved configuration is shown in full in the control room, including how each role was decided.`
        }
      >
        <div className="grid grid-2">
          <div className="stack stack-3">
            <KeyValue label="Primary">
              <span className="mono">{runtime.models.primary}</span>
              <Chip tone="neutral">{runtime.models.provenance.primary}</Chip>
            </KeyValue>
            <KeyValue label="Fast">
              <span className="mono">{runtime.models.fast}</span>
              <Chip tone="neutral">{runtime.models.provenance.fast}</Chip>
            </KeyValue>
            <KeyValue label="Deep">
              <span className="mono">{runtime.models.deep}</span>
              <Chip tone="neutral">{runtime.models.provenance.deep}</Chip>
            </KeyValue>
            <KeyValue label="Realtime">
              <span className="mono">{runtime.models.realtime ?? "none resolved"}</span>
              <Chip tone="neutral">{runtime.models.provenance.realtime}</Chip>
            </KeyValue>
            <KeyValue label="Embedding">
              <span className="mono">{runtime.models.embedding ?? "none resolved"}</span>
              <Chip tone="neutral">{runtime.models.provenance.embedding}</Chip>
            </KeyValue>
          </div>
          <div className="stack stack-2">
            <span className="label">Models recorded on agent runs</span>
            {modelsUsed.length === 0 ? (
              <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
                No agent run is recorded in this scenario run.
              </p>
            ) : (
              <DistributionTable heading="Model" rows={modelsUsed} />
            )}
            <Caveat>
              The model identifier is stored on the run rather than inferred from configuration, so
              a trace remains truthful about which model produced it after the configuration
              changes.
            </Caveat>
          </div>
        </div>
      </ReportSection>

      {/* ---------------- What the agent did ---------------- */}
      <ReportSection
        title="Agent activity"
        question="What did the agent do?"
        answer={`${calls.length} governed tool calls and ${runs.length} agent runs are recorded, alongside ${background.length} background actions performed before the professional arrived. ${heldCalls.length} calls were held for a human approval and ${blockedCalls.length} were refused.`}
      >
        <div className="grid grid-2">
          <DistributionTable
            heading="Tool calls by outcome"
            rows={countBy(calls, (call) => call.outcome)}
          />
          <DistributionTable
            heading="Tool calls by authority class"
            rows={countBy(calls, (call) => call.authorityClass)}
          />
        </div>
        <DistributionTable heading="Background action kind" rows={backgroundKinds} />
        <Caveat>
          Background actions are seeded rows, each naming the object it touched. The counts shown in
          the workday reveal are row counts over this table, which is why they can be expanded to
          the individual actions rather than only totalled.
        </Caveat>
      </ReportSection>

      {/* ---------------- Human approval ---------------- */}
      <ReportSection
        title="Human approval"
        question="What did the human approve?"
        answer={
          approvalRows.length === 0
            ? "No approval has been granted in this scenario run, so no material change has executed through an approved path."
            : `${approvalRows.length} approvals are recorded. Each one authorised exactly one tool against one payload fingerprint, and ${approvalRows.filter((row) => row.consumedAt !== null).length} have been consumed. An approval does not transfer to a different payload and cannot be replayed.`
        }
      >
        {approvalRows.length === 0 ? (
          <div className="empty-state">
            <span className="label">No approvals</span>
            <p>
              Material changes require an approval, so an empty list here means no material change
              has been executed in this run.
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Approvals and what each authorised</caption>
              <thead>
                <tr>
                  <th scope="col">Tool authorised</th>
                  <th scope="col">What that tool does</th>
                  <th scope="col">Approver</th>
                  <th scope="col">Role and autonomy</th>
                  <th scope="col">Rationale confirmed</th>
                  <th scope="col">Single use</th>
                </tr>
              </thead>
              <tbody>
                {approvalRows.map((row) => {
                  const tool = byName.get(row.toolName);
                  const approver = getUser(row.approvedByUserId);
                  return (
                    <tr key={row.id}>
                      <th scope="row" className="mono">
                        {row.toolName}
                      </th>
                      <td className="dim" style={{ maxWidth: 360 }}>
                        {tool?.description ?? "This tool is not in the registry, which is a defect."}
                      </td>
                      <td>{approver ? `${approver.name}, ${approver.jobTitle}` : row.approvedByUserId}</td>
                      <td className="mono meta">
                        {row.roleId} / {row.autonomyLevel}
                      </td>
                      <td>
                        <Chip tone={row.rationaleConfirmed ? "green" : "red"}>
                          {row.rationaleConfirmed ? "confirmed" : "not confirmed"}
                        </Chip>
                      </td>
                      <td>
                        <Chip tone={row.consumedAt ? "green" : "amber"}>
                          {row.consumedAt ? "consumed" : "unconsumed"}
                        </Chip>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="stack stack-2">
          <span className="label">What an approval has to satisfy</span>
          <ul className="stack stack-2" style={{ fontSize: "var(--text-sm)" }}>
            <li>It must be granted by a named person. An agent identity is refused as an approver.</li>
            <li>The approver must confirm the rationale is theirs, not merely accept a proposal.</li>
            <li>
              It is bound to a payload fingerprint, so approval of a small change does not authorise
              a larger one.
            </li>
            <li>It is single use. A consumed approval cannot be replayed.</li>
            <li>The approver must hold every authority scope the tool requires.</li>
            <li>The approving role must be the role that is acting.</li>
          </ul>
        </div>
      </ReportSection>

      {/* ---------------- Blocked ---------------- */}
      <ReportSection
        title="Refused actions"
        question="What actions were blocked?"
        answer={`${blockedCalls.length} tool calls were refused by the authority gate and ${blockedEvents.length} audit events record a refusal. Separately, ${registry.filter((tool) => tool.authorityClass === "PROHIBITED").length} tools are refused by design and can never execute.`}
        tone="red"
      >
        {blockedCalls.length === 0 && blockedEvents.length === 0 ? (
          <div className="empty-state">
            <span className="label">No refusal recorded in this run</span>
            <p>
              The prohibited tools listed in the authority matrix remain unreachable regardless. An
              empty list here means nothing in this run attempted an action outside authority.
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Refused actions with the reason given</caption>
              <thead>
                <tr>
                  <th scope="col">Action</th>
                  <th scope="col">Authority class</th>
                  <th scope="col">Autonomy in force</th>
                  <th scope="col">Reason recorded</th>
                </tr>
              </thead>
              <tbody>
                {blockedCalls.map((call) => (
                  <tr key={call.id}>
                    <th scope="row" className="mono">
                      {call.toolName}
                    </th>
                    <td>
                      <Chip tone={authorityTone(call.authorityClass)}>{call.authorityClass}</Chip>
                    </td>
                    <td className="mono meta">{call.autonomyLevel}</td>
                    <td style={{ color: "var(--red)", maxWidth: 520 }}>
                      {call.blockedReason ?? "No reason was recorded, which is itself a defect."}
                    </td>
                  </tr>
                ))}
                {blockedEvents
                  .filter((event) => !blockedCalls.some((call) => call.toolName === event.action))
                  .map((event) => (
                    <tr key={event.id}>
                      <th scope="row" className="mono">
                        {event.action}
                      </th>
                      <td>
                        {event.authorityClass ? (
                          <Chip tone={authorityTone(event.authorityClass)}>{event.authorityClass}</Chip>
                        ) : (
                          <span className="meta">not recorded</span>
                        )}
                      </td>
                      <td className="meta">from the audit trail</td>
                      <td style={{ color: "var(--red)", maxWidth: 520 }}>
                        {event.blockedReason ?? event.summary}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        <Caveat>
          A refusal writes an audit event. A gate that silently declines teaches an auditor nothing;
          the record of the refusal is the evidence that the control operates.
        </Caveat>
      </ReportSection>

      {/* ---------------- Which system changed ---------------- */}
      <ReportSection
        title="Systems and records changed"
        question="Which system changed?"
        answer={
          mutations.length === 0
            ? "Nothing has changed. No mutation event exists in this scenario run."
            : `${mutations.length} mutation events changed records in the local scenario database, across ${mutationsByObject.length} kinds of object, with ${receipts.length} receipt lines naming the specific record.`
        }
      >
        {mutations.length === 0 ? (
          <div className="empty-state">
            <span className="label">No state change</span>
            <p>Every read, draft and proposal in this run left the records untouched.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Mutations by object kind</caption>
              <thead>
                <tr>
                  <th scope="col">Object kind</th>
                  <th scope="col" className="num">
                    Changes
                  </th>
                  <th scope="col" className="num">
                    Recorded reversible
                  </th>
                </tr>
              </thead>
              <tbody>
                {mutationsByObject.map((entry) => (
                  <tr key={entry.objectKind}>
                    <th scope="row" className="mono">
                      {entry.objectKind}
                    </th>
                    <td className="num">{entry.count}</td>
                    <td className="num">{entry.reversible}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Caveat>
          In this prototype the target is a local database. In the bank, a state change would have
          to name the target system of record, the entity partition, the record identifier, the
          accountable person and the evidence reference. A change missing any of the five should be
          rejected, and the integration that enforces that does not exist here.
        </Caveat>
      </ReportSection>

      {/* ---------------- Reversibility ---------------- */}
      <ReportSection
        title="Reversibility"
        question="Can the action be reversed?"
        answer={`Reversibility is a property of the tool, declared in the registry, not a judgment made after the fact. ${registry.filter((tool) => tool.mutates && tool.reversible).length} mutating tools are reversible in this prototype and ${registry.filter((tool) => tool.mutates && !tool.reversible).length} are not. Of the changes actually made, ${mutations.filter((event) => event.reversible).length} of ${mutations.length} were recorded as reversible.`}
      >
        <div className="grid grid-3">
          <ValueMetric
            label="Mutating tools, reversible"
            value={registry.filter((tool) => tool.mutates && tool.reversible).length}
            basis="measured"
            derivation="Tools in the registry with mutates true and reversible true."
          />
          <ValueMetric
            label="Mutating tools, not reversible"
            value={registry.filter((tool) => tool.mutates && !tool.reversible).length}
            basis="measured"
            tone="red"
            derivation="Tools in the registry with mutates true and reversible false. A recorded rating or conclusion is superseded by a new version rather than deleted."
          />
          <ValueMetric
            label="Changes recorded as reversible"
            value={mutations.filter((event) => event.reversible).length}
            basis="measured"
            derivation="Mutation audit events with the reversible flag set."
          />
        </div>
        <ul className="stack stack-2" style={{ fontSize: "var(--text-sm)" }}>
          <li>
            Nothing is reversed by deletion. An assessment is superseded by a new version and both
            versions remain, which is why the history is a read rather than a reconstruction.
          </li>
          <li>
            Audit events are never reversed. <span className="mono">modifyAuditTrail</span> is a
            prohibited tool, so the record of a change survives the reversal of the change.
          </li>
          <li>
            The whole scenario can be reset to the seeded day. That resets the demonstration, not a
            bank record, and it is recorded as an action like any other.
          </li>
        </ul>
      </ReportSection>

      {/* ---------------- Retention ---------------- */}
      <ReportSection
        title="Retention"
        question="What is retained?"
        answer={`Everything is retained in one local database file inside this repository's data directory: ${documents.length} evidence documents, ${decisionRows.length} decisions, ${allEvents.length} audit events, ${calls.length} tool calls, ${runs.length} agent runs and ${cached.length} cached model outputs. Nothing is sent anywhere except the model calls that live mode makes.`}
      >
        <div className="grid grid-4">
          <ValueMetric
            label="Audit events retained"
            value={allEvents.length}
            basis="measured"
            derivation="Row count in audit_events for this scenario run."
          />
          <ValueMetric
            label="Tool calls retained"
            value={calls.length}
            basis="measured"
            derivation="Row count in tool_calls for this scenario run."
          />
          <ValueMetric
            label="Agent runs retained"
            value={runs.length}
            basis="measured"
            derivation="Row count in agent_runs for this scenario run."
          />
          <ValueMetric
            label="Cached model outputs retained"
            value={cached.length}
            basis="measured"
            derivation="Row count in cached_ai_outputs for this scenario run."
          />
        </div>
        <ul className="stack stack-2" style={{ fontSize: "var(--text-sm)" }}>
          <li>
            The database is a local file. It is not a managed service, it is not replicated and it
            is not backed up by this application.
          </li>
          <li>
            Audit events are append only. Nothing in this application updates or deletes one.
          </li>
          <li>
            Conversation turns are retained with a compaction flag rather than being deleted, so the
            rolling summary can be checked against what it summarised.
          </li>
          <li>
            No credential material is retained anywhere in this repository. The key is read at
            runtime and held only in process memory.
          </li>
          <li>
            A reset deletes and rewrites the scenario run, which is how the guarantee that a reset
            restores the original day is made structurally true rather than a best effort cleanup.
          </li>
          <li>
            There is no retention schedule, no legal hold mechanism and no deletion request handling
            in this prototype. Those are bank requirements that a production deployment must add.
          </li>
        </ul>
      </ReportSection>

      {/* ---------------- Synthetic ---------------- */}
      <ReportSection
        title="Synthetic content"
        question="What is synthetic?"
        answer={`All of it. ${entities.length} legal entities, ${users.length} people, ${suppliers.length} suppliers, ${documents.length} evidence documents, ${incidents.length} incidents and every transaction, control, rating and regulatory publication in this prototype were written for the demonstration.`}
        tone="cyan"
      >
        <div className="grid grid-4">
          <ValueMetric
            label="Synthetic legal entities"
            value={entities.length}
            basis="measured"
            derivation="Row count in legal_entities."
          />
          <ValueMetric
            label="Synthetic people"
            value={users.length}
            basis="measured"
            derivation="Row count in users. None of these people exists."
          />
          <ValueMetric
            label="Synthetic suppliers"
            value={suppliers.length}
            basis="measured"
            derivation="Row count in suppliers. No named supplier here is a real company."
          />
          <ValueMetric
            label="Synthetic incidents"
            value={incidents.length}
            basis="measured"
            derivation="Row count in incidents."
          />
        </div>
        <ul className="stack stack-2" style={{ fontSize: "var(--text-sm)" }}>
          <li>
            The synthetic label is rendered on every surface of this product without exception,
            including this one, and it is a component rather than a string so it cannot be omitted
            from a new screen by accident.
          </li>
          <li>
            Regulatory publications in the corpus are invented documents that imitate the shape of a
            real one. They are not extracts of any published text.
          </li>
          <li>
            Outbound communication is simulated. Collaboration messages carry an explicit flag
            recording that they never reach a recipient, and sending mail outside this machine is a
            prohibited tool.
          </li>
          <li>
            No figure anywhere in this product describes a real bank, a real saving or a real
            supplier relationship.
          </li>
        </ul>
      </ReportSection>

      {/* ---------------- Degradation ---------------- */}
      <ReportSection
        title="Behaviour without AI"
        question="What happens when AI is unavailable?"
        answer={`The product runs. ${cached.length} cached beats cover the critical path, the deterministic calculators and the authority gate do not involve a model at all, and a requested mode is downgraded with a stated reason rather than failing. The effective mode right now is "${runtime.demoMode.mode}".`}
      >
        <div className="stack stack-3">
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Behaviour in each mode</caption>
              <thead>
                <tr>
                  <th scope="col">Mode</th>
                  <th scope="col">Network calls</th>
                  <th scope="col">Critical story beats</th>
                  <th scope="col">What a reader loses</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">live</th>
                  <td>Real calls, streaming, specialist delegation.</td>
                  <td>Generated, validated against a named schema.</td>
                  <td>Nothing, but timing varies and a call can fail.</td>
                </tr>
                <tr>
                  <th scope="row">safe</th>
                  <td>Only for optional free questions.</td>
                  <td>Served from cache with deterministic timing.</td>
                  <td>Novelty. The content is a known good output, not a fresh one.</td>
                </tr>
                <tr>
                  <th scope="row">offline</th>
                  <td>None at all.</td>
                  <td>Seeded responses only.</td>
                  <td>Free questions and voice. The scripted day is unaffected.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul className="stack stack-2" style={{ fontSize: "var(--text-sm)" }}>
            <li>
              The authority gate, the audit service, the deterministic calculators, the evidence
              corpus and the reveal timeline involve no model and are unaffected by a model outage.
            </li>
            <li>
              Voice degrades to typed interaction when no realtime model is available to the
              account, and the degradation is stated rather than hidden.
            </li>
            <li>
              A cached output is labelled as cached wherever it appears. It is never presented as a
              live call.
            </li>
          </ul>
        </div>
      </ReportSection>

      {/* ---------------- Ownership ---------------- */}
      <ReportSection
        title="Agent ownership"
        question="Who owns each agent?"
        answer={`Each specialist agent is owned by the professional whose function it serves, and the decisions that must remain with that person are recorded on the role rather than left to convention. ${roles.length} roles are defined, each naming its specialist agent and its human owned decisions.`}
      >
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">Agent ownership and human owned decisions per role</caption>
            <thead>
              <tr>
                <th scope="col">Function</th>
                <th scope="col">Specialist agent</th>
                <th scope="col">Accountable person</th>
                <th scope="col">Decisions that stay with the person</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => {
                const holder = getUser(role.holderUserId);
                return (
                  <tr key={role.id}>
                    <th scope="row">
                      {language === "de" ? role.titleDe : role.title}
                    </th>
                    <td className="mono">{role.specialistAgent}</td>
                    <td>{holder ? `${holder.name}, ${holder.jobTitle}` : "not recorded"}</td>
                    <td className="dim">
                      <ul className="stack stack-1">
                        {role.humanOwnedDecisions.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Caveat>
          The manager agent orchestrates and never decides. A specialist prepares, cites and
          recommends and never decides. Every decision in the list above is presented to a person
          with alternatives and stated uncertainty, and stays open until that person records a
          judgment.
        </Caveat>
      </ReportSection>

      {/* ---------------- Audit trail ---------------- */}
      <ReportSection
        title="Audit trail"
        question="Where is the audit trail?"
        answer={`In one append only table, ${completeness.total} events for this run, of which ${completeness.preExisting} were seeded as pre existing history and ${completeness.sessionEvents} were written by this session. ${completeness.mutations} record a state change, ${completeness.approvals} an approval, ${completeness.decisions} a decision and ${completeness.blocked} a refusal.`}
      >
        <div className="grid grid-4">
          <ValueMetric
            label="Audit events"
            value={completeness.total}
            basis="measured"
            derivation="getAuditCompleteness total for this scenario run."
          />
          <ValueMetric
            label="State changes recorded"
            value={completeness.mutations}
            basis="measured"
            derivation="Audit events of category mutation."
          />
          <ValueMetric
            label="Approvals recorded"
            value={completeness.approvals}
            basis="measured"
            derivation="Audit events of category approval."
          />
          <ValueMetric
            label="Refusals recorded"
            value={completeness.blocked}
            basis="measured"
            tone="red"
            derivation="Audit events with the blocked flag set."
          />
          <ValueMetric
            label="Decisions recorded"
            value={completeness.decisions}
            basis="measured"
            derivation="Audit events of category decision."
          />
          <ValueMetric
            label="Written by this session"
            value={completeness.sessionEvents}
            basis="measured"
            derivation="Audit events with pre_existing false."
          />
          <ValueMetric
            label="Seeded as prior history"
            value={completeness.preExisting}
            basis="measured"
            derivation="Audit events with pre_existing true. These represent the history a real institution would already hold."
          />
          <ValueMetric
            label="Mutations without a receipt line"
            value={Math.max(0, completeness.mutations - receipts.length)}
            basis="measured"
            tone={completeness.mutations > receipts.length ? "amber" : "green"}
            derivation="Mutation events minus execution receipt lines. A positive number means a change was audited without a receipt naming the record, which would be a completeness defect."
          />
        </div>

        <div className="stack stack-2">
          <span className="label">Most recent events ({recentEvents.length} shown)</span>
          {recentEvents.length === 0 ? (
            <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
              No audit event exists for this scenario run.
            </p>
          ) : (
            <div className="table-wrap" style={{ maxHeight: 520 }}>
              <table className="table">
                <caption className="sr-only">Recent audit events</caption>
                <thead>
                  <tr>
                    <th scope="col">Event</th>
                    <th scope="col">Moment</th>
                    <th scope="col">Category</th>
                    <th scope="col">Actor</th>
                    <th scope="col">Object</th>
                    <th scope="col">Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEvents.map((event) => (
                    <tr key={event.id}>
                      <th scope="row" className="mono meta">
                        {event.id}
                      </th>
                      <td className="mono meta">{event.atMoment}</td>
                      <td>
                        <Chip tone={event.blocked ? "red" : categoryTone(event.category)}>
                          {event.blocked ? "blocked" : event.category}
                        </Chip>
                      </td>
                      <td className="meta">{event.actorKind}</td>
                      <td className="mono meta">
                        {event.objectKind} {event.objectId}
                      </td>
                      <td className="dim" style={{ maxWidth: 480 }}>
                        {event.summary}
                        {event.blockedReason ? (
                          <span style={{ color: "var(--red)" }}> {event.blockedReason}</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <Caveat>
          Completeness here means that every mutation this application performed wrote an event. It
          does not mean the trail satisfies a supervisory record keeping requirement; that
          assessment belongs to the bank.
        </Caveat>
      </ReportSection>

      {/* ---------------- Fact, inference, dispute ---------------- */}
      <ReportSection
        title="Fact, inference and dispute"
        question="Which statements are fact, inference, or dispute?"
        answer={`They are separated at the row level and never merged into one unlabelled field. Across the corpus, ${documentProvenance.length} provenance kinds are present. ${contradictionPairs} pairs of conflicting statements are recorded in the incident chronology and are shown side by side rather than resolved.`}
      >
        <div className="grid grid-2">
          <div className="stack stack-3">
            <span className="label">Provenance in the evidence corpus</span>
            <div className="table-wrap">
              <table className="table">
                <caption className="sr-only">Documents by provenance kind</caption>
                <thead>
                  <tr>
                    <th scope="col">Provenance</th>
                    <th scope="col" className="num">
                      Documents
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {PROVENANCE_KINDS.map((kind) => {
                    const entry = documentProvenance.find((row) => row.value === kind);
                    return (
                      <tr key={kind}>
                        <th scope="row">
                          <ProvenanceBadge kind={kind} language={language} />
                        </th>
                        <td className="num">{entry?.count ?? 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {statementProvenance.length > 0 ? (
              <DistributionTable heading="Provenance of meeting statements" rows={statementProvenance} />
            ) : null}
          </div>

          <div className="stack stack-3">
            <span className="label">Stated confidence on the prepared positions</span>
            <div className="stack stack-2">
              <div className="row row-3 row-between">
                <span style={{ fontSize: "var(--text-sm)" }}>High, at or above 80 of 100</span>
                <Chip tone="green">{confidenceBands.high}</Chip>
              </div>
              <div className="row row-3 row-between">
                <span style={{ fontSize: "var(--text-sm)" }}>Medium, 50 to 79 of 100</span>
                <Chip tone="amber">{confidenceBands.medium}</Chip>
              </div>
              <div className="row row-3 row-between">
                <span style={{ fontSize: "var(--text-sm)" }}>Low, below 50 of 100</span>
                <Chip tone="red">{confidenceBands.low}</Chip>
              </div>
              <div className="row row-2 row-wrap">
                <BasisLabel basis="measured" />
                <span className="meta">counted from the confidence column on decision rows</span>
              </div>
            </div>
            {decisionRows.length > 0 ? (
              <div className="stack stack-2">
                <span className="label">Example, as rendered in the product</span>
                {decisionRows.slice(0, 3).map((row) => (
                  <div key={row.id} className="card">
                    <div className="stack stack-2">
                      <span className="strong-text" style={{ fontSize: "var(--text-sm)" }}>
                        {row.title}
                      </span>
                      <ConfidenceMeter value={row.confidence} />
                      <p className="dim" style={{ fontSize: "var(--text-sm)" }}>
                        {row.uncertaintyNote}
                      </p>
                      <ObjectId id={row.id} />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <Caveat>
              Confidence is stated by the component that produced the position. It is not calibrated
              against outcomes, because this prototype has no outcomes to calibrate against.
            </Caveat>
          </div>
        </div>
      </ReportSection>
    </>
  );
}

/* ==========================================================================
   Jurisdiction
   ========================================================================== */

/**
 * The jurisdiction section.
 *
 * The European and the Swiss contexts are rendered as separate blocks with
 * separate reference lists. They are never combined into one list, and the
 * Swiss block states in its own words that the European regulation does not
 * apply to that entity, because an omission would be read as coverage.
 */
function JurisdictionSection({ seeded }: { seeded: boolean }) {
  const entities = seeded ? getEntities() : [];
  const euEntities = entities.filter((entity) => entity.regulatoryBloc === "eu");
  const chEntities = entities.filter((entity) => entity.regulatoryBloc === "ch");

  return (
    <ReportSection
      title="Jurisdiction"
      question="Which jurisdiction is relevant?"
      answer="Two, and they are kept apart. The European entities sit under the European framework. The Swiss entity sits under the Swiss framework, and the European digital operational resilience regulation does not apply to it. Applicability is a human interpretation in this product, never a model conclusion."
    >
      <div className="grid grid-2">
        <div className="card card-edge" data-tone="cyan">
          <div className="stack stack-3">
            <div className="row row-2 row-wrap row-between">
              <span className="strong-text">European Union entities</span>
              <Chip tone="cyan">{euEntities.length} entities</Chip>
            </div>
            {euEntities.length > 0 ? (
              <ul className="stack stack-1">
                {euEntities.map((entity) => (
                  <li key={entity.id} className="row row-2 row-wrap meta">
                    <span className="mono">{entity.id}</span>
                    <span>{entity.name}</span>
                    <span>&middot;</span>
                    <span>{entity.jurisdiction}</span>
                    <span>&middot;</span>
                    <span>{entity.supervisoryContext}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="meta">Entity rows are not available without a seeded scenario.</p>
            )}
            <div className="stack stack-1">
              <span className="label">Frameworks referenced in the scenario</span>
              <ul className="stack stack-1" style={{ fontSize: "var(--text-sm)" }}>
                <li>The European digital operational resilience regulation, for information and communication technology third party risk, the register of information, subcontracting, and incident classification and reporting.</li>
                <li>European banking authority guidelines on outsourcing arrangements, for material outsourcing classification, register content, audit rights and exit planning.</li>
                <li>The German minimum requirements for risk management, for the internal control system and outsourcing governance.</li>
                <li>The German supervisory requirements for information technology, for change management and third party technology governance.</li>
                <li>National supervision by the German and Austrian authorities and the national central bank, for supervisory access and reporting context.</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="card card-edge" data-tone="amber">
          <div className="stack stack-3">
            <div className="row row-2 row-wrap row-between">
              <span className="strong-text">Swiss entity</span>
              <Chip tone="amber">{chEntities.length} entity</Chip>
            </div>
            {chEntities.length > 0 ? (
              <ul className="stack stack-1">
                {chEntities.map((entity) => (
                  <li key={entity.id} className="row row-2 row-wrap meta">
                    <span className="mono">{entity.id}</span>
                    <span>{entity.name}</span>
                    <span>&middot;</span>
                    <span>{entity.jurisdiction}</span>
                    <span>&middot;</span>
                    <span>{entity.supervisoryContext}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="meta">Entity rows are not available without a seeded scenario.</p>
            )}
            <div
              className="card"
              style={{ background: "var(--red-tint)", borderColor: "var(--red-edge)" }}
            >
              <p className="strong-text" style={{ fontSize: "var(--text-sm)" }}>
                The European digital operational resilience regulation does not apply to the Swiss
                entity. Where a group level view aggregates all three entities, any field derived
                from that regulation is shown as not applicable for the Swiss entity rather than
                left blank, because a blank would be read as coverage.
              </p>
            </div>
            <div className="stack stack-1">
              <span className="label">Frameworks referenced in the scenario</span>
              <ul className="stack stack-1" style={{ fontSize: "var(--text-sm)" }}>
                <li>The Swiss supervisory circular on operational risks and resilience for banks, for critical business processes, tolerance for disruption and technology risk.</li>
                <li>The Swiss supervisory circular on outsourcing for banks and insurers, for material outsourcing, the inventory, supervisory and audit access, and data access by subcontractors abroad.</li>
                <li>The Swiss Banking Act and Banking Ordinance, for entity level prudential framing.</li>
                <li>The Swiss Federal Act on Data Protection, for cross border disclosure of client identifying data.</li>
                <li>Swiss supervisory reporting expectations for incidents of substantial importance.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="stack stack-2">
        <span className="label">How applicability is handled in the product</span>
        <ul className="stack stack-2" style={{ fontSize: "var(--text-sm)" }}>
          <li>
            An obligation carries candidate entities, which the system proposes, and an
            applicability decision, which only a person records. The two are separate columns.
          </li>
          <li>
            Group functions cannot absorb an entity sign off. A local entity decision is required and
            is recorded against that entity.
          </li>
          <li>
            The product never states that the institution is compliant with anything. It records
            what was decided, by whom, on what evidence.
          </li>
          <li>
            Contacting a supervisory authority is a prohibited tool. The product records a
            recommendation about notification and notifies nobody.
          </li>
        </ul>
        {/* The mandatory label on every regulatory reference, as a component. */}
        <RegulatoryNote />
      </div>
    </ReportSection>
  );
}

/* ==========================================================================
   Small local components
   ========================================================================== */

function DistributionTable({
  heading,
  rows,
}: {
  heading: string;
  rows: Array<{ value: string; count: number }>;
}) {
  return (
    <div className="stack stack-2">
      <span className="label">{heading}</span>
      <div className="table-wrap">
        <table className="table">
          <caption className="sr-only">{heading}</caption>
          <thead>
            <tr>
              <th scope="col">{heading}</th>
              <th scope="col" className="num">
                Rows
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.value}>
                <th scope="row" className="mono">
                  {row.value}
                </th>
                <td className="num">{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ==========================================================================
   Tone mapping
   ========================================================================== */

function authorityTone(authorityClass: string): Tone {
  switch (authorityClass) {
    case "READ":
      return "cyan";
    case "DRAFT":
      return "neutral";
    case "PROPOSE":
      return "accent";
    case "POLICY_BOUND_AUTONOMOUS":
      return "green";
    case "APPROVAL_REQUIRED":
      return "amber";
    case "PROHIBITED":
      return "red";
    default:
      return "neutral";
  }
}

function categoryTone(category: string): Tone {
  switch (category) {
    case "mutation":
      return "amber";
    case "approval":
      return "green";
    case "decision":
      return "accent";
    case "blocked":
      return "red";
    case "tool-call":
      return "cyan";
    default:
      return "neutral";
  }
}

function classificationTone(classification: string): Tone {
  switch (classification) {
    case "public":
      return "green";
    case "internal":
      return "cyan";
    case "confidential":
      return "amber";
    case "strictly-confidential":
      return "red";
    default:
      return "neutral";
  }
}

function classificationHandling(classification: string): string {
  switch (classification) {
    case "public":
      return "No restriction. Included in retrieval and citable anywhere in the product.";
    case "internal":
      return "Citable within the product. Not included in any exported executive material.";
    case "confidential":
      return "Citable with the classification shown on the citation. Excluded from exports.";
    case "strictly-confidential":
      return "Citable with the classification shown. In a real deployment this class would require an access decision that this prototype cannot enforce.";
    default:
      return "Classification is carried on the row and travels with the citation.";
  }
}

function toneColour(tone: Tone): string {
  switch (tone) {
    case "accent":
      return "var(--accent)";
    case "cyan":
      return "var(--cyan)";
    case "green":
      return "var(--green)";
    case "amber":
      return "var(--amber)";
    case "red":
      return "var(--red)";
    case "pink":
      return "var(--pink)";
    default:
      return "var(--text-4)";
  }
}

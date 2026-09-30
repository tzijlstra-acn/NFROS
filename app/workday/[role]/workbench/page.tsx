/**
 * The workbench: the role's hero work object.
 *
 * This is the one screen in the product that is genuinely different per
 * function. The shell, the rail, the timeline and the decision flow are common
 * infrastructure; the thing in the middle of this page is the professional
 * work product, and a Third-Party Risk Manager's work product is not a Control
 * Assurance Specialist's.
 *
 * Every section is fed from the repository. Nothing on this page is computed by
 * a model, and where a value is derived rather than recorded the derivation is
 * stated next to it.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { isDatabaseReady } from "@/db/client";
import { ROLE_IDS, type RoleId } from "@/db/schema/core";
import {
  compareAssessments,
  getAllDecisions,
  getAllSubprocessors,
  getCommitteeItems,
  getControl,
  getControlTest,
  getControlTests,
  getDecisionThread,
  getEntity,
  getImpactTolerances,
  getIncidentTimeline,
  getObligations,
  getPolicy,
  getPopulationSummary,
  getProcess,
  getPortfolioThemes,
  getRecoveryOptions,
  getRegulatoryPublications,
  getRiskControlGraph,
  getRole,
  getRoles,
  getServiceDependencies,
  getServices,
  getSharedEventIncident,
  getSuppliers,
  getSupplierExposure,
  getUnownedObligationGaps,
  getUser,
  getUserNameMap,
} from "@/db/repositories/workday";
import { buildIntelligenceRail, uncertaintyFromEvidence } from "@/db/repositories/rail";
import { getScenarioState, SHARED_EVENT_MOMENT } from "@/scenario/engine/state";
import { NotSeeded, WorkdayShell } from "@/components/shell/WorkdayShell";
import { IntelligenceRail } from "@/components/shell/IntelligenceRail";
import {
  Chip,
  ConfidenceMeter,
  ObjectId,
  ProvenanceBadge,
  RegulatoryNote,
  type Tone,
  type UncertaintyEntry,
} from "@/components/evidence/primitives";
import {
  SupplierConstellation,
  type ConstellationCriticality,
  type ConstellationEdge,
  type ConstellationNode,
  type ObligationEvidenceCounts,
} from "@/components/visualisations/SupplierConstellation";
import {
  RiskControlGraph,
  type ControlNodeView,
  type IndicatorNodeView,
  type ProcessNodeView,
  type RiskNodeView,
} from "@/components/visualisations/RiskControlGraph";
import {
  PopulationField,
  type PopulationCase,
} from "@/components/visualisations/PopulationField";
import {
  ServiceDependencyMap,
  type DependencyEdgeView,
  type DependencyKind,
  type DependencyNodeView,
  type ToleranceMeasureView,
  type ToleranceState,
} from "@/components/visualisations/ServiceDependencyMap";
import {
  ObligationLineage,
  type LineageLane,
  type LineageObligation,
  type LineagePublication,
  type LineageTarget,
  type LineageTerminalState,
} from "@/components/visualisations/ObligationLineage";
import {
  PortfolioThread,
  type PortfolioLensView,
  type PortfolioMatterView,
} from "@/components/visualisations/PortfolioThread";
import {
  calculateToleranceRemaining,
  CONTROL_EFFECTIVENESS,
  CONTROL_EFFECTIVENESS_LABELS,
  formatAmount,
  formatDateDach,
  type ControlEffectiveness,
} from "@/domain/nfr/calculators";
import type { Language } from "@/i18n/labels";

export const dynamic = "force-dynamic";

function parseRole(value: string): RoleId {
  if ((ROLE_IDS as readonly string[]).includes(value)) return value as RoleId;
  notFound();
}

/* The scenario subjects. Each one is resolved with a fallback, so a reseed
   that renames a row degrades the page rather than breaking it. */
const TPRM_SUPPLIER_ID = "TP-0042";
const RCSA_PROCESS_ID = "PRC-0041";
const ASSURANCE_TEST_ID = "TST-2026-0318";

/** What the centre of the page renders, assembled per role. */
interface Workbench {
  heading: string;
  standfirst: string;
  badges: Array<{ label: string; tone: Tone }>;
  body: React.ReactNode;
  evidenceIds: string[];
  whyThisMatters: string[];
  uncertainty: UncertaintyEntry[];
  contextLabel: string;
}

/**
 * Dispatch on the role.
 *
 * A switch rather than a lookup table, because each builder takes a different
 * slice of the scenario and a uniform signature would only hide that.
 */
function buildWorkbench(
  roleId: RoleId,
  names: Map<string, string>,
  moment: string,
  language: Language,
): Workbench {
  switch (roleId) {
    case "tprm":
      return buildSupplierDossier(names, moment, language);
    case "rcsa":
      return buildRiskControlWorkbench(names, language);
    case "control-assurance":
      return buildPopulationWorkbench(names, language);
    case "incident-resilience":
      return buildResilienceWorkbench(names, moment, language);
    case "regulatory-change":
      return buildObligationWorkbench(names, language);
    case "nfr-governance":
      return buildPortfolioWorkbench(names, moment, language);
    default:
      return {
        heading: "Workbench",
        standfirst: "No hero work object is defined for this role.",
        badges: [],
        body: <Missing what="This role has no workbench in this build." />,
        evidenceIds: [],
        whyThisMatters: [],
        uncertainty: [],
        contextLabel: "Workbench, no hero work object.",
      };
  }
}

export default async function WorkbenchPage({ params }: { params: Promise<{ role: string }> }) {
  const { role: roleParam } = await params;
  const roleId = parseRole(roleParam);

  if (!isDatabaseReady()) return <NotSeeded />;
  const state = getScenarioState();
  if (!state) return <NotSeeded />;

  const language = state.language as Language;
  const role = getRole(roleId);
  if (!role) return <NotSeeded />;

  const names = getUserNameMap();
  const moment = state.currentMoment;

  const workbench = buildWorkbench(roleId, names, moment, language);

  const rail = buildIntelligenceRail({
    roleId,
    atMoment: moment,
    language,
    contextLabel: workbench.contextLabel,
    evidenceIds: workbench.evidenceIds,
    whyThisMatters: workbench.whyThisMatters,
    uncertainty: [
      ...uncertaintyFromEvidence(workbench.evidenceIds),
      ...workbench.uncertainty,
    ],
  });

  return (
    <WorkdayShell
      roleId={roleId}
      activeNav="workbench"
      intelligenceRail={<IntelligenceRail {...rail} />}
    >
      <div className="stack stack-8">
        <header className="stack stack-3">
          <div className="row row-3 row-between row-wrap row-start">
            <div className="stack stack-1">
              <span className="label">
                {moment} &middot; {role.heroVisualLabel}
              </span>
              <h1 className="display" style={{ fontSize: "var(--text-2xl)" }}>
                {workbench.heading}
              </h1>
            </div>
            <div className="row row-2 row-wrap">
              {workbench.badges.map((badge) => (
                <Chip key={badge.label} tone={badge.tone}>
                  {badge.label}
                </Chip>
              ))}
            </div>
          </div>
          <p className="lede">{workbench.standfirst}</p>
          <div className="row row-3 row-wrap">
            <Link href={`/workday/${roleId}/decisions`} className="btn btn-sm btn-quiet">
              The decisions this raises
            </Link>
            <Link href={`/workday/${roleId}`} className="btn btn-sm btn-ghost">
              Back to today
            </Link>
          </div>
        </header>

        {workbench.body}

        <footer className="stack stack-2">
          <RegulatoryNote language={language} />
          <div className="row row-3 row-wrap">
            <ObjectId id={role.id} label="role" />
            <ObjectId id={role.heroVisual} label="hero visual" />
            <span className="meta">
              Synthetic institution. Every identifier on this page resolves to a seeded row.
            </span>
          </div>
        </footer>
      </div>
    </WorkdayShell>
  );
}

/* ==========================================================================
   Shared small pieces
   ========================================================================== */

function Section({
  title,
  note,
  children,
  tone,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <section className="panel" aria-label={title}>
      <div className="panel-head">
        <span className="panel-title">{title}</span>
        {note ? (
          tone ? (
            <Chip tone={tone}>{note}</Chip>
          ) : (
            <span className="meta">{note}</span>
          )
        ) : null}
      </div>
      <div className="panel-body stack stack-4">{children}</div>
    </section>
  );
}

function Missing({ what }: { what: string }) {
  return (
    <div className="empty-state">
      <span className="label">Not available</span>
      <p>{what}</p>
    </div>
  );
}

function VisualFrame({ children, caption }: { children: React.ReactNode; caption: string }) {
  return (
    <figure className="stack stack-2" style={{ margin: 0 }}>
      <div style={{ overflowX: "auto" }}>{children}</div>
      <figcaption className="meta">{caption}</figcaption>
    </figure>
  );
}

const EVIDENCE_STATUS_TONE: Record<string, Tone> = {
  met: "green",
  "partially-met": "amber",
  "not-evidenced": "red",
  breached: "red",
};

const EFFECTIVENESS_TONE: Record<string, Tone> = {
  "fully-effective": "green",
  "largely-effective": "cyan",
  "partially-effective": "amber",
  "not-effective": "red",
  "not-assessed": "neutral",
};

function effectivenessLabel(value: string): string {
  const entry = CONTROL_EFFECTIVENESS_LABELS[value as ControlEffectiveness];
  return entry ? entry.en : value;
}

/**
 * Who set the recorded effectiveness.
 *
 * The seed writes the literal "seed" into this column for a baseline value.
 * Rendering that word to a risk professional would be meaningless, so it is
 * translated into what it actually means.
 */
function setterLabel(setBy: string, names: Map<string, string>): string {
  if (setBy === "seed") return "the recorded baseline, not changed in this session";
  return names.get(setBy) ?? setBy;
}

/** Distance between two effectiveness bands, in bands. */
function bandsApart(first: string, second: string): number {
  const order = (value: string) =>
    (CONTROL_EFFECTIVENESS as readonly string[]).indexOf(value);
  const a = order(first);
  const b = order(second);
  if (a < 0 || b < 0) return 0;
  return Math.abs(a - b);
}

function narrowCriticality(value: string): ConstellationCriticality {
  if (value === "critical" || value === "important" || value === "standard" || value === "supporting") {
    return value;
  }
  return "standard";
}

function narrowStrength(value: string): "critical" | "important" | "supporting" {
  if (value === "critical" || value === "important" || value === "supporting") return value;
  return "supporting";
}

/* ==========================================================================
   1. Third-Party Risk Manager: the supplier dossier
   ========================================================================== */

function buildSupplierDossier(
  names: Map<string, string>,
  moment: string,
  language: Language,
): Workbench {
  const supplierId =
    getSuppliers().find((row) => row.id === TPRM_SUPPLIER_ID)?.id ??
    getSuppliers().find((row) => row.criticality === "critical")?.id ??
    getSuppliers()[0]?.id ??
    null;

  const exposure = supplierId ? getSupplierExposure(supplierId) : null;

  if (!exposure) {
    return {
      heading: "Supplier dossier",
      standfirst: "No supplier is available in this run.",
      badges: [],
      body: <Missing what="No supplier row could be resolved, so there is no dossier to render." />,
      evidenceIds: [],
      whyThisMatters: [],
      uncertainty: [],
      contextLabel: "Supplier dossier, no supplier resolved.",
    };
  }

  const { supplier, services, subprocessors, contracts, obligations, dependencies } = exposure;

  /* ---- Obligation evidence position, counted rather than asserted ---- */
  const counts: ObligationEvidenceCounts = {
    met: obligations.filter((row) => row.evidenceStatus === "met").length,
    partiallyMet: obligations.filter((row) => row.evidenceStatus === "partially-met").length,
    notEvidenced: obligations.filter((row) => row.evidenceStatus === "not-evidenced").length,
    breached: obligations.filter((row) => row.evidenceStatus === "breached").length,
  };

  /* ---- Constellation nodes ---- */
  const isFourthParty = (id: string) => /-F\d+$/.test(id);
  const parentOf = (id: string) => id.replace(/-F\d+$/, "");

  const strengthByTarget = new Map<string, string>();
  const eventTargets = new Set<string>();
  const spofTargets = new Set<string>();
  for (const dep of dependencies) {
    strengthByTarget.set(dep.toId, dep.dependencyStrength);
    if (dep.affectedByEvent) {
      eventTargets.add(dep.toId);
      eventTargets.add(dep.fromId);
    }
    if (dep.singlePointOfFailure) spofTargets.add(dep.toId);
  }
  /* The service level dependency rows hang off the business service, not off
     the supplier, so they are read separately to colour the service ring. */
  for (const dep of getServiceDependencies()) {
    if (services.some((service) => service.id === dep.toId)) {
      strengthByTarget.set(dep.toId, dep.dependencyStrength);
      if (dep.affectedByEvent) eventTargets.add(dep.toId);
      if (dep.singlePointOfFailure) spofTargets.add(dep.toId);
    }
  }

  const nodes: ConstellationNode[] = [
    {
      id: supplier.id,
      ring: "supplier",
      label: supplier.name,
      detail: `${supplier.legalForm}, ${supplier.domicile}`,
      criticality: narrowCriticality(supplier.criticality),
      affectedByEvent: true,
      evidence: counts,
    },
    ...services.map<ConstellationNode>((service) => ({
      id: service.id,
      ring: "service",
      label: service.name,
      detail: service.domain,
      criticality: narrowCriticality(strengthByTarget.get(service.id) ?? "standard"),
      supportsCriticalFunction: service.isImportantBusinessService,
      singlePointOfFailure: spofTargets.has(service.id),
      affectedByEvent: eventTargets.has(service.id),
    })),
    ...subprocessors.map<ConstellationNode>((sub) => ({
      id: sub.id,
      ring: isFourthParty(sub.id) ? "fourth-party" : "subprocessor",
      label: sub.name,
      detail: sub.domicile,
      dataLocation: sub.dataLocation,
      supportsCriticalFunction: sub.supportsCriticalFunction,
      isDiscrepancy: sub.isDiscrepancy,
      ...(sub.discrepancyNote.length > 0 ? { discrepancyNote: sub.discrepancyNote } : {}),
      ...(sub.declaredIn === "contract-appendix" ||
      sub.declaredIn === "supplier-submission" ||
      sub.declaredIn === "both"
        ? { declaredIn: sub.declaredIn }
        : {}),
      affectedByEvent: eventTargets.has(sub.id),
    })),
  ];

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges: ConstellationEdge[] = [];
  const edgeSeen = new Set<string>();

  for (const dep of dependencies) {
    if (!nodeIds.has(dep.fromId) || !nodeIds.has(dep.toId)) continue;
    edges.push({
      id: dep.id,
      from: dep.fromId,
      to: dep.toId,
      strength: narrowStrength(dep.dependencyStrength),
      singlePointOfFailure: dep.singlePointOfFailure,
      affectedByEvent: dep.affectedByEvent,
      ...(dep.note.length > 0 ? { note: dep.note } : {}),
    });
    edgeSeen.add(`${dep.fromId}|${dep.toId}`);
    edgeSeen.add(`${dep.toId}|${dep.fromId}`);
  }

  /* Structural edges. The dependency table records operational dependencies
     between business services and their providers, not the delivery
     relationship between a supplier and its own services, so those edges are
     added here and labelled as structural rather than as recorded. */
  for (const service of services) {
    if (edgeSeen.has(`${supplier.id}|${service.id}`)) continue;
    edges.push({
      id: `structural-${supplier.id}-${service.id}`,
      from: supplier.id,
      to: service.id,
      strength: narrowStrength(strengthByTarget.get(service.id) ?? "supporting"),
      singlePointOfFailure: spofTargets.has(service.id),
      affectedByEvent: eventTargets.has(service.id),
      note: "Delivery relationship from the service register. No dependency row records this edge.",
    });
    edgeSeen.add(`${supplier.id}|${service.id}`);
  }
  for (const sub of subprocessors) {
    const from = isFourthParty(sub.id) ? parentOf(sub.id) : supplier.id;
    if (!nodeIds.has(from) || edgeSeen.has(`${from}|${sub.id}`)) continue;
    edges.push({
      id: `structural-${from}-${sub.id}`,
      from,
      to: sub.id,
      strength: sub.supportsCriticalFunction ? "critical" : "supporting",
      affectedByEvent: eventTargets.has(sub.id),
      note: isFourthParty(sub.id)
        ? "Engaged by the subprocessor, not by the supplier."
        : "Engagement recorded on the subprocessor register.",
    });
    edgeSeen.add(`${from}|${sub.id}`);
  }

  /* ---- The appendix versus submission comparison ---- */
  const inAppendix = subprocessors.filter(
    (sub) => sub.declaredIn === "both" || sub.declaredIn === "contract-appendix",
  );
  const inSubmission = subprocessors.filter(
    (sub) => sub.declaredIn === "both" || sub.declaredIn === "supplier-submission",
  );
  const onlyInSubmission = subprocessors.filter(
    (sub) => sub.declaredIn === "supplier-submission",
  );
  const onlyInAppendix = subprocessors.filter((sub) => sub.declaredIn === "contract-appendix");
  const inNeither = subprocessors.filter((sub) => sub.declaredIn === "neither");

  const resilienceGaps = obligations.filter(
    (row) =>
      row.category === "resilience" &&
      (row.evidenceStatus === "not-evidenced" ||
        row.evidenceStatus === "partially-met" ||
        row.evidenceStatus === "breached"),
  );

  const appendixContract = contracts.find((row) => row.documentType === "appendix");
  const ownerName = supplier.relationshipOwnerUserId
    ? (names.get(supplier.relationshipOwnerUserId) ?? supplier.relationshipOwnerUserId)
    : null;

  const evidenceIds = Array.from(
    new Set([
      ...obligations.flatMap((row) => row.evidenceDocumentIds),
      ...contracts
        .map((row) => row.evidenceDocumentId)
        .filter((id): id is string => id !== null),
    ]),
  );

  const body = (
    <>
      <Section
        title={`Exposure constellation: ${supplier.name}`}
        note={`${nodes.length} nodes, ${edges.length} edges`}
      >
        <VisualFrame
          caption={`Rings read outward: the supplier, the services it delivers, its subprocessors and the fourth parties engaged by those subprocessors. Nodes and edges touched by the ${SHARED_EVENT_MOMENT} event are marked. Structural edges are labelled as such on hover.`}
        >
          <SupplierConstellation
            supplier={{
              id: supplier.id,
              name: supplier.name,
              criticality: supplier.criticality,
              domicile: supplier.domicile,
              isOutsourcing: supplier.isOutsourcing,
              concentrationNote: supplier.concentrationNote,
            }}
            nodes={nodes}
            edges={edges}
            obligationSummary={counts}
            eventMoment={SHARED_EVENT_MOMENT}
            heading={`${supplier.id} ${supplier.name}`}
          />
        </VisualFrame>

        <div className="table-wrap">
          <table className="table">
            <tbody>
              <tr>
                <th scope="row">Recorded criticality</th>
                <td>
                  <Chip tone={supplier.criticality === "critical" ? "red" : "amber"}>
                    {supplier.criticality}
                  </Chip>
                </td>
                <th scope="row">Regulated outsourcing</th>
                <td>
                  <Chip tone={supplier.isOutsourcing ? "amber" : "neutral"}>
                    {supplier.isOutsourcing ? "yes" : "no"}
                  </Chip>
                </td>
              </tr>
              <tr>
                <th scope="row">Contracting entities</th>
                <td>{supplier.contractingEntityIds.join(", ")}</td>
                <th scope="row">Status</th>
                <td>{supplier.status}</td>
              </tr>
              <tr>
                <th scope="row">Last assessed</th>
                <td>
                  {supplier.lastAssessmentDate
                    ? formatDateDach(supplier.lastAssessmentDate)
                    : "not recorded"}
                </td>
                <th scope="row">Next due</th>
                <td>
                  {supplier.nextAssessmentDue
                    ? formatDateDach(supplier.nextAssessmentDue)
                    : "not recorded"}
                </td>
              </tr>
              <tr>
                <th scope="row">Relationship owner</th>
                <td>{ownerName ?? "not recorded"}</td>
                <th scope="row">Annual spend</th>
                <td>
                  {supplier.annualSpend !== null
                    ? `${supplier.annualSpend.toLocaleString("de-DE")} ${supplier.spendCurrency ?? ""}`.trim()
                    : "not recorded"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {supplier.concentrationNote.length > 0 ? (
          <div className="card card-edge" data-tone="amber">
            <div className="stack stack-1">
              <span className="label" style={{ color: "var(--amber)" }}>
                Concentration, beyond this arrangement
              </span>
              <p style={{ fontSize: "var(--text-sm)" }}>{supplier.concentrationNote}</p>
            </div>
          </div>
        ) : null}
      </Section>

      {/* ---------------- Obligation register ---------------- */}
      <Section
        title="Contractual obligation register"
        note={`${counts.met} met, ${counts.partiallyMet} partially met, ${counts.notEvidenced} not evidenced, ${counts.breached} breached`}
        tone={counts.breached > 0 ? "red" : counts.notEvidenced > 0 ? "amber" : "green"}
      >
        {obligations.length === 0 ? (
          <Missing what="No contractual obligation is recorded against this supplier's contracts." />
        ) : (
          <>
            <p style={{ fontSize: "var(--text-sm)" }}>
              Each row is a clause that can be tested against the supplier, with the evidence that
              does or does not support it. An obligation with no evidence is not a breach; it is a
              position the bank cannot currently demonstrate, which is a different finding and is
              recorded as one.
            </p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Clause</th>
                    <th scope="col">Category</th>
                    <th scope="col">Obligation</th>
                    <th scope="col">Evidence status</th>
                    <th scope="col">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {obligations.map((row) => (
                    <tr key={row.id}>
                      <td className="mono">{row.clauseReference}</td>
                      <td>{row.category}</td>
                      <td>
                        <div className="stack stack-1">
                          <span>{row.obligationText}</span>
                          {row.note.length > 0 ? (
                            <span className="meta">{row.note}</span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <Chip tone={EVIDENCE_STATUS_TONE[row.evidenceStatus] ?? "neutral"}>
                          {row.evidenceStatus.replace(/-/g, " ")}
                        </Chip>
                      </td>
                      <td>
                        {row.evidenceDocumentIds.length === 0 ? (
                          <span className="muted">none cited</span>
                        ) : (
                          <div className="stack stack-1">
                            {row.evidenceDocumentIds.map((id) => (
                              <span key={id} className="mono meta">
                                {id}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Section>

      {/* ---------------- Appendix versus submission ---------------- */}
      <Section
        title="Subprocessors: the binding contract appendix against the supplier's own submission"
        note={`${onlyInSubmission.length} in the submission only, ${onlyInAppendix.length} in the appendix only, ${inNeither.length} in neither`}
        tone={onlyInSubmission.length + inNeither.length > 0 ? "red" : "green"}
      >
        <p style={{ fontSize: "var(--text-sm)" }}>
          Two lists exist and they do not agree. The binding list is{" "}
          {appendixContract ? (
            <>
              <span className="mono">{appendixContract.reference}</span> {appendixContract.title}
            </>
          ) : (
            "the contract appendix"
          )}
          . The other is the register the supplier publishes and maintains itself. The divergence is
          set out row by row rather than reconciled into a single number, because the professional
          question differs per row: one row is a notice question, one is a drafting question, and
          one is a data location question.
        </p>

        <div className="row row-6 row-wrap">
          <Stat value={inAppendix.length} label="named in the binding appendix" tone="cyan" />
          <Stat value={inSubmission.length} label="named in the supplier submission" tone="cyan" />
          <Stat
            value={onlyInSubmission.length}
            label="in the submission and not in the appendix"
            tone="red"
          />
          <Stat
            value={onlyInAppendix.length}
            label="in the appendix and not in the submission"
            tone="amber"
          />
          <Stat value={inNeither.length} label="in neither record" tone="pink" />
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Party</th>
                <th scope="col">Function provided</th>
                <th scope="col">Data location</th>
                <th scope="col">In the binding appendix</th>
                <th scope="col">In the supplier submission</th>
              </tr>
            </thead>
            <tbody>
              {subprocessors.map((sub) => {
                const appendix = sub.declaredIn === "both" || sub.declaredIn === "contract-appendix";
                const submission =
                  sub.declaredIn === "both" || sub.declaredIn === "supplier-submission";
                return (
                  <tr key={sub.id}>
                    <td>
                      <div className="stack stack-1">
                        <span className="strong-text">{sub.name}</span>
                        <span className="meta">
                          <span className="mono">{sub.id}</span> &middot; {sub.domicile}
                          {isFourthParty(sub.id) ? (
                            <>
                              {" "}
                              &middot; fourth party
                            </>
                          ) : null}
                        </span>
                      </div>
                    </td>
                    <td>{sub.functionProvided}</td>
                    <td>{sub.dataLocation}</td>
                    <td>
                      <Chip tone={appendix ? "green" : "red"}>{appendix ? "yes" : "no"}</Chip>
                    </td>
                    <td>
                      <Chip tone={submission ? "green" : "amber"}>
                        {submission ? "yes" : "no"}
                      </Chip>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="stack stack-3">
          <span className="label" style={{ color: "var(--red)" }}>
            Each divergence, characterised
          </span>
          {subprocessors.filter((sub) => sub.isDiscrepancy).length === 0 ? (
            <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
              No divergence is recorded between the two lists.
            </p>
          ) : (
            subprocessors
              .filter((sub) => sub.isDiscrepancy)
              .map((sub) => (
                <div key={sub.id} className="card card-edge" data-tone="red">
                  <div className="stack stack-2">
                    <div className="row row-2 row-wrap row-between">
                      <span className="strong-text">{sub.name}</span>
                      <div className="row row-2 row-wrap">
                        <Chip tone="red">
                          appendix: {sub.declaredIn === "supplier-submission" || sub.declaredIn === "neither" ? "absent" : "present"}
                        </Chip>
                        <Chip tone="amber">
                          submission:{" "}
                          {sub.declaredIn === "contract-appendix" || sub.declaredIn === "neither"
                            ? "absent"
                            : "present"}
                        </Chip>
                        {sub.supportsCriticalFunction ? (
                          <Chip tone="red">supports a critical function</Chip>
                        ) : null}
                      </div>
                    </div>
                    <p style={{ fontSize: "var(--text-sm)" }}>{sub.discrepancyNote}</p>
                    <span className="meta">{sub.dataLocation}</span>
                  </div>
                </div>
              ))
          )}
        </div>
      </Section>

      {/* ---------------- Resilience evidence gaps ---------------- */}
      <Section
        title="Resilience evidence gaps"
        note={`${resilienceGaps.length} of ${obligations.filter((row) => row.category === "resilience").length} resilience obligations`}
        tone={resilienceGaps.length > 0 ? "amber" : "green"}
      >
        {resilienceGaps.length === 0 ? (
          <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
            Every resilience obligation on this arrangement is evidenced.
          </p>
        ) : (
          <div className="stack stack-3">
            <p style={{ fontSize: "var(--text-sm)" }}>
              These are the obligations where the bank cannot presently demonstrate the position it
              has contracted for. Each one is a document that exists and has not been provided, a
              document that has been provided and does not cover the scope, or a commitment that is
              contradicted by the supplier's own test result.
            </p>
            {resilienceGaps.map((row) => (
              <div key={row.id} className="card card-edge" data-tone="amber">
                <div className="stack stack-2">
                  <div className="row row-2 row-wrap row-between">
                    <span className="mono strong-text" style={{ fontSize: "var(--text-sm)" }}>
                      {row.clauseReference}
                    </span>
                    <Chip tone={EVIDENCE_STATUS_TONE[row.evidenceStatus] ?? "amber"}>
                      {row.evidenceStatus.replace(/-/g, " ")}
                    </Chip>
                  </div>
                  <p style={{ fontSize: "var(--text-sm)" }}>{row.obligationText}</p>
                  {row.note.length > 0 ? (
                    <p className="dim" style={{ fontSize: "var(--text-sm)" }}>
                      {row.note}
                    </p>
                  ) : null}
                  <div className="row row-2 row-wrap">
                    {row.evidenceDocumentIds.length === 0 ? (
                      <span className="chip" data-tone="red">
                        no evidence cited
                      </span>
                    ) : (
                      row.evidenceDocumentIds.map((id) => (
                        <span key={id} className="chip" data-tone="neutral">
                          <span className="mono">{id}</span>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  );

  return {
    heading: `${supplier.id} ${supplier.name}`,
    standfirst: supplier.description,
    badges: [
      { label: `${supplier.criticality} supplier`, tone: "red" },
      { label: `${subprocessors.length} fourth parties`, tone: "cyan" },
      {
        label: `${counts.notEvidenced + counts.breached} obligations unevidenced`,
        tone: counts.notEvidenced + counts.breached > 0 ? "amber" : "green",
      },
      {
        label: `${subprocessors.filter((sub) => sub.isDiscrepancy).length} register divergences`,
        tone: "red",
      },
    ],
    body,
    evidenceIds,
    whyThisMatters: [
      `${supplier.name} is recorded as ${supplier.criticality} and the arrangement is ${supplier.isOutsourcing ? "a regulated outsourcing" : "not classified as an outsourcing"}. The criticality is a human decision and it drives everything downstream of it.`,
      `${onlyInSubmission.length + inNeither.length} party or parties appear outside the binding appendix. That is a contractual question before it is a supplier performance question.`,
      `${resilienceGaps.length} resilience obligation(s) cannot be demonstrated on the evidence held at ${moment}.`,
    ],
    uncertainty: subprocessors
      .filter((sub) => sub.isDiscrepancy)
      .map((sub) => ({
        topic: `${sub.name} is not consistently recorded`,
        description: sub.discrepancyNote,
        kind: "conflicting-evidence",
        resolutionPath:
          "Establish which appendix version governs, and whether notice was given under it. That is a contractual reading, not a data reconciliation.",
        materialToDecision: true,
        sourceIds: [sub.id],
      })),
    contextLabel: `Supplier dossier ${supplier.id} ${supplier.name} at ${moment}: ${obligations.length} obligations, ${subprocessors.length} fourth parties, ${resilienceGaps.length} resilience gaps.`,
  };
}

function Stat({ value, label, tone }: { value: number; label: string; tone: Tone }) {
  return (
    <div className="stack stack-1">
      <span
        className="mono display"
        style={{
          fontSize: "var(--text-xl)",
          fontWeight: 600,
          color: value === 0 ? "var(--text-4)" : `var(--${tone === "neutral" ? "text-2" : tone})`,
        }}
      >
        {value}
      </span>
      <span className="meta">{label}</span>
    </div>
  );
}

/* ==========================================================================
   2. Operational Risk Partner: the process, risk and control graph
   ========================================================================== */

function buildRiskControlWorkbench(names: Map<string, string>, language: Language): Workbench {
  const process = getProcess(RCSA_PROCESS_ID) ?? null;
  const processId = process?.id ?? null;
  const graph = processId ? getRiskControlGraph({ processId }) : getRiskControlGraph();
  const comparison = processId ? compareAssessments(processId) : null;

  const allTests = getControlTests();
  const testByControl = new Map<string, string>();
  for (const test of allTests) {
    const existing = testByControl.get(test.controlId);
    if (!existing) testByControl.set(test.controlId, test.reference);
  }

  const riskIds = new Set(graph.risks.map((risk) => risk.id));

  /* ---- Current and previous lines, keyed by risk ---- */
  const currentLineByRisk = new Map(
    (comparison?.currentLines ?? []).map((line) => [line.riskId, line]),
  );
  const previousLineByRisk = new Map(
    (comparison?.previousLines ?? []).map((line) => [line.riskId, line]),
  );

  const processes: ProcessNodeView[] = graph.processes.map((row) => ({
    id: row.id,
    label: row.name,
    code: row.code,
    ...(row.recentChangeNote.length > 0 ? { detail: row.recentChangeNote } : {}),
    riskIds: graph.risks.filter((risk) => risk.processIds.includes(row.id)).map((risk) => risk.id),
  }));

  const risks: RiskNodeView[] = graph.risks.map((row) => {
    const line = currentLineByRisk.get(row.id);
    const inherentScore = row.inherentLikelihood * row.inherentImpact;
    const residualScore = line ? line.residualLikelihood * line.residualImpact : undefined;
    const position =
      row.appetitePosition === "within" ||
      row.appetitePosition === "at-limit" ||
      row.appetitePosition === "outside"
        ? row.appetitePosition
        : undefined;
    return {
      id: row.id,
      label: language === "de" ? row.titleDe : row.title,
      ownerLabel: names.get(row.ownerUserId) ?? row.ownerUserId,
      inherentScore,
      ...(row.appetiteStatement.length > 0 ? { appetiteStatement: row.appetiteStatement } : {}),
      ...(position ? { appetitePosition: position } : {}),
      ...(residualScore !== undefined ? { residualScore } : {}),
      ...(line && line.commentary.length > 0 ? { materialisationNote: line.commentary } : {}),
    };
  });

  const controls: ControlNodeView[] = graph.controls.map((row) => ({
    id: row.id,
    reference: row.reference,
    title: language === "de" ? row.titleDe : row.title,
    riskIds: row.riskIds.filter((id) => riskIds.has(id)),
    ownerLabel: names.get(row.ownerUserId) ?? row.ownerUserId,
    isKeyControl: row.isKeyControl,
    nature: row.nature,
    automation: row.automation,
    currentEffectiveness: row.currentEffectiveness,
    firstLineEffectiveness: row.firstLineEffectiveness,
    firstLineOwnerLabel: names.get(row.ownerUserId) ?? row.ownerUserId,
    secondLineOwnerLabel: setterLabel(row.effectivenessSetBy, names),
    ...(row.lastTestedOn ? { lastTestedOn: row.lastTestedOn } : {}),
    ...(() => {
      const reference = testByControl.get(row.id);
      return reference ? { evidenceRef: reference } : {};
    })(),
  }));

  const indicators: IndicatorNodeView[] = graph.kris.map((row) => ({
    id: row.id,
    reference: row.reference,
    name: language === "de" ? row.nameDe : row.name,
    riskIds: row.riskIds.filter((id) => riskIds.has(id)),
    status: row.currentStatus,
    currentValue: row.currentValue,
    unit: row.unit,
    amberThreshold: row.amberThreshold,
    redThreshold: row.redThreshold,
  }));

  /* ---- What changed ---- */
  interface ChangeRow {
    riskId: string;
    riskTitle: string;
    changed: boolean;
    note: string;
    currentResidual: string;
    previousResidual: string | null;
    currentEffectiveness: string;
    previousEffectiveness: string | null;
    currentAppetite: string;
    previousAppetite: string | null;
  }

  const changeRows: ChangeRow[] = (comparison?.currentLines ?? []).map((line) => {
    const previous = previousLineByRisk.get(line.riskId);
    const risk = graph.risks.find((row) => row.id === line.riskId);
    const currentResidual = `${line.residualRating} (${line.residualLikelihood} x ${line.residualImpact})`;
    const previousResidual = previous
      ? `${previous.residualRating} (${previous.residualLikelihood} x ${previous.residualImpact})`
      : null;
    const changed =
      previous === undefined ||
      previous.residualRating !== line.residualRating ||
      previous.controlEffectiveness !== line.controlEffectiveness ||
      previous.appetitePosition !== line.appetitePosition ||
      previous.residualLikelihood !== line.residualLikelihood ||
      previous.residualImpact !== line.residualImpact;
    return {
      riskId: line.riskId,
      riskTitle: risk ? risk.title : line.riskId,
      changed,
      note:
        line.changeFromPrevious.length > 0
          ? line.changeFromPrevious
          : previous === undefined
            ? "New line. This risk was not in the previous version."
            : changed
              ? "The values differ from the previous version and no change narrative was recorded, which is itself worth asking about."
              : "No change from the previous version.",
      currentResidual,
      previousResidual,
      currentEffectiveness: line.controlEffectiveness,
      previousEffectiveness: previous ? previous.controlEffectiveness : null,
      currentAppetite: line.appetitePosition,
      previousAppetite: previous ? previous.appetitePosition : null,
    };
  });

  const changed = changeRows.filter((row) => row.changed);
  const unchanged = changeRows.filter((row) => !row.changed);

  /*
   * The line divergence, which is the reason this screen exists.
   *
   * Eighteen of twenty-three controls in scope carry two positions, so a flat
   * list of eighteen identical cards would bury the one that matters. They are
   * ranked by how far apart the two positions are and then by whether the
   * control is designated key, and only the widest divergences are opened as
   * full cards. Nothing is dropped: the remainder is one click away in a table.
   */
  const divergent = graph.controls
    .filter((row) => row.firstLineEffectiveness !== row.currentEffectiveness)
    .sort((a, b) => {
      const byBands =
        bandsApart(b.firstLineEffectiveness, b.currentEffectiveness) -
        bandsApart(a.firstLineEffectiveness, a.currentEffectiveness);
      if (byBands !== 0) return byBands;
      return Number(b.isKeyControl) - Number(a.isKeyControl);
    });
  const widestBands = divergent.reduce(
    (widest, row) => Math.max(widest, bandsApart(row.firstLineEffectiveness, row.currentEffectiveness)),
    0,
  );
  const widest = divergent.filter(
    (row) => bandsApart(row.firstLineEffectiveness, row.currentEffectiveness) === widestBands,
  );
  const narrower = divergent.filter(
    (row) => bandsApart(row.firstLineEffectiveness, row.currentEffectiveness) !== widestBands,
  );

  const evidenceIds: string[] = [];

  const body = (
    <>
      <Section
        title={
          process
            ? `Process, risk and control graph: ${process.code} ${process.name}`
            : "Process, risk and control graph"
        }
        note={`${graph.processes.length} processes, ${graph.risks.length} risks, ${graph.controls.length} controls, ${graph.kris.length} indicators`}
      >
        {graph.risks.length === 0 ? (
          <Missing what="No risk is in scope for this process, so there is no graph to render." />
        ) : (
          <VisualFrame
            caption="Processes expose risks, controls mitigate them, indicators report on them. Each control node carries two effectiveness values where the first line and the second line have recorded different positions, because averaging them would be the one thing a second line function must never do."
          >
            <RiskControlGraph
              processes={processes}
              risks={risks}
              controls={controls}
              indicators={indicators}
              heading={process ? `${process.code} ${process.name}` : "Risk and control graph"}
            />
          </VisualFrame>
        )}
        {process ? (
          <div className="table-wrap">
            <table className="table">
              <tbody>
                <tr>
                  <th scope="row">Process owner</th>
                  <td>{names.get(process.ownerUserId) ?? process.ownerUserId}</td>
                  <th scope="row">Monthly volume</th>
                  <td className="num">
                    {process.monthlyVolume !== null
                      ? process.monthlyVolume.toLocaleString("de-DE")
                      : "not recorded"}
                  </td>
                </tr>
                <tr>
                  <th scope="row">Manual touch rate</th>
                  <td className="num">
                    {process.manualTouchRate !== null
                      ? `${(process.manualTouchRate * 100).toFixed(1)} percent`
                      : "not recorded"}
                  </td>
                  <th scope="row">Entities</th>
                  <td>{process.entityIds.join(", ")}</td>
                </tr>
                {process.recentChangeNote.length > 0 ? (
                  <tr>
                    <th scope="row">What changed in the process</th>
                    <td colSpan={3}>{process.recentChangeNote}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </Section>

      {/* ---------------- The line divergence, up front ---------------- */}
      <Section
        title="Where the first line and the second line do not agree"
        note={`${divergent.length} of ${graph.controls.length} controls`}
        tone={divergent.length > 0 ? "red" : "green"}
      >
        {divergent.length === 0 ? (
          <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
            Every control in scope carries the same effectiveness in the first line's assessment and
            in the recorded position.
          </p>
        ) : (
          <>
            <p style={{ fontSize: "var(--text-sm)" }}>
              {divergent.length} of {graph.controls.length} controls in scope carry two different
              effectiveness values: the owner's own assessment and the recorded position. Nothing
              here is reconciled and no average is taken. The divergence is the professional subject
              matter, and it resolves differently depending on which kind it is. A difference about
              the facts is closed by evidence, a difference about the standard is closed by the
              methodology, and a difference about scope is closed by reading the control statement.
            </p>
            <div className="row row-6 row-wrap">
              <Stat value={divergent.length} label="controls with two positions" tone="red" />
              <Stat
                value={widest.length}
                label={`at the widest gap, ${widestBands} band${widestBands === 1 ? "" : "s"} apart`}
                tone="red"
              />
              <Stat
                value={divergent.filter((row) => row.isKeyControl).length}
                label="of them designated key controls"
                tone="amber"
              />
              <Stat
                value={graph.controls.length - divergent.length}
                label="controls where the two lines agree"
                tone="green"
              />
            </div>

            <span className="label" style={{ color: "var(--red)" }}>
              The widest divergences ({widest.length}), {widestBands} band
              {widestBands === 1 ? "" : "s"} apart
            </span>
            <div className="stack stack-3">
              {widest.map((row) => (
                <div key={row.id} className="card card-edge" data-tone="red">
                  <div className="stack stack-3">
                    <div className="row row-2 row-wrap row-between">
                      <span className="strong-text">
                        <span className="mono">{row.reference}</span>{" "}
                        {language === "de" ? row.titleDe : row.title}
                      </span>
                      <div className="row row-2 row-wrap">
                        {row.isKeyControl ? <Chip tone="amber">key control</Chip> : null}
                        <Chip tone="neutral">{row.nature}</Chip>
                        <Chip tone="neutral">{row.automation}</Chip>
                      </div>
                    </div>

                    <div className="grid grid-2">
                      <LinePosition
                        lineLabel="First line, the control owner"
                        owner={names.get(row.ownerUserId) ?? row.ownerUserId}
                        effectiveness={row.firstLineEffectiveness}
                      />
                      <LinePosition
                        lineLabel="Recorded position, owned by the second line"
                        owner={setterLabel(row.effectivenessSetBy, names)}
                        effectiveness={row.currentEffectiveness}
                      />
                    </div>

                    {row.designNote.length > 0 ? (
                      <div className="stack stack-1">
                        <span className="label">Design note</span>
                        <p style={{ fontSize: "var(--text-sm)" }}>{row.designNote}</p>
                      </div>
                    ) : null}

                    <div className="row row-3 row-wrap">
                      {row.lastTestedOn ? (
                        <span className="meta">
                          last tested {formatDateDach(row.lastTestedOn)}
                        </span>
                      ) : (
                        <span className="meta" style={{ color: "var(--amber)" }}>
                          never tested
                        </span>
                      )}
                      {testByControl.get(row.id) ? (
                        <span className="chip" data-tone="cyan">
                          test <span className="mono">{testByControl.get(row.id)}</span>
                        </span>
                      ) : null}
                      <ObjectId id={row.id} label="control" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {narrower.length > 0 ? (
              <details>
                <summary style={{ cursor: "pointer" }}>
                  <span className="label">
                    The remaining divergences ({narrower.length}), a narrower gap
                  </span>
                </summary>
                <div className="table-wrap" style={{ marginTop: "var(--space-3)" }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">Control</th>
                        <th scope="col">Key</th>
                        <th scope="col">First line, the owner</th>
                        <th scope="col">Recorded position</th>
                        <th scope="col" className="num">
                          Bands apart
                        </th>
                        <th scope="col">Last tested</th>
                      </tr>
                    </thead>
                    <tbody>
                      {narrower.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <div className="stack stack-1">
                              <span className="mono strong-text">{row.reference}</span>
                              <span className="meta">{row.title}</span>
                            </div>
                          </td>
                          <td>
                            {row.isKeyControl ? (
                              <Chip tone="amber">key</Chip>
                            ) : (
                              <span className="muted">no</span>
                            )}
                          </td>
                          <td>
                            <Chip tone={EFFECTIVENESS_TONE[row.firstLineEffectiveness] ?? "neutral"}>
                              {effectivenessLabel(row.firstLineEffectiveness)}
                            </Chip>
                          </td>
                          <td>
                            <Chip tone={EFFECTIVENESS_TONE[row.currentEffectiveness] ?? "neutral"}>
                              {effectivenessLabel(row.currentEffectiveness)}
                            </Chip>
                          </td>
                          <td className="num">
                            {bandsApart(row.firstLineEffectiveness, row.currentEffectiveness)}
                          </td>
                          <td>
                            {row.lastTestedOn ? (
                              formatDateDach(row.lastTestedOn)
                            ) : (
                              <span style={{ color: "var(--amber)" }}>never</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ) : null}
          </>
        )}
      </Section>

      {/* ---------------- What changed ---------------- */}
      <Section
        title="Current against previous: what changed"
        note={
          comparison
            ? `${comparison.current.reference} version ${comparison.current.version}${comparison.previous ? ` against version ${comparison.previous.version}` : ", no previous version"}`
            : "no assessment"
        }
        tone={changed.length > 0 ? "amber" : "green"}
      >
        {!comparison ? (
          <Missing what="No assessment version exists for this process, so there is nothing to compare." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  <tr>
                    <th scope="row">Current version</th>
                    <td>
                      <span className="mono">{comparison.current.reference}</span> v
                      {comparison.current.version}, {comparison.current.status},{" "}
                      {comparison.current.cycle}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Performed by</th>
                    <td>
                      {names.get(comparison.current.performedByUserId) ??
                        comparison.current.performedByUserId}{" "}
                      on {formatDateDach(comparison.current.performedOn)}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Previous version</th>
                    <td>
                      {comparison.previous ? (
                        <>
                          <span className="mono">{comparison.previous.reference}</span> v
                          {comparison.previous.version}, {comparison.previous.status},{" "}
                          {comparison.previous.cycle}
                        </>
                      ) : (
                        <span className="muted">none</span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Conclusion offered</th>
                    <td>{comparison.current.overallConclusion}</td>
                  </tr>
                  {comparison.current.rationale.length > 0 ? (
                    <tr>
                      <th scope="row">Rationale recorded</th>
                      <td>{comparison.current.rationale}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="stack stack-3">
              <span className="label" style={{ color: "var(--amber)" }}>
                Lines that changed ({changed.length})
              </span>
              {changed.length === 0 ? (
                <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
                  Nothing changed between the two versions. A reassessment that changes nothing is a
                  finding of its own kind when the process underneath it has changed.
                </p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">Risk</th>
                        <th scope="col">Residual, previous</th>
                        <th scope="col">Residual, current</th>
                        <th scope="col">Control effectiveness</th>
                        <th scope="col">Appetite</th>
                        <th scope="col">What changed and why</th>
                      </tr>
                    </thead>
                    <tbody>
                      {changed.map((row) => (
                        <tr key={row.riskId}>
                          <td>
                            <div className="stack stack-1">
                              <span className="strong-text">{row.riskTitle}</span>
                              <ObjectId id={row.riskId} />
                            </div>
                          </td>
                          <td>{row.previousResidual ?? <span className="muted">none</span>}</td>
                          <td className="strong-text">{row.currentResidual}</td>
                          <td>
                            <div className="stack stack-1">
                              {row.previousEffectiveness &&
                              row.previousEffectiveness !== row.currentEffectiveness ? (
                                <span className="meta">
                                  was {effectivenessLabel(row.previousEffectiveness)}
                                </span>
                              ) : null}
                              <Chip tone={EFFECTIVENESS_TONE[row.currentEffectiveness] ?? "neutral"}>
                                {effectivenessLabel(row.currentEffectiveness)}
                              </Chip>
                            </div>
                          </td>
                          <td>
                            <div className="stack stack-1">
                              {row.previousAppetite && row.previousAppetite !== row.currentAppetite ? (
                                <span className="meta">was {row.previousAppetite}</span>
                              ) : null}
                              <Chip
                                tone={
                                  row.currentAppetite === "outside"
                                    ? "red"
                                    : row.currentAppetite === "at-limit"
                                      ? "amber"
                                      : "green"
                                }
                              >
                                {row.currentAppetite.replace(/-/g, " ")}
                              </Chip>
                            </div>
                          </td>
                          <td>{row.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {unchanged.length > 0 ? (
              <details>
                <summary style={{ cursor: "pointer" }}>
                  <span className="label">Lines that did not change ({unchanged.length})</span>
                </summary>
                <div className="table-wrap" style={{ marginTop: "var(--space-3)" }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">Risk</th>
                        <th scope="col">Residual</th>
                        <th scope="col">Control effectiveness</th>
                        <th scope="col">Appetite</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unchanged.map((row) => (
                        <tr key={row.riskId}>
                          <td>{row.riskTitle}</td>
                          <td>{row.currentResidual}</td>
                          <td>{effectivenessLabel(row.currentEffectiveness)}</td>
                          <td>{row.currentAppetite.replace(/-/g, " ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ) : null}
          </>
        )}
      </Section>

      {/* ---------------- Indicators in scope ---------------- */}
      <Section
        title="Indicators on these risks"
        note={`${graph.kris.filter((row) => row.currentStatus !== "green").length} outside green`}
        tone={graph.kris.some((row) => row.currentStatus === "red") ? "red" : "amber"}
      >
        {graph.kris.length === 0 ? (
          <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
            No indicator reports on the risks in scope.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Indicator</th>
                  <th scope="col" className="num">
                    Current
                  </th>
                  <th scope="col" className="num">
                    Amber
                  </th>
                  <th scope="col" className="num">
                    Red
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col">Owner</th>
                </tr>
              </thead>
              <tbody>
                {graph.kris.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="stack stack-1">
                        <span className="mono strong-text">{row.reference}</span>
                        <span className="meta">{row.name}</span>
                      </div>
                    </td>
                    <td className="num">
                      {row.currentValue} {row.unit}
                    </td>
                    <td className="num">{row.amberThreshold}</td>
                    <td className="num">{row.redThreshold}</td>
                    <td>
                      <Chip
                        tone={
                          row.currentStatus === "red"
                            ? "red"
                            : row.currentStatus === "amber"
                              ? "amber"
                              : "green"
                        }
                      >
                        {row.currentStatus}
                      </Chip>
                    </td>
                    <td>{names.get(row.ownerUserId) ?? row.ownerUserId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );

  return {
    heading: process ? `${process.code} ${process.name}` : "Risk and control workbench",
    standfirst: process
      ? process.description
      : "The process, risk and control graph for the risks this role challenges.",
    badges: [
      { label: `${graph.risks.length} risks`, tone: "cyan" },
      { label: `${graph.controls.length} controls`, tone: "cyan" },
      {
        label: `${divergent.length} of ${graph.controls.length} controls diverge`,
        tone: divergent.length > 0 ? "red" : "green",
      },
      { label: `${changed.length} lines changed`, tone: changed.length > 0 ? "amber" : "green" },
    ],
    body,
    evidenceIds,
    whyThisMatters: [
      `${divergent.length} of ${graph.controls.length} control(s) carry two different effectiveness positions, ${widest.length} of them ${widestBands} band(s) apart. A second line function that publishes a single number here has destroyed the information the two positions contained.`,
      `${changed.length} assessment line(s) changed since the previous version. The comparison leads with what changed rather than with the current state, because the current state without the delta does not tell a challenger where to look.`,
      `${graph.risks.filter((row) => row.appetitePosition === "outside").length} risk(s) are recorded outside appetite.`,
    ],
    uncertainty: widest.map((row) => ({
      topic: `${row.reference} carries two effectiveness positions`,
      description: `The control owner records ${effectivenessLabel(row.firstLineEffectiveness)}. The recorded position is ${effectivenessLabel(row.currentEffectiveness)}. Both are on the record and they have not been reconciled.`,
      kind: "conflicting-evidence",
      resolutionPath:
        "Establish whether the two lines disagree about the facts, the standard or the scope. Only the first of those three is resolved by more evidence.",
      materialToDecision: true,
      sourceIds: [row.id],
    })),
    contextLabel: `Risk and control graph for ${process ? `${process.code} ${process.name}` : "the risks in scope"}: ${graph.risks.length} risks, ${divergent.length} control divergences, ${changed.length} changed assessment lines.`,
  };
}

function LinePosition({
  lineLabel,
  owner,
  effectiveness,
}: {
  lineLabel: string;
  owner: string;
  effectiveness: string;
}) {
  return (
    <div
      className="stack stack-2"
      style={{
        padding: "var(--space-3)",
        background: "var(--surface-0)",
        border: "1px solid var(--border-1)",
        borderRadius: "var(--radius-md)",
      }}
    >
      <span className="label">{lineLabel}</span>
      <Chip tone={EFFECTIVENESS_TONE[effectiveness] ?? "neutral"}>
        {effectivenessLabel(effectiveness)}
      </Chip>
      <span className="meta">recorded by {owner}</span>
    </div>
  );
}

/* ==========================================================================
   3. Control Assurance Specialist: the full population field
   ========================================================================== */

function buildPopulationWorkbench(names: Map<string, string>, language: Language): Workbench {
  const test =
    getControlTest(ASSURANCE_TEST_ID) ??
    getControlTests().find((row) => row.status === "disputed") ??
    getControlTests()[0] ??
    null;

  if (!test) {
    return {
      heading: "Population field",
      standfirst: "No control test is available in this run.",
      badges: [],
      body: <Missing what="No control test row could be resolved." />,
      evidenceIds: [],
      whyThisMatters: [],
      uncertainty: [],
      contextLabel: "Population field, no control test resolved.",
    };
  }

  const summary = getPopulationSummary(test.id);
  const control = getControl(test.controlId);

  /*
   * "Unable to conclude" is not a third outcome in the schema. It is an
   * in-sample anomaly whose anomaly kind says the attribute could not be
   * tested because the underlying evidence no longer exists. Those items must
   * never be counted with the exceptions, because an exception is a finding
   * about the control and an unable to conclude item is a finding about the
   * record.
   */
  const unableToConclude = summary.cases.filter(
    (row) => row.inSample && (row.anomalyKind ?? "").startsWith("unable-to-conclude"),
  );
  const unableIds = new Set(unableToConclude.map((row) => row.id));
  const exceptions = summary.exceptionCases;
  const otherAnomalies = summary.anomalyCases.filter((row) => !unableIds.has(row.id));

  /* Tolerable deviation rate, read out of the recorded sampling method. */
  const tolerableMatch = /tolerable deviation rate\s*([\d.]+)\s*%/i.exec(test.samplingMethod);
  const tolerableRate = tolerableMatch?.[1] ? Number(tolerableMatch[1]) / 100 : undefined;

  const cases: PopulationCase[] = summary.cases.map((row) => ({
    id: row.id,
    transactionRef: row.transactionRef,
    occurredAt: row.occurredAt,
    repairReason: row.repairReason,
    repairedByLabel: names.get(row.repairedByUserId) ?? row.repairedByUserId,
    reviewerLabel: row.reviewerUserId ? (names.get(row.reviewerUserId) ?? row.reviewerUserId) : null,
    secondaryReviewEvidenced: row.secondaryReviewEvidenced,
    inSample: row.inSample,
    outcome: row.outcome,
    anomalyKind: row.anomalyKind,
    exceptionClassification: row.exceptionClassification,
    exceptionScope: row.exceptionScope,
    fromFallbackRoute: row.fromFallbackRoute,
    amountLabel: formatAmount(row.amountMinor, row.currency),
    ...(row.note.length > 0 ? { note: row.note } : {}),
  }));

  const exceptionRate = summary.sampled > 0 ? exceptions.length / summary.sampled : 0;
  const combinedRate =
    summary.sampled > 0 ? (exceptions.length + unableToConclude.length) / summary.sampled : 0;

  const evidenceIds = Array.from(
    new Set([
      ...exceptions.flatMap((row) => row.evidenceDocumentIds),
      ...unableToConclude.flatMap((row) => row.evidenceDocumentIds),
    ]),
  );

  const body = (
    <>
      <Section
        title={`Population field: ${test.reference}`}
        note={`${summary.total} rows held of a recorded population of ${test.populationSize.toLocaleString("de-DE")}`}
      >
        <VisualFrame
          caption={`Every row held is on screen, not just the sample. An item that was not drawn is still inspectable, which is the only way to see whether the sample found the thing the population contains. The field draws ${summary.total} rows; the recorded population for the period is ${test.populationSize.toLocaleString("de-DE")} items, and the difference is set out below the field.`}
        >
          <PopulationField
            test={{
              reference: test.reference,
              title: test.title,
              populationSize: test.populationSize,
              sampleSize: test.sampleSize,
              samplingMethod: test.samplingMethod,
              samplingRationale: test.samplingRationale,
              periodFrom: test.periodFrom,
              periodTo: test.periodTo,
              ...(tolerableRate !== undefined ? { tolerableDeviationRate: tolerableRate } : {}),
            }}
            cases={cases}
            heading={`${test.reference} ${test.title}`}
          />
        </VisualFrame>

        <div className="row row-6 row-wrap">
          <Stat value={test.populationSize} label="items in the recorded population" tone="cyan" />
          <Stat value={summary.total} label="of them held as inspectable rows" tone="cyan" />
          <Stat value={summary.sampled} label="drawn into the sample" tone="cyan" />
          <Stat value={exceptions.length} label="exceptions" tone="red" />
          <Stat value={unableToConclude.length} label="unable to conclude" tone="pink" />
          <Stat value={otherAnomalies.length} label="other anomalies, not sampled" tone="amber" />
          <Stat
            value={summary.missingReviewEvidence}
            label="items with no secondary review evidenced"
            tone="amber"
          />
        </div>

        <div className="card card-edge" data-tone="cyan">
          <div className="stack stack-2">
            <span className="label">What is on screen, and what is not</span>
            <p style={{ fontSize: "var(--text-sm)" }}>
              The recorded population for {formatDateDach(test.periodFrom)} to{" "}
              {formatDateDach(test.periodTo)} is {test.populationSize.toLocaleString("de-DE")} items.
              This prototype holds {summary.total} of them as individually inspectable rows:{" "}
              {summary.sampled} sampled items, which is the whole sample of {test.sampleSize}, and{" "}
              {summary.total - summary.sampled} items that were not drawn. The unsampled rows were
              chosen so that every recorded anomaly in the period is present rather than at random,
              so the unsampled part of the field is deliberately denser in anomalies than the real
              population is. Every deviation rate on this page is computed over the{" "}
              {summary.sampled} sampled items and never over the {summary.total} rows held, because
              only the sample was tested.
            </p>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <tbody>
              <tr>
                <th scope="row">Control under test</th>
                <td>
                  {control ? (
                    <>
                      <span className="mono">{control.reference}</span>{" "}
                      {language === "de" ? control.titleDe : control.title}
                    </>
                  ) : (
                    <span className="mono">{test.controlId}</span>
                  )}
                </td>
                <th scope="row">Test type</th>
                <td>{test.testType}</td>
              </tr>
              <tr>
                <th scope="row">Period</th>
                <td>
                  {formatDateDach(test.periodFrom)} to {formatDateDach(test.periodTo)}
                </td>
                <th scope="row">Tester</th>
                <td>{names.get(test.testerUserId) ?? test.testerUserId}</td>
              </tr>
              <tr>
                <th scope="row">Deviation rate, exceptions only</th>
                <td className="num">
                  {exceptions.length} of {summary.sampled}, {(exceptionRate * 100).toFixed(2)}{" "}
                  percent
                </td>
                <th scope="row">Treating unable to conclude as deviations</th>
                <td className="num">
                  {exceptions.length + unableToConclude.length} of {summary.sampled},{" "}
                  {(combinedRate * 100).toFixed(2)} percent
                </td>
              </tr>
              {tolerableRate !== undefined ? (
                <tr>
                  <th scope="row">Tolerable deviation rate</th>
                  <td className="num">{(tolerableRate * 100).toFixed(2)} percent</td>
                  <th scope="row">Status</th>
                  <td>
                    <Chip tone={test.status === "disputed" ? "red" : "amber"}>{test.status}</Chip>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ---------------- Why was this case selected ---------------- */}
      <Section title="Why was this case selected" note={test.samplingMethod}>
        <div className="stack stack-2">
          <span className="label">The sampling method, as recorded</span>
          <p style={{ fontSize: "var(--text-sm)" }}>{test.samplingMethod}</p>
        </div>
        <div className="stack stack-2">
          <span className="label">The rationale behind it</span>
          <p style={{ fontSize: "var(--text-sm)", whiteSpace: "pre-wrap" }}>
            {test.samplingRationale}
          </p>
        </div>
        <div className="stack stack-2">
          <span className="label">The procedure applied to each item</span>
          <p style={{ fontSize: "var(--text-sm)", whiteSpace: "pre-wrap" }}>
            {test.testProcedure}
          </p>
        </div>

        <div className="grid grid-2">
          <div className="stack stack-2">
            <span className="label">Rows held, by repair reason</span>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Reason</th>
                    <th scope="col" className="num">
                      Items
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byRepairReason.map((entry) => (
                    <tr key={entry.reason}>
                      <td>{entry.reason}</td>
                      <td className="num">{entry.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="stack stack-2">
            <span className="label">Rows held, by reviewer</span>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Reviewer</th>
                    <th scope="col" className="num">
                      Items
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byReviewer.map((entry) => (
                    <tr key={entry.userId}>
                      <td>{names.get(entry.userId) ?? entry.userId}</td>
                      <td className="num">{entry.count}</td>
                    </tr>
                  ))}
                  {summary.byReviewer.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="muted">
                        No reviewer identity is recorded anywhere in the population.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Section>

      {/* ---------------- The exceptions ---------------- */}
      <Section
        title={`Exceptions (${exceptions.length})`}
        note="A finding about the control"
        tone="red"
      >
        {exceptions.length === 0 ? (
          <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
            No sampled item deviated from the control as stated.
          </p>
        ) : (
          exceptions.map((row) => (
            <div key={row.id} className="card card-edge" data-tone="red">
              <div className="stack stack-2">
                <div className="row row-2 row-wrap row-between">
                  <span className="mono strong-text">{row.transactionRef}</span>
                  <div className="row row-2 row-wrap">
                    <Chip tone="red">exception</Chip>
                    {row.anomalyKind ? (
                      <Chip tone="red">{row.anomalyKind.replace(/-/g, " ")}</Chip>
                    ) : null}
                    {row.fromFallbackRoute ? <Chip tone="amber">fallback route</Chip> : null}
                    <span className="mono meta">
                      {formatAmount(row.amountMinor, row.currency)}
                    </span>
                  </div>
                </div>
                <div className="row row-3 row-wrap meta">
                  <span>{row.occurredAt}</span>
                  <span>{row.entityId}</span>
                  <span>{row.repairReason}</span>
                  <span>
                    repaired by {names.get(row.repairedByUserId) ?? row.repairedByUserId}
                  </span>
                  <span>
                    {row.reviewerUserId
                      ? `reviewed by ${names.get(row.reviewerUserId) ?? row.reviewerUserId}`
                      : "no reviewer recorded"}
                  </span>
                </div>
                {row.note.length > 0 ? (
                  <p style={{ fontSize: "var(--text-sm)" }}>{row.note}</p>
                ) : null}
                <div className="row row-3 row-wrap">
                  <Chip tone={row.exceptionClassification ? "cyan" : "amber"}>
                    {row.exceptionClassification
                      ? `classified: ${row.exceptionClassification}`
                      : "not yet classified by a person"}
                  </Chip>
                  <Chip tone={row.exceptionScope ? "cyan" : "amber"}>
                    {row.exceptionScope
                      ? `scope: ${row.exceptionScope}`
                      : "isolated or systemic: not yet decided"}
                  </Chip>
                  {row.rootCause ? <span className="meta">root cause: {row.rootCause}</span> : null}
                </div>
                {row.evidenceDocumentIds.length > 0 ? (
                  <div className="row row-2 row-wrap">
                    {row.evidenceDocumentIds.map((id) => (
                      <span key={id} className="chip" data-tone="neutral">
                        <span className="mono">{id}</span>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
      </Section>

      {/* ---------------- Unable to conclude, kept apart ---------------- */}
      <section
        className="panel"
        aria-label="Unable to conclude"
        style={{
          borderColor: "var(--pink)",
          borderWidth: 2,
        }}
      >
        <div className="panel-head">
          <span className="panel-title" style={{ color: "var(--pink)" }}>
            Unable to conclude ({unableToConclude.length}). Not exceptions.
          </span>
          <Chip tone="pink">a finding about the record</Chip>
        </div>
        <div className="panel-body stack stack-4">
          <p style={{ fontSize: "var(--text-sm)" }}>
            These items are counted separately from the {exceptions.length} exceptions and must stay
            separate. An exception says the control did not operate. An unable to conclude item says
            the evidence needed to test an attribute no longer exists, so the item can be neither
            passed nor failed. Forcing one into the other would be the single most misleading thing
            this page could do: reporting them as passes understates the deviation rate, and
            reporting them as deviations asserts a control failure that has not been demonstrated.
          </p>
          {unableToConclude.length === 0 ? (
            <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
              Every sampled item could be concluded on.
            </p>
          ) : (
            unableToConclude.map((row) => (
              <div key={row.id} className="card card-edge" data-tone="pink">
                <div className="stack stack-2">
                  <div className="row row-2 row-wrap row-between">
                    <span className="mono strong-text">{row.transactionRef}</span>
                    <div className="row row-2 row-wrap">
                      <Chip tone="pink">unable to conclude</Chip>
                      {row.anomalyKind ? (
                        <Chip tone="pink">{row.anomalyKind.replace(/-/g, " ")}</Chip>
                      ) : null}
                      <span className="mono meta">
                        {formatAmount(row.amountMinor, row.currency)}
                      </span>
                    </div>
                  </div>
                  <div className="row row-3 row-wrap meta">
                    <span>{row.occurredAt}</span>
                    <span>{row.entityId}</span>
                    <span>{row.repairReason}</span>
                    <span>
                      {row.reviewerUserId
                        ? `reviewer identifier ${row.reviewerUserId}`
                        : "no reviewer recorded"}
                    </span>
                  </div>
                  {row.note.length > 0 ? (
                    <p style={{ fontSize: "var(--text-sm)" }}>{row.note}</p>
                  ) : null}
                  <div className="row row-2 row-wrap">
                    <Chip tone="neutral">
                      secondary review evidenced:{" "}
                      {row.secondaryReviewEvidenced ? "yes" : "no"}
                    </Chip>
                    {row.reviewEvidenceRef ? (
                      <span className="chip" data-tone="neutral">
                        evidence reference <span className="mono">{row.reviewEvidenceRef}</span>
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
          <div className="row row-6 row-wrap">
            <Stat value={exceptions.length} label="exceptions" tone="red" />
            <Stat value={unableToConclude.length} label="unable to conclude" tone="pink" />
            <Stat
              value={summary.sampled - exceptions.length - unableToConclude.length}
              label="no deviation"
              tone="green"
            />
          </div>
        </div>
      </section>

      {/* ---------------- Anomalies not drawn into the sample ---------------- */}
      {otherAnomalies.length > 0 ? (
        <Section
          title={`Anomalies in the population that were not sampled (${otherAnomalies.length})`}
          note="Visible because unsampled rows are held, not only the sample"
          tone="amber"
        >
          <p style={{ fontSize: "var(--text-sm)" }}>
            None of these items was drawn, so none of them is a tested deviation and no deviation
            rate includes them. They are shown because they are the argument for or against
            extending the population, and because a sample that misses a pattern the population
            contains is the risk this screen exists to make visible.
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Transaction</th>
                  <th scope="col">Date</th>
                  <th scope="col">What is unusual</th>
                  <th scope="col" className="num">
                    Amount
                  </th>
                  <th scope="col">Reviewer</th>
                </tr>
              </thead>
              <tbody>
                {otherAnomalies.map((row) => (
                  <tr key={row.id}>
                    <td className="mono">{row.transactionRef}</td>
                    <td>{row.occurredAt}</td>
                    <td>
                      <div className="stack stack-1">
                        <Chip tone="amber">
                          {(row.anomalyKind ?? "anomaly").replace(/-/g, " ")}
                        </Chip>
                        {row.note.length > 0 ? (
                          <span className="meta">{row.note}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="num">{formatAmount(row.amountMinor, row.currency)}</td>
                    <td>
                      {row.reviewerUserId
                        ? (names.get(row.reviewerUserId) ?? row.reviewerUserId)
                        : "none recorded"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}

      {/* ---------------- Conclusions and the disputed response ---------------- */}
      <Section
        title="The conclusion, and the response that disputes it"
        note={test.status}
        tone={test.status === "disputed" ? "red" : "amber"}
      >
        <div className="grid grid-2">
          <div
            className="stack stack-2"
            style={{
              padding: "var(--space-4)",
              background: "var(--surface-0)",
              border: "1px solid var(--border-1)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <span className="label">Preliminary conclusion, second line</span>
            <p style={{ fontSize: "var(--text-sm)" }}>
              {test.preliminaryConclusion.length > 0
                ? test.preliminaryConclusion
                : "No preliminary conclusion is recorded."}
            </p>
            <div className="divider" />
            <span className="label">Assurance conclusion, human owned</span>
            {test.assuranceConclusion ? (
              <>
                <p style={{ fontSize: "var(--text-sm)" }}>{test.assuranceConclusion}</p>
                <span className="meta">
                  Recorded by{" "}
                  {test.concludedByUserId
                    ? (names.get(test.concludedByUserId) ?? test.concludedByUserId)
                    : "not recorded"}
                  {test.concludedOn ? ` on ${formatDateDach(test.concludedOn)}` : ""}
                </span>
              </>
            ) : (
              <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
                Not yet concluded. The assurance conclusion is a human decision and nothing on this
                page has taken it.
              </p>
            )}
          </div>

          <div
            className="stack stack-2"
            style={{
              padding: "var(--space-4)",
              background: "var(--red-tint)",
              border: "1px solid var(--red-edge)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <div className="row row-2 row-between row-wrap">
              <span className="label" style={{ color: "var(--red)" }}>
                First line management response
              </span>
              <Chip tone="red">disputed</Chip>
            </div>
            {test.managementResponse.length > 0 ? (
              <p style={{ fontSize: "var(--text-sm)" }}>{test.managementResponse}</p>
            ) : (
              <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
                No management response is recorded.
              </p>
            )}
            {test.managementResponseBy ? (
              <span className="meta">
                Position recorded by{" "}
                {names.get(test.managementResponseBy) ?? test.managementResponseBy}
              </span>
            ) : null}
            <p className="meta">
              The response is reproduced in full and is not summarised. Its arguments are the ones
              the assurance conclusion has to answer, and a paraphrase would make them easier to
              dismiss than they deserve.
            </p>
          </div>
        </div>
      </Section>
    </>
  );

  return {
    heading: `${test.reference} ${test.title}`,
    standfirst: `A recorded population of ${test.populationSize.toLocaleString("de-DE")} items, ${summary.sampled} drawn and tested, ${exceptions.length} exceptions and ${unableToConclude.length} items on which no conclusion is possible. The first line does not accept the preliminary result.`,
    badges: [
      { label: `${summary.sampled} of ${test.populationSize.toLocaleString("de-DE")} tested`, tone: "cyan" },
      { label: `${exceptions.length} exceptions`, tone: "red" },
      { label: `${unableToConclude.length} unable to conclude`, tone: "pink" },
      { label: test.status, tone: test.status === "disputed" ? "red" : "amber" },
    ],
    body,
    evidenceIds,
    whyThisMatters: [
      `The deviation rate is ${(exceptionRate * 100).toFixed(2)} percent on the exceptions alone and ${(combinedRate * 100).toFixed(2)} percent if the unable to conclude items are treated as deviations. Which of those two numbers is reported is a judgment, not a calculation.`,
      "The first line's response is on the record in full. It argues no loss, two compensating controls, a vacant reviewer position and a supplier side cause. Each of those is a separate argument and each needs a separate answer.",
      `${summary.fromFallbackRoute} item(s) in the population came from a fallback route, which is the population the shared event adds to.`,
    ],
    uncertainty: unableToConclude.map((row) => ({
      topic: `${row.transactionRef} cannot be concluded on`,
      description:
        row.note.length > 0
          ? row.note
          : "An attribute could not be tested because the underlying evidence no longer exists.",
      kind: "missing-evidence",
      resolutionPath:
        "In both cases the evidence is either expired or awaiting restoration from archive. Where it has expired, no amount of further work will produce it and the item stays unconcluded.",
      materialToDecision: true,
      sourceIds: row.evidenceDocumentIds,
    })),
    contextLabel: `Control test ${test.reference}: ${summary.sampled} of ${test.populationSize} items tested, ${exceptions.length} exceptions, ${unableToConclude.length} unable to conclude, status ${test.status}.`,
  };
}

/* ==========================================================================
   4. Incident and Resilience Lead: chronology and dependency map
   ========================================================================== */

function buildResilienceWorkbench(
  names: Map<string, string>,
  moment: string,
  language: Language,
): Workbench {
  const incident = getSharedEventIncident() ?? null;

  if (!incident) {
    return {
      heading: "Incident workbench",
      standfirst: "No shared event incident exists in this run.",
      badges: [],
      body: <Missing what="No incident is flagged as the shared event." />,
      evidenceIds: [],
      whyThisMatters: [],
      uncertainty: [],
      contextLabel: "Incident workbench, no incident resolved.",
    };
  }

  const chronology = getIncidentTimeline(incident.id, moment);
  const recovery = getRecoveryOptions(incident.id);
  const allDependencies = getServiceDependencies();
  const allTolerances = getImpactTolerances();
  const services = getServices();
  const suppliers = getSuppliers();

  const serviceById = new Map(services.map((row) => [row.id, row]));
  const supplierById = new Map(suppliers.map((row) => [row.id, row]));
  const subprocessorNames = new Map(
    getAllSubprocessors().map((row) => [row.id, { name: row.name, domicile: row.domicile }]),
  );

  /* ---- The dependency neighbourhood of the incident ---- */
  const seeds = new Set<string>([...incident.serviceIds, ...incident.supplierIds]);
  const included = new Set<string>(seeds);
  let frontier = new Set<string>(seeds);
  for (let hop = 0; hop < 2; hop += 1) {
    const next = new Set<string>();
    for (const dep of allDependencies) {
      if (frontier.has(dep.fromId) && !included.has(dep.toId)) next.add(dep.toId);
      if (frontier.has(dep.toId) && !included.has(dep.fromId)) next.add(dep.fromId);
    }
    for (const id of next) included.add(id);
    frontier = next;
  }

  const scopedDependencies = allDependencies.filter(
    (dep) => included.has(dep.fromId) && included.has(dep.toId),
  );

  /*
   * There is no system inventory table in this scenario: systems exist only as
   * identifiers on the dependency edges. A readable name is recovered from the
   * seeded descriptions where one is stated against the exact identifier, and
   * the identifier itself is always shown alongside it.
   */
  const systemNames = new Map<string, string>();
  const descriptionCorpus = [
    ...suppliers.map((row) => row.description),
    ...services.map((row) => row.description),
    ...allDependencies.map((row) => row.note),
  ].join("\n");
  const systemPattern = /\b(SYS-\d{4})\s+([A-Z][A-Za-z0-9-]*(?:\s+[A-Z][A-Za-z0-9-]*){0,2})/g;
  for (const match of descriptionCorpus.matchAll(systemPattern)) {
    const id = match[1];
    const label = match[2];
    if (id && label && !systemNames.has(id)) systemNames.set(id, label.trim());
  }

  const kindOf = (id: string): DependencyKind => {
    if (serviceById.has(id)) return "service";
    if (supplierById.has(id)) return "supplier";
    if (subprocessorNames.has(id)) return "subprocessor";
    return "system";
  };

  const eventAffected = new Set<string>();
  for (const dep of scopedDependencies) {
    if (dep.affectedByEvent) {
      eventAffected.add(dep.fromId);
      eventAffected.add(dep.toId);
    }
  }
  for (const id of incident.serviceIds) eventAffected.add(id);
  for (const id of incident.supplierIds) eventAffected.add(id);

  const entityShortNames = new Map<string, string>(
    incident.entityIds.map((id) => [id, getEntity(id)?.shortName ?? id]),
  );

  const nodes: DependencyNodeView[] = Array.from(included).map((id) => {
    const kind = kindOf(id);
    if (kind === "service") {
      const service = serviceById.get(id);
      return {
        id,
        kind,
        label: service ? (language === "de" ? service.nameDe : service.name) : id,
        ...(service ? { detail: service.domain } : {}),
        ...(service ? { operationalStatus: service.operationalStatus } : {}),
        ...(service ? { isImportantBusinessService: service.isImportantBusinessService } : {}),
        ...(service && service.entityIds.length > 0
          ? {
              entityLabel: service.entityIds
                .map((entityId) => entityShortNames.get(entityId) ?? entityId)
                .join(", "),
            }
          : {}),
        affectedByEvent: eventAffected.has(id),
        ...(eventAffected.has(id) ? { failedAtMoment: SHARED_EVENT_MOMENT } : {}),
      };
    }
    if (kind === "supplier") {
      const supplier = supplierById.get(id);
      return {
        id,
        kind,
        label: supplier ? supplier.name : id,
        ...(supplier ? { detail: `${supplier.criticality}, ${supplier.domicile}` } : {}),
        affectedByEvent: eventAffected.has(id),
        ...(eventAffected.has(id) ? { failedAtMoment: SHARED_EVENT_MOMENT } : {}),
      };
    }
    if (kind === "subprocessor") {
      const sub = subprocessorNames.get(id);
      return {
        id,
        kind,
        label: sub ? sub.name : id,
        ...(sub ? { detail: sub.domicile } : {}),
        affectedByEvent: eventAffected.has(id),
      };
    }
    return {
      id,
      kind: "system",
      label: systemNames.get(id) ?? id,
      detail: id,
      affectedByEvent: eventAffected.has(id),
    };
  });

  const edges: DependencyEdgeView[] = scopedDependencies.map((dep) => ({
    id: dep.id,
    from: dep.fromId,
    to: dep.toId,
    strength: narrowStrength(dep.dependencyStrength),
    singlePointOfFailure: dep.singlePointOfFailure,
    affectedByEvent: dep.affectedByEvent,
    ...(dep.note.length > 0 ? { note: dep.note } : {}),
  }));

  /* ---- Impact tolerances that bear on the affected services ---- */
  const relevantTolerances = allTolerances.filter((row) =>
    incident.serviceIds.includes(row.serviceId) || included.has(row.serviceId),
  );

  const toleranceViews: ToleranceMeasureView[] = relevantTolerances.map((row) => {
    const service = serviceById.get(row.serviceId);
    if (row.thresholdMinutes !== null) {
      const status = calculateToleranceRemaining({
        serviceId: row.serviceId,
        metric: row.metric,
        thresholdMinutes: row.thresholdMinutes,
        consumedMinutes: row.consumedMinutes,
        statement: row.statement,
      });
      return {
        id: row.id,
        serviceId: row.serviceId,
        ...(service ? { serviceLabel: service.name } : {}),
        entityLabel: row.entityId,
        metric: row.metric,
        unit: row.unit,
        thresholdValue: status.thresholdMinutes,
        consumedValue: status.consumedMinutes,
        state: status.state as ToleranceState,
        statement: row.statement,
        approvedBy: row.approvedBy,
        note: `${status.remainingMinutes} minutes of headroom remain on the elapsed time measure. Computed from the recorded threshold and consumption, not asserted.`,
      };
    }
    return {
      id: row.id,
      serviceId: row.serviceId,
      ...(service ? { serviceLabel: service.name } : {}),
      entityLabel: row.entityId,
      metric: row.metric,
      unit: row.unit,
      thresholdValue: row.thresholdVolume ?? 0,
      consumedValue: 0,
      state: "within",
      statement: row.statement,
      approvedBy: row.approvedBy,
      note: "This measure is a count or a share, not elapsed time. The prototype tracks elapsed minutes, so consumption against this measure is not computed and the state shown is the starting position rather than a live reading.",
    };
  });

  /* The two measure tolerance with no stated precedence. */
  const precedenceTolerance = relevantTolerances.find(
    (row) => row.thresholdMinutes !== null && /cut-off/i.test(row.unit),
  );

  /* ---- Conflicting statements, paired ---- */
  const chronologyById = new Map(chronology.map((row) => [row.id, row]));
  const conflictPairs: Array<{
    key: string;
    first: (typeof chronology)[number];
    second: (typeof chronology)[number];
  }> = [];
  const seenConflicts = new Set<string>();
  for (const entry of chronology) {
    if (!entry.conflictsWithId) continue;
    const other = chronologyById.get(entry.conflictsWithId);
    if (!other) continue;
    const key = [entry.id, other.id].sort().join("|");
    if (seenConflicts.has(key)) continue;
    seenConflicts.add(key);
    conflictPairs.push({ key, first: entry, second: other });
  }

  const evidenceIds = Array.from(
    new Set(chronology.flatMap((entry) => entry.evidenceDocumentIds)),
  );

  const body = (
    <>
      <Section
        title="Service dependency map"
        note={`${nodes.length} nodes, ${edges.length} edges, ${edges.filter((edge) => edge.affectedByEvent).length} carrying the event`}
      >
        {nodes.length === 0 ? (
          <Missing what="No dependency edge connects to the affected services." />
        ) : (
          <VisualFrame
            caption={`Four tiers, read left to right: business service, system, supplier, subprocessor. Edges marked as carrying the event are the ones the ${SHARED_EVENT_MOMENT} degradation travelled along. Single points of failure are marked on the edge, because that is where substitutability is actually absent.`}
          >
            <ServiceDependencyMap
              nodes={nodes}
              edges={edges}
              tolerances={toleranceViews}
              eventMoment={SHARED_EVENT_MOMENT}
              {...(precedenceTolerance
                ? {
                    precedenceNote:
                      "One tolerance in scope carries two measures, elapsed disruption time and completion against the same-day cut-off, and the approved statement does not say which prevails. The two can give different answers, so the entity cannot state on its own tolerance whether it has breached.",
                  }
                : {})}
              heading={`${incident.reference} ${incident.title}`}
            />
          </VisualFrame>
        )}
        <div className="table-wrap">
          <table className="table">
            <tbody>
              <tr>
                <th scope="row">Detected</th>
                <td>{incident.detectedAt.slice(11, 16)}</td>
                <th scope="row">Technical start</th>
                <td>{incident.occurredAt ? incident.occurredAt.slice(11, 16) : "not established"}</td>
              </tr>
              <tr>
                <th scope="row">Status</th>
                <td>
                  <Chip tone={incident.status === "closed" ? "green" : "amber"}>
                    {incident.status}
                  </Chip>
                </td>
                <th scope="row">Severity</th>
                <td>
                  {incident.severity ? (
                    <Chip tone="red">{incident.severity}</Chip>
                  ) : (
                    <Chip tone="amber">
                      proposed {incident.proposedSeverity ?? "none"}, not yet decided
                    </Chip>
                  )}
                </td>
              </tr>
              <tr>
                <th scope="row">Entities</th>
                <td>
                  {incident.entityIds
                    .map((id) => entityShortNames.get(id) ?? id)
                    .join(", ")}
                </td>
                <th scope="row">Lead</th>
                <td>
                  {incident.leadUserId
                    ? (names.get(incident.leadUserId) ?? incident.leadUserId)
                    : "not assigned"}
                </td>
              </tr>
              <tr>
                <th scope="row">Regulatory classification</th>
                <td colSpan={3}>
                  {incident.regulatoryClassification ?? (
                    <span className="muted">
                      Not classified. This is a human decision and the product records a
                      recommendation rather than taking it.
                    </span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* ---------------- Conflicting statements ---------------- */}
      <Section
        title={`Statements that do not agree (${conflictPairs.length})`}
        note="Neither side is resolved on your behalf"
        tone={conflictPairs.length > 0 ? "red" : "green"}
      >
        {conflictPairs.length === 0 ? (
          <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
            No two statements visible at {moment} contradict each other.
          </p>
        ) : (
          conflictPairs.map((pair) => (
            <div key={pair.key} className="card card-edge" data-tone="red">
              <div className="stack stack-3">
                <div className="row row-2 row-wrap row-between">
                  <span className="strong-text">
                    {pair.first.sourceLabel} and {pair.second.sourceLabel} give different accounts
                  </span>
                  <Chip tone={pair.first.conflictResolution.length > 0 ? "cyan" : "red"}>
                    {pair.first.conflictResolution.length > 0 ? "resolved" : "unresolved"}
                  </Chip>
                </div>
                <div className="grid grid-2">
                  <ChronologyClaim entry={pair.first} language={language} />
                  <ChronologyClaim entry={pair.second} language={language} />
                </div>
                {pair.first.conflictResolution.length > 0 ? (
                  <div className="stack stack-1">
                    <span className="label">How it resolved</span>
                    <p className="dim" style={{ fontSize: "var(--text-sm)" }}>
                      {pair.first.conflictResolution}
                    </p>
                  </div>
                ) : (
                  <p className="meta">
                    Until the difference is resolved, any conclusion resting on either account
                    carries that uncertainty. The product will not pick a side.
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </Section>

      {/* ---------------- The chronology ---------------- */}
      <Section
        title={`Chronology (${chronology.length} entries visible at ${moment})`}
        note="Provenance per entry"
      >
        {chronology.length === 0 ? (
          <Missing what="No chronology entry is visible at this point on the timeline." />
        ) : (
          <ol className="stack stack-3" style={{ listStyle: "none" }}>
            {chronology.map((entry) => {
              const conflict = entry.conflictsWithId
                ? chronologyById.get(entry.conflictsWithId)
                : undefined;
              return (
                <li key={entry.id} id={entry.id}>
                  <div
                    className="card card-edge"
                    data-tone={entry.conflictsWithId ? "red" : "neutral"}
                  >
                    <div className="row row-4 row-start row-wrap">
                      <div
                        className="stack stack-1 shrink-0"
                        style={{ width: 72, textAlign: "right" }}
                      >
                        <span className="mono strong-text">{entry.atMoment}</span>
                        <span className="meta">{entry.channel}</span>
                      </div>
                      <div className="stack stack-2 grow" style={{ minWidth: 0 }}>
                        <div className="row row-2 row-wrap row-between">
                          <span className="strong-text" style={{ fontSize: "var(--text-sm)" }}>
                            {entry.sourceLabel}
                            {entry.sourceUserId
                              ? ` (${names.get(entry.sourceUserId) ?? entry.sourceUserId})`
                              : ""}
                          </span>
                          <div className="row row-2 row-wrap">
                            <ProvenanceBadge kind={entry.provenance} language={language} />
                            {entry.confidence !== null ? (
                              <ConfidenceMeter value={entry.confidence} label="conf" />
                            ) : null}
                          </div>
                        </div>
                        <p style={{ fontSize: "var(--text-sm)" }}>{entry.statement}</p>
                        <div className="row row-2 row-wrap">
                          {entry.evidenceDocumentIds.length === 0 ? (
                            <span className="meta" style={{ color: "var(--amber)" }}>
                              no source cited
                            </span>
                          ) : (
                            entry.evidenceDocumentIds.map((id) => (
                              <span key={id} className="chip" data-tone="neutral">
                                <span className="mono">{id}</span>
                              </span>
                            ))
                          )}
                        </div>
                        {conflict ? (
                          <div
                            className="stack stack-1"
                            style={{
                              padding: "var(--space-2) var(--space-3)",
                              background: "var(--red-tint)",
                              border: "1px solid var(--red-edge)",
                              borderRadius: "var(--radius-md)",
                            }}
                          >
                            <span className="label" style={{ color: "var(--red)" }}>
                              Conflicts with the {conflict.atMoment} entry from{" "}
                              {conflict.sourceLabel}
                            </span>
                            <a href={`#${conflict.id}`} style={{ fontSize: "var(--text-sm)" }}>
                              {conflict.statement.slice(0, 160)}
                              {conflict.statement.length > 160 ? " ..." : ""}
                            </a>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Section>

      {/* ---------------- Impact tolerances ---------------- */}
      <Section
        title="Impact tolerance position"
        note={`${toleranceViews.length} measures in scope`}
        tone={
          toleranceViews.some((row) => row.state === "breached")
            ? "red"
            : toleranceViews.some((row) => row.state !== "within")
              ? "amber"
              : "green"
        }
      >
        {toleranceViews.length === 0 ? (
          <Missing what="No impact tolerance covers the affected services." />
        ) : (
          <>
            <p style={{ fontSize: "var(--text-sm)" }}>
              A threshold being passed is reported here as a calculation. Whether that constitutes a
              breach requiring escalation is a determination for the Incident and Resilience Lead,
              and the product does not make it.
            </p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Measure</th>
                    <th scope="col">Scope approved</th>
                    <th scope="col" className="num">
                      Threshold
                    </th>
                    <th scope="col" className="num">
                      Consumed
                    </th>
                    <th scope="col">State</th>
                  </tr>
                </thead>
                <tbody>
                  {toleranceViews.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="stack stack-1">
                          <span className="strong-text">{row.metric}</span>
                          <span className="meta">
                            {row.serviceLabel ?? row.serviceId} &middot; approved by{" "}
                            {row.approvedBy ?? "not recorded"}
                          </span>
                        </div>
                      </td>
                      <td>{row.entityLabel ?? "not recorded"}</td>
                      <td className="num">
                        {row.thresholdValue} {row.unit}
                      </td>
                      <td className="num">{row.consumedValue}</td>
                      <td>
                        <Chip
                          tone={
                            row.state === "breached"
                              ? "red"
                              : row.state === "at-threshold"
                                ? "red"
                                : row.state === "approaching"
                                  ? "amber"
                                  : "green"
                          }
                        >
                          {row.state.replace(/-/g, " ")}
                        </Chip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="stack stack-3">
              {toleranceViews.map((row) => (
                <details key={`detail-${row.id}`}>
                  <summary style={{ cursor: "pointer" }}>
                    <span className="label">{row.metric}</span>
                  </summary>
                  <div className="stack stack-2" style={{ marginTop: "var(--space-2)" }}>
                    <p style={{ fontSize: "var(--text-sm)" }}>{row.statement}</p>
                    {row.note ? (
                      <p className="dim" style={{ fontSize: "var(--text-sm)" }}>
                        {row.note}
                      </p>
                    ) : null}
                    <RegulatoryNote language={language} />
                  </div>
                </details>
              ))}
            </div>

            {precedenceTolerance ? (
              <div className="card card-edge" data-tone="amber">
                <div className="stack stack-2">
                  <span className="label" style={{ color: "var(--amber)" }}>
                    Two measures, no stated precedence
                  </span>
                  <p style={{ fontSize: "var(--text-sm)" }}>
                    <span className="mono">{precedenceTolerance.id}</span> carries an elapsed time
                    measure and a cut-off completion measure in one approved statement, and the
                    statement does not say which prevails. A disruption that starts early enough can
                    exceed the elapsed time measure and still complete before the cut-off, so the
                    two measures can give opposite answers about the same event. The entity
                    therefore cannot state, on its own tolerance as written, whether it breached.
                  </p>
                  <p className="meta">
                    This is a defect in the tolerance rather than in the response, and it is worth
                    recording as such.
                  </p>
                </div>
              </div>
            ) : null}
          </>
        )}
      </Section>

      {/* ---------------- Recovery options ---------------- */}
      <Section
        title={`Recovery options (${recovery.length})`}
        note="Each one costs something in control terms"
        tone="amber"
      >
        {recovery.length === 0 ? (
          <Missing what="No recovery option is recorded against this incident." />
        ) : (
          <>
            <p style={{ fontSize: "var(--text-sm)" }}>
              Every option restores service and every option gives something up. The trade-off is
              stated in control terms rather than in availability terms, because the cost of the
              fastest route on 06.10.2026 was paid by a control gate and not by the clock.
            </p>
            <div className="stack stack-3">
              {recovery.map((option) => (
                <div
                  key={option.id}
                  className="card card-edge"
                  data-tone={option.selected ? "green" : "amber"}
                >
                  <div className="stack stack-3">
                    <div className="row row-2 row-wrap row-between">
                      <span className="strong-text">{option.name}</span>
                      <div className="row row-2 row-wrap">
                        {option.selected ? <Chip tone="green">selected</Chip> : null}
                        <Chip
                          tone={
                            option.availability === "available"
                              ? "green"
                              : option.availability === "requires-approval"
                                ? "amber"
                                : "red"
                          }
                        >
                          {option.availability.replace(/-/g, " ")}
                        </Chip>
                        <Chip tone="cyan">
                          {option.estimatedMinutesToRestore} minutes to restore
                        </Chip>
                      </div>
                    </div>
                    <p style={{ fontSize: "var(--text-sm)" }}>{option.description}</p>
                    <div className="grid grid-2">
                      <div className="stack stack-1">
                        <span className="label" style={{ color: "var(--amber)" }}>
                          What it costs in control terms
                        </span>
                        <p style={{ fontSize: "var(--text-sm)" }}>{option.controlTradeOff}</p>
                      </div>
                      <div className="stack stack-1">
                        <span className="label">Operational risk it introduces</span>
                        <p style={{ fontSize: "var(--text-sm)" }}>{option.operationalRisk}</p>
                      </div>
                    </div>
                    {option.requiresApprovalFrom.length > 0 ? (
                      <span className="meta">
                        Requires approval from {option.requiresApprovalFrom}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Section>
    </>
  );

  return {
    heading: `${incident.reference} ${language === "de" ? incident.titleDe : incident.title}`,
    standfirst: incident.description.slice(0, 700) + (incident.description.length > 700 ? " ..." : ""),
    badges: [
      { label: incident.status, tone: "amber" },
      {
        label: incident.severity ? `severity ${incident.severity}` : "severity not decided",
        tone: incident.severity ? "red" : "amber",
      },
      {
        label: `${conflictPairs.length} conflicting statements`,
        tone: conflictPairs.length > 0 ? "red" : "green",
      },
      { label: `${recovery.length} recovery options`, tone: "cyan" },
    ],
    body,
    evidenceIds,
    whyThisMatters: [
      `${conflictPairs.length} pair(s) of statements in the chronology do not agree. Two accounts of one fact cannot both inform a decision.`,
      "Severity, regulatory classification and the notification recommendation are all human decisions on this record, and none of them has been taken.",
      precedenceTolerance
        ? "One tolerance in scope carries two measures with no stated precedence, so the breach question cannot be answered from the tolerance as written."
        : "Every tolerance in scope carries a single measure.",
    ],
    uncertainty: conflictPairs.map((pair) => ({
      topic: `${pair.first.sourceLabel} and ${pair.second.sourceLabel} do not agree`,
      description: `${pair.first.statement.slice(0, 200)} ... against ... ${pair.second.statement.slice(0, 200)}`,
      kind: "conflicting-evidence",
      resolutionPath:
        pair.first.conflictResolution.length > 0
          ? pair.first.conflictResolution
          : "Establish which account the underlying records support. Until then, neither can carry a conclusion on its own.",
      materialToDecision: true,
      sourceIds: [...pair.first.evidenceDocumentIds, ...pair.second.evidenceDocumentIds],
    })),
    contextLabel: `Incident ${incident.reference} at ${moment}: ${chronology.length} chronology entries, ${conflictPairs.length} conflicts, ${toleranceViews.length} tolerance measures, ${recovery.length} recovery options.`,
  };
}

function ChronologyClaim({
  entry,
  language,
}: {
  entry: ReturnType<typeof getIncidentTimeline>[number];
  language: Language;
}) {
  return (
    <div
      className="stack stack-2"
      style={{
        padding: "var(--space-3)",
        background: "var(--surface-0)",
        border: "1px solid var(--border-1)",
        borderRadius: "var(--radius-md)",
      }}
    >
      <div className="row row-2 row-between row-wrap">
        <span className="label">
          {entry.atMoment} &middot; {entry.sourceLabel}
        </span>
        <ProvenanceBadge kind={entry.provenance} language={language} showLabel={false} />
      </div>
      <p style={{ fontSize: "var(--text-sm)" }}>{entry.statement}</p>
      <div className="row row-2 row-wrap">
        {entry.evidenceDocumentIds.map((id) => (
          <span key={id} className="mono meta">
            {id}
          </span>
        ))}
        {entry.confidence !== null ? (
          <ConfidenceMeter value={entry.confidence} label="conf" />
        ) : null}
      </div>
      <a href={`#${entry.id}`} className="meta">
        Open in the chronology
      </a>
    </div>
  );
}

/* ==========================================================================
   5. Regulatory Change Manager: the obligation lineage
   ========================================================================== */

function buildObligationWorkbench(names: Map<string, string>, language: Language): Workbench {
  const publications = getRegulatoryPublications();
  const obligations = getObligations();
  const gaps = getUnownedObligationGaps();

  if (publications.length === 0) {
    return {
      heading: "Obligation lineage",
      standfirst: "No regulatory publication exists in this run.",
      badges: [],
      body: <Missing what="No publication row could be resolved." />,
      evidenceIds: [],
      whyThisMatters: [],
      uncertainty: [],
      contextLabel: "Obligation lineage, no publication resolved.",
    };
  }

  const laneOf = (jurisdiction: string): LineageLane => (jurisdiction === "ch" ? "ch" : "eu");

  const lineagePublications: LineagePublication[] = publications.map((row) => ({
    id: row.id,
    reference: row.reference,
    title: row.title,
    issuer: row.issuer,
    jurisdiction: row.jurisdiction,
    lane: laneOf(row.jurisdiction),
    instrumentType: row.instrumentType,
    publishedOn: row.publishedOn,
  }));

  const publicationById = new Map(publications.map((row) => [row.id, row]));

  /*
   * Terminal state is derived, not stored, and the derivation is stated on the
   * page. An obligation with no owner and no mapping is unmapped; one mapped
   * to a control that has never been tested is unevidenced; one whose newest
   * mapped test is more than a year old is stale.
   */
  const controlTests = getControlTests();
  const newestTestByControl = new Map<string, string>();
  for (const test of controlTests) {
    const existing = newestTestByControl.get(test.controlId);
    if (!existing || test.periodTo > existing) {
      newestTestByControl.set(test.controlId, test.periodTo);
    }
  }
  const STALE_AFTER_DAYS = 365;
  const today = Date.parse("2026-10-06T00:00:00.000Z");

  function terminalStateFor(row: (typeof obligations)[number]): LineageTerminalState {
    const hasTarget =
      row.policyIds.length > 0 || row.processIds.length > 0 || row.controlIds.length > 0;
    if (row.isUnownedGap || !hasTarget) return "unmapped";
    if (row.controlIds.length === 0) return "unevidenced";
    const dates = row.controlIds
      .map((id) => newestTestByControl.get(id))
      .filter((value): value is string => value !== undefined)
      .map((value) => Date.parse(`${value}T00:00:00.000Z`))
      .filter((value) => !Number.isNaN(value));
    if (dates.length === 0) return "unevidenced";
    const newest = Math.max(...dates);
    const ageDays = (today - newest) / (1000 * 60 * 60 * 24);
    return ageDays > STALE_AFTER_DAYS ? "stale" : "evidenced";
  }

  /* Targets shared across both lanes are worth marking: one policy section
     often carries an EU and a Swiss obligation at the same time. */
  const laneByTarget = new Map<string, Set<LineageLane>>();
  for (const row of obligations) {
    const publication = publicationById.get(row.publicationId);
    if (!publication) continue;
    const lane = laneOf(publication.jurisdiction);
    for (const id of [...row.policyIds, ...row.processIds, ...row.controlIds]) {
      const set = laneByTarget.get(id) ?? new Set<LineageLane>();
      set.add(lane);
      laneByTarget.set(id, set);
    }
  }

  function targetsFor(row: (typeof obligations)[number]): LineageTarget[] {
    const result: LineageTarget[] = [];
    for (const id of row.policyIds) {
      const policy = getPolicy(id);
      result.push({
        id,
        kind: "policy",
        label: policy ? `${policy.reference} ${policy.section}` : id,
        ...(policy ? { detail: policy.sectionTitle } : {}),
        servesBothLanes: (laneByTarget.get(id)?.size ?? 0) > 1,
      });
    }
    for (const id of row.processIds) {
      const process = getProcess(id);
      result.push({
        id,
        kind: "process",
        label: process ? process.code : id,
        ...(process ? { detail: process.name } : {}),
        servesBothLanes: (laneByTarget.get(id)?.size ?? 0) > 1,
      });
    }
    for (const id of row.controlIds) {
      const control = getControl(id);
      result.push({
        id,
        kind: "control",
        label: control ? control.reference : id,
        ...(control ? { detail: control.title } : {}),
        servesBothLanes: (laneByTarget.get(id)?.size ?? 0) > 1,
      });
    }
    return result;
  }

  const lineageObligations: LineageObligation[] = obligations.map((row) => {
    const terminalState = terminalStateFor(row);
    const newestTest = row.controlIds
      .map((id) => newestTestByControl.get(id))
      .filter((value): value is string => value !== undefined)
      .sort()
      .at(-1);
    return {
      id: row.id,
      publicationId: row.publicationId,
      paragraphReference: row.paragraphReference,
      summary: row.extractedSummary,
      theme: row.theme,
      entityScopeLabel:
        row.candidateEntityIds.length > 0 ? row.candidateEntityIds.join(", ") : "not scoped",
      extractionConfidence: row.extractionConfidence,
      applicabilityDecision: row.applicabilityDecision,
      ownerLabel: row.ownerUserId ? (names.get(row.ownerUserId) ?? row.ownerUserId) : null,
      isUnownedGap: row.isUnownedGap,
      ...(row.gapNote.length > 0 ? { gapNote: row.gapNote } : {}),
      targets: targetsFor(row),
      terminalState,
      ...(newestTest ? { evidenceRef: newestTest, evidenceAgeLabel: `tested to ${newestTest}` } : {}),
    };
  });

  const euPublications = publications.filter((row) => row.jurisdiction !== "ch");
  const chPublications = publications.filter((row) => row.jurisdiction === "ch");
  const obligationsByPublication = new Map<string, typeof obligations>();
  for (const row of obligations) {
    const list = obligationsByPublication.get(row.publicationId) ?? [];
    list.push(row);
    obligationsByPublication.set(row.publicationId, list);
  }

  const undecided = obligations.filter((row) => row.applicabilityDecision === null);
  const lowConfidence = obligations.filter((row) => row.extractionConfidence < 0.7);

  const evidenceIds = publications
    .map((row) => row.evidenceDocumentId)
    .filter((id): id is string => id !== null);

  const body = (
    <>
      <Section
        title="Obligation lineage"
        note={`${publications.length} publications, ${obligations.length} extracted obligations, ${gaps.length} unowned`}
      >
        <VisualFrame
          caption="Publication, paragraph, obligation, mapped target, terminal state. The European and the Swiss lanes are drawn as separate lanes and never merged, because an instrument issued in one jurisdiction does not reach an entity in the other by virtue of being read on the same screen."
        >
          <ObligationLineage
            publications={lineagePublications}
            obligations={lineageObligations}
            laneLabels={{
              eu: "European Union lane",
              ch: "Swiss lane",
            }}
            heading="From publication to evidenced control"
          />
        </VisualFrame>

        <div className="card card-edge" data-tone="cyan">
          <div className="stack stack-2">
            <span className="label">How the terminal state is derived</span>
            <p style={{ fontSize: "var(--text-sm)" }}>
              The state is computed on this page rather than stored. An obligation with no owner or
              no mapped target reads as unmapped. One mapped only to a policy or a process reads as
              unevidenced, because a policy reference is not a test result. One mapped to a control
              whose newest test period ended more than {STALE_AFTER_DAYS} days before{" "}
              {formatDateDach("2026-10-06")} reads as stale. Only a mapped control with a test
              inside that window reads as evidenced.
            </p>
            <RegulatoryNote language={language} />
          </div>
        </div>
      </Section>

      {/* ---------------- Jurisdiction separation ---------------- */}
      <Section
        title="The two lanes are separate, and stay separate"
        note={`${euPublications.length} in the European lane, ${chPublications.length} in the Swiss lane`}
        tone="cyan"
      >
        <p style={{ fontSize: "var(--text-sm)" }}>
          Applicability is a human decision recorded per entity, and it is the decision this role
          owns. An instrument issued by a European supervisory body is read for the European
          entities; an instrument issued by the Swiss oversight body is read for the Swiss entity.
          Nothing on this page concludes that an instrument from one lane applies to an entity in
          the other. Where a European instrument and a Swiss instrument address the same subject,
          the product maps both to the same internal policy section and marks the section as serving
          both lanes, which is a statement about the bank's own control framework and not about the
          reach of either instrument.
        </p>
        <div className="grid grid-2">
          <div className="stack stack-2">
            <span className="label" style={{ color: "var(--cyan)" }}>
              European Union lane
            </span>
            {euPublications.map((row) => (
              <div key={row.id} className="card">
                <div className="stack stack-1">
                  <span className="mono strong-text" style={{ fontSize: "var(--text-sm)" }}>
                    {row.reference}
                  </span>
                  <span style={{ fontSize: "var(--text-sm)" }}>{row.title}</span>
                  <span className="meta">
                    {row.issuer} &middot; {row.instrumentType} &middot; published{" "}
                    {formatDateDach(row.publishedOn)} &middot; jurisdiction {row.jurisdiction}
                  </span>
                  <span className="meta">
                    {(obligationsByPublication.get(row.id) ?? []).length} obligations extracted
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="stack stack-2">
            <span className="label" style={{ color: "var(--accent)" }}>
              Swiss lane
            </span>
            {chPublications.map((row) => (
              <div key={row.id} className="card">
                <div className="stack stack-1">
                  <span className="mono strong-text" style={{ fontSize: "var(--text-sm)" }}>
                    {row.reference}
                  </span>
                  <span style={{ fontSize: "var(--text-sm)" }}>{row.title}</span>
                  <span className="meta">
                    {row.issuer} &middot; {row.instrumentType} &middot; published{" "}
                    {formatDateDach(row.publishedOn)} &middot; jurisdiction {row.jurisdiction}
                  </span>
                  <span className="meta">
                    {(obligationsByPublication.get(row.id) ?? []).length} obligations extracted
                  </span>
                </div>
              </div>
            ))}
            {chPublications.length === 0 ? (
              <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
                No publication in the Swiss lane.
              </p>
            ) : null}
          </div>
        </div>
        <RegulatoryNote language={language} />
      </Section>

      {/* ---------------- Publication text ---------------- */}
      <Section title="The publications, in full" note="Quoted text, separately from the extraction">
        <p style={{ fontSize: "var(--text-sm)" }}>
          The quoted text is the instrument. The extracted summary below each obligation is a model
          output and is kept visually separate from it, with the extraction confidence attached, so
          a reader is never asked to take a paraphrase for a provision.
        </p>
        {publications.map((row) => (
          <details key={row.id}>
            <summary style={{ cursor: "pointer" }}>
              <span className="row row-2 row-wrap">
                <Chip tone={row.jurisdiction === "ch" ? "accent" : "cyan"}>
                  {row.jurisdiction === "ch" ? "Swiss lane" : "European lane"}
                </Chip>
                <span className="mono strong-text">{row.reference}</span>
                <span style={{ fontSize: "var(--text-sm)" }}>{row.title}</span>
              </span>
            </summary>
            <div className="stack stack-3" style={{ marginTop: "var(--space-3)" }}>
              <div className="table-wrap">
                <table className="table">
                  <tbody>
                    <tr>
                      <th scope="row">Issuer</th>
                      <td>{row.issuer}</td>
                      <th scope="row">Instrument</th>
                      <td>{row.instrumentType}</td>
                    </tr>
                    <tr>
                      <th scope="row">Published</th>
                      <td>{formatDateDach(row.publishedOn)}</td>
                      <th scope="row">Effective from</th>
                      <td>
                        {row.effectiveFrom ? formatDateDach(row.effectiveFrom) : "not stated"}
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">Consultation closes</th>
                      <td>
                        {row.consultationCloses
                          ? formatDateDach(row.consultationCloses)
                          : "not a consultation"}
                      </td>
                      <th scope="row">Jurisdiction</th>
                      <td>{row.jurisdiction}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="stack stack-1">
                <span className="label">Summary of record</span>
                <p style={{ fontSize: "var(--text-sm)" }}>{row.summary}</p>
              </div>
              <div className="stack stack-1">
                <span className="label">Text</span>
                <p
                  style={{
                    fontSize: "var(--text-sm)",
                    whiteSpace: "pre-wrap",
                    borderLeft: "2px solid var(--border-2)",
                    paddingLeft: "var(--space-3)",
                    color: "var(--text-2)",
                  }}
                >
                  {row.fullText}
                </p>
              </div>
              {row.evidenceDocumentId ? (
                <ObjectId id={row.evidenceDocumentId} label="evidence" />
              ) : null}
              <RegulatoryNote language={language} />
            </div>
          </details>
        ))}
      </Section>

      {/* ---------------- Extracted obligations ---------------- */}
      <Section
        title={`Extracted obligations (${obligations.length})`}
        note={`${undecided.length} awaiting an applicability decision, ${lowConfidence.length} extracted at low confidence`}
        tone={undecided.length > 0 ? "amber" : "green"}
      >
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Lane</th>
                <th scope="col">Paragraph</th>
                <th scope="col">Extracted obligation</th>
                <th scope="col">Theme</th>
                <th scope="col">Candidate entities</th>
                <th scope="col">Extraction confidence</th>
                <th scope="col">Applicability</th>
                <th scope="col">Mapping</th>
              </tr>
            </thead>
            <tbody>
              {obligations.map((row) => {
                const publication = publicationById.get(row.publicationId);
                const lane = publication ? laneOf(publication.jurisdiction) : "eu";
                const terminal = terminalStateFor(row);
                return (
                  <tr key={row.id}>
                    <td>
                      <Chip tone={lane === "ch" ? "accent" : "cyan"}>
                        {lane === "ch" ? "Swiss" : "EU"}
                      </Chip>
                    </td>
                    <td>
                      <div className="stack stack-1">
                        <span className="mono">{row.paragraphReference}</span>
                        <span className="meta">{publication?.reference ?? row.publicationId}</span>
                      </div>
                    </td>
                    <td>
                      <div className="stack stack-1">
                        <span>{row.extractedSummary}</span>
                        <details>
                          <summary style={{ cursor: "pointer" }}>
                            <span className="meta">Quoted text</span>
                          </summary>
                          <p
                            className="dim"
                            style={{
                              fontSize: "var(--text-sm)",
                              whiteSpace: "pre-wrap",
                              borderLeft: "2px solid var(--border-2)",
                              paddingLeft: "var(--space-3)",
                              marginTop: "var(--space-2)",
                            }}
                          >
                            {row.obligationText}
                          </p>
                        </details>
                      </div>
                    </td>
                    <td>{row.theme}</td>
                    <td>{row.candidateEntityIds.join(", ") || "not scoped"}</td>
                    <td>
                      <ConfidenceMeter value={row.extractionConfidence} label="extraction" />
                    </td>
                    <td>
                      {row.applicabilityDecision ? (
                        <div className="stack stack-1">
                          <Chip tone="green">{row.applicabilityDecision}</Chip>
                          <span className="meta">
                            {row.decidedByUserId
                              ? (names.get(row.decidedByUserId) ?? row.decidedByUserId)
                              : "decider not recorded"}
                            {row.decidedOn ? `, ${formatDateDach(row.decidedOn)}` : ""}
                          </span>
                        </div>
                      ) : (
                        <Chip tone="amber">not decided by a person</Chip>
                      )}
                    </td>
                    <td>
                      <div className="stack stack-1">
                        <Chip
                          tone={
                            terminal === "evidenced"
                              ? "green"
                              : terminal === "stale"
                                ? "amber"
                                : terminal === "unevidenced"
                                  ? "red"
                                  : "pink"
                          }
                        >
                          {terminal}
                        </Chip>
                        <span className="meta">
                          {row.policyIds.length} policy, {row.processIds.length} process,{" "}
                          {row.controlIds.length} control
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ---------------- The gaps, as findings ---------------- */}
      <Section
        title={`Unowned obligations, raised as findings (${gaps.length})`}
        note="No owner, no control, no evidence"
        tone={gaps.length > 0 ? "red" : "green"}
      >
        {gaps.length === 0 ? (
          <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
            Every extracted obligation has an owner or a mapped control.
          </p>
        ) : (
          <>
            <p style={{ fontSize: "var(--text-sm)" }}>
              Each of these is a finding rather than a gap in a report. An obligation with no owner
              has nobody to ask about it, which means there is nothing to escalate and nothing to
              chase, and that is why it stays open. Naming an owner is the first action, not the
              last.
            </p>
            {gaps.map((row) => {
              const publication = publicationById.get(row.publicationId);
              const lane = publication ? laneOf(publication.jurisdiction) : "eu";
              return (
                <div key={row.id} className="card card-edge" data-tone="red">
                  <div className="stack stack-2">
                    <div className="row row-2 row-wrap row-between">
                      <span className="strong-text">
                        <span className="mono">{row.paragraphReference}</span>{" "}
                        {publication?.reference ?? row.publicationId}
                      </span>
                      <div className="row row-2 row-wrap">
                        <Chip tone={lane === "ch" ? "accent" : "cyan"}>
                          {lane === "ch" ? "Swiss lane" : "European lane"}
                        </Chip>
                        <Chip tone="red">no owner</Chip>
                        <Chip tone="neutral">{row.theme}</Chip>
                      </div>
                    </div>
                    <p style={{ fontSize: "var(--text-sm)" }}>{row.extractedSummary}</p>
                    {row.gapNote.length > 0 ? (
                      <div className="stack stack-1">
                        <span className="label" style={{ color: "var(--red)" }}>
                          Why it is unowned
                        </span>
                        <p style={{ fontSize: "var(--text-sm)" }}>{row.gapNote}</p>
                      </div>
                    ) : null}
                    <div className="row row-3 row-wrap">
                      <span className="meta">
                        candidate entities: {row.candidateEntityIds.join(", ") || "not scoped"}
                      </span>
                      <ConfidenceMeter value={row.extractionConfidence} label="extraction" />
                      {row.implementationPriority ? (
                        <Chip tone="amber">priority {row.implementationPriority}</Chip>
                      ) : null}
                    </div>
                    <RegulatoryNote language={language} />
                  </div>
                </div>
              );
            })}
          </>
        )}
      </Section>
    </>
  );

  return {
    heading: "From publication to evidenced control",
    standfirst: `${publications.length} publications across two jurisdictions, ${obligations.length} extracted obligations, ${gaps.length} of them with no owner. Applicability per entity is a human decision and ${undecided.length} of these obligations are still awaiting one.`,
    badges: [
      { label: `${euPublications.length} European lane`, tone: "cyan" },
      { label: `${chPublications.length} Swiss lane`, tone: "accent" },
      { label: `${gaps.length} unowned`, tone: gaps.length > 0 ? "red" : "green" },
      { label: `${undecided.length} undecided`, tone: undecided.length > 0 ? "amber" : "green" },
    ],
    body,
    evidenceIds,
    whyThisMatters: [
      `${undecided.length} obligation(s) have no applicability decision. Interpretation per legal entity is this role's judgment and the product will not make it.`,
      `${gaps.length} obligation(s) have no owner and no mapped control, which is a finding rather than a data quality issue.`,
      `${lowConfidence.length} obligation(s) were extracted at below 70 out of 100 confidence and the quoted text should be read before the summary is relied on.`,
    ],
    uncertainty: lowConfidence.map((row) => ({
      topic: `${row.paragraphReference} was extracted at low confidence`,
      description: `The extracted summary reads: ${row.extractedSummary}. The extraction confidence is ${Math.round(row.extractionConfidence * 100)} out of 100, so the quoted text should be read directly.`,
      kind: "model-inference",
      resolutionPath: "Read the quoted paragraph and record the interpretation against it.",
      materialToDecision: row.isUnownedGap,
      sourceIds: [row.publicationId],
    })),
    contextLabel: `Obligation lineage: ${publications.length} publications in two separate lanes, ${obligations.length} obligations, ${gaps.length} unowned, ${undecided.length} awaiting an applicability decision.`,
  };
}

/* ==========================================================================
   6. Head of Non-Financial Risk: the portfolio thread
   ========================================================================== */

function buildPortfolioWorkbench(
  names: Map<string, string>,
  moment: string,
  language: Language,
): Workbench {
  const themes = getPortfolioThemes();
  const allDecisions = getAllDecisions(moment);
  const committee = getCommitteeItems();
  const roles = getRoles();
  const roleById = new Map(roles.map((row) => [row.id, row]));

  const theme = themes[0] ?? null;

  /* The shared thread identifier is carried on the decisions, not on the
     theme, so it is read from the first threaded decision the theme names. */
  const themeDecisionIds = new Set(theme?.decisionIds ?? []);
  const themeDecisions = allDecisions.filter((row) => themeDecisionIds.has(row.id));
  const sharedThreadId =
    themeDecisions.find((row) => row.sharedThreadId !== null)?.sharedThreadId ?? null;
  const threadDecisions = sharedThreadId
    ? getDecisionThread(sharedThreadId)
    : themeDecisions;

  const visibleThreadDecisions = threadDecisions.filter((row) =>
    allDecisions.some((visible) => visible.id === row.id),
  );

  const committeeForTheme = theme
    ? committee.filter((item) => item.themeId === theme.id)
    : [];

  /* ---- One matter, one lens per contributing function ---- */
  const lensRoleIds = theme
    ? theme.contributingRoleIds
    : Array.from(new Set(visibleThreadDecisions.map((row) => row.roleId)));

  const lenses: PortfolioLensView[] = lensRoleIds.map((roleId) => {
    const roleRow = roleById.get(roleId);
    const decisions = visibleThreadDecisions.filter((row) => row.roleId === roleId);
    const primary = decisions[0];
    const reportItem = committeeForTheme.find((item) => item.raisedByRoleId === roleId);
    const holder = roleRow ? getUser(roleRow.holderUserId) : undefined;

    return {
      roleId,
      roleTitle: roleRow
        ? language === "de"
          ? roleRow.titleDe
          : roleRow.title
        : roleId,
      ...(holder ? { holderLabel: holder.name } : {}),
      question: primary
        ? primary.question
        : "This function contributes to the theme and has no decision open on it at this moment.",
      position: primary
        ? primary.preparedPosition
        : "No position has been prepared for this function on this matter.",
      ...(primary ? { positionStatus: primary.status } : {}),
      confidence: primary ? primary.confidence : null,
      decisionIds: decisions.map((row) => row.id),
      producesSeparateReportToday: reportItem !== undefined,
      ...(reportItem ? { reportNameToday: reportItem.title } : {}),
      ...(primary ? { evidenceRefs: primary.supportingEvidenceIds } : {}),
    };
  });

  const matter: PortfolioMatterView | null = theme
    ? {
        id: theme.id,
        title: language === "de" && theme.titleDe.length > 0 ? theme.titleDe : theme.title,
        description: theme.description,
        ...(visibleThreadDecisions[0]
          ? { detectedAtMoment: visibleThreadDecisions[0].presentedAtMoment }
          : {}),
        entityLabels: Array.from(
          new Set(visibleThreadDecisions.map((row) => row.entityId)),
        ),
        duplicateReportCount: theme.duplicateReportCount,
        materiality: theme.materiality,
        materialityDecidedBy: theme.materialityDecidedBy
          ? (names.get(theme.materialityDecidedBy) ?? theme.materialityDecidedBy)
          : null,
        confidence: theme.confidence,
      }
    : null;

  const agendaItems = committee.filter((item) => item.onAgenda);
  const offAgenda = committee.filter((item) => !item.onAgenda);
  const committeeRefs = Array.from(new Set(committee.map((item) => item.committeeRef)));

  const evidenceIds = Array.from(
    new Set(visibleThreadDecisions.flatMap((row) => row.supportingEvidenceIds)),
  );

  const body = (
    <>
      <Section
        title="The portfolio thread"
        note={
          theme
            ? `${lenses.length} functions on one matter, ${theme.duplicateReportCount} separate reports today`
            : "no theme"
        }
        tone={theme && theme.duplicateReportCount > 1 ? "amber" : "cyan"}
      >
        {matter && lenses.length > 0 ? (
          <VisualFrame
            caption="One matter in the centre, one lens per contributing function around it. Each lens carries that function's own professional question, which is the reason the same facts produce different positions."
          >
            <PortfolioThread
              matter={matter}
              lenses={lenses}
              threadDecisionIds={visibleThreadDecisions.map((row) => row.id)}
              heading={matter.title}
            />
          </VisualFrame>
        ) : (
          <Missing
            what={
              themes.length === 0
                ? "No portfolio theme exists in this run, so there is no thread to draw. The committee agenda below is unaffected."
                : "The theme exists but names no decision that is visible at this moment. Move the timeline forward."
            }
          />
        )}

        {theme ? (
          <div className="table-wrap">
            <table className="table">
              <tbody>
                <tr>
                  <th scope="row">Theme</th>
                  <td colSpan={3}>{theme.description}</td>
                </tr>
                <tr>
                  <th scope="row">Contributing functions</th>
                  <td>{theme.contributingRoleIds.length}</td>
                  <th scope="row">Decisions on the thread</th>
                  <td>{visibleThreadDecisions.length}</td>
                </tr>
                <tr>
                  <th scope="row">Portfolio materiality</th>
                  <td>
                    {theme.materiality ? (
                      <Chip tone="cyan">{theme.materiality}</Chip>
                    ) : (
                      <Chip tone="amber">not decided</Chip>
                    )}
                  </td>
                  <th scope="row">Decided by</th>
                  <td>
                    {theme.materialityDecidedBy
                      ? (names.get(theme.materialityDecidedBy) ?? theme.materialityDecidedBy)
                      : "nobody yet"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </Section>

      {/* ---------------- The same matter, each function's question ---------------- */}
      <Section
        title="The same matter, through each function's question"
        note={`${lenses.length} lenses`}
      >
        {lenses.length === 0 ? (
          <Missing what="No function has a position on this matter at this moment." />
        ) : (
          <>
            <p style={{ fontSize: "var(--text-sm)" }}>
              None of these functions is asking the same question, which is why none of them reaches
              the same conclusion. Third-party risk asks whether the arrangement is still acceptable.
              Operational risk asks what the residual position now is. Control assurance asks whether
              the control operated. Resilience asks whether a tolerance was breached. Regulatory
              change asks what the obligation requires. The portfolio question is which of those
              answers the committee needs to see, and in what order.
            </p>
            <div className="stack stack-3">
              {lenses.map((lens) => (
                <div
                  key={lens.roleId}
                  className="card card-edge"
                  data-tone={
                    lens.positionStatus === "open"
                      ? "amber"
                      : lens.positionStatus === "escalated"
                        ? "red"
                        : lens.positionStatus === "decided"
                          ? "green"
                          : "neutral"
                  }
                >
                  <div className="stack stack-3">
                    <div className="row row-2 row-wrap row-between">
                      <div className="stack stack-1">
                        <span className="strong-text">{lens.roleTitle}</span>
                        {lens.holderLabel ? (
                          <span className="meta">{lens.holderLabel}</span>
                        ) : null}
                      </div>
                      <div className="row row-2 row-wrap">
                        {lens.positionStatus ? (
                          <Chip
                            tone={
                              lens.positionStatus === "open"
                                ? "amber"
                                : lens.positionStatus === "escalated"
                                  ? "red"
                                  : "green"
                            }
                          >
                            {lens.positionStatus}
                          </Chip>
                        ) : null}
                        {lens.producesSeparateReportToday ? (
                          <Chip tone="amber">own report today</Chip>
                        ) : null}
                        {lens.confidence !== null ? (
                          <ConfidenceMeter value={lens.confidence} label="confidence" />
                        ) : null}
                      </div>
                    </div>

                    <div className="stack stack-1">
                      <span className="label">The question this function asks</span>
                      <p style={{ fontSize: "var(--text-sm)" }}>{lens.question}</p>
                    </div>

                    <div className="stack stack-1">
                      <span className="label">The position prepared for it</span>
                      <p className="dim" style={{ fontSize: "var(--text-sm)" }}>
                        {lens.position}
                      </p>
                    </div>

                    <div className="row row-3 row-wrap">
                      {lens.decisionIds.map((id) => (
                        <Link
                          key={id}
                          href={`/workday/${lens.roleId}/decisions#${id}`}
                          className="chip"
                          data-tone="neutral"
                        >
                          <span className="mono">{id}</span>
                        </Link>
                      ))}
                      {(lens.evidenceRefs ?? []).slice(0, 4).map((id) => (
                        <span key={id} className="mono meta">
                          {id}
                        </span>
                      ))}
                    </div>

                    {lens.reportNameToday ? (
                      <span className="meta">
                        Reported separately today as: {lens.reportNameToday}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Section>

      {/* ---------------- The duplication, made explicit ---------------- */}
      <Section
        title="The duplicated reporting, stated as a number"
        note={theme ? `${theme.duplicateReportCount} separate reports on one matter` : "no theme"}
        tone={theme && theme.duplicateReportCount > 1 ? "red" : "green"}
      >
        {!theme ? (
          <Missing what="No theme, so no duplication to report." />
        ) : (
          <>
            <div className="row row-6 row-wrap">
              <Stat
                value={theme.duplicateReportCount}
                label="separate reports covering this matter today"
                tone="red"
              />
              <Stat value={lenses.length} label="functions contributing to it" tone="cyan" />
              <Stat
                value={lenses.filter((lens) => lens.producesSeparateReportToday).length}
                label="functions with their own committee item"
                tone="amber"
              />
              <Stat value={visibleThreadDecisions.length} label="decisions on one thread" tone="cyan" />
            </div>
            <p style={{ fontSize: "var(--text-sm)" }}>
              Today this matter reaches the committee {theme.duplicateReportCount} times, once per
              function, each time with its own narrative, its own evidence appendix and its own
              proposed action. None of those reports is wrong and none of them is redundant on its
              own terms, because each answers a different professional question. What is duplicated
              is the assembly: the same underlying facts are gathered, formatted and explained
              {theme.duplicateReportCount > 1 ? ` ${theme.duplicateReportCount} times` : ""}, and
              the committee is left to perform the consolidation that nobody did in advance.
            </p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Function</th>
                    <th scope="col">Its own committee item today</th>
                    <th scope="col">Decisions it owns on this thread</th>
                  </tr>
                </thead>
                <tbody>
                  {lenses.map((lens) => (
                    <tr key={lens.roleId}>
                      <td>{lens.roleTitle}</td>
                      <td>
                        {lens.reportNameToday ? (
                          lens.reportNameToday
                        ) : (
                          <span className="muted">none raised</span>
                        )}
                      </td>
                      <td>
                        {lens.decisionIds.length === 0 ? (
                          <span className="muted">none</span>
                        ) : (
                          lens.decisionIds.map((id) => (
                            <span key={id} className="mono meta" style={{ marginRight: 8 }}>
                              {id}
                            </span>
                          ))
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {themes.length > 1 ? (
          <details>
            <summary style={{ cursor: "pointer" }}>
              <span className="label">Other cross function themes ({themes.length - 1})</span>
            </summary>
            <div className="stack stack-2" style={{ marginTop: "var(--space-3)" }}>
              {themes.slice(1).map((row) => (
                <div key={row.id} className="card">
                  <div className="stack stack-1">
                    <span className="strong-text" style={{ fontSize: "var(--text-sm)" }}>
                      {row.title}
                    </span>
                    <span className="meta">
                      {row.contributingRoleIds.length} functions &middot;{" "}
                      {row.duplicateReportCount} separate reports &middot;{" "}
                      {row.materiality ?? "materiality not decided"}
                    </span>
                    <p className="dim" style={{ fontSize: "var(--text-sm)" }}>
                      {row.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </Section>

      {/* ---------------- Committee agenda ---------------- */}
      <Section
        title="Committee agenda"
        note={`${agendaItems.length} on the agenda, ${offAgenda.length} candidates not prioritised`}
        tone="accent"
      >
        {committee.length === 0 ? (
          <Missing what="No committee item exists in this run." />
        ) : (
          <>
            <p style={{ fontSize: "var(--text-sm)" }}>
              The agenda order is a judgment this role owns. An item is not on the agenda because it
              scored highly; it is on the agenda because the portfolio lead decided the committee
              needs to see it, in that position, ahead of the others.
            </p>
            {committeeRefs.map((ref) => {
              const items = committee.filter((item) => item.committeeRef === ref);
              const firstItem = items[0];
              return (
                <div key={ref} className="stack stack-2">
                  <div className="row row-3 row-wrap row-between">
                    <span className="label">
                      {firstItem?.committeeName ?? ref}
                      {firstItem ? (
                        <>
                          {" "}
                          &middot; {formatDateDach(firstItem.meetingDate)}
                        </>
                      ) : null}
                    </span>
                    <span className="mono meta">{ref}</span>
                  </div>
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th scope="col" className="num">
                            Position
                          </th>
                          <th scope="col">Item</th>
                          <th scope="col">Type</th>
                          <th scope="col">Raised by</th>
                          <th scope="col">On the agenda</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.id}>
                            <td className="num">
                              {item.agendaPosition !== null ? item.agendaPosition : "-"}
                            </td>
                            <td>
                              <div className="stack stack-1">
                                <span className="strong-text">{item.title}</span>
                                <span className="meta">{item.summary}</span>
                                {item.relatedObjectId ? (
                                  <ObjectId
                                    id={item.relatedObjectId}
                                    label={item.relatedObjectKind ?? "object"}
                                  />
                                ) : null}
                              </div>
                            </td>
                            <td>
                              <Chip
                                tone={
                                  item.itemType === "decision"
                                    ? "amber"
                                    : item.itemType === "escalation"
                                      ? "red"
                                      : "neutral"
                                }
                              >
                                {item.itemType}
                              </Chip>
                            </td>
                            <td>
                              {item.raisedByRoleId
                                ? (roleById.get(item.raisedByRoleId)?.title ??
                                  item.raisedByRoleId)
                                : "not recorded"}
                            </td>
                            <td>
                              <Chip tone={item.onAgenda ? "green" : "neutral"}>
                                {item.onAgenda ? "yes" : "candidate"}
                              </Chip>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </Section>
    </>
  );

  return {
    heading: matter ? matter.title : "Portfolio thread",
    standfirst: theme
      ? `${theme.description} Seen by ${lenses.length} functions, reported ${theme.duplicateReportCount} times today, carried on ${visibleThreadDecisions.length} decision(s) that are all about the same underlying matter.`
      : "No cross function theme is available in this run. The committee agenda is still shown.",
    badges: [
      { label: `${lenses.length} functions`, tone: "cyan" },
      {
        label: theme ? `${theme.duplicateReportCount} separate reports` : "no theme",
        tone: theme && theme.duplicateReportCount > 1 ? "red" : "neutral",
      },
      { label: `${agendaItems.length} on the agenda`, tone: "accent" },
      {
        label: theme?.materiality ? `materiality ${theme.materiality}` : "materiality not decided",
        tone: theme?.materiality ? "green" : "amber",
      },
    ],
    body,
    evidenceIds,
    whyThisMatters: [
      theme
        ? `One matter, ${theme.duplicateReportCount} reports. The consolidation is the value, and today it happens in the committee room rather than before it.`
        : "No theme is available, so the portfolio position cannot be assembled.",
      `${visibleThreadDecisions.filter((row) => row.status === "open").length} decision(s) on this thread are still open across the functions.`,
      "Portfolio materiality and agenda order are both this role's decisions. Neither is derived from a score.",
    ],
    uncertainty:
      theme && theme.materiality === null
        ? [
            {
              topic: "Portfolio materiality has not been decided",
              description:
                "Each function has a view on its own part of this matter. Nobody has yet taken a position on what the matter is worth at portfolio level, which is the decision that determines whether it reaches the committee as one item or as several.",
              kind: "judgment-required",
              resolutionPath:
                "This is resolved by the portfolio lead's judgment, not by more evidence.",
              materialToDecision: true,
              sourceIds: [theme.id],
            },
          ]
        : [],
    contextLabel: theme
      ? `Portfolio thread ${theme.title} at ${moment}: ${lenses.length} functions, ${visibleThreadDecisions.length} decisions, ${theme.duplicateReportCount} separate reports today, ${agendaItems.length} items on the committee agenda.`
      : `Portfolio workbench at ${moment}: no cross function theme available.`,
  };
}

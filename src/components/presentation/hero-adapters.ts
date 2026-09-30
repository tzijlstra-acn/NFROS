/**
 * Adapters from story content to hero visualisation props.
 *
 * The six hero visualisations in `src/components/visualisations/` own their
 * own prop shapes. The story owns the narrative. These functions are the only
 * place the two meet, so a change on either side surfaces here rather than
 * inside a scene.
 *
 * One discipline runs through the whole file. An adapter may reshape, classify
 * and compute from story data. It may not invent a fact. Where a hero prop
 * requires a value the story does not carry, the prop is left unset rather
 * than filled with something plausible, because a plausible invented figure on
 * a projected slide is the single worst failure mode this deck has.
 *
 * Two hero components are therefore not used anywhere in the deck:
 *
 *   PopulationField   requires `cases: PopulationCase[]`, one row per case,
 *                     with transaction references, dates and reviewers. The
 *                     story carries the population as four established facts
 *                     (1,204 items, sample of 60, four exceptions, two
 *                     unable to conclude) and no rows. Generating 1,204 rows
 *                     would put fabricated detail on screen.
 *
 *   ObligationLineage requires `paragraphReference` per obligation. The story
 *                     names two publications and four changed obligation
 *                     states in prose, with no paragraph references. Scene 13
 *                     therefore renders its two jurisdiction lanes natively.
 */

import type {
  ConstellationEdge,
  ConstellationNode,
  SupplierConstellationProps,
} from "@/components/visualisations/SupplierConstellation";
import type {
  ControlNodeView,
  IndicatorNodeView,
  ProcessNodeView,
  RiskControlGraphProps,
  RiskNodeView,
} from "@/components/visualisations/RiskControlGraph";
import type {
  DependencyEdgeView,
  DependencyKind,
  DependencyNodeView,
  ServiceDependencyMapProps,
  ToleranceMeasureView,
  ToleranceState,
} from "@/components/visualisations/ServiceDependencyMap";
import type {
  PortfolioLensView,
  PortfolioThreadProps,
} from "@/components/visualisations/PortfolioThread";
import type {
  ChangeSinceLastCycleContent,
  DualPositionMatrixContent,
  EventFanOutContent,
  LensSwitcherContent,
  PortfolioDecisionThreadContent,
  SixLensGridContent,
  SupplierExposureGraphContent,
  WorkshopTableContent,
} from "@/scenario/data/story";
import { clockSpan } from "./parts";

/* ==========================================================================
   Scene 7 and 8: supplier constellation
   ========================================================================== */

/**
 * The chain graph for TP-0042.
 *
 * Story rings map onto constellation rings as 1 to supplier, 2 to
 * subprocessor, 3 to fourth party. There is no story data for the
 * constellation's service ring, so that ring stays empty rather than being
 * populated from the `roleInChain` prose.
 *
 * `obligationSummary` is deliberately omitted. The story is explicit that the
 * fourth party is a drafting gap and not a breach, and that no notice on
 * record is evidence of absence rather than proof of absence, so no count of
 * breached obligations can be produced from it.
 */
export function constellationProps(
  content: SupplierExposureGraphContent,
): SupplierConstellationProps {
  const centre = content.nodes.find((node) => node.ring === 1);

  const nodes: ConstellationNode[] = content.nodes.map((node) => {
    const ring =
      node.ring === 1 ? "supplier" : node.ring === 2 ? "subprocessor" : "fourth-party";
    const declared =
      node.inBindingAppendix && node.inSupplierRegister
        ? "both"
        : node.inBindingAppendix
          ? "contract-appendix"
          : node.inSupplierRegister
            ? "supplier-submission"
            : undefined;

    const mapped: ConstellationNode = {
      id: node.id,
      ring,
      label: node.name,
      detail: node.roleInChain,
      criticality: node.ring === 1 ? "critical" : node.ring === 2 ? "important" : "standard",
      isDiscrepancy: node.divergence !== undefined,
      dataLocation: node.holdsPaymentData
        ? `${node.jurisdiction}. Holds or can read payment data.`
        : node.jurisdiction,
      supportsCriticalFunction: node.holdsPaymentData,
      // The 10:30 governance review sits before the 14:05 event, so no node
      // on this scene is event affected. The pulse must not fire early.
      affectedByEvent: false,
    };
    if (declared !== undefined) mapped.declaredIn = declared;
    if (node.divergence !== undefined) mapped.discrepancyNote = node.divergence;
    // Sole provider across all three services, per the concentration
    // statement. That is the one recorded single point of failure here.
    if (node.ring === 1) mapped.singlePointOfFailure = true;
    return mapped;
  });

  const edges: ConstellationEdge[] = [];
  if (centre !== undefined) {
    for (const node of content.nodes) {
      if (node.ring === 2) {
        edges.push({
          id: `${centre.id}--${node.id}`,
          from: centre.id,
          to: node.id,
          strength: "critical",
          note: node.roleInChain,
        });
      }
      if (node.ring === 3) {
        // A fourth party id encodes its parent, for example TP-0042.3-F1
        // hangs off TP-0042.3. The parent is read rather than guessed.
        const parent = node.id.replace(/-F\d+$/, "");
        const exists = content.nodes.some((candidate) => candidate.id === parent);
        edges.push({
          id: `${exists ? parent : centre.id}--${node.id}`,
          from: exists ? parent : centre.id,
          to: node.id,
          strength: "supporting",
          note: node.roleInChain,
        });
      }
    }
  }

  return {
    supplier: {
      id: content.supplierId,
      name: content.supplierName,
      criticality: content.criticality,
      domicile: centre?.jurisdiction ?? "Not recorded",
      isOutsourcing: true,
      concentrationNote: content.concentrationStatement,
    },
    nodes,
    edges,
    eventMoment: "14:05",
    heading: "Supplier dependency and chain, three rings deep",
  };
}

/* ==========================================================================
   Scene 8: the morph target
   ========================================================================== */

/**
 * The process, risk and control graph the supplier chain morphs into.
 *
 * Scene 8 carries the morph but not the risk data, because the objects belong
 * to the receiving role. The graph is therefore assembled from the scenes that
 * own those objects: the dual position matrix for the risk and the appetite
 * boundary, the workshop table for the control characterisations, and the
 * change list for the process context.
 *
 * Every label below is a quotation from story content. The three control
 * titles are the story's own characterisations of those controls, used as
 * titles rather than replaced by invented control names.
 */
export function riskControlProps(
  matrix: DualPositionMatrixContent,
  workshop: WorkshopTableContent,
  cycle: ChangeSinceLastCycleContent,
  lenses: LensSwitcherContent,
): RiskControlGraphProps {
  const overrideChange = cycle.changes.find((change) => change.id === "chg-override-components");
  const firstLine = matrix.positions.find((position) => position.label.includes("1LoD"));
  const secondLine = matrix.positions.find((position) => position.label.includes("2LoD"));

  const processes: ProcessNodeView[] = [
    {
      id: "PRC-0041",
      label: "Manual payment override and repair",
      code: "PRC-0041",
      ...(overrideChange !== undefined ? { detail: overrideChange.currentState } : {}),
      riskIds: [matrix.riskId],
    },
  ];

  const risk: RiskNodeView = {
    id: matrix.riskId,
    label: matrix.riskLabel,
    taxonomyL2: matrix.riskLabelDe,
    ownerLabel: cycle.assessmentOwner,
    inherentScore: matrix.inherent.score,
    appetiteCeilingScore: matrix.appetiteBoundary.threshold,
    appetiteStatement: matrix.appetiteBoundary.policySentence,
  };
  if (firstLine !== undefined) {
    risk.firstLine = {
      lineLabel: "1LoD",
      score: firstLine.score,
      ownerLabel: firstLine.holder,
      rationale: firstLine.consequence,
    };
  }
  if (secondLine !== undefined) {
    risk.secondLine = {
      lineLabel: "2LoD",
      score: secondLine.score,
      ownerLabel: secondLine.holder,
      rationale: secondLine.consequence,
    };
  }

  // CTL-PAY-014's title is the control assurance lens's primary object, with
  // the reference stripped. The other two carry the story's characterisation.
  const assuranceLens = lenses.lenses.find((lens) => lens.roleSlug === "control-assurance");
  const keyControlTitle =
    assuranceLens?.primaryObject.replace(/^CTL-PAY-014\s*/, "") ??
    "Independent secondary review of manual payment overrides";

  const controls: ControlNodeView[] = [
    {
      id: "CTL-PAY-014",
      reference: "CTL-PAY-014",
      title: keyControlTitle,
      riskIds: [matrix.riskId],
      ownerLabel: "Beatrix Hofmann, Payment Repair Team Lead",
      isKeyControl: true,
      nature: "Preventive",
      automation: "Manual, in the repair workbench",
      /*
       * The two positions in dispute at 10:30, which is where this scene sits.
       *
       * `firstLineEffectiveness` is the control owner's own assertion, which
       * the scenario fixes as fully effective ("Voll wirksam" on the first
       * line form) and which the register still carries at this point in the
       * day. `currentEffectiveness` carries the second line pre-read of
       * 02.10.2026, partially effective, which is the conclusion the 11:45
       * decision either confirms or sets aside.
       *
       * An earlier version had the first line at largely effective, which
       * contradicted both the scenario record and the seeded control row. The
       * whole point of the scene is that the two lines disagree about the same
       * control, so getting either value wrong removes the disagreement.
       */
      currentEffectiveness: "partially-effective",
      firstLineEffectiveness: "fully-effective",
      firstLineOwnerLabel: "Beatrix Hofmann, 1LoD control owner",
      secondLineOwnerLabel: "Jakob Steinbacher, Control Assurance",
      lastTestedOn: "25.09.2026",
      evidenceRef: "TST-2026-0318",
    },
    {
      id: "CTL-PAY-021",
      reference: "CTL-PAY-021",
      title: "Next day sampling by the Duty Manager",
      riskIds: [matrix.riskId],
      ownerLabel: "Elif Demir, acting Duty Manager",
      // A scenario figure, measured in this simulation, quoted from the
      // story's own characterisation of this control.
      nature: "Detective, next business day, 10 percent sampled",
      currentEffectiveness: "not-assessed",
      evidenceRef: "Control description, parsed and characterised",
    },
    {
      id: "CTL-PAY-029",
      reference: "CTL-PAY-029",
      title: "Daily payment value reconciliation",
      riskIds: [matrix.riskId],
      nature: "Detective, reconciles value rather than authorisation",
      currentEffectiveness: "not-assessed",
      evidenceRef: "Control description, parsed and characterised",
    },
  ];

  const indicators: IndicatorNodeView[] = [
    {
      id: "KRI-PAY-007",
      reference: "KRI-PAY-007",
      name: "Manual override rate",
      riskIds: [matrix.riskId],
      status: "red",
      currentValue: 3.84,
      unit: "per 10,000",
      redThreshold: 3.5,
    },
    {
      id: "KRI-PAY-011",
      reference: "KRI-PAY-011",
      name: "Secondary reviewer capacity",
      riskIds: [matrix.riskId],
      status: "red",
      currentValue: 75,
      unit: "percent of approved establishment",
    },
  ];

  // The workshop's fourth established fact is the control mapping statement.
  // It is surfaced through the heading, so the graph carries its own source.
  const mappingFact = workshop.establishedFacts[3];

  return {
    processes,
    risks: [risk],
    controls,
    indicators,
    heading:
      mappingFact === undefined
        ? "Process, risk and control"
        : "Process, risk and control. One preventive control, two detective.",
  };
}

/* ==========================================================================
   Scene 12: service dependency and impact tolerance
   ========================================================================== */

/** Object reference prefixes to dependency lanes. Anything else is excluded. */
function dependencyKindOf(objectRef: string): DependencyKind | null {
  if (objectRef.startsWith("IBS-")) return "service";
  if (objectRef.startsWith("SYS-") || objectRef.startsWith("PRC-") || objectRef.startsWith("SVC-")) {
    return "system";
  }
  if (/^TP-\d+\.\d/.test(objectRef)) return "subprocessor";
  if (/^TP-\d+$/.test(objectRef)) return "supplier";
  return null;
}

function toleranceStateFor(consumed: number, threshold: number): ToleranceState {
  if (consumed > threshold) return "breached";
  const remaining = threshold - consumed;
  if (remaining <= threshold * 0.05) return "at-threshold";
  if (remaining <= threshold * 0.25) return "approaching";
  return "within";
}

/**
 * The dependency map under tolerance pressure.
 *
 * Nodes are the objects the event's own arrivals touched, classified by
 * object reference prefix, so the map is a record of what the event reached
 * rather than a drawing of what the architecture might look like. Names come
 * from the supplier chain scene where that scene names the same object, and
 * otherwise the object reference is the label.
 *
 * Tolerances are computed from the entity lanes: the threshold is the span
 * from the disruption start to the stated tolerance limit, and the consumed
 * figure is the span from the disruption start to the arrival the presenter
 * has reached. That is what makes the pressure build as the scene runs
 * rather than being asserted at the end.
 *
 * The Swiss lane contributes two measures, because the record states two and
 * sets no precedence between them. Collapsing them into one would hide the
 * most valuable finding of the day.
 */
export function dependencyProps(
  content: EventFanOutContent,
  cursorClock: string,
  supplierNames: ReadonlyMap<string, string>,
): ServiceDependencyMapProps {
  const firstTouch = new Map<string, string>();
  for (const arrival of content.arrivals) {
    for (const objectRef of arrival.objectsTouched) {
      if (!firstTouch.has(objectRef)) firstTouch.set(objectRef, arrival.timeLabel);
    }
  }

  const nodes: DependencyNodeView[] = [];
  for (const [objectRef, timeLabel] of firstTouch) {
    const kind = dependencyKindOf(objectRef);
    if (kind === null) continue;
    const name = supplierNames.get(objectRef);
    nodes.push({
      id: objectRef,
      kind,
      label: name === undefined ? objectRef : `${objectRef} ${name}`,
      detail: `First touched by an arrival at ${timeLabel}.`,
      operationalStatus: "impaired",
      isImportantBusinessService: kind === "service",
      affectedByEvent: true,
      failedAtMoment: timeLabel,
    });
  }
  nodes.sort((a, b) => a.id.localeCompare(b.id));

  const byKind = (kind: DependencyKind) => nodes.filter((node) => node.kind === kind);
  const edges: DependencyEdgeView[] = [];
  const link = (from: DependencyNodeView[], to: DependencyNodeView[], strength: "critical" | "important" | "supporting") => {
    for (const a of from) {
      for (const b of to) {
        edges.push({
          id: `${a.id}--${b.id}`,
          from: a.id,
          to: b.id,
          strength,
          affectedByEvent: true,
        });
      }
    }
  };
  link(byKind("service"), byKind("system"), "critical");
  link(byKind("system"), byKind("supplier"), "critical");
  link(byKind("supplier"), byKind("subprocessor"), "important");

  const serviceNode = byKind("service")[0];
  const serviceId = serviceNode?.id ?? nodes[0]?.id ?? "IBS-0004";

  const tolerances: ToleranceMeasureView[] = [];
  for (const lane of content.entityLanes) {
    const threshold = clockSpan(lane.disruptionStart, lane.toleranceLimit);
    const elapsed = clockSpan(lane.disruptionStart, cursorClock);
    if (threshold === null || threshold <= 0) continue;
    const consumed = Math.max(0, elapsed ?? 0);
    tolerances.push({
      id: `${lane.entityCode}-${lane.toleranceId}-elapsed`,
      serviceId,
      serviceLabel: serviceId,
      entityLabel: lane.entityLabel,
      frameworkLabel: lane.frameworkContext,
      metric: "Elapsed disruption against the maximum tolerable period",
      unit: "minutes",
      thresholdValue: threshold,
      consumedValue: consumed,
      state: toleranceStateFor(consumed, threshold),
      statement: lane.toleranceStatement,
      note: `Fallback: ${lane.fallbackOption} ${lane.fallbackLeadTime}`,
    });

    if (lane.cutOff !== undefined) {
      const cutThreshold = clockSpan(lane.disruptionStart, lane.cutOff);
      if (cutThreshold !== null && cutThreshold > 0) {
        tolerances.push({
          id: `${lane.entityCode}-${lane.toleranceId}-cutoff`,
          serviceId,
          serviceLabel: serviceId,
          entityLabel: lane.entityLabel,
          frameworkLabel: lane.frameworkContext,
          metric: `Submission completed before the ${lane.cutOff} same day cut off`,
          unit: "minutes",
          thresholdValue: cutThreshold,
          consumedValue: consumed,
          state: toleranceStateFor(consumed, cutThreshold),
          statement: lane.toleranceStatement,
          ...(lane.runway !== undefined ? { note: `Runway ${lane.runway}.` } : {}),
        });
      }
    }
  }

  return {
    nodes,
    edges,
    tolerances,
    eventMoment: content.arrivals[0]?.timeLabel ?? "14:05",
    precedenceNote:
      "Two measures of one tolerance, and the record sets no precedence between them. The question is open, it has a named owner and it has a committee destination.",
    heading: `${content.incidentId}. Dependency reached by the event, and consumed tolerance per entity.`,
  };
}

/* ==========================================================================
   Scene 14: six lenses consolidating into one thread
   ========================================================================== */

/** Object references inside a prose sentence, in the order they appear. */
export function extractObjectRefs(text: string): string[] {
  const matches = text.match(/\b[A-Z]{2,}(?:-[A-Z0-9]{2,})+\b/g);
  if (matches === null) return [];
  return Array.from(new Set(matches));
}

/**
 * The consolidation view: the six readings of scene 13 resolving into the one
 * thread of scene 14.
 *
 * Role titles come from the lens switcher, which is the scene that owns them.
 * Position status is derived rather than assigned: the role named as the owner
 * of the one unresolved conflict reads as open, and the other five read as
 * decided, because each of them names a record it owns.
 *
 * `materiality` stays null. Portfolio materiality is a human judgment and no
 * scene in the story records one, so the field is left for a person.
 */
export function portfolioThreadProps(
  grid: SixLensGridContent,
  thread: PortfolioDecisionThreadContent,
  lenses: LensSwitcherContent,
): PortfolioThreadProps {
  const roleTitle = new Map(lenses.lenses.map((lens) => [lens.roleSlug, lens.roleLabel]));
  const openOwners = grid.conflictUnresolved.owner;

  const mapped: PortfolioLensView[] = grid.lenses.map((lens) => {
    const person = lens.person;
    const isOpen = openOwners.includes(person);
    const view: PortfolioLensView = {
      roleId: lens.roleSlug,
      roleTitle: roleTitle.get(lens.roleSlug) ?? lens.roleSlug,
      holderLabel: person,
      question: lens.question,
      position: lens.output,
      positionStatus: isOpen ? "open" : "decided",
      confidence: null,
      decisionIds: extractObjectRefs(lens.ownedRecord),
      producesSeparateReportToday: true,
    };
    return view;
  });

  return {
    matter: {
      id: thread.decision.id,
      title: grid.sharedEvent,
      description: thread.constraint.problem,
      detectedAtMoment: "14:05",
      entityLabels: ["Arcadia Bank AG", "Arcadia Bank Oesterreich AG", "Arcadia Bank Schweiz AG"],
      duplicateReportCount: grid.lenses.length,
      materiality: null,
      materialityDecidedBy: null,
    },
    lenses: mapped,
    threadDecisionIds: [thread.decision.id],
    heading: "Six professional readings, one leadership thread",
  };
}

/** Object reference to name, for the objects the supplier chain scene names. */
export function supplierNameMap(content: SupplierExposureGraphContent): Map<string, string> {
  return new Map(content.nodes.map((node) => [node.id, node.name]));
}

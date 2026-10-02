"use client";

/**
 * The Incident and Resilience Lead's workspace.
 *
 * The hero is the service dependency map, and the pulse on it is a claim
 * rather than decoration: only nodes and edges the data marks as carrying the
 * event animate, so the animation is the propagation path. The chronology, the
 * remaining tolerance and the prepared recovery options sit around it in that
 * order, which is the order a lead actually needs them in while a service is
 * degraded.
 *
 * Two deliberate restraints. The chronology shows each entry's provenance,
 * because a supplier's statement and a telemetry reading are not the same kind
 * of fact and this is the role where confusing them does the most damage; and
 * conflicting entries are marked rather than resolved, because resolving them
 * is a judgment and nothing here is entitled to make it.
 *
 * The material decision is exposed, not acted on. Pausing the live player at
 * it belongs to the player; a workspace that also paused would fight it.
 */

import dynamic from "next/dynamic";
import { useCallback } from "react";
import { IconAlertTriangle, IconSparkles } from "@tabler/icons-react";
import {
  Card,
  Chip,
  Data,
  Empty,
  Item,
  List,
  ObjectRef,
  SectionHead,
  SkeletonRows,
  type Tone,
} from "../primitives";
import { PROVENANCE_LABELS, t } from "@/i18n/labels";
import { useAskAi, useSelection } from "../SelectionProvider";
import { narrowView, ws, WS_INCIDENT, WS_SHARED } from "./labels";
import type { RoleWorkspaceProps } from "./index";

const ServiceDependencyMap = dynamic(
  () =>
    import("@/components/visualisations/ServiceDependencyMap").then((m) => m.ServiceDependencyMap),
  { ssr: false, loading: () => <SkeletonRows rows={5} large /> },
);

/** Tolerance pressure, toned by state rather than by a computed percentage. */
const TOLERANCE_TONE: Record<string, Tone> = {
  within: "success",
  approaching: "warning",
  "at-threshold": "warning",
  breached: "danger",
};

export function IncidentResilienceWorkspace(props: RoleWorkspaceProps) {
  const { language, currentMoment, compact = false } = props;
  const selectionState = useSelection();
  const contextAsk = useAskAi();
  const view = narrowView(props.view, "incident-resilience");

  const selection = props.selection ?? selectionState.selection;
  const setSelection = props.onSelect ?? selectionState.setSelection;
  const ask = props.onAskAi ?? contextAsk;

  const onSelectNode = useCallback(
    (nodeId: string) => {
      const entry = view?.selectable[nodeId];
      if (!entry) {
        setSelection(null);
        return;
      }
      setSelection({
        objectType: entry.objectType,
        objectId: entry.objectId,
        label: entry.label,
      });
    },
    [view, setSelection],
  );

  if (!view || view.incident === null) {
    return (
      <Empty
        title={ws(WS_SHARED.unavailable, language)}
        detail={ws(WS_SHARED.unavailableDetail, language)}
      />
    );
  }

  const changedIds = props.changedObjectIds ?? view.changedIds;
  const incident = view.incident;

  return (
    <div className="app-stack-6">
      <header className="app-workspace-head">
        <span className="app-eyebrow">
          <Data>{currentMoment}</Data>
          <span className="app-faint">{ws(WS_INCIDENT.map, language)}</span>
          <Chip tone="danger">{incident.severity ?? incident.proposedSeverity ?? "unset"}</Chip>
          <Chip>{incident.status}</Chip>
        </span>
        <h2 className="app-object-title">{incident.title}</h2>
      </header>

      <ServiceDependencyMap
        nodes={view.nodes}
        edges={view.edges}
        tolerances={view.tolerances}
        eventMoment={view.eventMoment}
        selectedNodeId={selection?.objectId ?? null}
        onSelectNode={onSelectNode}
        changedNodeIds={changedIds}
        changedLabel={ws(WS_SHARED.changedRecently, language)}
        /*
         * The pressure bars are repeated as rows below in the compact layout,
         * so the figure drops them there. Carrying four measures twice inside
         * a narrow column made the figure taller than the column.
         */
        showTolerancePressure={!compact}
        {...(view.precedenceNote !== null ? { precedenceNote: view.precedenceNote } : {})}
        heading={`${incident.reference} ${incident.title}`}
      />

      {/*
        * A card, for a critical event: one of the four permitted cases. It
        * carries the decision the event forces and nothing else, so the ask is
        * unmissable without the card having to be large.
        */}
      {view.materialDecisionId !== null ? (
        <Card accent="danger" label={ws(WS_INCIDENT.decision, language)}>
          <div className="app-stack-2">
            <span className="app-eyebrow">
              <IconAlertTriangle size={12} stroke={2} aria-hidden="true" />
              {ws(WS_INCIDENT.decision, language)}
              <ObjectRef id={view.materialDecisionId} label="decision" />
            </span>
            <div className="app-row app-row-3 app-row-wrap">
              <a
                className="app-btn app-btn-primary"
                href={`/workday/incident-resilience/decisions#${view.materialDecisionId}`}
              >
                {ws(WS_INCIDENT.openDecision, language)}
              </a>
              <button
                type="button"
                className="app-btn app-btn-quiet app-btn-sm"
                onClick={() =>
                  ask(ws(WS_INCIDENT.askPrompt, language), selection ?? {
                    objectType: "incident",
                    objectId: incident.id,
                    label: incident.reference,
                  })
                }
              >
                <IconSparkles size={13} stroke={1.8} aria-hidden="true" />
                {ws(WS_SHARED.askAboutThis, language)}
              </button>
            </div>
          </div>
        </Card>
      ) : null}

      {/* ---- The event path, in recorded order ---- */}
      <section className="app-section">
        <SectionHead title={ws(WS_INCIDENT.pulse, language)} count={view.propagation.length} />
        {view.propagation.length === 0 ? (
          <Empty title={ws(WS_INCIDENT.noPulse, language)} />
        ) : (
          <List label={ws(WS_INCIDENT.pulse, language)}>
            {view.propagation.map((step) => (
              <Item
                key={`${step.fromId}-${step.toId}`}
                changed={changedIds.includes(step.toId)}
                selected={selection?.objectId === step.toId}
                leading={<Data>{step.order + 1}</Data>}
                title={step.toLabel}
                subtitle={
                  <>
                    <ObjectRef id={step.toId} label="reached" />
                    <span className="app-faint"> {step.fromLabel}</span>
                  </>
                }
                trailing={
                  <>
                    <Chip tone={step.strength === "critical" ? "danger" : "neutral"}>
                      {step.strength}
                    </Chip>
                    {step.singlePointOfFailure ? <Chip tone="danger">single point</Chip> : null}
                  </>
                }
              />
            ))}
          </List>
        )}
      </section>

      {/* ---- Remaining tolerance ---- */}
      <section className="app-section">
        <SectionHead title={ws(WS_INCIDENT.tolerance, language)} count={view.tolerances.length} />
        {view.tolerances.length === 0 ? (
          <Empty title={ws(WS_INCIDENT.noTolerance, language)} />
        ) : (
          <List label={ws(WS_INCIDENT.tolerance, language)}>
            {view.tolerances.map((measure) => (
              <Item
                key={measure.id}
                large
                selected={selection?.objectId === measure.serviceId}
                title={measure.metric}
                subtitle={
                  <>
                    <ObjectRef id={measure.serviceId} label="service" />
                    {/*
                      * The entity label is never blurred across jurisdictions:
                      * a tolerance approved for one entity says so, because a
                      * measure read against the wrong entity is meaningless.
                      */}
                    <span className="app-faint"> {measure.entityLabel}</span>
                  </>
                }
                trailing={
                  <>
                    <Data size="sm">
                      {measure.consumedValue} / {measure.thresholdValue} {measure.unit}
                    </Data>
                    <Chip tone={TOLERANCE_TONE[measure.state] ?? "neutral"}>{measure.state}</Chip>
                  </>
                }
              />
            ))}
          </List>
        )}
      </section>

      {/* ---- Prepared options ---- */}
      <section className="app-section">
        <SectionHead title={ws(WS_INCIDENT.options, language)} count={view.options.length} />
        {view.options.length === 0 ? (
          <Empty title={ws(WS_INCIDENT.noOptions, language)} />
        ) : (
          <List label={ws(WS_INCIDENT.options, language)}>
            {view.options.map((option) => (
              <Item
                key={option.id}
                large
                selected={option.selected}
                title={option.name}
                subtitle={
                  <span className="app-faint">
                    {ws(WS_INCIDENT.tradeOff, language)}: {option.controlTradeOff}
                  </span>
                }
                trailing={
                  <>
                    <Data size="sm">
                      {option.minutesToRestore} {ws(WS_INCIDENT.minutes, language)}
                    </Data>
                    <Chip
                      tone={
                        option.availability === "available"
                          ? "success"
                          : option.availability === "requires-approval"
                            ? "warning"
                            : "danger"
                      }
                    >
                      {option.availability}
                    </Chip>
                  </>
                }
              />
            ))}
          </List>
        )}
      </section>

      {/* ---- The chronology, with provenance kept visible ---- */}
      {compact ? null : (
        <section className="app-section">
          <SectionHead title={ws(WS_INCIDENT.chronology, language)} count={view.chronology.length} />
          <List label={ws(WS_INCIDENT.chronology, language)}>
            {view.chronology.map((entry) => (
              <Item
                key={entry.id}
                large
                leading={<Data>{entry.atMoment}</Data>}
                title={entry.statement}
                subtitle={
                  <>
                    <span className="app-faint">{entry.sourceLabel}</span>
                    <span className="app-faint"> {entry.channel}</span>
                  </>
                }
                trailing={
                  <>
                    <Chip
                      tone={
                        entry.provenance === "verified-fact"
                          ? "success"
                          : entry.provenance === "stakeholder-statement"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {t(PROVENANCE_LABELS, entry.provenance, language)}
                    </Chip>
                    {entry.conflictsWithId !== null ? (
                      <Chip tone="danger">{ws(WS_INCIDENT.conflicts, language)}</Chip>
                    ) : null}
                    {entry.evidenceIds.length > 0 ? (
                      <Chip count>{entry.evidenceIds.length}</Chip>
                    ) : null}
                  </>
                }
              />
            ))}
          </List>
        </section>
      )}
    </div>
  );
}

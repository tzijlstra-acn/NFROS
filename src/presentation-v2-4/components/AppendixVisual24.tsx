"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  IconArrowRight,
  IconCheck,
  IconFileCheck,
  IconPhotoOff,
  IconRobot,
  IconServer,
  IconShieldCheck,
  IconUser,
  IconPlugConnected,
  IconSend,
} from "@tabler/icons-react";
import type { AppendixTableRow, AppendixVisual } from "../data/types";
import { StatusBadge, levelFromText } from "./StatusBadge24";

// Every visual is laid out on the 1920 x 780 stage; text is never below 16 stage pixels.

type Visual<T extends AppendixVisual["type"]> = Extract<AppendixVisual, { type: T }>;

function textSizeForRows(rows: number): number {
  if (rows <= 5) return 22;
  if (rows <= 7) return 20;
  if (rows <= 9) return 18;
  return 16;
}

// ---------------------------------------------------------------------------
// Tables: status-table and authority-matrix share one grid renderer
// ---------------------------------------------------------------------------

type CellRenderer = (column: string, value: string, columnIndex: number) => ReactNode;

function columnTemplate(columns: string[], rows: AppendixTableRow[], fixed: (c: string) => number | null): string {
  return columns
    .map((c) => {
      const px = fixed(c);
      if (px !== null) return `${px}px`;
      const longest = Math.max(c.length, ...rows.map((r) => (r[c] ?? "").length));
      return `minmax(0, ${Math.max(10, Math.min(longest, 60))}fr)`;
    })
    .join(" ");
}

function GridTable({
  columns,
  rows,
  renderCell,
  fixedWidth,
}: {
  columns: string[];
  rows: AppendixTableRow[];
  renderCell: CellRenderer;
  fixedWidth: (column: string) => number | null;
}) {
  const fontSize = textSizeForRows(rows.length);
  const template = columnTemplate(columns, rows, fixedWidth);
  return (
    <div className="pv24-av-table" role="table">
      <div className="pv24-av-table__row pv24-av-table__row--head" role="row" style={{ gridTemplateColumns: template }}>
        {columns.map((c) => (
          <div key={c} className="pv24-av-table__th" role="columnheader">
            {c}
          </div>
        ))}
      </div>
      {rows.map((row, ri) => (
        <div key={ri} className="pv24-av-table__row" role="row" style={{ gridTemplateColumns: template, fontSize }}>
          {columns.map((c, ci) => (
            <div key={c} className={ci === 0 ? "pv24-av-table__td pv24-av-table__td--lead" : "pv24-av-table__td"} role="cell">
              {renderCell(c, row[c] ?? "", ci)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const isStatusColumn = (c: string) => /status/i.test(c);

function StatusTable({ visual }: { visual: Visual<"status-table"> }) {
  const statusColumn = visual.columns.find(isStatusColumn);
  const longest = statusColumn ? Math.max(0, ...visual.rows.map((r) => (r[statusColumn] ?? "").length)) : 0;
  // Badge text is 16px uppercase mono: about 12px per character plus icon, padding and cell padding
  const statusWidth = Math.min(400, Math.max(200, 80 + longest * 12));
  return (
    <GridTable
      columns={visual.columns}
      rows={visual.rows}
      fixedWidth={(c) => (isStatusColumn(c) ? statusWidth : null)}
      renderCell={(c, value) => (isStatusColumn(c) && value ? <StatusBadge level={levelFromText(value)} text={value} /> : value)}
    />
  );
}

function actorOf(value: string): "human" | "ai" | "system" | null {
  const v = value.toLowerCase();
  if (/^human|professional|named/.test(v)) return "human";
  if (/^ai\b|^ai,/.test(v)) return "ai";
  if (/^system/.test(v)) return "system";
  return null;
}

const ACTOR_ICON = { human: IconUser, ai: IconRobot, system: IconServer } as const;

function AuthorityTable({ visual }: { visual: Visual<"authority-matrix"> }) {
  return (
    <GridTable
      columns={visual.columns}
      rows={visual.rows}
      fixedWidth={() => null}
      renderCell={(_c, value, ci) => {
        if (ci === 0) return value;
        const actor = actorOf(value);
        if (actor) {
          const Icon = ACTOR_ICON[actor];
          return (
            <span className={`pv24-av-actor pv24-av-actor--${actor}`}>
              <Icon size={20} stroke={1.8} aria-hidden="true" />
              {value}
            </span>
          );
        }
        if (/^yes/i.test(value)) {
          return (
            <span className="pv24-av-yes">
              <IconCheck size={20} stroke={2.2} aria-hidden="true" />
              {value}
            </span>
          );
        }
        if (/^no$/i.test(value)) return <span className="pv24-av-muted">{value}</span>;
        return value;
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Capability map
// ---------------------------------------------------------------------------

function CapabilityMap({ visual }: { visual: Visual<"capability-map"> }) {
  const most = Math.max(1, ...visual.groups.map((g) => g.items.length));
  const dense = most > 6;
  return (
    <div className="pv24-av-columns" style={{ gridTemplateColumns: `repeat(${Math.max(1, visual.groups.length)}, minmax(0, 1fr))` }}>
      {visual.groups.map((group) => (
        <section key={group.name} className={`pv24-av-col pv24-av-col--${levelFromText(group.name)}`}>
          <header className="pv24-av-col__head">
            <span className="pv24-av-col__title">{group.name}</span>
            <span className="pv24-av-col__count">{group.items.length}</span>
          </header>
          <div className="pv24-av-col__body" style={{ gap: dense ? 8 : 12 }}>
            {group.items.map((item) => (
              <div key={item.label} className="pv24-av-card pv24-av-card--row" style={{ padding: dense ? "10px 16px" : "16px 20px" }}>
                <span className="pv24-av-card__label" style={{ fontSize: dense ? 18 : 20 }}>
                  {item.label}
                </span>
                <StatusBadge level={levelFromText(item.status)} text={item.status} size="sm" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Process matrix: stages across, AI / human / system tracks down
// ---------------------------------------------------------------------------

type TrackKind = "human" | "ai" | "system" | "record";

function trackKind(track: string): TrackKind {
  const t = track.toLowerCase();
  if (/human|decid|approv|professional|judg/.test(t)) return "human";
  if (/\bai\b|prepar|draft|agent/.test(t)) return "ai";
  if (/record|outcome|output|evidence|audit/.test(t)) return "record";
  return "system";
}

const TRACK_ICON = { ...ACTOR_ICON, record: IconFileCheck } as const;

function ProcessMatrix({ visual }: { visual: Visual<"process-matrix"> }) {
  const template = `200px repeat(${Math.max(1, visual.stages.length)}, minmax(0, 1fr))`;
  const fontSize = visual.stages.length > 8 ? 16 : 18;
  return (
    <div className="pv24-av-matrix" style={{ gridTemplateColumns: template, gridTemplateRows: `auto repeat(${visual.tracks.length}, minmax(0, 1fr))` }}>
      <div />
      {visual.stages.map((stage, i) => (
        <div key={stage} className="pv24-av-matrix__stage">
          <span className="pv24-av-matrix__num">{String(i + 1).padStart(2, "0")}</span>
          <span className="pv24-av-matrix__stage-name">{stage}</span>
        </div>
      ))}
      {visual.tracks.map((track) => {
        const kind = trackKind(track);
        const Icon = TRACK_ICON[kind];
        return [
          <div key={`${track}-label`} className={`pv24-av-matrix__track pv24-av-matrix__track--${kind}`}>
            <Icon size={24} stroke={1.8} aria-hidden="true" />
            <span>{track}</span>
          </div>,
          ...visual.stages.map((stage) => (
            <div key={`${track}-${stage}`} className={`pv24-av-matrix__cell pv24-av-matrix__cell--${kind}`} style={{ fontSize }}>
              {visual.cells[`${stage}_${track}`] ?? ""}
            </div>
          )),
        ];
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Text columns
// ---------------------------------------------------------------------------

function TextColumns({ visual }: { visual: Visual<"text-columns"> }) {
  const most = Math.max(1, ...visual.columns.map((c) => c.items.length));
  const itemSize = visual.columns.length >= 4 || most > 6 ? 18 : visual.columns.length <= 3 && most <= 5 ? 22 : 20;
  return (
    <div className="pv24-av-columns" style={{ gridTemplateColumns: `repeat(${Math.max(1, visual.columns.length)}, minmax(0, 1fr))` }}>
      {visual.columns.map((col) => (
        <section key={col.heading} className="pv24-av-textcol">
          <h3 className="pv24-av-textcol__head">{col.heading}</h3>
          <ul className="pv24-av-list" style={{ fontSize: itemSize }}>
            {col.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Architecture layers
// ---------------------------------------------------------------------------

const LAYER_TONES = ["pv24-av-layer--1", "pv24-av-layer--2", "pv24-av-layer--3", "pv24-av-layer--4"];

function ArchitectureLayers({ visual }: { visual: Visual<"architecture-layers"> }) {
  return (
    <div className="pv24-av-layers" style={{ gridTemplateRows: `repeat(${Math.max(1, visual.layers.length)}, minmax(0, 1fr))` }}>
      {visual.layers.map((layer, i) => (
        <div key={layer.name} className={`pv24-av-layer ${LAYER_TONES[Math.min(i, LAYER_TONES.length - 1)] ?? ""}`}>
          <div className="pv24-av-layer__name">{layer.name}</div>
          <div className="pv24-av-layer__items">
            {layer.items.map((item) => (
              <span key={item} className="pv24-av-chip">
                {item}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Service stack
// ---------------------------------------------------------------------------

function tierTone(semanticType: string): string {
  if (/managed/.test(semanticType)) return "managed";
  if (/app/.test(semanticType)) return "app";
  if (/function/.test(semanticType)) return "function";
  return "platform";
}

function ServiceStack({ visual }: { visual: Visual<"service-stack"> }) {
  return (
    <div className="pv24-av-stack" style={{ gridTemplateRows: `repeat(${Math.max(1, visual.tiers.length)}, minmax(0, 1fr))` }}>
      {visual.tiers.map((tier) => (
        <div key={tier.name} className={`pv24-av-tier pv24-av-tier--${tierTone(tier.semanticType)}`}>
          <div className="pv24-av-tier__name">{tier.name}</div>
          <div className="pv24-av-tier__detail">{tier.detail}</div>
          <div className="pv24-av-tier__cadence">{tier.cadence}</div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Measurement framework
// ---------------------------------------------------------------------------

function MeasurementFramework({ visual }: { visual: Visual<"measurement-framework"> }) {
  return (
    <div className="pv24-av-columns" style={{ gridTemplateColumns: `repeat(${Math.max(1, visual.dimensions.length)}, minmax(0, 1fr))` }}>
      {visual.dimensions.map((d) => (
        <section key={d.name} className="pv24-av-measure">
          <h3 className="pv24-av-measure__name">{d.name}</h3>
          <div className="pv24-av-measure__block">
            <span className="pv24-av-kicker">Metric</span>
            <p className="pv24-av-measure__metric">{d.metric}</p>
          </div>
          <div className="pv24-av-measure__block pv24-av-measure__block--base">
            <span className="pv24-av-kicker">Baseline</span>
            <p className="pv24-av-measure__baseline">{d.baseline}</p>
          </div>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Limitations landscape
// ---------------------------------------------------------------------------

const CATEGORY_ORDER = ["current", "roadmap", "out-of-scope"] as const;
const CATEGORY_LABEL: Record<(typeof CATEGORY_ORDER)[number], string> = {
  current: "Current limitation",
  roadmap: "On the roadmap",
  "out-of-scope": "Out of scope",
};

function LimitationsLandscape({ visual }: { visual: Visual<"limitations-landscape"> }) {
  const cols = CATEGORY_ORDER.map((category) => ({ category, areas: visual.areas.filter((a) => a.category === category) })).filter(
    (c) => c.areas.length > 0,
  );
  const most = Math.max(1, ...cols.map((c) => c.areas.length));
  const detailSize = most > 5 ? 16 : 18;
  return (
    <div className="pv24-av-columns" style={{ gridTemplateColumns: `repeat(${Math.max(1, cols.length)}, minmax(0, 1fr))` }}>
      {cols.map((col) => (
        <section key={col.category} className={`pv24-av-col pv24-av-col--${col.category}`}>
          <header className="pv24-av-col__head">
            <span className="pv24-av-col__title">{CATEGORY_LABEL[col.category]}</span>
            <span className="pv24-av-col__count">{col.areas.length}</span>
          </header>
          <div className="pv24-av-col__body" style={{ gap: 12 }}>
            {col.areas.map((area) => (
              <div key={area.label} className="pv24-av-card">
                <span className="pv24-av-card__label">{area.label}</span>
                <p className="pv24-av-card__detail" style={{ fontSize: detailSize }}>
                  {area.detail}
                </p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Integration flow: inbound sources, control points, outbound actions
// ---------------------------------------------------------------------------

function IntegrationFlow({ visual }: { visual: Visual<"integration-flow"> }) {
  return (
    <div className="pv24-av-flow">
      <section className="pv24-av-flow__side">
        <h3 className="pv24-av-flow__head">Inbound</h3>
        {visual.inbound.map((item) => (
          <div key={item} className="pv24-av-flow__item">
            <IconPlugConnected size={22} stroke={1.8} aria-hidden="true" />
            {item}
          </div>
        ))}
      </section>
      <IconArrowRight className="pv24-av-flow__arrow" size={44} stroke={1.6} aria-hidden="true" />
      <section className="pv24-av-flow__core">
        <h3 className="pv24-av-flow__head pv24-av-flow__head--core">Control points</h3>
        {visual.controlPoints.map((item) => (
          <div key={item} className="pv24-av-flow__control">
            <IconShieldCheck size={22} stroke={1.8} aria-hidden="true" />
            {item}
          </div>
        ))}
      </section>
      <IconArrowRight className="pv24-av-flow__arrow" size={44} stroke={1.6} aria-hidden="true" />
      <section className="pv24-av-flow__side">
        <h3 className="pv24-av-flow__head">Outbound</h3>
        {visual.outbound.map((item) => (
          <div key={item} className="pv24-av-flow__item">
            <IconSend size={22} stroke={1.8} aria-hidden="true" />
            {item}
          </div>
        ))}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Product proof: one captured product view in a clean frame
// ---------------------------------------------------------------------------

export const PRODUCT_ASSET_BASE = "/presentation-assets/v2.4-final";

function ProductProof({ visual }: { visual: Visual<"product-proof"> }) {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const points = visual.points.slice(0, 4);

  // An image that failed before hydration never fires onError on the client
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);
  return (
    <div className="pv24-av-proof">
      <figure className="pv24-av-proof__frame">
        <div className="pv24-av-proof__bar" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="pv24-av-proof__view">
          {failed ? (
            <div className="pv24-av-proof__pending" role="img" aria-label="Product capture pending">
              <IconPhotoOff size={48} stroke={1.4} aria-hidden="true" />
              <span className="pv24-av-proof__pending-title">Capture pending</span>
              <span className="pv24-av-proof__pending-id">{visual.assetId}</span>
            </div>
          ) : (
            <img
              ref={imgRef}
              src={`${PRODUCT_ASSET_BASE}/${visual.assetId}.png`}
              alt={visual.caption}
              className="pv24-av-proof__img"
              onError={() => setFailed(true)}
            />
          )}
        </div>
      </figure>
      <div className="pv24-av-proof__side">
        <p className="pv24-av-proof__caption">{visual.caption}</p>
        <ol className="pv24-av-proof__points">
          {points.map((p, i) => (
            <li key={p}>
              <span className="pv24-av-proof__num">{i + 1}</span>
              <span>{p}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function AppendixVisual24({ visual }: { visual: AppendixVisual }) {
  // Content-height visuals (tables, card columns) sit centred; the rest fill the stage
  const frame: CSSProperties = {
    position: "absolute",
    inset: 0,
    padding: "36px 64px",
    boxSizing: "border-box",
    background: "var(--pv24-canvas)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  };
  let body: ReactNode;
  switch (visual.type) {
    case "status-table":
      body = <StatusTable visual={visual} />;
      break;
    case "authority-matrix":
      body = <AuthorityTable visual={visual} />;
      break;
    case "capability-map":
      body = <CapabilityMap visual={visual} />;
      break;
    case "process-matrix":
      body = <ProcessMatrix visual={visual} />;
      break;
    case "text-columns":
      body = <TextColumns visual={visual} />;
      break;
    case "architecture-layers":
      body = <ArchitectureLayers visual={visual} />;
      break;
    case "service-stack":
      body = <ServiceStack visual={visual} />;
      break;
    case "measurement-framework":
      body = <MeasurementFramework visual={visual} />;
      break;
    case "limitations-landscape":
      body = <LimitationsLandscape visual={visual} />;
      break;
    case "integration-flow":
      body = <IntegrationFlow visual={visual} />;
      break;
    case "product-proof":
      body = <ProductProof key={visual.assetId} visual={visual} />;
      break;
    default: {
      const _: never = visual;
      body = null;
    }
  }
  return (
    <div style={frame} data-visual-type={visual.type}>
      {body}
    </div>
  );
}

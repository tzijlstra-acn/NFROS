"use client";

/**
 * One event, six professional lenses, one decision thread.
 *
 * What it shows: a single matter in the centre, with the six NFR functions
 * arranged beside it. Each lens carries that function's own professional
 * question about the same facts, its current position, its confidence and the
 * decision identifiers it owns.
 *
 * The design decision that matters: the consolidation argument is drawn twice,
 * in two different registers, because it is the argument the whole role exists
 * to make. Above, the six lenses converge on one matter, and the width of each
 * lead line is the number of decisions that function contributes, so a reader
 * can see who is actually carrying the matter. Below, a separate collapse
 * diagram puts today's duplicate reports on the left, funnels them through a
 * single bracket, and lands them on one thread of ordered decisions. Six
 * documents becoming one line is a claim about work removed, and it is made
 * geometrically rather than asserted in a sentence.
 *
 * Nothing about the lenses is averaged. Six positions stay six positions.
 */

import { useMemo, useState } from "react";
import { Chip, ConfidenceMeter, ObjectId } from "@/components/evidence/primitives";

/* ==========================================================================
   Props
   ========================================================================== */

export type LensPositionStatus = "open" | "decided" | "deferred" | "escalated";

export interface PortfolioLensView {
  roleId: string;
  roleTitle: string;
  holderLabel?: string;
  /** The professional question this function asks about the same facts. */
  question: string;
  /** This function's current position on the matter. */
  position: string;
  positionStatus?: LensPositionStatus | string;
  confidence: number | null;
  decisionIds: string[];
  /** True when this function would issue its own report on the same fact today. */
  producesSeparateReportToday?: boolean;
  reportNameToday?: string;
  evidenceRefs?: string[];
}

export interface PortfolioMatterView {
  id: string;
  title: string;
  description?: string;
  detectedAtMoment?: string;
  entityLabels?: string[];
  /** How many separate reports would cover this matter today. */
  duplicateReportCount?: number;
  /** Portfolio materiality. Null until a human decides it. */
  materiality?: string | null;
  materialityDecidedBy?: string | null;
  confidence?: number;
}

export interface PortfolioThreadProps {
  matter: PortfolioMatterView;
  lenses: PortfolioLensView[];
  /** The consolidated decision thread, in the order it should be read. */
  threadDecisionIds?: string[];
  selectedRoleId?: string | null;
  onSelectLens?: (roleId: string) => void;
  heading?: string;
}

/* ==========================================================================
   Geometry
   ========================================================================== */

const VIEW_W = 1000;
const TOP = 46;
const LENS_W = 300;
const LENS_H = 152;
const LENS_GAP = 18;
const CENTRE_X = 356;
const CENTRE_W = 288;
const CENTRE_H = 212;
const LEFT_X = 14;
const RIGHT_X = 686;

const STATUS_GLYPH: Record<string, string> = {
  open: "?",
  decided: "v",
  deferred: "~",
  escalated: "^",
};

const STATUS_TONE: Record<string, string> = {
  open: "var(--amber)",
  decided: "var(--green)",
  deferred: "var(--cyan)",
  escalated: "var(--red)",
};

function statusGlyph(status: string | undefined): string {
  return STATUS_GLYPH[status ?? "open"] ?? "?";
}

function statusTone(status: string | undefined): string {
  return STATUS_TONE[status ?? "open"] ?? "var(--text-3)";
}

function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (candidate.length <= maxChars) current = candidate;
    else {
      if (current.length > 0) lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && current.length > 0) lines.push(current);
  if (lines.length === maxLines) {
    const consumed = lines.join(" ").split(/\s+/).length;
    const last = lines[maxLines - 1];
    if (last !== undefined && consumed < words.length) {
      lines[maxLines - 1] = `${last.slice(0, Math.max(0, maxChars - 3))}...`;
    }
  }
  return lines;
}

interface PlacedLens {
  lens: PortfolioLensView;
  side: "left" | "right";
  x: number;
  y: number;
}

/* ==========================================================================
   Component
   ========================================================================== */

export function PortfolioThread({
  matter,
  lenses,
  threadDecisionIds,
  selectedRoleId = null,
  onSelectLens,
  heading = "One matter, six lenses, one thread",
}: PortfolioThreadProps) {
  const [activeRoleId, setActiveRoleId] = useState<string | null>(null);

  const layout = useMemo(() => {
    // Half the lenses go left, half right, in the order supplied. Placement is
    // positional only: no lens is ranked above another.
    const half = Math.ceil(lenses.length / 2);
    const placed: PlacedLens[] = lenses.map((lens, index) => {
      const side: "left" | "right" = index < half ? "left" : "right";
      const slot = side === "left" ? index : index - half;
      return {
        lens,
        side,
        x: side === "left" ? LEFT_X : RIGHT_X,
        y: TOP + slot * (LENS_H + LENS_GAP),
      };
    });

    const columnCount = Math.max(half, lenses.length - half, 1);
    const columnH = columnCount * (LENS_H + LENS_GAP) - LENS_GAP;
    const centreY = TOP + Math.max(0, (columnH - CENTRE_H) / 2);

    return { placed, centreY, viewH: TOP + columnH + 24 };
  }, [lenses]);

  const focusRoleId = activeRoleId ?? selectedRoleId;

  const threadIds = useMemo(() => {
    if (threadDecisionIds && threadDecisionIds.length > 0) return threadDecisionIds;
    const all = new Set<string>();
    for (const lens of lenses) for (const id of lens.decisionIds) all.add(id);
    return Array.from(all).sort();
  }, [threadDecisionIds, lenses]);

  const duplicateReports = lenses.filter((lens) => lens.producesSeparateReportToday);
  const duplicateCount = matter.duplicateReportCount ?? duplicateReports.length;

  const ariaLabel = [
    `One matter, ${matter.id}, ${matter.title}, seen through ${lenses.length} functional lenses.`,
    `Each lens states a different professional question about the same facts and holds its own position and confidence.`,
    `${threadIds.length} decisions form one shared thread.`,
    `Today the same fact would be reported ${duplicateCount} times in ${duplicateCount} separate reports.`,
    matter.materiality
      ? `Portfolio materiality recorded as ${matter.materiality}${matter.materialityDecidedBy ? ` by ${matter.materialityDecidedBy}` : ""}.`
      : `Portfolio materiality has not been decided. That decision belongs to a human.`,
  ].join(" ");

  return (
    <figure className="stack stack-5" style={{ margin: 0 }}>
      <figcaption className="row row-3 row-wrap row-between">
        <div className="stack stack-1">
          <span className="panel-title">{heading}</span>
          <ObjectId id={matter.id} label={matter.title} />
        </div>
        <div className="row row-2 row-wrap">
          <Chip tone="accent">{lenses.length} lenses</Chip>
          <Chip tone="cyan">{threadIds.length} decisions on one thread</Chip>
          {duplicateCount > 1 ? <Chip tone="pink">{duplicateCount} reports today</Chip> : null}
        </div>
      </figcaption>

      <svg
        viewBox={`0 0 ${VIEW_W} ${layout.viewH}`}
        preserveAspectRatio="xMidYMin meet"
        role="img"
        aria-label={ariaLabel}
        style={{ width: "100%", height: "auto" }}
      >
        {/* Lead lines, drawn first. Width is the number of decisions the lens
            contributes, so the lines say who is carrying this matter. */}
        <g aria-hidden="true">
          {layout.placed.map((item) => {
            const dim = focusRoleId !== null && focusRoleId !== item.lens.roleId;
            const startX = item.side === "left" ? item.x + LENS_W : item.x;
            const startY = item.y + LENS_H / 2;
            const endX = item.side === "left" ? CENTRE_X : CENTRE_X + CENTRE_W;
            const endY = layout.centreY + CENTRE_H / 2;
            const mx = (startX + endX) / 2;
            const width = Math.max(1, Math.min(5, item.lens.decisionIds.length)) * 1.1;
            const open = (item.lens.positionStatus ?? "open") === "open";
            return (
              <path
                key={`lead-${item.lens.roleId}`}
                d={`M${startX},${startY} C${mx},${startY} ${mx},${endY} ${endX},${endY}`}
                fill="none"
                stroke={statusTone(item.lens.positionStatus)}
                strokeWidth={width}
                strokeDasharray={open ? "6 4" : "none"}
                opacity={dim ? 0.14 : 0.85}
              />
            );
          })}
        </g>

        {/* The matter. One object, stated once. */}
        <g aria-hidden="true">
          <rect
            x={CENTRE_X}
            y={layout.centreY}
            width={CENTRE_W}
            height={CENTRE_H}
            rx="10"
            fill="var(--surface-2)"
            stroke="var(--accent)"
            strokeWidth="2"
          />
          <text
            x={CENTRE_X + 16}
            y={layout.centreY + 22}
            fontSize="11"
            fontFamily="var(--font-mono)"
            fill="var(--accent)"
            letterSpacing="0.09em"
          >
            ONE MATTER
          </text>
          <text
            x={CENTRE_X + CENTRE_W - 16}
            y={layout.centreY + 22}
            textAnchor="end"
            fontSize="11"
            fontFamily="var(--font-mono)"
            fill="var(--text-4)"
          >
            {matter.id}
          </text>
          {wrapText(matter.title, 30, 2).map((line, index) => (
            <text
              key={index}
              x={CENTRE_X + 16}
              y={layout.centreY + 48 + index * 19}
              fontSize="15"
              fontFamily="var(--font-display)"
              fontWeight="600"
              fill="var(--text-1)"
            >
              {line}
            </text>
          ))}
          {wrapText(matter.description ?? "", 38, 3).map((line, index) => (
            <text
              key={`desc-${index}`}
              x={CENTRE_X + 16}
              y={layout.centreY + 96 + index * 14}
              fontSize="12"
              fill="var(--text-3)"
            >
              {line}
            </text>
          ))}
          <text x={CENTRE_X + 16} y={layout.centreY + 156} fontSize="11" fill="var(--text-4)">
            {[
              matter.detectedAtMoment ? `detected ${matter.detectedAtMoment}` : null,
              matter.entityLabels?.join(", "),
            ]
              .filter(Boolean)
              .join("  ")}
          </text>
          <line
            x1={CENTRE_X + 16}
            y1={layout.centreY + 166}
            x2={CENTRE_X + CENTRE_W - 16}
            y2={layout.centreY + 166}
            stroke="var(--border-2)"
            strokeWidth="1"
          />
          <text
            x={CENTRE_X + 16}
            y={layout.centreY + 184}
            fontSize="11"
            fontFamily="var(--font-mono)"
            fill={matter.materiality ? "var(--green)" : "var(--amber)"}
          >
            {matter.materiality
              ? `materiality ${matter.materiality}${matter.materialityDecidedBy ? ` / ${matter.materialityDecidedBy}` : ""}`
              : "materiality not decided: human judgment"}
          </text>
          <text x={CENTRE_X + 16} y={layout.centreY + 200} fontSize="11" fill="var(--text-4)">
            {threadIds.length} decisions, one thread
          </text>
        </g>

        {/* The six lenses. Each states its own question, in its own words. */}
        {layout.placed.map((item) => {
          const lens = item.lens;
          const dim = focusRoleId !== null && focusRoleId !== lens.roleId;
          const isFocused = focusRoleId === lens.roleId;
          const tone = statusTone(lens.positionStatus);
          return (
            <g
              key={lens.roleId}
              tabIndex={0}
              role="button"
              aria-label={describeLens(lens)}
              opacity={dim ? 0.24 : 1}
              style={{ cursor: onSelectLens ? "pointer" : "default", outline: "none" }}
              onMouseEnter={() => setActiveRoleId(lens.roleId)}
              onMouseLeave={() => setActiveRoleId(null)}
              onFocus={() => setActiveRoleId(lens.roleId)}
              onBlur={() => setActiveRoleId(null)}
              onClick={() => onSelectLens?.(lens.roleId)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectLens?.(lens.roleId);
                }
              }}
            >
              {isFocused ? (
                <rect
                  x={item.x - 4}
                  y={item.y - 4}
                  width={LENS_W + 8}
                  height={LENS_H + 8}
                  rx="10"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2"
                />
              ) : null}
              <rect
                x={item.x}
                y={item.y}
                width={LENS_W}
                height={LENS_H}
                rx="8"
                fill="var(--surface-1)"
                stroke="var(--border-1)"
                strokeWidth="1"
              />
              {/* The status edge sits on the side facing the matter, so the eye
                  travels from the lens to the centre. */}
              <rect
                x={item.side === "left" ? item.x + LENS_W - 3 : item.x}
                y={item.y}
                width="3"
                height={LENS_H}
                fill={tone}
              />

              <text x={item.x + 14} y={item.y + 20} fontSize="12" fontFamily="var(--font-display)" fontWeight="600" fill="var(--text-1)">
                {lens.roleTitle.length > 32 ? `${lens.roleTitle.slice(0, 31)}...` : lens.roleTitle}
              </text>
              <text x={item.x + 14} y={item.y + 35} fontSize="11" fill="var(--text-4)">
                {lens.holderLabel ?? lens.roleId}
              </text>

              <text
                x={item.x + 14}
                y={item.y + 54}
                fontSize="11"
                fontFamily="var(--font-mono)"
                fill="var(--text-4)"
                letterSpacing="0.09em"
              >
                ASKS
              </text>
              {wrapText(lens.question, 42, 2).map((line, index) => (
                <text key={index} x={item.x + 14} y={item.y + 69 + index * 14} fontSize="12" fill="var(--text-2)">
                  {line}
                </text>
              ))}

              <text
                x={item.x + 14}
                y={item.y + 108}
                fontSize="11"
                fontFamily="var(--font-mono)"
                fill="var(--text-4)"
                letterSpacing="0.09em"
              >
                POSITION
              </text>
              <text x={item.x + 76} y={item.y + 108} fontSize="11" fontFamily="var(--font-mono)" fill={tone}>
                {statusGlyph(lens.positionStatus)} {lens.positionStatus ?? "open"}
              </text>
              {wrapText(lens.position, 44, 1).map((line, index) => (
                <text key={`pos-${index}`} x={item.x + 14} y={item.y + 122} fontSize="12" fill="var(--text-1)">
                  {line}
                </text>
              ))}

              {/* Confidence as a segmented bar, never a dial. Five segments, and the
                  number is written out beside it. */}
              <g aria-hidden="true">
                {[0, 1, 2, 3, 4].map((index) => {
                  const filled =
                    lens.confidence !== null && index < Math.round(lens.confidence * 5);
                  return (
                    <rect
                      key={index}
                      x={item.x + 14 + index * 11}
                      y={item.y + LENS_H - 18}
                      width="9"
                      height="8"
                      rx="1"
                      fill={filled ? "var(--cyan)" : "none"}
                      stroke="var(--border-2)"
                      strokeWidth="0.8"
                    />
                  );
                })}
                <text x={item.x + 76} y={item.y + LENS_H - 11} fontSize="11" fontFamily="var(--font-mono)" fill="var(--text-4)">
                  {lens.confidence === null
                    ? "confidence n/a"
                    : `conf ${Math.round(lens.confidence * 100)}/100`}
                </text>
                <text
                  x={item.x + LENS_W - 14}
                  y={item.y + LENS_H - 11}
                  textAnchor="end"
                  fontSize="11"
                  fontFamily="var(--font-mono)"
                  fill="var(--text-3)"
                >
                  {lens.decisionIds.length > 0 ? lens.decisionIds.join(" ") : "no decision"}
                </text>
              </g>
            </g>
          );
        })}
      </svg>

      {/* The consolidation argument, drawn a second way: six documents collapsing
          into one thread. */}
      <ConsolidationStrip
        duplicateReports={duplicateReports}
        duplicateCount={duplicateCount}
        threadIds={threadIds}
        lenses={lenses}
      />

      {/* Legend */}
      <div className="row row-4 row-wrap" aria-hidden="true" style={{ fontSize: "var(--text-xs)" }}>
        <span className="muted">Lead line width: number of decisions that function contributes</span>
        <span className="muted">Dashed lead line: position still open</span>
        <span className="muted">Status glyphs: ? open, v decided, ~ deferred, ^ escalated</span>
        <span className="muted">Confidence: five segments plus the number</span>
      </div>

      {/* Positions in text, six of them, never averaged. */}
      <div className="stack stack-3">
        <span className="label">Six positions on the same facts</span>
        <div className="grid grid-2">
          {lenses.map((lens) => (
            <div key={`row-${lens.roleId}`} className="card card-edge" data-tone={toneForStatus(lens.positionStatus)}>
              <div className="stack stack-2">
                <div className="row row-2 row-wrap row-between">
                  <span className="strong-text" style={{ fontSize: "var(--text-sm)" }}>
                    {lens.roleTitle}
                  </span>
                  <Chip tone={toneForStatus(lens.positionStatus)}>{lens.positionStatus ?? "open"}</Chip>
                </div>
                <p className="dim" style={{ fontSize: "var(--text-sm)" }}>
                  {lens.question}
                </p>
                <p style={{ fontSize: "var(--text-sm)" }}>{lens.position}</p>
                <div className="row row-3 row-wrap">
                  <ConfidenceMeter value={lens.confidence} label="conf" />
                  {lens.decisionIds.map((id) => (
                    <ObjectId key={id} id={id} />
                  ))}
                </div>
                {lens.producesSeparateReportToday ? (
                  <span className="chip" data-tone="pink">
                    <span className="chip-glyph" aria-hidden="true">
                      *
                    </span>
                    Today: {lens.reportNameToday ?? "a separate report on the same fact"}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="sr-only">
        <h4>Matter and lenses, described</h4>
        <p>
          {matter.id}, {matter.title}. {matter.description ?? ""}{" "}
          {matter.detectedAtMoment ? `Detected at ${matter.detectedAtMoment}.` : ""}{" "}
          {matter.materiality
            ? `Portfolio materiality ${matter.materiality}.`
            : "Portfolio materiality has not been decided."}
        </p>
        <h5>Lenses</h5>
        <ul>
          {lenses.map((lens) => (
            <li key={`sr-${lens.roleId}`}>{describeLens(lens)}</li>
          ))}
        </ul>
        <h5>Duplicate reporting today</h5>
        <p>
          The same fact would appear in {duplicateCount} separate reports today:{" "}
          {duplicateReports
            .map((lens) => `${lens.roleTitle} (${lens.reportNameToday ?? "own report"})`)
            .join("; ")}
          . In this product it appears once, on a single thread of {threadIds.length} decisions:{" "}
          {threadIds.join(", ")}.
        </p>
      </div>
    </figure>
  );
}

/* ==========================================================================
   Internals
   ========================================================================== */

function toneForStatus(status: string | undefined): "green" | "amber" | "cyan" | "red" | "neutral" {
  if (status === "decided") return "green";
  if (status === "deferred") return "cyan";
  if (status === "escalated") return "red";
  if (status === "open") return "amber";
  return "neutral";
}

function describeLens(lens: PortfolioLensView): string {
  const parts: string[] = [
    `${lens.roleTitle}${lens.holderLabel ? `, held by ${lens.holderLabel}` : ""}.`,
    `Asks: ${lens.question}`,
    `Position: ${lens.position}`,
    `Status ${lens.positionStatus ?? "open"}.`,
    lens.confidence === null
      ? "Confidence not applicable."
      : `Confidence ${Math.round(lens.confidence * 100)} out of 100.`,
    lens.decisionIds.length > 0
      ? `Decisions ${lens.decisionIds.join(", ")}.`
      : "No decision is recorded for this lens.",
  ];
  if (lens.producesSeparateReportToday) {
    parts.push(
      `Today this function would issue ${lens.reportNameToday ?? "its own separate report"} on the same fact.`,
    );
  }
  if (lens.evidenceRefs && lens.evidenceRefs.length > 0) {
    parts.push(`Evidence ${lens.evidenceRefs.join(", ")}.`);
  }
  return parts.join(" ");
}

/**
 * The collapse diagram.
 *
 * Left: one page glyph per report that exists today. A bracket funnels them to
 * a single junction. Right: one thread carrying the ordered decisions as beads.
 * The asymmetry between the two sides is the whole point, so the page stack is
 * drawn at full weight rather than greyed out: those reports are real work.
 */
function ConsolidationStrip({
  duplicateReports,
  duplicateCount,
  threadIds,
  lenses,
}: {
  duplicateReports: PortfolioLensView[];
  duplicateCount: number;
  threadIds: string[];
  lenses: PortfolioLensView[];
}) {
  const pages =
    duplicateReports.length > 0
      ? duplicateReports
      : lenses.slice(0, Math.max(0, Math.min(duplicateCount, lenses.length)));
  const pageH = 26;
  const pageGap = 8;
  const top = 46;
  const stripH = Math.max(190, top + pages.length * (pageH + pageGap) + 40);
  const junctionX = 520;
  const junctionY = top + (pages.length * (pageH + pageGap) - pageGap) / 2;
  const beadStep = threadIds.length > 0 ? Math.min(96, (VIEW_W - junctionX - 80) / threadIds.length) : 0;

  const ariaLabel = `Today the same fact is reported ${duplicateCount} times in ${pages.length} separate reports. In this product those reports collapse into one decision thread carrying ${threadIds.length} decisions.`;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${stripH}`}
      preserveAspectRatio="xMidYMin meet"
      role="img"
      aria-label={ariaLabel}
      style={{ width: "100%", height: "auto" }}
    >
      <text x={14} y={20} fontSize="11" fontFamily="var(--font-mono)" fill="var(--pink)" letterSpacing="0.09em">
        TODAY: {duplicateCount} REPORTS ON THE SAME FACT
      </text>
      <text
        x={junctionX + 40}
        y={20}
        fontSize="11"
        fontFamily="var(--font-mono)"
        fill="var(--accent)"
        letterSpacing="0.09em"
      >
        IN ONE THREAD: {threadIds.length} DECISIONS, 1 MATTER
      </text>

      {/* The page stack */}
      {pages.map((lens, index) => {
        const y = top + index * (pageH + pageGap);
        return (
          <g key={`page-${lens.roleId}`} aria-hidden="true">
            <path
              d={`M14,${y} H${14 + 268 - 10} L${14 + 268},${y + 10} V${y + pageH} H14 Z`}
              fill="var(--surface-1)"
              stroke="var(--pink)"
              strokeWidth="1.1"
            />
            <text x={24} y={y + 17} fontSize="11" fill="var(--text-2)">
              {(lens.reportNameToday ?? `${lens.roleTitle} report`).slice(0, 40)}
            </text>
            {/* Funnel line into the single junction. */}
            <path
              d={`M${14 + 268},${y + pageH / 2} C${(14 + 268 + junctionX) / 2},${y + pageH / 2} ${(14 + 268 + junctionX) / 2},${junctionY} ${junctionX - 12},${junctionY}`}
              fill="none"
              stroke="var(--pink)"
              strokeWidth="1.1"
              strokeOpacity="0.7"
            />
          </g>
        );
      })}

      {/* The junction: where six become one. */}
      <g aria-hidden="true">
        <circle cx={junctionX} cy={junctionY} r="11" fill="var(--accent-tint)" stroke="var(--accent)" strokeWidth="2" />
        <text
          x={junctionX}
          y={junctionY + 4}
          textAnchor="middle"
          fontSize="11"
          fontFamily="var(--font-mono)"
          fill="var(--accent)"
        >
          1
        </text>
      </g>

      {/* The thread, with one bead per decision in reading order. */}
      <g aria-hidden="true">
        <line
          x1={junctionX + 12}
          y1={junctionY}
          x2={junctionX + 30 + Math.max(0, threadIds.length - 1) * beadStep + 20}
          y2={junctionY}
          stroke="var(--accent)"
          strokeWidth="2.5"
        />
        {threadIds.map((id, index) => {
          const x = junctionX + 40 + index * beadStep;
          return (
            <g key={`bead-${id}`}>
              <circle cx={x} cy={junctionY} r="7" fill="var(--bg)" stroke="var(--accent)" strokeWidth="2" />
              <text
                x={x}
                y={junctionY + 24}
                textAnchor="middle"
                fontSize="11"
                fontFamily="var(--font-mono)"
                fill="var(--text-3)"
              >
                {id}
              </text>
              <text x={x} y={junctionY - 14} textAnchor="middle" fontSize="11" fill="var(--text-4)">
                {index + 1}
              </text>
            </g>
          );
        })}
      </g>

      <text x={14} y={stripH - 12} fontSize="11" fill="var(--text-4)">
        Each report on the left restates the same facts for a different committee. The thread on the
        right states them once and records who decided what.
      </text>
    </svg>
  );
}

export default PortfolioThread;

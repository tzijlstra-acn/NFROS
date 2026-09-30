"use client";

/**
 * Chapter II: Work, lane by lane. Scenes 4 and 5.
 *
 * Scene 4 carries the best piece of motion design in the deck, and it is an
 * absence. Four lanes sweep a fill to the width of their shared share. Lane 4
 * does not, because lane 4 produces no automated action. The audience feels
 * the missing animation before they read the sentence, and lane 5 sweeping
 * normally afterwards is what makes lane 4's stillness read as deliberate
 * rather than broken.
 *
 * Scene 5 is a breathing scene with one structural argument: the frame does
 * not move. Six genuinely different centres inside one unchanging
 * environment, and six schematics that are different geometries rather than
 * recolours of one geometry.
 */

import * as React from "react";
import type { LensSwitcherContent, RoleLens, StoryRoleSlug, WorkLaneLadderContent } from "@/scenario/data/story";
import { Chip } from "@/components/evidence/primitives";
import {
  Basis,
  PanelTitle,
  Reveal,
  StageFit,
  SwapPane,
  SwapRegion,
  type SceneRenderProps,
} from "./parts";

/* ==========================================================================
   Scene 4. Not every part of NFR work changes in the same way.
   ========================================================================== */

export const LANE_LADDER_STEPS = 6;

const OWNERSHIP_LABEL: Record<string, string> = {
  "shared-infrastructure": "Shared infrastructure",
  "shared-engine-role-corpora": "Shared engine, role corpora",
  "function-specific": "Function specific",
  "function-specific-unautomated": "Function specific, unautomated",
  "shared-engine-role-routes": "Shared engine, role routes",
};

/** The percentage inside a share value such as "~85%" or "0%". */
function sharePercent(value: string): number {
  const match = /(\d+(?:\.\d+)?)\s*%/.exec(value);
  if (match === null) return 0;
  const parsed = Number(match[1]);
  return Number.isNaN(parsed) ? 0 : Math.max(0, Math.min(100, parsed));
}

export function WorkLaneLadderScene({ content, step }: SceneRenderProps<WorkLaneLadderContent>) {
  const alt = [
    "Five lanes of work, stacked bottom to top.",
    content.organisingClaim,
    content.judgmentRule,
  ].join(" ");

  return (
    <StageFit size="full" minScale={0.5}>
      <p className="scene-alt">{alt}</p>

      <div className="stack stack-3">
        <div className="lane-ladder">
          {content.lanes.map((lane) => {
            const unautomated = lane.ownership === "function-specific-unautomated";
            // Lane order is 1 at the bottom, so the reveal step is the lane
            // number minus one and the ladder builds upward.
            const at = lane.laneNumber - 1;
            const shown = step >= at;
            return (
              <div
                className="lane rv rv-flat"
                key={lane.laneNumber}
                data-shown={shown ? "true" : "false"}
                data-unautomated={unautomated ? "true" : "false"}
              >
                {/*
                  No fill element exists on lane 4. Not a fill of zero width,
                  and not a fill that is hidden: the element is absent, so
                  there is nothing that could ever sweep.
                */}
                {unautomated ? null : (
                  <>
                    <span
                      className="lane-fill"
                      aria-hidden="true"
                      data-shown={shown ? "true" : "false"}
                      style={{
                        ["--fill" as string]: `${sharePercent(lane.commonShare.value)}%`,
                        ["--rv-delay" as string]: "140ms",
                      }}
                    />
                    {/* The share, with its basis, at the fill edge. */}
                    <span
                      className="lane-share"
                      data-shown={shown ? "true" : "false"}
                      style={{
                        ["--fill" as string]: `${sharePercent(lane.commonShare.value)}%`,
                        ["--rv-delay" as string]: "140ms",
                      }}
                    >
                      <span className="lane-share-value">{lane.commonShare.value}</span>
                      <Basis basis={lane.commonShare.basis} />
                    </span>
                  </>
                )}

                <div className="lane-ident">
                  <span className="row row-2 row-baseline">
                    <span className="lane-number">{lane.laneNumber}</span>
                    <span className="lane-label">{lane.label}</span>
                  </span>
                  <span className="lane-col-body clamp-1" style={{ color: "var(--text-4)" }}>
                    {lane.fullName}
                  </span>
                  {/* Ownership as a line rather than a chip. A chip in a
                      narrow column wraps, and the ident column is what sets
                      the height of every lane in the ladder. */}
                  <span
                    className="lane-col-title clamp-1"
                    style={{ color: unautomated ? "var(--human)" : "var(--accent)" }}
                  >
                    {OWNERSHIP_LABEL[lane.ownership] ?? lane.ownership}
                  </span>
                </div>

                <div className="lane-col">
                  <span className="lane-col-title">Cost today</span>
                  <span className="lane-col-body clamp-3">{lane.todayCost}</span>
                </div>

                <div className="lane-col">
                  <span className="lane-col-title">What changes</span>
                  <span className="lane-col-body clamp-3">{lane.whatChanges}</span>
                </div>

                <div className="lane-col">
                  <span className="lane-col-title">What stays human</span>
                  <span className="lane-col-body clamp-3" style={{ color: "var(--human)" }}>
                    {lane.whatStaysHuman}
                  </span>
                </div>

                <div className="lane-col">
                  <span className="lane-col-title">On 06.10.2026</span>
                  <span className="lane-col-body clamp-3" style={{ color: "var(--text-3)" }}>
                    {lane.scenarioExample}
                  </span>
                </div>

                {unautomated ? (
                  <p className="lane-judgment clamp-1">
                    {`${lane.commonShare.value} ${lane.commonShare.label}. ${lane.commonShare.note ?? "Enforced by the action ledger."}`}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        <SwapRegion height="17cqh">
          <SwapPane shown={step < 5} label="Lane 4 produces no automated action">
            <div className="story-panel" data-tone="human">
              <PanelTitle>The hard property of lane 4</PanelTitle>
              <p className="story-body" style={{ fontSize: "var(--text-md)" }}>
                {content.judgmentRule}
              </p>
            </div>
          </SwapPane>
          <SwapPane shown={step >= 5} label="The organising claim and the build ratio">
            <div className="story-equal-pair">
              <div className="story-panel" data-tone="ai">
                <PanelTitle>The organising claim, stated so it can be argued with</PanelTitle>
                <p className="story-body clamp-4">{content.organisingClaim}</p>
              </div>
              <div className="story-panel" data-tone="data">
                <PanelTitle>Build ratio</PanelTitle>
                <p className="story-body clamp-4">{content.buildRatioNote}</p>
              </div>
            </div>
          </SwapPane>
        </SwapRegion>
      </div>
    </StageFit>
  );
}

/* ==========================================================================
   Scene 5. One work environment. Multiple professional lenses.
   ========================================================================== */

/** Six lens positions, then a seventh step that settles back on the first. */
export const LENS_STEPS = 8;

/**
 * Six schematics, six geometries.
 *
 * These are structural sketches of each role's hero view, not data views. A
 * schematic drawn from real data would need that role's objects, and only two
 * of the six roles carry enough structure in this scene's content to supply
 * them. The refusal the storyboard records for this scene is that the six must
 * not be recolours of one shape, and that is what these satisfy: rings, a
 * grid, a waterfall, runway lanes, a two lane lineage and a hub.
 */
const GOVERNANCE_SPOKES: ReadonlyArray<readonly [number, number]> = [
  [40, 26],
  [40, 124],
  [280, 26],
  [280, 124],
  [40, 75],
  [280, 75],
];

function LensSchematic({ slug, label }: { slug: StoryRoleSlug; label: string }) {
  const common = {
    viewBox: "0 0 320 150",
    preserveAspectRatio: "xMidYMid meet" as const,
    role: "img" as const,
    "aria-label": `Schematic of the ${label}`,
  };
  const line = "var(--border-2)";
  const ink = "var(--accent)";

  if (slug === "tprm") {
    return (
      <svg {...common}>
        {[52, 36, 20].map((r) => (
          <circle key={r} cx="160" cy="75" r={r} fill="none" stroke={line} strokeDasharray="3 4" />
        ))}
        <circle cx="160" cy="75" r="8" fill={ink} />
        {[0, 60, 120, 180, 240, 300].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          return (
            <circle
              key={deg}
              cx={160 + Math.cos(rad) * 36}
              cy={75 + Math.sin(rad) * 36}
              r="5"
              fill="var(--surface-3)"
              stroke="var(--border-strong)"
            />
          );
        })}
        <circle cx="228" cy="34" r="4" fill="none" stroke="var(--gap)" strokeDasharray="2 2" />
      </svg>
    );
  }

  if (slug === "rcsa") {
    return (
      <svg {...common}>
        {Array.from({ length: 5 }).map((_, row) =>
          Array.from({ length: 5 }).map((__, col) => (
            <rect
              key={`${row}-${col}`}
              x={110 + col * 20}
              y={26 + row * 20}
              width="18"
              height="18"
              fill="var(--surface-1)"
              stroke={line}
            />
          )),
        )}
        <line x1="108" y1="66" x2="212" y2="66" stroke="var(--amber)" strokeWidth="2" />
        <polyline
          points="130,106 170,86 190,46"
          fill="none"
          stroke={ink}
          strokeWidth="2"
          strokeDasharray="4 3"
        />
        <circle cx="130" cy="106" r="4" fill={ink} />
        <circle cx="170" cy="86" r="4" fill={ink} />
        <circle cx="190" cy="46" r="4" fill={ink} />
      </svg>
    );
  }

  if (slug === "control-assurance") {
    return (
      <svg {...common}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect
            key={i}
            x={60 + i * 34}
            y={20 + i * 16}
            width="26"
            height={110 - i * 16}
            fill={i > 3 ? "var(--red-tint)" : "var(--surface-2)"}
            stroke={i > 3 ? "var(--red-edge)" : line}
          />
        ))}
        <line x1="52" y1="130" x2="276" y2="130" stroke={line} />
      </svg>
    );
  }

  if (slug === "incident-resilience") {
    return (
      <svg {...common}>
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect
              x="30"
              y={26 + i * 36}
              width="230"
              height="22"
              fill="var(--surface-1)"
              stroke={line}
            />
            <rect
              x="31"
              y={27 + i * 36}
              width={i === 2 ? 190 : 120}
              height="20"
              fill={i === 2 ? "var(--red-tint)" : "var(--cyan-tint)"}
            />
          </g>
        ))}
        <line x1="238" y1="20" x2="238" y2="130" stroke="var(--pink)" strokeWidth="2" />
        <rect
          x="216"
          y="100"
          width="62"
          height="14"
          fill="none"
          stroke="var(--amber)"
          strokeDasharray="3 3"
        />
      </svg>
    );
  }

  if (slug === "regulatory-change") {
    return (
      <svg {...common}>
        <line x1="20" y1="75" x2="300" y2="75" stroke={line} strokeWidth="3" />
        {[0, 1].map((laneIndex) => {
          const y = laneIndex === 0 ? 44 : 110;
          const tone = laneIndex === 0 ? "var(--cyan)" : "var(--accent)";
          return (
            <g key={laneIndex}>
              {[0, 1, 2].map((i) => (
                <rect
                  key={i}
                  x={40 + i * 86}
                  y={y - 11}
                  width="62"
                  height="22"
                  fill="var(--surface-1)"
                  stroke={tone}
                />
              ))}
              {[0, 1].map((i) => (
                <line
                  key={i}
                  x1={102 + i * 86}
                  y1={y}
                  x2={126 + i * 86}
                  y2={y}
                  stroke={tone}
                />
              ))}
            </g>
          );
        })}
      </svg>
    );
  }

  return (
    <svg {...common}>
      <rect x="128" y="58" width="64" height="34" fill="var(--surface-2)" stroke={ink} />
      {GOVERNANCE_SPOKES.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="6" fill="var(--surface-3)" stroke="var(--border-strong)" />
          <line x1={x} y1={y} x2={x < 160 ? 128 : 192} y2="75" stroke={line} strokeDasharray="3 3" />
        </g>
      ))}
      <polyline
        points="40,26 128,58 192,92 280,124"
        fill="none"
        stroke="var(--amber)"
        strokeWidth="2"
      />
    </svg>
  );
}

export function LensSwitcherScene({ content, step }: SceneRenderProps<LensSwitcherContent>) {
  const count = content.lenses.length;
  // Steps 1 to 6 cycle the six lenses. Step 7 settles back on the first,
  // which is the handover into scene 6 and the declared end state.
  const fromStep = step <= 0 ? 0 : step <= count ? step - 1 : 0;
  const [override, setOverride] = React.useState<number | null>(null);

  React.useEffect(() => {
    setOverride(null);
  }, [step]);

  const activeIndex = override ?? fromStep;
  const active: RoleLens | undefined = content.lenses[activeIndex];

  return (
    <StageFit size="full" minScale={0.55}>
      <div className="lens-env">
        <div className="lens-topbar">
          <Chip tone="accent" glyph>
            One environment
          </Chip>
          <span className="story-body-dim">{`Lens ${activeIndex + 1} of ${count}`}</span>
          <span className="story-control-spacer" />
          <span className="story-panel-title" style={{ margin: 0 }}>
            The frame does not change when the lens does
          </span>
        </div>

        <div className="lens-rail" role="group" aria-label="Professional lens">
          {content.lenses.map((lens, index) => (
            <button
              type="button"
              key={lens.roleSlug}
              className="lens-option"
              aria-pressed={index === activeIndex}
              onClick={() => setOverride(index)}
            >
              <b>{lens.roleLabel}</b>
              <span>{lens.person}</span>
            </button>
          ))}
        </div>

        <div className="lens-centre">
          {active === undefined ? null : (
            <>
              <div className="stack stack-2">
                <div className="row row-3 row-wrap">
                  <span className="strong-text">{active.roleLabel}</span>
                  <span className="story-body-dim">{active.roleLabelDe}</span>
                  <Chip tone="neutral">{active.person}</Chip>
                </div>
                <span className="story-body-dim clamp-1">{active.entityLabel}</span>
                <div className="row row-4 row-wrap">
                  <span className="stack stack-1">
                    <PanelTitle>Unit of analysis</PanelTitle>
                    <span className="story-body">{active.unitOfAnalysis}</span>
                  </span>
                  <span className="stack stack-1">
                    <PanelTitle>Primary object</PanelTitle>
                    <span className="story-body mono">{active.primaryObject}</span>
                  </span>
                  <span className="stack stack-1">
                    <PanelTitle>Hardest judgment</PanelTitle>
                    <span className="story-body clamp-2" style={{ color: "var(--human)" }}>
                      {active.hardestJudgment}
                    </span>
                  </span>
                </div>
                <p className="lens-question clamp-3">{active.differentQuestion}</p>
              </div>

              <div className="lens-schematic">
                <div className="stack stack-1" style={{ width: "100%", alignItems: "center" }}>
                  <LensSchematic slug={active.roleSlug} label={active.heroVisual} />
                  <span className="story-panel-title" style={{ margin: 0 }}>
                    {active.heroVisual}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="lens-side">
          <div className="story-panel" data-tone="evidence" style={{ padding: "var(--space-3)" }}>
            <PanelTitle>Shared across every lens</PanelTitle>
            <ul className="story-rule-list" data-tone="evidence">
              {content.sharedAcrossLenses.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="story-panel" data-tone="ai" style={{ padding: "var(--space-3)" }}>
            <PanelTitle>Changes with the lens</PanelTitle>
            <ul className="story-rule-list" data-tone="ai">
              {content.changesWithTheLens.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="lens-auditstrip">
          <span>Audit trail. Every retrieval and every lens change is recorded.</span>
          <span className="story-control-spacer" />
          <span className="clamp-1">{content.economicNote}</span>
        </div>
      </div>
    </StageFit>
  );
}

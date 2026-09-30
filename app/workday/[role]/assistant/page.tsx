/**
 * Assistant: the Personal NFR Work Agent surface.
 *
 * Three things are shown before the input box, because all three change what
 * the answer to a question is worth: the mode in force, the autonomy level in
 * force, and the set of actions that level withholds.
 *
 * The withheld list is deliberately as prominent as the available list. An
 * autonomy change that alters what the assistant may do is one of the
 * product's signature moments, and it only reads as a real control if the user
 * can see what is being held back at the lower level.
 */

import { notFound } from "next/navigation";
import { isDatabaseReady } from "@/db/client";
import {
  AUTONOMY_LEVELS,
  ROLE_IDS,
  type AutonomyLevel,
  type RoleId,
} from "@/db/schema/core";
import { getRole, getUser } from "@/db/repositories/workday";
import { buildIntelligenceRail, uncertaintyFromEvidence } from "@/db/repositories/rail";
import { getScenarioState } from "@/scenario/engine/state";
import { NotSeeded, WorkdayShell } from "@/components/shell/WorkdayShell";
import { IntelligenceRail } from "@/components/shell/IntelligenceRail";
import { Chip, ObjectId, RegulatoryNote, type Tone } from "@/components/evidence/primitives";
import { getPublicHealth } from "@/server/config/runtime";
import {
  AUTONOMY_DESCRIPTIONS,
  ROLE_AUTHORITY_SCOPES,
  toolsAvailableAt,
  type AuthorityClass,
  type ToolDefinition,
} from "@/server/security/authority";
import { AssistantChatPanel } from "./chat-panel";
import type { Language } from "@/i18n/labels";

export const dynamic = "force-dynamic";

function parseRole(value: string): RoleId {
  if ((ROLE_IDS as readonly string[]).includes(value)) return value as RoleId;
  notFound();
}

const CLASS_ORDER: AuthorityClass[] = [
  "READ",
  "DRAFT",
  "PROPOSE",
  "POLICY_BOUND_AUTONOMOUS",
  "APPROVAL_REQUIRED",
  "PROHIBITED",
];

const CLASS_TONE: Record<string, Tone> = {
  READ: "neutral",
  DRAFT: "cyan",
  PROPOSE: "accent",
  POLICY_BOUND_AUTONOMOUS: "green",
  APPROVAL_REQUIRED: "amber",
  PROHIBITED: "red",
};

const CLASS_MEANING: Record<string, string> = {
  READ: "Reads data. Changes nothing.",
  DRAFT: "Produces text for a person to edit. Changes no record.",
  PROPOSE: "Produces a recommendation with alternatives. Changes no record.",
  POLICY_BOUND_AUTONOMOUS:
    "Low risk, reversible and routine. Executes without an approval only at the most permissive level.",
  APPROVAL_REQUIRED:
    "Changes a record materially. Never executes without a person's approval, at any level.",
  PROHIBITED: "Refused by design at every level. Present so that the refusal is explicit.",
};

export default async function AssistantPage({ params }: { params: Promise<{ role: string }> }) {
  const { role: roleParam } = await params;
  const roleId = parseRole(roleParam);

  if (!isDatabaseReady()) return <NotSeeded />;
  const state = getScenarioState();
  if (!state) return <NotSeeded />;

  const language = state.language as Language;
  const role = getRole(roleId);
  if (!role) return <NotSeeded />;

  const holder = getUser(role.holderUserId);
  const health = getPublicHealth();
  const autonomy = state.autonomyLevel;
  const description = AUTONOMY_DESCRIPTIONS[autonomy];
  const { available, withheld } = toolsAvailableAt(autonomy, roleId);
  const roleScopes = ROLE_AUTHORITY_SCOPES[roleId];

  /*
   * A free question may not reach a model in presenter safe and offline mode.
   * That is stated here rather than discovered when the answer turns out to be
   * a seeded paragraph.
   */
  const freeQuestionsMayNotReachAModel = health.mode !== "live";

  const availableByClass = CLASS_ORDER.map((authorityClass) => ({
    authorityClass,
    tools: available.filter((tool) => tool.authorityClass === authorityClass),
  })).filter((group) => group.tools.length > 0);

  const withheldByClass = CLASS_ORDER.map((authorityClass) => ({
    authorityClass,
    entries: withheld.filter((entry) => entry.tool.authorityClass === authorityClass),
  })).filter((group) => group.entries.length > 0);

  /* What the next level up would release. The comparison is the point. */
  const levelIndex = AUTONOMY_LEVELS.indexOf(autonomy);
  const nextLevel: AutonomyLevel | null =
    levelIndex >= 0 && levelIndex < AUTONOMY_LEVELS.length - 1
      ? (AUTONOMY_LEVELS[levelIndex + 1] ?? null)
      : null;
  const nextLevelAvailable = nextLevel ? toolsAvailableAt(nextLevel, roleId).available : [];
  const availableNames = new Set(available.map((tool) => tool.name));
  const wouldBeReleased = nextLevelAvailable.filter((tool) => !availableNames.has(tool.name));

  const rail = buildIntelligenceRail({
    roleId,
    atMoment: state.currentMoment,
    language,
    contextLabel: `Assistant for ${role.title} at ${state.currentMoment}. Autonomy ${description.label}, mode ${health.mode}. ${available.length} action(s) reachable, ${withheld.length} withheld.`,
    evidenceIds: [],
    whyThisMatters: [
      `The autonomy level is read from the scenario run by the gate itself, so what the interface shows here is what is actually enforced.`,
      `${withheld.length} action(s) are withheld at ${description.label}. Raising the level would release ${wouldBeReleased.length} of them; the material ones would still need an approval.`,
    ],
    uncertainty: [
      ...uncertaintyFromEvidence([]),
      ...(freeQuestionsMayNotReachAModel
        ? [
            {
              topic: `A free question may not reach a model in ${health.mode} mode`,
              description:
                "In presenter safe mode a question that matches a cached beat is answered from the cache, and one that does not may be answered from a seeded response. In offline mode no model is called at all. The answer is still honest about its source, but it is not a fresh model answer.",
              kind: "model-limit",
              resolutionPath:
                "Switch to live mode with a configured key to have free questions answered by a model.",
              materialToDecision: false,
              sourceIds: [],
            },
          ]
        : []),
    ],
  });

  return (
    <WorkdayShell
      roleId={roleId}
      activeNav="assistant"
      intelligenceRail={<IntelligenceRail {...rail} />}
    >
      <div className="stack stack-8">
        <header className="stack stack-3">
          <div className="row row-3 row-between row-wrap">
            <div className="stack stack-1">
              <span className="label">{state.currentMoment} &middot; Assistant</span>
              <h1 className="display" style={{ fontSize: "var(--text-2xl)" }}>
                Ask, within the authority in force
              </h1>
            </div>
            <div className="row row-2 row-wrap">
              <Chip
                tone={
                  health.mode === "live" ? "green" : health.mode === "safe" ? "cyan" : "neutral"
                }
              >
                {health.mode} mode
              </Chip>
              <Chip tone="accent">{description.label}</Chip>
              <Chip tone="green">{available.length} reachable</Chip>
              <Chip tone={withheld.length > 0 ? "red" : "neutral"}>
                {withheld.length} withheld
              </Chip>
            </div>
          </div>
          <p className="lede">
            The assistant answers for {holder?.name ?? role.holderUserId} as{" "}
            {language === "de" ? role.titleDe : role.title}. It can read the evidence corpus, draft
            and recommend. What it may change depends on the autonomy level, and that level is read
            from the scenario run by the authority gate rather than from this screen.
          </p>
        </header>

        {/* ---------------- Mode honesty ---------------- */}
        <section className="panel" aria-label="The mode in force">
          <div className="panel-head">
            <span className="panel-title">The mode in force</span>
            <span className="meta">
              requested {health.requestedMode}
              {health.modeDowngraded ? ", downgraded" : ", not downgraded"}
            </span>
          </div>
          <div className="panel-body stack stack-3">
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  <tr>
                    <th scope="row">Effective mode</th>
                    <td>
                      <Chip
                        tone={
                          health.mode === "live"
                            ? "green"
                            : health.mode === "safe"
                              ? "cyan"
                              : "neutral"
                        }
                      >
                        {health.mode}
                      </Chip>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Requested mode</th>
                    <td className="mono">{health.requestedMode}</td>
                  </tr>
                  <tr>
                    <th scope="row">Live AI configured</th>
                    <td>
                      <Chip tone={health.liveAiConfigured ? "green" : "amber"}>
                        {health.liveAiConfigured ? "yes" : "no"}
                      </Chip>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Configuration source</th>
                    <td className="mono">
                      {health.configurationSource}
                      {health.configurationVariable ? ` (${health.configurationVariable})` : ""}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Voice available</th>
                    <td>
                      <Chip tone={health.voiceAvailable ? "green" : "neutral"}>
                        {health.voiceAvailable ? "yes" : "no"}
                      </Chip>
                    </td>
                  </tr>
                  {health.modeReason ? (
                    <tr>
                      <th scope="row">Reason</th>
                      <td>{health.modeReason}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <p style={{ fontSize: "var(--text-sm)" }}>
              {freeQuestionsMayNotReachAModel ? (
                <>
                  In presenter safe and offline mode a free question may not reach a model at all.
                  The critical moments of the day are cached so they behave identically with no
                  network, and anything outside them is answered from a seeded response. The panel
                  below reports which of those produced each answer, so a seeded paragraph is never
                  presented as a fresh one.
                </>
              ) : (
                <>
                  Live mode is in force, so a free question is sent to a model. The panel below
                  reports the model, the source and the elapsed time for each turn.
                </>
              )}
            </p>
          </div>
        </section>

        {/* ---------------- Autonomy in force ---------------- */}
        <section className="panel" aria-label="The autonomy level in force">
          <div className="panel-head">
            <span className="panel-title">
              Autonomy in force: {description.label} / {description.labelDe}
            </span>
            <span className="meta">
              level {levelIndex + 1} of {AUTONOMY_LEVELS.length}
            </span>
          </div>
          <div className="panel-body stack stack-4">
            <p className="lede" style={{ fontSize: "var(--text-base)" }}>
              {description.detail}
            </p>

            <div className="row row-2 row-wrap">
              {AUTONOMY_LEVELS.map((level) => (
                <span
                  key={level}
                  className="chip"
                  data-tone={level === autonomy ? "accent" : "neutral"}
                  title={AUTONOMY_DESCRIPTIONS[level].detail}
                >
                  {AUTONOMY_DESCRIPTIONS[level].label}
                </span>
              ))}
            </div>

            <div className="stack stack-2">
              <span className="label">Authority scopes this role holds</span>
              <div className="row row-2 row-wrap">
                {roleScopes.map((scope) => (
                  <span key={scope} className="chip" data-tone="cyan">
                    <span className="mono">{scope}</span>
                  </span>
                ))}
              </div>
              <p className="meta">
                A level cannot grant a scope. An action needs both: an authority class the level can
                reach, and every scope the action requires.
              </p>
            </div>

            {nextLevel ? (
              <div className="stack stack-2">
                <span className="label">
                  What {AUTONOMY_DESCRIPTIONS[nextLevel].label} would release (
                  {wouldBeReleased.length})
                </span>
                {wouldBeReleased.length === 0 ? (
                  <p className="dim" style={{ fontSize: "var(--text-sm)" }}>
                    Nothing further. The next level releases no additional action for this role.
                  </p>
                ) : (
                  <div className="row row-2 row-wrap">
                    {wouldBeReleased.map((tool) => (
                      <span key={tool.name} className="chip" data-tone="amber">
                        <span className="mono">{tool.name}</span>
                      </span>
                    ))}
                  </div>
                )}
                <p className="meta">
                  Raising the level never makes a material change free. A material action keeps its
                  approval requirement at every level, including the most permissive one.
                </p>
              </div>
            ) : null}
          </div>
        </section>

        {/* ---------------- Withheld, first ---------------- */}
        <section className="stack stack-3" aria-label="Actions withheld at this level">
          <h2 style={{ fontSize: "var(--text-lg)", color: withheld.length > 0 ? "var(--red)" : undefined }}>
            Withheld at {description.label} ({withheld.length})
          </h2>
          {withheld.length === 0 ? (
            <div className="empty-state">
              <span className="label">Nothing withheld by the level</span>
              <p>
                Every action in the registry that this role holds the scopes for is reachable at this
                level. Material actions still require an approval.
              </p>
            </div>
          ) : (
            withheldByClass.map((group) => (
              <div key={group.authorityClass} className="panel">
                <div className="panel-head">
                  <span className="panel-title">
                    <Chip tone={CLASS_TONE[group.authorityClass] ?? "neutral"}>
                      {group.authorityClass}
                    </Chip>
                  </span>
                  <span className="meta">{CLASS_MEANING[group.authorityClass] ?? ""}</span>
                </div>
                <div className="panel-body">
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th scope="col">Action</th>
                          <th scope="col">What it would do</th>
                          <th scope="col">Why it is withheld</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.entries.map((entry) => (
                          <tr key={entry.tool.name}>
                            <td className="mono">{entry.tool.name}</td>
                            <td>{entry.tool.description}</td>
                            <td style={{ color: "var(--red)" }}>{entry.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))
          )}
        </section>

        {/* ---------------- Available ---------------- */}
        <section className="stack stack-3" aria-label="Actions available at this level">
          <h2 style={{ fontSize: "var(--text-lg)" }}>
            Available at {description.label} ({available.length})
          </h2>
          {availableByClass.map((group) => (
            <div key={group.authorityClass} className="panel">
              <div className="panel-head">
                <span className="panel-title">
                  <Chip tone={CLASS_TONE[group.authorityClass] ?? "neutral"}>
                    {group.authorityClass}
                  </Chip>
                </span>
                <span className="meta">{CLASS_MEANING[group.authorityClass] ?? ""}</span>
              </div>
              <div className="panel-body">
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">Action</th>
                        <th scope="col">What it does</th>
                        <th scope="col">Approval</th>
                        <th scope="col">Reversible</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.tools.map((tool) => (
                        <tr key={tool.name}>
                          <td className="mono">{tool.name}</td>
                          <td>{tool.description}</td>
                          <td>{approvalLabel(tool, autonomy)}</td>
                          <td>
                            <Chip tone={tool.reversible ? "green" : "amber"}>
                              {tool.reversible ? "yes" : "no"}
                            </Chip>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* ---------------- The chat panel ---------------- */}
        <section className="panel" aria-label="Assistant conversation">
          <div className="panel-head">
            <span className="panel-title">Conversation</span>
            <span className="meta">
              Answers, refusals and proposed actions are shown separately
            </span>
          </div>
          <div className="panel-body">
            <AssistantChatPanel
              roleId={roleId}
              mode={health.mode}
              freeQuestionsMayNotReachAModel={freeQuestionsMayNotReachAModel}
            />
          </div>
        </section>

        <footer className="stack stack-2">
          <RegulatoryNote language={language} />
          <div className="row row-3 row-wrap">
            <ObjectId id={role.specialistAgent} label="specialist agent" />
            <ObjectId id={state.runId} label="run" />
            <span className="meta">
              Every turn writes an agent run row and every tool call writes a tool call row, both
              visible in the intelligence rail and on the trust page.
            </span>
          </div>
        </footer>
      </div>
    </WorkdayShell>
  );
}

/** How an available action behaves at the level in force. */
function approvalLabel(tool: ToolDefinition, autonomy: AutonomyLevel): React.ReactNode {
  if (!tool.mutates) return <span className="muted">not needed, changes nothing</span>;
  if (tool.material) return <Chip tone="amber">always required</Chip>;
  if (tool.authorityClass === "POLICY_BOUND_AUTONOMOUS" && autonomy === "act-within-policy") {
    return <Chip tone="green">not required at this level</Chip>;
  }
  return <Chip tone="amber">required at this level</Chip>;
}

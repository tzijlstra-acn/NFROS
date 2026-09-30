/**
 * Role selection.
 *
 * The six lenses are presented as professional roles held by named people,
 * not as product modes. That framing matters: the audience should recognise
 * their own job, and the four deeply interactive roles are marked honestly so
 * nobody feels misled when the last two are lighter.
 */

import Link from "next/link";
import { isDatabaseReady } from "@/db/client";
import { getEntity, getRoles, getUser, getDecisions, getBackgroundWork } from "@/db/repositories/workday";
import { getScenarioState } from "@/scenario/engine/state";
import { NotSeeded } from "@/components/shell/WorkdayShell";
import { Chip, SyntheticLabel } from "@/components/evidence/primitives";
import { PRODUCT_COPY, t, type Language } from "@/i18n/labels";

export const dynamic = "force-dynamic";

export default function WorkdayIndexPage() {
  if (!isDatabaseReady()) return <NotSeeded />;
  const state = getScenarioState();
  if (!state) return <NotSeeded />;

  const language = state.language as Language;
  const roles = getRoles();

  return (
    <main
      id="main"
      style={{
        minHeight: "100vh",
        padding: "var(--space-10)",
        maxWidth: 1400,
        margin: "0 auto",
      }}
    >
      <div className="stack stack-8">
        <header className="stack stack-4">
          <div className="row row-between row-wrap row-4">
            <Link href="/" className="meta">
              Back to the entry screen
            </Link>
            <SyntheticLabel language={language} />
          </div>

          <div className="stack stack-3">
            <h1 className="display" style={{ fontSize: "var(--text-3xl)" }}>
              One work environment. Multiple professional lenses.
            </h1>
            <p className="lede">
              Choose the professional whose day you want to live. The scenario, the shared event at
              14:05 and any decisions already recorded are retained when you switch, so the same
              situation can be examined through a different professional question.
            </p>
            <div className="row row-4 row-wrap">
              <span className="chip" data-tone="cyan">
                Scenario day {state.scenarioDate.split("-").reverse().join(".")}
              </span>
              <span className="chip" data-tone="neutral">
                Clock at {state.currentMoment}
              </span>
              <span className="chip" data-tone={state.eventTriggered ? "red" : "neutral"}>
                {state.eventTriggered ? "The 14:05 event has occurred" : "Before the 14:05 event"}
              </span>
            </div>
          </div>
        </header>

        <div className="grid grid-2" style={{ gap: "var(--space-5)" }}>
          {roles.map((role) => {
            const holder = getUser(role.holderUserId);
            const entity = getEntity(role.entityId);
            const decisions = getDecisions(role.id, state.currentMoment);
            const open = decisions.filter((entry) => entry.decision.status === "open").length;
            const background = getBackgroundWork(role.id, state.currentMoment);

            return (
              <Link
                key={role.id}
                href={`/workday/${role.id}`}
                className="panel card-interactive"
                style={{ textDecoration: "none", display: "block" }}
              >
                <div className="panel-head">
                  <div className="stack stack-1">
                    <span className="panel-title">
                      {language === "de" ? role.titleDe : role.title}
                    </span>
                    <span className="meta">
                      {holder?.name} &middot; {entity?.shortName} &middot; {holder?.department}
                    </span>
                  </div>
                  {role.deeplyInteractive ? (
                    <Chip tone="accent">deeply interactive</Chip>
                  ) : (
                    <Chip tone="neutral">complete journey</Chip>
                  )}
                </div>

                <div className="panel-body stack stack-4">
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--text-2)" }}>{role.mandate}</p>

                  <div className="stack stack-2">
                    <span className="label">Decisions that stay with the human</span>
                    <div className="row row-2 row-wrap">
                      {role.humanOwnedDecisions.slice(0, 5).map((item) => (
                        <span key={item} className="chip" data-tone="amber">
                          {item}
                        </span>
                      ))}
                      {role.humanOwnedDecisions.length > 5 ? (
                        <span className="meta">
                          and {role.humanOwnedDecisions.length - 5} more
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="stack stack-2">
                    <span className="label">Hero view</span>
                    <span className="strong-text" style={{ fontSize: "var(--text-sm)" }}>
                      {role.heroVisualLabel}
                    </span>
                  </div>

                  <div
                    className="row row-4 row-wrap"
                    style={{ paddingTop: "var(--space-3)", borderTop: "1px solid var(--border-1)" }}
                  >
                    <span className="meta">
                      <span className="mono strong-text">{open}</span> open decision
                      {open === 1 ? "" : "s"}
                    </span>
                    <span className="meta">
                      <span className="mono strong-text">{background.total}</span> background actions
                      completed
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <footer className="stack stack-2">
          <p className="muted" style={{ fontSize: "var(--text-sm)", maxWidth: "80ch" }}>
            {t(PRODUCT_COPY, "regulatoryNote", language)} Arcadia Banking Group and every person,
            supplier, control and transaction in this prototype are synthetic.
          </p>
        </footer>
      </div>
    </main>
  );
}

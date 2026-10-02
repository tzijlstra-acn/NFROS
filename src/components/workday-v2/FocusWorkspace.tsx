/**
 * The focus workspace: the first thing a professional sees.
 *
 * The hierarchy is Now, then the rest of the queue, then the role work object.
 * That ordering is the redesign's central claim made structural. The V1 Today
 * route opened with a 36px heading and a narrative paragraph, so a user read
 * what the screen was before they could use it. Here the first element on the
 * page is the single thing that needs them.
 *
 * Now holds exactly one item. Not two, not a ranked list of five. A screen
 * that presents three equally weighted priorities has not prioritised
 * anything, and the point of the queue is that the partner has already done
 * the sorting the professional currently does by hand at 07:45.
 *
 * The Now card is rendered here and the remaining sections are delegated to
 * `FocusQueue`, with its `omitNeedsYou` flag set. That split avoids showing
 * the same item twice: the Now card IS the needs-you section, presented at
 * full weight rather than as a row.
 */

import type { ReactNode } from "react";
import { IconArrowRight } from "@tabler/icons-react";
import type { AutonomyLevel, RoleId } from "@/db/schema/core";
import type { NowDetail } from "@/db/repositories/focus";
import { FocusQueue } from "@/components/focus/FocusQueue";
import { momentAge, type FocusItemView, type FocusSection } from "@/workday/contracts";
import type { Language } from "@/i18n/labels";
import {
  AuthorityChip,
  Card,
  Chip,
  Data,
  Empty,
  ObjectRef,
  SourceRow,
} from "./primitives";
import { ContextTriggers } from "./ContextDrawer";
import type { DrawerTab } from "./ShellContext";

export interface FocusWorkspaceProps {
  roleId: RoleId;
  language: Language;
  currentMoment: string;
  autonomyLevel: AutonomyLevel;
  /** The one item that needs the user, with its supporting detail. */
  now: NowDetail | null;
  /** Every section, so the counts and the rows cannot disagree. */
  sections: Record<FocusSection, FocusItemView[]>;
  /** Counts for the compact context triggers. */
  contextCounts: Record<DrawerTab, number>;
  /** One line of context, never a paragraph. */
  contextLine: string;
  /** Objects that changed recently, for the row markers. */
  changedObjectIds?: readonly string[];
  selectedObjectId?: string | null;
  /** The role work object, lazily loaded by the caller. */
  workObject?: ReactNode;
  /** The eyebrow line: what is happening at this moment. */
  momentLabel: string;
}

export function FocusWorkspace({
  language,
  currentMoment,
  now,
  sections,
  contextCounts,
  contextLine,
  changedObjectIds = [],
  selectedObjectId = null,
  workObject,
  momentLabel,
}: FocusWorkspaceProps) {
  return (
    <div className="app-stack-6">
      <header className="app-workspace-head">
        <span className="app-eyebrow">
          <Data>{currentMoment}</Data>
          <span className="app-faint">{momentLabel}</span>
        </span>
        <h1 className="app-title">
          {now
            ? language === "de"
              ? "Das benoetigt Sie jetzt"
              : "This needs you now"
            : language === "de"
              ? "Nichts benoetigt Sie jetzt"
              : "Nothing needs you now"}
        </h1>
        <p className="app-one-line">{contextLine}</p>
      </header>

      {now ? (
        <NowCard
          now={now}
          language={language}
          currentMoment={currentMoment}
          contextCounts={contextCounts}
        />
      ) : (
        <Empty
          title={
            language === "de"
              ? "Keine Entscheidung liegt an diesem Punkt bei Ihnen"
              : "No decision is yours at this point"
          }
          detail={
            language === "de"
              ? "Spielen Sie den Tag weiter, bis das Urteil dieser Rolle gefragt ist."
              : "Play the day forward to reach the next point where this role's judgment is required."
          }
        />
      )}

      {/*
        * The remaining sections. `omitNeedsYou` is set because the Now card
        * above has already presented that section at full weight. The section
        * is still counted inside the queue, so the number the context line
        * states and the number of rows here cannot drift apart.
        */}
      <FocusQueue
        sections={sections}
        language={language}
        currentMoment={currentMoment}
        changedObjectIds={changedObjectIds}
        selectedObjectId={selectedObjectId}
        omitNeedsYou
      />

      {workObject ? <section className="app-section">{workObject}</section> : null}
    </div>
  );
}

/**
 * The one item that needs the user.
 *
 * Answers five questions in a fixed order: why it appeared, what changed, what
 * the partner already completed, what is needed from the user, and the next
 * action. The order is not arbitrary. A professional who does not know why
 * something is in front of them cannot judge whether the recommendation is
 * sound, and a professional who cannot see what was already done cannot tell
 * which part of the work is still theirs.
 *
 * This is one of the four places a Card is permitted.
 */
function NowCard({
  now,
  language,
  currentMoment,
  contextCounts,
}: {
  now: NowDetail;
  language: Language;
  currentMoment: string;
  contextCounts: Record<DrawerTab, number>;
}) {
  const item = now.item;

  return (
    <Card
      accent={item.severity === "critical" ? "danger" : "warning"}
      label={language === "de" ? "Jetzt" : "Now"}
      head={
        <>
          <span className="app-row">
            <Chip tone={item.severity === "critical" ? "danger" : "warning"}>
              {language === "de" ? "Jetzt" : "Now"}
            </Chip>
            <Data>{momentAge(item.arrivedAtMoment, currentMoment, language)}</Data>
            {item.dueMoment ? (
              <span className="app-meta">
                {language === "de" ? "faellig" : "due"} <Data>{item.dueMoment}</Data>
              </span>
            ) : null}
          </span>
          {item.authorityClass ? (
            <AuthorityChip authorityClass={item.authorityClass} language={language} />
          ) : null}
        </>
      }
    >
      <div className="app-stack-3">
        <h2 className="app-object-title">{item.title}</h2>

        <div className="app-row app-row-wrap">
          <span className="app-meta">{item.objectType}</span>
          <ObjectRef id={item.objectId} />
        </div>

        <p className="app-suggestion-body">{now.why}</p>

        {now.changed.length > 0 ? (
          <div className="app-stack-1">
            <span className="app-meta">{language === "de" ? "Was sich geaendert hat" : "What changed"}</span>
            <ul className="app-did-list">
              {now.changed.map((line, index) => (
                <li key={index} className="app-did-item">
                  <span className="app-dot" data-tone="info" aria-hidden="true" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {now.completed.length > 0 ? (
          <div className="app-stack-1">
            <span className="app-meta">
              {language === "de" ? "Bereits erledigt" : "Already completed"}
            </span>
            <ul className="app-did-list">
              {now.completed.map((line, index) => (
                <li key={index} className="app-did-item">
                  <span className="app-dot" data-tone="success" aria-hidden="true" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="app-notice" data-tone="warning">
          <span>
            <span className="app-strong">
              {language === "de" ? "Von Ihnen benoetigt" : "What is needed from you"}
            </span>
            <span style={{ display: "block", marginTop: 2 }}>{now.needs}</span>
          </span>
        </div>

        {now.sources.length > 0 ? (
          <SourceRow sources={now.sources} language={language} showNecessity />
        ) : null}

        <div className="app-row app-row-wrap">
          <a className="app-btn app-btn-primary" href={now.action.href}>
            {now.action.label}
            <IconArrowRight size={14} stroke={2} aria-hidden="true" />
          </a>
          <ContextTriggers counts={contextCounts} language={language} />
        </div>
      </div>
    </Card>
  );
}

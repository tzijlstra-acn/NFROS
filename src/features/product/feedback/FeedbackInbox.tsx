/**
 * The feedback inbox of the Product Owner Console (plan 7.8).
 *
 * Open items first (new, triaged, planned, in a release), each with what the
 * person said, where they were, and one triage form: status, severity, owner,
 * and the links to a feature, a Role App, a stage and the release that
 * addresses it. Then the AI feedback that has not been forwarded yet.
 * Quiet by default: closed and declined items are behind "All".
 *
 * Server component. The forms post to server actions that go through
 * `governConsoleAction` (`feedback.triage`, and `feedback.assign` when the
 * owner changes).
 */

import Link from "next/link";
import { SettingsHead, SettingsSection } from "@/components/settings/primitives";
import { Chip, Data, Empty, Item, List, Notice, ObjectRef } from "@/components/workday-v2/primitives";
import type { Language } from "@/i18n/labels";
import { ROLE_APP_REGISTRY } from "@/role-apps/registry";
import { PRODUCT_FEEDBACK_STATUSES, SEVERITIES } from "@/db/schema/product-console";
import { listProductFeedback, countProductFeedbackByStatus, type ProductFeedbackItem } from "@/db/repositories/product-feedback";
import { listAIFeedback } from "@/db/repositories/ai-feedback";
import { getRoleRelease } from "@/product/release";
import { checkConsolePermission, type Bilingual } from "@/features/product/permissions";
import { readActingConsoleIdentity } from "@/features/product/persona/acting";
import { ConsoleActionForm } from "@/features/product/forms/ConsoleActionForm";
import { CONSOLE_COPY } from "@/features/product/shell/copy";
import { consoleInputStyle, consoleLabelStyle, consoleTextareaStyle, consoleWrapStyle } from "@/features/product/shell/styles";
import { FEEDBACK_KIND_LABELS as AI_KIND_LABELS } from "@/features/product/quality/copy";
import { actionForwardAIFeedback, actionTriageFeedback } from "./actions";
import { AI_TO_PRODUCT_KIND, FEEDBACK_OWNERS, stagesForRoleApp } from "./operations";
import { FEEDBACK_COPY as COPY, FEEDBACK_KIND_LABELS, FEEDBACK_STATUS_LABELS, SEVERITY_LABELS } from "./copy";

const OPEN_STATUSES = ["new", "triaged", "planned", "in-release"] as const;

const fieldGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
  gap: "var(--app-2) var(--app-3)",
} as const;

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

export async function FeedbackInbox({ language, showAll }: { language: Language; showAll: boolean }) {
  const say = (pair: Bilingual) => (language === "de" ? pair.de : pair.en);
  const identity = await readActingConsoleIdentity();
  const triage = checkConsolePermission(identity.scopes, "feedback.triage");
  const triageReason = triage.allowed ? null : say(triage.reason);

  let items: ProductFeedbackItem[];
  let counts: ReturnType<typeof countProductFeedbackByStatus>;
  let waiting: ReturnType<typeof listAIFeedback>;
  try {
    items = listProductFeedback(showAll ? {} : { statuses: OPEN_STATUSES });
    counts = countProductFeedbackByStatus();
    waiting = listAIFeedback({ forwarded: false, limit: 50 });
  } catch {
    return (
      <div className="app-stack app-stack-6">
        <SettingsHead eyebrow={say(CONSOLE_COPY.eyebrow)} title={say(COPY.title)} lede={say(COPY.lede)} />
        <Notice tone="warning">{say(COPY.unavailable)}</Notice>
      </div>
    );
  }
  const openCount = OPEN_STATUSES.reduce((sum, status) => sum + counts[status], 0);
  const apps = ROLE_APP_REGISTRY.filter((app) => app.status === "installed");

  return (
    <div className="app-stack app-stack-6" data-testid="feedback-inbox">
      <SettingsHead eyebrow={say(CONSOLE_COPY.eyebrow)} title={say(COPY.title)} lede={say(COPY.lede)} />

      <SettingsSection
        title={say(COPY.inbox)}
        count={items.length}
        trailing={
          <span className="app-row app-row-wrap">
            <span className="app-meta">{fill(say(COPY.counts), { new: counts.new, open: openCount })}</span>
            <Link href={showAll ? "/product/feedback" : "/product/feedback?status=all"} className="app-source-link">
              {showAll ? say(COPY.open) : say(COPY.all)}
            </Link>
          </span>
        }
      >
        {items.length === 0 ? (
          <Empty title={say(COPY.empty)} detail={say(COPY.emptyDetail)} />
        ) : (
          <List label={say(COPY.inbox)}>
            {items.map((item) => (
              <Item
                key={item.id}
                title={
                  <span className="app-row app-row-wrap" data-testid={`feedback-item-${item.id}`}>
                    <Chip tone="info">{say(FEEDBACK_KIND_LABELS[item.kind] ?? { en: item.kind, de: item.kind })}</Chip>
                    <Chip tone={item.status === "new" ? "warning" : item.status === "closed" ? "success" : "neutral"}>
                      {say(FEEDBACK_STATUS_LABELS[item.status] ?? { en: item.status, de: item.status })}
                    </Chip>
                    {item.severity ? <Chip tone={item.severity === "critical" || item.severity === "high" ? "danger" : "neutral"}>{say(SEVERITY_LABELS[item.severity] ?? { en: item.severity, de: item.severity })}</Chip> : null}
                    <span style={consoleWrapStyle}>{item.summary}</span>
                  </span>
                }
                subtitle={
                  <span className="app-stack app-stack-1">
                    <span className="app-row app-row-wrap">
                      <ObjectRef id={item.id} />
                      <Data>{item.submittedAt.slice(0, 16).replace("T", " ")}</Data>
                      {item.roleId ? <span>{getRoleRelease(item.roleId)?.releaseLabel ?? item.roleId}</span> : null}
                      {item.route ? <span className="app-oid">{item.route}</span> : null}
                      {item.aiFeedbackId ? <span className="app-oid">{item.aiFeedbackId}</span> : null}
                    </span>
                    {item.detail.length > 0 ? <span className="app-meta" style={consoleWrapStyle}>{item.detail}</span> : null}
                  </span>
                }
              >
                <ConsoleActionForm
                  action={actionTriageFeedback}
                  language={language}
                  label={say(COPY.triage)}
                  hidden={{ feedbackId: item.id }}
                  permitted={triage.allowed}
                  blockedReason={triageReason}
                  testId={`feedback-triage-${item.id}`}
                  fields={
                    <div className="app-stack app-stack-2">
                      <div style={fieldGrid}>
                        <label style={consoleLabelStyle}>
                          {say(COPY.status)}
                          <select name="status" defaultValue={item.status} style={consoleInputStyle}>
                            {PRODUCT_FEEDBACK_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {say(FEEDBACK_STATUS_LABELS[status] ?? { en: status, de: status })}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label style={consoleLabelStyle}>
                          {say(COPY.severity)}
                          <select name="severity" defaultValue={item.severity ?? ""} style={consoleInputStyle}>
                            <option value="">{say(COPY.notSet)}</option>
                            {SEVERITIES.map((severity) => (
                              <option key={severity} value={severity}>
                                {say(SEVERITY_LABELS[severity] ?? { en: severity, de: severity })}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label style={consoleLabelStyle}>
                          {say(COPY.owner)}
                          <select name="ownerLabel" defaultValue={item.ownerLabel ?? ""} style={consoleInputStyle}>
                            <option value="">{say(COPY.notSet)}</option>
                            {FEEDBACK_OWNERS.map((owner) => (
                              <option key={owner.en} value={owner.en}>
                                {say(owner)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label style={consoleLabelStyle}>
                          {say(COPY.feature)}
                          <input name="featureKey" defaultValue={item.featureKey ?? ""} style={consoleInputStyle} />
                        </label>
                        <label style={consoleLabelStyle}>
                          {say(COPY.roleApp)}
                          <select name="roleAppId" defaultValue={item.roleAppId ?? ""} style={consoleInputStyle}>
                            <option value="">{say(COPY.notSet)}</option>
                            {apps.map((app) => (
                              <option key={app.id} value={app.id}>
                                {language === "de" ? app.nameDe : app.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label style={consoleLabelStyle}>
                          {say(COPY.stage)}
                          <select name="stageId" defaultValue={item.stageId ?? ""} style={consoleInputStyle}>
                            <option value="">{say(COPY.notSet)}</option>
                            {apps.map((app) => (
                              <optgroup key={app.id} label={language === "de" ? app.nameDe : app.name}>
                                {stagesForRoleApp(app.id).map((stage) => (
                                  <option key={`${app.id}:${stage.id}`} value={stage.id}>
                                    {say(stage.label)}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </label>
                        <label style={consoleLabelStyle}>
                          {say(COPY.release)}
                          <input name="releaseVersion" defaultValue={item.releaseVersion ?? ""} placeholder="4.2.0" style={consoleInputStyle} />
                        </label>
                      </div>
                      <label style={consoleLabelStyle}>
                        {say(COPY.resolution)}
                        <textarea name="resolution" rows={1} defaultValue={item.resolution} style={consoleTextareaStyle} />
                      </label>
                    </div>
                  }
                />
              </Item>
            ))}
          </List>
        )}
      </SettingsSection>

      <SettingsSection title={say(COPY.aiFeedback)} count={waiting.length}>
        <div className="app-stack app-stack-3">
          <span className="app-meta" style={consoleWrapStyle}>{say(COPY.aiFeedbackNote)}</span>
          {waiting.length === 0 ? (
            <Empty title={say(COPY.aiEmpty)} />
          ) : (
            <List label={say(COPY.aiFeedback)}>
              {waiting.map((feedback) => (
                <Item
                  key={feedback.id}
                  title={
                    <span className="app-row app-row-wrap">
                      <Chip tone="ai">{say(AI_KIND_LABELS[feedback.kind])}</Chip>
                      <span style={consoleWrapStyle}>{feedback.comment || `${feedback.taskKind}: ${feedback.targetKind} ${feedback.targetId}`}</span>
                    </span>
                  }
                  subtitle={
                    <span className="app-row app-row-wrap">
                      <ObjectRef id={feedback.id} />
                      <span>{getRoleRelease(feedback.roleId)?.releaseLabel ?? feedback.roleId}</span>
                      {feedback.configurationId ? <span className="app-oid">{feedback.configurationId}</span> : null}
                      <Data>{feedback.createdAt.slice(0, 16).replace("T", " ")}</Data>
                    </span>
                  }
                >
                  {AI_TO_PRODUCT_KIND[feedback.kind] ? (
                    <ConsoleActionForm
                      action={actionForwardAIFeedback}
                      language={language}
                      label={say(COPY.forward)}
                      hidden={{ aiFeedbackId: feedback.id }}
                      permitted={triage.allowed}
                      blockedReason={triageReason}
                      testId={`feedback-forward-${feedback.id}`}
                    />
                  ) : null}
                </Item>
              ))}
            </List>
          )}
        </div>
      </SettingsSection>
    </div>
  );
}

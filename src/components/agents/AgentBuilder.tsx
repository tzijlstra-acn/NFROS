"use client";

/**
 * The four-step agent builder and the person's agents.
 *
 *   1. Describe the outcome   the person's words, and the name it will carry;
 *   2. Scope and permissions  what it reads, what it may propose, what it
 *                             may never do, and the moment its records are
 *                             read at: it inherits the person's access;
 *   3. The plan               the steps it takes, in plain language;
 *   4. Run and save           run once, save, schedule weekly, or submit it
 *                             for review as a team template.
 *
 * Steps 1 to 3 are prepared on the server from the analysis the agent is
 * built on; this component holds the choices of step 4 and the list.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconCalendarRepeat, IconCheck, IconLoader2, IconPlayerPlay, IconSend, IconTrash, IconUsersGroup } from "@tabler/icons-react";
import { actionCreateAgent, actionRunAgent, actionSetAgentStatus } from "../../../app/workday/[role]/agents/actions";

type Language = "en" | "de";

export interface BuilderModel {
  question: string;
  intentId: string;
  defaultName: string;
  sourceInsightId: string | null;
  sources: string[];
  proposes: string[];
  plan: string[];
  dataAsOf: string;
  roleLabel: string;
  holderName: string;
  scopeCount: number;
}

export interface AgentListItem {
  id: string;
  name: string;
  question: string;
  schedule: string;
  status: string;
  runCount: number;
  lastRunAt: string | null;
  lastRunInsightId: string | null;
  runs: Array<{ id: string; moment: string; conclusion: string }>;
}

const COPY = {
  step1: { en: "1. Describe the outcome", de: "1. Ergebnis beschreiben" },
  step2: { en: "2. Scope and permissions", de: "2. Umfang und Berechtigungen" },
  step3: { en: "3. The plan", de: "3. Der Plan" },
  step4: { en: "4. Run and save", de: "4. Ausfuehren und speichern" },
  outcome: { en: "What it should tell you", de: "Was er Ihnen sagen soll" },
  name: { en: "Name", de: "Name" },
  inherits: { en: "This agent inherits your access. It does not create new access.", de: "Dieser Agent erbt Ihren Zugriff. Er schafft keinen neuen Zugriff." },
  actingAs: { en: "Acting as", de: "Handelt als" },
  scopes: { en: "{count} authority scopes, the same as yours", de: "{count} Befugnisbereiche, dieselben wie Ihre" },
  reads: { en: "Reads", de: "Liest" },
  mayPropose: { en: "May propose, for your approval", de: "Darf vorschlagen, zu Ihrer Genehmigung" },
  never: { en: "Never", de: "Niemals" },
  neverItems: {
    en: ["changes a record without your approval", "reads beyond your role and the current moment", "runs code or sends anything outside this machine"],
    de: ["aendert einen Datensatz ohne Ihre Genehmigung", "liest ueber Ihre Rolle und den aktuellen Moment hinaus", "fuehrt Code aus oder sendet etwas nach aussen"],
  },
  freshness: { en: "Records as of", de: "Datensaetze mit Stand" },
  runOnce: { en: "Run once", de: "Einmal ausfuehren" },
  save: { en: "Save to My agents", de: "Unter Meine Agenten speichern" },
  schedule: { en: "Save and run weekly", de: "Speichern, woechentlich ausfuehren" },
  submit: { en: "Request team template", de: "Teamvorlage beantragen" },
  saved: { en: "Saved", de: "Gespeichert" },
  mine: { en: "My agents", de: "Meine Agenten" },
  none: { en: "No agent saved yet. Save one from any analysis with Save as agent.", de: "Noch kein Agent gespeichert. Speichern Sie einen aus jeder Analyse mit Als Agent speichern." },
  run: { en: "Run now", de: "Jetzt ausfuehren" },
  retire: { en: "Retire", de: "Ausser Betrieb nehmen" },
  runs: { en: "Run history", de: "Laufhistorie" },
  never_run: { en: "Not run yet", de: "Noch nicht ausgefuehrt" },
  status: {
    personal: { en: "Personal", de: "Persoenlich" },
    submitted: { en: "Submitted for team review", de: "Zur Teampruefung eingereicht" },
    template: { en: "Team template", de: "Teamvorlage" },
    retired: { en: "Retired", de: "Ausser Betrieb" },
  },
  schedules: { manual: { en: "On demand", de: "Bei Bedarf" }, weekly: { en: "Weekly, Monday 07:00", de: "Woechentlich, Montag 07:00" } },
} as const;

function pick(pair: { en: string; de: string }, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

export function AgentBuilder({ roleId, language, model }: { roleId: string; language: Language; model: BuilderModel }) {
  const router = useRouter();
  const [name, setName] = useState(model.defaultName);
  const [outcome, setOutcome] = useState(model.question);
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function save(schedule: "manual" | "weekly", submit: boolean, key: string) {
    setBusy(key);
    const result = await actionCreateAgent({ roleId, name, outcome, question: model.question, intentId: model.intentId, schedule, submit, sourceInsightId: model.sourceInsightId });
    setBusy(null);
    if (result.ok) {
      setSaved(key);
      router.refresh();
    }
  }

  async function runOnce() {
    setBusy("run");
    router.push(`/workday/${roleId}/insights?q=${encodeURIComponent(model.question)}`);
  }

  const card = { padding: 16 } as const;
  return (
    <section className="ins-card" aria-label={language === "de" ? "Agent erstellen" : "Build an agent"} data-testid="agent-builder">
      <div className="ins-card-body" style={{ display: "grid", gap: 20 }}>
        <div>
          <h2 className="ins-section-title">{pick(COPY.step1, language)}</h2>
          <label className="ws-field" style={{ display: "grid", gap: 6, marginTop: 10 }}>
            <span className="ins-section-sub">{pick(COPY.outcome, language)}</span>
            <textarea className="ws-input" style={{ height: 64, padding: 10 }} value={outcome} onChange={(event) => setOutcome(event.target.value)} />
          </label>
          <label className="ws-field" style={{ display: "grid", gap: 6, marginTop: 10 }}>
            <span className="ins-section-sub">{pick(COPY.name, language)}</span>
            <input className="ws-input" value={name} onChange={(event) => setName(event.target.value)} data-testid="agent-name" />
          </label>
        </div>

        <div>
          <h2 className="ins-section-title">{pick(COPY.step2, language)}</h2>
          <p className="ins-explain" style={{ fontWeight: 600 }}>{pick(COPY.inherits, language)}</p>
          <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, margin: "12px 0 0" }}>
            <div className="ins-rec" style={card}>
              <dt className="ins-rec-urgency">{pick(COPY.actingAs, language)}</dt>
              <dd className="ins-rec-title" style={{ margin: "4px 0 0" }}>{model.holderName}, {model.roleLabel}</dd>
              <dd className="ins-rec-rationale" style={{ margin: "4px 0 0" }}>{pick(COPY.scopes, language).replace("{count}", String(model.scopeCount))}</dd>
            </div>
            <div className="ins-rec" style={card}>
              <dt className="ins-rec-urgency">{pick(COPY.reads, language)}</dt>
              <dd className="ins-rec-rationale" style={{ margin: "4px 0 0" }}>{model.sources.join(", ")}</dd>
              <dd className="ins-rec-rationale" style={{ margin: "4px 0 0" }}>{pick(COPY.freshness, language)} {model.dataAsOf}</dd>
            </div>
            <div className="ins-rec" style={card}>
              <dt className="ins-rec-urgency">{pick(COPY.mayPropose, language)}</dt>
              <dd className="ins-rec-rationale" style={{ margin: "4px 0 0" }}>{model.proposes.length ? model.proposes.join(", ") : "n/a"}</dd>
            </div>
            <div className="ins-rec" style={card}>
              <dt className="ins-rec-urgency">{pick(COPY.never, language)}</dt>
              <dd className="ins-rec-rationale" style={{ margin: "4px 0 0" }}>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {COPY.neverItems[language].map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>
        </div>

        <div>
          <h2 className="ins-section-title">{pick(COPY.step3, language)}</h2>
          <ol style={{ margin: "10px 0 0", paddingLeft: 20, display: "grid", gap: 6, fontSize: 14 }}>
            {model.plan.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>

        <div>
          <h2 className="ins-section-title">{pick(COPY.step4, language)}</h2>
          <div className="ins-followups" style={{ marginTop: 10 }}>
            <button type="button" className="wd-btn wd-btn-secondary wd-btn-lg" onClick={runOnce} disabled={busy !== null}>
              {busy === "run" ? <IconLoader2 size={16} className="ws-spin" aria-hidden="true" /> : <IconPlayerPlay size={16} stroke={1.8} aria-hidden="true" />}
              {pick(COPY.runOnce, language)}
            </button>
            <button type="button" className="wd-btn wd-btn-primary wd-btn-lg" onClick={() => save("manual", false, "save")} disabled={busy !== null || saved !== null} data-testid="agent-save">
              {saved === "save" ? <IconCheck size={16} aria-hidden="true" /> : null}
              {saved === "save" ? pick(COPY.saved, language) : pick(COPY.save, language)}
            </button>
            <button type="button" className="wd-btn wd-btn-secondary wd-btn-lg" onClick={() => save("weekly", false, "weekly")} disabled={busy !== null || saved !== null}>
              <IconCalendarRepeat size={16} stroke={1.8} aria-hidden="true" />
              {saved === "weekly" ? pick(COPY.saved, language) : pick(COPY.schedule, language)}
            </button>
            <button type="button" className="wd-btn wd-btn-secondary wd-btn-lg" onClick={() => save("manual", true, "submit")} disabled={busy !== null || saved !== null}>
              <IconUsersGroup size={16} stroke={1.8} aria-hidden="true" />
              {saved === "submit" ? pick(COPY.saved, language) : pick(COPY.submit, language)}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function MyAgents({ roleId, language, agents }: { roleId: string; language: Language; agents: AgentListItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(agentId: string) {
    setBusy(agentId);
    const result = await actionRunAgent({ roleId, agentId });
    setBusy(null);
    if (result.ok && result.insightId) router.push(`/workday/${roleId}/insights/${result.insightId}`);
  }

  async function status(agentId: string, next: "submitted" | "retired") {
    setBusy(agentId);
    await actionSetAgentStatus({ roleId, agentId, status: next });
    setBusy(null);
    router.refresh();
  }

  return (
    <section aria-labelledby="my-agents" data-testid="my-agents">
      <h2 id="my-agents" className="ins-section-title" style={{ marginBottom: 10 }}>{pick(COPY.mine, language)}</h2>
      {agents.length === 0 ? (
        <p className="ins-section-sub">{pick(COPY.none, language)}</p>
      ) : (
        <ul style={{ display: "grid", gap: 10, margin: 0, padding: 0, listStyle: "none" }}>
          {agents.map((agent) => (
            <li key={agent.id} className="ins-rec" data-testid={`agent-${agent.id}`}>
              <span className="ins-rec-urgency">
                {pick(COPY.status[agent.status as keyof typeof COPY.status] ?? COPY.status.personal, language)} · {pick(COPY.schedules[agent.schedule as keyof typeof COPY.schedules] ?? COPY.schedules.manual, language)} · {agent.runCount} {language === "de" ? "Laeufe" : agent.runCount === 1 ? "run" : "runs"}
              </span>
              <p className="ins-rec-title">{agent.name}</p>
              <p className="ins-rec-rationale">{agent.question}</p>
              {agent.runs.length ? (
                <div style={{ margin: "0 0 10px" }}>
                  <span className="ins-section-sub">{pick(COPY.runs, language)}</span>
                  <ul style={{ margin: "4px 0 0", paddingLeft: 16, fontSize: 12, color: "var(--wd-text-secondary)" }}>
                    {agent.runs.map((entry) => (
                      <li key={entry.id}>
                        <a href={`/workday/${roleId}/insights/${entry.id}`}>{entry.moment}</a>: {entry.conclusion.slice(0, 140)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="ins-section-sub" style={{ margin: "0 0 10px" }}>{pick(COPY.never_run, language)}</p>
              )}
              {agent.status !== "retired" ? (
                <div className="ins-followups">
                  <button type="button" className="wd-btn wd-btn-primary wd-btn-sm" onClick={() => run(agent.id)} disabled={busy !== null} data-testid={`agent-run-${agent.id}`}>
                    {busy === agent.id ? <IconLoader2 size={14} className="ws-spin" aria-hidden="true" /> : <IconPlayerPlay size={14} stroke={1.8} aria-hidden="true" />}
                    {pick(COPY.run, language)}
                  </button>
                  {agent.status === "personal" ? (
                    <button type="button" className="wd-btn wd-btn-secondary wd-btn-sm" onClick={() => status(agent.id, "submitted")} disabled={busy !== null}>
                      <IconSend size={14} stroke={1.8} aria-hidden="true" />
                      {pick(COPY.submit, language)}
                    </button>
                  ) : null}
                  <button type="button" className="wd-btn wd-btn-quiet wd-btn-sm" onClick={() => status(agent.id, "retired")} disabled={busy !== null}>
                    <IconTrash size={14} stroke={1.8} aria-hidden="true" />
                    {pick(COPY.retire, language)}
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

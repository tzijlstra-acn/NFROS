/**
 * The success measures of plan section 12, as this environment can answer
 * them.
 *
 * Server only. Thirty-five measures in four groups (user, product owner,
 * control, commercial), each with one of three answers:
 *
 *   measured        the product counted it here, and the source is named
 *   not measured    the product could measure it, but nothing it records
 *                   answers it yet, or the answer needs a design partner
 *   not applicable  the product must never measure it in this environment
 *                   (a person's time, a client's commercial choice)
 *
 * A measured value carries a status in the product vocabulary:
 *
 *   Verified / Not verified   a control check over the product's own
 *                             records, which passed or did not
 *   Simulated                 a figure produced by activity in the
 *                             synthetic institution: evidence the
 *                             measurement works, never a result
 *   Empty                     the source works and holds nothing yet
 *
 * Commercial measures are never measured here. Plan section 12: "Do not
 * calculate a commercial outcome from synthetic data." The group exists so
 * the product owner sees the whole set and where it stops, not so it can be
 * filled.
 *
 * No measure ranks, scores or names an employee. Every count is per role,
 * per Role App or for the product as a whole.
 */

import { getSqlite } from "@/db/client";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import { listPilotMeasureReadings, listPilotMeasures, listPilotProgrammes } from "@/db/repositories/pilot";
import { countProductFeedbackByStatus } from "@/db/repositories/product-feedback";
import { getLatestReleaseGateRun } from "@/db/repositories/release-management";
import { PRODUCT_RELEASE } from "@/product/release";
import { readAuditIntegrity, readConnectorStatusCounts, readEvaluationEvidence } from "@/product/status/sources";
import { reading, type StatusReading } from "@/product/status/vocabulary";
import { getScenarioState } from "@/scenario/engine/state";
import { ROLE_APP_REGISTRY } from "@/role-apps/registry";

type Bilingual = { en: string; de: string };

export type ValueGroupId = "user" | "product-owner" | "control" | "commercial";
export type MeasureState = "measured" | "not-measured" | "not-applicable";

export interface ValueMeasure {
  id: string;
  group: ValueGroupId;
  label: Bilingual;
  state: MeasureState;
  /** The figure, in words, when measured. Null otherwise. */
  value: Bilingual | null;
  reading: StatusReading;
  /** The tables or files the answer is read from, or why there is none. */
  source: string;
}

export interface ValueGroup {
  id: ValueGroupId;
  label: Bilingual;
  measures: ValueMeasure[];
}

/* ==========================================================================
   Helpers
   ========================================================================== */

function runIdNow(): string {
  try {
    return getScenarioState()?.runId ?? DEFAULT_RUN_ID;
  } catch {
    return DEFAULT_RUN_ID;
  }
}

/** One row, or null when the table cannot be read. */
function one<T>(sql: string, ...params: unknown[]): T | null {
  try {
    return (getSqlite().prepare(sql).get(...params) as T | undefined) ?? null;
  } catch {
    return null;
  }
}

function all<T>(sql: string, ...params: unknown[]): T[] | null {
  try {
    return getSqlite().prepare(sql).all(...params) as T[];
  } catch {
    return null;
  }
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 1 ? sorted[middle] : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
  return value ?? null;
}

function minutesOf(moment: string | null): number | null {
  if (!moment) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(moment.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function percent(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

function both(en: string, de: string): Bilingual {
  return { en, de };
}

function measured(
  id: string,
  group: ValueGroupId,
  label: Bilingual,
  value: Bilingual | null,
  status: StatusReading,
  source: string,
): ValueMeasure {
  return { id, group, label, state: "measured", value, reading: status, source };
}

function notMeasured(id: string, group: ValueGroupId, label: Bilingual, en: string, de: string, source: string): ValueMeasure {
  return { id, group, label, state: "not-measured", value: null, reading: reading("unavailable", en, de), source };
}

function notApplicable(id: string, group: ValueGroupId, label: Bilingual, en: string, de: string): ValueMeasure {
  return { id, group, label, state: "not-applicable", value: null, reading: reading("unavailable", en, de), source: "none" };
}

function unreadable(id: string, group: ValueGroupId, label: Bilingual, source: string): ValueMeasure {
  return {
    id,
    group,
    label,
    state: "not-measured",
    value: null,
    reading: reading("unavailable", "The source could not be read.", "Die Quelle konnte nicht gelesen werden."),
    source,
  };
}

const SYNTHETIC_NOTE = both(
  "Counted from activity in the synthetic institution. It shows the measurement works; it is not a result.",
  "Aus Aktivitaet in der synthetischen Institution gezaehlt. Es zeigt, dass die Messung funktioniert; es ist kein Ergebnis.",
);

function simulated(en: string, de: string): StatusReading {
  return reading("simulated", `${en} ${SYNTHETIC_NOTE.en}`, `${de} ${SYNTHETIC_NOTE.de}`);
}

/* ==========================================================================
   User success
   ========================================================================== */

function userMeasures(runId: string): ValueMeasure[] {
  const group: ValueGroupId = "user";
  const measures: ValueMeasure[] = [];

  /* Time to first meaningful action: per role and day, never per person. */
  {
    const label = both("Time to first meaningful action", "Zeit bis zur ersten wirksamen Handlung");
    const opened = all<{ roleId: string | null; day: string; first: string }>(
      `SELECT role_id AS roleId, substr(occurred_at, 1, 10) AS day, min(occurred_at) AS first
         FROM experience_events WHERE run_id = ? AND kind = 'workday-opened' GROUP BY role_id, day`,
      runId,
    );
    if (opened === null) measures.push(unreadable("time-to-first-action", group, label, "experience_events, os_events"));
    else if (opened.length === 0) {
      measures.push(
        notMeasured(
          "time-to-first-action",
          group,
          label,
          "The experience recorder holds no workday-opened event in this environment, so the start of a working day is not known.",
          "Der Nutzungsrekorder enthaelt in dieser Umgebung kein Ereignis zum Oeffnen des Arbeitstags, daher ist der Beginn eines Arbeitstags unbekannt.",
          "experience_events (workday-opened), os_events",
        ),
      );
    } else {
      const gaps: number[] = [];
      for (const entry of opened) {
        if (!entry.roleId) continue;
        const next = one<{ at: string | null }>(
          `SELECT min(occurred_at) AS at FROM os_events WHERE run_id = ? AND role_id = ? AND actor_kind = 'human'
              AND occurred_at >= ? AND substr(occurred_at, 1, 10) = ?`,
          runId,
          entry.roleId,
          entry.first,
          entry.day,
        );
        if (next?.at) gaps.push((Date.parse(next.at) - Date.parse(entry.first)) / 60_000);
      }
      const value = median(gaps);
      measures.push(
        value === null
          ? measured("time-to-first-action", group, label, null, reading("empty", "No action by a person followed an opened working day yet.", "Auf einen geoeffneten Arbeitstag folgte noch keine Handlung einer Person."), "experience_events, os_events")
          : measured(
              "time-to-first-action",
              group,
              label,
              both(`Median ${Math.round(value)} minutes over ${gaps.length} role days`, `Median ${Math.round(value)} Minuten ueber ${gaps.length} Rollentage`),
              simulated("From the first opened working day of each role to the first action by a person.", "Vom ersten geoeffneten Arbeitstag je Rolle bis zur ersten Handlung einer Person."),
              "experience_events, os_events",
            ),
      );
    }
  }

  measures.push(
    notApplicable(
      "meeting-preparation-time",
      group,
      both("Meeting preparation time", "Vorbereitungszeit fuer Besprechungen"),
      "The product does not time people. Preparation time is part of the design partner's own baseline, recorded by the pilot lead.",
      "Das Produkt misst keine Arbeitszeit von Personen. Die Vorbereitungszeit gehoert zur Ausgangslage des Designpartners, erfasst von der Pilotleitung.",
    ),
  );

  /* Minutes confirmation time: meeting held to minutes confirmed. */
  {
    const label = both("Minutes confirmation time", "Zeit bis zur Bestaetigung des Protokolls");
    const rows = all<{ heldAt: string | null; confirmedAt: string | null }>(
      `SELECT coalesce(m.held_at, m.concluded_at) AS heldAt, mm.confirmed_at AS confirmedAt
         FROM meeting_minutes mm JOIN meetings m ON m.id = mm.meeting_id AND m.run_id = mm.run_id
        WHERE mm.run_id = ? AND mm.confirmed_at IS NOT NULL`,
      runId,
    );
    if (rows === null) measures.push(unreadable("minutes-confirmation-time", group, label, "meeting_minutes, meetings"));
    else {
      const gaps = rows
        .map((row) => (row.heldAt && row.confirmedAt ? (Date.parse(row.confirmedAt) - Date.parse(row.heldAt)) / 60_000 : Number.NaN))
        .filter((minutes) => Number.isFinite(minutes) && minutes >= 0);
      const value = median(gaps);
      measures.push(
        value === null
          ? measured("minutes-confirmation-time", group, label, null, reading("empty", "No minutes have been confirmed after a recorded meeting yet.", "Nach einer erfassten Besprechung wurde noch kein Protokoll bestaetigt."), "meeting_minutes, meetings")
          : measured(
              "minutes-confirmation-time",
              group,
              label,
              both(`Median ${Math.round(value)} minutes over ${gaps.length} meetings`, `Median ${Math.round(value)} Minuten ueber ${gaps.length} Besprechungen`),
              simulated("From the meeting being recorded as held to its minutes being confirmed.", "Von der Erfassung der Besprechung als abgehalten bis zur Bestaetigung des Protokolls."),
              "meeting_minutes, meetings",
            ),
      );
    }
  }

  /* Inbox items converted to work. */
  {
    const label = both("Inbox items converted to work", "In Arbeit umgewandelte Eingangsnachrichten");
    const row = one<{ total: number; work: number }>(
      `SELECT count(*) AS total,
              sum(CASE WHEN conversion_kind IN ('action', 'decision', 'evidence', 'process', 'delegated') THEN 1 ELSE 0 END) AS work
         FROM inbox_messages WHERE run_id = ?`,
      runId,
    );
    if (row === null) measures.push(unreadable("inbox-converted", group, label, "inbox_messages.conversion_kind"));
    else {
      const work = Number(row.work ?? 0);
      const total = Number(row.total ?? 0);
      measures.push(
        work === 0
          ? measured("inbox-converted", group, label, both(`0 of ${total} messages`, `0 von ${total} Nachrichten`), reading("empty", "No inbox message has been converted to work yet.", "Noch keine Eingangsnachricht wurde in Arbeit umgewandelt."), "inbox_messages.conversion_kind")
          : measured(
              "inbox-converted",
              group,
              label,
              both(`${work} of ${total} messages (${percent(work, total)} percent)`, `${work} von ${total} Nachrichten (${percent(work, total)} Prozent)`),
              simulated("Messages that became an action, decision, evidence, process input or delegation.", "Nachrichten, aus denen eine Massnahme, Entscheidung, ein Nachweis, eine Prozesseingabe oder eine Delegation wurde."),
              "inbox_messages.conversion_kind",
            ),
      );
    }
  }

  /* Action cycle time. */
  {
    const label = both("Action cycle time", "Durchlaufzeit von Massnahmen");
    const rows = all<{ createdOn: string; completedOn: string | null }>(
      "SELECT created_on AS createdOn, completed_on AS completedOn FROM actions WHERE run_id = ? AND status = 'completed'",
      runId,
    );
    if (rows === null) measures.push(unreadable("action-cycle-time", group, label, "actions"));
    else {
      const days = rows
        .map((row) => (row.completedOn ? (Date.parse(row.completedOn) - Date.parse(row.createdOn)) / 86_400_000 : Number.NaN))
        .filter((value) => Number.isFinite(value) && value >= 0);
      const value = median(days);
      measures.push(
        value === null
          ? measured("action-cycle-time", group, label, null, reading("empty", "No completed action carries both a creation and a completion date.", "Keine abgeschlossene Massnahme traegt ein Anlage- und ein Abschlussdatum."), "actions")
          : measured(
              "action-cycle-time",
              group,
              label,
              both(`Median ${Math.round(value * 10) / 10} days over ${days.length} actions`, `Median ${Math.round(value * 10) / 10} Tage ueber ${days.length} Massnahmen`),
              simulated("From the action being raised to its closure.", "Von der Anlage der Massnahme bis zu ihrem Abschluss."),
              "actions",
            ),
      );
    }
  }

  /* Evidence opened before decision. */
  {
    const label = both("Evidence opened before decision", "Vor der Entscheidung geoeffnete Nachweise");
    const decided = all<{ id: string; decidedAt: string | null; evidence: string }>(
      "SELECT id, decided_at AS decidedAt, supporting_evidence_ids AS evidence FROM decisions WHERE run_id = ? AND status = 'decided'",
      runId,
    );
    if (decided === null) measures.push(unreadable("evidence-before-decision", group, label, "decisions, experience_events (evidence-opened)"));
    else if (decided.length === 0) {
      measures.push(measured("evidence-before-decision", group, label, null, reading("empty", "No decision has been recorded on this run yet.", "In diesem Lauf ist noch keine Entscheidung erfasst."), "decisions, experience_events (evidence-opened)"));
    } else {
      let withEvidence = 0;
      for (const decision of decided) {
        let ids: string[] = [];
        try {
          const parsed: unknown = JSON.parse(decision.evidence);
          ids = Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
        } catch {
          ids = [];
        }
        if (ids.length === 0 || !decision.decidedAt) continue;
        const opened = one<{ n: number }>(
          `SELECT count(*) AS n FROM experience_events WHERE run_id = ? AND kind = 'evidence-opened'
              AND subject_id IN (${ids.map(() => "?").join(", ")}) AND occurred_at <= ?`,
          runId,
          ...ids,
          decision.decidedAt,
        );
        if ((opened?.n ?? 0) > 0) withEvidence += 1;
      }
      measures.push(
        measured(
          "evidence-before-decision",
          group,
          label,
          both(`${withEvidence} of ${decided.length} decisions`, `${withEvidence} von ${decided.length} Entscheidungen`),
          simulated("Recorded decisions whose supporting evidence was opened before the decision was taken.", "Erfasste Entscheidungen, deren stuetzende Nachweise vor der Entscheidung geoeffnet wurden."),
          "decisions, experience_events (evidence-opened)",
        ),
      );
    }
  }

  measures.push(
    notMeasured(
      "process-waiting-time",
      group,
      both("Process waiting time", "Wartezeit im Prozess"),
      "The process runtime records when a stage opened and completed, not the periods it spent waiting for a source, a person or an approval.",
      "Die Prozesslaufzeit erfasst, wann eine Stufe geoeffnet und abgeschlossen wurde, nicht die Zeiten, in denen sie auf eine Quelle, eine Person oder eine Genehmigung wartete.",
      "role_app_stage_runs (opened and completed only)",
    ),
  );

  /* Decision completion time, on the scenario clock. */
  {
    const label = both("Decision completion time", "Zeit bis zur Entscheidung");
    const rows = all<{ presented: string | null; decided: string | null }>(
      "SELECT presented_at_moment AS presented, decided_at_moment AS decided FROM decisions WHERE run_id = ? AND status = 'decided'",
      runId,
    );
    if (rows === null) measures.push(unreadable("decision-completion-time", group, label, "decisions"));
    else {
      const gaps = rows
        .map((row) => {
          const from = minutesOf(row.presented);
          const to = minutesOf(row.decided);
          return from !== null && to !== null ? to - from : Number.NaN;
        })
        .filter((minutes) => Number.isFinite(minutes) && minutes >= 0);
      const value = median(gaps);
      measures.push(
        value === null
          ? measured("decision-completion-time", group, label, null, reading("empty", "No decision has been recorded on this run yet.", "In diesem Lauf ist noch keine Entscheidung erfasst."), "decisions")
          : measured(
              "decision-completion-time",
              group,
              label,
              both(`Median ${Math.round(value)} minutes over ${gaps.length} decisions`, `Median ${Math.round(value)} Minuten ueber ${gaps.length} Entscheidungen`),
              simulated("From the decision being presented to it being recorded, on the scenario clock.", "Von der Vorlage der Entscheidung bis zu ihrer Erfassung, auf der Szenariouhr."),
              "decisions",
            ),
      );
    }
  }

  /* Correction and rejection of AI output. */
  for (const [id, disposition, label] of [
    ["ai-correction", "modified", both("User correction of AI output", "Korrektur von KI-Ergebnissen durch Nutzer")],
    ["ai-rejection", "rejected", both("User rejection of AI output", "Ablehnung von KI-Ergebnissen durch Nutzer")],
  ] as const) {
    const row = one<{ total: number; hits: number }>(
      `SELECT count(DISTINCT suggestion_id) AS total,
              count(DISTINCT CASE WHEN to_disposition = ? THEN suggestion_id END) AS hits
         FROM ai_suggestion_dispositions WHERE run_id = ? AND actor_kind = 'human'`,
      disposition,
      runId,
    );
    if (row === null) {
      measures.push(unreadable(id, group, label, "ai_suggestion_dispositions"));
      continue;
    }
    const total = Number(row.total ?? 0);
    const hits = Number(row.hits ?? 0);
    measures.push(
      total === 0
        ? measured(id, group, label, null, reading("empty", "No person has reviewed an AI suggestion on this run yet.", "In diesem Lauf hat noch keine Person einen KI-Vorschlag geprueft."), "ai_suggestion_dispositions")
        : measured(
            id,
            group,
            label,
            both(`${hits} of ${total} reviewed suggestions`, `${hits} von ${total} geprueften Vorschlaegen`),
            simulated(
              disposition === "modified" ? "Suggestions a person modified before using them." : "Suggestions a person rejected.",
              disposition === "modified" ? "Vorschlaege, die eine Person vor der Verwendung geaendert hat." : "Vorschlaege, die eine Person abgelehnt hat.",
            ),
            "ai_suggestion_dispositions",
          ),
    );
  }

  return measures;
}

/* ==========================================================================
   Product-owner success
   ========================================================================== */

function productOwnerMeasures(runId: string): ValueMeasure[] {
  const group: ValueGroupId = "product-owner";
  const measures: ValueMeasure[] = [];
  const installed = ROLE_APP_REGISTRY.filter((app) => app.status === "installed");
  const installedIds = installed.map((app) => app.id);
  const marks = installedIds.map(() => "?").join(", ");

  /* Role App adoption and run completion. */
  const runs = all<{ app: string; total: number; completed: number }>(
    `SELECT role_app_id AS app, count(*) AS total, sum(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
       FROM role_app_runs WHERE run_id = ? AND role_app_id IN (${marks}) GROUP BY role_app_id`,
    runId,
    ...installedIds,
  );
  {
    const label = both("Role App adoption", "Nutzung der Rollen-Apps");
    if (runs === null) measures.push(unreadable("role-app-adoption", group, label, "role_app_runs, role_app_enablements"));
    else {
      const parts = installed.map((app) => `${app.name}: ${runs.find((row) => row.app === app.id)?.total ?? 0}`);
      const partsDe = installed.map((app) => `${app.nameDe}: ${runs.find((row) => row.app === app.id)?.total ?? 0}`);
      const total = runs.reduce((sum, row) => sum + Number(row.total), 0);
      measures.push(
        measured(
          "role-app-adoption",
          group,
          label,
          both(`Process runs started: ${parts.join("; ")}`, `Gestartete Prozesslaeufe: ${partsDe.join("; ")}`),
          total === 0 ? reading("empty", "No process run has been started.", "Es wurde noch kein Prozesslauf gestartet.") : simulated("Runs per installed Role App, seeded and started on this run.", "Laeufe je installierter Rollen-App, eingespielt und in diesem Lauf gestartet."),
          "role_app_runs",
        ),
      );
    }
  }
  {
    const label = both("Run completion", "Abschluss von Laeufen");
    if (runs === null) measures.push(unreadable("run-completion", group, label, "role_app_runs"));
    else {
      const total = runs.reduce((sum, row) => sum + Number(row.total), 0);
      const completed = runs.reduce((sum, row) => sum + Number(row.completed ?? 0), 0);
      measures.push(
        measured(
          "run-completion",
          group,
          label,
          both(`${completed} of ${total} runs completed`, `${completed} von ${total} Laeufen abgeschlossen`),
          total === 0 ? reading("empty", "No process run exists.", "Es gibt keinen Prozesslauf.") : simulated("Completed process runs of the installed Role Apps.", "Abgeschlossene Prozesslaeufe der installierten Rollen-Apps."),
          "role_app_runs",
        ),
      );
    }
  }

  /* Stage bottleneck: the open stage with the oldest open time. */
  {
    const label = both("Stage bottleneck", "Engpass-Stufe");
    const rows = all<{ stageId: string; open: number; oldest: string | null }>(
      `SELECT s.stage_id AS stageId, count(*) AS open, min(s.opened_at) AS oldest
         FROM role_app_stage_runs s JOIN role_app_runs r ON r.id = s.role_app_run_id AND r.run_id = s.run_id
        WHERE s.run_id = ? AND s.status != 'completed' AND r.status NOT IN ('completed', 'archived')
        GROUP BY s.stage_id ORDER BY open DESC, oldest ASC`,
      runId,
    );
    if (rows === null) measures.push(unreadable("stage-bottleneck", group, label, "role_app_stage_runs"));
    else if (rows.length === 0) measures.push(measured("stage-bottleneck", group, label, null, reading("empty", "No stage is open.", "Keine Stufe ist offen."), "role_app_stage_runs"));
    else {
      const top = rows[0];
      measures.push(
        measured(
          "stage-bottleneck",
          group,
          label,
          both(`${top?.stageId ?? ""}: ${top?.open ?? 0} open, open since ${top?.oldest?.slice(0, 10) ?? "unknown"}`, `${top?.stageId ?? ""}: ${top?.open ?? 0} offen, offen seit ${top?.oldest?.slice(0, 10) ?? "unbekannt"}`),
          simulated("The stage holding the most open runs, then the longest open.", "Die Stufe mit den meisten offenen Laeufen, danach die am laengsten offene."),
          "role_app_stage_runs",
        ),
      );
    }
  }

  /* Failure rate and source-delay rate. */
  {
    const label = both("Failure rate", "Fehlerquote");
    const row = one<{ total: number; failed: number }>(
      "SELECT count(*) AS total, sum(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed FROM background_jobs WHERE run_id = ?",
      runId,
    );
    const prepFailed = one<{ n: number }>("SELECT count(*) AS n FROM os_events WHERE run_id = ? AND type = 'ai-preparation-failed'", runId);
    if (row === null) measures.push(unreadable("failure-rate", group, label, "background_jobs, os_events"));
    else {
      const total = Number(row.total ?? 0);
      const failed = Number(row.failed ?? 0);
      measures.push(
        measured(
          "failure-rate",
          group,
          label,
          both(
            `${failed} of ${total} background jobs failed; ${prepFailed?.n ?? 0} AI preparations failed`,
            `${failed} von ${total} Hintergrundauftraegen fehlgeschlagen; ${prepFailed?.n ?? 0} KI-Vorbereitungen fehlgeschlagen`,
          ),
          total === 0 ? reading("empty", "No background job has run.", "Es lief noch kein Hintergrundauftrag.") : simulated("Failed background jobs and failed stage preparations.", "Fehlgeschlagene Hintergrundauftraege und Stufenvorbereitungen."),
          "background_jobs, os_events (ai-preparation-failed)",
        ),
      );
    }
  }
  {
    const label = both("Source-delay rate", "Quote der Quellenverzoegerung");
    const row = one<{ started: number; held: number }>(
      `SELECT sum(CASE WHEN type = 'ai-preparation-started' THEN 1 ELSE 0 END) AS started,
              sum(CASE WHEN type = 'ai-preparation-held' THEN 1 ELSE 0 END) AS held
         FROM os_events WHERE run_id = ?`,
      runId,
    );
    if (row === null) measures.push(unreadable("source-delay-rate", group, label, "os_events"));
    else {
      const started = Number(row.started ?? 0);
      const held = Number(row.held ?? 0);
      measures.push(
        started + held === 0
          ? measured("source-delay-rate", group, label, null, reading("empty", "No stage preparation has started on this run.", "In diesem Lauf hat noch keine Stufenvorbereitung begonnen."), "os_events (ai-preparation-started, ai-preparation-held)")
          : measured(
              "source-delay-rate",
              group,
              label,
              both(`${held} held for a source, ${started} started`, `${held} wegen einer Quelle angehalten, ${started} begonnen`),
              simulated("Stage preparations held because a required source was missing.", "Stufenvorbereitungen, die wegen einer fehlenden erforderlichen Quelle angehalten wurden."),
              "os_events (ai-preparation-started, ai-preparation-held)",
            ),
      );
    }
  }

  /* Evaluation pass rate. */
  {
    const label = both("Evaluation pass rate", "Bestehensquote der Evaluation");
    const evidence = readEvaluationEvidence();
    measures.push(
      evidence.recorded
        ? measured(
            "evaluation-pass-rate",
            group,
            label,
            both(`${evidence.totals.passed} of ${evidence.totals.cases} cases passed (${evidence.mode ?? "unknown"} run)`, `${evidence.totals.passed} von ${evidence.totals.cases} Faellen bestanden (Lauf ${evidence.mode ?? "unbekannt"})`),
            evidence.harness,
            "evals/results/latest.json",
          )
        : notMeasured("evaluation-pass-rate", group, label, evidence.harness.detail.en, evidence.harness.detail.de, "evals/results/latest.json"),
    );
  }

  /* Connector health. */
  {
    const label = both("Connector health", "Zustand der Konnektoren");
    const counts = readConnectorStatusCounts();
    if (counts === null) measures.push(unreadable("connector-health", group, label, "connector_instances"));
    else {
      const total = counts.reduce((sum, entry) => sum + entry.count, 0);
      const live = counts.find((entry) => entry.status === "live")?.count ?? 0;
      const sim = counts.find((entry) => entry.status === "simulated")?.count ?? 0;
      measures.push(
        measured(
          "connector-health",
          group,
          label,
          both(`${total} connectors: ${live} live, ${sim} simulated, ${total - live - sim} not verified or unavailable`, `${total} Konnektoren: ${live} live, ${sim} simuliert, ${total - live - sim} nicht verifiziert oder nicht verfuegbar`),
          live > 0
            ? reading("live", "At least one connector is live.", "Mindestens ein Konnektor ist live.")
            : reading("simulated", "No connector reads a client system; the simulated ones carry synthetic data through the real contract.", "Kein Konnektor liest ein Kundensystem; die simulierten liefern synthetische Daten ueber den echten Vertrag."),
          "connector_instances",
        ),
      );
    }
  }

  measures.push(
    notApplicable(
      "support-volume",
      group,
      both("Support volume", "Supportaufkommen"),
      "No support desk is connected in this environment. Support bundles are generated on the machine and are not tickets.",
      "In dieser Umgebung ist kein Service Desk angebunden. Supportpakete werden auf dem Rechner erzeugt und sind keine Tickets.",
    ),
  );

  /* Pilot objective progress. */
  {
    const label = both("Pilot objective progress", "Fortschritt der Pilotziele");
    try {
      const pilot = listPilotProgrammes()[0];
      if (!pilot) {
        measures.push(notMeasured("pilot-objective-progress", group, label, "No pilot is configured.", "Es ist kein Pilot eingerichtet.", "pilot_programmes"));
      } else {
        const pilotMeasures = listPilotMeasures(pilot.id);
        const withTarget = pilotMeasures.filter((measure) => measure.target !== null);
        const readings = listPilotMeasureReadings(pilot.id);
        if (withTarget.length === 0) {
          measures.push(
            notMeasured(
              "pilot-objective-progress",
              group,
              label,
              "No success criterion has been agreed with the design partner yet.",
              "Mit dem Designpartner ist noch kein Erfolgskriterium vereinbart.",
              "pilot_measures.target, pilot_measure_readings",
            ),
          );
        } else {
          let onTarget = 0;
          let read = 0;
          for (const measure of withTarget) {
            const latest = readings
              .filter((entry) => entry.measureId === measure.id && entry.status === "measured" && entry.value !== null)
              .sort((a, b) => (a.weekStarting < b.weekStarting ? 1 : -1))[0];
            if (!latest || latest.value === null || measure.target === null) continue;
            read += 1;
            const met = measure.direction === "lower-is-better" ? latest.value <= measure.target : latest.value >= measure.target;
            if (met) onTarget += 1;
          }
          measures.push(
            read === 0
              ? notMeasured(
                  "pilot-objective-progress",
                  group,
                  label,
                  `${withTarget.length} success criteria are agreed and none has a recorded reading yet.`,
                  `${withTarget.length} Erfolgskriterien sind vereinbart, und keines hat bisher einen erfassten Wert.`,
                  "pilot_measures.target, pilot_measure_readings",
                )
              : measured(
                  "pilot-objective-progress",
                  group,
                  label,
                  both(`${onTarget} of ${read} measures with a reading meet their criterion`, `${onTarget} von ${read} Kennzahlen mit Wert erfuellen ihr Kriterium`),
                  reading(
                    "not-verified",
                    "Readings and criteria as the pilot lead recorded them. The product does not verify a reading.",
                    "Werte und Kriterien, wie die Pilotleitung sie erfasst hat. Das Produkt prueft keinen Wert.",
                  ),
                  "pilot_measures.target, pilot_measure_readings",
                ),
          );
        }
      }
    } catch {
      measures.push(unreadable("pilot-objective-progress", group, label, "pilot_measures, pilot_measure_readings"));
    }
  }

  /* Release quality. */
  {
    const label = both("Release quality", "Release-Qualitaet");
    try {
      const run = getLatestReleaseGateRun(PRODUCT_RELEASE.version);
      measures.push(
        !run
          ? notMeasured(
              "release-quality",
              group,
              label,
              `No release gate run is recorded for ${PRODUCT_RELEASE.version}.`,
              `Fuer ${PRODUCT_RELEASE.version} ist kein Lauf der Release-Pruefung erfasst.`,
              "release_gate_runs",
            )
          : measured(
              "release-quality",
              group,
              label,
              both(
                `${run.mandatoryTotal - run.mandatoryFailed} of ${run.mandatoryTotal} mandatory gates passed (${run.status})`,
                `${run.mandatoryTotal - run.mandatoryFailed} von ${run.mandatoryTotal} Pflichtpruefungen bestanden (${run.status})`,
              ),
              run.mandatoryFailed === 0 && run.status === "passed"
                ? reading("verified", "Every mandatory gate passed in the latest recorded run.", "Im letzten erfassten Lauf bestanden alle Pflichtpruefungen.")
                : reading("not-verified", "At least one mandatory gate did not pass in the latest recorded run.", "Im letzten erfassten Lauf hat mindestens eine Pflichtpruefung nicht bestanden."),
              "release_gate_runs",
            ),
      );
    } catch {
      measures.push(unreadable("release-quality", group, label, "release_gate_runs"));
    }
  }

  /* Feedback closure. */
  {
    const label = both("Feedback closure", "Abschluss von Rueckmeldungen");
    try {
      const counts = countProductFeedbackByStatus();
      const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
      const closed = counts.closed + counts.declined;
      measures.push(
        total === 0
          ? measured("feedback-closure", group, label, null, reading("empty", "The feedback inbox holds no item yet.", "Der Rueckmeldungseingang enthaelt noch keinen Eintrag."), "product_feedback")
          : measured(
              "feedback-closure",
              group,
              label,
              both(`${closed} of ${total} items closed or declined`, `${closed} von ${total} Eintraegen abgeschlossen oder abgelehnt`),
              simulated("Feedback items closed or declined in triage.", "In der Sichtung abgeschlossene oder abgelehnte Rueckmeldungen."),
              "product_feedback",
            ),
      );
    } catch {
      measures.push(unreadable("feedback-closure", group, label, "product_feedback"));
    }
  }

  return measures;
}

/* ==========================================================================
   Control success: computed from the product's own records
   ========================================================================== */

function controlMeasures(runId: string): ValueMeasure[] {
  const group: ValueGroupId = "control";
  const measures: ValueMeasure[] = [];

  /*
   * Material changes: executed tool calls of the approval-required class in
   * the workday, and material console actions (audited as console mutations
   * with an approval).
   */
  const material = one<{ total: number; approved: number; byPerson: number; bound: number }>(
    `SELECT count(*) AS total,
            sum(CASE WHEN t.approval_id IS NOT NULL THEN 1 ELSE 0 END) AS approved,
            sum(CASE WHEN a.approved_by_user_id IS NOT NULL AND a.approved_by_user_id NOT LIKE 'agent:%' AND trim(a.approved_by_user_id) != '' THEN 1 ELSE 0 END) AS byPerson,
            sum(CASE WHEN a.payload_fingerprint IS NOT NULL AND length(a.payload_fingerprint) >= 16 AND a.consumed_at IS NOT NULL THEN 1 ELSE 0 END) AS bound
       FROM tool_calls t LEFT JOIN approvals a ON a.id = t.approval_id
      WHERE t.run_id = ? AND t.authority_class = 'APPROVAL_REQUIRED' AND t.outcome = 'executed'`,
    runId,
  );
  const consoleRows = one<{ total: number; approved: number }>(
    `SELECT count(*) AS total, sum(CASE WHEN approval_id IS NOT NULL THEN 1 ELSE 0 END) AS approved
       FROM audit_events WHERE run_id = ? AND category = 'mutation' AND action LIKE 'console:%' AND authority_class = 'APPROVAL_REQUIRED'`,
    runId,
  );

  {
    const label = both("Material action approved by a person", "Wesentliche Handlung von einer Person genehmigt");
    if (material === null || consoleRows === null) measures.push(unreadable("material-approved", group, label, "tool_calls, approvals, audit_events"));
    else {
      const total = Number(material.total ?? 0) + Number(consoleRows.total ?? 0);
      const byPerson = Number(material.byPerson ?? 0) + Number(consoleRows.approved ?? 0);
      measures.push(
        total === 0
          ? measured("material-approved", group, label, null, reading("empty", "No material change has executed on this run yet.", "In diesem Lauf wurde noch keine wesentliche Aenderung ausgefuehrt."), "tool_calls, approvals, audit_events")
          : measured(
              "material-approved",
              group,
              label,
              both(`${byPerson} of ${total} material changes`, `${byPerson} von ${total} wesentlichen Aenderungen`),
              byPerson === total
                ? reading("verified", "Every executed material change carries an approval granted by a named person, checked on this request.", "Jede ausgefuehrte wesentliche Aenderung traegt eine Genehmigung einer benannten Person, bei dieser Anfrage geprueft.")
                : reading("not-verified", `${total - byPerson} executed material changes carry no approval by a person.`, `${total - byPerson} ausgefuehrte wesentliche Aenderungen tragen keine Genehmigung einer Person.`),
              "tool_calls, approvals, audit_events",
            ),
      );
    }
  }

  {
    const label = both("Payload-bound approval", "An die Aenderung gebundene Genehmigung");
    const mismatches = one<{ n: number }>(
      "SELECT count(*) AS n FROM audit_events WHERE run_id = ? AND blocked = 1 AND (blocked_reason LIKE 'approval-payload-mismatch%' OR blocked_reason LIKE 'approval-target-mismatch%')",
      runId,
    );
    const consoleBound = one<{ n: number }>(
      `SELECT count(*) AS n FROM audit_events WHERE run_id = ? AND category = 'approval' AND action LIKE 'console:%'
          AND json_extract(detail, '$.payloadFingerprint') IS NOT NULL`,
      runId,
    );
    if (material === null || consoleRows === null || mismatches === null || consoleBound === null) {
      measures.push(unreadable("payload-bound", group, label, "approvals, tool_calls, audit_events"));
    } else {
      const total = Number(material.total ?? 0) + Number(consoleRows.total ?? 0);
      const bound = Number(material.bound ?? 0) + Math.min(Number(consoleBound.n ?? 0), Number(consoleRows.total ?? 0));
      const refused = Number(mismatches.n ?? 0);
      measures.push(
        total === 0
          ? measured("payload-bound", group, label, null, reading("empty", `No material change has executed on this run yet. ${refused} approvals presented for a different change were refused.`, `In diesem Lauf wurde noch keine wesentliche Aenderung ausgefuehrt. ${refused} Genehmigungen fuer eine andere Aenderung wurden abgewiesen.`), "approvals, tool_calls, audit_events")
          : measured(
              "payload-bound",
              group,
              label,
              both(`${bound} of ${total} approvals bound to the change; ${refused} mismatches refused`, `${bound} von ${total} Genehmigungen an die Aenderung gebunden; ${refused} Abweichungen abgewiesen`),
              bound === total
                ? reading("verified", "Every executed material change used an approval bound to a fingerprint of that change, used once.", "Jede ausgefuehrte wesentliche Aenderung nutzte eine an einen Fingerabdruck dieser Aenderung gebundene, einmal verwendete Genehmigung.")
                : reading("not-verified", `${total - bound} executed material changes used an approval that is not bound to a fingerprint or was not consumed.`, `${total - bound} ausgefuehrte wesentliche Aenderungen nutzten eine nicht gebundene oder nicht verbrauchte Genehmigung.`),
              "approvals, tool_calls, audit_events",
            ),
      );
    }
  }

  {
    const label = both("Required-source enforcement", "Durchsetzung erforderlicher Quellen");
    const row = one<{ held: number; completed: number }>(
      `SELECT sum(CASE WHEN type = 'ai-preparation-held' THEN 1 ELSE 0 END) AS held,
              sum(CASE WHEN type = 'stage-completed' THEN 1 ELSE 0 END) AS completed
         FROM os_events WHERE run_id = ?`,
      runId,
    );
    if (row === null) measures.push(unreadable("required-source-enforcement", group, label, "os_events"));
    else {
      const held = Number(row.held ?? 0);
      measures.push(
        held === 0
          ? measured(
              "required-source-enforcement",
              group,
              label,
              both(`0 holds; ${Number(row.completed ?? 0)} stages completed`, `0 Anhalte; ${Number(row.completed ?? 0)} Stufen abgeschlossen`),
              reading(
                "empty",
                "No required source was missing when a preparation ran, so the hold has not been exercised on this run. The stage validator refuses completion while a required source is missing.",
                "Bei keiner Vorbereitung fehlte eine erforderliche Quelle, der Anhalt wurde in diesem Lauf daher nicht ausgeloest. Die Stufenpruefung verweigert den Abschluss, solange eine erforderliche Quelle fehlt.",
              ),
              "os_events (ai-preparation-held, stage-completed)",
            )
          : measured(
              "required-source-enforcement",
              group,
              label,
              both(`${held} preparations held for a missing required source`, `${held} Vorbereitungen wegen einer fehlenden erforderlichen Quelle angehalten`),
              simulated("Preparations the engine held because a required source could not be read.", "Vorbereitungen, die die Engine anhielt, weil eine erforderliche Quelle nicht lesbar war."),
              "os_events (ai-preparation-held, stage-completed)",
            ),
      );
    }
  }

  {
    const label = both("Blocked-action rate", "Quote abgewiesener Handlungen");
    const row = one<{ blocked: number; executed: number }>(
      `SELECT (SELECT count(*) FROM audit_events WHERE run_id = ? AND blocked = 1) AS blocked,
              (SELECT count(*) FROM tool_calls WHERE run_id = ? AND outcome = 'executed'
                  AND authority_class IN ('APPROVAL_REQUIRED', 'POLICY_BOUND_AUTONOMOUS')) AS executed`,
      runId,
      runId,
    );
    if (row === null) measures.push(unreadable("blocked-action-rate", group, label, "audit_events, tool_calls"));
    else {
      const blocked = Number(row.blocked ?? 0);
      const executed = Number(row.executed ?? 0);
      const total = blocked + executed;
      measures.push(
        total === 0
          ? measured("blocked-action-rate", group, label, null, reading("empty", "No change has been attempted on this run yet.", "In diesem Lauf wurde noch keine Aenderung versucht."), "audit_events, tool_calls")
          : measured(
              "blocked-action-rate",
              group,
              label,
              both(`${blocked} of ${total} attempted changes refused (${percent(blocked, total)} percent)`, `${blocked} von ${total} versuchten Aenderungen abgewiesen (${percent(blocked, total)} Prozent)`),
              simulated("Refusals recorded by the authority gate and the console, against changes that executed.", "Vom Autorisierungstor und der Konsole erfasste Abweisungen gegenueber ausgefuehrten Aenderungen."),
              "audit_events, tool_calls",
            ),
      );
    }
  }

  {
    const label = both("Receipt completeness", "Vollstaendigkeit der Belege");
    const decisions = one<{ decided: number; receipted: number }>(
      `SELECT count(*) AS decided,
              sum(CASE WHEN EXISTS (SELECT 1 FROM execution_receipt_lines l WHERE l.run_id = d.run_id AND l.decision_id = d.id) THEN 1 ELSE 0 END) AS receipted
         FROM decisions d WHERE d.run_id = ? AND d.status = 'decided'`,
      runId,
    );
    const tools = one<{ executed: number; audited: number }>(
      `SELECT count(*) AS executed,
              sum(CASE WHEN EXISTS (SELECT 1 FROM audit_events e WHERE e.run_id = t.run_id AND e.action = t.tool_name AND e.category = 'mutation'
                   AND ((t.approval_id IS NULL AND e.approval_id IS NULL) OR e.approval_id = t.approval_id)) THEN 1 ELSE 0 END) AS audited
         FROM tool_calls t WHERE t.run_id = ? AND t.outcome = 'executed' AND t.authority_class = 'APPROVAL_REQUIRED'`,
      runId,
    );
    if (decisions === null || tools === null) measures.push(unreadable("receipt-completeness", group, label, "decisions, execution_receipt_lines, tool_calls, audit_events"));
    else {
      const decided = Number(decisions.decided ?? 0);
      const receipted = Number(decisions.receipted ?? 0);
      const executed = Number(tools.executed ?? 0);
      const audited = Number(tools.audited ?? 0);
      const total = decided + executed;
      const complete = receipted + audited;
      measures.push(
        total === 0
          ? measured("receipt-completeness", group, label, null, reading("empty", "No decision or material change has executed on this run yet.", "In diesem Lauf wurde noch keine Entscheidung und keine wesentliche Aenderung ausgefuehrt."), "decisions, execution_receipt_lines, tool_calls, audit_events")
          : measured(
              "receipt-completeness",
              group,
              label,
              both(
                `${receipted} of ${decided} recorded decisions have receipt lines; ${audited} of ${executed} material changes have their audit record`,
                `${receipted} von ${decided} erfassten Entscheidungen haben Belegzeilen; ${audited} von ${executed} wesentlichen Aenderungen haben ihren Audit-Eintrag`,
              ),
              complete === total
                ? reading("verified", "Every recorded consequence has its receipt, checked on this request.", "Jede erfasste Folge hat ihren Beleg, bei dieser Anfrage geprueft.")
                : reading("not-verified", `${total - complete} consequences have no receipt.`, `${total - complete} Folgen haben keinen Beleg.`),
              "decisions, execution_receipt_lines, tool_calls, audit_events",
            ),
      );
    }
  }

  {
    const label = both("Audit-chain verification", "Pruefung der Audit-Kette");
    const audit = readAuditIntegrity(runId);
    const status = audit.chain.status === "verified" && audit.coverage.status === "verified" ? audit.chain : audit.chain.status !== "verified" ? audit.chain : audit.coverage;
    measures.push(
      measured(
        "audit-chain",
        group,
        label,
        both(
          `Chain: ${audit.result?.totalRecords ?? 0} records; coverage: ${audit.chainedEventCount ?? 0} of ${audit.auditEventCount ?? 0} audit events`,
          `Kette: ${audit.result?.totalRecords ?? 0} Elemente; Abdeckung: ${audit.chainedEventCount ?? 0} von ${audit.auditEventCount ?? 0} Audit-Ereignissen`,
        ),
        { status: status.status, detail: { en: `${audit.chain.detail.en} ${audit.coverage.detail.en}`, de: `${audit.chain.detail.de} ${audit.coverage.detail.de}` } },
        "audit_chain_records, audit_events",
      ),
    );
  }

  {
    const label = both("No duplicate external mutation", "Keine doppelte externe Aenderung");
    const row = one<{ commands: number; duplicates: number; doubleAcks: number }>(
      `SELECT (SELECT count(*) FROM integration_commands WHERE run_id = ? AND status IN ('executed', 'acknowledged')) AS commands,
              (SELECT count(*) FROM (SELECT 1 FROM integration_commands WHERE run_id = ? AND status IN ('executed', 'acknowledged')
                  GROUP BY connector_instance_id, target_external_type, coalesce(target_external_id, ''), payload_digest HAVING count(*) > 1)) AS duplicates,
              (SELECT count(*) FROM (SELECT 1 FROM external_execution_receipts WHERE run_id = ? AND status = 'acknowledged'
                  GROUP BY command_id HAVING count(*) > 1)) AS doubleAcks`,
      runId,
      runId,
      runId,
    );
    if (row === null) measures.push(unreadable("no-duplicate-mutation", group, label, "integration_commands, external_execution_receipts"));
    else {
      const commands = Number(row.commands ?? 0);
      const duplicates = Number(row.duplicates ?? 0) + Number(row.doubleAcks ?? 0);
      measures.push(
        commands === 0
          ? measured("no-duplicate-mutation", group, label, null, reading("empty", "No external command has executed on this run yet. Each command carries a unique idempotency key.", "In diesem Lauf wurde noch kein externer Befehl ausgefuehrt. Jeder Befehl traegt einen eindeutigen Idempotenzschluessel."), "integration_commands, external_execution_receipts")
          : measured(
              "no-duplicate-mutation",
              group,
              label,
              both(`${duplicates} duplicates across ${commands} executed commands`, `${duplicates} Doppelungen bei ${commands} ausgefuehrten Befehlen`),
              duplicates === 0
                ? reading("verified", "No change was sent to a target twice, and no command was acknowledged twice. These commands went to simulated connectors.", "Keine Aenderung ging zweimal an ein Ziel, und kein Befehl wurde zweimal bestaetigt. Diese Befehle gingen an simulierte Konnektoren.")
                : reading("not-verified", `${duplicates} changes reached a target more than once.`, `${duplicates} Aenderungen erreichten ein Ziel mehr als einmal.`),
              "integration_commands, external_execution_receipts",
            ),
      );
    }
  }

  {
    const label = both("Recovery from failure", "Wiederherstellung nach Fehlern");
    const row = one<{ recovered: number; failed: number }>(
      `SELECT sum(CASE WHEN status = 'completed' AND attempt_count > 1 THEN 1 ELSE 0 END) AS recovered,
              sum(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
         FROM background_jobs WHERE run_id = ?`,
      runId,
    );
    if (row === null) measures.push(unreadable("recovery", group, label, "background_jobs"));
    else {
      const recovered = Number(row.recovered ?? 0);
      const failed = Number(row.failed ?? 0);
      measures.push(
        recovered + failed === 0
          ? measured("recovery", group, label, null, reading("empty", "No background job has failed on this run, so recovery has not been exercised. Backup and restore are read on the pilot readiness page.", "In diesem Lauf ist kein Hintergrundauftrag fehlgeschlagen, die Wiederherstellung wurde daher nicht ausgeloest. Sicherung und Wiederherstellung zeigt die Seite zur Pilotbereitschaft."), "background_jobs")
          : measured(
              "recovery",
              group,
              label,
              both(`${recovered} jobs completed after a failed attempt; ${failed} failed for good`, `${recovered} Auftraege nach einem Fehlversuch abgeschlossen; ${failed} endgueltig fehlgeschlagen`),
              simulated("Background jobs that recovered on a retry, against those that did not.", "Hintergrundauftraege, die beim erneuten Versuch gelangen, gegenueber denen, die scheiterten."),
              "background_jobs",
            ),
      );
    }
  }

  return measures;
}

/* ==========================================================================
   Commercial success: never measured here
   ========================================================================== */

function commercialMeasures(): ValueMeasure[] {
  const group: ValueGroupId = "commercial";
  const why = (en: string, de: string) => ({
    en: `${en} A commercial outcome is never calculated from synthetic data.`,
    de: `${de} Ein kommerzielles Ergebnis wird nie aus synthetischen Daten berechnet.`,
  });
  const entry = (id: string, label: Bilingual, reason: Bilingual, source: string): ValueMeasure =>
    notMeasured(id, group, label, reason.en, reason.de, source);
  return [
    entry(
      "two-role-pilot-conversion",
      both("Two-role pilot conversion", "Umwandlung des Zwei-Rollen-Piloten"),
      why("Recorded when a design partner decides after a real pilot. No client decision exists in this environment.", "Erfasst, wenn ein Designpartner nach einem echten Piloten entscheidet. In dieser Umgebung gibt es keine Kundenentscheidung."),
      "a design partner's decision",
    ),
    entry(
      "role-app-expansion-interest",
      both("Role App expansion interest", "Interesse an weiteren Rollen-Apps"),
      why("Stated by a design partner. Not recorded in this build.", "Von einem Designpartner geaeussert. In diesem Build nicht erfasst."),
      "a design partner's statement",
    ),
    entry(
      "implementation-effort",
      both("Implementation effort by app", "Implementierungsaufwand je App"),
      why("Measured on a delivered engagement. No implementation has been delivered to a client.", "Auf einem gelieferten Projekt gemessen. Es wurde noch keine Implementierung an einen Kunden geliefert."),
      "engagement delivery records",
    ),
    entry(
      "platform-reuse",
      both("Reuse of common platform services", "Wiederverwendung gemeinsamer Plattformdienste"),
      why("Measured across engagements. Only this build exists.", "Ueber mehrere Projekte gemessen. Es gibt nur diesen Build."),
      "engagement delivery records",
    ),
    entry(
      "managed-service-adoption",
      both("Managed-service adoption", "Nutzung des Managed Service"),
      why("Recorded when a client takes a managed service. None is offered from this environment.", "Erfasst, wenn ein Kunde einen Managed Service nutzt. Aus dieser Umgebung wird keiner angeboten."),
      "a client contract",
    ),
    entry(
      "willingness-to-baseline",
      both("Client willingness to baseline value", "Bereitschaft des Kunden, den Nutzen zu messen"),
      why("Shown by a design partner recording its own baseline. The institution here is synthetic.", "Zeigt sich, wenn ein Designpartner seine eigene Ausgangslage erfasst. Die Institution hier ist synthetisch."),
      "a design partner's baseline",
    ),
  ];
}

/* ==========================================================================
   The page model
   ========================================================================== */

export const VALUE_GROUP_LABELS: Record<ValueGroupId, Bilingual> = {
  user: { en: "User success", de: "Erfolg fuer Nutzer" },
  "product-owner": { en: "Product-owner success", de: "Erfolg fuer Product Owner" },
  control: { en: "Control success", de: "Erfolg der Kontrollen" },
  commercial: { en: "Commercial success", de: "Kommerzieller Erfolg" },
};

/** Every success measure of plan section 12, computed on this request. */
export function readValueMeasures(): ValueGroup[] {
  const runId = runIdNow();
  return [
    { id: "user", label: VALUE_GROUP_LABELS.user, measures: userMeasures(runId) },
    { id: "product-owner", label: VALUE_GROUP_LABELS["product-owner"], measures: productOwnerMeasures(runId) },
    { id: "control", label: VALUE_GROUP_LABELS.control, measures: controlMeasures(runId) },
    { id: "commercial", label: VALUE_GROUP_LABELS.commercial, measures: commercialMeasures() },
  ];
}

/** The control measures only, for the exit decision's control findings and the evidence pack. */
export function readControlMeasures(): ValueMeasure[] {
  return controlMeasures(runIdNow());
}

/** Counts per state, for a group heading. */
export function countStates(measures: readonly ValueMeasure[]): Record<MeasureState, number> {
  return {
    measured: measures.filter((measure) => measure.state === "measured").length,
    "not-measured": measures.filter((measure) => measure.state === "not-measured").length,
    "not-applicable": measures.filter((measure) => measure.state === "not-applicable").length,
  };
}

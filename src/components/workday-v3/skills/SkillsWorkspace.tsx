/**
 * Processes, Skills: build your own read-only skills.
 *
 * Three regions, top to bottom:
 *
 *   Describe a skill   a sentence, or one of the examples. Submitting it is a
 *                      plain GET, so a draft is a link the person (or the work
 *                      partner) can hand over.
 *   The draft          how the sentence was read: the records it reads, one
 *                      line per filter, the order and the schedule, what was
 *                      assumed, and a preview run through the authority gate.
 *                      Saving is a form; nothing is saved without it.
 *   Your skills        the saved skills, each with its schedule and last run.
 *                      Opening one runs it, as an audited read.
 *
 * It decides nothing. Drafting, checking, scoping and running belong to
 * `src/features/skills`; this renders their results.
 *
 * Server component. No Tailwind, no umlauts, no em dashes.
 */

import type { CSSProperties } from "react";
import { IconBolt, IconPlayerPlay, IconSparkles, IconTrash } from "@tabler/icons-react";
import type { RoleId } from "@/db/schema/core";
import type { Language } from "@/i18n/labels";
import { StatusBadge } from "@/product/status";
import { getResolvedDemoMode } from "@/server/config/runtime";
import { SKILL_CATALOG, type Bilingual } from "@/features/skills/catalog";
import { draftSkill, type SkillDraft } from "@/features/skills/compile";
import { describeFilters, describeSchedule, describeSort, proposeSkillTitle } from "@/features/skills/describe";
import { knownSupplierNames, type SkillRunResult } from "@/features/skills/execute";
import { previewSkill, runSavedSkill, savedSkills, type SkillRunOutcome } from "@/features/skills/operations";
import { decodeSpec, encodeSpec, type SkillSpec } from "@/features/skills/schema";
import { actionRemoveSkill, actionSaveSkill } from "@/features/skills/actions";

const L = {
  intro: {
    en: "Describe what you want to keep an eye on. A skill is drafted from your words, you check how it was read, and you save it. A skill reads the records your role already sees and never changes one.",
    de: "Beschreiben Sie, was Sie im Blick behalten wollen. Aus Ihren Worten entsteht ein Skill, Sie pruefen, wie er gelesen wurde, und speichern ihn. Ein Skill liest die Datensaetze, die Ihre Rolle ohnehin sieht, und aendert keinen.",
  },
  describe: { en: "Describe a skill", de: "Skill beschreiben" },
  placeholder: { en: "For example: critical suppliers with an assessment due in the next 90 days", de: "Zum Beispiel: kritische Lieferanten mit Bewertung faellig in den naechsten 90 Tagen" },
  draftButton: { en: "Draft skill", de: "Skill entwerfen" },
  examples: { en: "Try", de: "Beispiele" },
  partnerHint: { en: "You can also ask the work partner: \"Build a skill that lists ...\"", de: "Sie koennen auch den Arbeitspartner fragen: \"Erstelle einen Skill, der ... auflistet\"" },
  draft: { en: "Draft", de: "Entwurf" },
  reads: { en: "Reads", de: "Liest" },
  filters: { en: "Filters", de: "Filter" },
  noFilters: { en: "No filters: every record in scope", de: "Keine Filter: alle Datensaetze im Geltungsbereich" },
  order: { en: "Order", de: "Reihenfolge" },
  schedule: { en: "Schedule", de: "Zeitplan" },
  viaModel: { en: "Drafted by the model from your sentence", de: "Vom Modell aus Ihrem Satz entworfen" },
  viaRules: { en: "Drafted by the rule-based builder", de: "Vom regelbasierten Builder entworfen" },
  readOnly: { en: "Read only", de: "Nur lesen" },
  preview: { en: "Preview", de: "Vorschau" },
  matched: { en: "matched", de: "passend" },
  inScope: { en: "in scope", de: "im Geltungsbereich" },
  noMatches: { en: "Nothing matches at the moment. The skill is still valid and can be saved.", de: "Derzeit passt nichts. Der Skill ist trotzdem gueltig und kann gespeichert werden." },
  shownFirst: { en: "Showing the first", de: "Angezeigt werden die ersten" },
  name: { en: "Name", de: "Name" },
  scheduleManual: { en: "When I run it", de: "Wenn ich ihn starte" },
  scheduleWeekly: { en: "Weekly, Monday", de: "Woechentlich, Montag" },
  save: { en: "Save skill", de: "Skill speichern" },
  cannotDraft: { en: "No skill could be drafted", de: "Es konnte kein Skill entworfen werden" },
  yourSkills: { en: "Your skills", de: "Ihre Skills" },
  noSkills: { en: "No saved skills yet. Describe one above, or ask the work partner.", de: "Noch keine gespeicherten Skills. Beschreiben Sie oben einen oder fragen Sie den Arbeitspartner." },
  colSkill: { en: "Skill", de: "Skill" },
  colReads: { en: "Reads", de: "Liest" },
  colSchedule: { en: "Schedule", de: "Zeitplan" },
  colLastRun: { en: "Last run", de: "Letzter Lauf" },
  never: { en: "Not run yet", de: "Noch nicht ausgefuehrt" },
  run: { en: "Run", de: "Ausfuehren" },
  remove: { en: "Remove", de: "Entfernen" },
  ranAt: { en: "at", de: "um" },
  invalidStored: { en: "No longer matches the catalog", de: "Passt nicht mehr zum Katalog" },
  scheduleNote: {
    en: "A weekly skill is due on the Monday after the scenario day. Until then you run it yourself.",
    de: "Ein woechentlicher Skill ist am Montag nach dem Szenariotag faellig. Bis dahin starten Sie ihn selbst.",
  },
  notices: {
    saved: { en: "Saved. The skill is in your list and ran once below.", de: "Gespeichert. Der Skill steht in Ihrer Liste und wurde unten einmal ausgefuehrt." },
    removed: { en: "The skill was removed. No record was changed.", de: "Der Skill wurde entfernt. Kein Datensatz wurde geaendert." },
    duplicate: { en: "You already have a skill with that name. Choose another name.", de: "Sie haben bereits einen Skill mit diesem Namen. Waehlen Sie einen anderen Namen." },
    name: { en: "Give the skill a name of at least three letters.", de: "Geben Sie dem Skill einen Namen mit mindestens drei Zeichen." },
    invalid: { en: "That skill could not be read, so nothing was saved.", de: "Dieser Skill konnte nicht gelesen werden, daher wurde nichts gespeichert." },
  },
  audit: { en: "recorded in the audit trail as", de: "im Audit-Trail erfasst als" },
} as const;

const EXAMPLES: Record<"tprm" | "default", { en: readonly string[]; de: readonly string[] }> = {
  tprm: {
    en: [
      "Critical suppliers with an assessment due in the next 90 days",
      "Missing or requested supplier due diligence evidence",
      "Contract obligations that are breached or not evidenced, weekly",
      "Open incidents involving Novalink",
      "KRIs in breach",
    ],
    de: [
      "Kritische Lieferanten mit Bewertung faellig in den naechsten 90 Tagen",
      "Fehlende oder angeforderte Due-Diligence-Nachweise",
      "Verletzte oder nicht nachgewiesene Vertragspflichten, woechentlich",
      "Offene Vorfaelle mit Novalink",
      "Ueberschrittene Risikoindikatoren",
    ],
  },
  default: {
    en: ["KRIs in breach", "Open incidents in the last 30 days", "Missing or requested evidence", "Stale evidence"],
    de: ["Ueberschrittene Risikoindikatoren", "Offene Vorfaelle der letzten 30 Tage", "Fehlende oder angeforderte Nachweise", "Veraltete Nachweise"],
  },
};

type NoticeCode = keyof typeof L.notices;

export interface SkillsQuery {
  ask?: string | undefined;
  draft?: string | undefined;
  via?: string | undefined;
  skill?: string | undefined;
  notice?: string | undefined;
}

function pick(pair: Bilingual, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

function skillsHref(roleId: RoleId, query: Record<string, string>): string {
  const params = new URLSearchParams({ view: "skills", ...query });
  return `/workday/${roleId}/processes?${params.toString()}`;
}

const card: CSSProperties = {
  padding: "var(--wd-5)",
  background: "var(--wd-surface)",
  border: "1px solid var(--wd-border)",
  borderRadius: "var(--wd-radius-lg)",
  boxShadow: "var(--wd-shadow-sm)",
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "var(--wd-2) var(--wd-3)",
  fontSize: "var(--wd-text-sm)",
  color: "var(--wd-text)",
  background: "var(--wd-surface-subtle)",
  border: "1px solid var(--wd-border)",
  borderRadius: "var(--wd-radius)",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const labelStyle: CSSProperties = { fontSize: "var(--wd-text-xs)", color: "var(--wd-text-muted)", margin: 0 };

const exampleChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "var(--wd-1) var(--wd-3)",
  fontSize: "var(--wd-text-xs)",
  color: "var(--wd-accent)",
  background: "var(--wd-accent-soft)",
  borderRadius: 999,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

/* ==========================================================================
   Pieces
   ========================================================================== */

function ResultTable({ result, language, testId, cap }: { result: SkillRunResult; language: Language; testId: string; cap?: number }) {
  const rows = cap ? result.rows.slice(0, cap) : result.rows;
  const template = `minmax(96px, 0.8fr) minmax(0, 2fr)${" minmax(0, 1fr)".repeat(Math.max(0, result.columns.length - 1))}`;
  if (result.rows.length === 0) {
    return (
      <div className="wd-empty" data-testid={testId} data-rows="0" style={{ padding: "var(--wd-4) 0" }}>
        {pick(L.noMatches, language)}
      </div>
    );
  }
  return (
    <div className="wd-queue" data-testid={testId} data-rows={rows.length}>
      <div className="wd-queue-head" style={{ gridTemplateColumns: template }}>
        <span>{language === "de" ? "Referenz" : "Reference"}</span>
        {result.columns.map((column) => (
          <span key={column.id}>{column.label}</span>
        ))}
      </div>
      {rows.map((row) => (
        <div key={row.id} className="wd-queue-row" data-testid="skill-result-row" style={{ gridTemplateColumns: template, cursor: "default" }}>
          <span className="wd-cell wd-oid" title={row.ref}>{row.ref}</span>
          {row.cells.map((cell, index) => (
            <span key={`${row.id}-${index}`} className={index === 0 ? "wd-cell wd-cell-primary" : "wd-cell"} title={cell}>
              {cell}
            </span>
          ))}
        </div>
      ))}
      {rows.length < result.rows.length ? (
        <div className="wd-meta" style={{ padding: "var(--wd-2) var(--wd-3)", borderTop: "1px solid var(--wd-border)" }}>
          {language === "de"
            ? `${rows.length} von ${result.matched} in der Vorschau. Der gespeicherte Skill listet bis zu ${result.rows.length}.`
            : `${rows.length} of ${result.matched} in the preview. The saved skill lists up to ${result.rows.length}.`}
        </div>
      ) : null}
    </div>
  );
}

function RunLine({ outcome, language }: { outcome: SkillRunOutcome; language: Language }) {
  if (!outcome.ok || !outcome.result) {
    return (
      <p className="wd-notice" data-tone="warning" style={{ margin: 0 }}>
        {outcome.message ? pick(outcome.message, language) : ""}
      </p>
    );
  }
  const result = outcome.result;
  const label = pick(SKILL_CATALOG[result.source].label, language);
  const noun = language === "de" ? label : label.toLowerCase();
  return (
    <p data-testid="skill-run-line" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--wd-2)", margin: 0, fontSize: "var(--wd-text-sm)", color: "var(--wd-text-secondary)" }}>
      <span className="wd-chip" data-tone="success">{pick(L.readOnly, language)}</span>
      <span>
        <strong style={{ color: "var(--wd-text)" }}>{result.matched}</strong> {pick(L.matched, language)}, {result.inScope} {noun} {pick(L.inScope, language)}: {result.entityName}, {result.atMoment}.
        {result.matched > result.rows.length ? ` ${pick(L.shownFirst, language)} ${result.rows.length}.` : ""}
      </span>
      <span className="wd-meta">
        runSkill, READ{outcome.auditEventId ? `, ${pick(L.audit, language)} ${outcome.auditEventId}` : ""}
      </span>
    </p>
  );
}

function SpecReading({ spec, language }: { spec: SkillSpec; language: Language }) {
  const source = SKILL_CATALOG[spec.source];
  const filters = describeFilters(spec, language);
  return (
    <dl style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "var(--wd-2) var(--wd-4)", margin: 0, fontSize: "var(--wd-text-sm)" }}>
      <dt style={labelStyle}>{pick(L.reads, language)}</dt>
      <dd style={{ margin: 0, color: "var(--wd-text)" }}>
        {pick(source.scope, language)}
      </dd>
      <dt style={labelStyle}>{pick(L.filters, language)}</dt>
      <dd style={{ margin: 0, display: "flex", flexWrap: "wrap", gap: "var(--wd-2)" }} data-testid="skill-filters">
        {filters.length > 0 ? (
          filters.map((line) => (
            <span key={line} className="wd-chip" data-tone="accent" data-testid="skill-filter">
              {line}
            </span>
          ))
        ) : (
          <span className="wd-secondary">{pick(L.noFilters, language)}</span>
        )}
      </dd>
      <dt style={labelStyle}>{pick(L.order, language)}</dt>
      <dd style={{ margin: 0, color: "var(--wd-text-secondary)" }}>{describeSort(spec, language)}</dd>
      <dt style={labelStyle}>{pick(L.schedule, language)}</dt>
      <dd style={{ margin: 0, color: "var(--wd-text-secondary)" }}>{describeSchedule(spec.schedule, language)}</dd>
    </dl>
  );
}

function DraftCard({ roleId, draft, preview, language }: { roleId: RoleId; draft: SkillDraft; preview: SkillRunOutcome | null; language: Language }) {
  if (!draft.ok || !draft.spec) {
    return (
      <section style={card} data-testid="skill-draft" data-ok="false" aria-label={pick(L.cannotDraft, language)}>
        <p style={{ margin: "0 0 var(--wd-3)", fontWeight: 600, color: "var(--wd-text)" }}>{pick(L.cannotDraft, language)}</p>
        {draft.problems.map((entry) => (
          <p key={entry.en} className="wd-notice" data-tone="warning" style={{ margin: "0 0 var(--wd-2)" }}>
            {pick(entry, language)}
          </p>
        ))}
      </section>
    );
  }
  const spec = draft.spec;
  const title = proposeSkillTitle(spec, language);
  return (
    <section style={{ ...card, borderColor: "var(--wd-accent)" }} data-testid="skill-draft" data-ok="true" data-via={draft.via} data-source={spec.source} aria-label={pick(L.draft, language)}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--wd-3)", marginBottom: "var(--wd-4)" }}>
        <div style={{ minWidth: 0 }}>
          <p style={labelStyle}>{pick(L.draft, language)}</p>
          <p data-testid="skill-draft-title" style={{ margin: "var(--wd-1) 0 0", fontSize: "var(--wd-text-md)", fontWeight: 600, color: "var(--wd-text)" }}>
            {title}
          </p>
          {draft.request ? <p className="wd-meta" style={{ margin: "var(--wd-1) 0 0" }}>&quot;{draft.request}&quot;</p> : null}
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--wd-2)", flexShrink: 0 }}>
          <span className="wd-meta">{pick(draft.via === "model" ? L.viaModel : L.viaRules, language)}</span>
          <StatusBadge status={draft.mode} language={language} />
        </span>
      </div>

      <SpecReading spec={spec} language={language} />

      {draft.notes.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--wd-2)", marginTop: "var(--wd-4)" }} data-testid="skill-notes">
          {draft.notes.map((entry) => (
            <p key={entry.en} className="wd-notice" data-tone="info" style={{ margin: 0 }}>
              {pick(entry, language)}
            </p>
          ))}
        </div>
      ) : null}

      <div style={{ marginTop: "var(--wd-5)", display: "flex", flexDirection: "column", gap: "var(--wd-3)" }}>
        <p className="wd-section-label" style={{ fontSize: "var(--wd-text-sm)" }}>{pick(L.preview, language)}</p>
        {preview ? <RunLine outcome={preview} language={language} /> : null}
        {preview?.result ? <ResultTable result={preview.result} language={language} testId="skill-preview" cap={8} /> : null}
      </div>

      <form action={actionSaveSkill} style={{ marginTop: "var(--wd-5)", display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "var(--wd-3)" }} data-testid="skill-save-form">
        <input type="hidden" name="roleId" value={roleId} />
        <input type="hidden" name="spec" value={encodeSpec(spec)} />
        <input type="hidden" name="request" value={draft.request} />
        <input type="hidden" name="via" value={draft.via} />
        <label style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", gap: "var(--wd-1)" }}>
          <span style={labelStyle}>{pick(L.name, language)}</span>
          <input type="text" name="name" defaultValue={title} maxLength={80} required style={inputStyle} />
        </label>
        <label style={{ flex: "0 1 200px", display: "flex", flexDirection: "column", gap: "var(--wd-1)" }}>
          <span style={labelStyle}>{pick(L.schedule, language)}</span>
          <select name="schedule" defaultValue={spec.schedule} style={inputStyle}>
            <option value="manual">{pick(L.scheduleManual, language)}</option>
            <option value="weekly">{pick(L.scheduleWeekly, language)}</option>
          </select>
        </label>
        <button type="submit" className="wd-btn wd-btn-primary">
          {pick(L.save, language)}
        </button>
      </form>
    </section>
  );
}

/* ==========================================================================
   The workspace
   ========================================================================== */

export async function SkillsWorkspace({ roleId, language, query }: { roleId: RoleId; language: Language; query: SkillsQuery }) {
  const mode = getResolvedDemoMode().mode;
  const ask = (query.ask ?? "").slice(0, 400);

  let draft: SkillDraft | null = null;
  if (query.draft) {
    const spec = decodeSpec(query.draft);
    draft = spec
      ? { ok: true, request: ask, spec, via: query.via === "model" ? "model" : "rules", mode, notes: [], problems: [] }
      : { ok: false, request: ask, spec: null, via: "rules", mode, notes: [], problems: [L.notices.invalid] };
  } else if (ask.trim().length > 0) {
    draft = await draftSkill(ask, { mode, knownNames: knownSupplierNames(roleId) });
  }
  const preview = draft?.ok && draft.spec ? await previewSkill(roleId, draft.spec) : null;

  const selectedId = query.skill && /^SKL-[A-Z0-9]{8}$/.test(query.skill) ? query.skill : null;
  const selectedRun = selectedId ? await runSavedSkill(roleId, selectedId) : null;
  const saved = savedSkills(roleId);
  const selected = selectedId ? saved.find((entry) => entry.row.id === selectedId) : undefined;
  const notice = query.notice && query.notice in L.notices ? (query.notice as NoticeCode) : null;
  const examples = EXAMPLES[roleId === "tprm" ? "tprm" : "default"][language === "de" ? "de" : "en"];

  return (
    <section className="wd-section" aria-label="Skills" data-testid="skills-workspace" style={{ display: "flex", flexDirection: "column", gap: "var(--wd-6)" }}>
      <p style={{ fontSize: "var(--wd-text-sm)", color: "var(--wd-text-secondary)", margin: 0, maxWidth: 760 }}>{pick(L.intro, language)}</p>

      {notice ? (
        <p className="wd-notice" data-tone={notice === "saved" || notice === "removed" ? "info" : "warning"} data-testid="skill-notice" style={{ margin: 0 }}>
          {pick(L.notices[notice], language)}
        </p>
      ) : null}

      <form method="get" action={`/workday/${roleId}/processes`} style={card} data-testid="skill-composer">
        <input type="hidden" name="view" value="skills" />
        <label style={{ display: "flex", flexDirection: "column", gap: "var(--wd-2)" }}>
          <span className="wd-section-label" style={{ display: "inline-flex", alignItems: "center", gap: "var(--wd-2)" }}>
            <IconSparkles size={16} stroke={1.8} aria-hidden="true" />
            {pick(L.describe, language)}
          </span>
          <textarea name="ask" rows={2} defaultValue={ask} maxLength={400} placeholder={pick(L.placeholder, language)} style={{ ...inputStyle, resize: "vertical", lineHeight: "var(--wd-leading-normal)", fontSize: "var(--wd-text-md)" }} />
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "var(--wd-3)", marginTop: "var(--wd-3)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--wd-2)" }}>
            <span style={labelStyle}>{pick(L.examples, language)}</span>
            {examples.map((example) => (
              <a key={example} href={skillsHref(roleId, { ask: example })} style={exampleChip} data-testid="skill-example">
                {example}
              </a>
            ))}
          </div>
          <button type="submit" className="wd-btn wd-btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "var(--wd-2)" }}>
            <IconBolt size={14} stroke={2} aria-hidden="true" />
            {pick(L.draftButton, language)}
          </button>
        </div>
        <p className="wd-meta" style={{ margin: "var(--wd-3) 0 0" }}>{pick(L.partnerHint, language)}</p>
      </form>

      {draft ? <DraftCard roleId={roleId} draft={draft} preview={preview} language={language} /> : null}

      {selected && selectedRun ? (
        <section style={{ ...card, borderColor: "var(--wd-accent)" }} data-testid="skill-selected" aria-label={selected.row.name}>
          <p style={labelStyle}>{pick(L.colSkill, language)}</p>
          <p style={{ margin: "var(--wd-1) 0 var(--wd-4)", fontSize: "var(--wd-text-md)", fontWeight: 600, color: "var(--wd-text)" }}>{selected.row.name}</p>
          {selected.spec ? <SpecReading spec={selected.spec} language={language} /> : null}
          <div style={{ marginTop: "var(--wd-4)", display: "flex", flexDirection: "column", gap: "var(--wd-3)" }}>
            <RunLine outcome={selectedRun} language={language} />
            {selectedRun.result ? <ResultTable result={selectedRun.result} language={language} testId="skill-run" /> : null}
          </div>
        </section>
      ) : null}

      <section aria-label={pick(L.yourSkills, language)} data-testid="skills-saved">
        <div className="wd-section-head">
          <p className="wd-section-label">{pick(L.yourSkills, language)}</p>
          <span className="wd-meta">{saved.length}</span>
        </div>
        {saved.length === 0 ? (
          <div className="wd-empty" style={{ ...card, boxShadow: "none" }}>
            {pick(L.noSkills, language)}
          </div>
        ) : (
          <div className="wd-queue">
            <div className="wd-queue-head" style={{ gridTemplateColumns: "minmax(0, 2.2fr) minmax(0, 1.1fr) minmax(0, 0.9fr) minmax(0, 1.2fr) max-content" }}>
              <span>{pick(L.colSkill, language)}</span>
              <span>{pick(L.colReads, language)}</span>
              <span>{pick(L.colSchedule, language)}</span>
              <span>{pick(L.colLastRun, language)}</span>
              <span />
            </div>
            {saved.map((entry) => {
              const row = entry.row;
              const lastRun =
                row.lastRunMatched !== null && row.lastRunMoment
                  ? `${row.lastRunMatched} ${pick(L.matched, language)} ${pick(L.ranAt, language)} ${row.lastRunMoment}`
                  : pick(L.never, language);
              return (
                <div
                  key={row.id}
                  className="wd-queue-row"
                  data-testid="saved-skill"
                  data-skill-id={row.id}
                  data-selected={row.id === selectedId ? "true" : undefined}
                  style={{ gridTemplateColumns: "minmax(0, 2.2fr) minmax(0, 1.1fr) minmax(0, 0.9fr) minmax(0, 1.2fr) max-content", cursor: "default" }}
                >
                  <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }} title={row.request || row.name}>
                    <span className="wd-cell wd-cell-primary">{row.name}</span>
                    <span className="wd-oid">{row.id}</span>
                  </span>
                  <span className="wd-cell wd-secondary">{entry.spec ? pick(SKILL_CATALOG[entry.spec.source].label, language) : pick(L.invalidStored, language)}</span>
                  <span className="wd-cell wd-secondary" title={row.schedule === "weekly" ? `${describeSchedule("weekly", language)}. ${pick(L.scheduleNote, language)}` : describeSchedule("manual", language)}>
                    {row.schedule === "weekly" ? pick(L.scheduleWeekly, language) : pick(L.scheduleManual, language)}
                  </span>
                  <span className="wd-cell wd-secondary">{lastRun}</span>
                  <span style={{ display: "inline-flex", gap: "var(--wd-2)" }}>
                    <a href={skillsHref(roleId, { skill: row.id })} className="wd-btn wd-btn-secondary wd-btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
                      <IconPlayerPlay size={12} stroke={2} aria-hidden="true" />
                      {pick(L.run, language)}
                    </a>
                    <form action={actionRemoveSkill}>
                      <input type="hidden" name="roleId" value={roleId} />
                      <input type="hidden" name="skillId" value={row.id} />
                      <button type="submit" className="wd-btn wd-btn-quiet wd-btn-sm" aria-label={`${pick(L.remove, language)}: ${row.name}`} style={{ display: "inline-flex", alignItems: "center" }}>
                        <IconTrash size={12} stroke={2} aria-hidden="true" />
                      </button>
                    </form>
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {saved.some((entry) => entry.row.schedule === "weekly") ? (
          <p className="wd-meta" style={{ margin: "var(--wd-2) 0 0" }}>{pick(L.scheduleNote, language)}</p>
        ) : null}
      </section>
    </section>
  );
}


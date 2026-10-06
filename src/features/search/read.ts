/**
 * The search read model: what one role may find, and where each thing opens.
 *
 * Server only. `readSearchPayload` is called by `app/api/workday/search`, the
 * first time the palette is opened, and returns the role's whole search scope
 * as a flat list plus the eight commands. The palette then filters that list
 * locally (`match.ts`), so typing is instant and the database never reaches
 * the browser.
 *
 * Scope, plan section 4.12 ("search uses the current role and legal-entity
 * scope"), applied by kind of object:
 *
 *   The role's own work: its meetings, its minutes, the actions on its desk
 *   (raised by the role or owned by the person who holds it, the same rule the
 *   Work Hub uses), its decisions as far as the Decisions page shows them at
 *   the current moment, its running processes, and its inbox messages,
 *   including the ones already converted, filed or dismissed.
 *
 *   The registers: risks, controls, assessments, suppliers, services,
 *   contracts and evidence, limited to the legal entity the role works for.
 *   An object recorded only for another entity is not in the list, so no
 *   query can find it. Evidence that has not arrived on the scenario clock is
 *   not in the list either.
 *
 * Where a result opens, so that it lands on the surface where the object is
 * worked on rather than on a read-only page the V3 interface does not have:
 *
 *   A work item opens in the Work Hub with that item selected.
 *   A decision opens on the Decisions page at that decision.
 *   A running process opens at its current stage.
 *   A register object that a running process of this role covers opens in
 *   that process at its current stage; any other opens the Work Hub filtered
 *   to the work linked to it, which is the convention `related.ts` set for
 *   objects with no page of their own.
 *   Evidence opens in the process that covers what it is about, else at the
 *   decision that cites it, else the Work Hub filtered to its subject.
 *
 * Every read is guarded per kind. A kind whose table cannot be read is left
 * out of the list rather than failing the palette, and the rest still works.
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";
import { contracts } from "@/db/schema/domain";
import {
  getAllEvidenceDocuments,
  getAssessments,
  getCalendar,
  getControls,
  getDecisions,
  getEntity,
  getMeetings,
  getRisks,
  getRole,
  getServices,
  getSuppliers,
} from "@/db/repositories/workday";
import {
  getDecisionRefs,
  getMinutesForRole,
  getProcessScopes,
  getWorkActions,
  type WorkProcessScope,
} from "@/db/repositories/work-hub";
import { countOpenDecisions } from "@/db/repositories/header";
import { selectNextMeeting, startTimeOf } from "@/features/role-signals/assemble";
import { DEFAULT_QUERY, itemHref, workHref } from "@/features/work/url";
import { readInboxSearchEntries } from "@/features/work/modules/inbox/search";
import type { ScenarioState } from "@/scenario/engine/state";
import { createLogger } from "@/server/logging/redact";
import type { Language } from "@/i18n/labels";
import { buildPaletteCommands, type CommandTarget } from "./commands";
import { fill, say, type Pair } from "./copy";
import { objectHref, processHref } from "./routes";
import type { SearchEntry, SearchKind, SearchPayload } from "./types";

const log = createLogger("search");
const db = () => getDb();

/**
 * The order a role reads its object types in.
 *
 * Work first for both, because it is what the reader acts on. Then the
 * registers each role works across, in the order plan section 9.3 lists the
 * role's own language: assessments, risks and controls for the Operational
 * Risk Partner; supplier, service and arrangement for the Third-Party Risk
 * Manager. Every type stays searchable for both roles: an Operational Risk
 * Partner can still find a supplier, it is simply listed later.
 */
export const KIND_ORDER: Record<"rcsa" | "tprm" | "default", SearchKind[]> = {
  rcsa: [
    "process-run",
    "decision",
    "action",
    "meeting",
    "minutes",
    "message",
    "assessment",
    "risk",
    "control",
    "evidence",
    "supplier",
    "service",
    "contract",
  ],
  tprm: [
    "process-run",
    "decision",
    "action",
    "meeting",
    "minutes",
    "message",
    "supplier",
    "service",
    "contract",
    "evidence",
    "assessment",
    "risk",
    "control",
  ],
  default: [
    "process-run",
    "decision",
    "action",
    "meeting",
    "minutes",
    "message",
    "risk",
    "control",
    "assessment",
    "supplier",
    "service",
    "contract",
    "evidence",
  ],
};

export function kindOrderFor(roleId: string): SearchKind[] {
  return roleId === "rcsa" || roleId === "tprm" ? KIND_ORDER[roleId] : KIND_ORDER.default;
}

const STATUS_WORDS: Record<string, Pair> = {
  open: { en: "Open", de: "Offen" },
  "in-progress": { en: "In progress", de: "In Bearbeitung" },
  overdue: { en: "Overdue", de: "Ueberfaellig" },
  completed: { en: "Completed", de: "Erledigt" },
  cancelled: { en: "Cancelled", de: "Abgebrochen" },
  decided: { en: "Recorded", de: "Erfasst" },
  draft: { en: "Draft", de: "Entwurf" },
  confirmed: { en: "Confirmed", de: "Bestaetigt" },
  superseded: { en: "Superseded", de: "Ersetzt" },
  approved: { en: "Approved", de: "Freigegeben" },
  current: { en: "Current", de: "Aktuell" },
  requested: { en: "Requested", de: "Angefordert" },
  missing: { en: "Missing", de: "Fehlt" },
  critical: { en: "Critical", de: "Kritisch" },
  important: { en: "Important", de: "Wichtig" },
  standard: { en: "Standard", de: "Standard" },
};

const DETAIL = {
  due: { en: "due {date}", de: "faellig {date}" },
  completedRun: { en: "Completed", de: "Abgeschlossen" },
} as const satisfies Record<string, Pair>;

function statusWord(status: string, language: Language): string {
  const pair = STATUS_WORDS[status];
  return pair ? say(pair, language) : status;
}

function localised(language: Language, en: string, de: string | null | undefined): string {
  return language === "de" && de && de.length > 0 ? de : en;
}

/** 06.10.2026 from an ISO date or timestamp, the format every V3 surface prints. */
export function displayDate(value: string | null | undefined): string | null {
  if (!value || value.length < 10) return null;
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}.${month}.${year}` : null;
}

function joinDetail(parts: Array<string | null | undefined>): string | null {
  const kept = parts.filter((part): part is string => typeof part === "string" && part.length > 0);
  return kept.length > 0 ? kept.join(", ") : null;
}

/** Reads one kind, or leaves it out and says so in the log. */
function guarded<T>(kind: string, read: () => T[]): T[] {
  try {
    return read();
  } catch (error) {
    log.warn("A search source could not be read.", { kind, error });
    return [];
  }
}

/* ==========================================================================
   The payload
   ========================================================================== */

export function readSearchPayload(roleId: RoleId, state: ScenarioState): SearchPayload {
  const runId = state.runId ?? DEFAULT_RUN_ID;
  const language: Language = state.language;
  const atMoment = state.currentMoment;

  const role = getRole(roleId, runId);
  const entityId = role?.entityId ?? null;
  const entity = entityId ? getEntity(entityId, runId) : undefined;
  const inEntity = (ids: readonly string[] | null | undefined): boolean =>
    entityId === null || (ids ?? []).includes(entityId);

  const scopes = guarded("process-run", () => getProcessScopes(roleId, runId));
  const entries: SearchEntry[] = [];

  /* ---- Running processes ---------------------------------------------- */
  for (const scope of scopes) {
    const href = processHref(scope);
    if (!href) continue;
    const stage = scope.currentStageName ? say(scope.currentStageName, language) : scope.currentStageId;
    entries.push({
      kind: "process-run",
      id: scope.roleAppRunId,
      label: say(scope.processName, language),
      reference: scope.roleAppRunId,
      detail: scope.status === "completed" ? say(DETAIL.completedRun, language) : stage,
      href,
      keywords: `${scope.processName.en} ${scope.processName.de} ${scope.subjectId} ${scope.roleAppId}`,
    });
  }

  /* ---- Decisions, as the Decisions page shows them now ----------------- */
  for (const decision of guarded("decision", () => getDecisionRefs(roleId, atMoment, runId))) {
    entries.push({
      kind: "decision",
      id: decision.id,
      label: localised(language, decision.title, decision.titleDe),
      reference: decision.reference,
      detail: statusWord(decision.status, language),
      href: `/workday/${roleId}/decisions#${encodeURIComponent(decision.id)}`,
      keywords: `${decision.title} ${decision.titleDe} ${decision.relatedObjectId ?? ""}`,
    });
  }

  /*
   * Actions on the role's desk, open work before finished work and the
   * earliest due first, so a matching open action is never listed under a
   * completed one.
   */
  const finished = (status: string) => (status === "completed" || status === "cancelled" ? 1 : 0);
  const actions = guarded("action", () => getWorkActions(roleId, role?.holderUserId ?? null, runId)).sort(
    (a, b) => finished(a.status) - finished(b.status) || (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999"),
  );
  for (const action of actions) {
    const actionsView =
      action.status === "completed" || action.status === "cancelled"
        ? "completed"
        : action.status === "overdue"
          ? "overdue"
          : DEFAULT_QUERY.actionsView;
    const due = displayDate(action.dueOn);
    entries.push({
      kind: "action",
      id: action.id,
      label: localised(language, action.title, action.titleDe),
      reference: action.reference,
      detail: joinDetail([statusWord(action.status, language), due ? fill(say(DETAIL.due, language), { date: due }) : null]),
      href: workHref(roleId, DEFAULT_QUERY, { tab: "actions", actionsView, item: action.id }),
      keywords: `${action.title} ${action.titleDe} ${action.relatedObjectId ?? ""} ${action.ownerLabel ?? ""}`,
    });
  }

  /* ---- Meetings and minutes --------------------------------------------- */
  for (const meeting of guarded("meeting", () => getMeetings(roleId, runId))) {
    const concluded = meeting.status === "concluded";
    entries.push({
      kind: "meeting",
      id: meeting.id,
      label: localised(language, meeting.title, meeting.titleDe),
      reference: meeting.reference,
      detail: joinDetail([displayDate(meeting.scheduledFor), startTimeOf(meeting.scheduledFor)]),
      href: concluded
        ? workHref(roleId, DEFAULT_QUERY, { tab: "meetings", meetingsView: "archive", item: meeting.id })
        : itemHref(roleId, "meetings", meeting.id),
      keywords: `${meeting.title} ${meeting.titleDe} ${meeting.subjectId ?? ""}`,
    });
  }

  for (const minutes of guarded("minutes", () => getMinutesForRole(roleId, runId))) {
    entries.push({
      kind: "minutes",
      id: minutes.id,
      label: minutes.title,
      reference: minutes.id,
      detail: joinDetail([statusWord(minutes.status, language), displayDate(minutes.createdAt)]),
      href: workHref(roleId, DEFAULT_QUERY, { tab: "meetings", meetingsView: "archive", item: minutes.id }),
      keywords: `${minutes.title} ${minutes.meetingId}`,
    });
  }

  /* ---- Inbox messages, handled ones included (the inbox module's read) -- */
  entries.push(...guarded("message", () => readInboxSearchEntries(roleId)));

  /* ---- Registers, scoped to the role's legal entity --------------------- */
  for (const assessment of guarded("assessment", () => getAssessments({}, runId))) {
    if (entityId !== null && assessment.entityId !== entityId) continue;
    entries.push({
      kind: "assessment",
      id: assessment.id,
      label: assessment.title,
      reference: assessment.reference,
      detail: joinDetail([assessment.cycle, statusWord(assessment.status, language)]),
      href: objectHref(roleId, [assessment.id, assessment.subjectId], scopes),
      keywords: `${assessment.subjectId} ${assessment.kind}`,
    });
  }

  for (const risk of guarded("risk", () => getRisks(runId))) {
    if (!inEntity(risk.entityIds)) continue;
    entries.push({
      kind: "risk",
      id: risk.id,
      label: localised(language, risk.title, risk.titleDe),
      reference: risk.id,
      detail: risk.taxonomyL1 || null,
      href: objectHref(roleId, [risk.id], scopes),
      keywords: `${risk.title} ${risk.titleDe} ${risk.taxonomyL2}`,
    });
  }

  for (const control of guarded("control", () => getControls(runId))) {
    if (!inEntity(control.entityIds)) continue;
    entries.push({
      kind: "control",
      id: control.id,
      label: localised(language, control.title, control.titleDe),
      reference: control.reference,
      detail: control.isKeyControl ? (language === "de" ? "Schluesselkontrolle" : "Key control") : null,
      href: objectHref(roleId, [control.id], scopes),
      keywords: `${control.title} ${control.titleDe} ${control.id}`,
    });
  }

  const suppliers = guarded("supplier", () => getSuppliers(runId));
  const supplierNames = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));
  for (const supplier of suppliers) {
    if (!inEntity(supplier.contractingEntityIds)) continue;
    entries.push({
      kind: "supplier",
      id: supplier.id,
      label: supplier.name,
      reference: supplier.id,
      detail: statusWord(supplier.criticality, language),
      href: objectHref(roleId, [supplier.id], scopes),
      keywords: `${supplier.legalForm} ${supplier.domicile}`,
    });
  }

  for (const service of guarded("service", () => getServices(runId))) {
    if (!inEntity(service.entityIds)) continue;
    entries.push({
      kind: "service",
      id: service.id,
      label: localised(language, service.name, service.nameDe),
      reference: service.id,
      detail: service.isImportantBusinessService
        ? language === "de"
          ? "Wichtiger Geschaeftsdienst"
          : "Important business service"
        : null,
      href: objectHref(roleId, [service.id, ...service.supplierIds], scopes),
      keywords: `${service.name} ${service.nameDe} ${service.supplierIds.map((id) => supplierNames.get(id) ?? id).join(" ")}`,
    });
  }

  for (const contract of guarded("contract", () =>
    db().select().from(contracts).where(eq(contracts.runId, runId)).all(),
  )) {
    if (entityId !== null && contract.entityId !== entityId) continue;
    const supplierName = supplierNames.get(contract.supplierId) ?? contract.supplierId;
    entries.push({
      kind: "contract",
      id: contract.id,
      label: contract.title,
      reference: contract.reference,
      detail: supplierName,
      href: objectHref(roleId, [contract.id, contract.supplierId], scopes),
      keywords: `${supplierName} ${contract.supplierId} ${contract.documentType}`,
    });
  }

  /*
   * Evidence. The decisions the role can see are read once so a document
   * cited by one can open there when no process covers it.
   */
  const citedBy = new Map<string, string>();
  for (const entry of guarded("decision evidence", () => getDecisions(roleId, atMoment, runId))) {
    for (const id of [...entry.decision.supportingEvidenceIds, ...entry.decision.opposingEvidenceIds]) {
      if (!citedBy.has(id)) citedBy.set(id, entry.decision.id);
    }
  }
  for (const document of guarded("evidence", () => getAllEvidenceDocuments(atMoment, runId))) {
    if (!inEntity(document.entityIds)) continue;
    const covered = scopes.some(
      (scope) => scope.status !== "completed" && document.relatedObjectIds.some((id) => scope.scopeIds.includes(id)),
    );
    const decisionId = citedBy.get(document.id);
    const href =
      covered || !decisionId
        ? objectHref(roleId, document.relatedObjectIds.length > 0 ? document.relatedObjectIds : [document.id], scopes)
        : `/workday/${roleId}/decisions#${encodeURIComponent(decisionId)}`;
    entries.push({
      kind: "evidence",
      id: document.id,
      label: localised(language, document.title, document.titleDe),
      reference: document.reference,
      detail: joinDetail([displayDate(document.documentDate), statusWord(document.status, language)]),
      href,
      keywords: `${document.title} ${document.titleDe} ${document.sourceSystem} ${document.relatedObjectIds.join(" ")}`,
    });
  }

  return {
    roleId,
    roleLabel: role ? localised(language, role.title, role.titleDe) : roleId,
    language,
    atMoment,
    entityLabel: entity?.shortName ?? null,
    kindOrder: kindOrderFor(roleId),
    entries,
    commands: buildPaletteCommands({
      roleId,
      language,
      nextMeeting: nextMeetingTarget(roleId, state),
      currentProcess: currentProcessTarget(scopes, language),
      openDecisions: countOpenDecisions(roleId, atMoment, runId),
    }),
  };
}

/* ==========================================================================
   Command targets
   ========================================================================== */

/**
 * The next meeting, chosen by the same rule the role selector uses, so the two
 * cannot name different meetings. A calendar entry with a meeting record opens
 * that meeting; one without opens its agenda entry.
 */
function nextMeetingTarget(roleId: RoleId, state: ScenarioState): CommandTarget {
  try {
    const calendar = getCalendar(roleId, state.runId);
    const selection = selectNextMeeting(calendar, state.currentMoment, state.scenarioDate);
    if (selection.outcome !== "next") return { found: false, reason: selection.outcome };
    const entry = selection.entry;
    const title = localised(state.language, entry.title, entry.titleDe);
    return {
      found: true,
      href: entry.meetingId ? itemHref(roleId, "meetings", entry.meetingId) : itemHref(roleId, "agenda", entry.id),
      detail: `${startTimeOf(entry.startsAt)} ${title}`,
    };
  } catch (error) {
    log.warn("The next meeting could not be read.", { roleId, error });
    return { found: false, reason: "none-scheduled" };
  }
}

/** The role's running process at its current stage, or the reason there is none. */
function currentProcessTarget(scopes: readonly WorkProcessScope[], language: Language): CommandTarget {
  const running = scopes.find((scope) => scope.status !== "completed" && scope.entryRoute);
  if (!running) return { found: false, reason: "none-active" };
  const href = processHref(running);
  if (!href) return { found: false, reason: "none-active" };
  const stage = running.currentStageName ? say(running.currentStageName, language) : running.currentStageId;
  return { found: true, href, detail: `${say(running.processName, language)}, ${stage}` };
}

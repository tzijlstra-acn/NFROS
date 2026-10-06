/**
 * Authority settings.
 *
 * A view of the deterministic gate, not a second implementation of it. That
 * sentence is on the screen as well as in this comment, because it is the
 * thing a reviewer most needs to understand about this page.
 *
 * Everything here is read live from `TOOL_REGISTRY` and
 * `ROLE_AUTHORITY_SCOPES` in `src/server/security/authority.ts`. There is no
 * configuration table behind it, no copy of the registry, and no way to change
 * anything from here. If this page could be edited, then the gate the trust
 * page documents would no longer be the gate that decides, and the most
 * important control in the product would have a second, softer path.
 *
 * The prohibited tools are listed in full and with their refusal reasons. They
 * exist as registry entries precisely so that the refusal is explicit and
 * testable rather than merely absent, and a settings screen that hid them
 * would undo that.
 *
 * The page follows the scenario language. Tool descriptions and autonomy
 * level descriptions are read from the registry as written there.
 */

import { IconLock, IconShieldLock } from "@tabler/icons-react";
import { AUTONOMY_LEVELS, ROLE_IDS, type AutonomyLevel, type RoleId } from "@/db/schema/core";
import { AUTHORITY_CLASSES, type AuthorityClass } from "@/db/schema/decisions";
import {
  AUTHORITY_SCOPES,
  AUTONOMY_DESCRIPTIONS,
  listToolRegistry,
  toolsAvailableAt,
  ROLE_AUTHORITY_SCOPES,
  TOOL_REGISTRY,
  type ToolDefinition,
} from "@/server/security/authority";
import { getScenarioState } from "@/scenario/engine/state";
import { getDb } from "@/db/client";
import { roles } from "@/db/schema/core";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import { eq } from "drizzle-orm";
import { SettingsHead, SettingsSection } from "@/components/settings/primitives";
import {
  AuthorityChip,
  Chip,
  Data,
  Item,
  List,
  Notice,
} from "@/components/workday-v2/primitives";
import { readAdminLanguage } from "@/product/status/sources";
import { pick } from "@/workday/contracts";
import { WrappingDetail } from "../_components/StatusRows";

export const dynamic = "force-dynamic";

type Pair = { en: string; de: string };

/** The approval policy each authority class carries, in words. */
const CLASS_POLICY: Record<AuthorityClass, Pair> = {
  READ: {
    en: "No approval. Retrieval and deterministic calculation only, and nothing is written.",
    de: "Keine Genehmigung. Nur Abruf und deterministische Berechnung, es wird nichts geschrieben.",
  },
  DRAFT: {
    en: "No approval. Produces text for a person to edit, confirm or reject, and changes no record.",
    de: "Keine Genehmigung. Erzeugt Text, den eine Person bearbeitet, bestaetigt oder verwirft, und aendert keinen Datensatz.",
  },
  PROPOSE: {
    en: "No approval. Produces a recommendation with alternatives and stated uncertainty, and changes no record.",
    de: "Keine Genehmigung. Erzeugt eine Empfehlung mit Alternativen und benannter Unsicherheit und aendert keinen Datensatz.",
  },
  POLICY_BOUND_AUTONOMOUS: {
    en: "Executes without an approval only at the most permissive autonomy level, and only where the action is low risk, reversible and routine. Below that level the same tool still runs, but only with an approval.",
    de: "Fuehrt nur auf der freizuegigsten Autonomiestufe ohne Genehmigung aus, und nur bei geringem Risiko, Umkehrbarkeit und Routine. Darunter laeuft dasselbe Werkzeug weiterhin, aber nur mit Genehmigung.",
  },
  APPROVAL_REQUIRED: {
    en: "Always requires a valid, unconsumed approval granted by a named person, bound to this exact payload by a fingerprint, with the rationale confirmed as their own.",
    de: "Erfordert immer eine gueltige, unverbrauchte Genehmigung einer namentlich genannten Person, per Fingerabdruck an genau diese Nutzlast gebunden, mit einer als eigene bestaetigten Begruendung.",
  },
  PROHIBITED: {
    en: "Never reachable at any autonomy level, with or without an approval.",
    de: "Auf keiner Autonomiestufe erreichbar, mit oder ohne Genehmigung.",
  },
};

/** The fallback behaviour when the gate refuses. */
const FALLBACK_BEHAVIOUR: Array<{ code: string; behaviour: Pair }> = [
  {
    code: "approval-missing",
    behaviour: {
      en: "Not a failure. The prepared action is returned to the user as a proposal with its payload fingerprint, and an audit event records that it was held for approval.",
      de: "Kein Fehler. Die vorbereitete Aktion geht als Vorschlag mit dem Fingerabdruck ihrer Nutzlast an die Person zurueck, und ein Audit-Ereignis haelt fest, dass sie zur Genehmigung zurueckgehalten wurde.",
    },
  },
  {
    code: "autonomy-too-low",
    behaviour: {
      en: "The action is withheld and the interface says which autonomy level would reach it. Nothing is executed and the refusal is recorded.",
      de: "Die Aktion wird zurueckgehalten, und die Oberflaeche nennt die Autonomiestufe, die sie erreichen wuerde. Nichts wird ausgefuehrt, die Ablehnung wird erfasst.",
    },
  },
  {
    code: "missing-scope",
    behaviour: {
      en: "The action is refused and the missing scope is named. Switching role is the remedy, not raising autonomy.",
      de: "Die Aktion wird abgelehnt und die fehlende Befugnis benannt. Abhilfe ist ein Rollenwechsel, keine hoehere Autonomie.",
    },
  },
  {
    code: "approval-payload-mismatch",
    behaviour: {
      en: "The action is refused. An approval granted for one change never transfers to a different one.",
      de: "Die Aktion wird abgelehnt. Eine Genehmigung fuer eine Aenderung gilt nie fuer eine andere.",
    },
  },
  {
    code: "approval-already-consumed",
    behaviour: {
      en: "The action is refused. An approval is single use and a further change needs a new one.",
      de: "Die Aktion wird abgelehnt. Eine Genehmigung gilt einmal, eine weitere Aenderung braucht eine neue.",
    },
  },
  {
    code: "self-approval",
    behaviour: {
      en: "The action is refused. An agent identity can never be the approver, and the registry carries approveOwnProposal as a prohibited tool so the refusal is explicit.",
      de: "Die Aktion wird abgelehnt. Eine Agentenidentitaet kann nie genehmigen, und das Verzeichnis fuehrt approveOwnProposal als verbotenes Werkzeug, damit die Ablehnung ausdruecklich ist.",
    },
  },
  {
    code: "prohibited",
    behaviour: {
      en: "The action is refused and the refusal reason is the tool's own description. The attempt is written to the audit trail, because a record of a refusal is itself evidence that the control works.",
      de: "Die Aktion wird abgelehnt, die Begruendung ist die Beschreibung des Werkzeugs selbst. Der Versuch wird im Audit-Trail festgehalten, denn eine erfasste Ablehnung ist selbst ein Nachweis, dass die Kontrolle wirkt.",
    },
  },
];

const COPY = {
  eyebrow: { en: "Administrator area", de: "Administrationsbereich" },
  title: { en: "Authority", de: "Befugnisse" },
  lede: {
    en: "Every tool in the product, its authority class, the role scopes it requires and the approval policy that governs it. An external change to a bank system passes through the same gate as a local one: there is no separate authority path for integration actions.",
    de: "Jedes Werkzeug im Produkt, seine Befugnisklasse, die erforderlichen Rollenbefugnisse und die geltende Genehmigungsregel. Eine externe Aenderung an einem Banksystem durchlaeuft dieselbe Pruefung wie eine lokale: es gibt keinen eigenen Befugnisweg fuer Integrationsaktionen.",
  },
  viewTitle: {
    en: "This screen is a view of the deterministic gate, not a second implementation of it.",
    de: "Diese Seite ist eine Ansicht der deterministischen Pruefung, keine zweite Umsetzung davon.",
  },
  viewBody: {
    en: "The enforcement boundary is the authority gate in the server security module. Everything below is read live from the tool registry and the role scope map at request time, so it cannot drift from what the gate decides. It is read only in this build and there is no configuration table behind it: nothing on this page can be changed, and nothing on this page changes what is permitted.",
    de: "Die Durchsetzungsgrenze ist die Befugnispruefung im Sicherheitsmodul des Servers. Alles unten wird bei jeder Anfrage aus dem Werkzeugverzeichnis und der Befugniszuordnung der Rollen gelesen und kann daher nicht von der Entscheidung der Pruefung abweichen. Die Seite ist in diesem Build nur lesend, ohne Konfigurationstabelle dahinter: hier laesst sich nichts aendern, und nichts hier aendert, was erlaubt ist.",
  },
  numbers: { en: "The gate in numbers", de: "Die Pruefung in Zahlen" },
  tools: { en: "Tools in the registry", de: "Werkzeuge im Verzeichnis" },
  material: { en: "Material tools, which always require an approval", de: "Wesentliche Werkzeuge, die immer eine Genehmigung brauchen" },
  autonomous: { en: "Tools that may execute within policy without an approval", de: "Werkzeuge, die innerhalb der Richtlinie ohne Genehmigung ausfuehren duerfen" },
  prohibitedCount: { en: "Prohibited tools, refused at every autonomy level", de: "Verbotene Werkzeuge, auf jeder Autonomiestufe abgelehnt" },
  scopes: { en: "Authority scopes a role can hold", de: "Befugnisse, die eine Rolle halten kann" },
  writes: { en: "Tools that write to a record", de: "Werkzeuge, die einen Datensatz schreiben" },
  thresholds: { en: "Autonomous thresholds", de: "Autonomieschwellen" },
  thresholdsNote: {
    en: "The autonomy level decides which authority classes are reachable at all. Raising it never makes a material change free: a material tool requires an approval at every level, including the most permissive one. The counts below come from evaluating the real gate once per tool at each level.",
    de: "Die Autonomiestufe bestimmt, welche Befugnisklassen ueberhaupt erreichbar sind. Eine hoehere Stufe macht eine wesentliche Aenderung nie genehmigungsfrei: ein wesentliches Werkzeug braucht auf jeder Stufe eine Genehmigung, auch auf der freizuegigsten. Die Zahlen unten entstehen, indem die echte Pruefung je Werkzeug und Stufe einmal ausgewertet wird.",
  },
  inForce: { en: "In force now", de: "Jetzt in Kraft" },
  reachable: { en: "reachable", de: "erreichbar" },
  withheld: { en: "withheld", de: "zurueckgehalten" },
  policy: { en: "Approval policy per authority class", de: "Genehmigungsregel je Befugnisklasse" },
  toolsWord: { en: "tools", de: "Werkzeuge" },
  roleScopes: { en: "Role scopes", de: "Rollenbefugnisse" },
  roleScopesNote: {
    en: "A role holds a set of scopes and a tool requires all of its own. A missing scope is refused regardless of the autonomy level, which is why switching role, and not raising autonomy, is the remedy when the gate reports one.",
    de: "Eine Rolle haelt eine Menge von Befugnissen, und ein Werkzeug verlangt alle eigenen. Eine fehlende Befugnis wird unabhaengig von der Autonomiestufe abgelehnt; deshalb hilft ein Rollenwechsel und keine hoehere Autonomie, wenn die Pruefung eine meldet.",
  },
  actingNow: { en: "Acting now", de: "Handelt jetzt" },
  of: { en: "of", de: "von" },
  prohibited: { en: "Prohibited actions", de: "Verbotene Aktionen" },
  prohibitedNote: {
    en: "These are registry entries rather than omissions, which is deliberate: an action that is simply absent cannot be tested for, and a refusal that leaves no record teaches an auditor nothing. Each attempt is refused and written to the audit trail.",
    de: "Das sind bewusst Verzeichniseintraege und keine Auslassungen: eine schlicht fehlende Aktion laesst sich nicht pruefen, und eine Ablehnung ohne Spur lehrt eine Pruefung nichts. Jeder Versuch wird abgelehnt und im Audit-Trail festgehalten.",
  },
  refused: { en: "Refused by design", de: "Bewusst abgelehnt" },
  fallback: { en: "Fallback behaviour on refusal", de: "Verhalten bei Ablehnung" },
  everyTool: { en: "Every tool", de: "Alle Werkzeuge" },
  everyToolNote: {
    en: "The complete registry, read from the gate. A tool that is not in this list cannot be called, which is why the registry and not the prompt is the security boundary. An outbound integration command names one of these tools and is evaluated against it exactly as a local mutation is.",
    de: "Das vollstaendige Verzeichnis, aus der Pruefung gelesen. Ein Werkzeug, das hier fehlt, laesst sich nicht aufrufen; deshalb ist das Verzeichnis und nicht der Prompt die Sicherheitsgrenze. Ein ausgehender Integrationsbefehl nennt eines dieser Werkzeuge und wird genau wie eine lokale Aenderung dagegen geprueft.",
  },
  materialChip: { en: "Material", de: "Wesentlich" },
  writesChip: { en: "Writes", de: "Schreibt" },
  readOnlyChip: { en: "Read only", de: "Nur lesend" },
  notReversible: { en: "Not reversible here", de: "Hier nicht umkehrbar" },
  noScope: { en: "no scope", de: "keine Befugnis" },
  external: { en: "How this applies to an external change", de: "Wie das fuer eine externe Aenderung gilt" },
  externalNote: {
    en: "An outbound integration command carries the acting identity, the role, the authority class, the payload fingerprint and the approval reference. Before anything is sent, the dispatcher calls the same gate function this page reads from. There is no integration specific authority path and no bypass: a change to the bank's GRC platform is subject to exactly the conditions a change to a local record is subject to, and it additionally cannot be reported as complete until the target system acknowledges it.",
    de: "Ein ausgehender Integrationsbefehl traegt die handelnde Identitaet, die Rolle, die Befugnisklasse, den Fingerabdruck der Nutzlast und den Genehmigungsverweis. Bevor etwas gesendet wird, ruft der Versand dieselbe Pruefung auf, aus der diese Seite liest. Es gibt keinen eigenen Befugnisweg fuer Integrationen und keine Umgehung: eine Aenderung an der GRC-Plattform der Bank unterliegt genau den Bedingungen einer lokalen Aenderung und gilt zusaetzlich erst als abgeschlossen, wenn das Zielsystem sie bestaetigt.",
  },
  conditions: { en: "External change conditions", de: "Bedingungen fuer externe Aenderungen" },
  capabilityTitle: {
    en: "The runtime refuses an undeclared capability first",
    de: "Die Laufzeit lehnt zuerst eine nicht deklarierte Faehigkeit ab",
  },
  capabilityBody: {
    en: "A connector that does not declare a write for the target object type is refused before the gate is consulted, because a missing capability is a configuration fact rather than a question of authority.",
    de: "Ein Konnektor, der fuer den Zielobjekttyp kein Schreiben deklariert, wird abgelehnt, bevor die Pruefung befragt wird, denn eine fehlende Faehigkeit ist eine Konfigurationstatsache und keine Befugnisfrage.",
  },
  gateTitle: { en: "Then the gate decides", de: "Dann entscheidet die Pruefung" },
  gateBody: {
    en: "The command names a tool in the registry above.{example} A refusal writes an audit event and the command is cancelled or held for approval.",
    de: "Der Befehl nennt ein Werkzeug aus dem Verzeichnis oben.{example} Eine Ablehnung schreibt ein Audit-Ereignis, und der Befehl wird verworfen oder zur Genehmigung zurueckgehalten.",
  },
  gateExample: {
    en: " An assessment update, for example, is APPROVAL_REQUIRED and material.",
    de: " Eine Aktualisierung einer Bewertung ist zum Beispiel APPROVAL_REQUIRED und wesentlich.",
  },
  outboxTitle: { en: "Then the outbox, and only then the target", de: "Dann der Ausgang, und erst dann das Ziel" },
  outboxBody: {
    en: "The durable record of intent is written before the attempt, so a process that dies mid flight leaves a command an operator can see and retry rather than a change that may or may not have happened.",
    de: "Der dauerhafte Absichtsdatensatz wird vor dem Versuch geschrieben; ein Prozess, der mittendrin abbricht, hinterlaesst so einen sichtbaren, wiederholbaren Befehl statt einer Aenderung, die vielleicht geschehen ist.",
  },
  receiptTitle: { en: "A receipt comes from the acknowledgement", de: "Ein Beleg entsteht aus der Bestaetigung" },
  receiptBody: {
    en: "Nothing is reported as done before the target system says so. A failed delivery leaves the approved decision intact and produces no acknowledged receipt line.",
    de: "Nichts gilt als erledigt, bevor das Zielsystem es bestaetigt. Eine fehlgeschlagene Zustellung laesst die genehmigte Entscheidung unberuehrt und erzeugt keine bestaetigte Belegzeile.",
  },
} as const;

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

export default function AuthoritySettingsPage() {
  const language = readAdminLanguage();
  const say = (pair: Pair) => pick(pair, language);
  const state = getScenarioState();
  const runId = state?.runId ?? DEFAULT_RUN_ID;
  const activeLevel: AutonomyLevel = state?.autonomyLevel ?? "act-with-approval";

  const registry = listToolRegistry();
  const roleRows = getDb().select().from(roles).where(eq(roles.runId, runId)).all();
  const roleTitle = (roleId: RoleId): string =>
    roleRows.find((row) => row.id === roleId)?.title ?? roleId;

  const byClass = new Map<AuthorityClass, ToolDefinition[]>();
  for (const tool of registry) {
    const list = byClass.get(tool.authorityClass) ?? [];
    list.push(tool);
    byClass.set(tool.authorityClass, list);
  }

  const prohibited = byClass.get("PROHIBITED") ?? [];
  const material = registry.filter((tool) => tool.material);
  const autonomous = registry.filter(
    (tool) => tool.authorityClass === "POLICY_BOUND_AUTONOMOUS" && !tool.material,
  );

  return (
    <div className="app-stack app-stack-6">
      <SettingsHead eyebrow={say(COPY.eyebrow)} title={say(COPY.title)} lede={say(COPY.lede)} />

      <Notice tone="warning">
        <span className="app-stack app-stack-1">
          <span className="app-strong">{say(COPY.viewTitle)}</span>
          <span>{say(COPY.viewBody)}</span>
        </span>
      </Notice>

      <SettingsSection title={say(COPY.numbers)}>
        <div className="app-grid-3">
          <Item title={<Data size="sm">{registry.length}</Data>} subtitle={say(COPY.tools)} />
          <Item title={<Data size="sm">{material.length}</Data>} subtitle={say(COPY.material)} />
          <Item title={<Data size="sm">{autonomous.length}</Data>} subtitle={say(COPY.autonomous)} />
          <Item
            title={<Data size="sm">{prohibited.length}</Data>}
            subtitle={say(COPY.prohibitedCount)}
          />
          <Item title={<Data size="sm">{AUTHORITY_SCOPES.length}</Data>} subtitle={say(COPY.scopes)} />
          <Item
            title={<Data size="sm">{registry.filter((tool) => tool.mutates).length}</Data>}
            subtitle={say(COPY.writes)}
          />
        </div>
      </SettingsSection>

      <SettingsSection title={say(COPY.thresholds)} count={AUTONOMY_LEVELS.length}>
        <div className="app-stack app-stack-3">
          <p className="app-secondary" style={{ maxWidth: "76ch", margin: 0 }}>
            {say(COPY.thresholdsNote)}
          </p>
          <List label={say(COPY.thresholds)}>
            {AUTONOMY_LEVELS.map((level) => {
              const preview = toolsAvailableAt(level, state?.activeRoleId ?? "rcsa");
              return (
                <Item
                  key={level}
                  title={
                    <span className="app-row app-row-wrap">
                      <span className="app-strong">{AUTONOMY_DESCRIPTIONS[level].label}</span>
                      <span className="app-oid">{level}</span>
                      {level === activeLevel ? <Chip tone="ai">{say(COPY.inForce)}</Chip> : null}
                    </span>
                  }
                  subtitle={AUTONOMY_DESCRIPTIONS[level].detail}
                  trailing={
                    <span className="app-row">
                      <Data>{preview.available.length}</Data>
                      <span className="app-faint">{say(COPY.reachable)}</span>
                      <Data>{preview.withheld.length}</Data>
                      <span className="app-faint">{say(COPY.withheld)}</span>
                    </span>
                  }
                />
              );
            })}
          </List>
        </div>
      </SettingsSection>

      <SettingsSection title={say(COPY.policy)} count={AUTHORITY_CLASSES.length}>
        <List label={say(COPY.policy)}>
          {AUTHORITY_CLASSES.map((authorityClass) => (
            <Item
              key={authorityClass}
              title={
                <span className="app-row app-row-wrap">
                  <AuthorityChip authorityClass={authorityClass} language={language} />
                  <span className="app-oid">{authorityClass}</span>
                </span>
              }
              trailing={
                <span className="app-row">
                  <Data>{(byClass.get(authorityClass) ?? []).length}</Data>
                  <span className="app-faint">{say(COPY.toolsWord)}</span>
                </span>
              }
            >
              <WrappingDetail>{say(CLASS_POLICY[authorityClass])}</WrappingDetail>
            </Item>
          ))}
        </List>
      </SettingsSection>

      <SettingsSection title={say(COPY.roleScopes)} count={ROLE_IDS.length}>
        <div className="app-stack app-stack-3">
          <p className="app-secondary" style={{ maxWidth: "76ch", margin: 0 }}>
            {say(COPY.roleScopesNote)}
          </p>
          <List label={say(COPY.roleScopes)}>
            {ROLE_IDS.map((roleId) => {
              const scopes = ROLE_AUTHORITY_SCOPES[roleId];
              return (
                <Item
                  key={roleId}
                  large
                  title={
                    <span className="app-row app-row-wrap">
                      <span className="app-strong">{roleTitle(roleId)}</span>
                      <span className="app-oid">{roleId}</span>
                      {roleId === state?.activeRoleId ? (
                        <Chip tone="ai">{say(COPY.actingNow)}</Chip>
                      ) : null}
                    </span>
                  }
                  subtitle={
                    <span className="app-row app-row-wrap" role="list" aria-label={`${roleId} scopes`}>
                      {scopes.map((scope) => (
                        <span key={scope} role="listitem" className="app-oid">
                          {scope}
                        </span>
                      ))}
                    </span>
                  }
                  trailing={
                    <span className="app-row">
                      <Data>{scopes.length}</Data>
                      <span className="app-faint">
                        {say(COPY.of)} {AUTHORITY_SCOPES.length}
                      </span>
                    </span>
                  }
                />
              );
            })}
          </List>
        </div>
      </SettingsSection>

      <SettingsSection title={say(COPY.prohibited)} count={prohibited.length}>
        <div className="app-stack app-stack-3">
          <p className="app-secondary" style={{ maxWidth: "76ch", margin: 0 }}>
            {say(COPY.prohibitedNote)}
          </p>
          <List label={say(COPY.prohibited)}>
            {prohibited.map((tool) => (
              <Item
                key={tool.name}
                title={
                  <span className="app-row app-row-wrap">
                    <IconLock size={12} stroke={2} aria-hidden="true" />
                    <span className="app-oid">{tool.name}</span>
                    <Chip tone="danger">{say(COPY.refused)}</Chip>
                  </span>
                }
                subtitle={tool.description}
              />
            ))}
          </List>
        </div>
      </SettingsSection>

      <SettingsSection title={say(COPY.fallback)} count={FALLBACK_BEHAVIOUR.length}>
        <List label={say(COPY.fallback)}>
          {FALLBACK_BEHAVIOUR.map((entry) => (
            <Item key={entry.code} title={<span className="app-oid">{entry.code}</span>}>
              <WrappingDetail>{say(entry.behaviour)}</WrappingDetail>
            </Item>
          ))}
        </List>
      </SettingsSection>

      <SettingsSection title={say(COPY.everyTool)} count={registry.length}>
        <div className="app-stack app-stack-3">
          <p className="app-secondary" style={{ maxWidth: "76ch", margin: 0 }}>
            {say(COPY.everyToolNote)}
          </p>
          <List label={say(COPY.everyTool)}>
            {registry.map((tool) => (
              <Item
                key={tool.name}
                title={
                  <span className="app-row app-row-wrap">
                    <span className="app-oid">{tool.name}</span>
                    <AuthorityChip authorityClass={tool.authorityClass} language={language} />
                    {tool.material ? <Chip tone="warning">{say(COPY.materialChip)}</Chip> : null}
                    {tool.mutates ? (
                      <Chip tone="info">{say(COPY.writesChip)}</Chip>
                    ) : (
                      <Chip tone="neutral">{say(COPY.readOnlyChip)}</Chip>
                    )}
                    {tool.reversible ? null : <Chip tone="danger">{say(COPY.notReversible)}</Chip>}
                  </span>
                }
                subtitle={tool.description}
                trailing={
                  tool.requiredScopes.length === 0 ? (
                    <span className="app-faint">{say(COPY.noScope)}</span>
                  ) : (
                    <span className="app-row app-row-wrap" style={{ justifyContent: "flex-end" }}>
                      {tool.requiredScopes.map((scope) => (
                        <span key={scope} className="app-oid">
                          {scope}
                        </span>
                      ))}
                    </span>
                  )
                }
              />
            ))}
          </List>
        </div>
      </SettingsSection>

      <SettingsSection title={say(COPY.external)}>
        <div className="app-stack app-stack-3">
          <p className="app-secondary" style={{ maxWidth: "76ch", margin: 0 }}>
            {say(COPY.externalNote)}
          </p>
          <List label={say(COPY.conditions)}>
            <Item
              leading={<IconShieldLock size={15} stroke={1.8} aria-hidden="true" />}
              title={say(COPY.capabilityTitle)}
            >
              <WrappingDetail>{say(COPY.capabilityBody)}</WrappingDetail>
            </Item>
            <Item
              leading={<IconShieldLock size={15} stroke={1.8} aria-hidden="true" />}
              title={say(COPY.gateTitle)}
            >
              <WrappingDetail>
                {fill(say(COPY.gateBody), {
                  example: TOOL_REGISTRY.updateAssessment ? say(COPY.gateExample) : "",
                })}
              </WrappingDetail>
            </Item>
            <Item
              leading={<IconShieldLock size={15} stroke={1.8} aria-hidden="true" />}
              title={say(COPY.outboxTitle)}
            >
              <WrappingDetail>{say(COPY.outboxBody)}</WrappingDetail>
            </Item>
            <Item
              leading={<IconShieldLock size={15} stroke={1.8} aria-hidden="true" />}
              title={say(COPY.receiptTitle)}
            >
              <WrappingDetail>{say(COPY.receiptBody)}</WrappingDetail>
            </Item>
          </List>
        </div>
      </SettingsSection>
    </div>
  );
}

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
import type { Language } from "@/i18n/labels";

export const dynamic = "force-dynamic";

/** The approval policy each authority class carries, in words. */
const CLASS_POLICY: Record<AuthorityClass, string> = {
  READ: "No approval. Retrieval and deterministic calculation only, and nothing is written.",
  DRAFT: "No approval. Produces text for a person to edit, confirm or reject, and changes no record.",
  PROPOSE:
    "No approval. Produces a recommendation with alternatives and stated uncertainty, and changes no record.",
  POLICY_BOUND_AUTONOMOUS:
    "Executes without an approval only at the most permissive autonomy level, and only where the action is low risk, reversible and routine. Below that level the same tool still runs, but only with an approval.",
  APPROVAL_REQUIRED:
    "Always requires a valid, unconsumed approval granted by a named person, bound to this exact payload by a fingerprint, with the rationale confirmed as their own.",
  PROHIBITED: "Never reachable at any autonomy level, with or without an approval.",
};

/** The fallback behaviour when the gate refuses. */
const FALLBACK_BEHAVIOUR: Array<{ code: string; behaviour: string }> = [
  {
    code: "approval-missing",
    behaviour:
      "Not a failure. The prepared action is returned to the user as a proposal with its payload fingerprint, and an audit event records that it was held for approval.",
  },
  {
    code: "autonomy-too-low",
    behaviour:
      "The action is withheld and the interface says which autonomy level would reach it. Nothing is executed and the refusal is recorded.",
  },
  {
    code: "missing-scope",
    behaviour:
      "The action is refused and the missing scope is named. Switching role is the remedy, not raising autonomy.",
  },
  {
    code: "approval-payload-mismatch",
    behaviour:
      "The action is refused. An approval granted for one change never transfers to a different one.",
  },
  {
    code: "approval-already-consumed",
    behaviour: "The action is refused. An approval is single use and a further change needs a new one.",
  },
  {
    code: "self-approval",
    behaviour:
      "The action is refused. An agent identity can never be the approver, and the registry carries approveOwnProposal as a prohibited tool so the refusal is explicit.",
  },
  {
    code: "prohibited",
    behaviour:
      "The action is refused and the refusal reason is the tool's own description. The attempt is written to the audit trail, because a record of a refusal is itself evidence that the control works.",
  },
];

export default function AuthoritySettingsPage() {
  const language: Language = "en";
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
      <SettingsHead
        eyebrow="Administrator area"
        title="Authority"
        lede="Every tool in the product, its authority class, the role scopes it requires and the approval policy that governs it. An external change to a bank system passes through the same gate as a local one: there is no separate authority path for integration actions."
      />

      <Notice tone="warning">
        <span className="app-stack app-stack-1">
          <span className="app-strong">
            This screen is a view of the deterministic gate, not a second implementation of it.
          </span>
          <span>
            The enforcement boundary is the authority gate in the server security module. Everything
            below is read live from the tool registry and the role scope map at request time, so it
            cannot drift from what the gate decides. It is read only in this build and there is no
            configuration table behind it: nothing on this page can be changed, and nothing on this
            page changes what is permitted.
          </span>
        </span>
      </Notice>

      <SettingsSection title="The gate in numbers">
        <div className="app-grid-3">
          <Item title={<Data size="sm">{registry.length}</Data>} subtitle="Tools in the registry" />
          <Item
            title={<Data size="sm">{material.length}</Data>}
            subtitle="Material tools, which always require an approval"
          />
          <Item
            title={<Data size="sm">{autonomous.length}</Data>}
            subtitle="Tools that may execute within policy without an approval"
          />
          <Item
            title={<Data size="sm">{prohibited.length}</Data>}
            subtitle="Prohibited tools, refused at every autonomy level"
          />
          <Item
            title={<Data size="sm">{AUTHORITY_SCOPES.length}</Data>}
            subtitle="Authority scopes a role can hold"
          />
          <Item
            title={<Data size="sm">{registry.filter((tool) => tool.mutates).length}</Data>}
            subtitle="Tools that write to a record"
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Autonomous thresholds" count={AUTONOMY_LEVELS.length}>
        <div className="app-stack app-stack-3">
          <p className="app-secondary" style={{ maxWidth: "76ch", margin: 0 }}>
            The autonomy level decides which authority classes are reachable at all. Raising it
            never makes a material change free: a material tool requires an approval at every level,
            including the most permissive one. The counts below come from evaluating the real gate
            once per tool at each level.
          </p>
          <List label="Autonomy levels">
            {AUTONOMY_LEVELS.map((level) => {
              const preview = toolsAvailableAt(level, state?.activeRoleId ?? "rcsa");
              return (
                <Item
                  key={level}
                  title={
                    <span className="app-row app-row-wrap">
                      <span className="app-strong">{AUTONOMY_DESCRIPTIONS[level].label}</span>
                      <span className="app-oid">{level}</span>
                      {level === activeLevel ? <Chip tone="ai">In force now</Chip> : null}
                    </span>
                  }
                  subtitle={AUTONOMY_DESCRIPTIONS[level].detail}
                  trailing={
                    <span className="app-row">
                      <Data>{preview.available.length}</Data>
                      <span className="app-faint">reachable</span>
                      <Data>{preview.withheld.length}</Data>
                      <span className="app-faint">withheld</span>
                    </span>
                  }
                />
              );
            })}
          </List>
        </div>
      </SettingsSection>

      <SettingsSection title="Approval policy per authority class" count={AUTHORITY_CLASSES.length}>
        <List label="Approval policy">
          {AUTHORITY_CLASSES.map((authorityClass) => (
            <Item
              key={authorityClass}
              title={
                <span className="app-row app-row-wrap">
                  <AuthorityChip authorityClass={authorityClass} language={language} />
                  <span className="app-oid">{authorityClass}</span>
                </span>
              }
              subtitle={CLASS_POLICY[authorityClass]}
              trailing={
                <span className="app-row">
                  <Data>{(byClass.get(authorityClass) ?? []).length}</Data>
                  <span className="app-faint">tools</span>
                </span>
              }
            />
          ))}
        </List>
      </SettingsSection>

      <SettingsSection title="Role scopes" count={ROLE_IDS.length}>
        <div className="app-stack app-stack-3">
          <p className="app-secondary" style={{ maxWidth: "76ch", margin: 0 }}>
            A role holds a set of scopes and a tool requires all of its own. A missing scope is
            refused regardless of the autonomy level, which is why switching role, and not raising
            autonomy, is the remedy when the gate reports one.
          </p>
          <List label="Role authority scopes">
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
                      {roleId === state?.activeRoleId ? <Chip tone="ai">Acting now</Chip> : null}
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
                      <span className="app-faint">of {AUTHORITY_SCOPES.length}</span>
                    </span>
                  }
                />
              );
            })}
          </List>
        </div>
      </SettingsSection>

      <SettingsSection title="Prohibited actions" count={prohibited.length}>
        <div className="app-stack app-stack-3">
          <p className="app-secondary" style={{ maxWidth: "76ch", margin: 0 }}>
            These are registry entries rather than omissions, which is deliberate: an action that is
            simply absent cannot be tested for, and a refusal that leaves no record teaches an
            auditor nothing. Each attempt is refused and written to the audit trail.
          </p>
          <List label="Prohibited tools">
            {prohibited.map((tool) => (
              <Item
                key={tool.name}
                title={
                  <span className="app-row app-row-wrap">
                    <IconLock size={12} stroke={2} aria-hidden="true" />
                    <span className="app-oid">{tool.name}</span>
                    <Chip tone="danger">Refused by design</Chip>
                  </span>
                }
                subtitle={tool.description}
              />
            ))}
          </List>
        </div>
      </SettingsSection>

      <SettingsSection title="Fallback behaviour on refusal" count={FALLBACK_BEHAVIOUR.length}>
        <List label="Fallback behaviour">
          {FALLBACK_BEHAVIOUR.map((entry) => (
            <Item
              key={entry.code}
              title={<span className="app-oid">{entry.code}</span>}
              subtitle={entry.behaviour}
            />
          ))}
        </List>
      </SettingsSection>

      <SettingsSection title="Every tool" count={registry.length}>
        <div className="app-stack app-stack-3">
          <p className="app-secondary" style={{ maxWidth: "76ch", margin: 0 }}>
            The complete registry, read from the gate. A tool that is not in this list cannot be
            called, which is why the registry and not the prompt is the security boundary. An
            outbound integration command names one of these tools and is evaluated against it
            exactly as a local mutation is.
          </p>
          <List label="Tool registry">
            {registry.map((tool) => (
              <Item
                key={tool.name}
                title={
                  <span className="app-row app-row-wrap">
                    <span className="app-oid">{tool.name}</span>
                    <AuthorityChip authorityClass={tool.authorityClass} language={language} />
                    {tool.material ? <Chip tone="warning">Material</Chip> : null}
                    {tool.mutates ? <Chip tone="info">Writes</Chip> : <Chip tone="neutral">Read only</Chip>}
                    {tool.reversible ? null : <Chip tone="danger">Not reversible here</Chip>}
                  </span>
                }
                subtitle={tool.description}
                trailing={
                  tool.requiredScopes.length === 0 ? (
                    <span className="app-faint">no scope</span>
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

      <SettingsSection title="How this applies to an external change">
        <div className="app-stack app-stack-3">
          <p className="app-secondary" style={{ maxWidth: "76ch", margin: 0 }}>
            An outbound integration command carries the acting identity, the role, the authority
            class, the payload fingerprint and the approval reference. Before anything is sent, the
            dispatcher calls the same gate function this page reads from. There is no integration
            specific authority path and no bypass: a change to the bank's GRC platform is subject to
            exactly the conditions a change to a local record is subject to, and it additionally
            cannot be reported as complete until the target system acknowledges it.
          </p>
          <List label="External change conditions">
            <Item
              leading={<IconShieldLock size={15} stroke={1.8} aria-hidden="true" />}
              title="The runtime refuses an undeclared capability first"
              subtitle="A connector that does not declare a write for the target object type is refused before the gate is consulted, because a missing capability is a configuration fact rather than a question of authority."
            />
            <Item
              leading={<IconShieldLock size={15} stroke={1.8} aria-hidden="true" />}
              title="Then the gate decides"
              subtitle={`The command names a tool in the registry above. ${TOOL_REGISTRY.updateAssessment ? "An assessment update, for example, is APPROVAL_REQUIRED and material." : ""} A refusal writes an audit event and the command is cancelled or held for approval.`}
            />
            <Item
              leading={<IconShieldLock size={15} stroke={1.8} aria-hidden="true" />}
              title="Then the outbox, and only then the target"
              subtitle="The durable record of intent is written before the attempt, so a process that dies mid flight leaves a command an operator can see and retry rather than a change that may or may not have happened."
            />
            <Item
              leading={<IconShieldLock size={15} stroke={1.8} aria-hidden="true" />}
              title="A receipt comes from the acknowledgement"
              subtitle="Nothing is reported as done before the target system says so. A failed delivery leaves the approved decision intact and produces no acknowledged receipt line."
            />
          </List>
        </div>
      </SettingsSection>
    </div>
  );
}

/**
 * The feedback inbox (plan 7.8): what an analyst submits from the workday,
 * what the product owner does with it, and how AI feedback reaches it.
 *
 * Structured on purpose. A submission is one of the eight kinds, a short
 * statement in the person's words and where they were (role, route, legal
 * entity); it is never a chat transcript, and nothing here reads one ("Do not
 * rely on free-form chat transcripts as product research").
 *
 * Who may do what:
 *   - submitting is the analyst's, from the workday, as the holder of the
 *     role they are working in. It is not a console action and needs no
 *     product-owner persona;
 *   - triage, links, severity and release tracking need `feedback.triage`
 *     (the Platform Product Owner and the relevant owners hold it);
 *   - assigning an owner also needs `feedback.assign`;
 *   - forwarding AI feedback into the inbox is triage.
 *
 * Owners are responsibilities (the product-owner personas), never named
 * employees, so the inbox cannot become a list of people to chase.
 *
 * Server only.
 */

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ROLE_APP_REGISTRY, getProcessDefinition, getRoleApp } from "@/role-apps/registry";
import { ROLE_IDS, type RoleId } from "@/db/schema/core";
import {
  PRODUCT_FEEDBACK_KINDS,
  PRODUCT_FEEDBACK_STATUSES,
  SEVERITIES,
  type ProductFeedbackKind,
  type ProductFeedbackStatus,
  type Severity,
} from "@/db/schema/product-console";
import type { AIFeedbackKind } from "@/db/schema/ai-partner";
import { getProductFeedback, submitProductFeedback, triageProductFeedback, type ProductFeedbackItem } from "@/db/repositories/product-feedback";
import { linkAIFeedbackToProductFeedback, listAIFeedback } from "@/db/repositories/ai-feedback";
import { roleHolder } from "@/features/work/governance";
import { getScenarioState } from "@/scenario/engine/state";
import { recordAuditEvent } from "@/server/security/audit";
import { authorizeConsoleAction, governConsoleAction, type ConsoleActionResult } from "@/features/product/governance";
import { PRODUCT_PERSONAS, PRODUCT_PERSONA_IDS, type Bilingual } from "@/features/product/permissions";
import { FEEDBACK_STATUS_LABELS } from "./copy";

/** Which product feedback kind a piece of AI feedback becomes. "Useful" is a signal, not an issue. */
export const AI_TO_PRODUCT_KIND: Record<AIFeedbackKind, ProductFeedbackKind | null> = {
  useful: null,
  "not-useful": "unhelpful-suggestion",
  "wrong-source": "wrong-source",
  "wrong-interpretation": "incorrect-interpretation",
  "missing-context": "missing-context",
  "too-verbose": "unhelpful-suggestion",
};

/* ==========================================================================
   Submitting, from the workday
   ========================================================================== */

export const feedbackSubmissionSchema = z.object({
  kind: z.enum(PRODUCT_FEEDBACK_KINDS),
  summary: z.string().trim().min(8).max(280),
  detail: z.string().trim().max(2000).default(""),
  roleId: z.enum(ROLE_IDS),
  route: z
    .string()
    .max(200)
    .regex(/^\/workday(\/[A-Za-z0-9._~-]+)*\/?$/)
    .nullable()
    .default(null),
});

export type FeedbackSubmission = z.infer<typeof feedbackSubmissionSchema>;

export type SubmitResult = { ok: true; item: ProductFeedbackItem } | { ok: false; reason: Bilingual };

/**
 * Records one piece of product feedback from the workday. The submitter is
 * the holder of the role the person is working in, as every workday action
 * records it until named identities arrive (Wave 5).
 */
export function submitWorkdayFeedback(input: unknown, at: string = new Date().toISOString()): SubmitResult {
  const parsed = feedbackSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: {
        en: "Choose a kind and describe it in at least eight characters.",
        de: "Waehlen Sie eine Art und beschreiben Sie sie in mindestens acht Zeichen.",
      },
    };
  }
  const submission = parsed.data;
  const state = getScenarioState();
  const userId = (() => {
    try {
      return roleHolder(submission.roleId as RoleId);
    } catch {
      return null;
    }
  })();
  const item = submitProductFeedback({
    id: `PFB-${at.slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`,
    kind: submission.kind,
    summary: submission.summary,
    detail: submission.detail,
    submittedByUserId: userId,
    submittedAt: at,
    contextRunId: state?.runId ?? null,
    roleId: submission.roleId,
    route: submission.route,
    status: "new",
  });
  recordAuditEvent({
    runId: state?.runId ?? "run-001",
    atMoment: state?.currentMoment ?? "00:00",
    category: "system",
    action: "product-feedback-submitted",
    objectKind: "product-feedback",
    objectId: item.id,
    summary: `Product feedback (${item.kind}) was submitted from the workday.`,
    actorUserId: userId,
    actorKind: "human",
    roleId: submission.roleId as RoleId,
    reversible: true,
    detail: { kind: item.kind, route: item.route },
  });
  return { ok: true, item };
}

/* ==========================================================================
   Triage, in the console
   ========================================================================== */

/** The owners an item can be assigned to: responsibilities, not people. */
export const FEEDBACK_OWNERS: readonly Bilingual[] = PRODUCT_PERSONA_IDS.map((id) => PRODUCT_PERSONAS[id].label);

/** The stages an item can be linked to, per Role App with a process. */
export function stagesForRoleApp(roleAppId: string): Array<{ id: string; label: Bilingual }> {
  const app = getRoleApp(roleAppId);
  const process = app ? getProcessDefinition(app.processId) : undefined;
  return (process?.stages ?? []).map((stage) => ({ id: stage.id, label: { en: stage.name, de: stage.nameDe } }));
}

export const triageSchema = z.object({
  status: z.enum(PRODUCT_FEEDBACK_STATUSES),
  severity: z.enum(SEVERITIES).nullable(),
  ownerLabel: z.string().trim().max(80).nullable(),
  featureKey: z.string().trim().max(80).regex(/^[A-Za-z0-9 ._:/-]*$/).nullable(),
  roleAppId: z.string().nullable(),
  stageId: z.string().nullable(),
  releaseVersion: z.string().trim().max(20).regex(/^[0-9A-Za-z.-]*$/).nullable(),
  resolution: z.string().trim().max(2000),
});

export type TriageInput = z.infer<typeof triageSchema>;

function triageRule(item: ProductFeedbackItem | undefined, input: TriageInput): Bilingual | null {
  if (!item) return { en: "That feedback item does not exist.", de: "Diese Rueckmeldung gibt es nicht." };
  if (input.roleAppId && !ROLE_APP_REGISTRY.some((app) => app.id === input.roleAppId)) {
    return { en: "Choose a Role App from the list.", de: "Waehlen Sie eine Rollen-App aus der Liste." };
  }
  if (input.stageId) {
    if (!input.roleAppId) return { en: "A stage needs its Role App.", de: "Eine Stufe braucht ihre Rollen-App." };
    if (!stagesForRoleApp(input.roleAppId).some((stage) => stage.id === input.stageId)) {
      return { en: "That stage is not a stage of the chosen Role App.", de: "Diese Stufe gehoert nicht zur gewaehlten Rollen-App." };
    }
  }
  if (input.ownerLabel && !FEEDBACK_OWNERS.some((owner) => owner.en === input.ownerLabel)) {
    return { en: "Choose an owner from the list.", de: "Waehlen Sie eine Verantwortung aus der Liste." };
  }
  if (input.status === "in-release" && !input.releaseVersion) {
    return { en: "Name the release that addresses it.", de: "Nennen Sie das Release, das es behebt." };
  }
  return null;
}

export async function triageFeedback(id: string, raw: unknown): Promise<ConsoleActionResult<ProductFeedbackItem>> {
  const parsed = triageSchema.safeParse(raw);
  const item = getProductFeedback(id);
  const target = { kind: "product-feedback", id };
  if (!parsed.success) {
    return {
      ok: false,
      code: "rule",
      reason: { en: "The triage is incomplete or malformed.", de: "Die Sichtung ist unvollstaendig oder fehlerhaft." },
      auditEventId: null,
    };
  }
  const input = parsed.data;

  /* Assigning or changing the owner is its own authority. */
  if (item && (input.ownerLabel ?? null) !== (item.ownerLabel ?? null)) {
    const assign = await authorizeConsoleAction("feedback.assign-owner", target);
    if (!assign.ok) return assign;
  }

  return governConsoleAction({
    actionId: "feedback.triage",
    target,
    payload: { id, ...input },
    summary: { en: `Triaged feedback ${id} as ${input.status}.`, de: `Rueckmeldung ${id} als ${input.status} gesichtet.` },
    rule: () => triageRule(item, input),
    execute: ({ actor, at }) => {
      const closing = input.status === "closed" || input.status === "declined";
      const updated = triageProductFeedback(id, {
        status: input.status,
        severity: input.severity,
        ownerLabel: input.ownerLabel,
        featureKey: input.featureKey && input.featureKey.length > 0 ? input.featureKey : null,
        roleAppId: input.roleAppId,
        stageId: input.stageId,
        releaseVersion: input.releaseVersion && input.releaseVersion.length > 0 ? input.releaseVersion : null,
        resolution: input.resolution,
        triagedAt: at,
        triagedByLabel: actor.label,
        closedAt: closing ? at : null,
      });
      if (!updated) throw new Error(`Feedback ${id} disappeared.`);
      return updated;
    },
    success: (updated) => ({
      en: `${updated.id} is ${(FEEDBACK_STATUS_LABELS[updated.status] ?? { en: updated.status }).en.toLowerCase()}.`,
      de: `${updated.id}: ${(FEEDBACK_STATUS_LABELS[updated.status] ?? { de: updated.status }).de}.`,
    }),
  });
}

/** Brings one piece of AI feedback into the inbox as a product feedback item, and links the two. */
export async function forwardAIFeedback(aiFeedbackId: string): Promise<ConsoleActionResult<ProductFeedbackItem>> {
  const feedback = listAIFeedback({ forwarded: false }).find((entry) => entry.id === aiFeedbackId);
  const kind = feedback ? AI_TO_PRODUCT_KIND[feedback.kind] : null;
  return governConsoleAction({
    actionId: "feedback.triage",
    target: { kind: "ai-feedback", id: aiFeedbackId },
    payload: { aiFeedbackId },
    summary: { en: `Forwarded AI feedback ${aiFeedbackId} to the inbox.`, de: `KI-Rueckmeldung ${aiFeedbackId} in den Eingang uebernommen.` },
    rule: () => {
      if (!feedback) return { en: "That AI feedback is not waiting to be forwarded.", de: "Diese KI-Rueckmeldung wartet nicht auf Uebernahme." };
      if (!kind) return { en: "Useful is a signal, not an issue, and stays in the quality figures.", de: "Hilfreich ist ein Signal, kein Problem, und bleibt in den Qualitaetszahlen." };
      return null;
    },
    execute: ({ at }) => {
      if (!feedback || !kind) throw new Error("Nothing to forward.");
      const item = submitProductFeedback({
        id: `PFB-${at.slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`,
        kind,
        summary: feedback.comment.length > 0 ? feedback.comment.slice(0, 280) : `${feedback.kind} on ${feedback.taskKind} (${feedback.targetKind} ${feedback.targetId})`,
        detail: [feedback.configurationId, feedback.promptVersion, feedback.modelProfileId].filter(Boolean).join(" / "),
        submittedByUserId: feedback.userId,
        submittedAt: feedback.createdAt,
        contextRunId: feedback.runId,
        roleId: feedback.roleId,
        subjectKind: feedback.targetKind,
        subjectId: feedback.targetId,
        processRunId: feedback.processRunId,
        aiFeedbackId: feedback.id,
        stageId: feedback.stageId,
        status: "new",
      });
      linkAIFeedbackToProductFeedback(feedback.id, item.id);
      return item;
    },
    success: (item) => ({ en: `Forwarded as ${item.id}.`, de: `Als ${item.id} uebernommen.` }),
  });
}

export type { ProductFeedbackKind, ProductFeedbackStatus, Severity };

/**
 * What the person is looking at, read from the workday's own addresses.
 *
 * Pure and client safe. Every workday surface already names its selection in
 * the address, so the Partner reads it there rather than asking each page to
 * report it:
 *
 *   Home        `?select=<type>:<id>`, the focus queue's links;
 *   Work        the Work Hub's bound item (`context-store`), and `?item=`;
 *   Processes   `/processes/<process>?stage=<stage>`;
 *   Decisions   `#<decision id>`, which the queue keeps current.
 *
 * The server checks every identifier against the database before anything is
 * kept (`./context`); this module only reads the address.
 */

import { z } from "zod";
import type { PartnerFocusInput } from "./context";

const id = z.string().min(1).max(160).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

export const partnerFocusSchema = z.object({
  surface: z.enum(["home", "work", "processes", "decisions", "other"]),
  selection: z.object({ objectType: z.string().min(1).max(60), objectId: id }).nullable(),
  workItem: z.object({ kind: z.enum(["event", "meeting", "action", "message"]), id }).nullable(),
  process: z.object({ slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/), stageId: z.string().min(1).max(80).nullable() }).nullable(),
  decisionId: id.nullable(),
  chatThreadId: id.nullable(),
});

export const EMPTY_FOCUS: PartnerFocusInput = {
  surface: "other",
  selection: null,
  workItem: null,
  process: null,
  decisionId: null,
  chatThreadId: null,
};

export interface LocationParts {
  pathname: string;
  search: string;
  hash: string;
}

export interface BoundItem {
  kind: "event" | "meeting" | "action" | "message";
  itemId: string;
  selection: { objectType: string; objectId: string } | null;
}

/** Reads the focus from a workday address and the Work Hub's bound item. */
export function focusFromLocation(roleId: string, location: LocationParts, bound: BoundItem | null, chatThreadId: string | null): PartnerFocusInput {
  const base = `/workday/${roleId}`;
  const path = location.pathname.replace(/\/+$/, "");
  const params = new URLSearchParams(location.search);
  const decodedHash = (() => {
    try {
      return decodeURIComponent(location.hash.replace(/^#/, ""));
    } catch {
      return "";
    }
  })();
  const valid = (value: string | null | undefined) => (value && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value) ? value : null);
  const workItem = bound ? { kind: bound.kind, id: bound.itemId } : null;

  if (path === base) {
    const raw = params.get("select") ?? "";
    const separator = raw.indexOf(":");
    const objectType = separator > 0 ? raw.slice(0, separator) : "";
    const objectId = valid(separator > 0 ? raw.slice(separator + 1) : null);
    return {
      surface: "home",
      selection: objectType && objectId ? { objectType, objectId } : null,
      workItem: null,
      process: null,
      decisionId: objectType === "decision" ? objectId : null,
      chatThreadId,
    };
  }
  if (path.startsWith(`${base}/work`)) {
    return {
      surface: "work",
      selection: bound?.selection ?? null,
      workItem,
      process: null,
      decisionId: null,
      chatThreadId,
    };
  }
  if (path.startsWith(`${base}/processes`)) {
    const slug = path.slice(`${base}/processes`.length).replace(/^\//, "").split("/")[0] ?? "";
    return {
      surface: "processes",
      selection: null,
      workItem: null,
      process: /^[a-z0-9-]+$/.test(slug) ? { slug, stageId: valid(params.get("stage")) } : null,
      decisionId: null,
      chatThreadId,
    };
  }
  if (path.startsWith(`${base}/decisions`)) {
    const decisionId = valid(decodedHash);
    return {
      surface: "decisions",
      selection: decisionId ? { objectType: "decision", objectId: decisionId } : null,
      workItem: null,
      process: null,
      decisionId,
      chatThreadId,
    };
  }
  return { ...EMPTY_FOCUS, chatThreadId };
}

/** A stable string for a focus, so a client sends it only when it changed. */
export function focusKey(focus: PartnerFocusInput): string {
  return JSON.stringify([
    focus.surface,
    focus.selection?.objectType ?? "",
    focus.selection?.objectId ?? "",
    focus.workItem?.kind ?? "",
    focus.workItem?.id ?? "",
    focus.process?.slug ?? "",
    focus.process?.stageId ?? "",
    focus.decisionId ?? "",
    focus.chatThreadId ?? "",
  ]);
}

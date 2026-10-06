/**
 * SelectionState: what is selected, and what the AI Partner is told about it.
 *
 * The selection itself is one identifier in the URL (`?item=`), which is why
 * it survives a tab change: the tab links carry it. This module answers the
 * two questions that follow from that.
 *
 * Which module owns the identifier. The hub asks each module in turn whether
 * the identifier is one of its items; the first that recognises it builds the
 * detail. An identifier no module recognises (a stale link, an item another
 * role owns) resolves to no selection, and the detail pane says to pick one,
 * rather than rendering a detail for something that is not there.
 *
 * What the partner reads. The AI Partner's context is the shared
 * `WorkdaySelection`, whose object types are the product's work objects. An
 * action maps onto it directly. A meeting, an agenda entry or a message is
 * not one of those types, so the partner is pointed at the object the item
 * is ABOUT, with the item's own title as the label, and the detail pane says
 * which object that is. When an item is about nothing the partner can read,
 * the partner keeps the role context and the pane says that too. Inventing a
 * selection type the chat route would refuse would leave the partner silently
 * answering about the role while the screen claimed otherwise.
 */

import type { Language } from "@/i18n/labels";
import type { WorkdaySelection } from "@/workday/contracts";
import type { Pair } from "./copy";
import { fill, say } from "./copy";
import type { AiContextView } from "./model";

/** Linked object kinds the partner can read, mapped onto its selection types. */
const PARTNER_TYPES: Readonly<Record<string, WorkdaySelection["objectType"]>> = {
  action: "action",
  assessment: "assessment",
  control: "control",
  decision: "decision",
  incident: "incident",
  obligation: "obligation",
  process: "process",
  rcsa: "assessment",
  risk: "risk",
  service: "service",
  supplier: "supplier",
  "test-case": "test-case",
  theme: "theme",
};

export function partnerTypeFor(objectKind: string | null | undefined): WorkdaySelection["objectType"] | null {
  if (!objectKind) return null;
  return PARTNER_TYPES[objectKind] ?? null;
}

const AI_COPY = {
  direct: {
    en: "The AI Partner reads this {kind} and the records linked to it.",
    de: "Der KI Partner liest diesen Eintrag ({kind}) und die verknuepften Datensaetze.",
  },
  subject: {
    en: "The AI Partner reads {object}, the object this {kind} is about.",
    de: "Der KI Partner liest {object}, das Objekt, auf das sich dieser Eintrag ({kind}) bezieht.",
  },
  role: {
    en: "This {kind} is not linked to an object the AI Partner can read, so it keeps the role context.",
    de: "Dieser Eintrag ({kind}) ist mit keinem Objekt verknuepft, das der KI Partner lesen kann, daher bleibt der Rollenkontext.",
  },
} satisfies Record<string, Pair>;

/** The partner context for an item that IS a work object, such as an action. */
export function directAiContext(
  objectType: WorkdaySelection["objectType"],
  objectId: string,
  label: string,
  kindLabel: string,
  language: Language,
): AiContextView {
  return {
    selection: { objectType, objectId, label },
    note: fill(say(AI_COPY.direct, language), { kind: kindLabel.toLowerCase() }),
  };
}

/** The partner context for an item that is ABOUT a work object, such as a meeting. */
export function subjectAiContext(
  subjectKind: string | null | undefined,
  subjectId: string | null | undefined,
  itemTitle: string,
  kindLabel: string,
  language: Language,
): AiContextView {
  const objectType = partnerTypeFor(subjectKind);
  if (objectType === null || !subjectId) {
    return {
      selection: null,
      note: fill(say(AI_COPY.role, language), { kind: kindLabel.toLowerCase() }),
    };
  }
  return {
    selection: { objectType, objectId: subjectId, label: itemTitle },
    note: fill(say(AI_COPY.subject, language), { object: subjectId, kind: kindLabel.toLowerCase() }),
  };
}

/**
 * Resolves the selected identifier against the modules, in tab order.
 *
 * Generic over the resolver so the hub and the tests share the rule: the
 * first module to claim the identifier owns it.
 */
export function resolveSelected<T>(
  itemId: string | null,
  resolvers: ReadonlyArray<(id: string) => T | null>,
): T | null {
  if (itemId === null) return null;
  for (const resolve of resolvers) {
    const found = resolve(itemId);
    if (found !== null) return found;
  }
  return null;
}

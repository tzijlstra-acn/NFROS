/**
 * A pilot record's history, read from the audit trail.
 *
 * Server component. Behind a disclosure, newest first, because it is read when
 * somebody asks who changed what, not every time the page opens.
 */

import { Empty } from "@/components/workday-v2/primitives";
import type { Language } from "@/i18n/labels";
import type { HistoryEntry } from "../workspace";
import { formatDateTime } from "./PilotFrame";

export function HistoryList({ entries, language, limit = 12 }: { entries: readonly HistoryEntry[]; language: Language; limit?: number }) {
  if (entries.length === 0) {
    return (
      <Empty
        title={language === "de" ? "Noch keine Aenderung erfasst" : "No change recorded yet"}
        detail={language === "de" ? "Jede Aenderung erscheint hier mit dem Audit-Eintrag, der sie belegt." : "Every change appears here with the audit record that proves it."}
      />
    );
  }
  return (
    <details>
      <summary className="app-meta" style={{ cursor: "pointer" }}>
        {language === "de" ? `${entries.length} Eintraege im Audit-Trail` : `${entries.length} entries in the audit trail`}
      </summary>
      <ul className="app-stack app-stack-1" style={{ listStyle: "none", margin: "var(--app-2) 0 0", padding: 0 }}>
        {entries.slice(0, limit).map((entry) => (
          <li key={entry.id} className="app-meta" style={{ whiteSpace: "normal", overflowWrap: "anywhere" }}>
            <span className="app-oid">{entry.id}</span> {formatDateTime(entry.at)}
            {entry.blocked ? (language === "de" ? " (abgewiesen)" : " (refused)") : ""}: {entry.summary}
          </li>
        ))}
      </ul>
    </details>
  );
}

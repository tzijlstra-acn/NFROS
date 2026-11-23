"use client";

/**
 * Review, approve and commit one proposed action, then show the receipt.
 *
 * The dialog shows the person everything the approval will bind: the system
 * and record it writes to, each field before and after, the evidence it
 * rests on, the authority class, and whose approval it is. The reason is
 * theirs to edit. Nothing is written until they confirm the statement and
 * press the commit button; the server then reads the payload from the stored
 * analysis, not from this dialog, and runs it through the authority gate.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconCircleCheck, IconLock, IconShieldCheck, IconX, IconAlertTriangle, IconLoader2 } from "@tabler/icons-react";
import type { ProposedInsightAction } from "@/features/insights/schema";
import type { WritebackReceipt } from "@/features/insights/writeback";
import { actionCommitInsightAction } from "../../../app/workday/[role]/insights/actions";

type Language = "en" | "de";

export interface ActionPermissionView {
  allowed: boolean;
  missingScopes: string[];
  authorityClass: string;
  approvalRequired: boolean;
  /** Roles that hold the missing scopes, for the permission-denied state. */
  heldBy: string[];
}

const COPY = {
  title: { en: "Review the proposed change", de: "Vorgeschlagene Aenderung pruefen" },
  prepared: { en: "Prepared by Workspace. Nothing is written until you commit.", de: "Vom Workspace vorbereitet. Nichts wird geschrieben, bevor Sie bestaetigen." },
  system: { en: "System of record", de: "Fuehrendes System" },
  field: { en: "Field", de: "Feld" },
  before: { en: "Before", de: "Vorher" },
  after: { en: "After", de: "Nachher" },
  none: { en: "none", de: "keiner" },
  reason: { en: "Your reason", de: "Ihre Begruendung" },
  evidence: { en: "Evidence it rests on", de: "Zugrunde liegende Nachweise" },
  authority: { en: "Authority", de: "Befugnis" },
  approvalNeeded: { en: "Human approval required. Your approval is recorded in your name and bound to exactly this change.", de: "Menschliche Genehmigung erforderlich. Ihre Genehmigung wird in Ihrem Namen erfasst und an genau diese Aenderung gebunden." },
  routine: { en: "Routine and reversible. Recorded in your name; no separate approval is needed.", de: "Routine und umkehrbar. In Ihrem Namen erfasst; keine gesonderte Genehmigung noetig." },
  confirm: { en: "I confirm the judgment and the reason are my own.", de: "Ich bestaetige, dass Beurteilung und Begruendung meine eigenen sind." },
  commit: { en: "Approve and commit", de: "Genehmigen und ausfuehren" },
  committing: { en: "Committing", de: "Wird ausgefuehrt" },
  cancel: { en: "Cancel", de: "Abbrechen" },
  close: { en: "Close", de: "Schliessen" },
  denied: { en: "Your role cannot commit this change", de: "Ihre Rolle kann diese Aenderung nicht ausfuehren" },
  deniedDetail: { en: "It needs the scope {scopes}, held by {roles}. You can still share the proposal with them.", de: "Dafuer ist der Befugnisbereich {scopes} noetig, gehalten von {roles}. Sie koennen den Vorschlag weitergeben." },
  receipt: { en: "Source record updated", de: "Quelldatensatz aktualisiert" },
  refused: { en: "The change was not made", de: "Die Aenderung wurde nicht vorgenommen" },
  transaction: { en: "Transaction", de: "Transaktion" },
  record: { en: "Record", de: "Datensatz" },
  actor: { en: "Recorded by", de: "Erfasst von" },
  when: { en: "Committed", de: "Ausgefuehrt" },
  approval: { en: "Approval", de: "Genehmigung" },
  approvalConsumed: { en: "{id}, granted by you, bound to this payload and consumed by the commit", de: "{id}, von Ihnen erteilt, an diese Nutzlast gebunden und mit der Ausfuehrung verbraucht" },
  noApproval: { en: "Not required for this routine change", de: "Fuer diese Routineaenderung nicht erforderlich" },
  changed: { en: "Fields written", de: "Geschriebene Felder" },
  auditLog: { en: "View in audit log", de: "Im Pruefprotokoll ansehen" },
  openRecord: { en: "Open the record", de: "Datensatz oeffnen" },
} as const;

function pick(pair: { en: string; de: string }, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

function formatInstant(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function WritebackDialog({
  roleId,
  insightId,
  recommendationId,
  proposal,
  permission,
  evidenceNames,
  actorLabel,
  language,
  onClose,
  onCommitted,
}: {
  roleId: string;
  insightId: string;
  recommendationId: string;
  proposal: ProposedInsightAction;
  permission: ActionPermissionView;
  evidenceNames: Record<string, string>;
  actorLabel: string;
  language: Language;
  onClose: () => void;
  onCommitted: (receipt: WritebackReceipt) => void;
}) {
  const router = useRouter();
  const [rationale, setRationale] = useState(proposal.rationale);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<WritebackReceipt | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>("textarea, button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
      if (event.key === "Tab" && dialogRef.current) {
        const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), textarea, input:not([disabled])")];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      returnFocus.current?.focus();
    };
  }, [busy, onClose]);

  async function commit() {
    setBusy(true);
    const result = await actionCommitInsightAction({ roleId, insightId, recommendationId, rationale, confirmed });
    setBusy(false);
    setReceipt(result);
    if (result.ok) {
      onCommitted(result);
      router.refresh();
    }
  }

  const canCommit = permission.allowed && confirmed && rationale.trim().length >= 12 && !busy;
  const recordHref = receipt?.createdRecordId
    ? receipt.createdRecordId.startsWith("MON")
      ? `/workday/${roleId}/insights/records?source=audit&record=${encodeURIComponent(receipt.auditEventId ?? "")}`
      : `/workday/${roleId}/work?view=actions&item=${encodeURIComponent(receipt.createdRecordId)}`
    : null;

  return (
    <div className="ins-drawer-scrim" onClick={() => (!busy ? onClose() : undefined)}>
      <div
        ref={dialogRef}
        className="ins-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wb-title"
        onClick={(event) => event.stopPropagation()}
        data-testid="writeback-dialog"
      >
        <div className="ins-drawer-head">
          <div>
            <h2 id="wb-title" className="ins-section-title">
              {receipt ? pick(receipt.ok ? COPY.receipt : COPY.refused, language) : pick(COPY.title, language)}
            </h2>
            <p className="ins-section-sub">{receipt ? proposal.target.systemLabel : pick(COPY.prepared, language)}</p>
          </div>
          <button type="button" className="wd-icon-btn" aria-label={pick(COPY.close, language)} onClick={onClose} disabled={busy}>
            <IconX size={18} stroke={1.8} aria-hidden="true" />
          </button>
        </div>

        <div className="ins-drawer-body">
          {receipt ? (
            <div className="ins-reveal" data-testid={receipt.ok ? "writeback-receipt" : "writeback-refused"}>
              <p className="ins-question" style={{ color: receipt.ok ? "var(--wd-success)" : "var(--wd-danger)", fontWeight: 600 }}>
                {receipt.ok ? <IconCircleCheck size={18} stroke={2} aria-hidden="true" /> : <IconAlertTriangle size={18} stroke={2} aria-hidden="true" />}
                {pick(receipt.message, language)}
              </p>
              {receipt.ok ? (
                <dl className="ins-plan" style={{ gridTemplateColumns: "1fr", gap: "10px" }}>
                  <div>
                    <dt>{pick(COPY.transaction, language)}</dt>
                    <dd style={{ fontFamily: "var(--wd-font-mono)" }} data-testid="receipt-transaction">{receipt.auditEventId}</dd>
                  </div>
                  <div>
                    <dt>{pick(COPY.record, language)}</dt>
                    <dd>
                      {receipt.target?.systemLabel}: <strong>{receipt.createdRecordId ?? receipt.target?.entityId}</strong>
                    </dd>
                  </div>
                  <div>
                    <dt>{pick(COPY.changed, language)}</dt>
                    <dd>
                      {receipt.changes.map((change) => (
                        <div key={change.field}>
                          {change.field}: {change.before ? `${change.before} to ` : ""}
                          {change.after}
                        </div>
                      ))}
                    </dd>
                  </div>
                  <div>
                    <dt>{pick(COPY.actor, language)}</dt>
                    <dd>{receipt.actorUserId ? `${receipt.actorUserId} ` : ""}{actorLabel}</dd>
                  </div>
                  <div>
                    <dt>{pick(COPY.when, language)}</dt>
                    <dd>
                      {formatInstant(receipt.committedAt)}
                      {receipt.atMoment ? `, ${language === "de" ? "Szenariozeit" : "scenario time"} ${receipt.atMoment}` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt>{pick(COPY.approval, language)}</dt>
                    <dd>{receipt.approvalId ? pick(COPY.approvalConsumed, language).replace("{id}", receipt.approvalId) : pick(COPY.noApproval, language)}</dd>
                  </div>
                  {receipt.evidenceIds.length ? (
                    <div>
                      <dt>{pick(COPY.evidence, language)}</dt>
                      <dd>{receipt.evidenceIds.map((id) => evidenceNames[id] ?? id).join("; ")}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
              <div className="ins-followups">
                {receipt.auditEventId ? (
                  <a className="wd-btn wd-btn-secondary" href={`/workday/${roleId}/insights/records?source=audit&record=${encodeURIComponent(receipt.auditEventId)}`}>
                    <IconShieldCheck size={16} stroke={1.8} aria-hidden="true" />
                    {pick(COPY.auditLog, language)}
                  </a>
                ) : null}
                {receipt.ok && recordHref ? (
                  <a className="wd-btn wd-btn-secondary" href={recordHref}>
                    {pick(COPY.openRecord, language)}
                  </a>
                ) : null}
                <button type="button" className="wd-btn wd-btn-primary" onClick={onClose}>
                  {pick(COPY.close, language)}
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="ins-rec-urgency">{pick(COPY.system, language)}</p>
              <p className="ins-rec-title" style={{ marginTop: 2 }}>{proposal.target.systemLabel}</p>
              <p className="ins-rec-rationale">{proposal.target.label}</p>

              <table className="ins-table" style={{ marginBottom: 16 }}>
                <thead>
                  <tr>
                    <th scope="col">{pick(COPY.field, language)}</th>
                    <th scope="col">{pick(COPY.before, language)}</th>
                    <th scope="col">{pick(COPY.after, language)}</th>
                  </tr>
                </thead>
                <tbody>
                  {proposal.changes.map((change) => (
                    <tr key={change.field}>
                      <td>{change.field}</td>
                      <td style={{ color: "var(--wd-text-muted)" }}>{change.before ?? pick(COPY.none, language)}</td>
                      <td><strong>{change.after}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <label className="ws-field" style={{ display: "grid", gap: 6, marginBottom: 16 }}>
                <span className="ins-rec-urgency">{pick(COPY.reason, language)}</span>
                <textarea
                  className="ws-input"
                  style={{ height: 96, padding: 10, resize: "vertical" }}
                  value={rationale}
                  onChange={(event) => setRationale(event.target.value)}
                  disabled={!permission.allowed || busy}
                />
              </label>

              {proposal.evidenceIds.length ? (
                <div style={{ marginBottom: 16 }}>
                  <p className="ins-rec-urgency">{pick(COPY.evidence, language)}</p>
                  <ul className="ins-rec-rationale" style={{ paddingLeft: 18, margin: "4px 0 0" }}>
                    {proposal.evidenceIds.map((id) => (
                      <li key={id}>{evidenceNames[id] ?? id}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="ins-explain" style={{ marginBottom: 16 }}>
                <strong>{pick(COPY.authority, language)}: </strong>
                {proposal.toolName}, {permission.authorityClass}. {pick(permission.approvalRequired ? COPY.approvalNeeded : COPY.routine, language)}
              </div>

              {permission.allowed ? (
                <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 16, fontSize: 14 }}>
                  <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={busy} data-testid="writeback-confirm" />
                  <span>{pick(COPY.confirm, language)}</span>
                </label>
              ) : (
                <div className="ws-alert" role="alert" style={{ color: "var(--wd-text)", background: "var(--wd-warning-soft)", borderColor: "var(--wd-border)" }}>
                  <IconLock size={16} stroke={1.8} aria-hidden="true" />
                  <span>
                    <strong>{pick(COPY.denied, language)}. </strong>
                    {pick(COPY.deniedDetail, language).replace("{scopes}", permission.missingScopes.join(", ")).replace("{roles}", permission.heldBy.join(", ") || "another role")}
                  </span>
                </div>
              )}

              <div className="ins-followups">
                <button type="button" className="wd-btn wd-btn-primary wd-btn-lg" disabled={!canCommit} onClick={commit} data-testid="writeback-commit">
                  {busy ? <IconLoader2 size={16} stroke={2} className="ws-spin" aria-hidden="true" /> : <IconShieldCheck size={16} stroke={1.8} aria-hidden="true" />}
                  {pick(busy ? COPY.committing : COPY.commit, language)}
                </button>
                <button type="button" className="wd-btn wd-btn-secondary wd-btn-lg" onClick={onClose} disabled={busy}>
                  {pick(COPY.cancel, language)}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

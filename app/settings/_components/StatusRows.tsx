/**
 * A status reading as a row.
 *
 * The label, the badge, and the sentence that justifies the badge, always
 * together. A badge without its reason is the failure the status vocabulary
 * exists to prevent: "Not verified because nothing was attempted" and "Not
 * verified because the provider refused" ask for different things from the
 * person reading.
 *
 * Server safe: no hooks.
 */

import type { ReactNode } from "react";
import { StatusBadge } from "@/product/status";
import type { StatusReading } from "@/product/status";
import { Item, List } from "@/components/workday-v2/primitives";
import type { Language } from "@/i18n/labels";

export function StatusRow({
  label,
  status,
  language,
  trailing,
}: {
  label: string;
  status: StatusReading;
  language: Language;
  trailing?: ReactNode;
}) {
  const detail = language === "de" ? status.detail.de : status.detail.en;
  return (
    <Item
      title={
        <span className="app-row app-row-wrap">
          <span className="app-strong">{label}</span>
          <StatusBadge status={status.status} language={language} detail={detail} />
        </span>
      }
      {...(trailing !== undefined ? { trailing } : {})}
    >
      {/*
       * The reason as wrapping text rather than the row subtitle, which is a
       * single line with an ellipsis. A status whose reason is cut off at
       * 1366, or in the longer German, is a status without its reason.
       */}
      <WrappingDetail>{detail}</WrappingDetail>
    </Item>
  );
}

/** Secondary text that wraps, for the body of a row. */
export function WrappingDetail({ children }: { children: ReactNode }) {
  return (
    <span
      className="app-meta"
      style={{ display: "block", whiteSpace: "normal", maxWidth: "110ch" }}
    >
      {children}
    </span>
  );
}

export function StatusList({ label, children }: { label: string; children: ReactNode }) {
  return <List label={label}>{children}</List>;
}

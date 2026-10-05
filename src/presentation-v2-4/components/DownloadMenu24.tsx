"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import {
  IconDownload,
  IconFileTypePdf,
  IconFileTypePpt,
  IconNotes,
  IconX,
  type IconProps,
} from "@tabler/icons-react";
import { useDeckNav } from "./DeckNav";
import { useDialogFocus } from "./useDialogFocus";

type DownloadOption = {
  id: string;
  label: string;
  description: string;
  filename: string;
  icon: ComponentType<IconProps>;
};

export const DOWNLOADS_V24: DownloadOption[] = [
  {
    id: "core-pdf",
    label: "Core PDF",
    description: "The thirteen core slides and the closing slide",
    filename: "NFROS_Risk_Audience_V24_Core.pdf",
    icon: IconFileTypePdf,
  },
  {
    id: "full-pdf",
    label: "Full PDF",
    description: "Core story, appendix index and every appendix slide",
    filename: "NFROS_Risk_Audience_V24_Core_and_Appendix.pdf",
    icon: IconFileTypePdf,
  },
  {
    id: "pptx",
    label: "PowerPoint",
    description: "Core story and appendix with speaker notes",
    filename: "NFROS_Risk_Audience_V24_Core_and_Appendix.pptx",
    icon: IconFileTypePpt,
  },
  {
    id: "speaker-notes",
    label: "Speaker notes",
    description: "The presenter script for every slide",
    filename: "NFROS_Risk_Audience_V24_Speaker_Notes.md",
    icon: IconNotes,
  },
];

type Availability = "checking" | "ready" | "missing";

function hrefOf(option: DownloadOption): string {
  return `/downloads/${option.filename}`;
}

type DownloadMenu24Props = {
  onClose: () => void;
  returnTo?: HTMLElement | null;
};

export function DownloadMenu24({ onClose, returnTo }: DownloadMenu24Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Record<string, Availability>>(() =>
    Object.fromEntries(DOWNLOADS_V24.map((o) => [o.id, "checking" as Availability])),
  );
  useDialogFocus(ref, { modal: true, returnTo });

  // Files come from a separate exporter; check each one so a missing file never becomes a broken link
  useEffect(() => {
    const controller = new AbortController();
    for (const option of DOWNLOADS_V24) {
      fetch(hrefOf(option), { method: "HEAD", cache: "no-store", signal: controller.signal })
        .then((res) => setStatus((s) => ({ ...s, [option.id]: res.ok ? "ready" : "missing" })))
        .catch(() => {
          if (!controller.signal.aborted) setStatus((s) => ({ ...s, [option.id]: "missing" }));
        });
    }
    return () => controller.abort();
  }, []);

  return (
    <>
      <div className="pv24-backdrop pv24-backdrop--clear" aria-hidden="true" onClick={onClose} />
      <div
        ref={ref}
        className="pv24-dialog pv24-download-menu"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pv24-download-title"
        tabIndex={-1}
        data-download-menu=""
      >
        <div className="pv24-dialog__head">
          <h2 id="pv24-download-title" className="pv24-dialog__title">
            Download the deck
          </h2>
          <button type="button" className="pv24-icon-btn" onClick={onClose} aria-label="Close downloads" data-autofocus="">
            <IconX size={20} stroke={1.8} aria-hidden="true" />
          </button>
        </div>
        <ul className="pv24-download-list">
          {DOWNLOADS_V24.map((option) => {
            const Icon = option.icon;
            const state = status[option.id] ?? "checking";
            const body = (
              <>
                <Icon size={28} stroke={1.6} aria-hidden="true" className="pv24-download-option__icon" />
                <span className="pv24-download-option__text">
                  <span className="pv24-download-option__label">{option.label}</span>
                  <span className="pv24-download-option__desc">{option.description}</span>
                </span>
                {state === "ready" ? (
                  <IconDownload size={20} stroke={1.8} aria-hidden="true" className="pv24-download-option__action" />
                ) : (
                  <span className="pv24-download-option__state">{state === "missing" ? "Not yet exported" : "Checking"}</span>
                )}
              </>
            );
            return (
              <li key={option.id}>
                {state === "ready" ? (
                  <a
                    className="pv24-download-option"
                    href={hrefOf(option)}
                    download={option.filename}
                    data-download-option={option.id}
                    data-availability={state}
                  >
                    {body}
                  </a>
                ) : (
                  <div
                    className="pv24-download-option pv24-download-option--disabled"
                    aria-disabled="true"
                    data-download-option={option.id}
                    data-availability={state}
                  >
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

/** Download control inside the slide frame (agenda, final core slide, appendix index). */
export function SlideDownloadButton() {
  const { exportMode, openDownloads } = useDeckNav();
  if (exportMode) return null;
  return (
    <button
      type="button"
      className="pv24-slide-download"
      onClick={(e) => openDownloads(e.currentTarget)}
      aria-haspopup="dialog"
    >
      <IconDownload size={18} stroke={1.8} aria-hidden="true" />
      Download deck
    </button>
  );
}

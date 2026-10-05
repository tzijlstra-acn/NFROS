"use client";

import { useRef } from "react";
import { IconArrowRight, IconNotes, IconPlayerPause, IconX } from "@tabler/icons-react";
import { useDialogFocus } from "./useDialogFocus";

// ---------------------------------------------------------------------------
// Keyboard help
// ---------------------------------------------------------------------------

export const KEY_HELP: Array<{ keys: string[]; action: string }> = [
  { keys: ["Right arrow", "Page Down", "Space"], action: "Next slide in the core story or the appendix" },
  { keys: ["Left arrow", "Page Up"], action: "Previous slide" },
  { keys: ["Home"], action: "First core slide" },
  { keys: ["End"], action: "Last core slide" },
  { keys: ["A"], action: "Agenda in the core story; appendix index in the appendix" },
  { keys: ["C"], action: "Return to the core slide the appendix was opened from" },
  { keys: ["R"], action: "Replay the animation on the current slide" },
  { keys: ["M"], action: "Pause or resume all motion" },
  { keys: ["D"], action: "Download menu" },
  { keys: ["F"], action: "Full screen on or off" },
  { keys: ["P"], action: "Presenter notes" },
  { keys: ["?"], action: "This list of keys" },
  { keys: ["Esc"], action: "Close any open panel or menu" },
];

export function HelpOverlay24({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, { modal: true });
  return (
    <>
      <div className="pv24-backdrop" aria-hidden="true" onClick={onClose} />
      <div ref={ref} className="pv24-dialog pv24-help" role="dialog" aria-modal="true" aria-labelledby="pv24-help-title" tabIndex={-1}>
        <div className="pv24-dialog__head">
          <h2 id="pv24-help-title" className="pv24-dialog__title">
            Keyboard shortcuts
          </h2>
          <button type="button" className="pv24-icon-btn" onClick={onClose} aria-label="Close keyboard shortcuts" data-autofocus="">
            <IconX size={20} stroke={1.8} aria-hidden="true" />
          </button>
        </div>
        <table className="pv24-help__table">
          <tbody>
            {KEY_HELP.map((row) => (
              <tr key={row.action}>
                <th scope="row">
                  {row.keys.map((k) => (
                    <kbd key={k} className="pv24-kbd pv24-kbd--lg">
                      {k}
                    </kbd>
                  ))}
                </th>
                <td>{row.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Presenter notes (non-modal: navigation keys keep working while it is open)
// ---------------------------------------------------------------------------

type NotesPanel24Props = {
  title: string;
  notes: string;
  nextTitle: string | null;
  onClose: () => void;
};

export function NotesPanel24({ title, notes, nextTitle, onClose }: NotesPanel24Props) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, { modal: false });
  return (
    <div ref={ref} className="pv24-notes" role="dialog" aria-modal="false" aria-labelledby="pv24-notes-title" tabIndex={-1} data-notes-panel="">
      <div className="pv24-notes__head">
        <IconNotes size={20} stroke={1.8} aria-hidden="true" />
        <h2 id="pv24-notes-title" className="pv24-notes__title">
          Presenter notes
        </h2>
        <span className="pv24-notes__slide">{title}</span>
        <button type="button" className="pv24-icon-btn" onClick={onClose} aria-label="Close presenter notes">
          <IconX size={20} stroke={1.8} aria-hidden="true" />
        </button>
      </div>
      <p className="pv24-notes__text">{notes}</p>
      <p className="pv24-notes__next">
        <IconArrowRight size={18} stroke={1.9} aria-hidden="true" />
        {nextTitle ? (
          <>
            <span className="pv24-notes__next-label">Next</span>
            {nextTitle}
          </>
        ) : (
          <span className="pv24-notes__next-label">Last slide in this sequence</span>
        )}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Motion paused pill
// ---------------------------------------------------------------------------

export function PausePill24() {
  return (
    <div className="pv24-pause-pill" role="status" data-motion-paused="">
      <IconPlayerPause size={18} stroke={2} aria-hidden="true" />
      Motion paused
      <span className="pv24-pause-pill__hint">
        Press <kbd className="pv24-kbd">M</kbd> to resume
      </span>
    </div>
  );
}

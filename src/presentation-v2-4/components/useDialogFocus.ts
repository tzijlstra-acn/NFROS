"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Moves focus into a dialog when it mounts and restores it when it unmounts.
 * Modal dialogs also keep Tab inside the dialog.
 */
export function useDialogFocus(ref: RefObject<HTMLElement | null>, options: { modal: boolean; returnTo?: HTMLElement | null }) {
  const { modal, returnTo } = options;
  useEffect(() => {
    const node = ref.current;
    const previous = returnTo ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    if (!node) return;

    const initial = node.querySelector<HTMLElement>("[data-autofocus]") ?? node;
    initial.focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (!modal || e.key !== "Tab") return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) {
        e.preventDefault();
        return;
      }
      if (e.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    node.addEventListener("keydown", onKeyDown);
    return () => {
      node.removeEventListener("keydown", onKeyDown);
      if (previous && previous.isConnected && previous !== document.body) previous.focus({ preventScroll: true });
    };
    // Runs once per dialog mount; the dialog is unmounted when it closes
  }, []);
}

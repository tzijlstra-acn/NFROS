"use client";

/**
 * Clears the selection, on request.
 *
 * The only way a bound selection ends: the drawer and the AI Partner stop
 * reading it, and the hub returns to the same view with nothing selected.
 * Navigating away does not do this, by design; see `context-store.ts`.
 */

import { useRouter } from "next/navigation";
import { IconX } from "@tabler/icons-react";
import { clearBoundContext } from "./context-store";

export function ClearSelection({ href, label, compact = false }: { href: string; label: string; compact?: boolean }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={compact ? "wd-icon-btn wd-work-detail-close" : "wd-btn wd-btn-quiet wd-btn-sm"}
      aria-label={label}
      title={label}
      onClick={() => {
        clearBoundContext();
        router.push(href, { scroll: false });
      }}
    >
      {compact ? <IconX size={18} stroke={2} aria-hidden="true" /> : label}
    </button>
  );
}

"use client";

/**
 * ContextBinding: hands the selected item to the shell.
 *
 * Renders nothing. The Work Hub page renders it with the bound context its
 * server built for the selected item, and it publishes that to the store the
 * context drawer and the AI Partner host read. With nothing selected it
 * publishes nothing, so a context bound earlier stays bound.
 */

import { useEffect } from "react";
import type { BoundWorkContext } from "@/features/work/model";
import { publishBoundContext } from "./context-store";

export function ContextBinding({ bound }: { bound: BoundWorkContext | null }) {
  useEffect(() => {
    publishBoundContext(bound);
  }, [bound]);
  return null;
}

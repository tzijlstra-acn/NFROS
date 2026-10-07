"use client";

/**
 * Records one experience event for this visit (plan 7.4), and renders
 * nothing. No user, no keystroke, no dwell time: one row saying that the
 * interaction happened, keyed by a random per-visit key so a re-render does
 * not count twice.
 */

import { useEffect } from "react";
import { actionRecordExperienceEvent } from "./record";

export function ExperienceBeacon({ kind, roleId, subjectKind, subjectId }: { kind: string; roleId: string; subjectKind?: string; subjectId?: string }) {
  useEffect(() => {
    const visitKey = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    void actionRecordExperienceEvent({ kind, roleId, visitKey, ...(subjectKind ? { subjectKind } : {}), ...(subjectId ? { subjectId } : {}) });
  }, [kind, roleId, subjectKind, subjectId]);
  return null;
}

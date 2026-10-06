"use client";

/**
 * Keeps an open stage current without a permanent spinner.
 *
 * Two jobs, both bounded:
 *
 *   resume   when the server says the stage needs it (a queued or interrupted
 *            preparation, a decision recorded elsewhere), call the resume
 *            action once and refresh. This is how a stage picks up after a
 *            server restart: the job row is still queued, the page asks for
 *            it to run.
 *
 *   follow   while a preparation is running in another process, refresh every
 *            two seconds, at most fifteen times, then stop and say so. The
 *            state shown is always the persisted state; nothing here invents
 *            progress.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { actionResumeStage } from "./actions";

export interface StageSyncProps {
  processRunId: string;
  stageId: string;
  roleId: string;
  needsSync: boolean;
  polling: boolean;
  stillRunningLabel: string;
}

const POLL_MS = 2_000;
const MAX_POLLS = 15;

export function StageSync({ processRunId, stageId, roleId, needsSync, polling, stillRunningLabel }: StageSyncProps) {
  const router = useRouter();
  const resumed = useRef<string | null>(null);
  const [polls, setPolls] = useState(0);

  useEffect(() => {
    const key = `${processRunId}:${stageId}`;
    if (!needsSync || resumed.current === key) return;
    resumed.current = key;
    void actionResumeStage({ processRunId, stageId, roleId }).then(() => router.refresh());
  }, [needsSync, processRunId, stageId, roleId, router]);

  useEffect(() => {
    if (!polling || polls >= MAX_POLLS) return;
    const timer = window.setTimeout(() => {
      router.refresh();
      setPolls((count) => count + 1);
    }, POLL_MS);
    return () => window.clearTimeout(timer);
  }, [polling, polls, router]);

  const gaveUp = polling && polls >= MAX_POLLS;
  if (!gaveUp) return null;
  return (
    <p role="status" style={{ margin: 0, fontSize: "var(--wd-text-xs)", color: "var(--wd-text-muted)" }}>
      {stillRunningLabel}
    </p>
  );
}

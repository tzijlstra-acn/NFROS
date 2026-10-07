"use client";

/**
 * Follows a running release gate: refreshes the page every few seconds until
 * the stored run completes, for at most fifteen minutes, then stops and says
 * so. Bounded like the process page's `StageSync`, so nothing spins forever.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const INTERVAL_MS = 8000;
const MAX_REFRESHES = 112;

export function GateRunFollow({ language }: { language: "en" | "de" }) {
  const router = useRouter();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (count >= MAX_REFRESHES) return;
    const timer = window.setTimeout(() => {
      router.refresh();
      setCount((value) => value + 1);
    }, INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [count, router]);

  return (
    <span className="app-meta" role="status" data-testid="release-gate-following">
      {count >= MAX_REFRESHES
        ? language === "de"
          ? "Laeuft noch. Laden Sie die Seite neu, um erneut zu pruefen."
          : "Still running. Refresh to check again."
        : language === "de"
          ? "Die Pruefungen laufen. Diese Seite aktualisiert sich, bis der Lauf abgeschlossen ist."
          : "The checks are running. This page refreshes until the run completes."}
    </span>
  );
}

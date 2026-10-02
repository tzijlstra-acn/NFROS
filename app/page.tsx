/**
 * Entry experience.
 *
 * Deliberately calm and short. The audience for this screen is an executive
 * about to watch a demonstration, and the two things they need are the choice
 * between the presentation and the interactive day, and an honest statement
 * that everything they are about to see is synthetic.
 */

import Link from "next/link";
import { getPublicHealth } from "@/server/config/runtime";
import { isDatabaseReady } from "@/db/client";
import { getScenarioState } from "@/scenario/engine/state";
import { PRODUCT_COPY, t, type Language } from "@/i18n/labels";
import { SyntheticLabel } from "@/components/evidence/primitives";
import { ModeSelector } from "@/components/shell/ModeSelector";
import { ResetButton } from "@/components/shell/controls";

export const dynamic = "force-dynamic";

export default function EntryPage() {
  const health = getPublicHealth();
  const seeded = isDatabaseReady();
  const state = seeded ? getScenarioState() : null;
  const language = (state?.language ?? "en") as Language;

  return (
    /*
     * The entry screen is the first thing an audience sees, frequently on a
     * projector, so it must fit the viewport rather than scroll. `100dvh` with
     * `overflow: hidden` on the shell and a scrollable right column is what
     * keeps it inside 768 pixels of height without shrinking the proposition,
     * which is the part that has to land.
     */
    <main
      id="main"
      className="entry-shell"
      style={{
        height: "100dvh",
        display: "grid",
        gridTemplateRows: "auto minmax(0, 1fr) auto",
        padding: "var(--space-6) var(--space-10)",
        maxWidth: 1400,
        margin: "0 auto",
        overflow: "hidden",
      }}
    >
      <header className="row row-between row-wrap row-4">
        <div className="row row-3">
          <span
            className="display"
            style={{ fontSize: "var(--text-md)", color: "var(--text-1)", fontWeight: 600 }}
          >
            {t(PRODUCT_COPY, "productName", language)}
          </span>
          <span className="meta">{t(PRODUCT_COPY, "experienceName", language)}</span>
        </div>
        <SyntheticLabel language={language} />
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 0.85fr)",
          gap: "var(--space-10)",
          alignItems: "center",
          padding: "var(--space-6) 0",
          minHeight: 0,
        }}
      >
        {/* ---- Proposition ---- */}
        <div className="stack stack-5">
          <h1
            className="display entry-headline"
            style={{ lineHeight: 1.03, maxWidth: "18ch" }}
          >
            Live the NFR day.
          </h1>

          <p className="lede" style={{ fontSize: "var(--text-lg)", color: "var(--text-2)" }}>
            What changes when AI operates the work around the risk professional.
          </p>

          <div className="stack stack-2">
            {["propositionLine1", "propositionLine2", "propositionLine3"].map((key) => (
              <p key={key} style={{ color: "var(--text-3)", fontSize: "var(--text-md)" }}>
                {t(PRODUCT_COPY, key, language)}
              </p>
            ))}
          </div>

          <div className="row row-3 row-wrap">
            <Link href="/story" className="btn btn-primary btn-lg">
              Open the presentation
            </Link>
            <Link href="/workday" className="btn btn-lg">
              Enter the interactive day
            </Link>
          </div>

          <p
            className="muted"
            style={{ fontSize: "var(--text-sm)", maxWidth: "62ch", paddingTop: "var(--space-2)" }}
          >
            Arcadia Banking Group is a synthetic institution. Every person, supplier, control,
            transaction, incident and regulatory publication in this prototype is invented for the
            purpose of the demonstration. Regulatory references are illustrative context and not
            legal advice.
          </p>
        </div>

        {/* ---- Status panel ---- */}
        {/*
          * This column carries the runtime status and the mode selector.
          * It scrolls internally so the proposition on the left keeps its full
          * size. Role selection has moved to the dedicated /workday page.
          */}
        <div className="stack stack-4 scroll-y" style={{ maxHeight: "100%", paddingRight: "var(--space-2)" }}>
          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Runtime status</span>
            </div>
            <div className="panel-body stack stack-4">
              <StatusRow
                label="AI mode"
                value={health.mode}
                tone={health.mode === "live" ? "green" : health.mode === "safe" ? "cyan" : "neutral"}
              />
              <StatusRow
                label="Live AI configured"
                value={health.liveAiConfigured ? "true" : "false"}
                tone={health.liveAiConfigured ? "green" : "amber"}
              />
              {/*
                * Configured and verified are different claims. A key can be
                * present and well formed and still be revoked or wrong, and a
                * presenter needs to know which of the two they have.
                */}
              <StatusRow
                label="Live AI verified"
                value={
                  health.liveAiVerified === null
                    ? "not yet attempted"
                    : health.liveAiVerified
                      ? "true"
                      : "key rejected"
                }
                tone={
                  health.liveAiVerified === null
                    ? "neutral"
                    : health.liveAiVerified
                      ? "green"
                      : "red"
                }
              />
              <StatusRow label="Configuration source" value={health.configurationSource} tone="neutral" />
              <StatusRow
                label="Voice"
                value={health.voiceAvailable ? "available" : "typed fallback only"}
                tone={health.voiceAvailable ? "green" : "neutral"}
              />
              <StatusRow
                label="Scenario seeded"
                value={seeded ? "true" : "false"}
                tone={seeded ? "green" : "red"}
              />

              {health.modeReason ? (
                <p className="meta" style={{ lineHeight: 1.5 }}>
                  {health.modeReason}
                </p>
              ) : null}

              <p className="meta" style={{ lineHeight: 1.5 }}>
                {health.liveAiConfiguredMeaning}
              </p>

              <p className="meta" style={{ lineHeight: 1.5 }}>
                The key is read at runtime from the local source repository and is never copied into
                this repository, logged, exported, or sent to the browser. Not even a prefix, a
                suffix or a length is disclosed, including when the provider rejects it.
              </p>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Demonstration mode</span>
            </div>
            <div className="panel-body stack stack-3">
              <ModeSelector current={health.mode} liveAvailable={health.liveAiConfigured} />
              <p className="meta" style={{ lineHeight: 1.5 }}>
                Presenter safe mode serves the critical story beats from cached known good outputs
                with deterministic timing. Live mode makes real calls. Offline mode makes none.
              </p>
            </div>
          </div>

          {!seeded ? (
            <div className="panel">
              <div className="panel-head">
                <span className="panel-title">Setup required</span>
              </div>
              <div className="panel-body stack stack-3">
                <p style={{ fontSize: "var(--text-sm)" }}>
                  The scenario has not been seeded yet. Run the two commands below and reload this
                  page.
                </p>
                <pre
                  className="mono"
                  style={{
                    background: "var(--surface-0)",
                    border: "1px solid var(--border-1)",
                    borderRadius: "var(--radius-md)",
                    padding: "var(--space-3)",
                    fontSize: "var(--text-sm)",
                  }}
                >
                  {"npm run db:migrate\nnpm run db:seed"}
                </pre>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <footer className="row row-between row-wrap row-4" style={{ paddingTop: "var(--space-6)" }}>
        <nav className="row row-4 row-wrap">
          <Link href="/story" className="meta">
            Presentation
          </Link>
          <Link href="/workday" className="meta">
            Workday
          </Link>
          <Link href="/control-room" className="meta">
            Control room
          </Link>
          <Link href="/trust" className="meta">
            Trust
          </Link>
          <Link href="/value" className="meta">
            Value
          </Link>
          <Link href="/roadmap" className="meta">
            Roadmap
          </Link>
        </nav>
        {seeded ? <ResetButton language={language} /> : <span className="meta" />}
      </footer>
    </main>
  );
}

function StatusRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "amber" | "red" | "cyan" | "neutral";
}) {
  return (
    <div className="row row-3 row-between">
      <span className="label">{label}</span>
      <span className="chip" data-tone={tone}>
        {value}
      </span>
    </div>
  );
}

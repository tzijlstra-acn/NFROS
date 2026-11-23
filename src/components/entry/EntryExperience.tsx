"use client";

/**
 * The way into NFR Workspace: startup, sign-in, then the workspace being
 * prepared for the role.
 *
 *   startup    about 1.8 seconds. The mark draws, the name appears, a line
 *              fills and three status lines name what is starting. Skipped
 *              under reduced motion and on `/login`.
 *   signin     the demonstration account. Errors are announced, the password
 *              can be shown, Enter submits.
 *   preparing  three steps with the facts the sign-in returned: the acting
 *              role and its scopes, the open decisions, the moment the
 *              records are read at. The workspace route is prefetched while
 *              they show, so the transition into it is immediate.
 *
 * Every word on these screens is either a product label or a fact read from
 * the records; none of it is decoration standing in for work.
 */

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { IconAlertCircle, IconCheck, IconEye, IconEyeOff, IconLoader2 } from "@tabler/icons-react";
import type { Language } from "@/i18n/labels";
import { WorkspaceMark } from "./WorkspaceMark";

type Phase = "startup" | "signin" | "preparing";

interface ContextFacts {
  roleId: string;
  roleLabel: string;
  holderName: string | null;
  entityLabel: string | null;
  scopeCount: number;
  decisionsOpen: number;
  recordsAsOf: string | null;
}

type SignInResponse =
  | { ok: true; next: string; displayName: string; context: ContextFacts }
  | { ok: false; reason: "missing" | "invalid" };

const COPY = {
  product: { en: "NFR Workspace", de: "NFR Workspace" },
  startup: [
    { en: "Starting NFR Workspace", de: "NFR Workspace wird gestartet" },
    { en: "Loading secure workspace services", de: "Sichere Arbeitsbereichsdienste werden geladen" },
    { en: "Ready", de: "Bereit" },
  ],
  signInTitle: { en: "Sign in", de: "Anmelden" },
  signInLede: {
    en: "Your decisions, evidence and governed actions, prepared for your role.",
    de: "Ihre Entscheidungen, Nachweise und gesteuerten Massnahmen, vorbereitet fuer Ihre Rolle.",
  },
  username: { en: "Username", de: "Benutzername" },
  password: { en: "Password", de: "Passwort" },
  show: { en: "Show password", de: "Passwort anzeigen" },
  hide: { en: "Hide password", de: "Passwort verbergen" },
  submit: { en: "Sign in", de: "Anmelden" },
  submitting: { en: "Signing in", de: "Anmeldung laeuft" },
  invalid: {
    en: "The username or password does not match. Check both and try again.",
    de: "Benutzername oder Passwort stimmen nicht. Pruefen Sie beides und versuchen Sie es erneut.",
  },
  missing: { en: "Enter your username and password.", de: "Geben Sie Benutzername und Passwort ein." },
  failed: {
    en: "The workspace could not be reached. Try again in a moment.",
    de: "Der Arbeitsbereich ist nicht erreichbar. Versuchen Sie es gleich erneut.",
  },
  environment: { en: "Synthetic demonstration environment", de: "Synthetische Demonstrationsumgebung" },
  environmentNote: {
    en: "Arcadia Banking Group and all records are invented. Demonstration sign-in, not production authentication.",
    de: "Arcadia Banking Group und alle Datensaetze sind erfunden. Demonstrationsanmeldung, keine produktive Authentifizierung.",
  },
  welcome: { en: "Welcome, {name}", de: "Willkommen, {name}" },
  preparing: { en: "Preparing your workspace", de: "Ihr Arbeitsbereich wird vorbereitet" },
  stepRole: { en: "Loading role and permissions", de: "Rolle und Berechtigungen werden geladen" },
  stepDecisions: { en: "Preparing current decisions", de: "Aktuelle Entscheidungen werden vorbereitet" },
  stepRecords: { en: "Synchronizing synthetic records", de: "Synthetische Datensaetze werden synchronisiert" },
  scopes: { en: "{count} authority scopes", de: "{count} Befugnisbereiche" },
  decisionsOne: { en: "1 decision needs a person", de: "1 Entscheidung erfordert eine Person" },
  decisionsMany: { en: "{count} decisions need a person", de: "{count} Entscheidungen erfordern eine Person" },
  decisionsNone: { en: "No decision is waiting", de: "Keine Entscheidung wartet" },
  recordsAsOf: { en: "Records as of {moment}", de: "Datensaetze mit Stand {moment}" },
} as const;

function pick(pair: { en: string; de: string }, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* Startup timing, in milliseconds. Total about 1.8 seconds. */
const STARTUP_STATUS_AT = [0, 620, 1280] as const;
const STARTUP_DONE_AT = 1800;
/* Preparing: each step resolves after this long, then the workspace opens. */
const PREPARE_STEP_MS = 520;

export function EntryExperience({
  initialPhase,
  next,
  language,
  clientName,
}: {
  initialPhase: "startup" | "signin";
  next: string | null;
  language: Language;
  clientName: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [statusIndex, setStatusIndex] = useState(0);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [welcome, setWelcome] = useState<{ name: string; context: ContextFacts; next: string } | null>(null);
  const [stepsDone, setStepsDone] = useState(0);
  const usernameRef = useRef<HTMLInputElement | null>(null);

  /* Startup: three status lines, then the sign-in. Reduced motion skips it. */
  useEffect(() => {
    if (phase !== "startup") return;
    if (prefersReducedMotion()) {
      setPhase("signin");
      return;
    }
    const timers = STARTUP_STATUS_AT.map((at, index) => window.setTimeout(() => setStatusIndex(index), at));
    timers.push(window.setTimeout(() => setPhase("signin"), STARTUP_DONE_AT));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [phase]);

  /* The username field takes focus when the form appears. */
  useEffect(() => {
    if (phase === "signin") usernameRef.current?.focus();
  }, [phase]);

  /* Preparing: resolve the three steps in order, then open the workspace. */
  useEffect(() => {
    if (phase !== "preparing" || !welcome) return;
    router.prefetch(welcome.next);
    const step = prefersReducedMotion() ? 120 : PREPARE_STEP_MS;
    const timers = [1, 2, 3].map((count) => window.setTimeout(() => setStepsDone(count), step * count));
    timers.push(window.setTimeout(() => router.replace(welcome.next), step * 3 + 260));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [phase, welcome, router]);

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (submitting) return;
      if (username.trim().length === 0 || password.length === 0) {
        setError(pick(COPY.missing, language));
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        const response = await fetch("/api/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ username, password, next }),
        });
        const result = (await response.json()) as SignInResponse;
        if (!result.ok) {
          setError(pick(result.reason === "missing" ? COPY.missing : COPY.invalid, language));
          setPassword("");
          setSubmitting(false);
          return;
        }
        setWelcome({ name: result.displayName, context: result.context, next: result.next });
        setPhase("preparing");
      } catch {
        setError(pick(COPY.failed, language));
        setSubmitting(false);
      }
    },
    [submitting, username, password, next, language],
  );

  const facts = welcome?.context ?? null;
  const steps = facts
    ? [
        {
          label: pick(COPY.stepRole, language),
          detail: [
            facts.holderName ? `${facts.roleLabel}, ${facts.holderName}` : facts.roleLabel,
            pick(COPY.scopes, language).replace("{count}", String(facts.scopeCount)),
          ].join(" · "),
        },
        {
          label: pick(COPY.stepDecisions, language),
          detail:
            facts.decisionsOpen === 0
              ? pick(COPY.decisionsNone, language)
              : facts.decisionsOpen === 1
                ? pick(COPY.decisionsOne, language)
                : pick(COPY.decisionsMany, language).replace("{count}", String(facts.decisionsOpen)),
        },
        {
          label: pick(COPY.stepRecords, language),
          detail: facts.recordsAsOf ? pick(COPY.recordsAsOf, language).replace("{moment}", facts.recordsAsOf) : "",
        },
      ]
    : [];

  return (
    <div className="ws-entry" data-phase={phase}>
      <main id="main" className="ws-entry-main">
        {phase === "startup" ? (
          <section className="ws-startup" aria-live="polite" aria-label={pick(COPY.product, language)}>
            <WorkspaceMark size={56} animated />
            <p className="ws-startup-name">{pick(COPY.product, language)}</p>
            <div className="ws-startup-progress" aria-hidden="true">
              <span />
            </div>
            <p className="ws-startup-status" data-testid="startup-status">
              {pick(COPY.startup[statusIndex] ?? COPY.startup[0], language)}
            </p>
          </section>
        ) : (
          <section className="ws-card" aria-labelledby="ws-card-title">
            <div className="ws-card-brand">
              <WorkspaceMark size={32} />
              <div>
                <p className="ws-card-product">{pick(COPY.product, language)}</p>
                <p className="ws-card-tenant">{clientName}</p>
              </div>
            </div>

            {phase === "signin" ? (
              <form className="ws-form" onSubmit={onSubmit} noValidate data-testid="sign-in-form">
                <h1 id="ws-card-title" className="ws-card-title">
                  {pick(COPY.signInTitle, language)}
                </h1>
                <p className="ws-card-lede">{pick(COPY.signInLede, language)}</p>

                {error ? (
                  <p className="ws-alert" role="alert" data-testid="sign-in-error">
                    <IconAlertCircle size={16} stroke={1.8} aria-hidden="true" />
                    {error}
                  </p>
                ) : null}

                <label className="ws-field">
                  <span className="ws-field-label">{pick(COPY.username, language)}</span>
                  <input
                    ref={usernameRef}
                    className="ws-input"
                    name="username"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    aria-invalid={error ? true : undefined}
                    disabled={submitting}
                  />
                </label>

                <label className="ws-field">
                  <span className="ws-field-label">{pick(COPY.password, language)}</span>
                  <span className="ws-input-group">
                    <input
                      className="ws-input"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      aria-invalid={error ? true : undefined}
                      disabled={submitting}
                    />
                    <button
                      type="button"
                      className="wd-icon-btn ws-input-toggle"
                      aria-pressed={showPassword}
                      aria-label={pick(showPassword ? COPY.hide : COPY.show, language)}
                      onClick={() => setShowPassword((shown) => !shown)}
                      disabled={submitting}
                    >
                      {showPassword ? (
                        <IconEyeOff size={18} stroke={1.8} aria-hidden="true" />
                      ) : (
                        <IconEye size={18} stroke={1.8} aria-hidden="true" />
                      )}
                    </button>
                  </span>
                </label>

                <button type="submit" className="wd-btn wd-btn-primary wd-btn-lg ws-submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <IconLoader2 size={16} stroke={2} className="ws-spin" aria-hidden="true" />
                      {pick(COPY.submitting, language)}
                    </>
                  ) : (
                    pick(COPY.submit, language)
                  )}
                </button>
              </form>
            ) : (
              <div className="ws-preparing" aria-live="polite" data-testid="preparing">
                <h1 id="ws-card-title" className="ws-card-title">
                  {pick(COPY.welcome, language).replace("{name}", welcome?.name ?? "")}
                </h1>
                <p className="ws-card-lede">{pick(COPY.preparing, language)}</p>
                <ol className="ws-steps">
                  {steps.map((step, index) => {
                    const state = stepsDone > index ? "done" : stepsDone === index ? "active" : "waiting";
                    return (
                      <li key={step.label} className="ws-step" data-state={state}>
                        <span className="ws-step-icon" aria-hidden="true">
                          {state === "done" ? (
                            <IconCheck size={14} stroke={2.4} />
                          ) : state === "active" ? (
                            <IconLoader2 size={14} stroke={2.4} className="ws-spin" />
                          ) : null}
                        </span>
                        <span className="ws-step-text">
                          <span className="ws-step-label">{step.label}</span>
                          {state === "done" && step.detail ? <span className="ws-step-detail">{step.detail}</span> : null}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="ws-entry-footer">
        <span className="ws-env">
          <span className="wd-dot" data-tone="warning" aria-hidden="true" />
          {pick(COPY.environment, language)}
        </span>
        <span className="ws-env-note">{pick(COPY.environmentNote, language)}</span>
      </footer>
    </div>
  );
}

/**
 * The design-partner controls, as readings. Pure.
 *
 * Wave 5 of the plan names the controls a bank pilot needs before it starts:
 * an analyst cannot switch role, an analyst cannot reset, identity binds
 * approvals, integration status is honest, backup and restore work, the
 * support bundle works, and the audit trail is protected. `/settings/pilot`
 * already computes the product checks (`runReadinessChecks`); these are the
 * controls, and each function here turns the facts the server collected into
 * a reading in the product status vocabulary, with the sentence that
 * justifies it.
 *
 * Kept apart from the collection (`readiness.ts`) so the rules can be tested
 * without a database, a file system or an environment. No function here
 * returns "verified" unless the facts it was given show the control holding.
 */

import type { ProductMode } from "@/identity/types";
import { reading, type StatusReading } from "@/product/status/vocabulary";
import type { ApprovalIdentitySource, EnforcementPoint } from "./enforcement";

/* ==========================================================================
   Role switching and reset
   ========================================================================== */

function modeName(mode: ProductMode, rawMode: string): { en: string; de: string } {
  if (rawMode === "") {
    return {
      en: "PRODUCT_MODE is not set, so the product runs in demonstration mode",
      de: "PRODUCT_MODE ist nicht gesetzt, das Produkt laeuft daher im Demonstrationsmodus",
    };
  }
  return { en: `PRODUCT_MODE is ${mode}`, de: `PRODUCT_MODE ist ${mode}` };
}

/**
 * Whether an analyst can switch role.
 *
 * Verified only when the product mode forbids it and the server action
 * enforces the rule. A rule that exists and is not called is not a control.
 */
export function roleSwitchReading(
  mode: ProductMode,
  rawMode: string,
  point: Pick<EnforcementPoint, "checksSession" | "checksProductMode" | "functionName">,
): StatusReading {
  const named = modeName(mode, rawMode);
  const enforced = point.checksSession && point.checksProductMode;
  if (mode === "demonstration") {
    return reading(
      "not-verified",
      `An analyst can switch role. ${named.en}, which allows switching, and the role switch (${point.functionName}) checks neither a session nor the mode.`,
      `Eine Fachkraft kann die Rolle wechseln. ${named.de}, der den Wechsel erlaubt, und der Rollenwechsel (${point.functionName}) prueft weder eine Sitzung noch den Modus.`,
    );
  }
  if (!enforced) {
    return reading(
      "not-verified",
      `An analyst can still switch role. ${named.en}, whose rule forbids switching, but the role switch (${point.functionName}) does not apply the rule, so it is not enforced.`,
      `Eine Fachkraft kann die Rolle weiterhin wechseln. ${named.de}, dessen Regel den Wechsel verbietet, aber der Rollenwechsel (${point.functionName}) wendet die Regel nicht an, sie wird daher nicht durchgesetzt.`,
    );
  }
  return reading(
    "verified",
    `${named.en}, and the role switch checks the session and the mode before it acts. Roles are fixed per account.`,
    `${named.de}, und der Rollenwechsel prueft vor dem Ausfuehren Sitzung und Modus. Rollen sind je Konto festgelegt.`,
  );
}

/** Whether an analyst can reset the scenario. Same rule shape as role switching. */
export function resetReading(
  mode: ProductMode,
  rawMode: string,
  point: Pick<EnforcementPoint, "checksSession" | "checksProductMode" | "functionName">,
): StatusReading {
  const named = modeName(mode, rawMode);
  const enforced = point.checksSession && point.checksProductMode;
  if (mode === "demonstration") {
    return reading(
      "not-verified",
      `An analyst can reset the day and erase recorded work. ${named.en}, which allows a reset, and the reset (${point.functionName}) checks neither a session nor the mode.`,
      `Eine Fachkraft kann den Tag zuruecksetzen und erfasste Arbeit loeschen. ${named.de}, der ein Zuruecksetzen erlaubt, und das Zuruecksetzen (${point.functionName}) prueft weder eine Sitzung noch den Modus.`,
    );
  }
  if (!enforced) {
    return reading(
      "not-verified",
      `An analyst can still reset the day. ${named.en}, whose rule allows a reset to administrators only, but the reset (${point.functionName}) does not apply the rule, so it is not enforced.`,
      `Eine Fachkraft kann den Tag weiterhin zuruecksetzen. ${named.de}, dessen Regel das Zuruecksetzen nur der Administration erlaubt, aber das Zuruecksetzen (${point.functionName}) wendet die Regel nicht an, sie wird daher nicht durchgesetzt.`,
    );
  }
  return reading(
    "verified",
    `${named.en}, and the reset checks the session and the mode: only an administrator can reset.`,
    `${named.de}, und das Zuruecksetzen prueft Sitzung und Modus: nur die Administration kann zuruecksetzen.`,
  );
}

/* ==========================================================================
   Identity and approvals
   ========================================================================== */

export interface ApprovalIdentityFacts {
  /** The identity source every approval writer uses. */
  source: ApprovalIdentitySource;
  /** Approvals on this run, by the user id they name. */
  byApprover: ReadonlyArray<{ userId: string; count: number }>;
  /** The seeded role holders, for example P-003. */
  roleHolderIds: ReadonlySet<string>;
}

/**
 * Whether identity binds an approval to the person who gave it.
 *
 * Read from both sides: what the writers do (declared and pinned), and what
 * the approvals already recorded actually name. Verified only when the
 * writers use the session and no recorded approval names a seeded holder.
 */
export function approvalIdentityReading(facts: ApprovalIdentityFacts): StatusReading {
  const total = facts.byApprover.reduce((sum, entry) => sum + entry.count, 0);
  const byHolder = facts.byApprover
    .filter((entry) => facts.roleHolderIds.has(entry.userId))
    .reduce((sum, entry) => sum + entry.count, 0);

  if (facts.source === "seeded-role-holder") {
    if (total === 0) {
      return reading(
        "not-verified",
        "Approvals are recorded in the name of the seeded holder of each role, not the signed-in person. No approval is recorded on this run yet.",
        "Genehmigungen werden auf den eingespielten Inhaber jeder Rolle erfasst, nicht auf die angemeldete Person. In diesem Lauf ist noch keine Genehmigung erfasst.",
      );
    }
    return reading(
      "not-verified",
      `Approvals are recorded in the name of the seeded holder of each role, not the signed-in person. ${byHolder} of ${total} approvals on this run name a role holder.`,
      `Genehmigungen werden auf den eingespielten Inhaber jeder Rolle erfasst, nicht auf die angemeldete Person. ${byHolder} von ${total} Genehmigungen in diesem Lauf nennen einen Rolleninhaber.`,
    );
  }

  if (byHolder > 0) {
    return reading(
      "not-verified",
      `Approvals now take the signed-in person, but ${byHolder} of ${total} recorded approvals still name a seeded role holder.`,
      `Genehmigungen uebernehmen jetzt die angemeldete Person, aber ${byHolder} von ${total} erfassten Genehmigungen nennen noch einen eingespielten Rolleninhaber.`,
    );
  }
  return reading(
    "verified",
    `Approvals carry the signed-in person. ${total} approvals on this run, none in a seeded role holder's name.`,
    `Genehmigungen tragen die angemeldete Person. ${total} Genehmigungen in diesem Lauf, keine auf einen eingespielten Rolleninhaber.`,
  );
}

/* ==========================================================================
   Integrations
   ========================================================================== */

export interface ConnectorCounts {
  live: number;
  simulated: number;
  notVerified: number;
  unavailable: number;
}

/**
 * Whether the pilot reads and writes a client system.
 *
 * Wave 5 asks for one verified inbound and one verified outbound
 * integration. A connector in live mode is the precondition; no verification
 * of either direction is recorded in this build, so a live connector reads
 * Live rather than Verified, and no live connector reads Simulated.
 */
export function integrationReading(counts: ConnectorCounts | null): StatusReading {
  if (counts === null) {
    return reading(
      "unavailable",
      "The connector instances could not be read.",
      "Die Konnektorinstanzen konnten nicht gelesen werden.",
    );
  }
  const total = counts.live + counts.simulated + counts.notVerified + counts.unavailable;
  if (total === 0) {
    return reading("empty", "No connector instance is configured.", "Es ist keine Konnektorinstanz eingerichtet.");
  }
  if (counts.live > 0) {
    return reading(
      "live",
      `${counts.live} of ${total} connectors are live. No inbound or outbound verification is recorded for them in this build.`,
      `${counts.live} von ${total} Konnektoren sind live. Fuer sie ist in diesem Build keine Pruefung eingehender oder ausgehender Daten erfasst.`,
    );
  }
  return reading(
    counts.simulated > 0 ? "simulated" : "unavailable",
    `No connector reads a client system. Of ${total} connectors: simulated ${counts.simulated}, sandbox ready with no credential ${counts.notVerified}, unavailable or planned ${counts.unavailable}.`,
    `Kein Konnektor liest ein Kundensystem. Von ${total} Konnektoren: simuliert ${counts.simulated}, ohne Anmeldedaten sandbox-bereit ${counts.notVerified}, nicht verfuegbar oder geplant ${counts.unavailable}.`,
  );
}

/* ==========================================================================
   Backup and restore
   ========================================================================== */

export type BackupFacts =
  | { state: "no-backup" }
  | { state: "unreadable-manifest" }
  | { state: "missing-file"; timestamp: string }
  | { state: "hash-mismatch"; timestamp: string }
  | { state: "other-database"; timestamp: string; backedUp: string; configured: string }
  | { state: "restore-failed"; timestamp: string; reason: string }
  | {
      state: "restored";
      timestamp: string;
      tables: number;
      migrations: number;
      liveMigrations: number | null;
      /** Where `backup.ts restore` would write, and whether that is the configured database. */
      restoreTargetMatches: boolean;
      configured: string;
    };

/**
 * Whether a backup of this database exists and restores.
 *
 * The check does what an operator would do before trusting a backup: it
 * re-hashes the latest backup against its manifest, confirms the backup is
 * of the database this server reads, restores it into a scratch file, opens
 * it and runs the SQLite integrity check, and compares its migrations with
 * the live database. The live database is never written. Verified only when
 * every step passes and the restore script would write back to this
 * database.
 */
export function backupReading(facts: BackupFacts): StatusReading {
  switch (facts.state) {
    case "no-backup":
      return reading(
        "not-verified",
        "No backup has been taken on this machine. Run npm run backup:create, then open this page again.",
        "Auf diesem Rechner wurde noch keine Sicherung erstellt. Fuehren Sie npm run backup:create aus und oeffnen Sie diese Seite erneut.",
      );
    case "unreadable-manifest":
      return reading(
        "not-verified",
        "The latest backup manifest could not be read, so no backup can be trusted.",
        "Das neueste Sicherungsmanifest konnte nicht gelesen werden, daher ist keiner Sicherung zu trauen.",
      );
    case "missing-file":
      return reading(
        "not-verified",
        `The backup manifest of ${facts.timestamp} names a file that is no longer there.`,
        `Das Sicherungsmanifest vom ${facts.timestamp} nennt eine Datei, die nicht mehr vorhanden ist.`,
      );
    case "hash-mismatch":
      return reading(
        "not-verified",
        `The backup of ${facts.timestamp} does not match the hash in its manifest. It has changed since it was taken.`,
        `Die Sicherung vom ${facts.timestamp} stimmt nicht mit dem Hash in ihrem Manifest ueberein. Sie wurde seit ihrer Erstellung veraendert.`,
      );
    case "other-database":
      return reading(
        "not-verified",
        `The latest backup (${facts.timestamp}) is of ${facts.backedUp}, not of the database this server reads (${facts.configured}). The backup script always backs up data/nfr-workos.db and does not read NFR_DB_PATH.`,
        `Die neueste Sicherung (${facts.timestamp}) betrifft ${facts.backedUp}, nicht die Datenbank dieses Servers (${facts.configured}). Das Sicherungsskript sichert immer data/nfr-workos.db und liest NFR_DB_PATH nicht.`,
      );
    case "restore-failed":
      return reading(
        "not-verified",
        `The backup of ${facts.timestamp} was restored into a scratch file and did not pass: ${facts.reason}`,
        `Die Sicherung vom ${facts.timestamp} wurde in eine Testdatei wiederhergestellt und hat die Pruefung nicht bestanden: ${facts.reason}`,
      );
    case "restored": {
      const migrationsMatch = facts.liveMigrations === null || facts.liveMigrations === facts.migrations;
      if (!migrationsMatch) {
        return reading(
          "not-verified",
          `The backup of ${facts.timestamp} restores and passes the integrity check, but it holds ${facts.migrations} migrations and the live database ${String(facts.liveMigrations)}. Take a new backup.`,
          `Die Sicherung vom ${facts.timestamp} laesst sich wiederherstellen und besteht die Integritaetspruefung, enthaelt aber ${facts.migrations} Migrationen und die aktive Datenbank ${String(facts.liveMigrations)}. Erstellen Sie eine neue Sicherung.`,
        );
      }
      if (!facts.restoreTargetMatches) {
        return reading(
          "not-verified",
          `The backup of ${facts.timestamp} restores into a scratch file and passes the integrity check, but npm run backup:restore writes to data/nfr-workos.db, not to the configured database (${facts.configured}).`,
          `Die Sicherung vom ${facts.timestamp} laesst sich in eine Testdatei wiederherstellen und besteht die Integritaetspruefung, aber npm run backup:restore schreibt nach data/nfr-workos.db, nicht in die konfigurierte Datenbank (${facts.configured}).`,
        );
      }
      return reading(
        "verified",
        `The backup of ${facts.timestamp} matches its hash, was restored into a scratch file on this request and passed the integrity check: ${facts.tables} tables and ${facts.migrations} migrations, the same as the live database.`,
        `Die Sicherung vom ${facts.timestamp} stimmt mit ihrem Hash ueberein, wurde bei dieser Anfrage in eine Testdatei wiederhergestellt und hat die Integritaetspruefung bestanden: ${facts.tables} Tabellen und ${facts.migrations} Migrationen, wie die aktive Datenbank.`,
      );
    }
  }
}

/* ==========================================================================
   Support bundle
   ========================================================================== */

export type SupportBundleFacts =
  | { state: "none" }
  | { state: "unreadable"; bundle: string }
  | { state: "incomplete"; bundle: string; missing: readonly string[] }
  | { state: "credential-shape"; bundle: string; files: readonly string[] }
  | { state: "clean"; bundle: string; createdAt: string | null; files: number };

/**
 * Whether the support bundle works and holds nothing it must not.
 *
 * Read from the latest bundle `npm run support:bundle` wrote: every file its
 * manifest lists must be there, and none may contain a credential shape.
 */
export function supportBundleReading(facts: SupportBundleFacts): StatusReading {
  switch (facts.state) {
    case "none":
      return reading(
        "not-verified",
        "No support bundle has been generated on this machine. Run npm run support:bundle, then open this page again.",
        "Auf diesem Rechner wurde noch kein Supportpaket erzeugt. Fuehren Sie npm run support:bundle aus und oeffnen Sie diese Seite erneut.",
      );
    case "unreadable":
      return reading(
        "not-verified",
        `The manifest of support bundle ${facts.bundle} could not be read.`,
        `Das Manifest des Supportpakets ${facts.bundle} konnte nicht gelesen werden.`,
      );
    case "incomplete":
      return reading(
        "not-verified",
        `Support bundle ${facts.bundle} is missing files its manifest lists: ${facts.missing.join(", ")}.`,
        `Im Supportpaket ${facts.bundle} fehlen Dateien, die sein Manifest nennt: ${facts.missing.join(", ")}.`,
      );
    case "credential-shape":
      return reading(
        "not-verified",
        `Support bundle ${facts.bundle} contains text shaped like a credential in ${facts.files.join(", ")}. Do not share it.`,
        `Das Supportpaket ${facts.bundle} enthaelt in ${facts.files.join(", ")} Text, der wie Zugangsdaten aussieht. Geben Sie es nicht weiter.`,
      );
    case "clean":
      return reading(
        "verified",
        `Support bundle ${facts.bundle} holds the ${facts.files} files its manifest lists, and none contains a credential shape. Checked on this request.`,
        `Das Supportpaket ${facts.bundle} enthaelt die ${facts.files} Dateien seines Manifests, und keine enthaelt Text, der wie Zugangsdaten aussieht. Bei dieser Anfrage geprueft.`,
      );
  }
}

/* ==========================================================================
   Credential shapes
   ========================================================================== */

/**
 * Text that looks like a credential.
 *
 * The same families `scripts/scan-secrets.mjs` detects, used here to check a
 * support bundle and the pilot evidence pack before either is offered. A
 * match is reported by file, never by value.
 */
export const CREDENTIAL_SHAPES: readonly RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{20,}/,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\b(?:OPENAI_API_KEY|SESSION_SECRET)\s*[=:]\s*\S+/,
];

/** Whether a text contains anything shaped like a credential. */
export function containsCredentialShape(text: string): boolean {
  return CREDENTIAL_SHAPES.some((pattern) => pattern.test(text));
}

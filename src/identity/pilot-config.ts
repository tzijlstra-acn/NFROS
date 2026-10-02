/**
 * Static pilot accounts for design partner evaluation.
 *
 * These are example accounts only -- no real credentials, no real personal
 * data, no real organisation IDs. Replace or extend this list before any
 * actual design-partner engagement.
 *
 * Role IDs must match the values in ROLE_IDS (src/db/schema/core.ts).
 * Administrators carry no roleIds because they access every role by virtue
 * of isAdministrator being true.
 */

export const PILOT_USERS = [
  {
    userId: "PILOT-001",
    displayName: "RCSA Analyst (Pilot)",
    email: "rcsa@pilot.local",
    roleIds: ["rcsa"],
    isAdministrator: false,
  },
  {
    userId: "PILOT-002",
    displayName: "TPRM Analyst (Pilot)",
    email: "tprm@pilot.local",
    roleIds: ["tprm"],
    isAdministrator: false,
  },
  {
    userId: "PILOT-ADM",
    displayName: "Pilot Administrator",
    email: "admin@pilot.local",
    roleIds: [],
    isAdministrator: true,
  },
] as const;

export type PilotUserId = (typeof PILOT_USERS)[number]["userId"];

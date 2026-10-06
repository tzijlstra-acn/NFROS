/**
 * What the product enforces today, stated once and pinned by a test.
 *
 * Some readiness questions cannot be answered by reading a table. "Can an
 * analyst switch role?" is a property of the code path the role switch takes,
 * not of any row: the rule `isRoleSwitchingAllowed` exists in
 * `src/identity/product-mode.ts`, and the only question that matters is
 * whether the server action that switches the role calls it. Reading the
 * source at request time would be fragile and would not work in a build that
 * ships without sources, so the answer is written down here instead, beside
 * the file and function it describes.
 *
 * Every entry is pinned by `tests/unit/pilot-readiness.test.ts`, which reads
 * the named source and fails when the code and this statement disagree. So
 * the day the role switch action starts checking the session, the test fails
 * until this file says so, and the readiness check then reports what the code
 * does rather than what this file used to claim.
 *
 * Pure: no database, no environment.
 */

/** One server path and whether it checks who is asking. */
export interface EnforcementPoint {
  /** The repository file holding the path, as the test reads it. */
  file: string;
  /** The exported function the browser calls. */
  functionName: string;
  /** Whether the function reads the signed-in session before acting. */
  checksSession: boolean;
  /** Whether the function applies the product mode rule before acting. */
  checksProductMode: boolean;
  /** The product mode rule that applies, from `src/identity/product-mode.ts`. */
  rule: "isRoleSwitchingAllowed" | "isResetAllowed";
}

/**
 * The role switch and the scenario reset.
 *
 * Both are server actions in `app/actions.ts`. Neither reads a session and
 * neither applies its product mode rule: the rules are defined and unit
 * tested, and nothing on the request path calls them. In demonstration mode
 * that is the intended behaviour; in design-partner mode it means the rule is
 * not enforced.
 */
export const ENFORCEMENT_POINTS = {
  roleSwitch: {
    file: "app/actions.ts",
    functionName: "actionSwitchRole",
    checksSession: false,
    checksProductMode: false,
    rule: "isRoleSwitchingAllowed",
  },
  reset: {
    file: "app/actions.ts",
    functionName: "actionResetScenario",
    checksSession: false,
    checksProductMode: false,
    rule: "isResetAllowed",
  },
} as const satisfies Record<string, EnforcementPoint>;

/**
 * Whose name an approval carries.
 *
 * Every writer of an `approvals` row in the workday records the holder of the
 * role whose work is changing (`roleHolder` or `roleHolderUserId`), read from
 * the seeded `roles` table, not the signed-in person. That keeps the gate's
 * role check honest in a demonstration, and it means identity does not yet
 * bind an approval to a person.
 */
export const APPROVAL_WRITERS = [
  { file: "src/scenario/engine/decide.ts", identitySource: "seeded-role-holder", marker: "roleHolderUserId(" },
  { file: "src/features/work/governance.ts", identitySource: "seeded-role-holder", marker: "roleHolder(" },
  { file: "src/features/process/context.ts", identitySource: "seeded-role-holder", marker: "actingUserId: roleHolder(" },
] as const;

export type ApprovalIdentitySource = "seeded-role-holder" | "session";

/** The identity every workday approval writer uses today. */
export const APPROVAL_IDENTITY_SOURCE: ApprovalIdentitySource = "seeded-role-holder";

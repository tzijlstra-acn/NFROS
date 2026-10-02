# V4 Identity and Access Layer

Agent B handoff for NFR WorkOS V4.0.

---

## Files created

| File | Purpose |
|---|---|
| `src/identity/types.ts` | Shared types: `ProductMode`, `ProductSession`, `IdentityProvider` interface |
| `src/identity/session.ts` | HMAC-SHA256 signing and verification using Node built-in `crypto` |
| `src/identity/product-mode.ts` | `getProductMode()`, `isRoleSwitchingAllowed()`, `isResetAllowed()` |
| `src/identity/cookies.ts` | Cookie name constants safe to import from Edge runtime (no next/headers) |
| `src/identity/pilot-config.ts` | Static pilot account definitions for design-partner mode |
| `src/identity/local-demo.ts` | `IdentityProvider` for demonstration and offline-evaluation modes |
| `src/identity/local-pilot.ts` | `IdentityProvider` for design-partner mode |
| `src/identity/index.ts` | Module entry: `getActiveProvider()`, `getSession()`, re-exports |
| `src/identity/access.ts` | `requireSession()`, `requireRole()`, `requireAdministrator()` |
| `tests/unit/identity.test.ts` | 26 unit tests covering signing, mode reading, and access control |

## Files modified

| File | Change |
|---|---|
| `middleware.ts` | Added session cookie verification; forwards `x-product-mode` header |
| `app/page.tsx` | Added conditional "Design partner workspace" link when `PRODUCT_MODE=design-partner` |

---

## How to configure PRODUCT_MODE

Set the `PRODUCT_MODE` environment variable before starting the dev server or building.

```
# Default: demonstration personas, role switching allowed, 8-hour sessions
PRODUCT_MODE=demonstration

# Named pilot accounts, roles fixed, 4-hour sessions
PRODUCT_MODE=design-partner

# Same provider as demonstration but productMode field is offline-evaluation
PRODUCT_MODE=offline-evaluation
```

Set `SESSION_SECRET` to a strong random string in every environment except local development. The module falls back to a documented weak default that is only acceptable on a single-developer machine.

```
SESSION_SECRET=<your-strong-random-secret>
```

---

## Role switching behaviour by mode

| Mode | Role switching | Reset | Persona/account selection |
|---|---|---|---|
| `demonstration` | Allowed | Always | Any of three seeded personas |
| `design-partner` | Prohibited | Admin only | Fixed at account creation |
| `offline-evaluation` | Prohibited | Admin only | Same personas as demonstration |

`isRoleSwitchingAllowed(mode)` and `isResetAllowed(mode, isAdministrator)` encode these rules as pure functions that any server component or server action can call.

---

## Demonstration personas

| Persona ID | Display name | Role IDs | Administrator |
|---|---|---|---|
| `rcsa-analyst` | Thomas Zijlstra | `["rcsa"]` | false |
| `tprm-analyst` | Anna Mueller | `["tprm"]` | false |
| `administrator` | Max Weber | `[]` | true |

Pass the persona ID as the `input` argument to `localDemoProvider.signIn(personaId)`. The session is stored as a signed JSON cookie (`nfr-demo-session`) valid for 8 hours.

---

## Pilot accounts

Defined statically in `src/identity/pilot-config.ts`. For a real design-partner engagement, replace or extend `PILOT_USERS` before deployment. The accounts listed are synthetic placeholders only.

| User ID | Display name | Role IDs | Administrator |
|---|---|---|---|
| `PILOT-001` | RCSA Analyst (Pilot) | `["rcsa"]` | false |
| `PILOT-002` | TPRM Analyst (Pilot) | `["tprm"]` | false |
| `PILOT-ADM` | Pilot Administrator | `[]` | true |

---

## Middleware changes

The middleware now verifies session cookies (HMAC only, no DB access) and sets `x-product-mode` on the request headers. Downstream layouts can read this header without calling `next/headers` or touching the database. The existing UI version resolution (`x-nfr-workday-ui`) is unchanged.

Cookie names are defined in `src/identity/cookies.ts` -- a constants-only file with no `next/headers` import -- so the middleware can import them safely in the Edge runtime.

---

## TypeScript status

All new files in `src/identity/` are clean. The only TypeScript errors reported by `tsc --noEmit` are two pre-existing errors in `app/ops/page.tsx` (type mismatch on a number argument and an unsafe cast). These existed before this work and are not related to the identity layer.

---

## Test results

```
Tests:  26 passed (26)
Files:  1 passed (1)
```

All tests in `tests/unit/identity.test.ts` pass under `vitest run`.

Tests cover:
- `signValue` + `verifyAndExtract` round-trip for plain strings and JSON payloads
- Tampered payload (corrupted content, replaced digest, missing dot, empty string, truncated)
- `getProductMode()` for all three modes and an unrecognised fallback
- `isRoleSwitchingAllowed`: true for demonstration, false for design-partner and offline-evaluation
- `isResetAllowed`: true for demonstration regardless of admin; admin-gated for design-partner and offline-evaluation
- `requireSession`: passes with a session, throws on null
- `requireRole`: passes for matching role, passes for administrator, throws for missing role
- `requireAdministrator`: passes for administrator, throws otherwise

---

## Known limitations

- No OIDC or external identity provider. Authentication is persona selection (demo) or a static config file (pilot). Real production identity would require integrating an OIDC provider and replacing these two modules.
- No session revocation database. A signed cookie is valid until it expires. There is no server-side session store that could invalidate a token before its expiry time.
- No per-request session refresh. Sessions expire hard at the TTL and the user must sign in again.
- Cookie payload is signed but not encrypted. The JSON session payload is readable by anyone who can inspect the cookie. It contains no sensitive fields (no password, no key), but it does contain the user ID and role IDs.
- The pilot account list is static. Adding or removing accounts requires a code change and a redeploy. No admin UI for pilot account management exists yet.
- `signIn` and `signOut` call `next/headers` cookies(), which requires a server action or route handler context. They cannot be called from middleware or pure utility code.

/**
 * HMAC-based session cookie signing.
 *
 * Signs a string value with SHA-256 HMAC and verifies it on read. Uses the
 * Web Crypto API (SubtleCrypto) so this module is safe to import from both
 * the Edge Runtime (middleware) and Node.js server components.
 *
 * The session secret MUST come from the SESSION_SECRET environment variable in
 * any deployed context. The fallback string below is for local development
 * only and must never be used in production or any shared environment.
 */

// NOTE: this fallback is intentionally weak and is for local development only.
// Set SESSION_SECRET in your environment before any shared or production use.
const SESSION_SECRET =
  process.env["SESSION_SECRET"] ?? "nfros-local-dev-secret-not-for-production";

async function getKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(SESSION_SECRET);
  return crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/**
 * Appends an HMAC-SHA256 digest to `value` separated by a dot.
 *
 * The returned string is safe to store in a cookie. It is NOT encrypted: the
 * payload is readable but tamper-evident.
 */
export async function signValue(value: string): Promise<string> {
  const key = await getKey();
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  const hex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${value}.${hex}`;
}

/**
 * Verifies the HMAC suffix and, if valid, returns the original value.
 *
 * Returns null when the input is malformed, the signature is absent, or the
 * digest does not match. Uses SubtleCrypto.verify for constant-time comparison.
 */
export async function verifyAndExtract(signed: string): Promise<string | null> {
  const lastDot = signed.lastIndexOf(".");
  if (lastDot === -1) return null;
  const value = signed.slice(0, lastDot);
  const signatureHex = signed.slice(lastDot + 1);

  // SHA-256 produces 32 bytes = 64 hex characters.
  if (signatureHex.length !== 64) return null;

  const signatureBytes = new Uint8Array(
    (signatureHex.match(/.{2}/g) ?? []).map((b) => parseInt(b, 16)),
  );

  const key = await getKey();
  const encoder = new TextEncoder();
  const isValid = await crypto.subtle.verify("HMAC", key, signatureBytes, encoder.encode(value));
  return isValid ? value : null;
}

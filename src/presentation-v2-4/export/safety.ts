import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DASH_CLASS } from "./manifest";

const SECRET_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: "API token (sk-)", re: /(?<![A-Za-z0-9])sk-(?:proj-|ant-)?[A-Za-z0-9_-]{16,}/ },
  { label: "bearer token", re: /\bbearer\s+[A-Za-z0-9._-]{20,}/i },
  { label: "private key block", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { label: "AWS access key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { label: ".env assignment", re: /^\s*(?:export\s+)?[A-Z][A-Z0-9_]{2,}=\S+/m },
];

const LOCAL_PATH_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: "Windows drive path", re: /\b[A-Za-z]:\\[^\s"'<>]/ },
  { label: "Windows drive path", re: /\b[A-Za-z]:\/(?:Users|home|Windows|Program|Code)/i },
  { label: "Windows user folder", re: /\\Users\\/i },
  { label: "macOS user folder", re: /\/Users\/[A-Za-z]/ },
  { label: "Unix home folder", re: /\/home\/[a-z]/ },
  { label: "file URL", re: /file:\/\/\//i },
];

const DASHES = new RegExp(DASH_CLASS);

/** Values from local .env files, so the verifier can prove none leaked into an export. */
export function loadEnvValues(root: string): string[] {
  const values: string[] = [];
  let files: string[] = [];
  try {
    files = readdirSync(root).filter((f) => /^\.env(\..+)?$/.test(f) && f !== ".env.example");
  } catch {
    return values;
  }
  for (const file of files) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = /^\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=\s*(.*)$/.exec(line);
      const raw = match?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
      if (raw.length < 12) continue;
      if (/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(raw)) continue;
      if (/^[a-z]+$/i.test(raw) || /^\d+$/.test(raw)) continue;
      values.push(raw);
    }
  }
  return values;
}

export interface ScanOptions {
  envValues: readonly string[];
  forbidden: readonly string[];
  checkDashes: boolean;
}

export function scanText(label: string, text: string, opts: ScanOptions): string[] {
  const issues: string[] = [];
  for (const { label: what, re } of SECRET_PATTERNS) {
    if (re.test(text)) issues.push(`${label}: possible secret (${what})`);
  }
  for (const { label: what, re } of LOCAL_PATH_PATTERNS) {
    if (re.test(text)) issues.push(`${label}: local path (${what})`);
  }
  for (const value of opts.envValues) {
    if (text.includes(value)) issues.push(`${label}: contains a value from a local .env file`);
  }
  for (const value of opts.forbidden) {
    if (value && text.includes(value)) issues.push(`${label}: contains the local repository path`);
  }
  if (opts.checkDashes && DASHES.test(text)) issues.push(`${label}: contains an em or en dash`);
  return issues;
}

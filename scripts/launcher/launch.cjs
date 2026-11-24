// Launches the NFR Workspace showcase: its own database (data/showcase.db), a production server on
// port 3200, and the browser. The shared demonstration database (data/nfr-workos.db) and port 3000
// are never touched. The server runs only as long as this window: it does not depend on any
// development session.
//
// Plain Node on purpose: on a managed Windows laptop every PowerShell or git start costs
// several seconds, so this script starts no process it does not need.
//   node scripts/launcher/launch.cjs            production server (builds first if needed)
//   node scripts/launcher/launch.cjs --rebuild  force a fresh build
//   node scripts/launcher/launch.cjs --reset    restore the clean showcase day before starting
//   node scripts/launcher/launch.cjs --dev      development server instead
//   node scripts/launcher/launch.cjs --no-open  do not open a browser (rehearsal scripts)
// Stop it with Stop NFROS.cmd (scripts/launcher/stop.cjs) or by closing this window.
//
// What it does, in order: checks Node and the database driver; reuses a healthy showcase if one
// is already running; migrates and seeds the showcase database when needed; builds when the code
// changed; starts the server; waits until /api/health/demo says the scripted journey can run;
// warms the scripted routes; and only then switches the browser from the starting page to the
// product. Everything it prints also goes to data/launcher.log.
const { existsSync, readdirSync, statSync, lstatSync, readFileSync, writeFileSync, appendFileSync, mkdirSync, unlinkSync } = require("node:fs");
const { join } = require("node:path");
const net = require("node:net");
const { spawn, exec } = require("node:child_process");

const root = join(__dirname, "..", "..");
const port = 3200;
const url = `http://localhost:${port}/`;
const origin = url.slice(0, -1);
const dataDir = join(root, "data");
const db = join(dataDir, "showcase.db");
const logFile = join(dataDir, "launcher.log");
const pidFile = join(dataDir, "showcase.pid");
const stateFile = join(dataDir, "launch-state.js");
const buildDir = ".next-showcase-prod";
const args = new Set(process.argv.slice(2));
const dev = args.has("--dev");
const openBrowser = !args.has("--no-open");
const READY_TIMEOUT_MS = 240_000;

process.title = `NFR Workspace showcase (port ${port})`;
process.chdir(root);
mkdirSync(dataDir, { recursive: true });
appendFileSync(logFile, `\n==== ${new Date().toISOString()} launch ${[...args].join(" ")}\n`);

const log = (line) => { try { appendFileSync(logFile, line + "\n"); } catch {} };
const say = (line) => { console.log(line); log(line); };
const openInBrowser = (target) => { if (openBrowser) exec(`start "" "${target}"`); };
// The starting page polls this file and shows its message; on "ready" it switches to the product
const setState = (state, message) => {
  try { writeFileSync(stateFile, `window.__nfrLaunch = ${JSON.stringify({ state, message, url, log: logFile, at: Date.now() })};\n`); } catch {}
};
function fail(message, hint) {
  say("");
  say(`NFR Workspace could not start: ${message}`);
  if (hint) say(hint);
  say(`The full log is in ${logFile}`);
  setState("failed", `${message}${hint ? " " + hint : ""}`);
  process.exitCode = 1;
}

function portAnswers() {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.setTimeout(400);
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => resolve(false));
    socket.once("timeout", () => { socket.destroy(); resolve(false); });
  });
}

// The readiness probe. Null when the server does not answer or has no probe (an older build).
async function readiness() {
  try {
    const response = await fetch(origin + "/api/health/demo", { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (response.status === 404) return { legacy: true };
    return { status: response.status, body: await response.json() };
  } catch {
    return null;
  }
}

function runtimeProblem() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 20 || (major === 20 && minor < 9)) return [`Node ${process.versions.node} is too old.`, "Install Node 20.9 or newer (LTS) and start again."];
  if (!existsSync(join(root, "node_modules", "next"))) return ["the dependencies are not installed.", "Run npm install in this folder once, then start again."];
  try {
    const Database = require(join(root, "node_modules", "better-sqlite3"));
    new Database(":memory:").close();
  } catch (error) {
    return [`the database driver does not load (${String(error && error.message || error).split("\n")[0]}).`, "Run npm rebuild better-sqlite3 in this folder, then start again."];
  }
  return null;
}

function databaseCurrent() {
  if (!existsSync(db)) return false;
  try {
    const journal = JSON.parse(readFileSync(join(root, "src", "db", "migrations", "meta", "_journal.json"), "utf8"));
    const Database = require(join(root, "node_modules", "better-sqlite3"));
    const conn = new Database(db, { readonly: true, fileMustExist: true });
    const applied = conn.prepare("select count(*) as n from __drizzle_migrations").get().n;
    conn.close();
    return applied >= journal.entries.length;
  } catch {
    return false;
  }
}

// Whether the portfolio register (migration 0010) holds rows; an upgraded database has none.
function portfolioSeeded() {
  try {
    const Database = require(join(root, "node_modules", "better-sqlite3"));
    const conn = new Database(db, { readonly: true, fileMustExist: true });
    const n = conn.prepare("select count(*) as n from third_party_monthly_metrics").get().n;
    conn.close();
    return n > 0;
  } catch {
    return false;
  }
}

// Newest modification time under the app's own code, to tell whether the build is stale
function newestSourceTime() {
  let newest = 0;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else newest = Math.max(newest, statSync(path).mtimeMs);
    }
  };
  for (const dir of ["app", "src", "public"]) if (existsSync(join(root, dir))) walk(join(root, dir));
  for (const file of ["next.config.ts", "package.json"]) if (existsSync(join(root, file))) newest = Math.max(newest, statSync(join(root, file)).mtimeMs);
  return newest;
}

// Runs a step; its output streams to the window and the log as it happens
function run(command, commandArgs) {
  return new Promise((resolve) => {
    const child = spawn(command, commandArgs, { shell: true, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    const relay = (chunk) => { process.stdout.write(chunk); log(String(chunk).trimEnd()); };
    child.stdout.on("data", relay);
    child.stderr.on("data", relay);
    child.on("error", (error) => { log(String(error)); resolve(false); });
    child.on("exit", (code) => resolve(code === 0));
  });
}

// Turbopack refuses a junctioned node_modules (a worktree sharing another checkout's); webpack does not
function buildFlags() {
  try { return lstatSync(join(root, "node_modules")).isSymbolicLink() ? ["--webpack"] : []; } catch { return []; }
}

function describe(body) {
  if (!body || !body.checks) return;
  for (const check of body.checks) say(`  ${check.ok ? "ok  " : "warn"} ${check.name}: ${check.detail}`);
}

async function warmUp() {
  // NFR Workspace guards the workday, so the warm-up signs in first and carries the session.
  // The presenter still signs in on screen: this cookie lives only in this script.
  let cookie = "";
  try {
    const response = await fetch(origin + "/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: process.env.NFR_DEMO_USERNAME || "Admin", password: process.env.NFR_DEMO_PASSWORD || "Admin" }),
    });
    cookie = (response.headers.get("set-cookie") || "").split(";")[0];
  } catch {}
  // Every page the five acts open, so no first click pays for loading its code
  const paths = [
    "/", "/login", "/workday/tprm", "/workday/tprm/insights", "/workday/tprm/insights/INS-WARMUP",
    "/workday/tprm/insights/records?source=audit", "/workday/tprm/decisions", "/workday/tprm/work",
    "/workday/tprm/agents", "/workday/rcsa", "/workday/rcsa/processes/rcsa-cycle", "/workday/rcsa/decisions",
  ];
  const started = Date.now();
  for (const path of paths) {
    try { await fetch(origin + path, { headers: cookie ? { cookie } : {} }); } catch {}
  }
  return Date.now() - started;
}

async function waitUntilReady(server) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < READY_TIMEOUT_MS) {
    if (server && server.exitCode !== null) return { ok: false, reason: "the server stopped while starting." };
    if (await portAnswers()) {
      last = await readiness();
      if (last && (last.legacy || last.status === 200)) return { ok: true, result: last, ms: Date.now() - started };
    }
    await new Promise((r) => setTimeout(r, 750));
  }
  return { ok: false, reason: "it did not become ready within four minutes.", result: last };
}

function reportReady(result, warmMs) {
  if (result.legacy) {
    say("NFR Workspace is running (this build has no readiness probe).");
    return;
  }
  const body = result.body;
  describe(body);
  if (warmMs !== undefined) say(`  ok   warm-up: scripted pages loaded in ${warmMs} ms`);
  say("");
  if (body.cleanDay) say("Ready. The showcase day is clean. Sign in with Admin / Admin.");
  else say("Ready, but the day shows earlier work. Before presenting: account menu, Reset demonstration, then Confirm reset.");
}

(async () => {
  // Already running: reuse it if it is healthy, never start a second server
  if (await portAnswers()) {
    const result = await readiness();
    if (result && (result.legacy || result.status === 200)) {
      say(`NFR Workspace is already running on ${url}.`);
      reportReady(result);
      setState("ready", "NFR Workspace is ready.");
      openInBrowser(url);
      return;
    }
    if (result && result.body) {
      describe(result.body);
      return fail("the showcase on port 3200 answers but is not ready.", "Close its window (or run Stop NFROS.cmd), then start again.");
    }
    return fail("port 3200 is in use by another program.", "Close that program, or run Stop NFROS.cmd if it is an earlier showcase, then start again.");
  }

  const problem = runtimeProblem();
  if (problem) return fail(problem[0], problem[1]);

  // The browser opens at once on a local starting page that shows progress and switches to
  // NFR Workspace only when the readiness probe says the journey can run
  setState("starting", "Checking the showcase database.");
  openInBrowser(join(__dirname, "starting.html"));

  process.env.NFR_DB_PATH = db;
  process.env.NFR_DEMO_MODE = "safe";
  const fresh = !existsSync(db);
  if (!databaseCurrent()) {
    say("Updating the showcase database (a few minutes, only after an update)...");
    setState("starting", "Updating the showcase database (only after an update).");
    if (!(await run("npx", ["tsx", "scripts/migrate.ts"]))) return fail("the database update failed.", "Delete data\\showcase.db and start again to rebuild it.");
  }
  if (fresh) {
    say("First run: seeding the synthetic institution (a few minutes)...");
    setState("starting", "First run: seeding the synthetic institution.");
    if (!(await run("npx", ["tsx", "scripts/seed.ts"]))) return fail("seeding the synthetic institution failed.", "Delete data\\showcase.db and start again.");
  } else if (!portfolioSeeded()) {
    // NFR Workspace v3 (migration 0010) added the portfolio register and its history. A database
    // migrated from an earlier release has the tables but no rows until it is seeded again.
    say("Updating the showcase day for NFR Workspace (a few minutes, once)...");
    setState("starting", "Updating the showcase day (once).");
    if (!(await run("npx", ["tsx", "scripts/seed.ts"]))) return fail("seeding the showcase day failed.", "Delete data\\showcase.db and start again.");
  } else if (args.has("--reset")) {
    say("Restoring the clean showcase day...");
    setState("starting", "Restoring the clean showcase day.");
    if (!(await run("npx", ["tsx", "scripts/reset.ts"]))) return fail("the reset failed.", "Delete data\\showcase.db and start again to rebuild the day.");
  }

  const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");
  let mode = dev ? "dev" : "start";
  process.env.NFR_DIST_DIR = dev ? ".next-showcase" : buildDir;
  if (!dev) {
    const buildId = join(root, buildDir, "BUILD_ID");
    const stale = !existsSync(buildId) || newestSourceTime() > statSync(buildId).mtimeMs;
    if (stale || args.has("--rebuild")) {
      say("Building NFR Workspace for fast loading (about 10 minutes, only after code changes)...");
      setState("building", "Building NFR Workspace for fast loading (about 10 minutes, only after code changes).");
      if (!(await run(`"${process.execPath}"`, [`"${nextBin}"`, "build", ...buildFlags()]))) {
        say("");
        say("THE BUILD FAILED. Starting the development server instead: first pages are slower. See the log above and data\\launcher.log.");
        mode = "dev";
        process.env.NFR_DIST_DIR = ".next-showcase";
      }
    }
  }

  say("");
  say(`Starting NFR Workspace on ${url}`);
  say("Keep this window open while you use NFR Workspace. Close it, or run Stop NFROS.cmd, to stop the server.");
  say("");
  setState("starting", "Starting the server.");
  const serverArgs = [nextBin, mode, "-p", String(port), ...(mode === "dev" ? buildFlags() : [])];
  const server = spawn(process.execPath, serverArgs, { stdio: ["ignore", "pipe", "pipe"], env: process.env });
  try { writeFileSync(pidFile, String(server.pid)); } catch {}
  const relay = (chunk) => { process.stdout.write(chunk); log(String(chunk).trimEnd()); };
  server.stdout.on("data", relay);
  server.stderr.on("data", relay);
  server.on("exit", (code) => {
    try { if (existsSync(pidFile) && readFileSync(pidFile, "utf8").trim() === String(server.pid)) unlinkSync(pidFile); } catch {}
    say(`NFR Workspace stopped${code ? ` (exit code ${code})` : ""}.`);
    process.exit(code ?? 0);
  });

  setState("starting", "Loading the role, the day and the first question.");
  const ready = await waitUntilReady(server);
  if (!ready.ok) {
    if (ready.result && ready.result.body) describe(ready.result.body);
    fail(ready.reason, "Close this window and start again; if it repeats, start with --rebuild.");
    return;
  }
  setState("starting", "Warming the pages of the demonstration.");
  const warmMs = await warmUp();
  reportReady(ready.result, warmMs);
  setState("ready", "NFR Workspace is ready.");
})();

// Launches the NFROS showcase: its own database (data/showcase.db), a production server on
// port 3200, and the browser. If the showcase is already running it only opens the browser.
// The shared demonstration database (data/nfr-workos.db) and port 3000 are never touched.
//
// Plain Node on purpose: on a managed Windows laptop every PowerShell or git start costs
// several seconds, so this script starts no process it does not need.
//   node scripts/launcher/launch.cjs            production server (builds first if needed)
//   node scripts/launcher/launch.cjs --rebuild  force a fresh build
//   node scripts/launcher/launch.cjs --dev      development server instead
const { existsSync, readdirSync, statSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const net = require("node:net");
const { spawn, spawnSync, exec } = require("node:child_process");

const root = join(__dirname, "..", "..");
const port = 3200;
const url = `http://localhost:${port}/`;
const db = join(root, "data", "showcase.db");
const buildDir = ".next-showcase-prod";
const args = new Set(process.argv.slice(2));
const dev = args.has("--dev");

process.title = `NFROS showcase (port ${port})`;
process.chdir(root);

const openInBrowser = (target) => exec(`start "" "${target}"`);
const say = (line) => console.log(line);

function portAnswers() {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.setTimeout(400);
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => resolve(false));
    socket.once("timeout", () => { socket.destroy(); resolve(false); });
  });
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

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { stdio: "inherit", shell: true, env: process.env });
  return result.status === 0;
}

(async () => {
  if (await portAnswers()) {
    say(`NFROS is already running. Opening ${url}`);
    openInBrowser(url);
    return;
  }

  // The browser opens at once on a local starting page that switches to NFROS when it answers
  openInBrowser(join(__dirname, "starting.html"));

  process.env.NFR_DB_PATH = db;
  process.env.NFR_DEMO_MODE = "safe";
  const fresh = !existsSync(db);
  if (!databaseCurrent()) {
    say("Updating the showcase database (a few minutes, only after an update)...");
    run("npx", ["tsx", "scripts/migrate.ts"]);
  }
  if (fresh) {
    say("First run: seeding the synthetic institution (a few minutes)...");
    run("npx", ["tsx", "scripts/seed.ts"]);
  }

  const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");
  let mode = dev ? "dev" : "start";
  process.env.NFR_DIST_DIR = dev ? ".next-showcase" : buildDir;
  if (!dev) {
    const buildId = join(root, buildDir, "BUILD_ID");
    const stale = !existsSync(buildId) || newestSourceTime() > statSync(buildId).mtimeMs;
    if (stale || args.has("--rebuild")) {
      say("Building NFROS for fast loading (about 10 minutes, only after code changes)...");
      if (!run(process.execPath, [`"${nextBin}"`, "build"])) {
        say("The build failed. Starting the development server instead.");
        mode = "dev";
        process.env.NFR_DIST_DIR = ".next-showcase";
      }
    }
  }

  say("");
  say(`Starting NFROS on ${url}`);
  say("Keep this window open while you use NFROS. Close it to stop the server.");
  say("To start the showcase day again, close this window and delete data\\showcase.db.");
  say("");
  const server = spawn(process.execPath, [nextBin, mode, "-p", String(port)], { stdio: "inherit", env: process.env });
  server.on("exit", (code) => process.exit(code ?? 0));

  // The first request after a start loads the server code and data; make it here, not in the
  // presenter's first click. The starting page waits for the landing page to render.
  while (!(await portAnswers())) await new Promise((r) => setTimeout(r, 500));
  for (const path of ["/", "/workday", "/workday/rcsa", "/workday/tprm", "/workday/rcsa/work", "/workday/rcsa/processes/rcsa-cycle", "/workday/rcsa/decisions", "/product"]) {
    try { await fetch(url.replace(/\/$/, "") + path); } catch {}
  }
  say("NFROS is warmed up and ready.");
})();

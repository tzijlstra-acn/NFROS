// Stops the NFR Workspace showcase on port 3200: the server the launcher started (data/showcase.pid)
// or, without that file, the Node process listening on port 3200. Never stops anything else: a
// process on port 3200 that is not Node is reported and left alone.
//   node scripts/launcher/stop.cjs
const { existsSync, readFileSync, unlinkSync, appendFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");
const { execSync } = require("node:child_process");

const root = join(__dirname, "..", "..");
const port = 3200;
const pidFile = join(root, "data", "showcase.pid");
const logFile = join(root, "data", "launcher.log");

function say(line) {
  console.log(line);
  try { mkdirSync(join(root, "data"), { recursive: true }); appendFileSync(logFile, `${new Date().toISOString()} stop: ${line}\n`); } catch {}
}
function sh(command) {
  try { return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { return ""; }
}
function imageOf(pid) {
  const row = sh(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`).trim();
  return row.startsWith('"') ? row.split('","')[0].replace(/"/g, "") : null;
}
function listener() {
  for (const line of sh("netstat -ano -p tcp").split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 5 && parts[3] === "LISTENING" && parts[1].endsWith(`:${port}`)) return Number(parts[4]);
  }
  return null;
}

let pid = null;
if (existsSync(pidFile)) pid = Number(readFileSync(pidFile, "utf8").trim()) || null;
if (pid && !imageOf(pid)) pid = null;
if (!pid) pid = listener();

if (!pid) {
  say(`NFR Workspace is not running on port ${port}.`);
  try { if (existsSync(pidFile)) unlinkSync(pidFile); } catch {}
  process.exit(0);
}
const image = imageOf(pid);
if (!image || image.toLowerCase() !== "node.exe") {
  say(`Port ${port} is held by ${image || "an unknown process"} (PID ${pid}), not NFR Workspace. Nothing was stopped.`);
  process.exit(1);
}
sh(`taskkill /PID ${pid} /T /F`);
try { if (existsSync(pidFile)) unlinkSync(pidFile); } catch {}
say(listener() ? `Asked NFR Workspace (PID ${pid}) to stop; port ${port} is still busy, try again in a few seconds.` : `NFR Workspace stopped (PID ${pid}).`);

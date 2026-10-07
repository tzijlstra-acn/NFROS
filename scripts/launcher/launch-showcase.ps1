# Launches the NFROS showcase: its own database (data/showcase.db), a production server on
# port 3200, and the browser. If the showcase is already running it only opens the browser.
# The shared demonstration database (data/nfr-workos.db) and port 3000 are never touched.
#
# Production mode, not `next dev`: pages are compiled once by `next build` and then served
# ready, about 15 times faster per page than the development server. The build is redone only
# when the code has changed since the last one (the commit and the working-tree state are
# stamped into the build folder). Pass -Dev to run the development server instead.

param([switch]$Dev)

$ErrorActionPreference = "Stop"
$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$port = 3200
$url = "http://localhost:$port/"
$db = Join-Path $repo "data\showcase.db"
$buildDir = ".next-showcase-prod"
$stampFile = Join-Path $repo "$buildDir\nfros-build-stamp.txt"

Set-Location $repo
$Host.UI.RawUI.WindowTitle = "NFROS showcase (port $port)"

# A direct connection test: Get-NetTCPConnection takes several seconds per call on Windows
function Test-Port([int]$p) {
  $client = New-Object System.Net.Sockets.TcpClient
  try { return $client.ConnectAsync("127.0.0.1", $p).Wait(300) } catch { return $false } finally { $client.Dispose() }
}

if (Test-Port $port) {
  Write-Host "NFROS is already running. Opening $url"
  Start-Process $url
  exit 0
}

# The browser opens at once on a local starting page, which switches to NFROS when it answers
Start-Process (Join-Path $PSScriptRoot "starting.html")

$env:NFR_DB_PATH = $db
$env:NFR_DEMO_MODE = "safe"

$fresh = -not (Test-Path $db)
# The TypeScript migration step takes minutes to start, so it runs only when a migration is pending
node scripts/launcher/db-current.cjs $db
if ($LASTEXITCODE -ne 0) {
  Write-Host "Updating the showcase database (a few minutes, only after an update)..."
  npx tsx scripts/migrate.ts
}
if ($fresh) {
  Write-Host "First run: seeding the synthetic institution (a few minutes)..."
  npx tsx scripts/seed.ts
}

if ($Dev) {
  $env:NFR_DIST_DIR = ".next-showcase"
} else {
  $env:NFR_DIST_DIR = $buildDir
  # The code version: the commit plus a digest of any uncommitted changes
  $head = (git rev-parse HEAD) 2>$null
  # Tracked changes only: a full status scan of this repo takes seconds
  $dirty = (git diff HEAD -- app src public next.config.ts package.json) 2>$null | Out-String
  $hasher = [System.Security.Cryptography.SHA256]::Create()
  $stamp = "$head " + [BitConverter]::ToString($hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($dirty))).Replace("-", "")
  $built = (Test-Path (Join-Path $repo "$buildDir\BUILD_ID")) -and (Test-Path $stampFile) -and ((Get-Content $stampFile -Raw).Trim() -eq $stamp)
  if (-not $built) {
    Write-Host "Building NFROS for fast loading (about 10 minutes, only after code changes)..."
    npx next build
    if ($LASTEXITCODE -ne 0) {
      Write-Host "The build failed. Starting the development server instead."
      $Dev = $true
      $env:NFR_DIST_DIR = ".next-showcase"
    } else {
      Set-Content -Path $stampFile -Value $stamp -Encoding ascii
    }
  }
}

Write-Host ""
Write-Host "Starting NFROS on $url"
Write-Host "Keep this window open while you use NFROS. Close it to stop the server."
Write-Host "To start the showcase day again, close this window and delete data\showcase.db."
Write-Host ""
$next = Join-Path $repo "node_modules\next\dist\bin\next"
if ($Dev) { node $next dev -p $port } else { node $next start -p $port }

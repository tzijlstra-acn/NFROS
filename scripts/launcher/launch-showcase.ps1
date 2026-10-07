# Launches the NFROS showcase: its own database (data/showcase.db), a dev server on port 3200,
# and the browser. If the showcase is already running it only opens the browser.
# The shared demonstration database (data/nfr-workos.db) and port 3000 are never touched.

$ErrorActionPreference = "Stop"
$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$port = 3200
$url = "http://localhost:$port/"
$db = Join-Path $repo "data\showcase.db"

Set-Location $repo
$Host.UI.RawUI.WindowTitle = "NFROS showcase (port $port)"

function Test-Running {
  return [bool](Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
}

if (Test-Running) {
  Write-Host "NFROS is already running. Opening $url"
  Start-Process $url
  exit 0
}

$env:NFR_DB_PATH = $db
$env:NFR_DIST_DIR = ".next-showcase"
$env:NFR_DEMO_MODE = "safe"

$fresh = -not (Test-Path $db)
Write-Host "Preparing the showcase database..."
npx tsx scripts/migrate.ts
if ($fresh) {
  Write-Host "First run: seeding the synthetic institution (about a minute)..."
  npx tsx scripts/seed.ts
}

# Open the browser once the server answers
Start-Job -ScriptBlock {
  param($port, $url)
  for ($i = 0; $i -lt 180; $i++) {
    if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) {
      try { Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 120 | Out-Null } catch {}
      Start-Process $url
      return
    }
    Start-Sleep -Seconds 2
  }
} -ArgumentList $port, $url | Out-Null

Write-Host ""
Write-Host "Starting NFROS on $url"
Write-Host "Keep this window open while you use NFROS. Close it to stop the server."
Write-Host "To start the showcase day again, close this window and delete data\showcase.db."
Write-Host ""
npx next dev -p $port

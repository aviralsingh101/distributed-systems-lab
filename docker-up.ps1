# Start the full local stack (web + notes-api + Postgres).
# Usage (from repo root, in PowerShell):
#   .\docker-up.ps1
#   .\docker-up.ps1 -Pull
#   .\docker-up.ps1 -NoBuild
#
# Prefer this on Windows. "bash ./docker-up.sh" launches WSL, which often
# cannot reach Docker Desktop unless WSL integration is enabled.

param(
  [switch]$Pull,
  [switch]$NoBuild,
  [switch]$Help
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if ($env:DOCKERHUB_USER) {
  # keep existing
} else {
  $env:DOCKERHUB_USER = "aviralsingh101"
}

if ($Help) {
  Write-Host "Usage: .\docker-up.ps1 [-Pull] [-NoBuild]"
  Write-Host "  (default)  docker compose up -d --build"
  Write-Host "  -NoBuild   docker compose up -d"
  Write-Host "  -Pull      docker compose -f docker-compose.hub.yml pull && up -d"
  exit 0
}

function Test-DockerEngine {
  try {
    $out = & docker info 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) { return $false }
    if ($out -match "could not be found in this WSL") { return $false }
    if ($out -match "error during connect") { return $false }
    return $true
  } catch {
    return $false
  }
}

if (-not (Test-DockerEngine)) {
  Write-Host "ERROR: Docker engine is not reachable from this shell." -ForegroundColor Red
  Write-Host "Start Docker Desktop, wait until it says Running, then retry."
  Write-Host "If you used bash ./docker-up.sh, that opens WSL - use this instead:"
  Write-Host "  .\docker-up.ps1"
  exit 1
}

if ($Pull) {
  Write-Host "==> Pulling images for $($env:DOCKERHUB_USER)"
  docker compose -f docker-compose.hub.yml pull
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  Write-Host "==> Starting stack (Hub images)"
  docker compose -f docker-compose.hub.yml up -d
} elseif ($NoBuild) {
  Write-Host "==> Starting stack (no rebuild)"
  docker compose up -d
} else {
  Write-Host "==> Building and starting stack"
  docker compose up -d --build
}

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> Status"
docker compose ps
Write-Host ""
Write-Host "Open http://127.0.0.1:8080  (Notes tab needs this stack)"
Write-Host "Stop:  docker compose down"
Write-Host "Wipe notes DB volume: docker compose down -v"

#!/usr/bin/env bash
# Start the full local stack (web + notes-api + Postgres).
# Usage (from repo root):
#   ./docker-up.sh          # build if needed, then start
#   ./docker-up.sh --pull   # use Hub images (docker-compose.hub.yml)
#   ./docker-up.sh --no-build

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

export DOCKERHUB_USER="${DOCKERHUB_USER:-aviralsingh101}"

MODE="build"
for arg in "$@"; do
  case "$arg" in
    --pull) MODE="pull" ;;
    --no-build) MODE="up" ;;
    -h|--help)
      echo "Usage: $0 [--pull|--no-build]"
      echo "  (default)  docker compose up -d --build"
      echo "  --no-build docker compose up -d"
      echo "  --pull     docker compose -f docker-compose.hub.yml pull && up -d"
      exit 0
      ;;
  esac
done

# On Windows, `bash` is often WSL — Docker Desktop may be up but unreachable here.
DOCKER_INFO="$(docker info 2>&1)" || true
if ! docker info >/dev/null 2>&1 \
  || echo "$DOCKER_INFO" | grep -qiE 'could not be found in this WSL|error during connect|Cannot connect to the Docker daemon'; then
  echo "ERROR: Docker engine is not reachable from this shell." >&2
  echo "Start Docker Desktop and wait until it is Running." >&2
  if grep -qi microsoft /proc/version 2>/dev/null; then
    echo "" >&2
    echo "You are in WSL. Either:" >&2
    echo "  1) PowerShell (recommended):  .\\docker-up.ps1" >&2
    echo "  2) Enable Docker Desktop → Settings → Resources → WSL integration" >&2
  fi
  exit 1
fi

case "$MODE" in
  pull)
    echo "==> Pulling images for ${DOCKERHUB_USER}"
    docker compose -f docker-compose.hub.yml pull
    echo "==> Starting stack (Hub images)"
    docker compose -f docker-compose.hub.yml up -d
    ;;
  up)
    echo "==> Starting stack (no rebuild)"
    docker compose up -d
    ;;
  *)
    echo "==> Building and starting stack"
    docker compose up -d --build
    ;;
esac

echo "==> Status"
docker compose ps
echo ""
echo "Open http://127.0.0.1:8080  (Notes tab needs this stack)"
echo "Stop:  docker compose down"
echo "Wipe notes DB volume: docker compose down -v"

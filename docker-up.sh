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

if ! docker info >/dev/null 2>&1; then
  echo "ERROR: Docker engine is not running. Start Docker Desktop and retry." >&2
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

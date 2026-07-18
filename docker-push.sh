#!/usr/bin/env bash
# Build and push web + notes-api images to Docker Hub.
# Usage (from repo root):
#   ./docker-push.sh
#   DOCKERHUB_USER=myuser ./docker-push.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

export DOCKERHUB_USER="${DOCKERHUB_USER:-aviralsingh99}"

echo "==> Docker login (enter Docker Hub credentials if prompted)"
docker login

echo "==> Building images as ${DOCKERHUB_USER}/dsl-web and ${DOCKERHUB_USER}/dsl-notes-api"
docker compose build

echo "==> Pushing ${DOCKERHUB_USER}/dsl-web:latest"
docker push "${DOCKERHUB_USER}/dsl-web:latest"

echo "==> Pushing ${DOCKERHUB_USER}/dsl-notes-api:latest"
docker push "${DOCKERHUB_USER}/dsl-notes-api:latest"

echo "==> Done. Pull on another machine with:"
echo "    DOCKERHUB_USER=${DOCKERHUB_USER} docker compose -f docker-compose.hub.yml pull"
echo "    DOCKERHUB_USER=${DOCKERHUB_USER} docker compose -f docker-compose.hub.yml up -d"

#!/usr/bin/env bash
set -euo pipefail

# Ensure script runs from its own directory (d3/), so env files and compose live nearby
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
cd "$SCRIPT_DIR"

# Use local .env if present, otherwise try to bootstrap from example
if [ -f .env ]; then
  echo "Using .env from $SCRIPT_DIR"
elif [ -f .env.example ]; then
  echo ".env not found. Creating from .env.example ..."
  cp .env.example .env
  echo "Created $SCRIPT_DIR/.env. Please review and re-run ./deploy.sh"
  exit 1
else
  echo "No .env or .env.example found in $SCRIPT_DIR. Aborting."
  exit 1
fi

echo "Building images..."
docker compose build

echo "Starting stack..."
docker compose up -d

echo "Running database migrations (or pushing schema if needed)..."
if ! docker compose exec -T api npx prisma migrate deploy; then
  echo "No migrations found. Pushing schema..."
  docker compose exec -T api npx prisma db push
fi

echo "Seeding quotes (idempotent)..."
docker compose exec -T api node -e "(async()=>{try{require('fs');}catch(e){} })()" >/dev/null 2>&1 || true
docker compose exec -T api npx ts-node prisma/seed.ts || true

echo "D3 is up. Visit http://localhost:${WEB_PORT:-8080}"



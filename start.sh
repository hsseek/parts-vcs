#!/bin/bash
# Build frontend and serve everything from the backend on port 8000

set -e
ROOT=$(cd "$(dirname "$0")" && pwd)

if [ ! -f "$ROOT/backend/.env" ]; then
  echo "⚠  backend/.env not found."
  exit 1
fi

export $(grep -v '^#' "$ROOT/backend/.env" | xargs)

echo "Building frontend..."
cd "$ROOT/frontend"
npm run build

echo "Starting server on port 8000..."
cd "$ROOT/backend"
uvicorn main:app --host 0.0.0.0 --port 8000

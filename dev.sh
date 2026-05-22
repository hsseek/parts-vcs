#!/bin/bash
# Run backend and frontend dev servers concurrently

set -e
ROOT=$(cd "$(dirname "$0")" && pwd)

# Check .env
if [ ! -f "$ROOT/backend/.env" ]; then
  echo "⚠  backend/.env not found. Copy backend/.env.example to backend/.env and fill in your Onshape API keys."
  exit 1
fi

# Load env for backend
export $(grep -v '^#' "$ROOT/backend/.env" | xargs)

echo "Starting PartVCS..."

# Backend
cd "$ROOT/backend"
uvicorn main:app --reload --port 8000 &
BACK_PID=$!

# Frontend
cd "$ROOT/frontend"
npm run dev &
FRONT_PID=$!

echo ""
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both."

trap "kill $BACK_PID $FRONT_PID 2>/dev/null" EXIT
wait

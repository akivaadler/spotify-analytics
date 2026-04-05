#!/bin/bash
# Start backend and frontend together
# Usage: ./start.sh
# Optional: export ANTHROPIC_API_KEY=sk-ant-... before running for LLM custom queries

export PATH="/opt/homebrew/opt/node@20/bin:$PATH"

# Capture absolute root directory before any cd
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Start backend
cd "$ROOT_DIR/backend"
uvicorn main:app --reload &
BACKEND_PID=$!

# Start frontend
cd "$ROOT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:3000"
echo ""
echo "  Press Ctrl+C to stop both"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait

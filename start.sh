#!/bin/bash
# Start backend and frontend together
# Usage: ./start.sh

export PATH="/opt/homebrew/opt/node@20/bin:$PATH"

# Start backend
cd "$(dirname "$0")/backend"
uvicorn main:app --reload &
BACKEND_PID=$!

# Start frontend
cd "$(dirname "$0")/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:3000"
echo ""
echo "  Press Ctrl+C to stop both"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait

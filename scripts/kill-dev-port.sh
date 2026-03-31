#!/bin/sh

set -eu

PORT="${1:-5173}"

PIDS="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"

if [ -z "$PIDS" ]; then
  echo "No listening process found on port $PORT"
  exit 0
fi

echo "Stopping process(es) on port $PORT: $PIDS"
kill -9 $PIDS
echo "Port $PORT is now free"

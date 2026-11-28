#!/usr/bin/env bash
# Build and serve the production app on $PORT (default 3100), stopping any
# server already on that port first so a stale build is never served.
set -euo pipefail
PORT="${PORT:-3100}"
pkill -f "next start -p $PORT" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
sleep 1
# Cached catalogue responses from an earlier run must not leak into this one
# (the database is reset before every e2e run).
rm -rf .next/cache/fetch-cache
npm run build
exec npx next start -p "$PORT"

#!/usr/bin/env bash
# Local Supabase (Postgres + Auth + REST + Storage) for development and tests.
#   npm run db:start  — start the stack; migrations + seed apply on first start
#   npm run db:reset  — re-apply all migrations and seed.sql from scratch
#   npm run db:stop   — stop the stack
#   npm run db:env    — print the local URL/keys as KEY=value lines
# Uses Docker Hub images (SUPABASE_INTERNAL_IMAGE_REGISTRY) so it also works
# where the default registry is rate-limited.
set -euo pipefail
cd "$(dirname "$0")/.."
export SUPABASE_INTERNAL_IMAGE_REGISTRY="${SUPABASE_INTERNAL_IMAGE_REGISTRY:-docker.io}"
SB="npx --no-install supabase"

case "${1:-start}" in
  start) $SB start ;;
  reset) $SB db reset ;;
  stop) $SB stop --no-backup ;;
  env) $SB status -o env ;;
  *) echo "usage: $0 start|reset|stop|env" >&2; exit 1 ;;
esac

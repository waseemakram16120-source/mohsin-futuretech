#!/usr/bin/env bash
# Local Postgres (Supabase image) for database tests.
#   npm run db:start  — start the container (if needed) and apply everything
#   npm run db:reset  — drop and re-create the database, re-apply everything
#   npm run db:stop   — remove the container
set -euo pipefail

NAME="${MF_DB_CONTAINER:-mf-db}"
PORT="${MF_DB_PORT:-54322}"
IMAGE="supabase/postgres:15.8.1.085"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

psql_c() { docker exec -i "$NAME" psql -v ON_ERROR_STOP=1 -q -U postgres -d postgres "$@"; }

wait_ready() {
  for _ in $(seq 1 60); do
    if docker exec "$NAME" pg_isready -U postgres -q 2>/dev/null \
      && docker exec "$NAME" psql -U postgres -tAc "select 1 from pg_roles where rolname='authenticated'" 2>/dev/null | grep -q 1; then
      sleep 2; return 0
    fi
    sleep 1
  done
  echo "Database did not become ready" >&2; exit 1
}

apply_all() {
  # The shim touches Supabase-owned schemas, so it runs as the superuser.
  docker exec -i -e PGPASSWORD=postgres "$NAME" psql -v ON_ERROR_STOP=1 -q -U supabase_admin -h localhost -d postgres \
    < "$ROOT/tests/db/local-shim.sql"
  for f in "$ROOT"/supabase/migrations/*.sql; do
    echo "Applying $(basename "$f")"
    psql_c < "$f"
  done
  echo "Applying seed.sql"
  psql_c < "$ROOT/supabase/seed.sql"
}

case "${1:-start}" in
  start)
    if ! docker ps --format '{{.Names}}' | grep -qx "$NAME"; then
      docker rm -f "$NAME" >/dev/null 2>&1 || true
      docker run -d --name "$NAME" -e POSTGRES_PASSWORD=postgres -p "$PORT:5432" "$IMAGE" >/dev/null
      wait_ready
      apply_all
    fi
    echo "Local database ready on postgres://postgres:postgres@localhost:$PORT/postgres"
    ;;
  reset)
    docker rm -f "$NAME" >/dev/null 2>&1 || true
    "$0" start
    ;;
  stop)
    docker rm -f "$NAME" >/dev/null 2>&1 || true
    ;;
  *) echo "usage: $0 start|reset|stop" >&2; exit 1 ;;
esac

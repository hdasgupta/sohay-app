#!/usr/bin/env bash
# Database helper
#   ./scripts/db.sh start                 start the local PostgreSQL service (Linux / macOS)
#   ./scripts/db.sh create                create local databases appointment_dev and appointment_test
#   ./scripts/db.sh init   [env]          create schema + admin + medicines if the DB is empty (default env: development)
#   ./scripts/db.sh reset  [env]          DROP every table / index / type / extension and recreate (asks for confirmation)
#   ./scripts/db.sh status [env]          show whether the DB is initialised and the medicine count
#   ./scripts/db.sh medicines [env]       load the medicine list if the table is empty
#   ./scripts/db.sh cleanup-test [env]    delete automated-test users (@autotest.wbfmh.local) and their PDFs
#   ./scripts/db.sh psql   [env]          open psql on the DATABASE_URL of that env
# env = development | test | production   (production uses backend/.env.production -> Neon)
source "$(dirname "$0")/_common.sh"
need node
CMD="${1:-help}"; ENV_NAME="${2:-development}"
LOCAL_URL="${LOCAL_PG_URL:-postgresql://postgres:postgres@localhost:5432/postgres}"

db_url() { grep -E '^DATABASE_URL=' "$BACKEND_DIR/.env.$ENV_NAME" | head -1 | cut -d= -f2-; }
run_cli() { (cd "$BACKEND_DIR" && NODE_ENV="$ENV_NAME" node src/db/cli.js "$@"); }

case "$CMD" in
  start)
    if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files | grep -q postgresql; then sudo systemctl start postgresql
    elif command -v service >/dev/null 2>&1; then sudo service postgresql start
    elif command -v brew >/dev/null 2>&1; then brew services start postgresql
    else fail "Start PostgreSQL manually"; fi
    ok "PostgreSQL started" ;;
  create)
    need psql
    for db in appointment_dev appointment_test; do
      if psql "$LOCAL_URL" -tAc "SELECT 1 FROM pg_database WHERE datname = '$db'" | grep -q 1; then info "$db already exists"
      else psql "$LOCAL_URL" -c "CREATE DATABASE $db" && ok "created $db"; fi
    done ;;
  init)       run_cli init ;;
  status)     run_cli status ;;
  medicines)  run_cli medicines ;;
  cleanup-test) run_cli cleanup-test-data ;;
  reset)
    warn "This deletes EVERY table, index, type and extension in the $ENV_NAME database."
    read -r -p "Type RESET to continue: " answer
    [ "$answer" = "RESET" ] || fail "Cancelled"
    run_cli reset ;;
  psql)       need psql; psql "$(db_url)" ;;
  *) sed -n '2,12p' "$0" ;;
esac

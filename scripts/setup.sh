#!/usr/bin/env bash
# One time local setup: install dependencies, create and initialise the local databases.
source "$(dirname "$0")/_common.sh"
DIR="$(dirname "$0")"
info "Installing backend dependencies";  "$DIR/backend.sh" install
info "Installing frontend dependencies"; "$DIR/frontend.sh" install
if command -v psql >/dev/null 2>&1; then
  "$DIR/db.sh" create || warn "Could not create local databases - create appointment_dev / appointment_test manually"
  "$DIR/db.sh" init development
else
  warn "psql not found - skipping local database creation"
fi
ok "Setup complete. Run ./scripts/run.sh to start backend + frontend."

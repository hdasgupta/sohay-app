#!/usr/bin/env bash
# Start backend (port 5000) and frontend (port 5173) together for local development.
#   ./scripts/run.sh            real emails through Resend
#   ./scripts/run.sh console    emails printed in the backend console
source "$(dirname "$0")/_common.sh"
DIR="$(dirname "$0")"
MODE="dev"; [ "${1:-}" = "console" ] && MODE="dev-console"
"$DIR/backend.sh" "$MODE" & BACK=$!
"$DIR/frontend.sh" dev & FRONT=$!
trap 'kill $BACK $FRONT 2>/dev/null || true' INT TERM EXIT
info "Backend  -> http://localhost:5000/api/health"
info "Frontend -> http://localhost:5173"
wait

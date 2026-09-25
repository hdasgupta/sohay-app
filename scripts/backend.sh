#!/usr/bin/env bash
# Backend helper
#   ./scripts/backend.sh install     npm ci (or npm install)
#   ./scripts/backend.sh dev         run with NODE_ENV=development (local PostgreSQL, auto reload)
#   ./scripts/backend.sh dev-console same as dev but emails are printed to the console (no Resend)
#   ./scripts/backend.sh start       run with NODE_ENV=production (Neon) - what Render runs
#   ./scripts/backend.sh test        API + unit tests against appointment_test
#   ./scripts/backend.sh perf        performance / load tests
source "$(dirname "$0")/_common.sh"
need node; need npm
cd "$BACKEND_DIR"
case "${1:-help}" in
  install)     if [ -f package-lock.json ]; then npm ci; else npm install; fi ;;
  dev)         NODE_ENV=development node --watch server.js ;;
  dev-console) EMAIL_PROVIDER=console NODE_ENV=development node --watch server.js ;;
  start)       NODE_ENV=production node server.js ;;
  test)        npm test ;;
  perf)        npm run test:perf ;;
  *) sed -n '2,8p' "$0" ;;
esac
